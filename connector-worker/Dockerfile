# Playwright base image ships Chromium + all system libs.
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev || npm install
COPY . .

ENV PORT=8787
EXPOSE 8787

# tsx runs the TypeScript server directly.
CMD ["npm", "run", "start"]
