"""
Döviz Kuru Servisi — TCMB (T.C. Merkez Bankası) Canlı Kurlar Entegrasyonu
"""
import httpx
import xml.etree.ElementTree as ET
from datetime import datetime
from app.database import get_supabase
from apscheduler.schedulers.asyncio import AsyncIOScheduler

TCMB_URL = "https://www.tcmb.gov.tr/kurlar/today.xml"

# Bellekte tutulan son kurlar (DB olmadığı durumlarda güvenli fallback)
MEMORY_RATES_CACHE = {
  "USD/TRY": 34.25,
  "EUR/TRY": 38.10,
  "GBP/TRY": 45.60,
  "TRY/TRY": 1.0,
}


async def fetch_tcmb_rates() -> dict:
  """T.C. Merkez Bankası (TCMB) XML servisinden canlı Döviz Satış kurlarını çeker."""
  global MEMORY_RATES_CACHE
  rates = {"USD/TRY": 34.25, "EUR/TRY": 38.10, "GBP/TRY": 45.60, "TRY/TRY": 1.0}

  try:
    async with httpx.AsyncClient(timeout=10.0) as client:
      resp = await client.get(TCMB_URL)
      if resp.status_code == 200:
        root = ET.fromstring(resp.content)
        for currency in root.findall("Currency"):
          code = currency.attrib.get("CurrencyCode")
          if code in ["USD", "EUR", "GBP"]:
            # BanknoteSelling veya ForexSelling (Döviz/Efektif Satış Kuru)
            selling_str = (
                currency.findtext("ForexSelling")
                or currency.findtext("BanknoteSelling")
                or "0"
            )
            try:
              rate_val = float(selling_str.replace(",", "."))
              if rate_val > 0:
                rates[f"{code}/TRY"] = rate_val
            except ValueError:
              pass
  except Exception as e:
    print(f"TCMB kur çekme uyarısı: {e}")

  MEMORY_RATES_CACHE.update(rates)

  # Supabase veritabanını güncelle (eğer bağlıysa)
  try:
    supabase = get_supabase()
    for pair, rate in rates.items():
      supabase.table("exchange_rates").upsert(
          {
              "currency_pair": pair,
              "rate": rate,
              "fetched_at": datetime.utcnow().isoformat(),
          },
          on_conflict="currency_pair",
      ).execute()
  except Exception:
    pass

  print(f"🏛️ TCMB Güncel Kurlar: {rates}")
  return rates


async def get_cached_rates() -> dict:
  """En güncel kurları veritabanından veya bellekten getir."""
  try:
    supabase = get_supabase()
    result = supabase.from_("current_exchange_rates").select("*").execute()
    rates = dict(MEMORY_RATES_CACHE)
    for row in result.data or []:
      rates[row["currency_pair"]] = float(row["rate"])
    return rates
  except Exception:
    return MEMORY_RATES_CACHE


async def convert_to_try(amount: float, currency: str) -> float:
  """Verilen tutarı TCMB kuru ile TRY'ye çevirir."""
  if currency == "TRY":
    return amount

  rates = await get_cached_rates()
  pair = f"{currency}/TRY"
  rate = rates.get(pair, 34.0)
  return amount * rate


def start_scheduler() -> AsyncIOScheduler:
  """TCMB kurlarını günde 2 kez güncelleyen zamanlayıcı."""
  scheduler = AsyncIOScheduler()
  scheduler.add_job(fetch_tcmb_rates, "cron", hour="9,15", minute=30)
  scheduler.add_job(fetch_tcmb_rates, "date")
  scheduler.start()
  return scheduler
