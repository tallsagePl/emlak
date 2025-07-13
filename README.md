# Emlak - Комплексная система недвижимости

Полнофункциональная система для работы с недвижимостью, включающая:
- **Telegram бот** для пользовательских объявлений  
- **Автоматические парсеры** сайтов недвижимости
- **Универсальную базу данных** PostgreSQL
- **Продакшн планировщик** с автоматическим парсингом каждые 4 часа

## Структура проекта

```
emlak/
├── bot/                   # Telegram бот для недвижимости
│   ├── index.js          # Основной файл бота
│   ├── db.js             # Адаптер БД для бота  
│   ├── locales/          # Переводы (ru/en/tr)
│   └── package.json      # Зависимости бота
├── parser/               # Парсеры сайтов недвижимости
│   ├── index.js          # CLI интерфейс парсеров
│   ├── hepsiemlak-parser.js     # Парсер HepsEmlak.com
│   ├── production-scheduler.js  # Продакшн планировщик
│   ├── database.js              # Адаптер БД для парсера
│   └── package.json            # Зависимости парсера
├── database/             # 🆕 Универсальная база данных
│   ├── index.js          # Основной модуль БД
│   ├── schema.sql        # Полная схема базы данных
│   └── package.json      # Зависимости модуля БД
├── config.js             # Общая конфигурация проекта
├── docker-compose.yml    # Docker конфигурация PostgreSQL
├── start.sh              # Скрипт запуска БД
└── README.md             # Этот файл
```

## 🚀 Быстрый старт

### 1. Установка и запуск базы данных
```bash
# Запустить PostgreSQL через Docker
./start.sh

# Или вручную
docker-compose up -d
```

### 2. Настройка конфигурации
Отредактируйте `config.js`:
```javascript
const config = {
  database: {
    url: 'postgresql://postgres:111@localhost:5432/emlak'
  },
  bot: {
    token: 'YOUR_TELEGRAM_BOT_TOKEN'
  }
};
```

### 3. Запуск бота
```bash
cd bot
npm install
npm start
```

### 4. Запуск парсера
```bash
cd parser
npm install

# Тестовый режим (3 объявления)
npm run parse:test

# Полный режим
npm run parse

# Продакшн планировщик (каждые 4 часа)
npm run production
```

## 🗄️ Универсальная база данных

Новая модульная система БД поддерживает:
- **Пользовательские объявления** (от бота)
- **Спаршенные данные** (от парсеров) 
- **Дедупликацию URL** (избежание повторного парсинга)
- **Логирование активности** парсеров
- **Поиск и фильтрацию** объявлений

### Основные таблицы

#### `user_listings` - Пользовательские объявления
- Создаются через Telegram бота
- Статусы: live/freeze/dead
- Поддержка геолокации и фотографий

#### `parsed_listings` - Спаршенные объявления  
- Данные с сайтов недвижимости в JSONB формате
- Координаты для поиска по карте
- Извлеченные числовые цены для сортировки

#### `parser_processed` - Отслеживание обработанных URL
- Массивы обработанных URL по каждому сайту
- Предотвращение повторного парсинга
- Статистика обработки

#### `parser_logs` - Логи активности
- Успехи/ошибки парсинга
- Детали операций в JSONB

### API базы данных

```javascript
const db = require('./database');

// Пользовательские объявления
await db.createUserListing(data);
await db.getUserListings(owner_id);
await db.updateUserListingStatus(id, status);

// Парсер данные  
await db.getProcessedUrls(siteName);
await db.addProcessedUrls(siteName, urls);
await db.saveParsedListing(data);

// Статистика
await db.getParserStats();
await db.getListingsStats();

// Поиск
await db.searchListings({
  site_name: 'hepsiemlak',
  min_price: 1000000,
  max_price: 5000000,
  rooms: '2+1',
  location: 'Antalya'
});
```

## 🤖 Парсер и планировщик

### CLI команды
```bash
# Список всех парсеров
node index.js list

# Запуск конкретного парсера
node index.js run hepsiemlak --test

# Продакшн планировщик  
node index.js production

# Принудительный запуск
node index.js production-force hepsiemlak

# Статистика БД
node index.js stats
```

### Yarn скрипты
```bash
yarn parse:test           # Тестовый режим (3 объявления)
yarn parse               # Полный режим hepsiemlak  
yarn parse:all-test      # Все парсеры тестово
yarn production          # Запуск планировщика
yarn production:test     # Тестовый запуск планировщика
yarn production:force    # Принудительный запуск
yarn stats              # Статистика парсеров
```

### Продакшн планировщик
- ⏰ **Автозапуск каждые 4 часа**: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00
- 🔄 **Дедупликация**: исключает уже обработанные URL
- 📊 **Мониторинг**: статистика каждые 30 минут
- 🛡️ **Graceful shutdown** при SIGINT/SIGTERM
- 📝 **Полное логирование** успехов и ошибок

## 🌐 Поддерживаемые сайты

### Готовые парсеры
- ✅ **HepsEmlak.com** - полная интеграция с API карты

### В разработке  
- 🔄 **Sahibinden.com**
- 🔄 **Hurriyet.com.tr** 
- 🔄 **Zingate.com**

### Извлекаемые данные
- 📍 **Геолокация** (широта/долгота)
- 💰 **Цены** (числовые и текстовые)
- 🏠 **Характеристики** (площадь, комнаты, этаж)
- 📸 **Изображения** (массив URL)
- 📞 **Контакты** (телефоны)
- 🔗 **Метаданные** (ID объявления, дата парсинга)

## 📊 Мониторинг и статистика

### Статистика парсеров
```bash
yarn stats
```
Показывает:
- Количество обработанных URL по сайтам
- Время последнего парсинга  
- Общее количество сохраненных объявлений
- Средние цены по сайтам

### Логи активности
- 🟢 **SUCCESS**: успешный парсинг
- 🔴 **ERROR**: ошибки парсинга  
- 🔵 **INFO**: информационные сообщения

## 🛠️ Разработка

### Добавление нового парсера

1. **Создайте парсер** в `parser/`
```javascript
class NewSiteParser {
  async run(processedUrls = []) {
    // Логика парсинга
  }
}
```

2. **Добавьте в index.js**
```javascript
const PARSERS = {
  newsite: {
    name: 'NewSite.com',
    class: NewSiteParser,
    schedule: '0 */6 * * *' // каждые 6 часов
  }
};
```

3. **Обновите базу данных**
```sql
INSERT INTO parser_processed (site_name) VALUES ('newsite');
```

### Расширение API базы данных

Добавьте новые методы в `database/index.js`:
```javascript
async customQuery(filters) {
  // Ваша логика
}
```

## 🐳 Docker развертывание

### Локальная разработка
```bash
# Запуск только БД
docker-compose up -d

# Запуск с пересозданием
docker-compose up -d --force-recreate
```

### Продакшн развертывание
```bash
# Обновление схемы БД
docker-compose down
docker-compose up -d

# Запуск парсера в фоне
cd parser && npm run production &

# Запуск бота в фоне  
cd bot && npm start &
```

## 🔧 Конфигурация

### Переменные окружения
```bash
# База данных
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=emlak
POSTGRES_USER=emlak
POSTGRES_PASSWORD=emlak123
BOT_TOKEN=your_telegram_token
```