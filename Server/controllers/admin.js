const prisma = require("../config/prisma")
const norm = (s) => String(s || "").trim().toLowerCase();
const { PrismaClient } = require("@prisma/client");

exports.changeOrderstatus = async (req, res) => {
  try {
    const { orderId, orderStatus } = req.body
    // console.log(orderId,orderStatus)
    const orderUpdate = await prisma.order.update({
      where: { id: orderId },
      data: { orderStatus: orderStatus }
    })
    res.json(orderUpdate)
  } catch (err) {
    console.log(err)
    res.status(500).json({ message: "Server Error" })
  }
}


exports.getOrderAdmin = async (req, res) => {
  try {
    const order = await prisma.order.findMany({
      include: {
        products: {
          include: {
            product: true
          }
        },
        orderBuy: {
          select: {
            id: true,
            email: true,
            address: true
          }
        }
      }
    })
    res.json(order)
  } catch (err) {
    console.log(err)
    res.status(500).json({ message: "Server Error" })
  }
}

////// gpt ///////

// server/controllers/admin.js
// exports.listAllOrders = async (req, res) => {
//   try {
//     const page = Math.max(1, Number(req.query.page || 1));
//     const pageSize = Math.min(50, Math.max(5, Number(req.query.pageSize || 10)));
//     const status = String(req.query.status || "").trim();
//     const q = String(req.query.q || "").trim();

//     // NEW: date range
//     const startDateStr = String(req.query.startDate || "").trim(); // "2025-09-01"
//     const endDateStr   = String(req.query.endDate || "").trim();   // "2025-09-06"
//     let createdAtFilter = undefined;
//     if (startDateStr || endDateStr) {
//       const gte = startDateStr ? new Date(`${startDateStr}T00:00:00.000Z`) : undefined;
//       const lte = endDateStr ? new Date(`${endDateStr}T23:59:59.999Z`) : undefined;
//       createdAtFilter = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
//     }

//     // where หลัก
//     const where = {
//       ...(status ? { orderStatus: status } : {}),
//       ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
//     };

//     // ขยายการค้นหา q (order id, ผู้ซื้อ, โทร, email, ชื่อสินค้าใน order)
//     if (q) {
//       const tryId = Number(q);
//       where.AND = [
//         {
//           OR: [
//             ...(Number.isInteger(tryId) && tryId > 0 ? [{ id: tryId }] : []),
//             { orderBuy: {
//                 OR: [
//                   { email: { contains: q, mode: "insensitive" } },
//                   { first_name: { contains: q, mode: "insensitive" } },
//                   { last_name: { contains: q, mode: "insensitive" } },
//                   { phone: { contains: q } },
//                 ],
//               }
//             },
//             { products: { some: { productTitle: { contains: q, mode: "insensitive" } } } },
//           ]
//         }
//       ];
//     }

//     const [total, rows] = await prisma.$transaction([
//       prisma.order.count({ where }),
//       prisma.order.findMany({
//         where,
//         orderBy: { createdAt: "desc" },
//         skip: (page - 1) * pageSize,
//         take: pageSize,
//         select: {
//           id: true,
//           cartTotal: true,
//           orderStatus: true,
//           createdAt: true,
//           updatedAt: true,
//           orderBuy: {
//             select: { id: true, first_name: true, last_name: true, email: true, phone: true },
//           },
//           products: {
//             select: {
//               id: true, count: true, price: true, productTitle: true, sizeName: true, generationName: true,
//               variant: {
//                 select: {
//                   product: { select: { images: { select: { url: true }, take: 1 } } },
//                   size: { select: { name: true } },
//                   generation: { select: { name: true } },
//                 }
//               }
//             }
//           }
//         },
//       }),
//     ]);

//     res.json({
//       ok: true,
//       data: rows,
//       pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
//     });
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ message: "Server Error" });
//   }
// };

