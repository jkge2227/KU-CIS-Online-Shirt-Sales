// controllers/product.js
const prisma = require("../config/prisma");
const cloudinary = require("cloudinary").v2;
const READY_STATUS_TH = "รับออเดอร์เสร็จสิ้น"; // รอผู้ซื้อมารับ/ชำระ

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUND_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------- CREATE ----------
exports.create = async (req, res) => {
  try {
    const { title, description, price, quantity, categoryId, images = [], variants = [] } = req.body;

    // กัน key ซ้ำ (sizeId + generationId รวม null)
    const seen = new Set();
    for (const v of variants) {
      if (!v.sizeId) return res.status(400).json({ message: "sizeId is required in variants" });
      const key = `${Number(v.sizeId)}::${v.generationId == null ? "null" : Number(v.generationId)}`;
      if (seen.has(key)) return res.status(409).json({ message: "Duplicate variant (size/generation) found" });
      seen.add(key);
    }

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          title: String(title).trim(),
          description: String(description).trim(),
          price: Number(price),
          // ถ้าไม่คุมรวม ให้ส่ง 0 หรือปล่อย undefined ก็ได้
          quantity: quantity != null && quantity !== "" ? Number(quantity) : 0,
          categoryId: categoryId ? Number(categoryId) : null,
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
          data: variants.map((v) => ({
            productId: created.id,
            sizeId: Number(v.sizeId),
            generationId: v.generationId == null || v.generationId === "" ? null : Number(v.generationId),
            quantity: Number(v.quantity || 0),
            sku: v.sku || null,
          })),
          skipDuplicates: true, // กันชน unique ซ้ำแบบ client ส่งมาซ้ำ
        });
      }

      return created;
    });

    res.status(201).json(product);
  } catch (err) {
    console.log(err);
    // Prisma P2002/P2003 อาจเกิดหาก unique/foreign key ชน
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

// ---------- UPDATE ----------
// exports.update = async (req, res) => {
//   try {
//     const { title, description, price, quantity, categoryId, images = [], variants } = req.body;
//     const productId = Number(req.params.id);

//     const updated = await prisma.$transaction(async (tx) => {
//       // ลบรูปเดิมทั้งหมดก่อน (หากต้องการ diff ให้ปรับลอจิก)
//       await tx.image.deleteMany({ where: { productId } });

//       // อัปเดต product หลัก + ใส่รูปใหม่
//       const prod = await tx.product.update({
//         where: { id: productId },
//         data: {
//           title: String(title).trim(),
//           description: String(description).trim(),
//           price: Number(price),
//           quantity: quantity != null && quantity !== "" ? Number(quantity) : 0,
//           categoryId: categoryId ? Number(categoryId) : null,
//           images: {
//             create: images.map((item) => ({
//               asset_id: item.asset_id || "",
//               public_id: item.public_id || "",
//               url: item.url,
//               secure_url: item.secure_url || item.url,
//             })),
//           },
//         },
//       });

//       // ถ้ามีส่ง variants มา → ลบทิ้งแล้วสร้างใหม่ (วิธีตรงไปตรงมา)
//       if (Array.isArray(variants)) {
//         await tx.productVariant.deleteMany({ where: { productId } });

//         if (variants.length) {
//           // กัน key ซ้ำอีกชั้น
//           const seen = new Set();
//           for (const v of variants) {
//             if (!v.sizeId) throw new Error("sizeId is required in variants");
//             const key = `${Number(v.sizeId)}::${v.generationId == null ? "null" : Number(v.generationId)}`;
//             if (seen.has(key)) throw new Error("Duplicate variant (size/generation) found");
//             seen.add(key);
//           }

//           await tx.productVariant.createMany({
//             data: variants.map((v) => ({
//               productId,
//               sizeId: Number(v.sizeId),
//               generationId: v.generationId == null || v.generationId === "" ? null : Number(v.generationId),
//               quantity: Number(v.quantity || 0),
//               sku: v.sku || null,
//             })),
//             skipDuplicates: true,
//           });
//         }
//       }

//       return prod;
//     });

//     res.send(updated);
//   } catch (err) {
//     console.log(err);
//     const msg = err?.message?.includes("Duplicate variant")
//       ? err.message
//       : "Server Error";
//     res.status(500).json({ message: msg });
//   }
// };
// controllers/product.js
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

    // --- (optional) ดึงรูปเดิมไว้ เพื่อนำไปลบ Cloudinary หลังจากอัปเดต DB สำเร็จ ---
    const oldImages = await prisma.image.findMany({
      where: { productId },
      select: { id: true, public_id: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      // 1) ลบรูปเดิมใน DB แล้วใส่รูปใหม่ (ถ้าต้อง diff จริงๆ ค่อยปรับภายหลัง)
      await tx.image.deleteMany({ where: { productId } });

      await tx.product.update({
        where: { id: productId },
        data: {
          title: String(title).trim(),
          description: String(description).trim(),
          price: Number(price),
          quantity: quantity != null && quantity !== "" ? Number(quantity) : 0,
          categoryId: categoryId ? Number(categoryId) : null,
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

      // 2) เตรียมข้อมูล variants (normalize + dedup)
      const normalize = (v) => ({
        sizeId: Number(v.sizeId),
        generationId:
          v.generationId == null || v.generationId === "" ? null : Number(v.generationId),
        quantity: Number(v.quantity || 0),
        sku: v.sku || null,
      });

      const keyOf = (v) =>
        `${v.sizeId}::${v.generationId == null ? "null" : v.generationId}`;

      const targetMap = new Map();
      for (const raw of Array.isArray(incomingVariants) ? incomingVariants : []) {
        const v = normalize(raw);
        if (!v.sizeId) throw new Error("sizeId is required in variants");
        const key = keyOf(v);
        targetMap.set(key, v); // ถ้ามีซ้ำ ให้ตัวท้ายทับ
      }
      const target = Array.from(targetMap.values());

      // 3) ดึง variants ปัจจุบัน
      const existing = await tx.productVariant.findMany({
        where: { productId },
        select: { id: true, sizeId: true, generationId: true, quantity: true, sku: true },
      });
      const existingByKey = new Map(
        existing.map((e) => [
          `${e.sizeId}::${e.generationId == null ? "null" : e.generationId}`,
          e,
        ])
      );

      // 4) อัปเดต/สร้าง ตาม target
      const keepIds = new Set();
      for (const tv of target) {
        const k = keyOf(tv);
        const found = existingByKey.get(k);
        if (found) {
          keepIds.add(found.id);
          if (found.quantity !== tv.quantity || found.sku !== tv.sku) {
            await tx.productVariant.update({
              where: { id: found.id },
              data: { quantity: tv.quantity, sku: tv.sku },
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
            },
          });
        }
      }

      // 5) จัดการตัวที่ “ไม่มีใน target” (ของเดิมที่อยากลบ)
      const toDeleteIds = existing
        .filter((e) => !keepIds.has(e.id))
        .map((e) => e.id);

      if (toDeleteIds.length) {
        // 5.1) ตัวที่เคยอยู่ในออเดอร์ → ห้ามลบ
        const usedInOrder = await tx.productOnOrder.findMany({
          where: { variantId: { in: toDeleteIds } },
          select: { variantId: true },
        });
        const blockedIds = new Set(usedInOrder.map((x) => x.variantId));
        const deletableIds = toDeleteIds.filter((id) => !blockedIds.has(id));

        // 5.2) ของที่ลบได้ → เคลียร์ ref ก่อน แล้วค่อยลบ
        if (deletableIds.length) {
          // ตะกร้า
          await tx.productOnCart.deleteMany({
            where: { variantId: { in: deletableIds } },
          });
          // รีวิว (ถ้าจะเก็บรีวิวไว้ ให้ set null)
          await tx.productReview.updateMany({
            where: { variantId: { in: deletableIds } },
            data: { variantId: null },
          });
          // ลบ variant
          await tx.productVariant.deleteMany({
            where: { id: { in: deletableIds } },
          });
        }

        // 5.3) ของที่ “ลบไม่ได้” เพราะเคยอยู่ในออเดอร์ → ปิดการขายโดยตั้ง quantity = 0
        if (blockedIds.size) {
          await tx.productVariant.updateMany({
            where: { id: { in: Array.from(blockedIds) } },
            data: { quantity: 0 },
          });
        }
      }

      // เสร็จธุรกรรม
      return { ok: true };
    });

    // 6) (optional) ลบรูปบน Cloudinary ของ “รูปเดิมที่ไม่อยู่ใน images ใหม่”
    const newPublicIds = new Set(images.map((i) => i.public_id).filter(Boolean));
    const removedPublicIds = oldImages
      .map((i) => i.public_id)
      .filter((pid) => pid && !newPublicIds.has(pid));

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

// ---------- REMOVE ----------
// exports.remove = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const productId = Number(id);

//     const product = await prisma.product.findFirst({
//       where: { id: productId },
//       include: { images: true },
//     });
//     if (!product) return res.status(400).json({ message: "product not found" });

//     // ลบรูปบน Cloudinary (ถ้ามี public_id)
//     const deleteImage = product.images.map(
//       (image) =>
//         new Promise((resolve, reject) => {
//           if (!image.public_id) return resolve("no_public_id");
//           cloudinary.uploader.destroy(image.public_id, (error, result) => {
//             if (error) reject(error);
//             else resolve(result);
//           });
//         })
//     );
//     await Promise.all(deleteImage);

//     await prisma.product.delete({ where: { id: productId } });
//     // onDelete: Cascade จะลบ variants/images ให้เองตาม schema
//     res.send("remove OK");
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ message: "Server Error" });
//   }
// };
// controllers/product.js
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

// ---------- SEARCH HELPERS ----------
const handleQuery = async (req, res, query) => {
  try {
    const products = await prisma.product.findMany({
      where: { title: { contains: query, mode: "insensitive" } },
      include: { category: true, images: true },
    });
    res.send(products);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Search Error" });
  }
};

const handlePrice = async (req, res, priceRange) => {
  try {
    const products = await prisma.product.findMany({
      where: { price: { gte: Number(priceRange[0]), lte: Number(priceRange[1]) } },
      include: { category: true, images: true },
    });
    res.send(products);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
};

const handleCategory = async (req, res, categoryId) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        categoryId: { in: categoryId.map((id) => Number(id)) },
      },
      include: { category: true, images: true },
    });
    res.send(products);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.searchfilters = async (req, res) => {
  try {
    const { query, category, price } = req.body;

    if (query) return await handleQuery(req, res, query);
    if (category) return await handleCategory(req, res, category);
    if (price) return await handlePrice(req, res, price);

    res.send([]); // ถ้าไม่ส่งเงื่อนไขมาเลย
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// ---------- UPLOAD IMAGE (เดิม) ----------
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
