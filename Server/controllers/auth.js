const router = require("../routes/auth")
const prisma = require('../config/prisma')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { token } = require("morgan")

exports.register = async (req, res) => {

    // code
    try {
        const { first_name, last_name, email, password, phone, id_card } = req.body
        // Step 1 validate body

        if (!first_name) {
            return res.status(400).json({ message: 'ใส่ ชื่อ' })
        }
        if (!last_name) {
            return res.status(400).json({ message: 'ใส่ นามสกุล' })
        }
        if (!email) {
            return res.status(400).json({ message: 'ใส่ Email ' })
        }
        if (!password) {
            return res.status(400).json({ message: 'ใส่รหัสผ่าน' })
        }
        if (!phone) {
            return res.status(400).json({ message: 'ใส่ เบอร์โทรศัพท์' })
        }
        if (!id_card) {
            return res.status(400).json({ message: 'ใส่ เลขบัตรประชาชน' })
        }
        // Step 2 Check Email in DB 

        const Checkemail = await prisma.users.findFirst({
            where: {
                email: email
            }
        })
        if (Checkemail) {
            return res.status(400).json({ message: 'มี Email อยู่ระบบแล้ว ' })
        }
        const CheckPhone = await prisma.users.findFirst({
            where: {
                phone: phone
            }
        })
        if (CheckPhone) {
            return res.status(400).json({ message: 'มี เบอร์โทรศัพท์ อยู่ระบบแล้ว ' })
        }
        const CheckID_Card = await prisma.users.findFirst({
            where: {
                id_card: id_card
            }
        })
        if (CheckID_Card) {
            return res.status(400).json({ message: 'มี เลขบัตรประชาชน อยู่ระบบแล้ว ' })
        }

        // Step 3 Hashpassword
        const Hashpassword = await bcrypt.hash(password, 6)

        //Step 4 Register
        await prisma.users.create({
            data: {
                first_name: first_name,
                last_name: last_name,
                email: email,
                password: Hashpassword,
                phone: phone,
                id_card: id_card
            }
        })

        res.send('สมัครสมาชิก สำเร็จ')
    } catch (err) {
        // error
        console.log(err)
        res.status(500).json({
            message: 'Error in Server',
        })

    }
}

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body

        // Step 1 Check Email
        const users = await prisma.users.findFirst({
            where: {
                email: email
            }
        })
        if (!users || !users.enabled) {
            return res.status(400).json({ message: 'ไม่มีบัญชีอยู่ในระบบ' })
        }
        // Step 2 Check Password
        const isMatch = await bcrypt.compare(password, users.password)
        if (!isMatch) {
            return res.status(400).json({ message: 'รหัสผ่านไม่ถูกต้อง' })
        }
        // Step 3 Check PayLoad

        const PayLoad = {
            id: users.id,
            email: users.email,
            role: users.role,
            phone: users.phone,
            id_card: users.id_card
        }
        console.log(PayLoad)

        // Step 4 Check Token
        jwt.sign(PayLoad, process.env.SECRET, { expiresIn: '1d' }, (err, token) => {
            if (err) {
                return res.status(500).json({ message: 'Server  Error' })
            }
            res.json({ PayLoad, token })
        })
        console.log(PayLoad)

    } catch (err) {
        // error
        console.log(err)
        res.status(500).json({ message: 'Error in Server', })

    }
}

exports.currentUser = async (req, res) => {
    try {
        const user = await prisma.users.findFirst({
            where: { email: req.user.email },
            select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
                role: true
            }
        })
        res.json({ user })
    } catch (err) {
        // error
        console.log(err)
        res.status(500).json({
            message: 'Error in Server',
        })

    }
}
