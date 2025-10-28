// server/controllers/admin.js
const prisma = require("../config/prisma");
const { OrderStatus } = require("@prisma/client");
const { _getSetting } = require("./setting");

/* ==========================
   ไทย <-> Enum Mapping
   ========================== */
const MAP_THAI_TO_ENUM = {
    "ผู้ขายได้รับคำสั่งซื้อแล้ว": OrderStatus.PENDING,
    "ผู้ขายจัดเตรียมสินค้าแล้วรอผู้ซื้อมารับ": OrderStatus.CONFIRMED,
    "ผู้ซื้อมารับสินค้าแล้ว": OrderStatus.COMPLETED,
    "ยกเลิก": OrderStatus.CANCELED,
};

const MAP_ENUM_TO_THAI = {
    [OrderStatus.PENDING]: "ผู้ขายได้รับคำสั่งซื้อแล้ว",
    [OrderStatus.CONFIRMED]: "ผู้ขายจัดเตรียมสินค้าแล้วรอผู้ซื้อมารับ",
    [OrderStatus.COMPLETED]: "ผู้ซื้อมารับสินค้าแล้ว",
    [OrderStatus.CANCELED]: "ยกเลิก",
};

/* ==========================
   Helpers: Thai-day boundaries
   ========================== */
const TH_OFFSET_MS = 7 * 60 * 60 * 1000; // +07:00

// 00:00 ของ "วันไทย" ที่ระบุ (แปลงเป็น UTC instant)
const startOfThaiDayUTC = (ymd) => {
    if (!ymd) return null;
    const [y, m, d] = String(ymd).split("-").map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1) - TH_OFFSET_MS);
};
// วันถัดไปของ "instant" (ใช้สำหรับ upper-bound แบบ exclusive)
const nextThaiDayUTC = (d) => (d ? new Date(d.getTime() + 24 * 60 * 60 * 1000) : null);

/* ==========================
   Prisma Middleware
   - แปลงสถานะที่ส่งมาเป็นภาษาไทย ให้เป็น Enum อัตโนมัติ
   - รองรับ where.data และโอเปอเรเตอร์ equals/in/not/set/notIn
   ========================== */
function coerceStatusInput(v) {
    if (typeof v === "string") return MAP_THAI_TO_ENUM[v] ?? v;
    if (v && typeof v === "object") {
        const out = { ...v };
        if (Array.isArray(v.in)) out.in = v.in.map((x) => MAP_THAI_TO_ENUM[x] ?? x);
        if (Array.isArray(v.notIn)) out.notIn = v.notIn.map((x) => MAP_THAI_TO_ENUM[x] ?? x);
        if (v.equals) out.equals = MAP_THAI_TO_ENUM[v.equals] ?? v.equals;
        if (v.not) out.not = MAP_THAI_TO_ENUM[v.not] ?? v.not;
        if (v.set) out.set = MAP_THAI_TO_ENUM[v.set] ?? v.set;
        return out;
    }
    return v;
}

prisma.$use(async (params, next) => {
    if (params.model === "Order") {
        if (params.args?.where?.orderStatus !== undefined) {
            params.args.where.orderStatus = coerceStatusInput(params.args.where.orderStatus);
        }
        if (params.args?.data?.orderStatus !== undefined) {
            params.args.data.orderStatus = coerceStatusInput(params.args.data.orderStatus);
        }
    }
    return next(params);
});

/* ==========================
   Controllers
   ========================== */

// เปลี่ยนสถานะตาม body (รับได้ทั้งไทยและชื่อ enum)
exports.changeOrderstatus = async (req, res) => {
    try {
        const { orderId, orderStatus } = req.body;
        const updated = await prisma.order.update({
            where: { id: Number(orderId) },
            data: { orderStatus }, // middleware จะจัดการแปลงให้
        });
        res.json(updated);
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server Error" });
    }
};

exports.getOrderAdmin = async (req, res) => {
    try {
        const order = await prisma.order.findMany({
            include: {
                products: { include: { product: true } },
                orderBuy: {
                    select: {
                        id: true,
                        email: true,
                    },
                },
            },
        });
        res.json(order);
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server Error" });
    }
};

/* ==========================
   รายการออเดอร์ (ฟิลเตอร์ + ค้นหา)
   ========================== */
