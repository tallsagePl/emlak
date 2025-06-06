CREATE TABLE IF NOT EXISTS listings (
    id SERIAL PRIMARY KEY,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'live', -- live / freeze / dead
    property_type TEXT NOT NULL, -- Аренда / Продажа
    district TEXT NOT NULL,
    price TEXT NOT NULL,
    rooms TEXT NOT NULL, -- 1+1, 2+1 и т.д.
    location TEXT,
    address TEXT,
    description TEXT
);