// controllers/admin.js
exports.listAllOrders = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(50, Math.max(5, Number(req.query.pageSize || 10)));
    const status = String(req.query.status || "").trim();
    const q = String(req.query.q || "").trim();

    // ----- Date range -----
    const startDateStr = String(req.query.startDate || "").trim(); // "YYYY-MM-DD"
    const endDateStr = String(req.query.endDate || "").trim();   // "YYYY-MM-DD"
    let createdAtFilter;
    if (startDateStr || endDateStr) {
      const gte = startDateStr ? new Date(`${startDateStr}T00:00:00.000Z`) : undefined;
      const lte = endDateStr ? new Date(`${endDateStr}T23:59:59.999Z`) : undefined;
      createdAtFilter = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
    }

    // ----- Base where -----
    const where = {
      ...(status ? { orderStatus: status } : {}),
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
                  { email: { contains: q } }, // <-- remove mode
                  { first_name: { contains: q } },
                  { last_name: { contains: q } },
                  { phone: { contains: q } },
                ],
              },
            },
            {
              products: {
                some: {
                  productTitle: { contains: q }, // <-- remove mode
                },
              },
            },
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
              id: true, first_name: true, last_name: true, email: true, phone: true,
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

exports.updatePickupForOrder = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { place, pickupAt, note, clear } = req.body || {};
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'รูปแบบ id ไม่ถูกต้อง' });

    // อนุญาตแก้ไขเฉพาะสถานะ "รับออเดอร์เสร็จสิ้น"
    const order = await prisma.order.findUnique({ where: { id }, select: { id: true, orderStatus: true } });
    if (!order) return res.status(404).json({ message: 'ไม่พบออเดอร์' });
    if (order.orderStatus !== 'รับออเดอร์เสร็จสิ้น') {
      return res.status(400).json({ message: "แก้ไขนัดรับได้เฉพาะสถานะ 'รับออเดอร์เสร็จสิ้น'" });
    }

    let data = {};
    if (clear) {
      data = { pickupPlace: null, pickupAt: null, pickupNote: null };
    } else {
      if (!place || !String(place).trim()) {
        return res.status(400).json({ message: 'กรุณาระบุสถานที่นัดรับ (place)' });
      }
      data.pickupPlace = String(place).trim();
      data.pickupNote = note ? String(note).trim() : null;
      if (pickupAt) {
        const dt = new Date(pickupAt);
        if (isNaN(dt.getTime())) return res.status(400).json({ message: 'pickupAt ไม่ถูกต้อง (ต้องเป็น ISO datetime)' });
        data.pickupAt = dt;
      } else {
        data.pickupAt = null;
      }
    }

    await prisma.order.update({ where: { id }, data });
    res.json({ ok: true, message: clear ? 'ล้างค่านัดรับแล้ว' : 'อัปเดตค่านัดรับแล้ว' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server Error' });
  }
};



// อัปเดตสถานะ (ตัวอย่าง: "Not Process" | "กำลังรับออเดอร์" | "รับออเดอร์เสร็จสิ้น" | "ยกเลิก")
exports.updateOrderStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!id || !status) return res.status(400).json({ message: "missing id/status" });

    const od = await prisma.order.update({
      where: { id },
      data: { orderStatus: String(status) },
    });
    res.json({ ok: true, order: od });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e?.message || "Server Error" });
  }
};

// แอดมินยกเลิกออเดอร์ + คืนสต็อก
// exports.cancelOrderAdmin = async (req, res) => {
//   try {
//     const id = Number(req.params.id);
//     if (!id) return res.status(400).json({ message: "missing id" });

//     const order = await prisma.order.findUnique({
//       where: { id },
//       select: { id: true, orderStatus: true, products: { select: { variantId: true, count: true } } },
//     });
//     if (!order) return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });

//     await prisma.$transaction(async (tx) => {
//       // คืนสต็อกกลับไปยัง ProductVariant
//       for (const line of order.products) {
//         const qty = Number(line.count) || 0;
//         if (qty > 0) {
//           await tx.productVariant.updateMany({
//             where: { id: line.variantId },
//             data: { quantity: { increment: qty } },
//           });
//         }
//       }
//       await tx.order.update({ where: { id: order.id }, data: { orderStatus: "ยกเลิก" } });
//     });

//     res.json({ ok: true, message: "ยกเลิกแล้ว และคืนสต็อกเรียบร้อย" });
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ message: e?.message || "Server Error" });
//   }
// };

