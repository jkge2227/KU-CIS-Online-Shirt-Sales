const prisma = require("../config/prisma")
const router = require("../routes/user")
const { create } = require("./product")
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendMail, isSMTPReady } = require('../config/mailer');

const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const genOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const norm = (s) => String(s || "").trim().toLowerCase();

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


      }
    })
    res.json(users)
  } catch (err) {
    console.log(err)
    res.status(500).json({ message: "Server Error" })
  }
}

exports.changeStatus = async (req, res) => {
  try {

    const { id, enabled } = req.body
    console.log(id, enabled)
    const user = await prisma.users.update({
      where: { id: Number(id) },
      data: { enabled: enabled }
    })
    res.send('updateStatus OK')

  } catch (err) {
    console.log(err)
    res.status(500).json({ message: "Server Error" })
  }
}

exports.changeRole = async (req, res) => {
  try {
    const { id, role } = req.body
    const user = await prisma.users.update({
      where: { id: Number(id) },
      data: { role: role }
    })
    res.send('updaterole OK')

  } catch (err) {
    console.log(err)
    res.status(500).json({ message: "Server Error" })
  }
}

exports.userCart = async (req, res) => {
  try {
    const { cart } = req.body;
    if (!Array.isArray(cart)) {
      return res.status(400).json({ message: 'cart must be an array' });
    }

    const userId = Number(req.user.id);

    // ตรวจสอบ user
    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'user not found' });

    // ลบ cart เก่า (ต้องลบ items ก่อนเพราะ FK)
    const oldCart = await prisma.cart.findFirst({
      where: { orderById: userId },
      select: { id: true },
    });
    if (oldCart) {
      await prisma.productOnCart.deleteMany({ where: { cartId: oldCart.id } });
      await prisma.cart.delete({ where: { id: oldCart.id } });
    }

    // เตรียมรายการ productOnCart ตาม variant
    const items = cart.map((c) => {
      if (!c.variantId || !c.count || !c.price) {
        throw new Error('cart item missing variantId/count/price');
      }
      return {
        variant: { connect: { id: Number(c.variantId) } },
        // แคชเพื่อแสดงผล/กันข้อมูลเปลี่ยน
        productTitle: String(c.productTitle ?? ''),
        sizeName: String(c.sizeName ?? ''),
        generationName: c.generationName ? String(c.generationName) : null,
        price: Number(c.price),
        count: Number(c.count),
      };
    });

    const cartTotal = cart.reduce(
      (sum, i) => sum + Number(i.price || 0) * Number(i.count || 0),
      0
    );

    // สร้าง cart ใหม่
    await prisma.cart.create({
      data: {
        orderBuy: { connect: { id: userId } },
        cartTotal: Number(cartTotal),
        products: { create: items },
      },
    });

    res.json({ ok: true, message: 'userCart OK' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
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
                product: {
                  include: { images: true }, // <<--- เพิ่มรูป
                },
                size: true,
                generation: true,
              },
            },
          },
          orderBy: { id: 'asc' },
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
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.emptyCart = async (req, res) => {
  try {
    const cart = await prisma.cart.findFirst({
      where: { orderById: Number(req.user.id) }
    });
    if (!cart) return res.status(400).json({ message: 'no cart' });

    await prisma.productOnCart.deleteMany({
      where: { cartId: cart.id }
    });
    const result = await prisma.cart.deleteMany({
      where: { orderById: Number(req.user.id) }
    });

    res.json({
      message: 'cart empty ok',
      deleteCount: result.count
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.saveAddress = async (req, res) => {
  try {
    const { address } = req.body
    console.log(address)
    const addressUser = await prisma.users.update({
      where: {
        id: Number(req.user.id)
      },
      data: {
        address: address
      }
    })
    res.json({ ok: true, message: 'Address update ok' })

  } catch (err) {
    console.log(err)
    res.status(500).json({ message: "Server Error" })
  }
}

exports.saveOrder = async (req, res) => {
  try {
    const userId = Number(req.user.id);

    // โหลด cart + items
    const cart = await prisma.cart.findFirst({
      where: { orderById: userId },
      include: { products: { include: { variant: true } } },
    });
    if (!cart || cart.products.length === 0) {
      return res.status(400).json({ message: 'no cart' });
    }

    // ตรวจสต็อกของแต่ละ variant
    for (const line of cart.products) {
      if (!line.variantId) {
        return res.status(400).json({ message: 'missing variant in cart' });
      }
      const v = await prisma.productVariant.findUnique({
        where: { id: Number(line.variantId) },
        select: { id: true, quantity: true, productId: true },
      });
      if (!v) {
        return res.status(400).json({ message: `variant ${line.variantId} not found` });
      }
      if (Number(line.count) > Number(v.quantity)) {
        return res.status(400).json({ message: 'สินค้าไม่พอต่อการสั่งซื้อ' });
      }
    }

    // ทำธุรกรรม: สร้าง order + ตัดสต็อก + ลบ cart
    const result = await prisma.$transaction(async (tx) => {
      // 1) สร้าง Order + Lines (ผูก variant)
      const order = await tx.order.create({
        data: {
          orderBuy: { connect: { id: userId } },
          cartTotal: Number(cart.cartTotal || 0),
          orderStatus: "กำลังรับออเดอร์",
          products: {
            create: cart.products.map((line) => ({
              variant: { connect: { id: Number(line.variantId) } },
              productTitle: String(line.productTitle || ''),
              sizeName: String(line.sizeName || ''),
              generationName: line.generationName ? String(line.generationName) : null,
              price: Number(line.price || 0),
              count: Number(line.count || 0),
            })),
          },
        },
        include: { products: true },
      });


      // 2) ตัดสต็อกที่ ProductVariant และ +sold ที่ Product
      for (const line of cart.products) {
        const v = await tx.productVariant.findUnique({
          where: { id: Number(line.variantId) },
          select: { id: true, quantity: true, productId: true },
        });
        if (!v) throw new Error(`variant ${line.variantId} not found in tx`);

        // ตัดสต็อก variant
        await tx.productVariant.update({
          where: { id: v.id },
          data: { quantity: { decrement: Number(line.count) } },
        });

        // เพิ่มยอดขายให้ product หลัก
        await tx.product.update({
          where: { id: v.productId },
          data: {
            sold: { increment: Number(line.count) },
            // ถ้าคุณไม่ใช้ product.quantity เป็นสต็อกรวม สามารถไม่ decrement ตรงนี้ก็ได้
            // quantity: { decrement: Number(line.count) },
          },
        });
      }

      // 3) ลบ cart (items ก่อน แล้ว cart)
      await tx.productOnCart.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.delete({ where: { id: cart.id } });

      return order;
    });

    return res.json({ ok: true, order: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// exports.getOrder = async (req, res) => {
//   try {
//     const userId = Number(req.user.id);
//     const READY_STATUS_TH = "รับออเดอร์เสร็จสิ้น";
//     const DAY_MS = 24 * 60 * 60 * 1000; // 1 วัน = 24 ชั่วโมง

//     const orders = await prisma.order.findMany({
//       where: { orderById: userId },
//       orderBy: { createdAt: 'desc' },
//       select: {
//         id: true,
//         cartTotal: true,
//         orderStatus: true,
//         createdAt: true,
//         updatedAt: true,
//         products: {
//           select: {
//             id: true,
//             count: true,
//             price: true,
//             variantId: true,
//             productTitle: true,
//             sizeName: true,
//             generationName: true,
//             variant: {
//               select: {
//                 id: true,
//                 product: { select: { images: { select: { url: true }, take: 1 } } },
//                 size: { select: { name: true } },
//                 generation: { select: { name: true } },
//               }
//             }
//           }
//         }
//       }
//     });

//     const shaped = orders.map(o => {
//       const expireAt =
//         o.orderStatus === READY_STATUS_TH
//           ? new Date(o.updatedAt.getTime() + 3 * DAY_MS) // ✅ 3 วันหลังจาก updatedAt
//           : null;

//       return {
//         id: o.id,
//         cartTotal: o.cartTotal,
//         orderStatus: o.orderStatus,
//         createdAt: o.createdAt,
//         expireAt,
//         products: o.products.map(line => ({
//           id: line.id,
//           count: line.count,
//           price: line.price,
//           variantId: line.variantId,
//           productTitle: line.productTitle ?? line.variant?.productTitle ?? "-",
//           sizeName: line.sizeName ?? line.variant?.size?.name ?? "-",
//           generationName: line.generationName ?? line.variant?.generation?.name ?? "-",
//           imageUrl: line.variant?.product?.images?.[0]?.url ?? null,
//           variant: line.variant,
//         }))
//       };
//     });

//     return res.json({ ok: true, order: shaped });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ message: "Server Error" });
//   }
// };

exports.getOrder = async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const READY_STATUS_TH = "รับออเดอร์เสร็จสิ้น";
    const DAY_MS = 24 * 60 * 60 * 1000;

    // ✅ ตัด Completed ออกจากผลลัพธ์
    const orders = await prisma.order.findMany({
      where: {
        orderById: userId,
        orderStatus: { notIn: ["คำสั่งซื้อสำเร็จ", "completed", "Completed"] },
      },
      orderBy: { createdAt: 'desc' },
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
              }
            }
          },
          orderBy: { id: 'asc' },
        }
      }
    });

    const shaped = orders.map(o => {
      const expireAt =
        o.orderStatus === READY_STATUS_TH
          ? new Date(o.updatedAt.getTime() + 3 * DAY_MS)
          : null;

      return {
        id: o.id,
        cartTotal: o.cartTotal,
        orderStatus: o.orderStatus,
        createdAt: o.createdAt,
        expireAt,

        pickupPlace: o.pickupPlace,
        pickupAt: o.pickupAt,
        pickupNote: o.pickupNote,

        products: o.products.map(line => ({
          id: line.id,
          count: line.count,
          price: line.price,
          variantId: line.variantId,
          productTitle: line.productTitle ?? "-",
          sizeName: line.sizeName ?? line.variant?.size?.name ?? "-",
          generationName: line.generationName ?? line.variant?.generation?.name ?? "-",
          imageUrl: line.variant?.product?.images?.[0]?.url ?? null,
          variant: line.variant,
        }))
      };
    });

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
      return res.status(400).json({ message: "รูปแบบหมายเลขออเดอร์ไม่ถูกต้อง" });
    }
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ message: "ไม่พบผู้ใช้จาก token" });
    }

    // ดึงออเดอร์ของผู้ใช้ พร้อมรายการสินค้า (เอาเฉพาะที่ต้องใช้)
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

    const st = norm(order.orderStatus);
    const canCancel = st === "กำลังรับออเดอร์";
    if (!canCancel) {
      return res.status(400).json({ message: "ยกเลิกไม่ได้ในสถานะปัจจุบัน" });
    }

    await prisma.$transaction(async (tx) => {
      // คืนสต็อคแบบ updateMany (จะไม่ throw ถ้า id ไม่พบ)
      for (const line of order.products) {
        const qty = Number(line.count) || 0;
        if (qty > 0 && Number.isInteger(line.variantId)) {
          await tx.productVariant.updateMany({
            where: { id: line.variantId },
            data: { quantity: { increment: qty } },
          });
        }
      }

      // อัปเดตสถานะ
      await tx.order.update({
        where: { id: order.id },
        data: { orderStatus: "ยกเลิก" }, // เปลี่ยนเป็น "Cancelled" ถ้าต้องการอังกฤษ
      });
    });

    return res.json({ ok: true, message: "ยกเลิกออเดอร์แล้ว" });
  } catch (e) {
    console.error("cancelMyOrder error:", e);
    // แปะ error code ของ Prisma บางตัวให้ debug ง่ายขึ้น
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
      return res.status(400).json({ message: "รูปแบบหมายเลขออเดอร์ไม่ถูกต้อง" });
    if (!Number.isInteger(userId) || userId <= 0)
      return res.status(401).json({ message: "ไม่พบผู้ใช้จาก token" });

    const READY_STATUS_TH = "รับออเดอร์เสร็จสิ้น";
    const EXPIRE_SECONDS = 0;

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

    const st = norm(order.orderStatus);
    let allowed = false;

    if (st === "กำลังรับออเดอร์") {
      allowed = true;
    } else if (st === norm(READY_STATUS_TH)) {
      const expireAt = new Date(order.updatedAt.getTime() + EXPIRE_SECONDS * 1000);
      if (Date.now() >= expireAt.getTime()) allowed = true;
    }

    if (!allowed) {
      return res.status(400).json({ message: "ลบไม่ได้ในสถานะ/ระยะเวลาปัจจุบัน" });
    }

    await prisma.$transaction(async (tx) => {
      // 1) คืนสต็อก
      for (const line of order.products) {
        const qty = Number(line.count) || 0;
        if (qty > 0 && Number.isInteger(line.variantId)) {
          await tx.productVariant.updateMany({
            where: { id: line.variantId },
            data: { quantity: { increment: qty } },
          });
        }
      }

      // 2) ลบรายการลูกก่อน (กัน FK ล้ม)
      // หมายเหตุ: ชื่อ delegate ของ Prisma จะเป็น productOnOrder ตามโมเดล productonorder
      await tx.productOnOrder.deleteMany({
        where: { orderId: order.id },
      });

      // 3) ลบออเดอร์
      await tx.order.delete({ where: { id: order.id } });
    });

    return res.json({ ok: true, removedId: id, message: "ลบออเดอร์แล้ว" });
  } catch (e) {
    console.error("cancelAndDeleteMyOrder error:", e);
    const msg = e?.code === "P2025" ? "ไม่พบข้อมูลที่ต้องการลบ" : (e?.message || "Server Error");
    return res.status(500).json({ message: msg });
  }
};

