const prisma = require("../config/prisma");

// GET /api/product/:id
exports.getOneProduct = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "invalid id" });

    const item = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        sold: true,
        quantity: true,
        pickupLocation: true,
        ratingAvg: true,
        ratingCount: true,
        images: { select: { id: true, url: true } },
        variants: {
          select: {
            id: true,
            productId: true,
            sizeId: true,
            generationId: true,
            quantity: true,
            sku: true,
            size: { select: { id: true, name: true } },
            generation: { select: { id: true, name: true } },
          },
          orderBy: [{ sizeId: "asc" }, { generationId: "asc" }],
        },
      },
    });
    if (!item) return res.status(404).json({ message: "not found" });

    return res.json(item);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server Error" });
  }
};

// GET /api/products/:id/reviews?page=1&limit=5
exports.listProductReviewsDetail = async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 5)));

    const where = { productId };
    const [items, total] = await Promise.all([
      prisma.productReview.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, rating: true, text: true, createdAt: true },
      }),
      prisma.productReview.count({ where }),
    ]);

    return res.json({
      data: items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server Error" });
  }
};
