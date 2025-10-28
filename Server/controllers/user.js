// controllers/user.js
const prisma = require("../config/prisma");
const { OrderStatus } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { sendMail, isSMTPReady } = require("../config/mailer");

const hash = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const genOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const norm = (s) => String(s || "").trim().toLowerCase();

// ======================= สถานะไทยสำหรับ UI =======================
const STATUS_TEXT = {
    [OrderStatus.PENDING]: "ผู้ขายได้รับคำสั่งซื้อแล้ว",
    [OrderStatus.CONFIRMED]: "ผู้ขายจัดเตรียมสินค้าแล้วรอผู้ซื้อมารับ",
    [OrderStatus.COMPLETED]: "ผู้ซื้อมารับสินค้าแล้ว",
    [OrderStatus.CANCELED]: "ยกเลิก",
};

// จัดทรงออเดอร์ส่งให้ Frontend (แนบ enum + ข้อความไทย + expireAt ถ้าจำเป็น)
const shapeOrder = (o, { withExpire = false } = {}) => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const expireAt =
        withExpire && o.orderStatus === OrderStatus.CONFIRMED
            ? new Date(o.updatedAt.getTime() + 3 * DAY_MS)
            : null;

    return {
        id: o.id,
        cartTotal: o.cartTotal,
        orderStatusEnum: o.orderStatus,
        orderStatusText: STATUS_TEXT[o.orderStatus],
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        expireAt: expireAt ?? null,

        pickupPlace: o.pickupPlace ?? null,
        pickupAt: o.pickupAt ?? null,
        pickupNote: o.pickupNote ?? null,

        products: (o.products || []).map((line) => ({
            id: line.id,
            count: line.count,
            price: line.price,
            variantId: line.variantId,
            productTitle: line.productTitle ?? "-",
            sizeName: line.sizeName ?? line.variant?.size?.name ?? "-",
            generationName: line.generationName ?? line.variant?.generation?.name ?? "-",
            imageUrl: line.variant?.product?.images?.[0]?.url ?? null,
            variant: line.variant,
        })),
    };
};

// ======================= Users =======================
exports.listUsers = async (req, res) => {
    try {
        const users = await prisma.users.findMany({
            select: {
                id: true,
                email: true,
                role: true,
                phone: true,
                id_card: true,
                enabled: true,
            },
        });
        res.json(users);
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server Error" });
    }
};

exports.changeStatus = async (req, res) => {
    try {
        const { id, enabled } = req.body;
        await prisma.users.update({
            where: { id: Number(id) },
            data: { enabled: !!enabled },
        });
        res.send("updateStatus OK");
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server Error" });
    }
};

exports.changeRole = async (req, res) => {
    try {
        const { id, role } = req.body;
        await prisma.users.update({
            where: { id: Number(id) },
            data: { role },
        });
        res.send("updaterole OK");
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server Error" });
    }
};

