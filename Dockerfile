# StudyFlow — single container: build the PWA, run the Node server.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Server mode: login gate + sync + push; served from the domain root.
ENV VITE_SERVER=1
ENV STUDYFLOW_BASE=/
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev
COPY server ./server
COPY --from=build /app/dist ./dist

ENV DIST_DIR=/app/dist
ENV DATA_DIR=/data
ENV PORT=3000
EXPOSE 3000
VOLUME /data
CMD ["node", "server/src/index.js"]
