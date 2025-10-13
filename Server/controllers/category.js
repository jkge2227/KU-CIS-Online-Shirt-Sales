const prisma = require("../config/prisma")

exports.create = async (req, res) => {
    try {
        const { name } = req.body
        const category = await prisma.category.create({
            data: {
                name: name
            }
        })
        res.send(category)
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
        const category = await prisma.category.findMany()
        res.send(category)
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: " Server in Error" })
    }
}
exports.remove = async (req, res) => {
    try {
        const { id } = req.params
        const category = await prisma.category.delete({
            where: {
                id: Number(id)
            }
        })
        res.send(category)
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: " Server in Error" })
    }
}

exports.update = async (req, res) => {
    try {
        const { id } = req.params
        const { name } = req.body
        if (!name || !name.trim()) {
            return res.status(400).json({ message: "กรุณากรอกชื่อประเภทสินค้า" });
        }
        const category = await prisma.category.update({
            where: { id: Number(id) },
            data: { name: name.trim() }
        })
        res.send(category)
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
}