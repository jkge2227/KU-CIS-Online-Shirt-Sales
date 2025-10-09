const jwt = require('jsonwebtoken')
const prisma = require('../config/prisma')

exports.authCheck = async (req, res, next) => {
    try {

        const handerToken = req.headers.authorization
        if (!handerToken) {
            return res.status(400).json({ message: " No token , Authorization" })
        }
        const token = handerToken.split(" ")[1]
        const decode = jwt.verify(token, process.env.SECRET)
        req.user = decode

        const user = await prisma.users.findFirst({
            where: {
                email: req.user.email
            }
        })
        if (!user.enabled) {
            return res.status(400).json({ message: "this account cannot access" })
        }

        next()
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: "token invalid" })
    }
}

exports.adminCheck = async (req, res, next) => {
    try {
        const { email } = req.user
        const amdinUser = await prisma.users.findFirst({
            where: { email: email }
        })
        if (!amdinUser || amdinUser.role !== 'admin') {
            return res.status(400).json({ message: 'Acess Denied: Admin Only' })
        }

        // console.log('admin Check', amdinUser)
        next()
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: "Error Admin access denid " })
    }
}