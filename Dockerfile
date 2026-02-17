FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY tsconfig*.json ./

RUN pnpm install --prod --frozen-lockfile

COPY /dist ./dist
COPY .env ./

EXPOSE 3000

CMD ["node", "dist/main"]
