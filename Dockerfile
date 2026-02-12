FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY tsconfig*.json ./

RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY .env ./

EXPOSE 3000

CMD ["node", "dist/main"]
