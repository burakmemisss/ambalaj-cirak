"""Tedarikçi yönetimi router — DB + Önbellek Fallback Entegrasyonu"""
import uuid
from typing import Optional, List
from fastapi import APIRouter
from pydantic import BaseModel
from app.database import get_supabase

router = APIRouter()

# Varsayılan tedarikçi listesi (DB erişimi olmasa da uygulama akıcı çalışır)
IN_MEMORY_SUPPLIERS = [
    {
        "id": "1",
        "name": "Biz (Kendi Üretimimiz)",
        "type": "self",
        "currency": "TRY",
        "contact": "Üretim Atölyesi",
        "notes": "Kağıt poşet, koli ve karton kutu üretimi",
        "is_active": True
    },
    {
        "id": "2",
        "name": "Marmara Plastik Ltd.",
        "type": "external",
        "currency": "USD",
        "contact": "ahmet@marmaraplastik.com",
        "notes": "Streç film, balonlu naylon tedarikçisi",
        "is_active": True
    },
    {
        "id": "3",
        "name": "Ege Ambalaj A.Ş.",
        "type": "external",
        "currency": "EUR",
        "contact": "mehmet@egeambalaj.com",
        "notes": "PET ambalaj ve şerit tedarikçisi",
        "is_active": True
    },
]


class SupplierCreate(BaseModel):
    name: str
    type: str = "external"  # 'self' | 'external'
    currency: str = "TRY"
    contact: Optional[str] = None
    notes: Optional[str] = None


@router.get("/")
async def list_suppliers():
    """Aktif tedarikçileri listele."""
    try:
        supabase = get_supabase()
        result = supabase.table("suppliers").select("*").eq("is_active", True).order("name").execute()
        if result.data and len(result.data) > 0:
            return result.data
    except Exception:
        pass
    
    return [s for s in IN_MEMORY_SUPPLIERS if s.get("is_active", True)]


@router.post("/")
async def create_supplier(supplier: SupplierCreate):
    """Yeni tedarikçi ekle."""
    new_supplier = {
        "id": str(uuid.uuid4()),
        "name": supplier.name,
        "type": supplier.type,
        "currency": supplier.currency.upper(),
        "contact": supplier.contact,
        "notes": supplier.notes,
        "is_active": True
    }

    try:
        supabase = get_supabase()
        result = supabase.table("suppliers").insert(supplier.model_dump()).execute()
        if result.data:
            return result.data[0]
    except Exception:
        pass

    IN_MEMORY_SUPPLIERS.append(new_supplier)
    return new_supplier


@router.delete("/{supplier_id}")
async def delete_supplier(supplier_id: str):
    """Tedarikçiyi sil / pasife al."""
    try:
        supabase = get_supabase()
        supabase.table("suppliers").update({"is_active": False}).eq("id", supplier_id).execute()
    except Exception:
        pass

    for s in IN_MEMORY_SUPPLIERS:
        if s["id"] == supplier_id:
            s["is_active"] = False
            break

    return {"success": True, "message": "Tedarikçi silindi"}
