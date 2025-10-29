# How to run Docker

1. ติดตั้ง Docker Desktop
2. เปลี่ยน server/.env.example2 เป็น server/.env.docker แล้วใส่ค่าของคุณเอง
   และ server/.env.example1 เป็น server/.env แล้วใส่ค่าของคุณเอง และ
   db.env.docker  เป็น db.env แล้วใส่ค่าของคุณเอง
3. รัน:
   docker compose up -d --build
4. สร้างตาราง DB:
   docker compose exec backend sh
   npx prisma migrate dev --name init
   exit
5. เปิดเว็บ:
   Frontend: http://localhost:5173
   Backend health: http://localhost:5002/healthz


# How to run in your machine : db MySQL workbench และ phpmyadmin

1. เปลี่ยน server/.env.example1 เป็น server/.env แล้วใส่ค่าของคุณเอง
2. D:\Ecommerce2-test\client
3.  รัน npm install และ รัน npm run dev 
4. D:\Ecommerce2-test\Server
5.  รัน npm install และ # ถ้ามี db แล้วไม่ต้องรัน npx prisma migrate dev --name ecom    
6.  รัน npm start