// ======================= Cart =======================
exports.userCart = async (req, res) => {
    try {
        const { cart } = req.body;
        if (!Array.isArray(cart)) {
            return res.status(400).json({ message: "cart must be an array" });
        }

        const userId = Number(req.user.id);
        const user = await prisma.users.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: "user not found" });

        // ลบ cart เดิม
        const oldCart = await prisma.cart.findFirst({
            where: { orderById: userId },
            select: { id: true },
        });
        if (oldCart) {
            await prisma.productOnCart.deleteMany({ where: { cartId: oldCart.id } });
            await prisma.cart.delete({ where: { id: oldCart.id } });
        }

        const items = cart.map((c) => {
            if (!c.variantId || !c.count || !c.price) {
                throw new Error("cart item missing variantId/count/price");
            }
            return {
                variant: { connect: { id: Number(c.variantId) } },
                productTitle: String(c.productTitle ?? ""),
                sizeName: String(c.sizeName ?? ""),
                generationName: c.generationName ? String(c.generationName) : null,
                price: Number(c.price),
                count: Number(c.count),
            };
        });

        const cartTotal = cart.reduce(
            (sum, i) => sum + Number(i.price || 0) * Number(i.count || 0),
            0
        );

        await prisma.cart.create({
            data: {
                orderBuy: { connect: { id: userId } },
                cartTotal: Number(cartTotal),
                products: { create: items },
            },
        });

        res.json({ ok: true, message: "userCart OK" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
};

exports.getUserCart = async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const cart = await prisma.cart.findFirst({
            where: { orderById: userId },
            include: {
                products: {
                    include: {
                        variant: {
                            include: {
                                product: { include: { images: true } },
                                size: true,
                                generation: true,
                            },
                        },
                    },
                    orderBy: { id: "asc" },
                },
            },
        });

        if (!cart) {
            return res.json({ products: [], cartTotal: 0 });
        }

        res.json({
            products: cart.products,
            cartTotal: cart.cartTotal,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
};

exports.emptyCart = async (req, res) => {
    try {
        const cart = await prisma.cart.findFirst({
            where: { orderById: Number(req.user.id) },
        });
        if (!cart) return res.status(400).json({ message: "no cart" });

        await prisma.productOnCart.deleteMany({ where: { cartId: cart.id } });
        const result = await prisma.cart.deleteMany({
            where: { orderById: Number(req.user.id) },
        });

        res.json({
            message: "cart empty ok",
            deleteCount: result.count,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
};

// ======================= Orders =======================
exports.saveOrder = async (req, res) => {
    try {
        const userId = Number(req.user.id);

        const cart = await prisma.cart.findFirst({
            where: { orderById: userId },
            include: { products: { include: { variant: true } } },
        });
        if (!cart || cart.products.length === 0) {
            return res.status(400).json({ message: "no cart" });
        }

        // ตรวจสต็อก
        for (const line of cart.products) {
            if (!line.variantId) {
                return res.status(400).json({ message: "missing variant in cart" });
            }
            const v = await prisma.productVariant.findUnique({
                where: { id: Number(line.variantId) },
                select: { id: true, quantity: true, productId: true },
            });
            if (!v) {
                return res
                    .status(400)
                    .json({ message: `variant ${line.variantId} not found` });
            }
            if (Number(line.count) > Number(v.quantity)) {
                return res.status(400).json({ message: "สินค้าไม่พอต่อการสั่งซื้อ" });
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1) สร้างออเดอร์เริ่มต้น PENDING
            const order = await tx.order.create({
                data: {
                    orderBuy: { connect: { id: userId } },
                    cartTotal: Number(cart.cartTotal || 0),
                    orderStatus: OrderStatus.PENDING,
                    products: {
                        create: cart.products.map((line) => ({
                            variant: { connect: { id: Number(line.variantId) } },
                            productTitle: String(line.productTitle || ""),
                            sizeName: String(line.sizeName || ""),
                            generationName: line.generationName
                                ? String(line.generationName)
                                : null,
                            price: Number(line.price || 0),
                            count: Number(line.count || 0),
                        })),
                    },
                },
                include: {
                    products: {
                        include: {
                            variant: {
                                include: {
                                    product: { include: { images: true } },
                                    size: true,
                                    generation: true,
                                },
                            },
                        },
                    },
                },
            });

            // 2) ตัดสต็อก/เพิ่ม sold
            for (const line of cart.products) {
                const v = await tx.productVariant.findUnique({
                    where: { id: Number(line.variantId) },
                    select: { id: true, productId: true },
                });
                if (!v) throw new Error(`variant ${line.variantId} not found in tx`);

                await tx.productVariant.update({
                    where: { id: v.id },
                    data: { quantity: { decrement: Number(line.count) } },
                });

                await tx.product.update({
                    where: { id: v.productId },
                    data: { sold: { increment: Number(line.count) } },
                });
            }

            // 3) ลบ cart
            await tx.productOnCart.deleteMany({ where: { cartId: cart.id } });
            await tx.cart.delete({ where: { id: cart.id } });

            return order;
        });

        return res.json({ ok: true, order: shapeOrder(result) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
};

exports.getOrder = async (req, res) => {
    try {
        const userId = Number(req.user.id);

        // ✅ ใช้ enum จริง กรอง Completed/Canceled ออกให้ถูกต้อง
        const orders = await prisma.order.findMany({
            where: {
                orderById: userId,
                orderStatus: { notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELED] },
            },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                cartTotal: true,
                orderStatus: true,
                createdAt: true,
                updatedAt: true,

                pickupPlace: true,
                pickupAt: true,
                pickupNote: true,

                products: {
                    select: {
                        id: true,
                        count: true,
                        price: true,
                        variantId: true,
                        productTitle: true,
                        sizeName: true,
                        generationName: true,
                        variant: {
                            select: {
                                id: true,
                                product: { select: { images: { select: { url: true }, take: 1 } } },
                                size: { select: { name: true } },
                                generation: { select: { name: true } },
                            },
                        },
                    },
                    orderBy: { id: "asc" },
                },
            },
        });

        // ✅ แปลงรูปแบบตอบกลับให้สอดคล้อง UI + คำนวณ expireAt เมื่อ CONFIRMED
        const shaped = orders.map((o) => shapeOrder(o, { withExpire: true }));

        return res.json({ ok: true, order: shaped });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
};

exports.cancelMyOrder = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const userId = Number(req.user?.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res
                .status(400)
                .json({ message: "รูปแบบหมายเลขออเดอร์ไม่ถูกต้อง" });
        }
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(401).json({ message: "ไม่พบผู้ใช้จาก token" });
        }

        const order = await prisma.order.findFirst({
            where: { id, orderById: userId },
            select: {
                id: true,
                orderStatus: true,
                products: { select: { variantId: true, count: true } },
            },
        });
        if (!order) {
            return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });
        }

        if (order.orderStatus !== OrderStatus.PENDING) {
            return res.status(400).json({ message: "ยกเลิกไม่ได้ในสถานะปัจจุบัน" });
        }

        await prisma.$transaction(async (tx) => {
            // คืนสต็อก
            for (const line of order.products) {
                const qty = Number(line.count) || 0;
                if (qty > 0 && Number.isInteger(line.variantId)) {
                    await tx.productVariant.updateMany({
                        where: { id: line.variantId },
                        data: { quantity: { increment: qty } },
                    });
                }
            }

            // อัปเดตสถานะเป็น CANCELED
            await tx.order.update({
                where: { id: order.id },
                data: {
                    orderStatus: OrderStatus.CANCELED,
                    canceledAt: new Date(),
                },
            });
        });

        return res.json({ ok: true, message: "ยกเลิกออเดอร์แล้ว" });
    } catch (e) {
        console.error("cancelMyOrder error:", e);
        const msg =
            e?.code === "P2025"
                ? "ไม่พบข้อมูลที่ต้องการอัปเดต"
                : e?.message || "Server Error";
        return res.status(500).json({ message: msg });
    }
};

exports.cancelAndDeleteMyOrder = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const userId = Number(req.user?.id);
        if (!Number.isInteger(id) || id <= 0)
            return res
                .status(400)
                .json({ message: "รูปแบบหมายเลขออเดอร์ไม่ถูกต้อง" });
        if (!Number.isInteger(userId) || userId <= 0)
            return res.status(401).json({ message: "ไม่พบผู้ใช้จาก token" });

        const EXPIRE_SECONDS = 0; // ปรับได้ตามนโยบาย

        const order = await prisma.order.findFirst({
            where: { id, orderById: userId },
            select: {
                id: true,
                orderStatus: true,
                updatedAt: true,
                products: { select: { variantId: true, count: true } },
            },
        });
        if (!order) return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });

        let allowed = false;
        if (order.orderStatus === OrderStatus.PENDING) {
            allowed = true;
        } else if (order.orderStatus === OrderStatus.CONFIRMED) {
            const expireAt = new Date(order.updatedAt.getTime() + EXPIRE_SECONDS * 1000);
            if (Date.now() >= expireAt.getTime()) allowed = true;
        }

        if (!allowed) {
            return res
                .status(400)
                .json({ message: "ลบไม่ได้ในสถานะ/ระยะเวลาปัจจุบัน" });
        }

        await prisma.$transaction(async (tx) => {
            // คืนสต็อก
            for (const line of order.products) {
                const qty = Number(line.count) || 0;
                if (qty > 0 && Number.isInteger(line.variantId)) {
                    await tx.productVariant.updateMany({
                        where: { id: line.variantId },
                        data: { quantity: { increment: qty } },
                    });
                }
            }

            // ลบลูกก่อน
            await tx.productOnOrder.deleteMany({ where: { orderId: order.id } });

            // ลบออเดอร์
            await tx.order.delete({ where: { id: order.id } });
        });

        return res.json({ ok: true, removedId: id, message: "ลบออเดอร์แล้ว" });
    } catch (e) {
        console.error("cancelAndDeleteMyOrder error:", e);
        const msg =
            e?.code === "P2025"
                ? "ไม่พบข้อมูลที่ต้องการลบ"
                : e?.message || "Server Error";
        return res.status(500).json({ message: msg });
    }
};

