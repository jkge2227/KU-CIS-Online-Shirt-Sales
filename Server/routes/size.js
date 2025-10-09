// routes/size.js
const express = require('express');
const router = express.Router();
const { create, list, getOne, update, remove } = require('../controllers/size');
const { authCheck, adminCheck } = require('../middlewares/authCheck');

router.post('/size', authCheck, adminCheck, create);
router.get('/size', list);                 // ?page&limit&query&sort&order
router.get('/size/:id', getOne);
router.put('/size/:id', authCheck, adminCheck, update);
router.delete('/size/:id', authCheck, adminCheck, remove);

module.exports = router;
