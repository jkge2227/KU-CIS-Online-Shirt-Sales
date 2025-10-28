// controllers/product.js
const prisma = require("../config/prisma");
const cloudinary = require("cloudinary").v2;
const READY_STATUS_TH = "รับออเดอร์เสร็จสิ้น"; // รอผู้ซื้อมารับ/ชำระ

const norm = (s = '') => String(s).trim().replace(/\s+/g, ' ').toLowerCase();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUND_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const PRODUCT_INCLUDE = {
  images: true,
  variants: { include: { size: true, generation: true } },
};

const toNum = (v, def = 0) => (v === "" || v == null ? def : Number(v));
const numOrNull = (v) => (v === "" || v == null ? null : Number(v));
const sanitizeThreshold = (th, qty) => {
  // ถ้าไม่ได้ตั้ง => null, ถ้าตั้งน้อยกว่า 0 => 0
  if (th == null) return null;
  const n = Number(th);
  return n < 0 ? 0 : n;
};

exports.create = async (req, res) => {
  try {
    const { title, description, price, quantity, categoryId, images = [], variants = [] } = req.body;

    // 0) กัน key ซ้ำของ variants (sizeId + generationId)
    const seen = new Set();
    for (const v of variants) {
      if (!v.sizeId) return res.status(400).json({ message: "sizeId is required in variants" });
      const key = `${Number(v.sizeId)}::${v.generationId == null ? "null" : Number(v.generationId)}`;
      if (seen.has(key)) return res.status(409).json({ message: "Duplicate variant (size/generation) found" });
      seen.add(key);
    }

    // 1) กันชื่อซ้ำในหมวดเดียวกัน
    const catId = categoryId ? Number(categoryId) : null;
    const sameCat = await prisma.product.findMany({
      where: { categoryId: catId },
      select: { id: true, title: true },
    });
    const tNorm = norm(title);
    const dup = sameCat.find(p => norm(p.title) === tNorm);
    if (dup) {
      return res.status(409).json({ message: `มีสินค้า "${dup.title}" อยู่แล้วในหมวดนี้` });
    }

    // 2) ทรานแซกชันสร้างสินค้าพร้อมรูป/variant (รองรับ lowStockThreshold)
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          title: String(title).trim(),
          description: String(description).trim(),
          price: Number(price),
          quantity: quantity != null && quantity !== "" ? Number(quantity) : 0,
          categoryId: catId,
          images: {
            create: images.map((item) => ({
              asset_id: item.asset_id || "",
              public_id: item.public_id || "",
              url: item.url,
              secure_url: item.secure_url || item.url,
            })),
          },
        },
      });

      if (variants.length) {
        await tx.productVariant.createMany({
          data: variants.map((v) => {
            const qty = toNum(v.quantity, 0);
            const th = sanitizeThreshold(numOrNull(v.lowStockThreshold), qty);
            return {
              productId: created.id,
              sizeId: Number(v.sizeId),
              generationId: v.generationId == null || v.generationId === "" ? null : Number(v.generationId),
              quantity: qty,
              sku: v.sku || null,
              lowStockThreshold: th,
            };
          }),
          skipDuplicates: true,
        });
      }

      return created;
    });

    res.status(201).json(product);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// ---------- LIST ----------