exports.getOrderHistory = async (req, res) => {
    try {
        const userId = Number(req.user.id);

        const orders = await prisma.order.findMany({
            where: {
                orderById: userId,
                orderStatus: { in: [OrderStatus.COMPLETED, OrderStatus.CANCELED] },
            },
            orderBy: { updatedAt: "desc" },
            select: {
                id: true,
                cartTotal: true,
                orderStatus: true,
                createdAt: true,
                updatedAt: true,

                cancelReason: true,
                cancelNote: true,
                canceledAt: true,

                products: {
                    select: {
                        id: true,
                        count: true,
                        price: true,
                        variantId: true,
                        productTitle: true,
                        sizeName: true,
                        generationName: true,
                        variant: {
                            select: {
                                id: true,
                                product: {
                                    select: { images: { select: { url: true }, take: 1 } },
                                },
                                size: { select: { name: true } },
                                generation: { select: { name: true } },
                            },
                        },
                    },
                    orderBy: { id: "asc" },
                },
            },
        });

        const shaped = orders.map((o) => {
            const base = shapeOrder(o);
            return {
                ...base,
                completedAt:
                    o.orderStatus === OrderStatus.COMPLETED ? o.updatedAt : null,
                canceledAt:
                    o.orderStatus === OrderStatus.CANCELED
                        ? o.canceledAt ?? o.updatedAt
                        : null,
                cancelReason: o.cancelReason ?? null,
                cancelNote: o.cancelNote ?? null,
            };
        });

        return res.json({ ok: true, order: shaped });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
};

// ======================= Profile (ตัด address ออก) =======================
exports.profile = async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const user = await prisma.users.findUnique({
            where: { id: userId },
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
            },
        });
        if (!user) return res.status(404).json({ message: "ไม่พบผู้ใช้" });
        res.json({ ok: true, user });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Server Error" });
    }
};

