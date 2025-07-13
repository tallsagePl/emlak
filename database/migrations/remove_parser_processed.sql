-- Удаляем таблицу parser_processed, так как теперь все данные хранятся в parsed_listings
DROP TABLE IF EXISTS parser_processed;

-- Добавляем индекс на url для быстрой проверки обработанных URL
CREATE INDEX IF NOT EXISTS idx_parsed_listings_url ON parsed_listings(url);

-- Добавляем индекс на site_name для быстрой выборки по сайту
CREATE INDEX IF NOT EXISTS idx_parsed_listings_site_name ON parsed_listings(site_name);

-- Добавляем индекс на created_at для быстрой сортировки и очистки старых записей
CREATE INDEX IF NOT EXISTS idx_parsed_listings_created_at ON parsed_listings(created_at); 