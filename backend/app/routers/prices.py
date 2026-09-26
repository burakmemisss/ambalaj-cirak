"""Fiyat listesi router — Excel/PDF import (AI Vision destekli + Fallback hafıza)"""
import io
import json
import base64
import traceback
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from app.database import get_supabase
from app.services.scheduler import convert_to_try
from app.services.gemini import chat_with_gemini, extract_prices_from_pdf_vision

router = APIRouter()

# Bellekte tutulan fiyat listesi önbelleği (DB erişimi olmadığı durumlarda güvenli yedek)
IN_MEMORY_PRICES: List[dict] = []


class PriceEntry(BaseModel):
    supplier_id: str
    product_category: str
    product_name: Optional[str] = None
    unit: str = "adet"
    base_price: float
    currency: str = "TRY"
    valid_date: Optional[str] = None
    notes: Optional[str] = None


@router.get("/supplier/{supplier_id}")
async def get_supplier_prices(supplier_id: str, convert_to_try_flag: bool = True):
    """Tedarikçinin fiyat listesini getir (isteğe bağlı TRY'ye çevir)."""
    prices = []
    try:
        supabase = get_supabase()
        result = (
            supabase.from_("latest_supplier_prices")
            .select("*")
            .eq("supplier_id", supplier_id)
            .execute()
        )
        if result.data:
            prices = result.data
    except Exception:
        prices = [p for p in IN_MEMORY_PRICES if p.get("supplier_id") == supplier_id]

    if convert_to_try_flag:
        for price in prices:
            if price.get("currency") != "TRY":
                try:
                    price["price_in_try"] = await convert_to_try(
                        float(price["base_price"]), price["currency"]
                    )
                except Exception:
                    price["price_in_try"] = None

    return prices


@router.post("/")
async def add_price(entry: PriceEntry):
    """Manuel fiyat girişi."""
    entry_dict = entry.model_dump()
    try:
        supabase = get_supabase()
        result = supabase.table("supplier_price_lists").insert(entry_dict).execute()
        if result.data:
            return result.data[0]
    except Exception:
        pass

    IN_MEMORY_PRICES.append(entry_dict)
    return entry_dict


