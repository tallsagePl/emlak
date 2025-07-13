#!/bin/bash

# Скрипт управления проектом Emlak

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="~/apps/emlak"

function show_help() {
    echo -e "${BLUE}🔧 Скрипт управления проектом Emlak${NC}"
    echo -e "${YELLOW}Использование: ./manage.sh <команда>${NC}"
    echo ""
    echo -e "${GREEN}Доступные команды:${NC}"
    echo -e "  ${YELLOW}status${NC}     - Показать статус всех сервисов"
    echo -e "  ${YELLOW}logs${NC}       - Показать логи всех сервисов"
    echo -e "  ${YELLOW}restart${NC}    - Перезапустить все сервисы"
    echo -e "  ${YELLOW}stop${NC}       - Остановить все сервисы"
    echo -e "  ${YELLOW}start${NC}      - Запустить все сервисы"
    echo -e "  ${YELLOW}update${NC}     - Обновить проект из Git и перезапустить"
    echo -e "  ${YELLOW}clean${NC}      - Очистить Docker кеш и образы"
    echo -e "  ${YELLOW}backup${NC}     - Создать резервную копию базы данных"
    echo -e "  ${YELLOW}monitor${NC}    - Мониторинг в реальном времени"
    echo -e "  ${YELLOW}help${NC}       - Показать эту справку"
    echo ""
    echo -e "${BLUE}Примеры:${NC}"
    echo -e "  ./manage.sh status"
    echo -e "  ./manage.sh logs"
    echo -e "  ./manage.sh restart"
}

function check_project_dir() {
    if [ ! -d "$PROJECT_DIR" ]; then
        echo -e "${RED}❌ Папка проекта не найдена: $PROJECT_DIR${NC}"
        exit 1
    fi
    cd "$PROJECT_DIR"
}

function show_status() {
    echo -e "${BLUE}📊 Статус сервисов:${NC}"
    docker-compose ps
    echo ""
    echo -e "${BLUE}💾 Использование диска:${NC}"
    docker system df
    echo ""
    echo -e "${BLUE}🔄 Uptime системы:${NC}"
    uptime
}

function show_logs() {
    echo -e "${BLUE}📋 Логи сервисов:${NC}"
    echo -e "${YELLOW}=== PostgreSQL ===${NC}"
    docker-compose logs --tail=10 postgres
    echo ""
    echo -e "${YELLOW}=== Bot ===${NC}"
    docker-compose logs --tail=10 bot
    echo ""
    echo -e "${YELLOW}=== Parser ===${NC}"
    docker-compose logs --tail=10 parser
}

function restart_services() {
    echo -e "${BLUE}🔄 Перезапуск сервисов...${NC}"
    docker-compose restart
    echo -e "${GREEN}✅ Сервисы перезапущены${NC}"
}

function stop_services() {
    echo -e "${BLUE}🛑 Остановка сервисов...${NC}"
    docker-compose down
    echo -e "${GREEN}✅ Сервисы остановлены${NC}"
}

function start_services() {
    echo -e "${BLUE}🚀 Запуск сервисов...${NC}"
    docker-compose up -d
    echo -e "${GREEN}✅ Сервисы запущены${NC}"
}

function update_project() {
    echo -e "${BLUE}🔄 Обновление проекта...${NC}"
    
    # Сохранение .env файла
    if [ -f ".env" ]; then
        cp .env .env.backup
        echo -e "${GREEN}✅ .env файл сохранен${NC}"
    fi
    
    # Обновление кода
    git pull origin master
    
    # Восстановление .env файла
    if [ -f ".env.backup" ]; then
        cp .env.backup .env
        rm .env.backup
        echo -e "${GREEN}✅ .env файл восстановлен${NC}"
    fi
    
    # Пересборка и перезапуск
    docker-compose down
    docker-compose up --build -d
    
    echo -e "${GREEN}✅ Проект обновлен${NC}"
}

function clean_docker() {
    echo -e "${BLUE}🧹 Очистка Docker...${NC}"
    docker-compose down
    docker system prune -f
    docker volume prune -f
    echo -e "${GREEN}✅ Docker очищен${NC}"
}

function backup_database() {
    echo -e "${BLUE}💾 Создание резервной копии...${NC}"
    
    BACKUP_DIR="backups"
    mkdir -p "$BACKUP_DIR"
    
    BACKUP_FILE="$BACKUP_DIR/emlak_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    docker-compose exec postgres pg_dump -U emlak emlak > "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Резервная копия создана: $BACKUP_FILE${NC}"
    else
        echo -e "${RED}❌ Ошибка создания резервной копии${NC}"
    fi
}

function monitor_services() {
    echo -e "${BLUE}📊 Мониторинг сервисов (Ctrl+C для выхода)...${NC}"
    
    while true; do
        clear
        echo -e "${BLUE}=== Мониторинг Emlak === $(date)${NC}"
        echo ""
        
        # Статус контейнеров
        echo -e "${YELLOW}📊 Статус контейнеров:${NC}"
        docker-compose ps
        echo ""
        
        # Использование ресурсов
        echo -e "${YELLOW}💻 Использование ресурсов:${NC}"
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
        echo ""
        
        # Последние логи
        echo -e "${YELLOW}📋 Последние логи:${NC}"
        docker-compose logs --tail=3 2>/dev/null | tail -10
        
        sleep 5
    done
}

# Основная логика
case "$1" in
    "status")
        check_project_dir
        show_status
        ;;
    "logs")
        check_project_dir
        show_logs
        ;;
    "restart")
        check_project_dir
        restart_services
        ;;
    "stop")
        check_project_dir
        stop_services
        ;;
    "start")
        check_project_dir
        start_services
        ;;
    "update")
        check_project_dir
        update_project
        ;;
    "clean")
        check_project_dir
        clean_docker
        ;;
    "backup")
        check_project_dir
        backup_database
        ;;
    "monitor")
        check_project_dir
        monitor_services
        ;;
    "help"|""|*)
        show_help
        ;;
esac 