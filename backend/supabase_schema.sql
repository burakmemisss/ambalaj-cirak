-- =====================================================
-- Ambalaj Çırak Asistanı — Supabase Veritabanı Şeması
-- =====================================================
-- Çalıştırma: Supabase Dashboard → SQL Editor

-- pgvector eklentisini etkinleştir
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- KULLANICILAR
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TEDARİKÇİLER
-- =====================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'external' CHECK (type IN ('self', 'external')),
  currency     TEXT NOT NULL DEFAULT 'TRY' CHECK (currency IN ('TRY', 'USD', 'EUR', 'GBP')),
  contact      TEXT,
  notes        TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Varsayılan "Biz" tedarikçisini ekle
INSERT INTO suppliers (name, type, currency, notes)
VALUES ('Biz (İç Üretim)', 'self', 'TRY', 'Kendi üretimimiz');

-- =====================================================
-- TEDARİKÇİ FİYAT LİSTELERİ (Kur bazlı)
-- =====================================================
CREATE TABLE IF NOT EXISTS supplier_price_lists (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id      UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  product_category TEXT NOT NULL,       -- 'streç film', 'pet şişe', 'bant'...
  product_name     TEXT,
  unit             TEXT NOT NULL,       -- 'kg', 'adet', 'm', 'm²'...
  base_price       NUMERIC(12,4) NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'TRY',
  valid_date       DATE,
  source_type      TEXT DEFAULT 'manual' CHECK (source_type IN ('excel', 'pdf', 'image', 'manual')),
  source_file      TEXT,               -- Dosya adı/yolu
  notes            TEXT,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- DÖVİZ KURU ÖNBELLEĞİ
-- =====================================================
CREATE TABLE IF NOT EXISTS exchange_rates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_pair  TEXT NOT NULL,        -- 'USD/TRY', 'EUR/TRY', 'GBP/TRY'
  rate           NUMERIC(12,6) NOT NULL,
  fetched_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(currency_pair)
);

-- =====================================================
-- ÖĞRENİLMİŞ HESAPLAMALAR (Ana Hafıza — RAG)
-- =====================================================
CREATE TABLE IF NOT EXISTS learned_calculations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_description     TEXT NOT NULL,          -- "80g kraft kağıt poşet 30x20x10"
  product_category        TEXT,                   -- "kağıt poşet", "streç film"...
  input_parameters        JSONB,                  -- {gramaj: 80, en: 30, boy: 20, ...}
  reasoning_steps         JSONB,                  -- Adım adım nasıl hesaplandı
  final_cost              NUMERIC(12,4),          -- Sonuç maliyet (TRY)
  final_cost_currency     TEXT DEFAULT 'TRY',
  unit                    TEXT DEFAULT 'adet',    -- maliyet birimi
  supplier_id             UUID REFERENCES suppliers(id),
  confidence_when_learned NUMERIC(3,0) DEFAULT 100, -- 0-100 güven skoru
  user_corrected          BOOLEAN DEFAULT FALSE,
  correction_notes        TEXT,
  is_approved             BOOLEAN DEFAULT FALSE,  -- Kullanıcı onayladı mı?
  embedding               vector(768),            -- Gemini embedding için 768 boyut
  created_by              UUID REFERENCES users(id),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Vektör araması için indeks (cosine distance)
CREATE INDEX IF NOT EXISTS learned_calculations_embedding_idx
  ON learned_calculations USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Metin araması için indeks
CREATE INDEX IF NOT EXISTS learned_calculations_category_idx
  ON learned_calculations (product_category);

-- =====================================================
-- ÖĞRENİLMİŞ HESAPLAMA ADIM ŞABLONLARI
-- (Çırağın Not Defteri — Kategori bazlı)
-- =====================================================
CREATE TABLE IF NOT EXISTS reasoning_templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_category      TEXT NOT NULL,
  step_order            INT NOT NULL,
  step_name             TEXT NOT NULL,       -- "Açık alan hesapla"
  step_description      TEXT,
  formula               TEXT,               -- "(en + yükseklik) × 2 × (boy + yükseklik)"
  variables             JSONB,              -- Hangi değişkenler kullanılır
  example_value         TEXT,               -- Örnek değer
  learned_from_calc_id  UUID REFERENCES learned_calculations(id),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SOHBET OTURUMLARI
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id),
  title             TEXT,                   -- Otomatik veya manuel başlık
  messages          JSONB DEFAULT '[]',     -- Tüm mesaj geçmişi
  calculations_made JSONB DEFAULT '[]',     -- Bu sohbette yapılan hesaplar
  is_archived       BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- GERİ BİLDİRİM LOGları
-- =====================================================
CREATE TABLE IF NOT EXISTS feedback_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id  UUID REFERENCES learned_calculations(id),
  session_id      UUID REFERENCES chat_sessions(id),
  user_id         UUID REFERENCES users(id),
  original_cost   NUMERIC(12,4),
  corrected_cost  NUMERIC(12,4),
  correction_type TEXT,                    -- 'price', 'method', 'supplier', 'parameters'
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- VIEWS — Kolay sorgular için
-- =====================================================

-- En güncel kurları göster
CREATE OR REPLACE VIEW current_exchange_rates AS
SELECT DISTINCT ON (currency_pair)
  currency_pair,
  rate,
  fetched_at
FROM exchange_rates
ORDER BY currency_pair, fetched_at DESC;

-- Tedarikçi bazlı son fiyatlar
CREATE OR REPLACE VIEW latest_supplier_prices AS
SELECT DISTINCT ON (supplier_id, product_category, unit)
  spl.*,
  s.name AS supplier_name,
  s.type AS supplier_type
FROM supplier_price_lists spl
JOIN suppliers s ON s.id = spl.supplier_id
ORDER BY supplier_id, product_category, unit, valid_date DESC NULLS LAST, created_at DESC;

-- =====================================================
-- FONKSİYONLAR
-- =====================================================

-- Benzer ürün arama fonksiyonu (RAG için)
CREATE OR REPLACE FUNCTION search_similar_calculations(
  query_embedding vector(768),
  match_threshold FLOAT DEFAULT 0.7,
  match_count     INT DEFAULT 5
)
RETURNS TABLE (
  id                  UUID,
  product_description TEXT,
  product_category    TEXT,
  input_parameters    JSONB,
  reasoning_steps     JSONB,
  final_cost          NUMERIC,
  unit                TEXT,
  supplier_id         UUID,
  similarity          FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    lc.id,
    lc.product_description,
    lc.product_category,
    lc.input_parameters,
    lc.reasoning_steps,
    lc.final_cost,
    lc.unit,
    lc.supplier_id,
    1 - (lc.embedding <=> query_embedding) AS similarity
  FROM learned_calculations lc
  WHERE lc.is_approved = TRUE
    AND 1 - (lc.embedding <=> query_embedding) > match_threshold
  ORDER BY lc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- updated_at otomatik güncelleme trigger'ı
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER learned_calculations_updated_at
  BEFORE UPDATE ON learned_calculations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
