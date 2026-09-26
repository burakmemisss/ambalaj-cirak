"""Fiyat listesi router — Excel/PDF import dahil"""
import io
import base64
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from app.database import get_supabase
from app.services.scheduler import convert_to_try

router = APIRouter()


class PriceEntry(BaseModel):
    supplier_id: str
    product_category: str
    product_name: Optional[str] = None
    unit: str
    base_price: float
    currency: str = "TRY"
    valid_date: Optional[str] = None
    notes: Optional[str] = None


@router.get("/supplier/{supplier_id}")
async def get_supplier_prices(supplier_id: str, convert_to_try_flag: bool = True):
    """Tedarikçinin fiyat listesini getir (isteğe bağlı TRY'ye çevir)."""
    supabase = get_supabase()
    result = (
        supabase.from_("latest_supplier_prices")
        .select("*")
        .eq("supplier_id", supplier_id)
        .execute()
    )
    prices = result.data or []

    if convert_to_try_flag:
        for price in prices:
            if price["currency"] != "TRY":
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
    supabase = get_supabase()
    result = supabase.table("supplier_price_lists").insert(entry.model_dump()).execute()
    return result.data[0] if result.data else {}


@router.post("/import/excel/{supplier_id}")
async def import_excel(supplier_id: str, file: UploadFile = File(...)):
    """Excel fiyat listesi import et."""
    try:
        import pandas as pd
    except ImportError:
        raise HTTPException(status_code=500, detail="pandas kurulu değil")

    contents = await file.read()
    df = pd.read_excel(io.BytesIO(contents))

    # Kolon eşleştirme (esnek)
    col_map = {
        "ürün": "product_name", "urun": "product_name", "product": "product_name",
        "kategori": "product_category", "category": "product_category",
        "birim": "unit", "unit": "unit",
        "fiyat": "base_price", "price": "base_price", "tutar": "base_price",
        "para birimi": "currency", "currency": "currency", "doviz": "currency",
    }

    df.columns = [col_map.get(c.lower().strip(), c.lower().strip()) for c in df.columns]

    inserted = 0
    supabase = get_supabase()

    for _, row in df.iterrows():
        try:
            entry = {
                "supplier_id": supplier_id,
                "product_name": str(row.get("product_name", "")),
                "product_category": str(row.get("product_category", row.get("product_name", "genel"))),
                "unit": str(row.get("unit", "adet")),
                "base_price": float(row.get("base_price", 0)),
                "currency": str(row.get("currency", "TRY")).upper(),
                "source_type": "excel",
                "source_file": file.filename,
            }
            if entry["base_price"] > 0:
                supabase.table("supplier_price_lists").insert(entry).execute()
                inserted += 1
        except Exception:
            continue

    return {"success": True, "imported": inserted, "total_rows": len(df)}


@router.post("/import/pdf/{supplier_id}")
async def import_pdf(supplier_id: str, file: UploadFile = File(...)):
    """PDF fiyat listesi import et (AI destekli ayrıştırma)."""
    try:
        import pdfplumber
    except ImportError:
        raise HTTPException(status_code=500, detail="pdfplumber kurulu değil")

    contents = await file.read()
    extracted_text = ""

    with pdfplumber.open(io.BytesIO(contents)) as pdf:
        for page in pdf.pages:
            extracted_text += page.extract_text() or ""

    # Gemini ile ayrıştır
    from app.services.gemini import chat_with_gemini
    prompt = f"""Aşağıdaki PDF metni bir tedarikçi fiyat listesidir.
Şu JSON formatında ayrıştır:
[
  {{"product_name": "...", "product_category": "...", "unit": "...", "base_price": 0.0, "currency": "TRY"}}
]
Sadece JSON döndür.

Metin:
{extracted_text[:3000]}"""

    response = await chat_with_gemini([], prompt)

    import json
    try:
        if "```" in response:
            response = response.split("```")[1].replace("json", "").strip()
        items = json.loads(response)
    except Exception:
        return {"success": False, "error": "PDF ayrıştırılamadı", "raw_text": extracted_text[:500]}

    supabase = get_supabase()
    inserted = 0
    for item in items:
        try:
            item["supplier_id"] = supplier_id
            item["source_type"] = "pdf"
            item["source_file"] = file.filename
            supabase.table("supplier_price_lists").insert(item).execute()
            inserted += 1
        except Exception:
            continue

    return {"success": True, "imported": inserted}
