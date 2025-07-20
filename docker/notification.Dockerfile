FROM node:18-alpine

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Копируем файлы проекта
COPY config.js ./
COPY database/ ./database/
COPY notification-service.js ./

# Запускаем сервис уведомлений
CMD ["node", "notification-service.js"] 