exports.list = async (req, res) => {
  try {
    const { count } = req.params;
    const products = await prisma.product.findMany({
      take: count ? Number(count) : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        category: true,
        images: true,
        variants: {
          include: { size: true, generation: true },
        },
      },
    });
    res.send(products);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// ---------- READ ----------
exports.read = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findFirst({
      where: { id: Number(id) },
      include: {
        category: true,
        images: true,
        variants: {
          include: { size: true, generation: true },
        },
      },
    });
    res.send(product);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.update = async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const {
      title,
      description,
      price,
      quantity,
      categoryId,
      images = [],
      variants: incomingVariants = [],
    } = req.body;

    // 0) กันชื่อซ้ำในหมวดเดียวกัน (ยกเว้นเรคคอร์ดตัวเอง)
    const catId = categoryId ? Number(categoryId) : null;
    const sameCat = await prisma.product.findMany({
      where: { categoryId: catId },
      select: { id: true, title: true },
    });
    const tNorm = norm(title);
    const dup = sameCat.find(p => p.id !== productId && norm(p.title) === tNorm);
    if (dup) {
      return res.status(409).json({ message: `มีสินค้า "${dup.title}" อยู่แล้วในหมวดนี้` });
    }

    // (optional) เก็บรูปเดิมไว้ เพื่อลบ Cloudinary หลัง DB อัปเดตสำเร็จ
    const oldImages = await prisma.image.findMany({
      where: { productId },
      select: { id: true, public_id: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      // 1) ลบรูปเดิมใน DB แล้วใส่รูปใหม่
      await tx.image.deleteMany({ where: { productId } });

      await tx.product.update({
        where: { id: productId },
        data: {
          title: String(title).trim(),
          description: String(description).trim(),
          price: Number(price),
          quantity: quantity != null && quantity !== "" ? Number(quantity) : 0,
          categoryId: catId,
          images: {
            create: images.map((item) => ({
              asset_id: item.asset_id || "",
              public_id: item.public_id || "",
              url: item.url,
              secure_url: item.secure_url || item.url,
            })),
          },
        },
      });

      // 2) เตรียม variants (เพิ่ม lowStockThreshold)
      const normalize = (v) => {
        const qty = toNum(v.quantity, 0);
        const th = sanitizeThreshold(numOrNull(v.lowStockThreshold), qty);
        return {
          sizeId: Number(v.sizeId),
          generationId: v.generationId == null || v.generationId === "" ? null : Number(v.generationId),
          quantity: qty,
          sku: v.sku || null,
          lowStockThreshold: th,
        };
      };
      const keyOf = (v) => `${v.sizeId}::${v.generationId == null ? "null" : v.generationId}`;

      const targetMap = new Map();
      for (const raw of Array.isArray(incomingVariants) ? incomingVariants : []) {
        const v = normalize(raw);
        if (!v.sizeId) return res.status(400).json({ message: "sizeId is required in variants" });
        targetMap.set(keyOf(v), v); // ตัวท้ายทับ
      }
      const target = Array.from(targetMap.values());

      // 3) ดึง variants ปัจจุบัน
      const existing = await tx.productVariant.findMany({
        where: { productId },
        select: { id: true, sizeId: true, generationId: true, quantity: true, sku: true, lowStockThreshold: true },
      });
      const existingByKey = new Map(
        existing.map((e) => [`${e.sizeId}::${e.generationId == null ? "null" : e.generationId}`, e])
      );

      // 4) อัปเดต/สร้าง ตาม target (รวมเช็คเปลี่ยน threshold)
      const keepIds = new Set();
      for (const tv of target) {
        const k = keyOf(tv);
        const found = existingByKey.get(k);
        if (found) {
          keepIds.add(found.id);
          const shouldUpdate =
            found.quantity !== tv.quantity ||
            found.sku !== tv.sku ||
            (found.lowStockThreshold ?? null) !== (tv.lowStockThreshold ?? null);

          if (shouldUpdate) {
            await tx.productVariant.update({
              where: { id: found.id },
              data: {
                quantity: tv.quantity,
                sku: tv.sku,
                lowStockThreshold: tv.lowStockThreshold,
              },
            });
          }
        } else {
          await tx.productVariant.create({
            data: {
              productId,
              sizeId: tv.sizeId,
              generationId: tv.generationId,
              quantity: tv.quantity,
              sku: tv.sku,
              lowStockThreshold: tv.lowStockThreshold,
            },
          });
        }
      }

      // 5) ตัวที่ไม่อยู่ใน target → พิจารณาลบ/ปิดการขาย
      const toDeleteIds = existing.filter((e) => !keepIds.has(e.id)).map((e) => e.id);
      if (toDeleteIds.length) {
        // 5.1) ที่เคยอยู่ในออเดอร์ → ห้ามลบ
        const usedInOrder = await tx.productOnOrder.findMany({
          where: { variantId: { in: toDeleteIds } },
          select: { variantId: true },
        });
        const blockedIds = new Set(usedInOrder.map((x) => x.variantId));
        const deletableIds = toDeleteIds.filter((id) => !blockedIds.has(id));

        // 5.2) ลบได้ → เคลียร์ ref แล้วลบ
        if (deletableIds.length) {
          await tx.productOnCart.deleteMany({ where: { variantId: { in: deletableIds } } });
          await tx.productReview.updateMany({
            where: { variantId: { in: deletableIds } },
            data: { variantId: null },
          });
          await tx.productVariant.deleteMany({ where: { id: { in: deletableIds } } });
        }

        // 5.3) ลบไม่ได้เพราะเคยอยู่ในออเดอร์ → ปิดขาย (quantity = 0) (threshold คงเดิม)
        if (blockedIds.size) {
          await tx.productVariant.updateMany({
            where: { id: { in: Array.from(blockedIds) } },
            data: { quantity: 0 },
          });
        }
      }

      return { ok: true };
    });

    // 6) (optional) ลบ Cloudinary ที่ถูกถอดออก
    const newPublicIds = new Set(images.map((i) => i.public_id).filter(Boolean));
    const removedPublicIds = oldImages.map((i) => i.public_id).filter((pid) => pid && !newPublicIds.has(pid));
    if (removedPublicIds.length) {
      await Promise.allSettled(
        removedPublicIds.map(
          (pid) =>
            new Promise((resolve) =>
              cloudinary.uploader.destroy(pid, { invalidate: true }, () => resolve())
            )
        )
      );
    }

    return res.json(result);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server Error" });
  }
};