exports.updateprofile = async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const { first_name, last_name, phone, id_card, email } = req.body || {};

        const data = {};
        if (first_name != null) data.first_name = String(first_name).trim();
        if (last_name != null) data.last_name = String(last_name).trim();
        if (phone != null) data.phone = String(phone).trim();
        if (id_card != null) data.id_card = String(id_card).trim();
        if (email != null) data.email = String(email).trim().toLowerCase();

        const updated = await prisma.users.update({
            where: { id: userId },
            data,
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
            },
        });

        res.json({ ok: true, user: updated, message: "อัปเดตโปรไฟล์แล้ว" });
    } catch (e) {
        console.error(e);
        if (e?.code === "P2002")
            return res.status(400).json({ message: "อีเมลนี้ถูกใช้แล้ว" });
        res.status(500).json({ message: "Server Error" });
    }
};

// ======================= Password (current -> new) =======================
exports.changePassword = async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const { currentPassword, newPassword } = req.body || {};
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "กรอกรหัสผ่านให้ครบ" });
        }
        if (String(newPassword).length < 6) {
            return res
                .status(400)
                .json({ message: "รหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร" });
        }

        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { password: true },
        });
        if (!user) return res.status(404).json({ message: "ไม่พบผู้ใช้" });

        const ok = await bcrypt.compare(String(currentPassword), user.password);
        if (!ok) return res.status(400).json({ message: "รหัสผ่านเดิมไม่ถูกต้อง" });

        const hashed = await bcrypt.hash(String(newPassword), 10);
        await prisma.users.update({
            where: { id: userId },
            data: { password: hashed },
        });

        res.json({ ok: true, message: "เปลี่ยนรหัสผ่านสำเร็จ" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Server Error" });
    }
};

