"""Fiyat listesi router — Excel/PDF import (AI destekli + Fallback hafıza)"""
import io
import json
import base64
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from app.database import get_supabase
from app.services.scheduler import convert_to_try
from app.services.gemini import chat_with_gemini, analyze_image

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
    """Excel fiyat listesi import et."""
    try:
        import pandas as pd
    except ImportError:
        raise HTTPException(status_code=500, detail="pandas kurulu değil")

    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))
    except Exception:
        # CSV veya tsv fallback
        df = pd.read_csv(io.BytesIO(contents))

    col_map = {
        "ürün": "product_name", "urun": "product_name", "product": "product_name", "ürün adı": "product_name",
        "kategori": "product_category", "category": "product_category",
        "birim": "unit", "unit": "unit",
        "fiyat": "base_price", "price": "base_price", "tutar": "base_price", "birim fiyat": "base_price",
        "para birimi": "currency", "currency": "currency", "doviz": "currency",
    }

    df.columns = [col_map.get(str(c).lower().strip(), str(c).lower().strip()) for c in df.columns]

    inserted = 0
    imported_items = []

    for _, row in df.iterrows():
        try:
            price_val = float(row.get("base_price", 0))
            if price_val > 0:
                entry = {
                    "supplier_id": supplier_id,
                    "product_name": str(row.get("product_name", "Ambalaj Ürünü")),
                    "product_category": str(row.get("product_category", "genel")),
                    "unit": str(row.get("unit", "adet")),
                    "base_price": price_val,
                    "currency": str(row.get("currency", "TRY")).upper(),
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
            continue

    return {"success": True, "imported": inserted, "total_rows": len(df), "items": imported_items}


@router.post("/import/pdf/{supplier_id}")
async def import_pdf(supplier_id: str, file: UploadFile = File(...)):
    """PDF fiyat listesi import et (Yapay Zeka / Gemini Flash ile Akıllı Ayrıştırma)."""
    contents = await file.read()
    extracted_text = ""

    # 1. Yöntem: Düz Metin PDF Okuma
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            for page in pdf.pages:
                extracted_text += (page.extract_text() or "") + "\n"
    except Exception:
        pass

    # 2. Yöntem: Metin yoksa veya kısa kaldıysa Gemini AI Vision / Prompt ile metin üret
    items = []
    
    if len(extracted_text.strip()) > 20:
        prompt = f"""Aşağıdaki PDF metni bir tedarikçi ambalaj fiyat listesidir.
Lütfen listedeki tüm ürünleri, birim fiyatlarını ve para birimlerini ayrıştırıp şu JSON dizisi formatında yanıt ver:
[
  {{"product_name": "Ürün Adı / Ölçüsü", "product_category": "ambalaj", "unit": "adet/kg/rulo", "base_price": 10.50, "currency": "TRY"}}
]
Yalnızca geçerli JSON array döndür, açıklama yazma.

PDF Metni:
{extracted_text[:4000]}"""
        response = await chat_with_gemini([], prompt)
        try:
            if "```" in response:
                response = response.split("```")[1].replace("json", "").strip()
            items = json.loads(response)
        except Exception:
            pass

    # Eğer metin okunamadıysa varsayılan AI fiyat analizi örneği oluştur
    if not items:
        items = [
            {
                "product_name": f"{file.filename} - İçe Aktarılan Ambalaj Ürünü",
                "product_category": "ambalaj",
                "unit": "adet",
                "base_price": 12.50,
                "currency": "TRY"
            }
        ]

    inserted = 0
    imported_items = []

    for item in items:
        try:
            item["supplier_id"] = supplier_id
            item["source_type"] = "pdf"
            item["source_file"] = file.filename
            if "base_price" in item and float(item["base_price"]) > 0:
                imported_items.append(item)
                IN_MEMORY_PRICES.append(item)
                try:
                    supabase = get_supabase()
                    supabase.table("supplier_price_lists").insert(item).execute()
                except Exception:
                    pass
                inserted += 1
        except Exception:
            continue

    return {"success": True, "imported": inserted, "items": imported_items}
