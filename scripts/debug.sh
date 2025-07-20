#!/bin/bash

# Скрипт для отладки парсера и бота

echo "🐛 Запуск отладочного режима..."

# Создаём .env файл если его нет
if [ ! -f ".env" ]; then
    echo "📝 Создаю .env файл..."
    cat > .env << EOF
# База данных
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=emlak
POSTGRES_USER=emlak
POSTGRES_PASSWORD=111

# Telegram бот токены
BOT_TOKEN=your_production_bot_token_here
BOT_TOKEN=your_bot_token_here

# Окружение
NODE_ENV=development
EOF
    echo "⚠️ Отредактируйте .env файл и добавьте реальные токены!"
fi

# Останавливаем все контейнеры
echo "🛑 Останавливаем существующие контейнеры..."
docker-compose down

# Запускаем отладочный режим
echo "🐳 Запуск отладочного режима..."
docker-compose -f docker-compose.debug.yml up -d

echo "✅ Контейнеры запущены!"
echo ""
echo "📋 Доступные команды для отладки:"
echo ""
echo "🧪 Тестирование парсеров:"
echo "  docker-compose -f docker-compose.debug.yml exec parser node index.js run hepsiemlak --test"
echo "  docker-compose -f docker-compose.debug.yml exec parser node index.js run emlakjet --test"
echo "  docker-compose -f docker-compose.debug.yml exec parser node index.js run-all"
echo ""
echo "📊 Проверка базы данных:"
echo "  docker-compose -f docker-compose.debug.yml exec postgres psql -U emlak -d emlak -c \"SELECT COUNT(*) FROM parsed_listings;\""
echo ""
echo "📝 Просмотр логов:"
echo "  docker-compose -f docker-compose.debug.yml logs -f bot"
echo "  docker-compose -f docker-compose.debug.yml logs -f parser"
echo ""
echo "🔍 Вход в контейнер для отладки:"
echo "  docker-compose -f docker-compose.debug.yml exec parser bash"
echo "  docker-compose -f docker-compose.debug.yml exec bot bash"
echo ""
echo "🛑 Остановка:"
echo "  docker-compose -f docker-compose.debug.yml down" 