exports.listAllOrders = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page || 1));
        const pageSize = Math.min(50, Math.max(5, Number(req.query.pageSize || 10)));
        const q = String(req.query.q || "").trim();

        // status รับได้ทั้งภาษาไทยและชื่อ enum (เช่น PENDING)
        const rawStatus = String(req.query.status || "").trim();
        const statusEnum = MAP_THAI_TO_ENUM[rawStatus] ?? OrderStatus[rawStatus];

        // ----- Date range: interpret as TH day -----
        const startDateStr = String(req.query.startDate || "").trim(); // "YYYY-MM-DD" (Thai day from UI)
        const endDateStr = String(req.query.endDate || "").trim();     // "YYYY-MM-DD"

        let createdAtFilter;
        if (startDateStr || endDateStr) {
            const gte = startDateStr ? startOfThaiDayUTC(startDateStr) : undefined;
            const lt = endDateStr ? nextThaiDayUTC(startOfThaiDayUTC(endDateStr)) : undefined;
            createdAtFilter = { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) }; // ใช้ [gte, lt)
        }

        // ----- Base where -----
        const where = {
            ...(statusEnum ? { orderStatus: statusEnum } : {}),
            ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
        };

        // ----- Keyword search (id, buyer, phone/email/name, productTitle) -----
        if (q) {
            const tryId = Number(q);
            const idFilter = Number.isInteger(tryId) && tryId > 0 ? [{ id: tryId }] : [];
            where.AND = [
                {
                    OR: [
                        ...idFilter,
                        {
                            orderBuy: {
                                OR: [
                                    { email: { contains: q } },
                                    { first_name: { contains: q } },
                                    { last_name: { contains: q } },
                                    { phone: { contains: q } },
                                ],
                            },
                        },
                        { products: { some: { productTitle: { contains: q } } } },
                    ],
                },
            ];
        }

        const [total, rows] = await prisma.$transaction([
            prisma.order.count({ where }),
            prisma.order.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
                select: {
                    id: true,
                    cartTotal: true,
                    orderStatus: true,
                    createdAt: true,
                    updatedAt: true,
                    cancelReason: true,
                    cancelNote: true,
                    canceledAt: true,
                    canceledById: true,
                    pickupPlace: true,
                    pickupAt: true,
                    pickupNote: true,
                    orderBuy: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                            phone: true,
                        },
                    },
                    products: {
                        select: {
                            id: true,
                            count: true,
                            price: true,
                            productTitle: true,
                            sizeName: true,
                            generationName: true,
                            variant: {
                                select: {
                                    product: { select: { images: { select: { url: true }, take: 1 } } },
                                    size: { select: { name: true } },
                                    generation: { select: { name: true } },
                                },
                            },
                        },
                    },
                },
            }),
        ]);

        res.json({
            ok: true,
            data: rows,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Server Error" });
    }
};

/* ==========================
   นัดรับ: อัปเดตเฉพาะออเดอร์ที่อยู่สถานะ CONFIRMED
   ========================== */
exports.updatePickupForOrder = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { place, pickupAt, note, clear } = req.body || {};
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "รูปแบบ id ไม่ถูกต้อง" });

        const order = await prisma.order.findUnique({
            where: { id },
            select: { id: true, orderStatus: true },
        });
        if (!order) return res.status(404).json({ message: "ไม่พบออเดอร์" });
        if (order.orderStatus !== OrderStatus.CONFIRMED) {
            return res.status(400).json({ message: "แก้ไขนัดรับได้เฉพาะสถานะ 'รับออเดอร์เสร็จสิ้น'" });
        }

        let data = {};
        if (clear) {
            data = { pickupPlace: null, pickupAt: null, pickupNote: null };
        } else {
            if (!place || !String(place).trim()) {
                return res.status(400).json({ message: "กรุณาระบุสถานที่นัดรับ (place)" });
            }
            data.pickupPlace = String(place).trim();
            data.pickupNote = note ? String(note).trim() : null;
            if (pickupAt) {
                const dt = new Date(pickupAt);
                if (isNaN(dt.getTime())) return res.status(400).json({ message: "pickupAt ไม่ถูกต้อง (ต้องเป็น ISO datetime)" });
                data.pickupAt = dt;
            } else {
                data.pickupAt = null;
            }
        }

        await prisma.order.update({ where: { id }, data });
        res.json({ ok: true, message: clear ? "ล้างค่านัดรับแล้ว" : "อัปเดตค่านัดรับแล้ว" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Server Error" });
    }
};

