// routes/generation.js
const express = require('express');
const router = express.Router();
const { create, list, getOne, update, remove } = require('../controllers/generation');
const { authCheck, adminCheck } = require('../middlewares/authCheck');

router.post('/generation', authCheck, adminCheck, create);
router.get('/generation', list);           // ?page&limit&query&sort&order
router.get('/generation/:id', getOne);
router.put('/generation/:id', authCheck, adminCheck, update);
router.delete('/generation/:id', authCheck, adminCheck, remove);

module.exports = router;
