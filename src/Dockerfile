FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 5173

# Chạy bằng preview cho production-like test
CMD ["npm", "run", "dev"]