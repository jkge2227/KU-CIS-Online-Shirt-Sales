// Server/controllers/adminUsers.js
const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const { Role } = require('@prisma/client'); // ✅ ใช้ enum แทนสตริง

const norm = (s) => String(s || '').trim();
// เก็บเป็นตัวเลขล้วน (ลบทุกอย่างที่ไม่ใช่ 0-9)
const digitsOnly = (s) => String(s || '').replace(/\D+/g, '');

// ===== optional: ฟังก์ชันตรวจความยาวพื้นฐาน =====
const validateThaiId = (raw) => {
    const d = digitsOnly(raw);
    if (!d) return { ok: true, value: d }; // ไม่บังคับส่งมา
    if (d.length !== 13) return { ok: false, message: 'เลขบัตรประชาชนต้องมี 13 หลัก' };
    return { ok: true, value: d };
};
const validatePhone10 = (raw) => {
    const d = digitsOnly(raw);
    if (!d) return { ok: true, value: d };
    if (d.length !== 10) return { ok: false, message: 'เบอร์โทรต้องมี 10 หลัก' };
    return { ok: true, value: d };
};

// helper: แปลงสตริง role ➜ enum (รับ 'admin'|'user' ไม่สนตัวพิมพ์)
const toRoleEnum = (v) => {
    const s = String(v || '').trim().toLowerCase();
    return s === 'admin' ? Role.admin : Role.user;
};

exports.adminListUsers = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page || 1));
        const pageSize = Math.min(50, Math.max(5, Number(req.query.pageSize || 10)));
        const q = norm(req.query.q);

        const where = q
            ? {
                OR: [
                    { email: { contains: q } },
                    { first_name: { contains: q } },
                    { last_name: { contains: q } },
                    { phone: { contains: q } },
                ],
            }
            : {};

        const [total, rows] = await prisma.$transaction([
            prisma.users.count({ where }), // ✅ ไม่มี select
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
                    createdAt: true,
                    updatedAt: true,
                    bannedAt: true,
                    banReason: true,
                    bannedById: true,
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
            first_name, last_name, email, phone, id_card,
            role = 'user', password, enabled = true,
        } = req.body || {};

        if (!email || !password) return res.status(400).json({ message: 'email และ password จำเป็น' });

        const emailNorm = norm(email).toLowerCase(); // ป้องกันซ้ำต่างตัวพิมพ์
        const exist = await prisma.users.findUnique({ where: { email: emailNorm } });
        if (exist) return res.status(409).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' });

        // ตัดขีดออกก่อนบันทึก + ตรวจความยาวพื้นฐาน
        const vId = validateThaiId(id_card);
        if (!vId.ok) return res.status(400).json({ message: vId.message });
        const vPhone = validatePhone10(phone);
        if (!vPhone.ok) return res.status(400).json({ message: vPhone.message });

        const hash = await bcrypt.hash(String(password), 10);

        const user = await prisma.users.create({
            data: {
                first_name: norm(first_name),
                last_name: norm(last_name),
                email: emailNorm,
                phone: vPhone.value,      // เก็บเลขล้วน
                id_card: vId.value,       // เก็บเลขล้วน
                role: toRoleEnum(role),   // ✅ enum Role
                enabled: Boolean(enabled),
                password: hash,
            },
            select: {
                id: true, first_name: true, last_name: true, email: true, phone: true, id_card: true,
                role: true, enabled: true, createdAt: true, updatedAt: true,
            },
        });

        res.status(201).json({ ok: true, user });
    } catch (e) {
        console.error('[adminCreateUser]', e);
        res.status(500).json({ message: 'Server Error' });
    }
};

// Server/controllers/adminUsers.js
exports.adminUpdateUser = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'invalid id' });

        const {
            first_name, last_name, email, phone, id_card, role, enabled, banReason,
        } = req.body || {};

        // ตรวจซ้ำอีเมล (เดิม) …
        if (email !== undefined) {
            const emailNorm = norm(email).toLowerCase();
            const dup = await prisma.users.findFirst({
                where: { email: emailNorm, NOT: { id } },
                select: { id: true },
            });
            if (dup) return res.status(409).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' });
        }

        const updates = {};
        if (first_name !== undefined) updates.first_name = norm(first_name);
        if (last_name !== undefined) updates.last_name = norm(last_name);
        if (email !== undefined) updates.email = norm(email).toLowerCase();
        if (role !== undefined) updates.role = toRoleEnum(role);
        if (phone !== undefined) {
            const vPhone = validatePhone10(phone);
            if (!vPhone.ok) return res.status(400).json({ message: vPhone.message });
            updates.phone = vPhone.value;
        }
        if (id_card !== undefined) {
            const vId = validateThaiId(id_card);
            if (!vId.ok) return res.status(400).json({ message: vId.message });
            updates.id_card = vId.value;
        }

        // ส่วนสำคัญ: แบน/ยกเลิกแบน
        if (enabled !== undefined) {
            const adminId = req.user?.id ?? null; // ต้องมีจาก authCheck
            const nextEnabled = Boolean(enabled);

            if (!nextEnabled) {
                // ปิดใช้งาน => ต้องมีเหตุผล
                const reason = norm(banReason).slice(0, 300);
                if (!reason) return res.status(400).json({ message: 'กรุณาระบุสาเหตุการแบน' });

                updates.enabled = false;
                updates.bannedAt = new Date();
                updates.banReason = reason;
                updates.bannedById = adminId;
            } else {
                updates.enabled = true;
                updates.banReason = null;
                updates.bannedAt = null;
                updates.bannedById = null;
            }
        }

        const user = await prisma.users.update({
            where: { id },
            data: updates,
            select: {
                id: true, first_name: true, last_name: true, email: true, phone: true, id_card: true,
                role: true, enabled: true, createdAt: true, updatedAt: true,
                bannedAt: true, banReason: true, bannedById: true, // 🔽 ส่งกลับ
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

        await prisma.users.delete({ where: { id } });
        res.json({ ok: true, message: 'ลบผู้ใช้แล้ว' });
    } catch (e) {
        console.error('[adminDeleteUser]', e);
        if (e.code === 'P2003') {
            return res.status(400).json({ message: 'ไม่สามารถลบผู้ใช้ได้ เนื่องจากมีข้อมูลที่เกี่ยวข้อง' });
        }
        res.status(500).json({ message: 'Server Error' });
    }
};