@router.post("/import/excel/{supplier_id}")
async def import_excel(supplier_id: str, file: UploadFile = File(...)):
    """Excel / CSV fiyat listesi import et."""
    try:
        contents = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Dosya okunamadı: {str(e)}")

    if not contents:
        raise HTTPException(status_code=400, detail="Dosya boş görünüyor.")

    try:
        import pandas as pd
    except ImportError:
        raise HTTPException(status_code=500, detail="pandas kütüphanesi kurulu değil.")

    df = None
    parse_error = ""

    for engine in ["openpyxl", "xlrd"]:
        try:
            df = pd.read_excel(io.BytesIO(contents), engine=engine)
            break
        except Exception as e:
            parse_error = str(e)
            continue

    if df is None:
        for sep in [",", ";", "\t"]:
            try:
                df = pd.read_csv(io.BytesIO(contents), sep=sep, encoding="utf-8")
                if len(df.columns) > 1:
                    break
            except Exception:
                try:
                    df = pd.read_csv(io.BytesIO(contents), sep=sep, encoding="latin-1")
                    if len(df.columns) > 1:
                        break
                except Exception:
                    continue

    if df is None or df.empty:
        raise HTTPException(
            status_code=422,
            detail=f"Dosya ayrıştırılamadı. Lütfen .xlsx veya .csv formatını deneyin. Hata: {parse_error}"
        )

    col_map = {
        "ürün": "product_name", "urun": "product_name", "product": "product_name",
        "ürün adı": "product_name", "urun adi": "product_name", "ad": "product_name",
        "isim": "product_name", "name": "product_name", "açıklama": "product_name",
        "aciklama": "product_name", "description": "product_name",
        "kategori": "product_category", "category": "product_category", "tip": "product_category",
        "birim": "unit", "unit": "unit", "br": "unit",
        "fiyat": "base_price", "price": "base_price", "tutar": "base_price",
        "birim fiyat": "base_price", "birimfiyat": "base_price", "satış fiyatı": "base_price",
        "satis fiyati": "base_price", "maliyet": "base_price", "cost": "base_price",
        "para birimi": "currency", "currency": "currency", "doviz": "currency", "döviz": "currency",
    }

    df.columns = [col_map.get(str(c).lower().strip(), str(c).lower().strip()) for c in df.columns]

    if "base_price" not in df.columns:
        for col in df.columns:
            try:
                df[col] = pd.to_numeric(df[col], errors="coerce")
                if df[col].notna().sum() > 0:
                    df = df.rename(columns={col: "base_price"})
                    break
            except Exception:
                continue

    if "product_name" not in df.columns:
        for col in df.columns:
            if col != "base_price":
                df = df.rename(columns={col: "product_name"})
                break

    inserted = 0
    imported_items = []
    skipped = 0

    for _, row in df.iterrows():
        try:
            raw_price = row.get("base_price", None)
            if raw_price is None or str(raw_price).strip() in ["", "nan", "NaN", "None"]:
                skipped += 1
                continue

            price_val = float(str(raw_price).replace(",", ".").replace(" ", ""))
            if price_val <= 0:
                skipped += 1
                continue

            product_name = str(row.get("product_name", "Ambalaj Ürünü")).strip()
            if product_name in ["nan", "NaN", "None", ""]:
                product_name = "Ambalaj Ürünü"

            currency_val = str(row.get("currency", "TRY")).strip().upper()
            if currency_val in ["NAN", "NONE", ""]:
                currency_val = "TRY"

            entry = {
                "supplier_id": supplier_id,
                "product_name": product_name,
                "product_category": str(row.get("product_category", "genel")).strip(),
                "unit": str(row.get("unit", "adet")).strip(),
                "base_price": price_val,
                "currency": currency_val,
                "source_type": "excel",
                "source_file": file.filename,
            }
            imported_items.append(entry)
            IN_MEMORY_PRICES.append(entry)

            try:
                supabase = get_supabase()
                supabase.table("supplier_price_lists").insert(entry).execute()
            except Exception:
                pass

            inserted += 1
        except Exception:
            skipped += 1
            continue

    if inserted == 0:
        raise HTTPException(
            status_code=422,
            detail=f"Dosya okundu ({len(df)} satır) ancak geçerli fiyat verisi bulunamadı. "
                   f"Lütfen fiyat sütununun sayısal değerler içerdiğinden emin olun. "
                   f"Atlanan satır: {skipped}"
        )

    return {
        "success": True,
        "imported": inserted,
        "skipped": skipped,
        "total_rows": len(df),
        "items": imported_items
    }


@router.post("/import/pdf/{supplier_id}")
async def import_pdf(supplier_id: str, file: UploadFile = File(...)):
    """PDF fiyat listesi import et — Gemini AI Vision ile akıllı ayrıştırma (taranmış PDF dahil)."""
    try:
        contents = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Dosya okunamadı: {str(e)}")

    if not contents:
        raise HTTPException(status_code=400, detail="Dosya boş görünüyor.")

    # Gemini Vision ile PDF'yi direkt analiz et (metin veya taranmış olsun fark etmez)
    items = await extract_prices_from_pdf_vision(contents, file.filename or "fiyat_listesi.pdf")

    if not items:
        raise HTTPException(
            status_code=422,
            detail="PDF analiz edildi ancak içinde fiyat listesi bulunamadı. "
                   "Lütfen dosyanın bir ürün/fiyat listesi içerdiğinden emin olun."
        )

    inserted = 0
    imported_items = []

    for item in items:
        try:
            if not isinstance(item, dict):
                continue
            price = float(item.get("base_price", 0))
            if price <= 0:
                continue

            entry = {
                "supplier_id": supplier_id,
                "product_name": str(item.get("product_name", "Ambalaj Ürünü")),
                "product_category": str(item.get("product_category", "ambalaj")),
                "unit": str(item.get("unit", "adet")),
                "base_price": price,
                "currency": str(item.get("currency", "TRY")).upper(),
                "source_type": "pdf",
                "source_file": file.filename,
            }
            imported_items.append(entry)
            IN_MEMORY_PRICES.append(entry)

            try:
                supabase = get_supabase()
                supabase.table("supplier_price_lists").insert(entry).execute()
            except Exception:
                pass

            inserted += 1
        except Exception:
            continue

    if inserted == 0:
        raise HTTPException(
            status_code=422,
            detail="PDF okundu ve analiz edildi ancak geçerli fiyat verisi (sayısal fiyat > 0) bulunamadı."
        )

    return {"success": True, "imported": inserted, "items": imported_items}
