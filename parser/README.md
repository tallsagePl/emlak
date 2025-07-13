# 🏠 Система парсинга недвижимости

Продакшн система для автоматического парсинга объявлений недвижимости с турецких сайтов.

## 🚀 Возможности

- **Многосайтовый парсинг**: HepsEmlak.com и EmlakJet.com
- **Два режима работы**: тестовый (JSON файлы) и продакшн (PostgreSQL)
- **Умная синхронизация**: автоматическое обновление и удаление устаревших данных
- **Автоматический планировщик**: запуск по расписанию
- **Обход защиты**: автоматический обход Cloudflare
- **Полное извлечение данных**: все характеристики объявлений
- **Переводы**: автоматический перевод с турецкого на русский
- **Детальная статистика**: отслеживание изменений в реальном времени

## 📋 Поддерживаемые сайты

- ✅ **HepsEmlak.com** - полностью реализован (API карты + детали)
- ✅ **EmlakJet.com** - полностью реализован (список + детали)

## 🎯 Два режима запуска

### 🧪 1. Тестовый режим (JSON файлы)

**Для быстрого тестирования и разработки:**

```bash
# HepsEmlak парсер (3 объявления)
node test-parser.js hepsiemlak 3

# EmlakJet парсер (5 объявлений)  
node test-parser.js emlakjet 5

# По умолчанию запускается hepsiemlak с 3 объявлениями
node test-parser.js
```

**Результаты сохраняются в:** `output/парсер_дата.json`

### 🚀 2. Продакшн режим (База данных)

**Для постоянной работы с сохранением в PostgreSQL:**

```bash
# Одиночный запуск с тестом
node index.js run hepsiemlak --test
node index.js run emlakjet --test

# Полный запуск
node index.js run hepsiemlak
node index.js run-all

# Продакшн планировщик (автоматические запуски)
node index.js production
```

**Результаты сохраняются в:** PostgreSQL таблицу `parsed_listings`

## 🧠 Умная синхронизация

### Как работает:
1. **Проверка дубликатов** по URL и listing_id
2. **Добавление новых** объявлений
3. **Обновление существующих** при изменении данных
4. **Удаление устаревших** записей (которых нет на сайте)

### Что отслеживается:
- **Изменение цены** 
- **Обновление характеристик** (площадь, комнаты, этаж)
- **Добавление/удаление изображений**
- **Изменение статуса** (меблировка, доступность)

### Статистика синхронизации:
```bash
# Детальная статистика по всем парсерам
docker-compose exec parser node index.js stats

# Показывает:
# ➕ Добавлено объявлений за 24 часа  
# 🔄 Обновлено объявлений за 24 часа
# ➖ Удалено устаревших объявлений
# 📋 Недавние изменения с деталями
```

## 🐳 Docker запуск (рекомендуется)

### Тестовый запуск
```bash
# Запуск всех контейнеров
docker-compose up -d

# Тест HepsEmlak
docker-compose exec parser node test-parser.js hepsiemlak 3

# Тест EmlakJet  
docker-compose exec parser node test-parser.js emlakjet 3

# Продакшн тест
docker-compose exec parser node index.js run hepsiemlak --test
```

### Постоянная работа
```bash
# Запуск всех сервисов (бот + парсер + БД)
docker-compose up -d

# Просмотр логов
docker-compose logs -f parser

# Принудительный запуск вне расписания
docker-compose exec parser node index.js production-force hepsiemlak
```

## 📊 Извлекаемые поля

### Общие поля (оба парсера)
- **Название** объявления
- **Источник** (URL страницы)  
- **Цена** (число)
- **Провинция** / местоположение
- **Номер объявления**
- **Дата объявления**
- **Тип недвижимости** (Квартира, Вилла, etc)

### Характеристики помещения
- **м² (брутто)** / **м² (нетто)**
- **Количество комнат** (2+1, 3+1, etc)
- **Количество ванных**
- **Расположен на** (этаж)
- **Количество этажей** в здании
- **Здание возраст** 
- **Отопление** (тип)
- **Меблировано** (да/нет/частично)

### Дополнительная информация  
- **Статус использования** (пуст/занят/собственник)
- **Ситэ** (в комплексе да/нет)
- **Айдат** (коммунальные платежи)
- **Право на кредит**
- **Статус Титула** (документы)
- **Обмен** (возможен/нет)
- **Изображения** (массив URL)

## 🗄️ Структура результатов

### JSON файлы (тестовый режим)
```json
{
  "specifications": {
    "Название": "Продаётся квартира 2+1",
    "Цена": 8300000,
    "Провинция": "Antalya Konyaaltı", 
    "м² (нетто)": 90,
    "Количество комнат": "2 + 1"
  },
  "table": {
    "İlan no": "94451-2608",
    "Konut Tipi": "Daire",
    "Oda Sayısı": "2 + 1"
  },
  "images": ["https://..."],
  "success": true,
  "url": "https://..."
}
```

### База данных (продакшн)
**Таблица:** `parsed_listings`
```sql
id, site_name, data (JSONB), url, created_at
```

## 🛠️ Структура проекта

```
parser/
├── index.js                 # Продакшн CLI (сохранение в БД)
├── test-parser.js           # Тестовый скрипт (сохранение в JSON)
├── parsers/
│   ├── hepsiemlak-parser.js # Парсер HepsEmlak.com
│   ├── emlakjet-parser.js   # Парсер EmlakJet.com
│   └── index.js            # Экспорт парсеров
├── utils/
│   ├── functions.js        # Общие функции
│   ├── browser.js          # Управление браузером
│   ├── CONSTANTS.js        # Константы и селекторы
│   └── index.js           # Экспорт утилит
├── adapters/
│   └── database.js        # Работа с PostgreSQL
├── scheduler/
│   └── index.js          # Планировщик запусков
├── scripts/
│   └── start-production.js # Продакшн запуск
└── config/
    ├── index.js           # Общий конфиг
    └── portals.js         # Настройки сайтов
```

## ⚙️ Конфигурация

### Расписание (config.js)
```javascript
schedule: {
  hepsiemlak: '0 */4 * * *',  // Каждые 4 часа
  emlakjet: '0 */6 * * *'     // Каждые 6 часов  
}
```

### PostgreSQL подключение
```javascript
database: {
  host: 'postgres',
  user: 'emlak_user', 
  password: 'emlak_password',
  database: 'emlak_db'
}
```

## 📈 Мониторинг

### Статистика
```bash
# Общая статистика
docker-compose exec parser node index.js stats

# Просмотр данных в БД
docker-compose exec postgres psql -U emlak_user -d emlak_db -c "SELECT COUNT(*) FROM parsed_listings;"
```

### Логи
```bash
# Все логи
docker-compose logs -f

# Только парсер
docker-compose logs -f parser

# Поиск ошибок
docker-compose logs parser | grep "❌\|ERROR"
```

## 🎯 Рекомендуемый workflow

### 1. Тестирование
```bash
# Локальный тест (JSON файлы)
node test-parser.js hepsiemlak 3
node test-parser.js emlakjet 3

# Проверяем файлы в output/
ls -la output/
```

### 2. Продакшн тест
```bash
# Запуск контейнеров
docker-compose up -d

# Тест с сохранением в БД
docker-compose exec parser node index.js run hepsiemlak --test
```

### 3. Постоянная работа
```bash
# Планировщик работает автоматически
docker-compose logs -f parser

# При необходимости принудительный запуск
docker-compose exec parser node index.js production-force emlakjet
``` 