// ======================= Reset Password (ลิงก์ token) =======================
// หมายเหตุ: ส่วนนี้พึ่งพาโมเดล passwordReset ในฐานข้อมูลของคุณ
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email) return res.status(400).json({ message: "กรอกอีเมล" });

        const normEmail = String(email).trim().toLowerCase();
        const user = await prisma.users.findUnique({
            where: { email: normEmail },
            select: { id: true, first_name: true, email: true },
        });

        const generic = {
            ok: true,
            message: "ถ้ามีบัญชีนี้ เราจะส่งลิงก์รีเซ็ตไปยังอีเมล",
        };

        if (!user) {
            if (process.env.NODE_ENV !== "production") {
                return res.json({
                    ...generic,
                    debug: { smtpReady: isSMTPReady(), sent: false },
                });
            }
            return res.json(generic);
        }

        await prisma.passwordReset.deleteMany({
            where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
        });

        const rawToken = crypto.randomBytes(48).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        const expire = new Date(Date.now() + 60 * 60 * 1000);

        await prisma.passwordReset.create({
            data: { userId: user.id, tokenHash, expiresAt: expire },
        });

        const linkBase = process.env.FRONTEND_URL || "http://localhost:5173";
        const resetLink = `${linkBase}/reset-password?token=${encodeURIComponent(
            rawToken
        )}`;

        let sent = false;
        try {
            const info = await sendMail({
                to: user.email,
                subject: "รีเซ็ตรหัสผ่าน",
                html: `
          <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto;">
            <h2>รีเซ็ตรหัสผ่าน</h2>
            <p>สวัสดี ${user.first_name || ""}</p>
            <p>คลิกลิงก์ด้านล่างเพื่อรีเซ็ตรหัสผ่านของคุณ (ภายใน 1 ชั่วโมง)</p>
            <p><a href="${resetLink}" target="_blank" rel="noreferrer noopener">${resetLink}</a></p>
            <p>หากคุณไม่ได้เป็นผู้ร้องขอ ให้เพิกเฉยอีเมลนี้</p>
          </div>
        `,
            });
            sent = info && info.dev !== true;
        } catch (err) {
            console.error("[forgotPassword] sendMail error:", err?.message || err);
            sent = false;
        }

        if (process.env.NODE_ENV !== "production") {
            return res.json({
                ...generic,
                debug: {
                    smtpReady: isSMTPReady(),
                    sent,
                    devLink: sent ? null : resetLink,
                    to: user.email,
                },
            });
        }
        return res.json(generic);
    } catch (e) {
        console.error("forgotPassword error:", e);
        return res.status(500).json({ message: "Server Error" });
    }
};

