-- Миграция для создания таблицы настроек пользователей

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

-- Индекс для быстрого поиска по user_id
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id 
ON user_settings(user_id);

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_user_settings_updated_at 
    BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 