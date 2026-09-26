"""
Gemini Flash servisi — Sohbet, Görsel Analiz, PDF Vision ve Embedding
"""
import io
import os
import json
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
        "max_output_tokens": 4096,
    },
)

# Vision modeli (PDF + görsel analiz)
_vision_model = genai.GenerativeModel(
    model_name="gemini-1.5-flash",
    generation_config={
        "temperature": 0.1,
        "max_output_tokens": 8192,
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

PDF_PRICE_EXTRACTION_PROMPT = """Bu belge bir tedarikçi fiyat listesidir. Lütfen dikkatli incele.

Görevin: Belgedeki TÜM ürün/malzeme adlarını, birim fiyatlarını, birimlerini ve para birimlerini bul.

SADECE aşağıdaki JSON dizisi formatında yanıt ver, başka hiçbir şey yazma:
[
  {
    "product_name": "Ürün adı ve varsa ölçüsü/ebadı",
    "product_category": "ambalaj kategorisi (kağıt poşet / streç film / karton kutu / balonlu naylon / vb.)",
    "unit": "birim (adet / kg / rulo / metre / koli / vb.)",
    "base_price": 10.50,
    "currency": "TRY"
  }
]

Önemli kurallar:
- base_price mutlaka sayısal (ondalık nokta ile) olmalı, örn: 12.50
- currency yalnızca TRY, USD veya EUR olabilir (belirtilmemişse TRY kabul et)
- Fiyatı belli olmayan ürünleri ekleme
- Tablo satırlarını, liste maddelerini tek tek işle
- Türkçe karakterleri doğru yaz (ü, ş, ğ, ç, ı, ö)
- Yanıt olarak SADECE [ ile başlayan JSON array döndür"""


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


async def extract_prices_from_pdf_vision(pdf_bytes: bytes, filename: str = "fiyat.pdf") -> list[dict]:
    """
    PDF fiyat listesini Gemini Vision ile analiz et.
    Metin tabanlı, taranmış veya görüntü tabanlı PDF'lerin tümünü destekler.
    
    Strateji:
    1. PDF'yi doğrudan Gemini'ye inline olarak gönder (application/pdf)
    2. Başarısız olursa PyMuPDF ile sayfa görüntülerine çevir, sayfa sayfa gönder
    3. pdfplumber ile metin çıkar, metin olarak Gemini'ye gönder
    """

    items = []

    # ── Yöntem 1: PDF'yi doğrudan Gemini'ye gönder (en güçlü yöntem) ──
    try:
        pdf_b64 = base64.standard_b64encode(pdf_bytes).decode("utf-8")
        pdf_part = {
            "inline_data": {
                "mime_type": "application/pdf",
                "data": pdf_b64,
            }
        }
        response = _vision_model.generate_content([PDF_PRICE_EXTRACTION_PROMPT, pdf_part])
        raw = response.text.strip()
        items = _parse_json_response(raw)
        if items:
            return items
    except Exception as e:
        pass  # Sonraki yönteme geç

    # ── Yöntem 2: PyMuPDF ile sayfa görüntülerine çevir ──
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_images = []
        for page_num in range(min(len(doc), 10)):  # İlk 10 sayfa
            page = doc.load_page(page_num)
            mat = fitz.Matrix(2, 2)  # 2x zoom for better quality
            pix = page.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes("jpeg")
            img_b64 = base64.standard_b64encode(img_bytes).decode("utf-8")
            page_images.append(img_b64)
        doc.close()

        if page_images:
            # Tüm sayfaları tek istekte gönder (max 10 sayfa)
            parts = [PDF_PRICE_EXTRACTION_PROMPT]
            for img_b64 in page_images:
                parts.append({
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": img_b64,
                    }
                })
            response = _vision_model.generate_content(parts)
            raw = response.text.strip()
            items = _parse_json_response(raw)
            if items:
                return items
    except ImportError:
        pass  # fitz kurulu değil, devam et
    except Exception:
        pass

    # ── Yöntem 3: pdfplumber ile metin çıkar, Gemini'ye metin olarak gönder ──
    try:
        import pdfplumber
        extracted_text = ""
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    extracted_text += t + "\n"

        if len(extracted_text.strip()) > 30:
            prompt = f"""{PDF_PRICE_EXTRACTION_PROMPT}

Belge metni:
{extracted_text[:6000]}"""
            response = _vision_model.generate_content([prompt])
            raw = response.text.strip()
            items = _parse_json_response(raw)
            if items:
                return items
    except Exception:
        pass

    return items


def _parse_json_response(raw: str) -> list[dict]:
    """Gemini yanıtından JSON array çıkart."""
    if not raw:
        return []
    try:
        # Markdown kod bloklarını temizle
        if "```" in raw:
            parts = raw.split("```")
            for part in parts:
                stripped = part.strip()
                if stripped.startswith("json"):
                    stripped = stripped[4:].strip()
                if stripped.startswith("["):
                    raw = stripped
                    break

        # JSON array'i bul
        if "[" in raw and "]" in raw:
            start = raw.index("[")
            end = raw.rindex("]") + 1
            json_str = raw[start:end]
            parsed = json.loads(json_str)
            if isinstance(parsed, list) and len(parsed) > 0:
                # Geçerli kayıtları filtrele
                valid = []
                for item in parsed:
                    if isinstance(item, dict) and "base_price" in item:
                        try:
                            price = float(str(item["base_price"]).replace(",", "."))
                            if price > 0:
                                item["base_price"] = price
                                valid.append(item)
                        except Exception:
                            continue
                return valid
    except Exception:
        pass
    return []


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
