// client/src/pages/auth/ForgotPassword.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    requestPasswordOtp,
    verifyResetOtp,
    resetPasswordWithOtp,
} from "../../api/profile";
import { toast } from "react-toastify";
import { Mail, CheckCircle2, KeyRound } from "lucide-react";


const Inp = (props) => (
    <input
        {...props}
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 ${props.className || ""}`}
    />
);

const ForgotPassword = () => {
    const navigate = useNavigate();
    // steps: 1 = request OTP, 2 = verify OTP, 3 = set new password, 4 = done
    const [step, setStep] = useState(1);

    const [email, setEmail] = useState("");
    const [sending, setSending] = useState(false);

    const [code, setCode] = useState("");
    const [otpToken, setOtpToken] = useState("");

    const [pwd1, setPwd1] = useState("");
    const [pwd2, setPwd2] = useState("");

    // cooldown ขอรหัสใหม่ (วิ)
    const [cooldown, setCooldown] = useState(0);
    useEffect(() => {
        if (!cooldown) return;
        const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
        return () => clearInterval(t);
    }, [cooldown]);

    const normEmail = () => String(email).trim().toLowerCase();

    // Step 1: ขอ OTP
    const requestOtp = async (e) => {
        e?.preventDefault?.();
        const em = normEmail();
        if (!em) return toast.error("กรอกอีเมล");
        try {
            setSending(true);
            await requestPasswordOtp(em);
            toast.success("ถ้ามีบัญชีนี้ เราได้ส่งรหัส OTP ไปยังอีเมลแล้ว");
            setStep(2);
            setCooldown(60); // จำกัดการขอรหัสใหม่ทุก 60 วินาที
        } catch (err) {
            console.error(err);
            toast.error(err?.message || "ขอ OTP ไม่สำเร็จ");
        } finally {
            setSending(false);
        }
    };

    // Step 2: ยืนยัน OTP
    const verifyOtp = async (e) => {
        e?.preventDefault?.();
        const em = normEmail();
        if (!em) return toast.error("กรอกอีเมล");
        if (!code || String(code).trim().length < 6) {
            return toast.error("กรอกรหัส OTP 6 หลัก");
        }
        try {
            setSending(true);
            const { data } = await verifyResetOtp(em, String(code).trim());
            const token = data?.otpToken;
            if (!token) throw new Error("ไม่พบ otpToken");
            setOtpToken(token);
            toast.success("ยืนยัน OTP สำเร็จ");
            setStep(3);
        } catch (err) {
            console.error(err);
            toast.error(err?.message || "OTP ไม่ถูกต้องหรือหมดอายุ");
        } finally {
            setSending(false);
        }
    };

    // Step 3: ตั้งรหัสผ่านใหม่
    const resetWithOtp = async (e) => {
        e?.preventDefault?.();
        if (pwd1.length < 6) return toast.error("รหัสผ่านใหม่อย่างน้อย 6 ตัว");
        if (pwd1 !== pwd2) return toast.error("ยืนยันรหัสผ่านไม่ตรงกัน");
        try {
            setSending(true);
            await resetPasswordWithOtp(otpToken, pwd1);
            toast.success("ตั้งรหัสผ่านใหม่สำเร็จ");
            setStep(4); // ไม่ redirect ไปหน้า login
        } catch (err) {
            console.error(err);
            toast.error(err?.message || "รีเซ็ตรหัสผ่านไม่สำเร็จ");
        } finally {
            setSending(false);
        }
    };

    // format OTP: ตัวเลข 6 หลัก
    const onCodeChange = (v) => {
        const onlyNum = v.replace(/\D+/g, "").slice(0, 6);
        setCode(onlyNum);
    };

    return (
        <div className="max-w-md mx-auto p-6 space-y-4">
            <h1 className="text-xl font-bold">ลืมรหัสผ่าน</h1>
            <p className="text-sm text-gray-600">
                ขั้นตอน {step} / 4 —{" "}
                {step === 1 ? "ขอรหัส OTP" : step === 2 ? "ยืนยัน OTP" : step === 3 ? "ตั้งรหัสใหม่" : "เสร็จสมบูรณ์"}
            </p>

            {/* Step 1: Request OTP */}
            {step === 1 && (
                <form onSubmit={requestOtp} className="space-y-3">
                    <div className="relative">
                        <Mail className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Inp
                            type="email"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <button
                        disabled={sending || !email}
                        className={`w-full px-4 py-2 rounded-lg text-white ${sending ? "bg-gray-900" : "bg-gray-800 hover:bg-gray-900"
                            }`}
                    >
                        {sending ? "กำลังส่ง…" : "ส่งรหัส OTP"}
                    </button>
                    <p className="text-xs text-gray-500">
                        ระบบจะส่งรหัส OTP ไปยังอีเมลนี้ (รหัสมีอายุ 10 นาที)
                    </p>
                </form>
            )}

            {/* Step 2: Verify OTP */}
            {step === 2 && (
                <form onSubmit={verifyOtp} className="space-y-3">
                    <div className="text-sm">
                        ส่งไปที่: <span className="font-medium">{normEmail()}</span>
                    </div>
                    <Inp
                        inputMode="numeric"
                        placeholder="กรอกรหัส OTP 6 หลัก"
                        value={code}
                        onChange={(e) => onCodeChange(e.target.value)}
                        maxLength={6}
                    />
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="text-sm underline"
                        >
                            แก้ไขอีเมล
                        </button>
                        <button
                            type="button"
                            disabled={sending || cooldown > 0}
                            onClick={requestOtp}
                            className={`text-sm px-3 py-1 rounded-lg text-white ${cooldown > 0 ? "bg-gray-400" : "bg-gray-700 hover:bg-gray-800"
                                }`}
                        >
                            {cooldown > 0 ? `ขอรหัสใหม่ (${cooldown}s)` : "ขอรหัสใหม่"}
                        </button>
                    </div>
                    <button
                        disabled={sending || code.length < 6}
                        className={`w-full px-4 py-2 rounded-lg text-white ${sending ? "bg-gray-900" : "bg-gray-800 hover:bg-gray-900"
                            }`}
                    >
                        {sending ? "กำลังตรวจสอบ…" : "ยืนยัน OTP"}
                    </button>
                </form>
            )}

            {/* Step 3: New Password */}
            {step === 3 && (
                <form onSubmit={resetWithOtp} className="space-y-3">
                    <div className="text-sm flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>ยืนยัน OTP สำเร็จ — ตั้งรหัสผ่านใหม่</span>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            รหัสผ่านใหม่
                        </label>
                        <Inp
                            type="password"
                            value={pwd1}
                            onChange={(e) => setPwd1(e.target.value)}
                            placeholder="อย่างน้อย 6 ตัวอักษร"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            ยืนยันรหัสผ่านใหม่
                        </label>
                        <Inp
                            type="password"
                            value={pwd2}
                            onChange={(e) => setPwd2(e.target.value)}
                            placeholder="พิมพ์ซ้ำ"
                        />
                    </div>
                    <button
                        disabled={sending || !pwd1 || !pwd2}
                        className={`w-full px-4 py-2 rounded-lg text-white ${sending ? "bg-gray-900" : "bg-gray-800 hover:bg-gray-900"
                            }`}
                    >
                        {sending ? "กำลังตั้งรหัส…" : "ตั้งรหัสใหม่"}
                    </button>
                </form>
            )}

            {/* Step 4: Done */}
            {step === 4 && (
                <div className="space-y-3">
                    <div className="text-lg font-semibold text-emerald-700">
                        ตั้งรหัสผ่านใหม่สำเร็จ 🎉
                    </div>
                    <p className="text-sm text-gray-600">
                        คุณสามารถปิดหน้านี้ได้เลย หรือไปยังส่วนอื่นของเว็บไซต์ตามต้องการ
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate("/login")}
                            className="px-4 py-2 rounded-lg text-white bg-gray-700 hover:bg-gray-800"
                            type="button"
                        >
                            โอเค เข้าใจแล้ว
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ForgotPassword;
