# ──────────────────────────────────────────────────────────────
# Polarity Slack Bot – Docker image (Node 24)
# ──────────────────────────────────────────────────────────────
# Uses ts-node via the existing “npm start” script.
# Pass your env-vars with:  docker run --env-file .env polarity-bot
# ──────────────────────────────────────────────────────────────
FROM node:24-alpine
WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json package-lock.json ./
RUN npm ci --omit=optional

# Copy source code
COPY . .

# Start the bot
CMD ["npm", "start"]
