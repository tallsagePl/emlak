-- Единый скрипт инициализации для базы данных emlak
-- Выполняется в базе данных emlak (указана в POSTGRES_DB)

\echo 'Начинаем инициализацию базы данных emlak...'

-- Создаем пользователя если он не существует
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'emlak') THEN
        CREATE USER emlak WITH PASSWORD '111';
        RAISE NOTICE 'Пользователь emlak создан';
    ELSE
        RAISE NOTICE 'Пользователь emlak уже существует';
    END IF;
END
$$;

-- Даем права на базу данных
GRANT ALL PRIVILEGES ON DATABASE emlak TO emlak;

-- Даем права на схему public
GRANT ALL PRIVILEGES ON SCHEMA public TO emlak;

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

-- Уникальный индекс для предотвращения дублирования URL
CREATE UNIQUE INDEX IF NOT EXISTS idx_parsed_listings_url_unique 
ON parsed_listings(url);

-- Таблица для логов парсера
CREATE TABLE IF NOT EXISTS parser_logs (
    id SERIAL PRIMARY KEY,
    site_name TEXT NOT NULL,
    log_type TEXT NOT NULL, -- success / error / info
    message TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица для хранения настроек пользователей
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    notification_filters JSONB DEFAULT '{}',
    last_notification_sent_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TRIGGER update_user_settings_updated_at 
    BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Даем права на все созданные таблицы
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO emlak;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO emlak;

\echo 'Инициализация базы данных emlak завершена успешно!' 