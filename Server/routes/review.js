const express = require('express');
const router = express.Router();
const { authCheck, adminCheck } = require('../middlewares/authCheck');
const { createReviewsForOrder, getProductRating, adminListReviewStats, adminListReviews, listProductReviews, getProductById, getMyReviewsForOrder } = require('../controllers/review');

router.post('/orders/:id/reviews', authCheck, createReviewsForOrder);
router.get('/products/:id/rating', getProductRating);

// รีวิวของสินค้ารายตัว (public)
router.get("/products/:id/reviews", listProductReviews);
router.get("/product/:id", getProductById);
// admin: สรุปรีวิวต่อสินค้า + รีวิวล่าสุด
router.get("/admin/reviews/summary", authCheck, adminCheck, adminListReviewStats);

router.get("/admin/reviews", authCheck, adminCheck, adminListReviews);

router.get("/orders/:id/reviews/mine", authCheck, getMyReviewsForOrder);

module.exports = router;
