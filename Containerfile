# ─── Stage 1: build TypeScript ───────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /build
COPY package.json tsconfig.json ./
RUN npm install
COPY src/ ./src/
RUN npm run build


# ─── Stage 2: immagine finale Alpine (minimale) ───────────────────────────────
FROM node:20-alpine AS runner

# Dipendenze Chromium su Alpine + tzdata per il timezone
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      font-noto-emoji \
      tzdata

# Timezone italiano (fondamentale per il cron alle 7:30 CEST)
RUN cp /usr/share/zoneinfo/Europe/Rome /etc/localtime && \
    echo "Europe/Rome" > /etc/timezone

# Playwright: usa il chromium di sistema invece di scaricare il proprio binario
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
# Necessario su Alpine per Chromium headless in container
ENV CHROME_FLAGS="--no-sandbox --disable-dev-shm-usage --disable-gpu"
# Variabile standard POSIX per il timezone (letta da Node.js e dal sistema)
ENV TZ=Europe/Rome

WORKDIR /

# Installa solo le dipendenze di produzione (playwright runtime)
COPY package.json ./
COPY .env* ./
RUN npm install --omit=dev

# Copia il JS compilato dallo stage builder
COPY --from=builder /build/dist ./dist

# cookies.json: montato come volume dall'host, non incluso nell'immagine
# VOLUME ["cookies.json"]

CMD ["node", "dist/index.js"]