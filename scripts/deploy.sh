#!/bin/bash

# Скрипт развертывания проекта Emlak

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="emlak"
REPO_URL="https://github.com/your-username/emlak.git"  # Замените на ваш репозиторий

echo -e "${BLUE}🚀 Развертывание проекта Emlak${NC}"

# Проверка, что Docker работает
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker не работает. Убедитесь, что Docker запущен и вы в группе docker${NC}"
    echo -e "${YELLOW}Выполните: newgrp docker${NC}"
    exit 1
fi

# Переход в директорию apps
cd ~/apps

# Клонирование репозитория
if [ -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}⚠️  Папка $PROJECT_DIR уже существует. Удалить и склонировать заново? (y/n)${NC}"
    read -r response
    if [[ "$response" == "y" ]]; then
        rm -rf "$PROJECT_DIR"
    else
        echo -e "${BLUE}📁 Переход в существующую папку...${NC}"
        cd "$PROJECT_DIR"
        git pull origin master
    fi
fi

if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${BLUE}📥 Клонирование репозитория...${NC}"
    git clone "$REPO_URL" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
fi

# Настройка .env файла
echo -e "${BLUE}⚙️  Настройка переменных окружения...${NC}"

if [ ! -f ".env" ]; then
    if [ -f ".env.prod" ]; then
        cp .env.prod .env
        echo -e "${GREEN}✅ Скопирован .env.prod в .env${NC}"
    else
        echo -e "${YELLOW}⚠️  Создаю .env файл...${NC}"
        cat > .env << EOF
# Настройки базы данных
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=emlak
POSTGRES_USER=emlak
POSTGRES_PASSWORD=emlak_secure_password_123

# Telegram бот токен (ОБЯЗАТЕЛЬНО ЗАМЕНИТЕ!)
BOT_TOKEN=your_bot_token_here

# Настройки парсера
HEPSIEMLAK_SCHEDULE=0 10,16,22 * * *
EMLAKJET_SCHEDULE=15 10,16,22 * * *

# Настройки Puppeteer
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
EOF
    fi
fi

# Проверка токена бота
if grep -q "your_bot_token_here" .env; then
    echo -e "${RED}❌ ВНИМАНИЕ! Необходимо настроить BOT_TOKEN в .env файле${NC}"
    echo -e "${YELLOW}Откройте файл .env и замените your_bot_token_here на реальный токен${NC}"
    echo -e "${BLUE}Для редактирования: nano .env${NC}"
    
    while true; do
        echo -e "${YELLOW}Хотите отредактировать .env сейчас? (y/n)${NC}"
        read -r response
        if [[ "$response" == "y" ]]; then
            nano .env
            break
        elif [[ "$response" == "n" ]]; then
            break
        fi
    done
fi

# Остановка существующих контейнеров
echo -e "${BLUE}🛑 Остановка существующих контейнеров...${NC}"
docker-compose down --volumes 2>/dev/null || true

# Очистка старых образов
echo -e "${BLUE}🧹 Очистка старых образов...${NC}"
docker system prune -f || true

# Сборка и запуск контейнеров
echo -e "${BLUE}🔨 Сборка и запуск контейнеров...${NC}"
docker-compose up --build -d

# Ожидание запуска
echo -e "${BLUE}⏳ Ожидание запуска сервисов...${NC}"
sleep 10

# Проверка статуса контейнеров
echo -e "${BLUE}📊 Проверка статуса контейнеров:${NC}"
docker-compose ps

# Проверка логов
echo -e "${BLUE}📋 Последние логи:${NC}"
echo -e "${YELLOW}=== PostgreSQL ===${NC}"
docker-compose logs postgres | tail -5

echo -e "${YELLOW}=== Bot ===${NC}"
docker-compose logs bot | tail -5

echo -e "${YELLOW}=== Parser ===${NC}"
docker-compose logs parser | tail -5

# Финальные инструкции
echo -e "${GREEN}🎉 Развертывание завершено!${NC}"
echo -e "${BLUE}📝 Полезные команды:${NC}"
echo -e "  📊 Статус:           ${YELLOW}docker-compose ps${NC}"
echo -e "  📋 Логи:             ${YELLOW}docker-compose logs <service>${NC}"
echo -e "  🔄 Перезапуск:       ${YELLOW}docker-compose restart${NC}"
echo -e "  🛑 Остановка:        ${YELLOW}docker-compose down${NC}"
echo -e "  🔧 Обновление:       ${YELLOW}git pull && docker-compose up --build -d${NC}"

echo -e "${BLUE}🌐 Доступ к сервисам:${NC}"
echo -e "  🐘 PostgreSQL:       ${YELLOW}localhost:5432${NC}"
echo -e "  🤖 Telegram Bot:     ${YELLOW}Работает автоматически${NC}"
echo -e "  🔍 Parser:           ${YELLOW}Работает по расписанию${NC}"

# Проверка что все работает
echo -e "${BLUE}🔍 Финальная проверка...${NC}"
if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✅ Сервисы запущены успешно!${NC}"
else
    echo -e "${RED}❌ Некоторые сервисы не запустились${NC}"
    echo -e "${YELLOW}Проверьте логи: docker-compose logs${NC}"
fi 