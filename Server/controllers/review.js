// Server/controllers/review.js
const prisma = require("../config/prisma");
/** helper: แปลง YYYY-MM-DD -> Date ที่ 00:00:00 UTC */
const ymdToUtcStart = (s) => (s ? new Date(`${s}T00:00:00Z`) : null);
/** helper: วันถัดไป (exclusive) */
const nextDay = (d) => (d ? new Date(d.getTime() + 24 * 60 * 60 * 1000) : null);

const norm = (s) => String(s || "").trim().toLowerCase();
const isCompleted = (s) =>
  ["completed", "คำสั่งซื้อสำเร็จ"].includes(norm(s));

/**
 * POST /api/orders/:id/reviews
 * body: { rating: 1..5, text?: string, variants?: number[] }
 * - ถ้าไม่ส่ง variants จะรีวิว "ทุกชิ้น" ในออเดอร์นั้น
 */
// exports.createReviewsForOrder = async (req, res) => {
//   try {
//     const userId = Number(req.user?.id);
//     const orderId = Number(req.params.id);
//     const { rating, text, variants } = req.body || {};

//     if (!userId) return res.status(401).json({ message: "unauthorized" });
//     if (!Number.isInteger(orderId)) return res.status(400).json({ message: "order id invalid" });

//     const r = Number(rating);
//     if (!Number.isFinite(r) || r < 1 || r > 5) {
//       return res.status(400).json({ message: "rating must be 1..5" });
//     }

//     // โหลดออเดอร์เจ้าของ + ไลน์สินค้า
//     const order = await prisma.order.findFirst({
//       where: { id: orderId, orderById: userId },
//       select: { id: true, orderStatus: true, products: { select: { variantId: true } } },
//     });
//     if (!order) return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });
//     if (!isCompleted(order.orderStatus)) {
//       return res.status(400).json({ message: "รีวิวได้เฉพาะออเดอร์ที่สำเร็จแล้ว" });
//     }

//     // เลือก variant ที่จะรีวิว
//     const variantIds =
//       Array.isArray(variants) && variants.length > 0
//         ? variants.map(Number)
//         : order.products.map((p) => Number(p.variantId)).filter(Boolean);

//     if (variantIds.length === 0) {
//       return res.status(400).json({ message: "no variants to review" });
//     }

//     // map variant -> product
//     const vRows = await prisma.productVariant.findMany({
//       where: { id: { in: variantIds } },
//       select: { id: true, productId: true },
//     });
//     if (vRows.length === 0) return res.status(400).json({ message: "variants not found" });

//     const lines = vRows.map((v) => ({ productId: v.productId, variantId: v.id }));

//     await prisma.$transaction(async (tx) => {
//       // upsert รีวิวรายชิ้น (unique: userId+productId+variantId)
//       for (const ln of lines) {
//         await tx.productReview.upsert({
//           where: {
//             userId_productId_variantId: {
//               userId,
//               productId: ln.productId,
//               variantId: ln.variantId,
//             },
//           },
//           create: {
//             userId,
//             productId: ln.productId,
//             variantId: ln.variantId,
//             rating: r,
//             text: text ? String(text).slice(0, 500) : null,
//           },
//           update: {
//             rating: r,
//             text: text ? String(text).slice(0, 500) : null,
//           },
//         });
//       }

//       // อัปเดตสรุปเรตติ้งให้สินค้า
//       const productIds = [...new Set(lines.map((l) => l.productId))];
//       for (const pid of productIds) {
//         const agg = await tx.productReview.aggregate({
//           where: { productId: pid },
//           _avg: { rating: true },
//           _count: { rating: true },
//         });
//         await tx.product.update({
//           where: { id: pid },
//           data: {
//             ratingAvg: Number(agg._avg.rating || 0),
//             ratingCount: Number(agg._count.rating || 0),
//           },
//         });
//       }
//     });

//     return res.json({ ok: true, message: "บันทึกรีวิวแล้ว" });
//   } catch (e) {
//     console.error("createReviewsForOrder error:", e);
//     return res.status(500).json({ message: "Server Error" });
//   }
// };

