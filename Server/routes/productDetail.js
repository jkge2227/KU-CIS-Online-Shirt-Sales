const express = require("express");
const router = express.Router();
const { getOneProduct, listProductReviewsDetail } = require("../controllers/productDetail");

router.get("/product/:id", getOneProduct);
router.get("/products/:id/reviews/detail", listProductReviewsDetail);

module.exports = router;
