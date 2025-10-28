// Server/middlewares/enabledRequired.js
exports.enabledRequired = (req, res, next) => {
    if (!req.user?.enabled) {
        return res.status(403).json({ message: 'บัญชีถูกปิดใช้งาน: อนุญาตเฉพาะการอ่านข้อมูล' })
    }
    next()
}