exports.remove = async (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId)) {
      return res.status(400).json({ message: "invalid product id" });
    }

    // 1) หา product + รูป
    const product = await prisma.product.findFirst({
      where: { id: productId },
      include: { images: true },
    });
    if (!product) return res.status(404).json({ message: "product not found" });

    // 2) ถ้ามีออเดอร์ที่เคยซื้อ variant ของสินค้านี้อยู่ หยุด (เพื่อรักษาประวัติการขาย)
    const hasOrders = await prisma.productOnOrder.count({
      where: { variant: { productId } }, // relational filter OK
    });
    if (hasOrders > 0) {
      return res
        .status(409)
        .json({ message: "ลบไม่ได้: มีคำสั่งซื้อที่เกี่ยวข้องกับสินค้านี้" });
    }

    // 3) ลบไฟล์บน Cloud (นอก transaction)
    const jobs = product.images.map((img) => {
      if (!img.public_id) return Promise.resolve("no_public_id");
      return new Promise((resolve) => {
        cloudinary.uploader.destroy(img.public_id, { invalidate: true }, () => resolve());
      });
    });
    await Promise.allSettled(jobs);

    // 4) ลบข้อมูลลูกทั้งหมด แล้วค่อยลบ product (ทำใน transaction)
    await prisma.$transaction(async (tx) => {
      // ตารางที่อ้างผ่าน variant ก่อน เพื่อเคลียร์ทาง
      await tx.productOnCart.deleteMany({ where: { variant: { productId } } });
      // ถ้ามีตารางอื่นที่ชี้ variant เช่น wishlist ฯลฯ ให้ลบที่นี่ด้วยในแนวเดียวกัน

      // ตารางที่ชี้ product โดยตรง
      await tx.productReview.deleteMany({ where: { productId } });
      await tx.image.deleteMany({ where: { productId } });
      await tx.productVariant.deleteMany({ where: { productId } });

      // สุดท้าย ลบ product
      await tx.product.delete({ where: { id: productId } });
    });

    return res.json({ ok: true, id: productId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// ---------- LIST BY (เดิม) ----------
exports.listby = async (req, res) => {
  try {
    const { sort = "createdAt", order = "desc", limit = 20 } = req.body || {};
    const products = await prisma.product.findMany({
      take: Number(limit),
      orderBy: { [sort]: order === "asc" ? "asc" : "desc" },
      include: { category: true },
    });
    res.send(products);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.searchfilters = async (req, res) => {
  try {
    // รองรับทั้งเลขเดี่ยวและอาร์เรย์
    let { category } = req.body;
    if (category == null) return res.json([]); // ไม่ส่งมาก็ว่าง

    const ids = (Array.isArray(category) ? category : [category])
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n));

    if (ids.length === 0) return res.json([]);

    const products = await prisma.product.findMany({
      where: { categoryId: { in: ids } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: PRODUCT_INCLUDE,
    });

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.createImages = async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(req.body.image, {
      public_id: `${Date.now()}`,
      resource_type: "auto",
      folder: "Ecom",
    });
    res.send(result);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

exports.removeImage = async (req, res) => {
  try {
    const { public_id } = req.body;
    cloudinary.uploader.destroy(public_id, (error, result) => {
      if (error) return res.status(500).json({ message: "Server Error" });
      res.send("ลบรูปภาพสำเร็จ");
    });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};


exports.getProductVariants = async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const onlyAvailable = String(req.query.available || "").trim() === "1";

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ message: "รูปแบบ productId ไม่ถูกต้อง" });
    }

    const variants = await prisma.productVariant.findMany({
      where: {
        productId,
        ...(onlyAvailable ? { quantity: { gt: 0 } } : {}),
      },
      include: {
        size: { select: { id: true, name: true } },
        generation: { select: { id: true, name: true } },
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            images: {
              select: { url: true },
              orderBy: { id: "asc" },
            },
          },
        },
      },
      orderBy: [{ id: "asc" }],
    });

    // shape ข้อมูลให้มี price จาก product.price ในแต่ละแถว (เพื่อสะดวกฝั่ง client)
    const shaped = variants.map((v) => ({
      id: v.id,
      quantity: v.quantity,
      size: v.size, // {id, name}
      generation: v.generation, // {id, name} | null
      price: Number(v.product?.price ?? 0), // <- ราคาอยู่ที่ Product.price
      product: {
        id: v.product?.id ?? productId,
        title: v.product?.title ?? "",
        images: Array.isArray(v.product?.images) ? v.product.images : [],
      },
    }));

    return res.json(shaped); // หรือ { variants: shaped }
  } catch (e) {
    console.error("getProductVariants error:", e);
    return res.status(500).json({ message: "Server Error" });
  }
};

