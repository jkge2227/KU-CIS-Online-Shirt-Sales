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
    const { id } = req.params;
    const idNum = Number(id);
    if (!Number.isFinite(idNum)) {
      return res.status(400).json({ message: 'รหัสหมวดหมู่ไม่ถูกต้อง' });
    }

    // 1) ตรวจว่ามีสินค้าใช้หมวดหมู่นี้อยู่ไหม
    const inUse = await prisma.product.count({ where: { categoryId: idNum } });
    if (inUse > 0) {
      return res
        .status(409)
        .json({ message: 'ไม่สามารถลบได้ เพราะหมวดหมู่นี้ถูกใช้กับสินค้าอยู่' });
    }

    // 2) ลบหมวดหมู่
    const deleted = await prisma.category.delete({
      where: { id: idNum },
    });

    return res.json(deleted);
  } catch (err) {
    // กันเคส FK/ไม่พบเรคอร์ด
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2003') {
        return res
          .status(409)
          .json({ message: 'ไม่สามารถลบได้ เนื่องจากยังมีการอ้างอิงข้อมูลอยู่' });
      }
      if (err.code === 'P2025') {
        return res.status(404).json({ message: 'ไม่พบหมวดหมู่ที่ต้องการลบ' });
      }
    }
    console.error(err);
    return res.status(500).json({ message: 'Server Error' });
  }
};

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