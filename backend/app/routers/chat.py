"""
Sohbet Router — Çırağın ana konuşma motoru
"""
import json
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.gemini import chat_with_gemini
from app.services.rag import (
    find_similar_calculations,
    calculate_confidence,
    save_calculation,
    approve_calculation,
    get_category_templates,
)
from app.database import get_supabase

router = APIRouter()


class Message(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    user_id: str
    message: str
    image_base64: Optional[str] = None
    messages: list[Message] = []


class FeedbackRequest(BaseModel):
    calculation_id: str
    is_correct: bool
    corrected_cost: Optional[float] = None
    correction_notes: Optional[str] = None
    user_id: str


class LearnRequest(BaseModel):
    """Kullanıcı manuel hesaplama yaparken sisteme öğretiyor."""
    session_id: Optional[str] = None
    user_id: str
    product_description: str
    product_category: str
    input_parameters: dict
    reasoning_steps: list[dict]  # [{"name": "...", "description": "...", "formula": "...", "result": ...}]
    final_cost: float
    unit: str
    supplier_id: Optional[str] = None


@router.post("/message")
async def send_message(req: ChatRequest):
    """
    Ana sohbet endpoint'i.
    1. Benzer geçmiş hesaplamalar aranır (RAG)
    2. Güven skoru hesaplanır
    3. Gemini ile yanıt üretilir
    """
    supabase = None
    try:
        supabase = get_supabase()
    except Exception:
        pass

    # 1. Benzer hesaplamaları ara
    similar = []
    confidence = 0
    try:
        similar = await find_similar_calculations(req.message, threshold=0.65, limit=3)
        confidence = await calculate_confidence(similar)
    except Exception:
        pass

    # 2. Bağlam mesajı hazırla
    context = ""
    if similar:
        context = "\n\n## Geçmiş Benzer Hesaplamalar (Hafızan):\n"
        for i, item in enumerate(similar, 1):
            sim_pct = int(item.get("similarity", 0) * 100)
            context += f"""
{i}. **{item['product_description']}**
   - Maliyet: {item['final_cost']} TL/{item.get('unit','adet')}
   - Benzerlik: %{sim_pct}
   - Adımlar: {json.dumps(item.get('reasoning_steps', []), ensure_ascii=False)[:200]}
"""
        context += f"\nBu bilgilere dayanarak güven skorun: %{confidence}\n"
    else:
        context = f"\n\nBu konuda geçmiş hesaplamanı bulamadım. Güven skorun: %{confidence}\n"

    # 3. Bilinmiyor uyarısı
    if confidence < 30:
        context += "\n⚠️ Bu ürün türünü daha önce hiç hesaplamadın. Kullanıcıdan öğrenmeni ve 'Öğren' modunu önermeni istiyorum."

    # 4. Tedarikçi Fiyat Listesi Bağlamı (TCMB Canlı Döviz Kuru ile TL Çevrimi)
    from app.routers.prices import IN_MEMORY_PRICES
    from app.services.scheduler import convert_to_try

    prices_list = []
    if supabase:
        try:
            db_prices = supabase.table("supplier_price_lists").select("*").order("created_at", desc=True).limit(60).execute()
            if db_prices.data:
                prices_list = db_prices.data
        except Exception:
            pass
    if not prices_list:
        prices_list = IN_MEMORY_PRICES

    price_context = ""
    if prices_list:
        price_context = "\n\n## Tedarikçi Fiyat Listesindeki Kayıtlı Ürünler (TÜM FİYATLAR TCMB CANLI KURU İLE TL/TRY CİNSİNE ÇEVRİLMİŞTİR):\n"
        for p in prices_list[:50]:
            raw_price = float(p.get("base_price", 0))
            curr = p.get("currency", "TRY")
            try:
                try_price = await convert_to_try(raw_price, curr)
            except Exception:
                try_price = raw_price * 34.25
            price_context += f"- Ürün: {p.get('product_name')} | TL Birim Fiyatı: {try_price:.2f} TL (Orijinal: {raw_price} {curr}) | Birim: {p.get('unit', 'adet')}\n"

    # 5. Mesaj geçmişi ve bağlam
    messages_for_gemini = [m.model_dump() for m in req.messages]
    full_message = req.message + context + price_context

    # 6. Gemini'ye gönder
    response_text = await chat_with_gemini(
        messages=messages_for_gemini,
        user_message=full_message,
        image_base64=req.image_base64,
    )

    # 7. Sohbet oturumunu güncelle
    if supabase:
        try:
            if req.session_id:
                _update_session(supabase, req.session_id, req.message, response_text)
            else:
                req.session_id = _create_session(supabase, req.user_id, req.message, response_text)
        except Exception:
            pass

    return {
        "session_id": req.session_id,
        "message": response_text,
        "confidence": confidence,
        "similar_count": len(similar),
        "similar_items": [
            {
                "id": s["id"],
                "description": s["product_description"],
                "cost": s["final_cost"],
                "unit": s.get("unit", "adet"),
                "similarity": round(s.get("similarity", 0) * 100),
            }
            for s in similar
        ],
    }


@router.post("/feedback")
async def submit_feedback(req: FeedbackRequest):
    """
    Kullanıcı hesaplamayı onaylar veya düzeltir.
    Bu bilgi sisteme öğretilir.
    """
    supabase = get_supabase()

    result = await approve_calculation(
        calculation_id=req.calculation_id,
        corrected_cost=req.corrected_cost if not req.is_correct else None,
    )

    if req.correction_notes or not req.is_correct:
        supabase.table("feedback_logs").insert({
            "calculation_id": req.calculation_id,
            "user_id": req.user_id,
            "original_cost": result.get("final_cost"),
            "corrected_cost": req.corrected_cost,
            "notes": req.correction_notes,
        }).execute()

    return {
        "success": True,
        "message": "Teşekkürler! Öğrendim. ✅" if req.is_correct else f"Anladım, düzelttim: {req.corrected_cost} TL. Bir dahaki sefere daha iyi bileceğim! 📝",
    }


@router.post("/learn")
async def learn_from_user(req: LearnRequest):
    """
    Kullanıcı manuel hesaplama yaparken sistem izler ve öğrenir.
    """
    calc = await save_calculation(
        product_description=req.product_description,
        product_category=req.product_category,
        input_parameters=req.input_parameters,
        reasoning_steps=req.reasoning_steps,
        final_cost=req.final_cost,
        unit=req.unit,
        supplier_id=req.supplier_id,
        user_id=req.user_id,
        confidence=100,  # Kullanıcıdan öğrenildi = %100 güvenilir
        is_approved=True,
    )

    return {
        "success": True,
        "calculation_id": calc.get("id"),
        "message": f"Öğrendim! '{req.product_category}' kategorisinde bu hesaplamayı aklımda tutacağım. 🎓",
    }


@router.get("/sessions/{user_id}")
async def get_sessions(user_id: str):
    """Kullanıcının geçmiş sohbet oturumlarını listele."""
    supabase = get_supabase()
    result = (
        supabase.table("chat_sessions")
        .select("id, title, created_at, updated_at")
        .eq("user_id", user_id)
        .eq("is_archived", False)
        .order("updated_at", desc=True)
        .limit(50)
        .execute()
    )
    return result.data or []


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str):
    """Bir oturumun mesajlarını getir."""
    supabase = get_supabase()
    result = (
        supabase.table("chat_sessions")
        .select("messages, calculations_made")
        .eq("id", session_id)
        .single()
        .execute()
    )
    return result.data or {}


# ── Yardımcı fonksiyonlar ──────────────────────────────────

def _create_session(supabase, user_id: str, first_message: str, response: str) -> str:
    title = first_message[:50] + ("..." if len(first_message) > 50 else "")
    result = supabase.table("chat_sessions").insert({
        "user_id": user_id,
        "title": title,
        "messages": [
            {"role": "user", "content": first_message},
            {"role": "assistant", "content": response},
        ],
    }).execute()
    return result.data[0]["id"] if result.data else ""


def _update_session(supabase, session_id: str, user_message: str, response: str):
    current = supabase.table("chat_sessions").select("messages").eq("id", session_id).single().execute()
    messages = current.data.get("messages", []) if current.data else []
    messages.append({"role": "user", "content": user_message})
    messages.append({"role": "assistant", "content": response})
    supabase.table("chat_sessions").update({"messages": messages}).eq("id", session_id).execute()
