import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { resetPassword, validateResetToken } from "../../api/profile";
import { toast } from "react-toastify";
import { KeyRound } from "lucide-react";

const ResetPassword = () => {
    const [sp] = useSearchParams();
    const navigate = useNavigate();
    const token = sp.get("token") || "";
    const [valid, setValid] = useState(false);
    const [pass1, setPass1] = useState("");
    const [pass2, setPass2] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                if (!token) return;
                await validateResetToken(token);
                setValid(true);
            } catch (e) {
                toast.error(e?.response?.data?.message ?? "ลิงก์หมดอายุหรือไม่ถูกต้อง");
            }
        })();
    }, [token]);

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!pass1 || pass1.length < 6) return toast.error("รหัสผ่านอย่างน้อย 6 ตัว");
        if (pass1 !== pass2) return toast.error("ยืนยันรหัสผ่านไม่ตรงกัน");
        try {
            setSaving(true);
            await resetPassword(token, pass1);
            toast.success("รีเซ็ตรหัสผ่านสำเร็จ");
            navigate("/login");
        } catch (e) {
            toast.error(e?.response?.data?.message ?? "รีเซ็ตไม่สำเร็จ");
        } finally {
            setSaving(false);
        }
    };

    if (!token) {
        return <div className="max-w-md mx-auto p-6">ไม่พบ token</div>;
    }

    if (!valid) {
        return <div className="max-w-md mx-auto p-6">กำลังตรวจสอบลิงก์…</div>;
    }

    return (
        <div className="max-w-md mx-auto p-6">
            <h1 className="text-xl font-bold mb-4">ตั้งรหัสผ่านใหม่</h1>
            <form onSubmit={onSubmit} className="space-y-3">
                <div className="relative">
                    <KeyRound className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="password"
                        placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)"
                        value={pass1}
                        onChange={(e) => setPass1(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 pl-9 focus:outline-none focus:ring-2 focus:ring-gray-800"
                    />
                </div>
                <div className="relative">
                    <KeyRound className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="password"
                        placeholder="ยืนยันรหัสผ่านใหม่"
                        value={pass2}
                        onChange={(e) => setPass2(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 pl-9 focus:outline-none focus:ring-2 focus:ring-gray-800"
                    />
                    </div>
                <button
                    disabled={saving}
                    className={`w-full px-4 py-2 rounded-lg text-white ${saving ? "bg-gray-900" : "bg-gray-800 hover:bg-gray-900"}`}
                >
                    ตั้งรหัสผ่านใหม่
                </button>
            </form>
        </div>
    );
};

export default ResetPassword;
