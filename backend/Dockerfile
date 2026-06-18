FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY backend/prisma ./backend/prisma

RUN npm ci \
    && npm install --no-save @img/sharp-linuxmusl-x64 -w backend \
    && npm run postinstall -w backend

WORKDIR /app/backend

EXPOSE 3000

CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && npx prisma db seed && npm run dev"]
