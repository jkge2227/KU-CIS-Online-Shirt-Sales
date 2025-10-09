import React, { useState } from "react";
import { requestPasswordOtp, verifyResetOtp, resetPasswordWithOtp } from "../../api/profile";
import { toast } from "react-toastify";

export default function ForgotPasswordOTP() {
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [otpToken, setOtpToken] = useState("");
    const [pw, setPw] = useState("");
    const [pw2, setPw2] = useState("");
    const [loading, setLoading] = useState(false);

    const onSend = async (e) => {
        e.preventDefault();
        if (!email) return toast.error("กรอกอีเมล");
        try {
            setLoading(true);
            const { data } = await requestPasswordOtp(email);
            toast.success(data?.message || "ถ้ามีบัญชีนี้ เราจะส่งรหัสไปทางอีเมล");
            if (data?.devCode) {
                // โหมดลอง: โชว์รหัส (ห้ามใช้จริง)
                console.log("DEV OTP:", data.devCode);
                toast.info(`DEV OTP: ${data.devCode}`);
            }
            setStep(2);
        } catch (e) {
            toast.error(e?.response?.data?.message ?? "ส่งรหัสไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    };

    const onVerify = async (e) => {
        e.preventDefault();
        if (!email || !code) return toast.error("กรอกให้ครบ");
        try {
            setLoading(true);
            const { data } = await verifyResetOtp(email, code);
            setOtpToken(data.otpToken);
            toast.success("ยืนยันรหัสถูกต้อง");
            setStep(3);
        } catch (e) {
            toast.error(e?.response?.data?.message ?? "รหัสไม่ถูกต้อง/หมดอายุ");
        } finally {
            setLoading(false);
        }
    };

    const onReset = async (e) => {
        e.preventDefault();
        if (!otpToken || !pw || pw !== pw2) return toast.error("ตรวจสอบรหัสผ่าน");
        try {
            setLoading(true);
            await resetPasswordWithOtp(otpToken, pw);
            toast.success("ตั้งรหัสผ่านใหม่สำเร็จ");
            setStep(1);
            setEmail(""); setCode(""); setOtpToken(""); setPw(""); setPw2("");
        } catch (e) {
            toast.error(e?.response?.data?.message ?? "ตั้งรหัสผ่านไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto p-6">
            <h1 className="text-xl font-bold mb-4">รีเซ็ตรหัสผ่านด้วย OTP</h1>

            {step === 1 && (
                <form onSubmit={onSend} className="space-y-3 rounded-xl border p-4 bg-white">
                    <div>
                        <label className="text-sm block mb-1">อีเมล</label>
                        <input className="w-full border rounded-lg px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
                    </div>
                    <button disabled={loading} className={`w-full px-4 py-2 rounded-lg text-white ${loading ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"}`}>
                        ส่งรหัส OTP
                    </button>
                </form>
            )}

            {step === 2 && (
                <form onSubmit={onVerify} className="space-y-3 rounded-xl border p-4 bg-white">
                    <div className="text-sm text-gray-600">เราได้ส่งรหัสไปยัง <b>{email}</b></div>
                    <div>
                        <label className="text-sm block mb-1">รหัส OTP (6 หลัก)</label>
                        <input className="w-full border rounded-lg px-3 py-2" value={code} onChange={(e) => setCode(e.target.value.replace(/\D+/g, ''))} maxLength={6} />
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setStep(1)} className="px-4 py-2 rounded-lg border hover:bg-gray-50">ย้อนกลับ</button>
                        <button disabled={loading} className={`flex-1 px-4 py-2 rounded-lg text-white ${loading ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"}`}>
                            ยืนยันรหัส
                        </button>
                    </div>
                </form>
            )}

            {step === 3 && (
                <form onSubmit={onReset} className="space-y-3 rounded-xl border p-4 bg-white">
                    <div>
                        <label className="text-sm block mb-1">รหัสผ่านใหม่</label>
                        <input type="password" className="w-full border rounded-lg px-3 py-2" value={pw} onChange={(e) => setPw(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-sm block mb-1">ยืนยันรหัสผ่าน</label>
                        <input type="password" className="w-full border rounded-lg px-3 py-2" value={pw2} onChange={(e) => setPw2(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setStep(2)} className="px-4 py-2 rounded-lg border hover:bg-gray-50">ย้อนกลับ</button>
                        <button disabled={loading} className={`flex-1 px-4 py-2 rounded-lg text-white ${loading ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"}`}>
                            ตั้งรหัสผ่านใหม่
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
