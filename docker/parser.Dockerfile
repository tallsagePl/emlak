FROM node:18-alpine

# Установка зависимостей для Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    nodejs \
    yarn

# Настройка переменных окружения для Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Создание рабочей директории
WORKDIR /app

# Копирование package.json и yarn.lock из корня проекта
COPY package.json yarn.lock ./

# Установка корневых зависимостей
RUN yarn install --frozen-lockfile

# Копирование package.json из парсера
COPY parser/package.json ./parser/

# Установка зависимостей для парсера
WORKDIR /app/parser
RUN yarn install --frozen-lockfile

# Возвращаемся в корень
WORKDIR /app

# Копирование остальных файлов
COPY config.js ./
COPY database/ ./database/
COPY parser/ ./parser/

# Создание директории для данных
RUN mkdir -p /app/data && chown -R node:node /app/data

# Переключение на непривилегированного пользователя
USER node

# Запуск парсера в продакшн режиме с командой production
CMD ["node", "parser/scripts/start-production.js", "production"] 