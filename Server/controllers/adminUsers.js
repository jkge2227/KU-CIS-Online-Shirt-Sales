// Server/controllers/adminUsers.js
const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');

const norm = (s) => String(s || '').trim();

exports.adminListUsers = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page || 1));
        const pageSize = Math.min(50, Math.max(5, Number(req.query.pageSize || 10)));
        const q = norm(req.query.q);

        const where = q
            ? {
                OR: [
                    { email: { contains: q, mode: 'insensitive' } },
                    { first_name: { contains: q, mode: 'insensitive' } },
                    { last_name: { contains: q, mode: 'insensitive' } },
                    { phone: { contains: q } },
                ],
            }
            : {};

        const [total, rows] = await prisma.$transaction([
            prisma.users.count({ where }),
            prisma.users.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
                select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    email: true,
                    phone: true,
                    id_card: true,
                    role: true,
                    enabled: true,
                    address: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
        ]);

        res.json({
            ok: true,
            data: rows,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
    } catch (e) {
        console.error('[adminListUsers]', e);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.adminCreateUser = async (req, res) => {
    try {
        const {
            first_name, last_name, email, phone, id_card, address, role = 'user', password, enabled = true,
        } = req.body || {};

        if (!email || !password) return res.status(400).json({ message: 'email และ password จำเป็น' });

        const exist = await prisma.users.findUnique({ where: { email } });
        if (exist) return res.status(409).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' });

        const hash = await bcrypt.hash(String(password), 10);

        const user = await prisma.users.create({
            data: {
                first_name: norm(first_name),
                last_name: norm(last_name),
                email: norm(email),
                phone: norm(phone),
                id_card: norm(id_card),
                address: norm(address),
                role: role === 'admin' ? 'admin' : 'user',
                enabled: Boolean(enabled),
                password: hash,
            },
            select: {
                id: true, first_name: true, last_name: true, email: true, phone: true, id_card: true,
                role: true, enabled: true, address: true, createdAt: true, updatedAt: true,
            },
        });

        res.status(201).json({ ok: true, user });
    } catch (e) {
        console.error('[adminCreateUser]', e);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.adminUpdateUser = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'invalid id' });

        const {
            first_name, last_name, email, phone, id_card, address, role, enabled,
        } = req.body || {};

        // ตรวจซ้ำอีเมล
        if (email) {
            const dup = await prisma.users.findFirst({
                where: { email: String(email).trim(), NOT: { id } },
                select: { id: true },
            });
            if (dup) return res.status(409).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' });
        }

        const user = await prisma.users.update({
            where: { id },
            data: {
                ...(first_name !== undefined ? { first_name: norm(first_name) } : {}),
                ...(last_name !== undefined ? { last_name: norm(last_name) } : {}),
                ...(email !== undefined ? { email: norm(email) } : {}),
                ...(phone !== undefined ? { phone: norm(phone) } : {}),
                ...(id_card !== undefined ? { id_card: norm(id_card) } : {}),
                ...(address !== undefined ? { address: norm(address) } : {}),
                ...(role !== undefined ? { role: role === 'admin' ? 'admin' : 'user' } : {}),
                ...(enabled !== undefined ? { enabled: Boolean(enabled) } : {}),
            },
            select: {
                id: true, first_name: true, last_name: true, email: true, phone: true, id_card: true,
                role: true, enabled: true, address: true, createdAt: true, updatedAt: true,
            },
        });

        res.json({ ok: true, user });
    } catch (e) {
        console.error('[adminUpdateUser]', e);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.adminUpdateUserPassword = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { newPassword } = req.body || {};
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'invalid id' });
        if (!newPassword || String(newPassword).length < 6)
            return res.status(400).json({ message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });

        const hash = await bcrypt.hash(String(newPassword), 10);
        await prisma.users.update({
            where: { id },
            data: { password: hash },
        });

        res.json({ ok: true, message: 'อัปเดตรหัสผ่านแล้ว' });
    } catch (e) {
        console.error('[adminUpdateUserPassword]', e);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.adminDeleteUser = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'invalid id' });

        // หมายเหตุ: ถ้ามี foreign key constraints ให้ปรับเป็น soft-delete หรือ cascade ตามที่ออกแบบ
        await prisma.users.delete({ where: { id } });
        res.json({ ok: true, message: 'ลบผู้ใช้แล้ว' });
    } catch (e) {
        console.error('[adminDeleteUser]', e);
        // ถ้าลบไม่ได้เพราะ FK ให้แจ้งเตือนเหมาะสม
        if (e.code === 'P2003') {
            return res.status(400).json({ message: 'ไม่สามารถลบผู้ใช้ได้ เนื่องจากมีข้อมูลที่เกี่ยวข้อง' });
        }
        res.status(500).json({ message: 'Server Error' });
    }
};