exports.getOrderHistory = async (req, res) => {
  try {
    const userId = Number(req.user.id);

    // รองรับหลายรูปแบบตัวสะกด/ภาษา
    const COMPLETED = ["คำสั่งซื้อสำเร็จ", "completed", "Completed"];

    const orders = await prisma.order.findMany({
      where: {
        orderById: userId,
        orderStatus: { in: COMPLETED },
      },
      orderBy: { updatedAt: "desc" }, // ใช้เวลาสำเร็จล่าสุด
      select: {
        id: true,
        cartTotal: true,
        orderStatus: true,
        createdAt: true,
        updatedAt: true, // ใช้เป็น completedAt
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

    const shaped = orders.map((o) => ({
      id: o.id,
      cartTotal: o.cartTotal,
      orderStatus: o.orderStatus,
      createdAt: o.createdAt,
      completedAt: o.updatedAt, // เวลาเสร็จสมบูรณ์
      products: o.products.map((line) => ({
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
    }));

    return res.json({ ok: true, order: shaped });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// GET /api/me
exports.profile = async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true, first_name: true, last_name: true, email: true,
        phone: true, id_card: true, address: true, role: true,
        enabled: true, createdAt: true, updatedAt: true,
      },
    });
    if (!user) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    res.json({ ok: true, user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server Error' });
  }
};

// PUT /api/me
exports.updateprofile = async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const {
      first_name, last_name, phone, id_card, address, email,
    } = req.body || {};

    const data = {};
    if (first_name != null) data.first_name = String(first_name).trim();
    if (last_name != null) data.last_name = String(last_name).trim();
    if (phone != null) data.phone = String(phone).trim();
    if (id_card != null) data.id_card = String(id_card).trim();
    if (address != null) data.address = String(address).trim();
    if (email != null) data.email = String(email).trim().toLowerCase();

    const updated = await prisma.users.update({
      where: { id: userId },
      data,
      select: {
        id: true, first_name: true, last_name: true, email: true,
        phone: true, id_card: true, address: true, role: true,
        enabled: true, createdAt: true, updatedAt: true,
      },
    });

    res.json({ ok: true, user: updated, message: 'อัปเดตโปรไฟล์แล้ว' });
  } catch (e) {
    console.error(e);
    // อีเมลซ้ำ
    if (e?.code === 'P2002') return res.status(400).json({ message: 'อีเมลนี้ถูกใช้แล้ว' });
    res.status(500).json({ message: 'Server Error' });
  }
};

// PUT /api/me/password
exports.changePassword = async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'กรอกรหัสผ่านให้ครบ' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'รหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร' });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId }, select: { password: true }
    });
    if (!user) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });

    const ok = await bcrypt.compare(String(currentPassword), user.password);
    if (!ok) return res.status(400).json({ message: 'รหัสผ่านเดิมไม่ถูกต้อง' });

    const hashed = await bcrypt.hash(String(newPassword), 10);
    await prisma.users.update({ where: { id: userId }, data: { password: hashed } });

    res.json({ ok: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server Error' });
  }
};