/* ==========================
   สต็อกต่ำ
   ========================== */
exports.lowStockNotifications = async (req, res) => {
    try {
        const savedThreshold = Number(await _getSetting("lowStockThreshold", "9"));
        const threshold = Number(
            req.query.threshold !== undefined ? req.query.threshold : savedThreshold
        );

        const variants = await prisma.productVariant.findMany({
            where: {
                OR: [
                    { lowStockThreshold: null, quantity: { lte: threshold } },
                    {
                        lowStockThreshold: { not: null },
                        // Prisma field reference สำหรับ compare กับคอลัมน์ตัวเอง
                        quantity: { lte: prisma.productVariant.fields.lowStockThreshold },
                    },
                ],
            },
            include: {
                product: { select: { id: true, title: true } },
                size: { select: { name: true } },
                generation: { select: { name: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 100,
        });

        const items = variants.map((v) => {
            const parts = [v.product?.title, v.size?.name, v.generation?.name].filter(Boolean);
            const eff = v.lowStockThreshold ?? threshold;
            return {
                id: `stock:${v.id}`,
                type: "stock",
                productId: v.productId,
                variantId: v.id,
                title: `สต็อกต่ำ: ${parts.join(" / ")} (เหลือ ${v.quantity} / เกณฑ์ ${eff})`,
                unread: true,
                href: `/admin/product/${v.productId}?variant=${v.id}`,
                ts: v.updatedAt,
            };
        });

        res.json({ threshold, items });
    } catch (e) {
        console.error("lowStockNotifications error:", e);
        res.status(500).json({ message: "Server Error" });
    }
};

/* ==========================
   ออเดอร์ใหม่ในช่วงเวลา (สถานะ PENDING)
   ========================== */
exports.newOrderNotifications = async (req, res) => {
    try {
        const hours = Number(req.query.hours || 24);
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);

        const orders = await prisma.order.findMany({
            where: {
                orderStatus: OrderStatus.PENDING,
                createdAt: { gte: since },
            },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                createdAt: true,
                orderBuy: { select: { first_name: true, last_name: true, email: true } },
                products: { select: { id: true } },
            },
            take: 20,
        });

        const noti = orders.map((od) => ({
            id: `order-${od.id}`,
            title: `ออเดอร์ใหม่ #${od.id} โดย ${od.orderBuy?.first_name ?? ""} ${od.orderBuy?.last_name ?? ""}`.trim(),
            time: new Date(od.createdAt).toLocaleString("th-TH"),
            unread: true,
            href: `/admin/statusorder?focus=${od.id}`,
            type: "order",
        }));

        res.json(noti);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Server Error" });
    }
};

/* ==========================
   ตั้งค่านัดรับแบบกลุ่ม (เฉพาะสถานะ CONFIRMED)
   ========================== */
exports.setPickupForOrders = async (req, res) => {
    try {
        const { orderIds, place, pickupAt, note } = req.body || {};

        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ message: "orderIds ต้องเป็น array และห้ามว่าง" });
        }
        if (!place || String(place).trim() === "") {
            return res.status(400).json({ message: "กรุณาระบุสถานที่นัดรับ (place)" });
        }

        const ids = orderIds.map((x) => Number(x)).filter((x) => Number.isInteger(x));
        const data = {
            pickupPlace: String(place).trim(),
            pickupNote: note ? String(note).trim() : null,
        };
        if (pickupAt) {
            const dt = new Date(pickupAt);
            if (isNaN(dt.getTime())) {
                return res.status(400).json({ message: "รูปแบบ pickupAt ไม่ถูกต้อง (ต้องเป็น ISO datetime)" });
            }
            data.pickupAt = dt;
        } else {
            data.pickupAt = null;
        }

        const result = await prisma.order.updateMany({
            where: {
                id: { in: ids },
                orderStatus: OrderStatus.CONFIRMED,
            },
            data,
        });

        return res.json({
            ok: true,
            updatedCount: result.count,
            message: `ตั้งค่านัดรับให้ ${result.count} ออเดอร์แล้ว`,
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Server Error" });
    }
};

/* ==========================
   แอดมินยกเลิกออเดอร์ + คืนสต็อก (ตั้งสถานะ CANCELED)
   ========================== */
