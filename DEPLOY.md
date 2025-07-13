# 🚀 Развертывание проекта Emlak на Ubuntu 22.04

Пошаговая инструкция по установке и запуску проекта парсера недвижимости на чистом сервере Ubuntu 22.04.

## 📋 Требования

- Ubuntu 22.04 LTS
- Права sudo
- Доступ к интернету
- Токен Telegram бота

## 🔧 Быстрая установка

### 1. Скачивание скриптов

```bash
# Скачивание основного скрипта установки
wget https://raw.githubusercontent.com/your-username/emlak/master/scripts/setup-ubuntu.sh

# Или создайте файл вручную и скопируйте содержимое
nano setup-ubuntu.sh
```

### 2. Установка окружения

```bash
# Сделать скрипт исполняемым
chmod +x setup-ubuntu.sh

# Запустить установку
./setup-ubuntu.sh
```

### 3. Перелогиниться для применения изменений Docker

```bash
# Перелогиниться или выполнить
newgrp docker
```

### 4. Развертывание проекта

```bash
# Скачать скрипт развертывания
wget https://raw.githubusercontent.com/your-username/emlak/master/scripts/deploy.sh

# Сделать исполняемым
chmod +x deploy.sh

# Запустить развертывание
./deploy.sh
```

## 📝 Подробные инструкции

### Установка зависимостей

Скрипт `setup-ubuntu.sh` устанавливает:
- Docker и Docker Compose
- Node.js 18.x
- Yarn
- Git
- Базовые пакеты
- Настройка firewall

### Развертывание проекта

Скрипт `deploy.sh` выполняет:
- Клонирование репозитория
- Настройка `.env` файла
- Сборка Docker образов
- Запуск контейнеров

### Настройка Telegram бота

1. Создайте бота через [@BotFather](https://t.me/BotFather)
2. Получите токен бота
3. Отредактируйте файл `.env`:

```bash
cd ~/apps/emlak
nano .env
```

4. Замените `your_bot_token_here` на реальный токен

## 🛠️ Управление проектом

### Скрипт управления

```bash
# Скачать скрипт управления
wget https://raw.githubusercontent.com/your-username/emlak/master/scripts/manage.sh
chmod +x manage.sh

# Доступные команды
./manage.sh help
```

### Основные команды

```bash
# Статус сервисов
./manage.sh status

# Просмотр логов
./manage.sh logs

# Перезапуск
./manage.sh restart

# Остановка
./manage.sh stop

# Запуск
./manage.sh start

# Обновление
./manage.sh update

# Мониторинг
./manage.sh monitor
```

### Ручные команды Docker

```bash
cd ~/apps/emlak

# Статус контейнеров
docker-compose ps

# Логи
docker-compose logs bot
docker-compose logs parser
docker-compose logs postgres

# Перезапуск
docker-compose restart

# Остановка
docker-compose down

# Запуск
docker-compose up -d

# Пересборка
docker-compose up --build -d
```

## 🔍 Мониторинг

### Проверка работы

```bash
# Статус всех контейнеров
docker-compose ps

# Логи в реальном времени
docker-compose logs -f

# Использование ресурсов
docker stats
```

### Проверка парсера

```bash
# Логи парсера
docker-compose logs parser

# Принудительный запуск парсера
docker-compose exec parser node parser/index.js run hepsiemlak --test
```

### Проверка базы данных

```bash
# Подключение к PostgreSQL
docker-compose exec postgres psql -U emlak -d emlak

# Проверка таблиц
\dt

# Количество записей
SELECT COUNT(*) FROM listings;
```

## 🔧 Настройка

### Переменные окружения (.env)

```env
# База данных
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=emlak
POSTGRES_USER=emlak
POSTGRES_PASSWORD=your_secure_password

# Telegram бот
BOT_TOKEN=your_bot_token_here

# Расписание парсеров (cron формат)
HEPSIEMLAK_SCHEDULE=0 10,16,22 * * *
EMLAKJET_SCHEDULE=15 10,16,22 * * *
```

### Настройка расписания

Парсеры работают по расписанию:
- HepsEmlak: 10:00, 16:00, 22:00
- EmlakJet: 10:15, 16:15, 22:15

Для изменения отредактируйте `.env` файл и перезапустите контейнеры.

## 🛡️ Безопасность

### Firewall

```bash
# Проверка правил
sudo ufw status

# Разрешить порт (если нужно)
sudo ufw allow 8080/tcp
```

### Резервные копии

```bash
# Создание резервной копии
./manage.sh backup

# Или вручную
docker-compose exec postgres pg_dump -U emlak emlak > backup.sql
```

## 🔨 Устранение неполадок

### Проблемы с Docker

```bash
# Проверка статуса Docker
sudo systemctl status docker

# Перезапуск Docker
sudo systemctl restart docker

# Проверка групп пользователя
groups $USER
```

### Проблемы с контейнерами

```bash
# Удаление и пересборка
docker-compose down --volumes
docker-compose up --build -d

# Очистка Docker
docker system prune -f
docker volume prune -f
```

### Проблемы с парсером

```bash
# Проверка логов
docker-compose logs parser

# Тестовый запуск
docker-compose exec parser node parser/index.js run hepsiemlak --test

# Проверка браузера
docker-compose exec parser chromium-browser --version
```

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи: `docker-compose logs`
2. Проверьте статус: `docker-compose ps`
3. Перезапустите: `docker-compose restart`
4. Пересоберите: `docker-compose up --build -d`

---

💡 **Совет**: Используйте скрипт `manage.sh` для удобного управления проектом! 