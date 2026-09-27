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

# Sohbet modeli (güncel Gemini Flash)
_chat_model = genai.GenerativeModel(
    model_name="gemini-flash-latest",
    generation_config={
        "temperature": 0.3,
        "top_p": 0.95,
        "max_output_tokens": 4096,
    },
)

# Vision modeli (PDF + görsel analiz)
_vision_model = genai.GenerativeModel(
    model_name="gemini-flash-latest",
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
Satın alma ve satış süreçlerinde maliyet hesaplama ve fiyat teklifi sunma konusunda yardım edersin.

## KATI HESAPLAMA VE FİYATLANDIRMA KURALLARI (ÇOK ÖNEMLİ!)
1. PARAMETRE KONTROLÜ: Ambalaj sektöründe her detay (hacim, baskı renk sayısı, gramaj, sıcak/soğuk kullanımı, sipariş miktarı) FİYATI DOĞRUDAN DEĞİŞTİRİR.
2. EKSİK PARAMETRE VARSA: Kullanıcı ürün sorduğunda eğer detaylar eksikse (örn. sadece "Karton bardak ne kadar?" dediyse) ASLA TAHMİNİ FİYAT VERME, ASLA HESAPLAMA YAPMA!
   - Önce eksik parametreleri kibarca sor: "Fiyat verebilmem için lütfen detayları belirtin: Hacim (4oz, 7oz, 8oz, 12oz vb.), Baskı renk sayısı (1-2 renk veya 3-5 renk), Gramaj ve Kullanım Amacı (Sıcak/Soğuk)."
3. TÜM PARAMETRELER TAMAMSA: Tedarikçi fiyat listesinden veya hesaplamadan elde edilen fiyatı sun.

## ÖNEMLİ YANIT FORMATI VE DÖVİZ KURALI
- ÇOK KISA, ÖZ VE NET YANITLAR VER. Gereksiz uzun cümleler kurma. Token maliyetini en aza indirmek için sadece istenen fiyatı ve 1-2 cümlelik açıklamayı yaz.
- ASLA JSON FORMATINDA YANIT VERME! Yanıtların her zaman anlaşılır, okunaklı, profesyonel NORMAL METİN (Türkçe) formatında olmalıdır. JSON kod bloğu veya ham JSON objesi döndürmek KESİNLİKLE YASAKTIR.
- TÜM FİYATLAR MUTLAKA TÜRK LİRASI (TL / TRY) CİNSİNDEN SUNULMALIDIR! Dolar ($) veya Euro (€) cinsinden fiyat sunma, TL karşılığını belirt (örn: "Birim Fiyatı: 0,32 TL", "1.000 Adet Toplam: 320,00 TL").

## Güven Skoru Kullanımı
- %85+: Tüm parametreler tam ve tedarikçi listesinde birebir eşleşme var.
- %60-84: Detaylar tam ancak en yakın ürün bulundu, onay istersin.
- %0-59: Detaylar eksik veya ürün bilinmiyor. Eksik detayları sorarsın.

## Tonun
- Samimi, titiz ve kısa konuşan bir ambalaj kalfası gibi.
- İşletme kârlılığını düşünen, lafı uzatmadan hızlıca fiyat veren güvenilir asistan.
"""

PDF_PRICE_EXTRACTION_PROMPT = """Bu belge bir tedarikçi fiyat listesidir. ÇOK DİKKATLİ ve EKSİKSİZ incele.

## GÖREVİN
Belgedeki TÜM ürün/malzeme satırlarını, birim fiyatlarını, birimlerini ve para birimlerini bul.
HİÇBİR SATIRI, HİÇBİR ÖLÇÜYÜ, HİÇBİR VARYASYONU ATLAMA!

## KRİTİK KURALLAR — EKSİKSİZ ÇIKARMA
1. TABLO YAPISI: Eğer bir tablo varsa, her satırı ayrı ayrı işle. Sütun başlıklarını her satıra uygula.
2. ÖLÇÜ VARYASYONLARI: Farklı ölçüler (4oz, 7oz, 8oz, 9oz, 12oz, 14oz, 16oz vb.) HER BİRİ AYRI BİR KAYIT olmalıdır.
3. RENK VARYASYONLARI: Farklı baskı renk sayıları (1-2 renk, 3-5 renk vb.) farklı fiyata sahipse HER BİRİ AYRI KAYIT olmalıdır.
4. SICAK/SOĞUK VARYASYONLARI: Sıcak içecek ve soğuk içecek bardakları farklı fiyata sahipse AYRI KAYIT olmalıdır.
5. GRAMAJ VARYASYONLARI: Farklı gramajlar (190gr, 250gr, 350gr vb.) varsa HER BİRİ AYRI KAYIT.
6. product_name alanına ölçü, gramaj, tür, varyasyon bilgilerini MUTLAKA dahil et.
   Örnek: "Karton Bardak 8oz Sıcak 1-2 Renk Baskı", "Karton Bardak 12oz Soğuk 3-5 Renk Baskı"

## JSON FORMATI
SADECE aşağıdaki JSON dizisi formatında yanıt ver, başka hiçbir şey yazma:
[
  {
    "product_name": "Ürün adı + ölçü + tür + varyasyon detayı",
    "product_category": "ambalaj kategorisi (karton bardak / kağıt poşet / streç film / karton kutu / vb.)",
    "unit": "birim (adet / kg / rulo / metre / koli / vb.)",
    "base_price": 10.50,
    "currency": "USD"
  }
]

## DOĞRULAMA KURALLARI
- base_price mutlaka sayısal (ondalık nokta ile) olmalı, örn: 0.025
- currency yalnızca TRY, USD veya EUR olabilir (belirtilmemişse TRY kabul et)
- Fiyatı belli olmayan ürünleri ekleme
- Tablo satırlarını, liste maddelerini TEK TEK işle — toplu atlama YASAK
- Türkçe karakterleri doğru yaz (ü, ş, ğ, ç, ı, ö)
- Yanıt olarak SADECE [ ile başlayan JSON array döndür
- Belgede kaç farklı ürün/ölçü/varyasyon varsa TAMAMINI çıkar, hiçbirini atlama!"""


async def chat_with_gemini(
    messages: list[dict],
    user_message: str,
    image_base64: Optional[str] = None,
) -> str:
    """Gemini Flash ile sohbet et (Model yedeklemeli ve 429 korumalı)."""
    history = []
    for msg in messages[:-1]:  # Son mesajı hariç tut
        role = "user" if msg["role"] == "user" else "model"
        history.append({"role": role, "parts": [msg["content"]]})

    parts = [SYSTEM_PROMPT + "\n\n" + user_message]
    if image_base64:
        image_data = {
            "mime_type": "image/jpeg",
            "data": image_base64,
        }
        parts = [SYSTEM_PROMPT + "\n\n" + user_message, image_data]

    candidate_models = ["gemini-flash-latest", "gemini-3.5-flash", "gemini-flash-lite-latest", "gemini-3.8-flash"]

    last_error = None
    for model_name in candidate_models:
        try:
            model = genai.GenerativeModel(
                model_name=model_name,
                generation_config={
                    "temperature": 0.3,
                    "top_p": 0.95,
                    "max_output_tokens": 1024,
                },
            )
            chat = model.start_chat(history=history)
            response = chat.send_message(parts)
            return response.text
        except Exception as e:
            last_error = e
            print(f"[Chat Gemini] {model_name} denemesi başarısız: {e}")
            continue

    raise Exception(f"Tüm Gemini modelleri yanıt veremedi: {last_error}")


async def extract_prices_from_pdf_vision(pdf_bytes: bytes, filename: str = "fiyat.pdf") -> list[dict]:
    """
    PDF fiyat listesini Gemini Vision ile analiz et.
    Metin tabanlı, taranmış veya görüntü tabanlı PDF'lerin tümünü destekler.
    
    Strateji:
    1. PDF'yi doğrudan Gemini'ye inline olarak gönder (yüksek token limiti)
    2. Başarısız olursa PyMuPDF ile SAYFA SAYFA görüntüye çevir, her sayfayı ayrı analiz et
    3. pdfplumber ile metin çıkar, sayfa sayfa Gemini'ye gönder
    4. Tüm sonuçları birleştir ve duplicate'ları filtrele
    """

    all_items = []
    candidate_models = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-3.8-flash"]

    # ── Yöntem 1: PDF'yi doğrudan Gemini'ye gönder (en güçlü yöntem) ──
    for model_name in candidate_models:
        try:
            model = genai.GenerativeModel(
                model_name=model_name,
                generation_config={
                    "temperature": 0.1,
                    "max_output_tokens": 8192,
                },
            )
            pdf_b64 = base64.standard_b64encode(pdf_bytes).decode("utf-8")
            pdf_part = {
                "inline_data": {
                    "mime_type": "application/pdf",
                    "data": pdf_b64,
                }
            }
            response = model.generate_content([PDF_PRICE_EXTRACTION_PROMPT, pdf_part])
            raw = response.text.strip()
            items = _parse_json_response(raw)
            if items:
                print(f"[PDF Vision] {model_name} ile Yöntem 1 başarılı: {len(items)} ürün çıkarıldı.")
                all_items.extend(items)
                break
        except Exception as e:
            print(f"[PDF Vision] Yöntem 1 ({model_name}) hatası: {e}")
            continue

    # ── Yöntem 2: PyMuPDF ile SAYFA SAYFA görüntüye çevir, her sayfayı ayrı analiz et ──
    if not all_items:
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            total_pages = len(doc)
            print(f"[PDF Vision] PyMuPDF ile {total_pages} sayfa bulundu, sayfa sayfa analiz ediliyor...")

            for page_num in range(min(total_pages, 20)):  # İlk 20 sayfa
                try:
                    page = doc.load_page(page_num)
                    mat = fitz.Matrix(2.5, 2.5)  # 2.5x zoom for better quality
                    pix = page.get_pixmap(matrix=mat)
                    img_bytes_data = pix.tobytes("jpeg")
                    img_b64 = base64.standard_b64encode(img_bytes_data).decode("utf-8")

                    page_prompt = f"""Sayfa {page_num + 1}/{total_pages}.

{PDF_PRICE_EXTRACTION_PROMPT}"""

                    for model_name in candidate_models[:2]:
                        try:
                            model = genai.GenerativeModel(
                                model_name=model_name,
                                generation_config={
                                    "temperature": 0.1,
                                    "max_output_tokens": 8192,
                                },
                            )
                            response = model.generate_content([
                                page_prompt,
                                {
                                    "inline_data": {
                                        "mime_type": "image/jpeg",
                                        "data": img_b64,
                                    }
                                }
                            ])
                            raw = response.text.strip()
                            page_items = _parse_json_response(raw)
                            if page_items:
                                print(f"[PDF Vision] Sayfa {page_num + 1}: {len(page_items)} ürün çıkarıldı ({model_name})")
                                all_items.extend(page_items)
                                break
                        except Exception as e:
                            print(f"[PDF Vision] Sayfa {page_num + 1} ({model_name}) hatası: {e}")
                            continue
                except Exception as e:
                    print(f"[PDF Vision] Sayfa {page_num + 1} atlandı: {e}")
                    continue

            doc.close()
        except ImportError:
            print("[PDF Vision] PyMuPDF (fitz) kurulu değil, Yöntem 2 atlanıyor.")
        except Exception as e:
            print(f"[PDF Vision] Yöntem 2 genel hatası: {e}")

    # ── Yöntem 3: pdfplumber ile metin çıkar, sayfa sayfa Gemini'ye gönder ──
    if not all_items:
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                for page_idx, page in enumerate(pdf.pages):
                    t = page.extract_text()
                    if not t or len(t.strip()) < 20:
                        continue

                    page_prompt = f"""{PDF_PRICE_EXTRACTION_PROMPT}

Sayfa {page_idx + 1} metni:
{t[:4000]}"""

                    try:
                        model = genai.GenerativeModel(
                            model_name=candidate_models[0],
                            generation_config={
                                "temperature": 0.1,
                                "max_output_tokens": 8192,
                            },
                        )
                        response = model.generate_content([page_prompt])
                        raw = response.text.strip()
                        page_items = _parse_json_response(raw)
                        if page_items:
                            print(f"[PDF Vision] pdfplumber Sayfa {page_idx + 1}: {len(page_items)} ürün")
                            all_items.extend(page_items)
                    except Exception as e:
                        print(f"[PDF Vision] pdfplumber Sayfa {page_idx + 1} hatası: {e}")
                        continue
        except Exception as e:
            print(f"[PDF Vision] Yöntem 3 genel hatası: {e}")

    # ── Duplicate filtreleme ──
    unique_items = _deduplicate_items(all_items)
    print(f"[PDF Vision] Toplam: {len(all_items)} -> Deduplicate: {len(unique_items)} ürün")

    return unique_items


def _deduplicate_items(items: list[dict]) -> list[dict]:
    """Aynı ürün adı + fiyat kombinasyonunu filtrele."""
    seen = set()
    unique = []
    for item in items:
        key = (
            str(item.get("product_name", "")).strip().lower(),
            float(item.get("base_price", 0)),
        )
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique


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
    model = genai.GenerativeModel("gemini-flash-latest")

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
