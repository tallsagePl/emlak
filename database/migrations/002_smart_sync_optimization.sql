-- Миграция для оптимизации умной синхронизации
-- Дата: 2025-07-12
-- Описание: Добавление индексов для быстрого поиска по URL и listing_id

-- Добавляем новые индексы для оптимизации умной синхронизации
CREATE INDEX IF NOT EXISTS idx_parsed_listings_site_url 
ON parsed_listings(site_name, url);

CREATE INDEX IF NOT EXISTS idx_parsed_listings_listing_id 
ON parsed_listings(listing_id);

-- Добавляем индекс для быстрого поиска обновленных записей
CREATE INDEX IF NOT EXISTS idx_parsed_listings_updated_at 
ON parsed_listings(updated_at);

-- Добавляем составной индекс для статистики
CREATE INDEX IF NOT EXISTS idx_parsed_listings_site_created 
ON parsed_listings(site_name, created_at);

-- Комментарии к изменениям
COMMENT ON INDEX idx_parsed_listings_site_url IS 'Индекс для быстрого поиска записей по сайту и URL при синхронизации';
COMMENT ON INDEX idx_parsed_listings_listing_id IS 'Индекс для быстрого поиска записей по ID объявления';
COMMENT ON INDEX idx_parsed_listings_updated_at IS 'Индекс для поиска недавно обновленных записей';
COMMENT ON INDEX idx_parsed_listings_site_created IS 'Составной индекс для статистики по сайту и дате создания'; 