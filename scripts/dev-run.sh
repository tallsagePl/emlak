#!/bin/bash

# Скрипт для запуска dev-режима с последовательным парсингом всех парсеров

echo "🚀 Запуск dev-режима с последовательным парсингом..."

# Проверяем наличие .env файла
if [ ! -f ".env" ]; then
    echo "❌ Файл .env не найден!"
    echo "📝 Создайте .env файл с переменными:"
    echo "POSTGRES_HOST=postgres"
    echo "POSTGRES_PORT=5432"
    echo "POSTGRES_DB=emlak"
    echo "POSTGRES_USER=emlak"
    echo "POSTGRES_PASSWORD=111"
    echo "BOT_TOKEN=your_production_bot_token_here"
    echo "BOT_TOKEN=your_bot_token_here"
    echo "NODE_ENV=production"
    exit 1
fi

# Останавливаем все контейнеры
echo "🛑 Останавливаем существующие контейнеры..."
docker-compose down

# Запускаем dev-режим
echo "🐳 Запуск dev-режима..."
docker-compose -f docker-compose.dev.yml up --build

echo "✅ Dev-режим завершён!" 