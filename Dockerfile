FROM node:18.12.1-alpine3.15 AS builder
WORKDIR /opt/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.23.1-alpine AS runner
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /opt/app/dist /usr/share/nginx/html
