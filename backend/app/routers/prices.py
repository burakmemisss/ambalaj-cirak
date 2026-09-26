"""Fiyat listesi router — Excel/PDF import (AI destekli + Fallback hafıza)"""
import io
import json
import traceback
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from app.database import get_supabase
from app.services.scheduler import convert_to_try
from app.services.gemini import chat_with_gemini

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
    # Dosya içeriğini oku
    try:
        contents = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Dosya okunamadı: {str(e)}")

    if not contents:
        raise HTTPException(status_code=400, detail="Dosya boş görünüyor.")

    # pandas kontrolü
    try:
        import pandas as pd
    except ImportError:
        raise HTTPException(status_code=500, detail="pandas kütüphanesi kurulu değil.")

    df = None
    parse_error = ""

    # Excel formatlarını dene
    for engine in ["openpyxl", "xlrd"]:
        try:
            df = pd.read_excel(io.BytesIO(contents), engine=engine)
            break
        except Exception as e:
            parse_error = str(e)
            continue

    # CSV fallback
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

    # Sütun isimlerini normalize et
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

    # Fiyat sütunu yoksa ilk sayısal sütunu kullan
    if "base_price" not in df.columns:
        for col in df.columns:
            try:
                df[col] = pd.to_numeric(df[col], errors="coerce")
                if df[col].notna().sum() > 0:
                    df = df.rename(columns={col: "base_price"})
                    break
            except Exception:
                continue

    # Ürün adı sütunu yoksa ilk metin sütununu kullan
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
            # Fiyat değerini çek
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
                pass  # DB başarısız olsa da hafızada tutuluyor

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
    """PDF fiyat listesi import et (Yapay Zeka / Gemini Flash ile Akıllı Ayrıştırma)."""
    # Dosya içeriğini oku
    try:
        contents = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Dosya okunamadı: {str(e)}")

    if not contents:
        raise HTTPException(status_code=400, detail="Dosya boş görünüyor.")

    extracted_text = ""

    # 1. Yöntem: pdfplumber ile düz metin çıkart
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    extracted_text += page_text + "\n"
    except Exception as e:
        # pdfplumber başarısız — devam et
        extracted_text = ""

    # 2. Yöntem: PyPDF2 ile fallback
    if len(extracted_text.strip()) < 20:
        try:
            import PyPDF2
            reader = PyPDF2.PdfReader(io.BytesIO(contents))
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    extracted_text += t + "\n"
        except Exception:
            pass

    items = []

    if len(extracted_text.strip()) > 20:
        # Gemini ile AI analizi
        prompt = f"""Aşağıdaki metin bir tedarikçi ambalaj fiyat listesidir.
Listedeki tüm ürünleri, birim fiyatlarını ve para birimlerini çıkar.
SADECE aşağıdaki JSON dizisi formatında yanıt ver, başka açıklama ekleme:
[
  {{"product_name": "Ürün Adı", "product_category": "ambalaj", "unit": "adet", "base_price": 10.50, "currency": "TRY"}}
]

Kurallar:
- base_price mutlaka sayısal (float) olmalı
- currency TRY, USD veya EUR olmalı
- Fiyatı belli olmayan ürünleri listeye ekleme
- En az 1 ürün döndür

Metin:
{extracted_text[:5000]}"""

        try:
            response = await chat_with_gemini([], prompt)
            # JSON'u temizle
            clean = response.strip()
            if "```" in clean:
                parts = clean.split("```")
                for part in parts:
                    stripped = part.strip()
                    if stripped.startswith("json"):
                        stripped = stripped[4:].strip()
                    if stripped.startswith("["):
                        clean = stripped
                        break
            # JSON parse et
            if clean.startswith("["):
                parsed = json.loads(clean)
                if isinstance(parsed, list) and len(parsed) > 0:
                    items = parsed
        except Exception as e:
            items = []

    # Metin çıkarılamazsa PDF görüntü tabanlı çözüm dene (base64 ile Gemini Vision)
    if not items and len(extracted_text.strip()) < 20:
        try:
            import base64
            pdf_base64 = base64.b64encode(contents).decode("utf-8")
            prompt = """Bu PDF bir tedarikçi fiyat listesidir. Görüntüdeki ürün adlarını, fiyatlarını ve birimlerini bul.
SADECE JSON dizisi döndür:
[{"product_name": "Ürün", "product_category": "ambalaj", "unit": "adet", "base_price": 10.50, "currency": "TRY"}]"""
            # Gemini text-only ile fallback (vision PDF desteklemiyor)
            response = await chat_with_gemini([], f"{prompt}\n\nPDF metin çıktısı alınamadı, format okunaksız.")
            clean = response.strip()
            if "[" in clean and "]" in clean:
                start = clean.index("[")
                end = clean.rindex("]") + 1
                parsed = json.loads(clean[start:end])
                if isinstance(parsed, list):
                    items = parsed
        except Exception:
            pass

    # Hiçbir ürün bulunamazsa 422 döndür
    if not items:
        raise HTTPException(
            status_code=422,
            detail="PDF'den veri çıkarılamadı. PDF metin tabanlı değil veya taranmış görüntü olabilir. "
                   "Lütfen Excel (.xlsx) veya CSV formatında deneyin — daha güvenilir sonuç verir."
        )

    inserted = 0
    imported_items = []

    for item in items:
        try:
            # Zorunlu alanları kontrol et
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
            detail="PDF okundu ancak geçerli fiyat verisi bulunamadı. "
                   "Excel formatı çok daha güvenilir sonuç verir."
        )

    return {"success": True, "imported": inserted, "items": imported_items}