exports.validateResetToken = async (req, res) => {
    try {
        const { token } = req.body || {};
        if (!token) return res.status(400).json({ message: "ไม่มี token" });
        const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");

        const rec = await prisma.passwordReset.findUnique({
            where: { tokenHash },
            select: { id: true, userId: true, expiresAt: true, usedAt: true },
        });
        if (!rec || rec.usedAt || rec.expiresAt <= new Date()) {
            return res.status(400).json({ message: "ลิงก์หมดอายุหรือไม่ถูกต้อง" });
        }
        return res.json({ ok: true });
    } catch (e) {
        console.error("validateResetToken error:", e);
        return res.status(500).json({ message: "Server Error" });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body || {};
        if (!token || !newPassword)
            return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
        if (String(newPassword).length < 6)
            return res
                .status(400)
                .json({ message: "รหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร" });

        const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
        const rec = await prisma.passwordReset.findUnique({
            where: { tokenHash },
            select: { id: true, userId: true, expiresAt: true, usedAt: true },
        });
        if (!rec || rec.usedAt || rec.expiresAt <= new Date()) {
            return res.status(400).json({ message: "ลิงก์หมดอายุหรือไม่ถูกต้อง" });
        }

        const hashed = await bcrypt.hash(String(newPassword), 10);

        await prisma.$transaction(async (tx) => {
            await tx.users.update({
                where: { id: rec.userId },
                data: { password: hashed },
            });
            await tx.passwordReset.update({
                where: { tokenHash },
                data: { usedAt: new Date() },
            });
            await tx.passwordReset.deleteMany({
                where: {
                    userId: rec.userId,
                    usedAt: null,
                    expiresAt: { gt: new Date() },
                    NOT: { tokenHash },
                },
            });
        });

        return res.json({ ok: true, message: "รีเซ็ตรหัสผ่านสำเร็จ" });
    } catch (e) {
        console.error("resetPassword error:", e);
        return res.status(500).json({ message: "Server Error" });
    }
};

