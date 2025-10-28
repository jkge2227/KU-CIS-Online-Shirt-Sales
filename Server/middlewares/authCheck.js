// Server/middlewares/authCheck.js
const jwt = require('jsonwebtoken')
const prisma = require('../config/prisma')

exports.authCheck = async (req, res, next) => {
    try {
        const header = req.headers.authorization || ''
        if (!header.toLowerCase().startsWith('bearer ')) {
            return res.status(401).json({ message: 'Unauthorized' })
        }
        const token = header.split(' ')[1]
        const payload = jwt.verify(token, process.env.SECRET)

        // แนะนำให้มี id ใน payload จะชัวร์กว่า email
        const user = await prisma.users.findFirst({
            where: { email: payload.email },
            select: { id: true, email: true, role: true, enabled: true }
        })
        if (!user) return res.status(401).json({ message: 'Unauthorized' })

        // ❌ อย่าบล็อกตรงนี้
        // if (!user.enabled) { return res.status(403).json({ message: 'this account cannot access' }) }

        req.user = user
        next()
    } catch (err) {
        console.log(err)
        res.status(401).json({ message: 'token invalid' })
    }
}

exports.adminCheck = async (req, res, next) => {
    try {
        // ใช้ข้อมูลจาก req.user ที่ authCheck เติมไว้แล้ว
        if (!req.user || String(req.user.role).toLowerCase() !== 'admin') {
            return res.status(403).json({ message: 'Access Denied: Admin Only' })
        }
        next()
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Error Admin access denied' })
    }
}
