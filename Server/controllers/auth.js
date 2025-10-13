// server/controllers/auth.js (หรือไฟล์เดียวกับที่คุณวางอยู่)
const prisma = require("../config/prisma");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto"); // ✅ ต้องมี
const { sendOtpMail } = require("../utils/mailer"); // ✅ ต้องมีฟังก์ชันส่งอีเมล

// ===== Helpers =====
function genOTP() {
    return String(Math.floor(100000 + Math.random() * 900000));
}
function hash(str) {
    return crypto.createHash("sha256").update(str).digest("hex");
}
function makeVerifyToken(email) {
    const raw = crypto.randomBytes(24).toString("hex");
    const sig = hash(`${email}|${raw}`);
    return { raw, sig };
}
function normEmail(email) {
    return String(email || "").trim().toLowerCase();
}

// ===== Register (ต้องผ่าน OTP ก่อน) =====
exports.register = async (req, res) => {
    try {
        const {
            first_name,
            last_name,
            email,
            password,
            phone,
            id_card,
            verifyToken, // ✅ รับมาจากการ verify OTP
        } = req.body || {};

        // validate เบื้องต้น
        if (!first_name) return res.status(400).json({ message: "ใส่ ชื่อ" });
        if (!last_name) return res.status(400).json({ message: "ใส่ นามสกุล" });
        if (!email) return res.status(400).json({ message: "ใส่ Email" });
        if (!password) return res.status(400).json({ message: "ใส่รหัสผ่าน" });
        if (!phone) return res.status(400).json({ message: "ใส่ เบอร์โทรศัพท์" });
        if (!id_card) return res.status(400).json({ message: "ใส่ เลขบัตรประชาชน" });
        if (!verifyToken) return res.status(400).json({ message: "กรุณายืนยันอีเมลด้วย OTP ก่อนสมัคร" });

        const emailL = normEmail(email);

        // ✅ บังคับตรวจยืนยันอีเมลก่อน
        const rec = await prisma.emailOtp.findUnique({ where: { email: emailL } });
        if (!rec) return res.status(400).json({ message: "ยังไม่ได้ขอรหัส OTP" });
        if (new Date() > rec.expiresAt) return res.status(400).json({ message: "รหัสหมดอายุ กรุณาขอใหม่" });
        const sig = hash(`${emailL}|${verifyToken}`);
        if (rec.codeHash !== sig) {
            return res.status(400).json({ message: "ยังไม่ได้ยืนยันอีเมล หรือ verifyToken ไม่ถูกต้อง" });
        }

        // ซ้ำข้อมูล
        const [byEmail, byPhone, byId] = await Promise.all([
            prisma.users.findFirst({ where: { email: emailL } }),
            prisma.users.findFirst({ where: { phone: phone } }),
            prisma.users.findFirst({ where: { id_card: id_card } }),
        ]);
        if (byEmail) return res.status(400).json({ message: "มี Email อยู่ในระบบแล้ว" });
        if (byPhone) return res.status(400).json({ message: "มี เบอร์โทรศัพท์ อยู่ในระบบแล้ว" });
        if (byId) return res.status(400).json({ message: "มี เลขบัตรประชาชน อยู่ในระบบแล้ว" });

        // เข้ารหัสรหัสผ่าน
        const hashPw = await bcrypt.hash(password, 10); // ✅ แนะนำ 10

        // สร้างผู้ใช้
        await prisma.users.create({
            data: {
                first_name,
                last_name,
                email: emailL,
                password: hashPw,
                phone,
                id_card,
                // role/status ถ้าสคีมากำหนด default แล้ว ไม่ต้องใส่ก็ได้
            },
        });

        // ทำความสะอาด OTP (ออปชัน)
        await prisma.emailOtp.delete({ where: { email: emailL } }).catch(() => { });

        res.send("สมัครสมาชิก สำเร็จ");
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error in Server" });
    }
};