exports.createReviewsForOrder = async (req, res) => {
  try {
    const userId = Number(req.user?.id);
    const orderId = Number(req.params.id);
    const { rating, text, variants } = req.body || {};

    if (!userId) return res.status(401).json({ message: "unauthorized" });
    if (!Number.isInteger(orderId)) return res.status(400).json({ message: "order id invalid" });

    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return res.status(400).json({ message: "rating must be 1..5" });
    }

    // โหลดออเดอร์เจ้าของ + ไลน์สินค้า
    const order = await prisma.order.findFirst({
      where: { id: orderId, orderById: userId },
      select: { id: true, orderStatus: true, products: { select: { variantId: true } } },
    });
    if (!order) return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });
    if (!isCompleted(order.orderStatus)) {
      return res.status(400).json({ message: "รีวิวได้เฉพาะออเดอร์ที่สำเร็จแล้ว" });
    }

    // กำหนดชุด variant ที่จะรีวิว (อนุญาตเฉพาะที่อยู่ในออเดอร์นี้เท่านั้น)
    const allowed = new Set(order.products.map(p => Number(p.variantId)).filter(Boolean));
    const requested = Array.isArray(variants) && variants.length > 0
      ? variants.map(Number)
      : Array.from(allowed);

    const variantIds = Array.from(new Set(requested)).filter(v => allowed.has(v));
    if (variantIds.length === 0) return res.status(400).json({ message: "no variants to review" });

    // map variant -> product
    const vRows = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, productId: true },
    });
    if (vRows.length === 0) return res.status(400).json({ message: "variants not found" });

    const lines = vRows.map(v => ({ productId: v.productId, variantId: v.id }));

    // ทำในทรานแซกชัน + เก็บผล upsert ไว้ส่งกลับ
    const saved = await prisma.$transaction(async (tx) => {
      const savedItems = [];

      // upsert รีวิวรายชิ้น (unique: userId+productId+variantId)
      for (const ln of lines) {
        const row = await tx.productReview.upsert({
          where: {
            userId_productId_variantId: {
              userId,
              productId: ln.productId,
              variantId: ln.variantId,
            },
          },
          create: {
            userId,
            productId: ln.productId,
            variantId: ln.variantId,
            rating: r,
            text: text ? String(text).slice(0, 500) : null,
          },
          update: {
            rating: r,
            text: text ? String(text).slice(0, 500) : null,
          },
          select: { productId: true, variantId: true, rating: true, text: true, updatedAt: true },
        });
        savedItems.push(row);
      }

      // อัปเดตสรุปเรตติ้งให้สินค้า
      const productIds = [...new Set(lines.map(l => l.productId))];
      for (const pid of productIds) {
        const agg = await tx.productReview.aggregate({
          where: { productId: pid },
          _avg: { rating: true },
          _count: { rating: true },
        });
        await tx.product.update({
          where: { id: pid },
          data: {
            ratingAvg: Number(agg._avg.rating || 0),
            ratingCount: Number(agg._count.rating || 0),
          },
        });
      }

      return savedItems;
    });

    // ✅ ส่งผลลัพธ์ให้ client เอาไปตั้ง submittedReviews ได้เลย
    return res.json({
      ok: true,
      message: "บันทึกรีวิวแล้ว",
      reviews: saved.map(s => ({
        productId: s.productId,
        variantId: s.variantId,
        rating: s.rating,
        text: s.text ?? "",
        updatedAt: s.updatedAt,
      })),
    });
  } catch (e) {
    console.error("createReviewsForOrder error:", e);
    return res.status(500).json({ message: "Server Error" });
  }
};

