# server/Dockerfile
FROM node:20-alpine

WORKDIR /app

# ติดตั้ง dependency ก่อน
COPY package.json package-lock.json* ./
RUN npm install

# คัดลอก source code ทั้งหมดเข้า container
COPY . .

# generate Prisma client (ต้องมี prisma/schema.prisma ในโปรเจค)
RUN npx prisma generate

# เปิดพอร์ต backend
EXPOSE 5001

# รัน backend ด้วย nodemon server.js
CMD ["npm", "start"]
