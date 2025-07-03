-- Универсальная схема базы данных для Emlak проекта

-- Таблица для пользовательских объявлений (из бота)
CREATE TABLE IF NOT EXISTS user_listings (
    id SERIAL PRIMARY KEY,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'live', -- live / freeze / dead
    property_type TEXT NOT NULL, -- Аренда / Продажа
    district TEXT NOT NULL,
    price TEXT NOT NULL,
    rooms TEXT NOT NULL, -- 1+1, 2+1 и т.д.
    location TEXT,
    address TEXT,
    description TEXT
);

-- Таблица для отслеживания обработанных URL парсера
CREATE TABLE IF NOT EXISTS parser_processed (
    id SERIAL PRIMARY KEY,
    site_name TEXT NOT NULL,
    processed_urls TEXT[] DEFAULT '{}',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_processed INTEGER DEFAULT 0
);

-- Уникальный индекс для site_name
CREATE UNIQUE INDEX IF NOT EXISTS idx_parser_processed_site 
ON parser_processed(site_name);

-- Таблица для спаршенных данных
CREATE TABLE IF NOT EXISTS parsed_listings (
    id SERIAL PRIMARY KEY,
    site_name TEXT NOT NULL,
    listing_id TEXT NOT NULL,
    url TEXT NOT NULL,
    data JSONB NOT NULL,
    price_numeric BIGINT,
    coordinates POINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для оптимизации поиска
CREATE INDEX IF NOT EXISTS idx_parsed_listings_site_listing 
ON parsed_listings(site_name, listing_id);

CREATE INDEX IF NOT EXISTS idx_parsed_listings_url 
ON parsed_listings(url);

CREATE INDEX IF NOT EXISTS idx_parsed_listings_price 
ON parsed_listings(price_numeric);

CREATE INDEX IF NOT EXISTS idx_parsed_listings_coordinates 
ON parsed_listings USING GIST(coordinates);

CREATE INDEX IF NOT EXISTS idx_parsed_listings_created_at 
ON parsed_listings(created_at);

-- JSONB индексы для быстрого поиска по данным
CREATE INDEX IF NOT EXISTS idx_parsed_listings_data_gin 
ON parsed_listings USING GIN(data);

-- Таблица для логов парсера
CREATE TABLE IF NOT EXISTS parser_logs (
    id SERIAL PRIMARY KEY,
    site_name TEXT NOT NULL,
    log_type TEXT NOT NULL, -- success / error / info
    message TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_parser_logs_site_type 
ON parser_logs(site_name, log_type);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для автоматического обновления updated_at
CREATE TRIGGER update_user_listings_updated_at 
    BEFORE UPDATE ON user_listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parsed_listings_updated_at 
    BEFORE UPDATE ON parsed_listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Заполняем начальные данные для парсеров
INSERT INTO parser_processed (site_name, processed_urls, total_processed) 
VALUES 
    ('hepsiemlak', '{}', 0),
    ('emlakjet', '{}', 0),
    ('sahibinden', '{}', 0),
    ('zingate', '{}', 0)
ON CONFLICT (site_name) DO NOTHING; 