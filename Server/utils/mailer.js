// server/utils/mailer.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false, // 587 = STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendOtpMail(to, otp) {
  const from = process.env.EMAIL_FROM ?? process.env.SMTP_USER;
  const subject = "รหัสยืนยันการสมัครสมาชิก (OTP)";
  const html = `
    <div style="font-family:sans-serif;line-height:1.6">
      <h2>รหัสยืนยัน (OTP)</h2>
      <p>กรุณากรอกรหัส OTP ต่อไปนี้ภายใน 5 นาที:</p>
      <div style="font-size:24px;font-weight:bold;letter-spacing:2px">${otp}</div>
      <p>หากคุณไม่ได้ร้องขอ สามารถเพิกเฉยอีเมลนี้ได้</p>
    </div>
  `;
  await transporter.sendMail({ from, to, subject, html });
}

module.exports = { sendOtpMail };