/** GET /api/products/:id/rating  => { avg, count } */
exports.getProductRating = async (req, res) => {
  try {
    const raw = req.params?.id;
    const productId = Number.parseInt(raw, 10);
    console.log("[getProductRating] params.id =", raw, "->", productId); // debug

    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ message: "product id invalid" });
    }

    const p = await prisma.product.findUnique({
      where: { id: productId },
      select: { ratingAvg: true, ratingCount: true },
    });
    if (!p) return res.status(404).json({ message: "not found" });

    return res.json({ avg: p.ratingAvg ?? 0, count: p.ratingCount ?? 0 });
  } catch (e) {
    console.error("getProductRating error:", e);
    return res.status(500).json({ message: "Server Error" });
  }
};

/**
 * GET /api/admin/reviews/summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&limit=20
 * สรุปคะแนนรีวิวต่อสินค้า (เฉลี่ย + จำนวน) ภายในช่วงวันที่
 * คืน { data: [{productId, title, ratingAvg, ratingCount}], pagination: {...} }
 */
exports.adminListReviewStats = async (req, res) => {
  try {
    const { startDate, endDate, limit = 20 } = req.query || {};
    const from = ymdToUtcStart(startDate);
    const to = nextDay(ymdToUtcStart(endDate));

    const where = {};
    if (from || to) where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lt = to;

    // groupBy สรุปเฉลี่ย/จำนวนต่อสินค้า
    const grouped = await prisma.productReview.groupBy({
      by: ["productId"],
      where,
      _avg: { rating: true },
      _count: { rating: true },
      orderBy: [
        { _avg: { rating: "desc" } },
        { _count: { rating: "desc" } },
      ],
      take: Number(limit) || 20,
    });

    // เติมชื่อสินค้า
    const ids = grouped.map((g) => g.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true },
    });
    const titleMap = new Map(products.map((p) => [p.id, p.title]));

    const data = grouped.map((g) => ({
      productId: g.productId,
      title: titleMap.get(g.productId) || `Product #${g.productId}`,
      ratingAvg: Number(g._avg.rating || 0),
      ratingCount: Number(g._count.rating || 0),
    }));

    return res.json({ data });
  } catch (e) {
    console.error("adminListReviewStats error:", e);
    return res.status(500).json({ message: "Server Error" });
  }
};

/**
 * GET /api/admin/reviews?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&page=1&pageSize=20&productId=&rating=
 * รีวิวล่าสุด (ภายในช่วงวันที่) + ค้นหาเฉพาะสินค้า / เฉพาะเรตติ้ง ได้
 * คืน { data: [{id, productId, productTitle, userName, rating, text, createdAt}], pagination: {...} }
 */
exports.adminListReviews = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
      productId,
      rating,
    } = req.query || {};

    const ymdToUtcStart = (s) => (s ? new Date(`${s}T00:00:00Z`) : null);
    const nextDay = (d) => (d ? new Date(d.getTime() + 86400000) : null);
    const from = ymdToUtcStart(startDate);
    const to = nextDay(ymdToUtcStart(endDate));

    const where = {};
    if (from || to) where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lt = to;
    if (productId) where.productId = Number(productId);
    if (rating) where.rating = Number(rating);

    const take = Math.max(1, Math.min(200, Number(pageSize) || 20));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;

    const [total, rows] = await Promise.all([
      prisma.productReview.count({ where }),
      prisma.productReview.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          product: { select: { title: true } },
          user: { select: { first_name: true, last_name: true, email: true } },
          variant: {
            include: {
              size: { select: { name: true } },
              generation: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const data = rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      text: r.text,
      createdAt: r.createdAt,
      productId: r.productId,
      productTitle: r.product?.title || `Product #${r.productId}`,
      userName:
        `${r.user?.first_name || ""} ${r.user?.last_name || ""}`.trim() ||
        r.user?.email ||
        "ผู้ใช้",
      sizeName: r.variant?.size?.name ?? null,
      generationName: r.variant?.generation?.name ?? null,
    }));

    return res.json({
      data,
      pagination: {
        total,
        page: Number(page) || 1,
        pageSize: take,
        totalPages: Math.max(1, Math.ceil(total / take)),
      },
    });
  } catch (e) {
    console.error("adminListReviews error:", e);
    return res.status(500).json({ message: "Server Error" });
  }
};



