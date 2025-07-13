FROM node:18-alpine

# Создание рабочей директории
WORKDIR /app

# Копирование package.json и yarn.lock из корня проекта
COPY package.json yarn.lock ./

# Установка зависимостей для корневого проекта (пропускаем Puppeteer)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN yarn install --frozen-lockfile

# Копирование package.json и yarn.lock из директории бота
COPY bot/package.json bot/yarn.lock ./bot/

# Установка зависимостей для бота
WORKDIR /app/bot
RUN yarn install --frozen-lockfile

# Возвращаемся в корень
WORKDIR /app

# Копирование файлов в правильную структуру
COPY config.js ./
COPY database/ ./database/

# Копирование исходников бота (исключаем node_modules)
COPY bot/index.js ./bot/
COPY bot/scenes/ ./bot/scenes/
COPY bot/utils/ ./bot/utils/
COPY bot/locales/ ./bot/locales/
COPY bot/services/ ./bot/services/

# Переходим в директорию бота для запуска
WORKDIR /app/bot

# Переключение на непривилегированного пользователя
USER node

# Запуск бота
CMD ["yarn", "start"] 