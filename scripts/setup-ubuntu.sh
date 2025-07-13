#!/bin/bash

# Скрипт установки окружения для проекта Emlak на Ubuntu 22.04

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Установка окружения для проекта Emlak на Ubuntu 22.04${NC}"

# Проверка, что это Ubuntu
if [ ! -f /etc/os-release ]; then
    echo -e "${RED}❌ Не удается определить версию ОС${NC}"
    exit 1
fi

source /etc/os-release
if [[ "$NAME" != "Ubuntu" ]]; then
    echo -e "${YELLOW}⚠️  Этот скрипт предназначен для Ubuntu, но обнаружена: $NAME${NC}"
    echo -e "${YELLOW}Продолжить? (y/n)${NC}"
    read -r response
    if [[ "$response" != "y" ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}✅ Обнаружена: $PRETTY_NAME${NC}"

# Обновление системы
echo -e "${BLUE}📦 Обновление списка пакетов...${NC}"
sudo apt update

echo -e "${BLUE}⬆️  Обновление системы...${NC}"
sudo apt upgrade -y

# Установка базовых пакетов
echo -e "${BLUE}🔧 Установка базовых пакетов...${NC}"
sudo apt install -y \
    curl \
    wget \
    git \
    unzip \
    htop \
    nano \
    vim \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release

# Установка Docker
echo -e "${BLUE}🐳 Установка Docker...${NC}"
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✅ Docker уже установлен${NC}"
else
    # Удаление старых версий Docker
    sudo apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Добавление официального GPG ключа Docker
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Добавление репозитория Docker
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Обновление и установка Docker
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Добавление пользователя в группу docker
    sudo usermod -aG docker $USER
    
    echo -e "${GREEN}✅ Docker установлен${NC}"
fi

# Установка Docker Compose (standalone)
echo -e "${BLUE}🐳 Установка Docker Compose...${NC}"
if command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✅ Docker Compose уже установлен${NC}"
else
    # Скачивание последней версии Docker Compose
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep -o -P '(?<="tag_name": ")[^"]*')
    sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    echo -e "${GREEN}✅ Docker Compose установлен${NC}"
fi

# Установка Node.js и npm
echo -e "${BLUE}📱 Установка Node.js...${NC}"
if command -v node &> /dev/null; then
    echo -e "${GREEN}✅ Node.js уже установлен (версия: $(node --version))${NC}"
else
    # Установка Node.js 18.x
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
    
    echo -e "${GREEN}✅ Node.js установлен (версия: $(node --version))${NC}"
fi

# Установка Yarn
echo -e "${BLUE}🧶 Установка Yarn...${NC}"
if command -v yarn &> /dev/null; then
    echo -e "${GREEN}✅ Yarn уже установлен${NC}"
else
    # Установка Yarn через npm
    sudo npm install -g yarn
    
    echo -e "${GREEN}✅ Yarn установлен${NC}"
fi

# Настройка firewall (UFW)
echo -e "${BLUE}🔥 Настройка firewall...${NC}"
sudo ufw --force enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5432/tcp  # PostgreSQL (если нужен внешний доступ)

echo -e "${GREEN}✅ Firewall настроен${NC}"

# Создание директории для проекта
echo -e "${BLUE}📁 Создание директории для проекта...${NC}"
mkdir -p ~/apps
cd ~/apps

# Проверка версий
echo -e "${BLUE}📋 Проверка установленных версий:${NC}"
echo -e "${GREEN}Docker: $(docker --version)${NC}"
echo -e "${GREEN}Docker Compose: $(docker-compose --version)${NC}"
echo -e "${GREEN}Node.js: $(node --version)${NC}"
echo -e "${GREEN}NPM: $(npm --version)${NC}"
echo -e "${GREEN}Yarn: $(yarn --version)${NC}"
echo -e "${GREEN}Git: $(git --version)${NC}"

echo -e "${GREEN}🎉 Установка завершена!${NC}"
echo -e "${BLUE}📝 Что дальше:${NC}"
echo -e "1. Перелогиньтесь или выполните: ${YELLOW}newgrp docker${NC}"
echo -e "2. Склонируйте репозиторий: ${YELLOW}git clone <your-repo-url> emlak${NC}"
echo -e "3. Перейдите в папку: ${YELLOW}cd emlak${NC}"
echo -e "4. Настройте .env файл с токеном бота"
echo -e "5. Запустите проект: ${YELLOW}docker-compose up -d${NC}"

echo -e "${YELLOW}⚠️  Требуется перелогиниться для применения изменений в группе docker!${NC}" 