// POST /api/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: 'กรอกอีเมล' });

    const normEmail = String(email).trim().toLowerCase();
    const user = await prisma.users.findUnique({
      where: { email: normEmail },
      select: { id: true, first_name: true, email: true },
    });

    const generic = { ok: true, message: 'ถ้ามีบัญชีนี้ เราจะส่งลิงก์รีเซ็ตไปยังอีเมล' };

    if (!user) {
      if (process.env.NODE_ENV !== 'production') {
        return res.json({ ...generic, debug: { smtpReady: isSMTPReady(), sent: false } });
      }
      return res.json(generic);
    }

    await prisma.passwordReset.deleteMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    });

    const rawToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expire = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordReset.create({
      data: { userId: user.id, tokenHash, expiresAt: expire },
    });

    const linkBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${linkBase}/reset-password?token=${encodeURIComponent(rawToken)}`;

    let sent = false;
    try {
      const info = await sendMail({
        to: user.email,
        subject: 'รีเซ็ตรหัสผ่าน',
        html: `
          <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto;">
            <h2>รีเซ็ตรหัสผ่าน</h2>
            <p>สวัสดี ${user.first_name || ''}</p>
            <p>คลิกลิงก์ด้านล่างเพื่อรีเซ็ตรหัสผ่านของคุณ (ภายใน 1 ชั่วโมง)</p>
            <p><a href="${resetLink}" target="_blank" rel="noreferrer noopener">${resetLink}</a></p>
            <p>หากคุณไม่ได้เป็นผู้ร้องขอ ให้เพิกเฉยอีเมลนี้</p>
          </div>
        `,
      });
      sent = info && info.dev !== true;
    } catch (err) {
      console.error('[forgotPassword] sendMail error:', err?.message || err);
      sent = false;
    }

    if (process.env.NODE_ENV !== 'production') {
      return res.json({
        ...generic,
        debug: { smtpReady: isSMTPReady(), sent, devLink: sent ? null : resetLink, to: user.email },
      });
    }
    return res.json(generic);
  } catch (e) {
    console.error('forgotPassword error:', e);
    return res.status(500).json({ message: 'Server Error' });
  }
};

// POST /api/reset-password/validate
exports.validateResetToken = async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ message: 'ไม่มี token' });
    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');

    const rec = await prisma.passwordReset.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
    if (!rec || rec.usedAt || rec.expiresAt <= new Date()) {
      return res.status(400).json({ message: 'ลิงก์หมดอายุหรือไม่ถูกต้อง' });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error('validateResetToken error:', e);
    return res.status(500).json({ message: 'Server Error' });
  }
};

// POST /api/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) return res.status(400).json({ message: 'ข้อมูลไม่ครบ' });
    if (String(newPassword).length < 6) return res.status(400).json({ message: 'รหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร' });

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const rec = await prisma.passwordReset.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
    if (!rec || rec.usedAt || rec.expiresAt <= new Date()) {
      return res.status(400).json({ message: 'ลิงก์หมดอายุหรือไม่ถูกต้อง' });
    }

    const hashed = await bcrypt.hash(String(newPassword), 10);

    await prisma.$transaction(async (tx) => {
      await tx.users.update({ where: { id: rec.userId }, data: { password: hashed } });
      await tx.passwordReset.update({ where: { tokenHash }, data: { usedAt: new Date() } });
      // ความปลอดภัย: เก็บกวาด token อื่นของ user นี้ออก
      await tx.passwordReset.deleteMany({
        where: { userId: rec.userId, usedAt: null, expiresAt: { gt: new Date() }, NOT: { tokenHash } },
      });
    });

    return res.json({ ok: true, message: 'รีเซ็ตรหัสผ่านสำเร็จ' });
  } catch (e) {
    console.error('resetPassword error:', e);
    return res.status(500).json({ message: 'Server Error' });
  }
};

// POST /api/forgot-password-otp  { email }
exports.requestPasswordOtp = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: 'กรอกอีเมล' });

    const normEmail = String(email).trim().toLowerCase();
    const user = await prisma.users.findUnique({
      where: { email: normEmail },
      select: { id: true, first_name: true, email: true },
    });

    // ตอบแบบ generic เสมอ (กันเดาระบบว่ามีอีเมลหรือไม่)
    const generic = { ok: true, message: 'ถ้ามีบัญชีนี้ เราจะส่งรหัสให้ทางอีเมล' };

    if (!user) return res.json(generic);

    // จำกัดความถี่: 1 นาที/ครั้ง
    const oneMinAgo = new Date(Date.now() - 60 * 1000);
    const recent = await prisma.passwordOTP.findFirst({
      where: { userId: user.id, purpose: 'reset', createdAt: { gt: oneMinAgo }, usedAt: null },
      select: { id: true },
    });
    if (recent) return res.json(generic); // เพิ่งขอไปแล้ว

    // ลบ OTP ที่ยังไม่หมดอายุ (กันค้าง)
    await prisma.passwordOTP.deleteMany({
      where: { userId: user.id, purpose: 'reset', usedAt: null, expiresAt: { gt: new Date() } },
    });

    // สร้าง OTP ใหม่ อายุ 10 นาที
    const code = genOtp();
    const codeHash = hash(code);
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 นาที
    await prisma.passwordOTP.create({
      data: { userId: user.id, codeHash, purpose: 'reset', expiresAt: expires },
    });

    // ส่งอีเมล
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto">
        <h2>รหัสยืนยัน (OTP)</h2>
        <p>สวัสดี ${user.first_name || ''}</p>
        <p>รหัสยืนยันของคุณคือ:</p>
        <div style="font-size:20px;font-weight:700;letter-spacing:2px;">${code}</div>
        <p>รหัสดังกล่าวมีอายุ 10 นาที</p>
        <p>หากไม่ได้ร้องขอ โปรดเมินอีเมลนี้</p>
      </div>
    `;

    if (isSMTPReady()) {
      await sendMail({ to: user.email, subject: 'รหัสยืนยันรีเซ็ตรหัสผ่าน', html });
      return res.json(generic);
    } else {
      // DEV: ไม่มี SMTP → ส่งรหัสคืนให้ทดสอบง่าย ๆ (อย่าใช้ใน production)
      return res.json({ ...generic, devCode: code });
    }
  } catch (e) {
    console.error('requestPasswordOtp error:', e);
    return res.status(500).json({ message: 'Server Error' });
  }
};