exports.cancelExpiredOrdersJob = async (days = 3) => {
  const now = new Date();

  // ✅ ใช้วันเป็นหลัก (ดีฟอลต์ 3 วัน); ถ้าอยากตั้งผ่าน .env ก็อ่านได้ เช่น:
  // const days = Number(process.env.EXPIRE_DAYS ?? 3);
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      orderStatus: READY_STATUS_TH,
      updatedAt: { lt: cutoff }, // อยู่ในสถานะนี้นานเกินกำหนด
    },
    include: {
      products: { select: { variantId: true, count: true } },
    },
  });

  let cancelled = 0;

  for (const od of orders) {
    await prisma.$transaction(async (tx) => {
      // ✅ คืนสต็อก
      for (const line of od.products) {
        const inc = Number(line.count) || 0;
        if (inc > 0) {
          await tx.productVariant.updateMany({
            where: { id: line.variantId },
            data: { quantity: { increment: inc } },
          });
        }
      }
      // ✅ ลบออเดอร์ (ถ้าอยากเก็บประวัติ ให้เปลี่ยนเป็น update สถานะ "ยกเลิก")
      await tx.order.delete({ where: { id: od.id } });
    });
    cancelled += 1;
  }

  return { cancelled, checked: orders.length, cutoff };
};
