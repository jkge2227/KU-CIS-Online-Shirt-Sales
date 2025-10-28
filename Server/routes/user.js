const express = require('express')
const router = express.Router()
const { authCheck, adminCheck } = require('../middlewares/authCheck')
const { listUsers, changeStatus, changeRole, userCart,
  getUserCart, emptyCart, saveAddress, saveOrder, getOrder, cancelMyOrder,
  cancelAndDeleteMyOrder,
  getOrderHistory,
  changePassword,
  profile,
  updateprofile,
  requestPasswordOtp,
  verifyResetOtp,
  resetPasswordWithOtp,
  getMyStatus } = require('../controllers/user')
const { cancelExpiredOrdersJob } = require('../controllers/product')
const { enabledRequired } = require('../middlewares/enabledRequired')


router.get('/user', authCheck, adminCheck, listUsers)
router.post('/change-status', authCheck, enabledRequired, adminCheck, changeStatus)
router.post('/change-role', authCheck, enabledRequired, adminCheck, changeRole)

router.post('/user/cart', authCheck, enabledRequired, userCart)
router.get('/user/cart', authCheck, getUserCart)
router.delete('/user/cart', authCheck, enabledRequired, emptyCart)

router.post('/user/order', authCheck, enabledRequired, saveOrder)

router.get('/user/order', authCheck, getOrder)

router.put('/orders/:id/cancel', authCheck, cancelMyOrder);
router.delete('/orders/:id', authCheck, cancelAndDeleteMyOrder);

router.post('/orders/cancel-expired', authCheck, enabledRequired, adminCheck, async (req, res) => {
  try {
    const days = Number(req.body?.days || 3);
    const result = await cancelExpiredOrdersJob(days);
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.get('/user/order-history', authCheck, getOrderHistory)

router.get('/profile', authCheck, profile)                  // ดึงโปรไฟล์ตัวเอง
router.put('/upprofile', authCheck, enabledRequired, updateprofile)            // แก้ไขโปรไฟล์
router.put('/me/password', authCheck, enabledRequired, changePassword) // เปลี่ยนรหัสผ่าน

router.post('/forgot-password-otp', requestPasswordOtp);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password-otp', resetPasswordWithOtp);

router.get('/me/status', authCheck, getMyStatus);

module.exports = router