// POST /api/verify-reset-otp  { email, code }
// -> คืน short-lived token (JWT) เพื่ออนุญาตตั้งรหัสใหม่
const jwt = require('jsonwebtoken');

exports.verifyResetOtp = async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ message: 'ข้อมูลไม่ครบ' });

    const normEmail = String(email).trim().toLowerCase();
    const user = await prisma.users.findUnique({
      where: { email: normEmail },
      select: { id: true, email: true },
    });

    // generic response (ไม่บอกว่าอีเมลมีไหม)
    const genericFail = { ok: false, message: 'รหัสไม่ถูกต้อง หรือหมดอายุ' };
    if (!user) return res.status(400).json(genericFail);

    const row = await prisma.passwordOTP.findFirst({
      where: {
        userId: user.id,
        purpose: 'reset',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return res.status(400).json(genericFail);

    // ป้องกันเดาง่าย ๆ: เกิน 5 ครั้งล็อก
    if (row.attempts >= 5) {
      return res.status(400).json({ ok: false, message: 'พยายามเกินกำหนด กรุณาขอรหัสใหม่' });
    }

    const ok = row.codeHash === hash(code);
    if (!ok) {
      await prisma.passwordOTP.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 } },
      });
      return res.status(400).json(genericFail);
    }

    // ใช้แล้ว
    await prisma.passwordOTP.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });

    // ออก short-lived JWT (15 นาที) ให้ไปตั้งรหัส
    const otpToken = jwt.sign(
      { sub: user.id, purpose: 'pwd_reset_otp' },
      process.env.SECRET || 'dev_secret',
      { expiresIn: '15m' }
    );

    return res.json({ ok: true, otpToken });
  } catch (e) {
    console.error('verifyResetOtp error:', e);
    return res.status(500).json({ message: 'Server Error' });
  }
};

