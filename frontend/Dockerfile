FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm ci --ignore-scripts \
    && npm install --no-save @rollup/rollup-linux-x64-musl @esbuild/linux-x64 -w frontend

WORKDIR /app/frontend

EXPOSE 4200

CMD ["npm", "run", "dev:docker"]
