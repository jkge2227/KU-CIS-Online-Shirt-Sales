// step import ....
require('dotenv').config()

const express = require('express')
const app = express()
const morgan = require('morgan')
const { readdirSync } = require('fs')
const cors = require('cors')

// const authRoutes = require('./routes/auth')
// const categoryRoutes = require('./routes/category')

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const cron = require('node-cron')
const { cancelExpiredOrdersJob } = require('../Server/controllers/product')

// middleware
app.use(morgan('dev'))
app.use(express.json({ limit: '20mb' }))
app.use(cors())

// app.use('/api', authRoutes)
// app.use('/api', categoryRoutes)

readdirSync('./routes')
    .map((c) => app.use('/api', require('./routes/' + c)))


cron.schedule('0 0 * * *', async () => {
    try {
        const { cancelled, checked, cutoff } = await cancelExpiredOrdersJob(3); // ✅ 3 วัน
        console.log(`[AutoCancel] cutoff=${cutoff.toISOString()} checked=${checked} cancelled=${cancelled}`);
    } catch (e) {
        console.error('[AutoCancel] error:', e);
    }
}, { timezone: 'Asia/Bangkok' });

// step 2 start the server

app.listen(5001, () => {
    console.log('Server is running on port 5001')
})


