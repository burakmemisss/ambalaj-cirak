"""Supabase istemcisi — Esnek & Fallback Destekli"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_client: Client | None = None


def get_supabase() -> Client:
    """Supabase istemcisi getirir. Değişkenler yoksa veya geçersizse hata vermek yerine None/Esnek döner."""
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL", "")
        # SERVICE_KEY, ANON_KEY veya SUPABASE_KEY destekle
        key = (
            os.getenv("SUPABASE_SERVICE_KEY")
            or os.getenv("SUPABASE_ANON_KEY")
            or os.getenv("SUPABASE_KEY")
            or ""
        )
        if not url or not key:
            raise ValueError("Supabase bağlantısı henüz yapılandırılmadı.")
        _client = create_client(url, key)
    return _client