/**
 * GET /api/products/:id/reviews?page=1&pageSize=20&rating=
 * รีวิวของสินค้านั้น ๆ (ใช้แสดงในหน้า product detail หรือฝั่ง client)
 */
exports.listProductReviews = async (req, res) => {
  try {
    const productId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ message: "product id invalid" });
    }

    const page = Math.max(1, Number.parseInt(req.query.page ?? "1", 10) || 1);
    const pageSize = Math.max(1, Math.min(100, Number.parseInt(req.query.pageSize ?? "20", 10) || 20));
    const rating = req.query.rating ? Number.parseInt(req.query.rating, 10) : undefined;

    const where = { productId };
    if (Number.isFinite(rating)) where.rating = rating;

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [total, rows] = await Promise.all([
      prisma.productReview.count({ where }),
      prisma.productReview.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip, take,
        include: {
          user: { select: { first_name: true, last_name: true, email: true } }, // << สำคัญ
          variant: {
            include: {
              size: { select: { name: true } },
              generation: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const maskEmail = (e) => e ? e.replace(/(^.).*(@.*$)/, "$1***$2") : "";


    const data = rows.map((r) => {
      const full = `${r.user?.first_name || ""} ${r.user?.last_name || ""}`.trim(); // << บรรทัดที่ 1

      return {
        id: r.id,
        rating: r.rating,
        text: r.text,
        createdAt: r.createdAt,
        user: r.user
          ? { first_name: r.user.first_name, last_name: r.user.last_name }
          : null,
        userName: full || maskEmail(r.user?.email) || "ผู้ใช้",               // << บรรทัดที่ 2
        sizeName: r.variant?.size?.name ?? null,
        generationName: r.variant?.generation?.name ?? null,
      };
    });

    return res.json({
      data,
      pagination: {
        total,
        page,
        pageSize: take,
        totalPages: Math.max(1, Math.ceil(total / take)),
      },
    });
  } catch (e) {
    console.error("listProductReviews error:", e);
    return res.status(500).json({ message: "Server Error" });
  }
};

// Server/controllers/productDetail.js


exports.getProductById = async (req, res) => {
  try {
    const raw = req.params?.id;
    const productId = Number.parseInt(raw, 10);

    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ message: "product id invalid" });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: { select: { id: true, url: true } },
        variants: {
          include: {
            size: { select: { id: true, name: true } },
            generation: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ message: "not found" });
    }

    return res.json(product);
  } catch (e) {
    console.error("getProductById error:", e);
    return res.status(500).json({ message: "Server Error" });
  }
};

exports.getMyReviewsForOrder = async (req, res) => {
  try {
    const userId = Number(req.user?.id);
    const orderId = Number.parseInt(req.params.id, 10);

    if (!userId) return res.status(401).json({ message: "unauthorized" });
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({ message: "order id invalid" });
    }

    // หาออเดอร์ของผู้ใช้
    const order = await prisma.order.findFirst({
      where: { id: orderId, orderById: userId },
      select: { id: true, orderStatus: true, products: { select: { variantId: true } } },
    });

    // ถ้าไม่พบออเดอร์ → ส่ง 200 แต่เป็นว่าง (หรือจะ 404 ก็ได้ตามดีไซน์)
    if (!order) return res.json({ reviews: [] });

    // (ถ้าต้องการจำกัดเฉพาะ completed เท่านั้น ให้เปิดคอมเมนต์)
    // if (!isCompleted(order.orderStatus)) return res.json({ reviews: [] });

    const variantIds = order.products
      .map(p => Number(p.variantId))
      .filter(v => Number.isFinite(v));

    if (variantIds.length === 0) return res.json({ reviews: [] });

    const reviews = await prisma.productReview.findMany({
      where: { userId, variantId: { in: variantIds } },
      select: { variantId: true, rating: true, text: true, createdAt: true, updatedAt: true },
    });

    return res.json({ reviews });
  } catch (e) {
    console.error("getMyReviewsForOrder error:", e);
    return res.status(500).json({ message: "Server Error" });
  }
};