# How to run

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
