// import .... 

const express = require('express')
const router = express.Router()
//// import controller
const { register, login, currentUser, requestEmailOtp, verifyEmailOtp } = require('../controllers/auth')
/// import Middleware
const { authCheck, adminCheck } = require('../middlewares/authCheck')

router.post('/register', register)
router.post('/login', login)
router.post('/current-user', authCheck, currentUser)
router.post('/current-admin', authCheck, adminCheck, currentUser)


router.post("/auth/otp/request", requestEmailOtp);
router.post("/auth/otp/verify", verifyEmailOtp);


module.exports = router