//Server/routes/admin.js

const express = require('express')
const { authCheck, adminCheck } = require('../middlewares/authCheck')
const router = express.Router()
//// import controller
const { getOrderAdmin, changeOrderstatus, listAllOrders,
    updateOrderStatus,
    lowStockNotifications,
    newOrderNotifications,
    setPickupForOrders,
    updatePickupForOrder,
    adminCancelOrder,
    updateCancelInfo, } = require('../controllers/admin')

router.post('/admin/order-status', authCheck, changeOrderstatus)
router.get('/admin/order', authCheck, getOrderAdmin)

router.post('/admin/orders/pickup', authCheck, adminCheck, setPickupForOrders)
router.patch('/admin/orders/:id/pickup', authCheck, adminCheck, updatePickupForOrder);

router.get("/admin/orders", authCheck, listAllOrders);
router.put("/admin/orders/:id/status", authCheck, updateOrderStatus);
router.put("/admin/orders/:id/cancel", authCheck, adminCheck, adminCancelOrder);
router.patch("/admin/orders/:id/cancel", authCheck, adminCheck, updateCancelInfo);

router.get("/admin/low-stock",authCheck,adminCheck, lowStockNotifications);
router.get('/admin/new-orders',authCheck,adminCheck, newOrderNotifications);




module.exports = router