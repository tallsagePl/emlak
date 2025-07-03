# 🏠 Система парсинга недвижимости

Продакшн система для автоматического парсинга объявлений недвижимости с нескольких сайтов.

## 🚀 Возможности

- **Многосайтовый парсинг**: поддержка нескольких сайтов недвижимости
- **Продакшн планировщик**: автоматический запуск каждые 4 часа
- **PostgreSQL интеграция**: сохранение данных и отслеживание обработанных URL
- **Дедупликация**: пропуск уже обработанных объявлений
- **Обход Cloudflare**: автоматический обход защиты
- **Детальное извлечение**: все характеристики объявлений

## 📋 Поддерживаемые сайты

- ✅ **HepsEmlak.com** - полностью реализован
- 🔄 **Sahibinden.com** - в разработке
- 🔄 **HurriyetEmlak.com** - в разработке  
- 🔄 **Zingate.com** - в разработке

## 🔧 Установка

```bash
# Установка зависимостей
yarn install

# Настройка PostgreSQL (опционально)
cp db-config.example.js db-config.js
# Отредактируйте db-config.js с реальными данными БД
```

## 📊 Извлекаемые поля

### Основные поля
- **Источник** (URL страницы)
- **Цена** 
- **Провинция** 
- **Номер объявления**
- **Дата объявления**
- **Тип недвижимости**
- **Тип жилья**
- **Форма жилья**

### Характеристики
- **Количество комнат**
- **Количество ванных**
- **м² (брутто)** / **м² (нетто)**
- **Здание возраст**
- **Тип здания**
- **Стороны света**
- **Расположение** (этаж)
- **Количество этажей**
- **Отопление**
- **Меблировано**
- **Статус**
- **Айдат**
- **Право на кредит**
- **Обмен**

### Контактная информация
- **Телефон**
- **Имя агента**

## 🎯 Команды

### Список парсеров
```bash
yarn start          # Показать список парсеров
yarn list           # То же самое
```

### Разработка и тестирование
```bash
yarn parse:test     # Тестовый режим (3 объявления)
yarn parse          # Полный режим для hepsiemlak
yarn parse:all-test # Все парсеры в тестовом режиме
yarn parse:all      # Все парсеры полностью
```

### Продакшн система
```bash
# Запуск планировщика (каждые 4 часа)
yarn production

# Тестовый запуск планировщика
yarn production:test

# Принудительный запуск конкретного парсера
yarn production:force

# Статистика по парсерам
yarn stats
```

### CLI команды
```bash
# Запуск конкретного парсера
node index.js run hepsiemlak --test
node index.js run hepsiemlak --limit 10

# Продакшн режим
node index.js production
node index.js production --test-run
node index.js production-force hepsiemlak

# Статистика
node index.js stats
```

## 🗄️ Структура базы данных

### Таблица `complete`
Отслеживание обработанных URL по сайтам:
```sql
id SERIAL PRIMARY KEY
site_name VARCHAR(50) NOT NULL
processed_urls TEXT[]
created_at TIMESTAMP
updated_at TIMESTAMP
```

### Таблица `messages`  
Хранение спаршенных данных:
```sql
id SERIAL PRIMARY KEY
site_name VARCHAR(50) NOT NULL
listing_id VARCHAR(100)
url TEXT NOT NULL
data JSONB NOT NULL
parsed_at TIMESTAMP
```

## 📋 Конфигурация PostgreSQL

1. **Создайте базу данных:**
```sql
CREATE DATABASE emlak_parser;
```

2. **Настройте подключение:**
```javascript
// db-config.js
export default {
  host: 'localhost',
  port: 5432,
  database: 'emlak_parser',
  user: 'postgres',
  password: 'your_password'
};
```

3. **Запустите с конфигурацией:**
```bash
node index.js production --config ./db-config.js
```

## 🔄 Продакшн планировщик

### Расписание запусков
- **00:00, 04:00, 08:00, 12:00, 16:00, 20:00** - каждые 4 часа
- **Автоматическая фильтрация** уже обработанных URL
- **Graceful shutdown** на SIGINT/SIGTERM
- **Статистика** каждые 30 минут

