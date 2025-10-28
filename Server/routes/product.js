const express = require('express')
const router = express.Router()
// import controllers
const { create, list, read, update, remove, listby, searchfilters, createImages, removeImage, getProductVariants } = require('../controllers/product')
const { authCheck, adminCheck } = require('../middlewares/authCheck')
// http://localhost:5002/api/product //
router.post('/product', create)
router.get('/products/:count', list)
router.get('/product/:id', read)
router.put('/product/:id', update)
router.delete('/product/:id', remove)
router.post('/productby', listby)
router.post('/search/filters', searchfilters)

router.post('/images', authCheck, adminCheck, createImages)
router.post('/removeimages', authCheck, adminCheck, removeImage)

router.get("/products/:productId/variants", getProductVariants);

module.exports = router

