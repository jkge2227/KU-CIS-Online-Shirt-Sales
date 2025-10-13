const express = require('express')
const router = express.Router()
const { create, list, remove, update } = require('../controllers/category')
const { authCheck, adminCheck } = require('../middlewares/authCheck')

router.post('/category', authCheck, adminCheck, create)
router.get('/category', list)
router.delete('/category/:id', authCheck, adminCheck, remove)
router.put('/category/:id', authCheck, adminCheck, update)


module.exports = router