exports.adminCancelOrder = async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const { reason, note } = req.body ?? {};
        const adminId = req.user?.id ?? null;

        if (!orderId) return res.status(400).json({ message: "invalid order id" });
        if (!reason || !reason.trim()) {
            return res.status(400).json({ message: "กรุณาระบุสาเหตุการยกเลิก" });
        }

        const now = new Date();

        const updated = await prisma.$transaction(async (tx) => {
            const before = await tx.order.findUnique({
                where: { id: orderId },
                select: { id: true, orderStatus: true },
            });
            if (!before) return null;

            // คืนสต็อกเฉพาะรอบแรก (ยังไม่เคยยกเลิกมาก่อน)
            if (before.orderStatus !== OrderStatus.CANCELED) {
                const full = await tx.order.findUnique({
                    where: { id: orderId },
                    include: {
                        products: {
                            include: { variant: { select: { id: true, productId: true } } },
                        },
                    },
                });
                if (!full) return null;

                for (const line of full.products) {
                    await tx.productVariant.update({
                        where: { id: line.variantId },
                        data: { quantity: { increment: line.count } },
                    });
                    await tx.product.update({
                        where: { id: line.variant.productId },
                        data: { sold: { decrement: line.count } },
                    });
                }
            }

            return tx.order.update({
                where: { id: orderId },
                data: {
                    orderStatus: OrderStatus.CANCELED,
                    cancelReason: reason.trim(),
                    cancelNote: note?.trim() || null,
                    canceledAt: now,
                    canceledById: adminId,
                },
                include: {
                    orderBuy: { select: { id: true, first_name: true, last_name: true, email: true } },
                    products: true,
                },
            });
        });

        if (!updated) return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });
        return res.json({ ok: true, order: updated });
    } catch (err) {
        console.error("[adminCancelOrder]", err);
        return res.status(500).json({ message: "Server Error" });
    }
};

/* ==========================
   แก้/ล้างเหตุผลการยกเลิก (ทำได้เฉพาะออเดอร์ที่ CANCELED)
   ========================== */
exports.updateCancelInfo = async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const { reason, note, clear } = req.body ?? {};
        const adminId = req.user?.id ?? null;

        if (!orderId) return res.status(400).json({ message: "invalid order id" });

        const od = await prisma.order.findUnique({
            where: { id: orderId },
            select: { id: true, orderStatus: true, cancelReason: true, cancelNote: true },
        });
        if (!od) return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });

        if (od.orderStatus !== OrderStatus.CANCELED) {
            return res.status(400).json({ message: "แก้ไขเหตุผลได้เฉพาะคำสั่งซื้อที่ถูกยกเลิกแล้วเท่านั้น" });
        }

        if (clear) {
            const updated = await prisma.order.update({
                where: { id: orderId },
                data: { cancelReason: null, cancelNote: null, canceledById: adminId },
                select: { id: true, cancelReason: true, cancelNote: true, canceledAt: true, canceledById: true },
            });
            return res.json({ ok: true, order: updated, message: "ล้างเหตุผล/หมายเหตุแล้ว" });
        }

        if (!reason || !reason.trim()) {
            return res.status(400).json({ message: "กรุณาระบุเหตุผล (reason)" });
        }

        const updated = await prisma.order.update({
            where: { id: orderId },
            data: {
                cancelReason: reason.trim(),
                cancelNote: note?.trim() || null,
                canceledById: adminId,
            },
            select: { id: true, cancelReason: true, cancelNote: true, canceledAt: true, canceledById: true },
        });

        return res.json({ ok: true, order: updated });
    } catch (err) {
        console.error("[updateCancelInfo]", err);
        return res.status(500).json({ message: "Server Error" });
    }
};

/* ==========================
   อัปเดตสถานะทั่วไป (รับได้ทั้งไทย/enum)
   ========================== */
exports.updateOrderStatus = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { status } = req.body;
        if (!id || !status) return res.status(400).json({ message: "missing id/status" });

        const enumVal = MAP_THAI_TO_ENUM[status] ?? OrderStatus[status] ?? OrderStatus.PENDING;
        const od = await prisma.order.update({
            where: { id },
            data: { orderStatus: enumVal },
        });
        res.json({ ok: true, order: od });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: e?.message || "Server Error" });
    }
};
