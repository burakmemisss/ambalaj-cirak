"""
RAG Servisi — Benzer ürün arama ve öğrenme mekanizması
"""
import json
from typing import Optional
from app.database import get_supabase
from app.services.gemini import get_embedding, get_query_embedding


async def find_similar_calculations(
    query: str,
    threshold: float = 0.70,
    limit: int = 5,
) -> list[dict]:
    """
    Kullanıcı sorgusuna benzer geçmiş hesaplamaları bul.
    Returns: Benzer hesaplamalar listesi (similarity skoru ile)
    """
    supabase = get_supabase()

    # Sorgu için embedding üret
    embedding = await get_query_embedding(query)

    # pgvector ile benzer ara
    result = supabase.rpc(
        "search_similar_calculations",
        {
            "query_embedding": embedding,
            "match_threshold": threshold,
            "match_count": limit,
        },
    ).execute()

    return result.data or []


async def calculate_confidence(similar_items: list[dict]) -> int:
    """
    Benzer örneklere göre güven skoru hesapla.
    """
    if not similar_items:
        return 0

    top_similarity = similar_items[0].get("similarity", 0)

    if top_similarity >= 0.92:
        return 90
    elif top_similarity >= 0.82:
        return 75
    elif top_similarity >= 0.70:
        return 55
    else:
        return 25


async def save_calculation(
    product_description: str,
    product_category: str,
    input_parameters: dict,
    reasoning_steps: list[dict],
    final_cost: float,
    unit: str,
    supplier_id: Optional[str],
    user_id: str,
    confidence: int = 100,
    is_approved: bool = False,
) -> dict:
    """
    Yeni hesaplamayı öğrenilmiş hesaplamalar tablosuna kaydet.
    """
    supabase = get_supabase()

    # Embedding oluştur
    embed_text = f"{product_description} {product_category} {json.dumps(input_parameters, ensure_ascii=False)}"
    embedding = await get_embedding(embed_text)

    data = {
        "product_description": product_description,
        "product_category": product_category,
        "input_parameters": input_parameters,
        "reasoning_steps": reasoning_steps,
        "final_cost": final_cost,
        "unit": unit,
        "supplier_id": supplier_id,
        "confidence_when_learned": confidence,
        "is_approved": is_approved,
        "created_by": user_id,
        "embedding": embedding,
    }

    result = supabase.table("learned_calculations").insert(data).execute()
    return result.data[0] if result.data else {}


async def approve_calculation(calculation_id: str, corrected_cost: Optional[float] = None) -> dict:
    """
    Kullanıcı hesaplamayı onayladığında veya düzelttiğinde güncelle.
    """
    supabase = get_supabase()

    update_data: dict = {"is_approved": True}
    if corrected_cost is not None:
        update_data["final_cost"] = corrected_cost
        update_data["user_corrected"] = True

    result = (
        supabase.table("learned_calculations")
        .update(update_data)
        .eq("id", calculation_id)
        .execute()
    )
    return result.data[0] if result.data else {}


async def save_reasoning_template(
    product_category: str,
    steps: list[dict],
    learned_from_calc_id: str,
) -> None:
    """
    Öğrenilen hesaplama adımlarını şablon olarak kaydet.
    """
    supabase = get_supabase()

    records = []
    for i, step in enumerate(steps):
        records.append({
            "product_category": product_category,
            "step_order": i + 1,
            "step_name": step.get("name", f"Adım {i+1}"),
            "step_description": step.get("description", ""),
            "formula": step.get("formula", ""),
            "variables": step.get("variables", {}),
            "example_value": step.get("example_value", ""),
            "learned_from_calc_id": learned_from_calc_id,
        })

    if records:
        supabase.table("reasoning_templates").insert(records).execute()


async def get_category_templates(product_category: str) -> list[dict]:
    """
    Bir kategori için öğrenilmiş hesaplama adımlarını getir.
    """
    supabase = get_supabase()

    result = (
        supabase.table("reasoning_templates")
        .select("*")
        .eq("product_category", product_category)
        .order("step_order")
        .execute()
    )
    return result.data or []


async def get_all_categories() -> list[str]:
    """Sistemin bildiği tüm kategorileri listele."""
    supabase = get_supabase()
    result = (
        supabase.table("learned_calculations")
        .select("product_category")
        .eq("is_approved", True)
        .execute()
    )
    categories = list({r["product_category"] for r in (result.data or []) if r["product_category"]})
    return sorted(categories)
