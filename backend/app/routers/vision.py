"""Görsel analiz router"""
import base64
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.gemini import analyze_image
from app.services.rag import find_similar_calculations, calculate_confidence

router = APIRouter()


@router.post("/analyze")
async def analyze_product_image(file: UploadFile = File(...)):
    """
    Ürün görselini analiz et, benzer geçmiş ürünleri bul.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Sadece görsel dosyaları kabul edilir.")

    contents = await file.read()
    image_b64 = base64.b64encode(contents).decode("utf-8")

    # Görsel analizi yap
    analysis = await analyze_image(image_b64)

    # Benzer geçmiş ürünleri ara
    search_query = f"{analysis.get('product_category', '')} {analysis.get('material', '')} {analysis.get('description', '')}"
    similar = await find_similar_calculations(search_query, threshold=0.65, limit=3)
    confidence = await calculate_confidence(similar)

    return {
        "analysis": analysis,
        "confidence": confidence,
        "similar_products": [
            {
                "id": s["id"],
                "description": s["product_description"],
                "cost": s["final_cost"],
                "unit": s.get("unit", "adet"),
                "similarity": round(s.get("similarity", 0) * 100),
            }
            for s in similar
        ],
        "image_base64": image_b64,  # Chat'e göndermek için
    }
