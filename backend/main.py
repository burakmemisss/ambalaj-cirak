"""
Ambalaj Çırak Asistanı — FastAPI Ana Uygulama
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.routers import chat, vision, suppliers, prices, exchange_rates as fx
from app.services.scheduler import start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Başlangıçta kur güncelleme zamanlayıcısını başlat
    scheduler = start_scheduler()
    yield
    scheduler.shutdown()


app = FastAPI(
    title="Ambalaj Çırak Asistanı API",
    description="Ambalaj firması için öğrenen maliyet hesaplama asistanı",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Expo Go için
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api/chat", tags=["Sohbet"])
app.include_router(vision.router, prefix="/api/vision", tags=["Görsel Analiz"])
app.include_router(suppliers.router, prefix="/api/suppliers", tags=["Tedarikçiler"])
app.include_router(prices.router, prefix="/api/prices", tags=["Fiyatlar"])
app.include_router(fx.router, prefix="/api/exchange-rates", tags=["Döviz Kurları"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Çırak hazır! 🎓"}