### Логика работы
1. Получение объявлений с карты (API)
2. Фильтрация по уже обработанным URL
3. Детальный парсинг новых объявлений
4. Сохранение в PostgreSQL
5. Обновление списка обработанных URL

## 📈 Мониторинг

### Просмотр статистики
```bash
yarn stats
```

Показывает:
- Количество обработанных записей
- Количество обработанных URL
- Время последнего парсинга
- Время последнего обновления

### Логи продакшн системы
- ✅ Успешные парсинги
- ❌ Ошибки с детализацией
- 📊 Статистика по каждому запуску
- ⏰ Время выполнения

## 🛠️ Структура проекта

```
parser/
├── index.js                   # Главный CLI интерфейс
├── hepsiemlak-parser.js       # Парсер HepsEmlak.com
├── production-scheduler.js    # Продакшн планировщик
├── database.js               # Работа с PostgreSQL
├── db-config.example.js      # Пример конфигурации БД
└── package.json             # Зависимости и скрипты
```

## 🔒 Безопасность

- **Обход детекции ботов**: puppeteer-real-browser
- **Cloudflare bypass**: автоматическое ожидание
- **Rate limiting**: паузы между запросами
- **User-Agent rotation**: случайные заголовки
- **Headless режим**: для продакшн сервера

## 📝 Формат результатов

```json
{
  "specifications": {
    "Источник": "https://...",
    "Цена": "5.790.000 TL",
    "Провинция": "Antalya Konyaaltı",
    "м² (брутто)": "108 m2",
    "м² (нетто)": "102 m2",
    // ... остальные переведенные поля
  },
  "table": {
    "İlan no": "139083-103",
    "Brüt / Net M2": "108 m2/ 102 m2",
    // ... оригинальные турецкие поля
  },
  "contact": {
    "phone": "0552 417 85 74"
  },
  "success": true,
  "parsedAt": "2025-06-30T22:58:14.243Z",
  "url": "https://...",
  "mapLocation": { "lat": 36.85, "lon": 30.59 },
  "priceFromAPI": 5790000,
  "realtyId": 44844933,
  "listingId": "139083-103",
  "images": ["https://..."]
}
```

## 🚀 Развертывание

### Для сервера
```bash
# 1. Клонирование
git clone <repository>
cd parser

# 2. Установка
yarn install

# 3. Настройка БД
cp db-config.example.js db-config.js
# Отредактируйте конфигурацию

# 4. Запуск
yarn production --config ./db-config.js
```

### Systemd сервис (Linux)
```ini
[Unit]
Description=Emlak Parser Production
After=network.target

[Service]
Type=simple
User=parser
WorkingDirectory=/path/to/parser
ExecStart=/usr/bin/node index.js production --config ./db-config.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## 🐛 Отладка

### Режим отладки
```bash
# Тестовый запуск с подробным выводом
yarn parse:test --verbose

# Проверка планировщика
yarn production:test
```

### Логи ошибок
- Файлы `hepsiemlak-errors-*.json` - детальные ошибки
- Консольный вывод с цветной индикацией
- PostgreSQL логи подключения

## 🔧 Добавление новых парсеров

1. **Создайте файл парсера** (например `sahibinden-parser.js`)
2. **Реализуйте функцию** `runSahibinden(testLimit, processedUrls)`
3. **Добавьте в index.js:**
```javascript
import { runSahibinden } from './sahibinden-parser.js';

const PARSERS = {
  // ...существующие
  sahibinden: {
    name: 'Sahibinden.com',
    runner: runSahibinden,
    description: 'Парсер для сайта sahibinden.com'
  }
};
```

4. **Добавьте в планировщик** (`production-scheduler.js`)

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи консоли
2. Убедитесь что PostgreSQL доступен
3. Проверьте интернет соединение
4. Попробуйте тестовый режим: `yarn parse:test`

---

**Система готова к продакшн использованию!** 🎉 