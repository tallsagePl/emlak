#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Инициализация проекта${NC}"

# Проверка .env файлов для разработки и продакшена
if [ ! -f ".env.dev" ]; then
    echo -e "${YELLOW}⚠️ Файл .env.dev не найден, создаю...${NC}"
    cat > .env.dev << EOF
# Конфигурация для разработки

# База данных (локальная)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=emlak
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Telegram бот (DEV токен)
BOT_TOKEN=7922493113:AAEPp_Z2ZtUBL-c5drHe4jnruFNPABS96hY

# Настройки парсера
PUPPETEER_EXECUTABLE_PATH=C:/Program Files/Google/Chrome/Application/chrome.exe
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Расписание парсеров (cron формат)
HEPSIEMLAK_SCHEDULE=0 10,16,22 * * *
EMLAKJET_SCHEDULE=15 10,16,22 * * *
EOF
    echo -e "${GREEN}✅ Создан .env.dev файл${NC}"
fi

if [ ! -f ".env.prod" ]; then
    echo -e "${YELLOW}⚠️ Файл .env.prod не найден, создаю...${NC}"
    cat > .env.prod << EOF
# Конфигурация для продакшена

# База данных (Docker)
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=emlak
POSTGRES_USER=emlak
POSTGRES_PASSWORD=emlak123

# Telegram бот (PROD токен)
BOT_TOKEN=8185337278:AAGIiZzr1llPuOG9opu2ev0d81vOHAqy8Sg

# Настройки парсера
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Расписание парсеров (cron формат)
HEPSIEMLAK_SCHEDULE=0 10,16,22 * * *
EMLAKJET_SCHEDULE=15 10,16,22 * * *
EOF
    echo -e "${GREEN}✅ Создан .env.prod файл${NC}"
fi

# Установка зависимостей
echo -e "${BLUE}📦 Установка зависимостей...${NC}"
yarn install

echo -e "${GREEN}✅ Проект готов к работе!${NC}"
echo -e "${BLUE}ℹ️  Команды для запуска:${NC}"
echo "  🐳 Docker (продакшен): docker-compose up"
echo "  💾 База данных:        docker-compose up postgres"
echo ""
echo -e "${BLUE}ℹ️  Разработка:${NC}"
echo "  🤖 Запуск бота:        yarn bot:dev"
echo "  🔍 Запуск парсера:     yarn parser:dev"
echo "  🚀 Запуск всего:       yarn dev"
echo ""
echo -e "${YELLOW}📝 Не забудьте настроить токен в .env файле!${NC}"
echo -e "${YELLOW}💡 Для продакшена: скопируйте .env.prod в .env${NC}" 