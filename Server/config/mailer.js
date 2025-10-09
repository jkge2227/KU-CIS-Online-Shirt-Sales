let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch { }

let transporter = null;
const hasSMTP = !!nodemailer && !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;

if (hasSMTP) {
    const secure = String(process.env.SMTP_PORT || '587') === '465';
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    transporter.verify()
        .then(() => console.log('[mailer] SMTP ready:', process.env.SMTP_HOST, process.env.SMTP_USER))
        .catch(err => console.error('[mailer] SMTP verify error:', err?.message || err));
} else {
    console.warn('[mailer] No SMTP config detected. Using DEV logger mode.');
}

async function sendMail({ to, subject, html }) {
    if (!transporter) {
        console.log('[DEV MAIL]', { to, subject, html });
        return { dev: true };
    }
    const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to, subject, html,
    });
    console.log('[mailer] sent:', info?.messageId, info?.response);
    return info;
}
function isSMTPReady() { return !!transporter; }
module.exports = { sendMail, isSMTPReady };

module.exports = { sendMail, isSMTPReady };