/// ดึงสินค้า stock ต่ำ
exports.lowStockNotifications = async (req, res) => {
  try {
    const threshold = Number(req.query.threshold ?? 9); // เหลือ <= 5 ถือว่าต่ำ
    const variants = await prisma.productVariant.findMany({
      where: { quantity: { lte: threshold } },
      include: {
        product: { select: { id: true, title: true } },
        size: { select: { name: true } },
        generation: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    const items = variants.map((v) => {
      const labelParts = [v.product?.title, v.size?.name, v.generation?.name].filter(Boolean);
      const title =
        `สต็อกต่ำ: ${labelParts.join(" / ")} (เหลือ ${v.quantity})`;

      return {
        // ใช้ composite key กันชนกับประเภทอื่น
        id: `stock:${v.id}`,
        type: "stock",
        productId: v.productId,     // ✅ สำคัญ: ส่ง productId ชัดเจน
        variantId: v.id,
        title,
        unread: true,
        // ✅ ส่ง href ให้ UI ใช้ได้ทันที (อยากชี้ variant ไหนก็แนบ query ไปด้วยได้)
        href: `/admin/product/${v.productId}?variant=${v.id}`,
        ts: v.updatedAt,            // ใช้เวลาอัปเดตล่าสุด
      };
    });

    res.json(items);
  } catch (e) {
    console.error("lowStockNotifications error:", e);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.newOrderNotifications = async (req, res) => {
  try {
    const hours = Number(req.query.hours || 24);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const orders = await prisma.order.findMany({
      where: {
        orderStatus: "กำลังรับออเดอร์",
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

exports.setPickupForOrders = async (req, res) => {
  try {
    const { orderIds, place, pickupAt, note } = req.body || {}

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: 'orderIds ต้องเป็น array และห้ามว่าง' })
    }
    if (!place || String(place).trim() === '') {
      return res.status(400).json({ message: 'กรุณาระบุสถานที่นัดรับ (place)' })
    }

    // อนุญาตเฉพาะออเดอร์สถานะ "รับออเดอร์เสร็จสิ้น"
    const ids = orderIds.map((x) => Number(x)).filter((x) => Number.isInteger(x))
    const data = {
      pickupPlace: String(place).trim(),
      pickupNote: note ? String(note).trim() : null,
    }
    if (pickupAt) {
      const dt = new Date(pickupAt)
      if (isNaN(dt.getTime())) {
        return res.status(400).json({ message: 'รูปแบบ pickupAt ไม่ถูกต้อง (ต้องเป็น ISO datetime)' })
      }
      data.pickupAt = dt
    } else {
      data.pickupAt = null
    }

    const result = await prisma.order.updateMany({
      where: {
        id: { in: ids },
        orderStatus: 'รับออเดอร์เสร็จสิ้น',
      },
      data,
    })

    return res.json({
      ok: true,
      updatedCount: result.count,
      message: `ตั้งค่านัดรับให้ ${result.count} ออเดอร์แล้ว`,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server Error' })
  }
}

// PUT /api/admin/orders/:id/cancel
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

      // คืนสต็อกเฉพาะรอบแรก
      if (before.orderStatus !== "ยกเลิก") {
        const full = await tx.order.findUnique({
          where: { id: orderId },
          include: {
            products: { // ProductOnOrder[]
              include: {
                variant: { select: { id: true, productId: true } },
              },
            },
          },
        });

        if (!full) return null;

        for (const line of full.products) {
          // คืนสต็อกตามจำนวนในออเดอร์
          await tx.productVariant.update({
            where: { id: line.variantId },
            data: { quantity: { increment: line.count } },
          });
          // ลดยอด sold ของสินค้า
          await tx.product.update({
            where: { id: line.variant.productId },
            data: { sold: { decrement: line.count } },
          });
        }
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          orderStatus: "ยกเลิก",
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

    if (od.orderStatus !== "ยกเลิก") {
      return res.status(400).json({ message: "แก้ไขเหตุผลได้เฉพาะคำสั่งซื้อที่ถูกยกเลิกแล้วเท่านั้น" });
    }

    // โหมดล้างค่า
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
        // ไม่แก้ orderStatus / ไม่คืนสต็อกเพิ่ม
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