// ======================= Reset Password (OTP) =======================
exports.requestPasswordOtp = async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email) return res.status(400).json({ message: "กรอกอีเมล" });

        const normEmail = String(email).trim().toLowerCase();
        const user = await prisma.users.findUnique({
            where: { email: normEmail },
            select: { id: true, first_name: true, email: true },
        });

        const generic = { ok: true, message: "ถ้ามีบัญชีนี้ เราจะส่งรหัสให้ทางอีเมล" };
        if (!user) return res.json(generic);

        // จำกัดความถี่ 1 นาที
        const oneMinAgo = new Date(Date.now() - 60 * 1000);
        const recent = await prisma.passwordOTP.findFirst({
            where: {
                userId: user.id,
                purpose: "reset",
                createdAt: { gt: oneMinAgo },
                usedAt: null,
            },
            select: { id: true },
        });
        if (recent) return res.json(generic);

        // ล้าง OTP ค้าง
        await prisma.passwordOTP.deleteMany({
            where: {
                userId: user.id,
                purpose: "reset",
                usedAt: null,
                expiresAt: { gt: new Date() },
            },
        });

        // สร้าง OTP อายุ 10 นาที
        const code = genOtp();
        const codeHash = hash(code);
        const expires = new Date(Date.now() + 10 * 60 * 1000);
        await prisma.passwordOTP.create({
            data: { userId: user.id, codeHash, purpose: "reset", expiresAt: expires },
        });

        const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto">
        <h2>รหัสยืนยัน (OTP)</h2>
        <p>สวัสดี ${user.first_name || ""}</p>
        <p>รหัสยืนยันของคุณคือ:</p>
        <div style="font-size:20px;font-weight:700;letter-spacing:2px;">${code}</div>
        <p>รหัสดังกล่าวมีอายุ 10 นาที</p>
        <p>หากไม่ได้ร้องขอ โปรดเมินอีเมลนี้</p>
      </div>
    `;

        if (isSMTPReady()) {
            await sendMail({
                to: user.email,
                subject: "รหัสยืนยันรีเซ็ตรหัสผ่าน",
                html,
            });
            return res.json(generic);
        } else {
            // DEV เท่านั้น
            return res.json({ ...generic, devCode: code });
        }
    } catch (e) {
        console.error("requestPasswordOtp error:", e);
        return res.status(500).json({ message: "Server Error" });
    }
};

exports.verifyResetOtp = async (req, res) => {
    try {
        const { email, code } = req.body || {};
        if (!email || !code)
            return res.status(400).json({ message: "ข้อมูลไม่ครบ" });

        const normEmail = String(email).trim().toLowerCase();
        const user = await prisma.users.findUnique({
            where: { email: normEmail },
            select: { id: true, email: true },
        });

        const genericFail = { ok: false, message: "รหัสไม่ถูกต้อง หรือหมดอายุ" };
        if (!user) return res.status(400).json(genericFail);

        const row = await prisma.passwordOTP.findFirst({
            where: {
                userId: user.id,
                purpose: "reset",
                usedAt: null,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: "desc" },
        });
        if (!row) return res.status(400).json(genericFail);

        if (row.attempts >= 5) {
            return res
                .status(400)
                .json({ ok: false, message: "พยายามเกินกำหนด กรุณาขอรหัสใหม่" });
        }

        const ok = row.codeHash === hash(code);
        if (!ok) {
            await prisma.passwordOTP.update({
                where: { id: row.id },
                data: { attempts: { increment: 1 } },
            });
            return res.status(400).json(genericFail);
        }

        await prisma.passwordOTP.update({
            where: { id: row.id },
            data: { usedAt: new Date() },
        });

        const otpToken = jwt.sign(
            { sub: user.id, purpose: "pwd_reset_otp" },
            process.env.SECRET || "dev_secret",
            { expiresIn: "15m" }
        );

        return res.json({ ok: true, otpToken });
    } catch (e) {
        console.error("verifyResetOtp error:", e);
        return res.status(500).json({ message: "Server Error" });
    }
};

exports.resetPasswordWithOtp = async (req, res) => {
    try {
        const { otpToken, password } = req.body || {};
        if (!otpToken || !password)
            return res.status(400).json({ message: "ข้อมูลไม่ครบ" });

        let payload;
        try {
            payload = jwt.verify(otpToken, process.env.SECRET || "dev_secret");
        } catch {
            return res.status(400).json({ message: "โทเคนไม่ถูกต้องหรือหมดอายุ" });
        }
        if (payload?.purpose !== "pwd_reset_otp") {
            return res.status(400).json({ message: "โทเคนไม่ถูกต้อง" });
        }

        const userId = Number(payload.sub);
        if (!Number.isFinite(userId))
            return res.status(400).json({ message: "โทเคนไม่ถูกต้อง" });

        const hashPw = await bcrypt.hash(String(password), 10);

        await prisma.users.update({
            where: { id: userId },
            data: { password: hashPw },
        });

        return res.json({ ok: true, message: "ตั้งรหัสผ่านใหม่สำเร็จ" });
    } catch (e) {
        console.error("resetPasswordWithOtp error:", e);
        return res.status(500).json({ message: "Server Error" });
    }
};

exports.getMyStatus = async (req, res) => {
    try {
        const uid = req.user?.id;
        if (!uid) return res.status(401).json({ message: 'unauthenticated' });

        const me = await prisma.users.findUnique({
            where: { id: uid },
            select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
                role: true,
                enabled: true,
                bannedAt: true,
                banReason: true,
                updatedAt: true,
            },
        });

        if (!me) return res.status(404).json({ message: 'not found' });
        return res.json({ ok: true, me });
    } catch (e) {
        console.error('[getMyStatus]', e);
        res.status(500).json({ message: 'Server Error' });
    }
};