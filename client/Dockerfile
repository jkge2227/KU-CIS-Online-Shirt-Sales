# client/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Vite ปกติรัน port 5173
EXPOSE 5173

# รัน Vite dev server แบบให้ container ฟัง 0.0.0.0 เพื่อออกไปข้างนอกได้
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