// ===== Login =====
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body || {};
        const emailL = normEmail(email);

        const users = await prisma.users.findFirst({ where: { email: emailL } });
        if (!users) return res.status(400).json({ message: "ไม่มีบัญชีอยู่ในระบบ" });

        // ✅ ถ้าสคีมาเป็น status ("enabled"/"disabled")
        if (users.status && users.status !== "enabled") {
            return res.status(403).json({ message: "บัญชีถูกระงับการใช้งาน" });
        }

        const ok = await bcrypt.compare(password, users.password);
        if (!ok) return res.status(400).json({ message: "รหัสผ่านไม่ถูกต้อง" });

        const PayLoad = {
            id: users.id,
            email: users.email,
            role: users.role,
            phone: users.phone,
            id_card: users.id_card,
        };

        jwt.sign(PayLoad, process.env.SECRET, { expiresIn: "1d" }, (err, token) => {
            if (err) return res.status(500).json({ message: "Server Error" });
            res.json({ PayLoad, token });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error in Server" });
    }
};

// ===== Current User =====
exports.currentUser = async (req, res) => {
    try {
        const user = await prisma.users.findFirst({
            where: { email: req.user.email },
            select: { id: true, email: true, first_name: true, last_name: true, role: true },
        });
        res.json({ user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error in Server" });
    }
};

// ===== OTP: ขอรหัส =====
exports.requestEmailOtp = async (req, res) => {
    try {
        const emailL = normEmail(req.body?.email);
        if (!emailL) return res.status(400).json({ message: "กรอกอีเมล" });

        const now = new Date();
        const existing = await prisma.emailOtp.findUnique({ where: { email: emailL } });

        if (existing && now - existing.lastSentAt < 60 * 1000) {
            const remain = Math.ceil((60 * 1000 - (now - existing.lastSentAt)) / 1000);
            return res.status(429).json({ message: `โปรดลองอีกครั้งใน ${remain} วินาที` });
        }

        const otp = genOTP();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 นาที

        if (!existing) {
            await prisma.emailOtp.create({
                data: { email: emailL, codeHash: hash(otp), expiresAt, attempts: 0, lastSentAt: now },
            });
        } else {
            await prisma.emailOtp.update({
                where: { email: emailL },
                data: { codeHash: hash(otp), expiresAt, attempts: 0, lastSentAt: now },
            });
        }

        await sendOtpMail(emailL, otp);
        res.json({ ok: true, message: "ส่งรหัส OTP แล้ว" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
};

// ===== OTP: ยืนยันรหัส =====
exports.verifyEmailOtp = async (req, res) => {
    try {
        const emailL = normEmail(req.body?.email);
        const otpStr = String(req.body?.otp || "").trim();
        if (!emailL || !otpStr) return res.status(400).json({ message: "ข้อมูลไม่ครบ" });

        const rec = await prisma.emailOtp.findUnique({ where: { email: emailL } });
        if (!rec) return res.status(400).json({ message: "ยังไม่ได้ขอรหัส OTP" });
        if (new Date() > rec.expiresAt) return res.status(400).json({ message: "รหัสหมดอายุ กรุณาขอใหม่" });
        if (rec.attempts >= 5) return res.status(429).json({ message: "ลองเกินจำนวนครั้งที่กำหนด กรุณาขอรหัสใหม่" });

        const right = rec.codeHash === hash(otpStr);

        // เพิ่ม attempts (นับทั้งกรณีถูก/ผิด 1 ครั้ง)
        await prisma.emailOtp.update({
            where: { email: emailL },
            data: { attempts: rec.attempts + 1 },
        });

        if (!right) return res.status(400).json({ message: "รหัส OTP ไม่ถูกต้อง" });

        // ออก verifyToken + แทนที่ codeHash ด้วย signature ของ token
        const { raw, sig } = makeVerifyToken(emailL);
        await prisma.emailOtp.update({
            where: { email: emailL },
            data: {
                codeHash: sig, // เก็บ sig ของ verifyToken
                expiresAt: new Date(Date.now() + 5 * 60 * 1000), // อายุ verifyToken 5 นาที
                attempts: 0,
            },
        });

        res.json({ ok: true, verifyToken: raw });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
};
