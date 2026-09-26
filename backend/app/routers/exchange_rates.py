"""Döviz kuru router — TCMB Entegrasyonlu"""
from fastapi import APIRouter
from app.services.scheduler import get_cached_rates, fetch_tcmb_rates, convert_to_try

router = APIRouter()


@router.get("/")
async def get_rates():
    """TCMB kaynaklı mevcut kurları getir."""
    return await get_cached_rates()


@router.post("/refresh")
async def refresh_rates():
    """TCMB kurlarını anlık olarak manuel yenile."""
    rates = await fetch_tcmb_rates()
    return {"success": True, "source": "TCMB", "rates": rates}


@router.get("/convert")
async def convert(amount: float, from_currency: str, to_currency: str = "TRY"):
    """TCMB kuru ile para birimi çevirme."""
    if to_currency != "TRY":
        return {"error": "Şu an sadece TRY'ye çevirme destekleniyor"}
    result = await convert_to_try(amount, from_currency.upper())
    return {
        "original": amount,
        "currency": from_currency.upper(),
        "result_try": round(result, 4),
        "source": "TCMB",
    }
