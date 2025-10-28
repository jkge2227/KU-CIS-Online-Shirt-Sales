// controllers/generation.js
const prisma = require('../config/prisma');
const { prismaError, buildPaging } = require('./_utils');

exports.create = async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'name is required' });
    }
    const item = await prisma.generation.create({
      data: { name: name.trim() },
    });
    res.status(201).json(item);
  } catch (err) {
    console.error("size.create error:", err);

    // ชื่อซ้ำ (unique constraint บน name)
    if (err?.code === "P2002") {
      return res.status(409).json({ message: "ชื่อนี้ถูกใช้แล้ว" });
    }

    return res.status(500).json({ message: "Server Error" });
  }
};

exports.list = async (req, res) => {
  try {
    const { pageNum, pageSize, where, orderBy } = buildPaging(req);
    const [items, total] = await Promise.all([
      prisma.generation.findMany({
        where,
        orderBy,
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      prisma.generation.count({ where }),
    ]);
    res.json({
      data: items,
      page: pageNum,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    console.error(err);
    const { status, message } = prismaError(err);
    res.status(status).json({ message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'invalid id' });

    const item = await prisma.generation.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ message: 'Generation not found' });

    res.json(item);
  } catch (err) {
    console.error(err);
    const { status, message } = prismaError(err);
    res.status(status).json({ message });
  }
};

exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'invalid id' });

    const { name } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'name is required' });
    }

    const updated = await prisma.generation.update({
      where: { id },
      data: { name: name.trim() },
    });
    res.json(updated);
  } catch (err) {
    console.error("category.update error:", err);
    if (err?.code === "P2002") {
      return res.status(409).json({ message: "ชื่อนี้ถูกใช้แล้ว" });
    }
    // Prisma not found
    if (err?.code === "P2025") {
      return res.status(404).json({ message: "ไม่พบรายการ" });
    }
    res.status(500).json({ message: "Server Error" })
  }
};

exports.remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'invalid id' });

    // ถ้าใน schema ตั้ง onDelete:SetNull ก็ลบได้เลย
    // แต่เพื่อความปลอดภัย ลองเช็คก่อนว่ามีใครใช้อยู่ไหม
    const inUse = await prisma.productVariant.count({ where: { generationId: id } });
    if (inUse > 0) {
      // เลือกแนวทางหนึ่ง: บล็อกการลบ
      return res.status(409).json({ message: 'ไม่สามารถลบได้ เพราะรุ่นเสื้อนี้ถูกใช้กับสินค้าอยู่' });

      // หรือ แนวทางล้างค่าให้ null แบบควบคุมด้วยโค้ด (ถ้าอยากให้ลบอัตโนมัติ)
      // await prisma.productVariant.updateMany({ where: { generationId: id }, data: { generationId: null } });
    }

    const deleted = await prisma.generation.delete({ where: { id } });
    res.json(deleted);
  } catch (err) {
    console.error(err);
    const { status, message } = prismaError(err);
    res.status(status).json({ message });
  }
};
