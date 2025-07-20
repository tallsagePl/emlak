#!/bin/bash

# Скрипт для быстрого тестирования парсеров

echo "🧪 Тестирование парсеров..."

# Проверяем, что контейнеры запущены
if ! docker-compose ps | grep -q "Up"; then
    echo "❌ Контейнеры не запущены! Запустите сначала:"
    echo "docker-compose up -d"
    exit 1
fi

# Тестируем каждый парсер с лимитом 3 объявления
echo "🏠 Тестируем HepsEmlak (3 объявления)..."
docker-compose exec parser node index.js run hepsiemlak --test

echo ""
echo "🏡 Тестируем EmlakJet (3 объявления)..."
docker-compose exec parser node index.js run emlakjet --test

echo ""
echo "✅ Тестирование завершено!"
echo "📊 Проверьте результаты в базе данных:"
echo "docker-compose exec postgres psql -U emlak -d emlak -c \"SELECT COUNT(*) FROM parsed_listings;\"" 