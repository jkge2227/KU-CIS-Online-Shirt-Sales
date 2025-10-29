// server/server.js
require('dotenv').config();

const express = require('express');
const app = express();
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const { readdirSync } = require('fs');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');

// ✅ ตรวจให้ตรงไฟล์จริง ๆ (ตัวอย่าง: './controllers/user' หรือ './controllers/adminOrders')
const { cancelExpiredOrdersJob } = require('./controllers/user');

// --- base middlewares ---
app.set('trust proxy', 1);
app.use(morgan('dev'));
app.use(express.json({ limit: '20mb' }));
app.use(
    cors({
        origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
        credentials: false, // true ถ้าใช้ cookie
    })
);

// --- OTP rate limit: 3 ครั้ง/นาที/ไอพี ---
const otpLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/auth/otp', otpLimiter);

// --- Mount routes (path-safe) ---
const routesDir = path.join(__dirname, 'routes');
readdirSync(routesDir).forEach((file) => {
    // รองรับเฉพาะ .js
    if (!file.endsWith('.js')) return;
    app.use('/api', require(path.join(routesDir, file)));
});

// --- Health check ---
app.get('/healthz', (req, res) => res.json({ ok: true }));

// --- Auto-cancel orders ทุกเที่ยงคืน (Asia/Bangkok) ---
cron.schedule(
    '0 0 * * *',
    async () => {
        try {
            const { cancelled, checked, cutoff } = await cancelExpiredOrdersJob(3); // 3 วัน
            console.log(
                `[AutoCancel] cutoff=${cutoff?.toISOString?.() ?? cutoff} checked=${checked} cancelled=${cancelled}`
            );
        } catch (e) {
            console.error('[AutoCancel] error:', e);
        }
    },
    { timezone: 'Asia/Bangkok' }
);

// --- 404 & error handler ---
app.use((req, res) => res.status(404).json({ message: 'Not Found' }));
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ message: err.message || 'Server Error' });
});

// --- Start server ---
const port = Number(process.env.PORT || 5002);
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
