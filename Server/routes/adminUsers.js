// Server/routes/admin.js
const express = require('express');
const { authCheck, adminCheck } = require('../middlewares/authCheck');
const router = express.Router();

// ★ เพิ่มคอนโทรลเลอร์สำหรับ Users
const {
  adminListUsers,
  adminCreateUser,
  adminUpdateUser,
  adminUpdateUserPassword,
  adminDeleteUser,
} = require('../controllers/adminUsers');

// ----- Users admin -----
router.get('/admin/users', authCheck, adminCheck, adminListUsers);
router.post('/admin/users', authCheck, adminCheck, adminCreateUser);
router.put('/admin/users/:id', authCheck, adminCheck, adminUpdateUser);
router.patch('/admin/users/:id/password', authCheck, adminCheck, adminUpdateUserPassword);
router.delete('/admin/users/:id', authCheck, adminCheck, adminDeleteUser);

module.exports = router;
