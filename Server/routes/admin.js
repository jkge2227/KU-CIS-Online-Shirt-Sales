//Server/routes/admin.js

const express = require('express')
const { authCheck, adminCheck } = require('../middlewares/authCheck')
const router = express.Router()
//// import controller
const { getOrderAdmin, changeOrderstatus, listAllOrders,
    updateOrderStatus,
    cancelOrderAdmin,
    deleteOrderAdmin,
    lowStockNotifications,
    newOrderNotifications,
    setPickupForOrders,
    updatePickupForOrder, } = require('../controllers/admin')

router.post('/admin/order-status', authCheck, changeOrderstatus)
router.get('/admin/order', authCheck, getOrderAdmin)

router.post('/admin/orders/pickup', authCheck, adminCheck, setPickupForOrders)
router.patch('/admin/orders/:id/pickup', authCheck, adminCheck, updatePickupForOrder);

router.get("/admin/orders", authCheck, listAllOrders);
router.put("/admin/orders/:id/status", authCheck, updateOrderStatus);
router.put("/admin/orders/:id/cancel", authCheck, cancelOrderAdmin);
router.delete("/admin/orders/:id", authCheck, deleteOrderAdmin);
router.get("/admin/low-stock",authCheck,adminCheck, lowStockNotifications);
router.get('/admin/new-orders',authCheck,adminCheck, newOrderNotifications);


module.exports = router