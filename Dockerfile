FROM --platform=$BUILDPLATFORM node:25.4-alpine AS build

WORKDIR /app

# Copy dependency files first to leverage Docker cache
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the Vite application
RUN npm run build

# Use Nginx to serve the built files
FROM nginx:alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
