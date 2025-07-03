#!/bin/bash

echo "🚀 Запуск базы данных Emlak..."

# Проверяем, установлен ли Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Пожалуйста, установите Docker."
    exit 1
fi

# Проверяем, установлен ли Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose не установлен. Пожалуйста, установите Docker Compose."
    exit 1
fi

# Запускаем базу данных
echo "📦 Запуск PostgreSQL..."
docker-compose up -d

# Ждем немного, чтобы база данных успела запуститься
echo "⏳ Ожидание запуска базы данных..."
sleep 5

# Проверяем статус контейнера
if docker ps | grep -q emlak_postgres; then
    echo "✅ База данных успешно запущена!"
    echo "📍 PostgreSQL доступен на localhost:5432"
    echo "🔗 Строка подключения: postgresql://postgres:111@localhost:5432/emlak"
    echo ""
    echo "📋 Следующие шаги:"
    echo "1. Запустите бота: cd bot && npm install && npm start"
    echo "2. Запустите парсер: cd parser && npm install && npm start"
else
    echo "❌ Ошибка запуска базы данных"
    echo "Проверьте логи: docker-compose logs postgres"
    exit 1
fi 