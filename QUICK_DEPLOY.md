# 🚀 Быстрое развертывание на Ubuntu 22.04

## 🔧 Команды для копирования

### 1. Установка окружения
```bash
# Скачать и запустить скрипт установки
wget https://raw.githubusercontent.com/your-username/emlak/master/scripts/setup-ubuntu.sh
chmod +x setup-ubuntu.sh
./setup-ubuntu.sh

# Применить изменения Docker
newgrp docker
```

### 2. Развертывание проекта
```bash
# Скачать и запустить развертывание
wget https://raw.githubusercontent.com/your-username/emlak/master/scripts/deploy.sh
chmod +x deploy.sh
./deploy.sh
```

### 3. Настройка токена бота
```bash
cd ~/apps/emlak
nano .env
# Заменить your_bot_token_here на реальный токен
```

### 4. Управление проектом
```bash
# Скачать скрипт управления
wget https://raw.githubusercontent.com/your-username/emlak/master/scripts/manage.sh
chmod +x manage.sh

# Основные команды
./manage.sh status    # Статус
./manage.sh logs      # Логи
./manage.sh restart   # Перезапуск
./manage.sh monitor   # Мониторинг
```

## 🛠️ Полезные команды Docker

```bash
cd ~/apps/emlak

# Статус контейнеров
docker-compose ps

# Логи в реальном времени
docker-compose logs -f

# Перезапуск всех сервисов
docker-compose restart

# Остановка
docker-compose down

# Запуск
docker-compose up -d

# Пересборка и запуск
docker-compose up --build -d

# Очистка Docker
docker system prune -f
```

## 🔍 Проверка работы

```bash
# Проверка статуса
docker-compose ps

# Логи парсера
docker-compose logs parser

# Логи бота
docker-compose logs bot

# Подключение к базе данных
docker-compose exec postgres psql -U emlak -d emlak

# Тестовый запуск парсера
docker-compose exec parser node parser/index.js run hepsiemlak --test
```

## 🚨 Устранение проблем

```bash
# Перезапуск с пересборкой
docker-compose down --volumes
docker-compose up --build -d

# Проверка Docker
sudo systemctl status docker
sudo systemctl restart docker

# Проверка групп пользователя
groups $USER

# Если проблемы с правами Docker
sudo usermod -aG docker $USER
newgrp docker
```

## 📋 Чек-лист развертывания

- [ ] Установлен Docker и Docker Compose
- [ ] Пользователь добавлен в группу docker
- [ ] Проект склонирован
- [ ] Настроен .env файл с токеном бота
- [ ] Контейнеры запущены: `docker-compose ps`
- [ ] Парсер работает: `docker-compose logs parser`
- [ ] Бот отвечает в Telegram

---

💡 **Совет**: Сохраните эту памятку для быстрого доступа к командам! 