// POST /api/reset-password-otp  { otpToken, password }
exports.resetPasswordWithOtp = async (req, res) => {
  try {
    const { otpToken, password } = req.body || {};
    if (!otpToken || !password) return res.status(400).json({ message: 'ข้อมูลไม่ครบ' });

    let payload;
    try {
      payload = jwt.verify(otpToken, process.env.SECRET || 'dev_secret');
    } catch {
      return res.status(400).json({ message: 'โทเคนไม่ถูกต้องหรือหมดอายุ' });
    }
    if (payload?.purpose !== 'pwd_reset_otp') {
      return res.status(400).json({ message: 'โทเคนไม่ถูกต้อง' });
    }

    const userId = Number(payload.sub);
    if (!Number.isFinite(userId)) return res.status(400).json({ message: 'โทเคนไม่ถูกต้อง' });

    // ใส่ bcrypt ตามที่คุณใช้อยู่
    const bcrypt = require('bcryptjs');
    const hashPw = await bcrypt.hash(String(password), 10);

    await prisma.users.update({
      where: { id: userId },
      data: { password: hashPw },
    });

    return res.json({ ok: true, message: 'ตั้งรหัสผ่านใหม่สำเร็จ' });
  } catch (e) {
    console.error('resetPasswordWithOtp error:', e);
    return res.status(500).json({ message: 'Server Error' });
  }
};

