// server/controllers/setting.js
const prisma = require("../config/prisma");

/** helpers */
const getSetting = async (key, defaultValue = null) => {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value ?? defaultValue;
};

const setSetting = async (key, value) => {
    await prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
    });
};

/** GET /admin/settings/low-stock-threshold */
exports.getLowStockThreshold = async (req, res) => {
    try {
        const v = await getSetting("lowStockThreshold", "9");
        res.json({ key: "lowStockThreshold", value: Number(v) });
    } catch (e) {
        console.error("getLowStockThreshold error:", e);
        res.status(500).json({ message: "Server Error" });
    }
};

/** PUT /admin/settings/low-stock-threshold  { value:number } */
exports.updateLowStockThreshold = async (req, res) => {
    try {
        const { value } = req.body;
        const num = Number(value);
        if (!Number.isFinite(num) || num < 0) {
            return res.status(400).json({ message: "value must be a non-negative number" });
        }
        await setSetting("lowStockThreshold", num);
        res.json({ key: "lowStockThreshold", value: num });
    } catch (e) {
        console.error("updateLowStockThreshold error:", e);
        res.status(500).json({ message: "Server Error" });
    }
};

/** PUT /admin/variants/:id/low-stock-threshold { value:number | "" | null } */
exports.setVariantLowStockThreshold = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: "invalid variant id" });
        }
        const { value } = req.body;
        const val = value === "" || value == null ? null : Number(value);
        if (val !== null && (!Number.isFinite(val) || val < 0)) {
            return res.status(400).json({ message: "value must be a non-negative number or empty" });
        }
        const updated = await prisma.productVariant.update({
            where: { id },
            data: { lowStockThreshold: val },
            select: { id: true, lowStockThreshold: true },
        });
        res.json(updated);
    } catch (e) {
        console.error("setVariantLowStockThreshold error:", e);
        res.status(500).json({ message: "Server Error" });
    }
};

// export helpers (ถ้าคอนโทรลเลอร์อื่นต้องใช้)
exports._getSetting = getSetting;
exports._setSetting = setSetting;
