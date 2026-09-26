"""
Gemini Flash servisi — Sohbet, Görsel Analiz ve Embedding
"""
import os
import base64
from typing import Optional
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Sohbet modeli
_chat_model = genai.GenerativeModel(
    model_name="gemini-1.5-flash",
    generation_config={
        "temperature": 0.3,
        "top_p": 0.95,
        "max_output_tokens": 2048,
    },
)

# Embedding modeli
_embed_model = "models/text-embedding-004"

# ── Sistem Promptu ──────────────────────────────────────────
SYSTEM_PROMPT = """Sen bir ambalaj firmasının yapay zeka destekli çırak asistanısın.
Adın "Çırak". Türkçe konuşursun.

## Görevin
Satın alma ve satış süreçlerinde maliyet hesaplama konusunda yardım edersin.

## Çalışma Prensibin
- Bir çırak gibi öğrenirsin: Ustanı (kullanıcıyı) izler, adımları not alır, benzer işlerde uygularsın.
- Her hesaplamada ne kadar emin olduğunu belirtirsin (güven skoru: %0-100).
- Bilmediğini açıkça söylersin: "Bu tür ürünü hiç hesaplamadım, bir kez göster bana."
- Asla uydurma fiyat vermezsin.

## Güven Skoru Kullanımı
- %85+: Eminsindir, direkt söylersin
- %60-84: Tahmin ettiğini belirtirsin, onay istersin
- %30-59: Çok benzer görmediğini söylersin, yaklaşık verirsin
- %0-29: Bilmediğini kabul eder, göstermesini istersin

## Hesaplama Kuralı
- Matematiksel hesaplamalar sana değil, backend sistemine aittir.
- Sen sadece ürün bilgilerini (ebat, kategori, malzeme vb.) çıkarır ve JSON formatında dönersin.
- Fiyat verirken mutlaka güven skorunu eklersin.

## Yanıt Formatı
Hesaplama gerektiren sorularda şu JSON formatını kullan:
{
  "type": "calculation_request",
  "product_description": "...",
  "product_category": "...",
  "parameters": {...},
  "confidence": 75,
  "message": "Kullanıcıya gösterilecek mesaj"
}

Normal sohbet için düz metin kullan.

## Tonun
- Samimi ve yardımsever
- Profesyonel ama sıkıcı değil
- Hataları kabul eder, öğrenmekten çekinmez
"""


async def chat_with_gemini(
    messages: list[dict],
    user_message: str,
    image_base64: Optional[str] = None,
) -> str:
    """Gemini Flash ile sohbet et."""
    history = []
    for msg in messages[:-1]:  # Son mesajı hariç tut
        role = "user" if msg["role"] == "user" else "model"
        history.append({"role": role, "parts": [msg["content"]]})

    chat = _chat_model.start_chat(history=history)

    parts = [SYSTEM_PROMPT + "\n\n" + user_message]

    if image_base64:
        image_data = {
            "mime_type": "image/jpeg",
            "data": image_base64,
        }
        parts = [SYSTEM_PROMPT + "\n\n" + user_message, image_data]

    response = chat.send_message(parts)
    return response.text


async def analyze_image(image_base64: str) -> dict:
    """Ürün görselini analiz et."""
    model = genai.GenerativeModel("gemini-1.5-flash")

    prompt = """Bu ambalaj ürününü analiz et ve aşağıdaki JSON formatında yanıt ver:
{
  "product_category": "ürün kategorisi (kağıt poşet, karton kutu, streç film, vb.)",
  "material": "malzeme türü",
  "estimated_dimensions": "tahmini boyutlar (varsa)",
  "color_print": "baskı var mı ve kaç renk",
  "special_features": ["özel özellikler"],
  "confidence": 0-100 arası güven skoru,
  "description": "ürünün kısa açıklaması"
}
Sadece JSON döndür, başka açıklama ekleme."""

    image_part = {
        "mime_type": "image/jpeg",
        "data": image_base64,
    }

    response = model.generate_content([prompt, image_part])
    text = response.text.strip()

    # JSON temizle
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    import json
    try:
        return json.loads(text)
    except Exception:
        return {
            "product_category": "bilinmiyor",
            "confidence": 0,
            "description": text,
        }


async def get_embedding(text: str) -> list[float]:
    """Metin için embedding vektörü üret."""
    result = genai.embed_content(
        model=_embed_model,
        content=text,
        task_type="retrieval_document",
    )
    return result["embedding"]


async def get_query_embedding(text: str) -> list[float]:
    """Arama sorgusu için embedding vektörü üret."""
    result = genai.embed_content(
        model=_embed_model,
        content=text,
        task_type="retrieval_query",
    )
    return result["embedding"]
