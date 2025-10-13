import React, { useState } from "react";
import { toast } from "react-toastify";
import useEcomStore from "../../store/ecom-store";
import { useNavigate } from "react-router-dom";
import { Mail, KeyRound, Eye, EyeOff, Shirt } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const actionLogin = useEcomStore((state) => state.actionLogin);

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const roleRedirect = (role) => {
    if (role === "admin") navigate("/admin/dashboard");
    else {
      navigate("/shop"); 
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    const password = form.password;

    if (!email || !password) {
      toast.error("กรอกอีเมลและรหัสผ่านให้ครบ");
      return;
    }

    try {
      setSubmitting(true);
      const res = await actionLogin({ email, password });
      const role = res?.data?.PayLoad?.role;
      toast.success("เข้าสู่ระบบสำเร็จ");
      roleRedirect(role);
    } catch (err) {
      const errMsg =
        err?.response?.data?.message ||
        err?.message ||
        "เข้าสู่ระบบไม่สำเร็จ";
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !!form.email && !!form.password && !submitting;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header Card */}
        <div className="mb-5 rounded-2xl bg-white border shadow-sm p-5">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              เข้าสู่ระบบ
            </h1>
          </div>
          <p className="text-sm text-gray-500 text-center mt-1">
            ระบบขายเสื้อ KU CIS ออนไลน์
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl bg-white border shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                อีเมล
              </label>
              <div className="mt-1 relative">
                <Mail className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  className="w-full rounded-lg border px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={onChange}
                  placeholder="name@example.com"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                รหัสผ่าน
              </label>
              <div className="mt-1 relative">
                <KeyRound className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  className="w-full rounded-lg border px-3 py-2 pl-9 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  name="password"
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={onChange}
                  placeholder="••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-800"
                  aria-label={showPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full font-semibold py-3 rounded-lg text-white transition flex items-center justify-center gap-2 ${
                canSubmit
                  ? "bg-gray-900 hover:bg-black"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              {submitting && (
                <span className="inline-block h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              เข้าสู่ระบบ
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 border-t" />

          {/* Links */}
          <div className="text-center text-sm text-gray-600 flex items-center justify-center gap-2 flex-wrap">
            <span>หากยังไม่เป็นสมาชิก</span>
            <button
              type="button"
              className="text-gray-900 font-semibold hover:underline"
              onClick={() => navigate("/register")}
            >
              สมัครสมาชิก
            </button>
            <span className="hidden sm:inline">|</span>
            <button
              type="button"
              className="text-gray-900 font-semibold hover:underline"
              onClick={() => navigate("/forgot-password")}
            >
              ลืมรหัสผ่าน คลิก
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
