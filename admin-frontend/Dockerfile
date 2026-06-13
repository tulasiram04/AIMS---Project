# Build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Set API URL for production build
ENV VITE_API_URL=/api/v1

RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["/bin/sh", "-c", "export RESOLVER_IP=$(grep nameserver /etc/resolv.conf | head -n1 | awk '{print $2}') && envsubst '$BACKEND_HOST $RESOLVER_IP' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
