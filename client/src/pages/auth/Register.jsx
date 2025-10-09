import React, { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { Mail, KeyRound, User2, Phone as PhoneIcon, IdCard as IdCardIcon } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5001/api";

// === helpers ===
const onlyDigits = (s) => String(s || "").replace(/\D+/g, "");

// ฟอร์แมตบัตรประชาชนไทย x-xxxx-xxxxx-xx-x ระหว่างพิมพ์ (แสดงผล)
function formatThaiID(input) {
  const d = onlyDigits(input).slice(0, 13);
  const seg = [1, 4, 5, 2, 1]; // 1-4-5-2-1
  let out = "";
  let i = 0;
  for (let k = 0; k < seg.length; k++) {
    const take = seg[k];
    const part = d.slice(i, i + take);
    if (!part) break;
    out += (out ? "-" : "") + part;
    i += part.length;
    if (part.length < take) break;
  }
  return out;
}

function Register() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",    // เก็บเป็นเลขล้วนใน state
    id_card: "",  // เก็บ "แบบที่แสดงผล" (มีขีด) ใน state
  });

  // --- derived validation states ---
  const phoneDigits = onlyDigits(form.phone).slice(0, 10);
  const idDigits = onlyDigits(form.id_card).slice(0, 13);

  const isPhoneInvalid = phoneDigits.length !== 10;
  const isIdInvalid = idDigits.length !== 13;
  const isPwInvalid = form.password.length < 6;
  const isPwMismatch = form.password !== form.confirmPassword;

  const canSubmit =
    !submitting &&
    !!form.first_name &&
    !!form.last_name &&
    !!form.email &&
    !!form.password &&
    !!form.confirmPassword &&
    !!phoneDigits &&
    !!idDigits &&
    !isPhoneInvalid &&
    !isIdInvalid &&
    !isPwInvalid &&
    !isPwMismatch;

  // --- handlers ---
  const handleOnChange = (e) => {
    const { name, value } = e.target;
    if (name === "email") {
      setForm((s) => ({ ...s, email: value }));
      return;
    }
    setForm((s) => ({ ...s, [name]: value }));
  };

  const handlePhoneChange = (e) => {
    const v = onlyDigits(e.target.value).slice(0, 10);
    setForm((s) => ({ ...s, phone: v }));
  };

  const handleIdChange = (e) => {
    const v = formatThaiID(e.target.value); // แสดงผลแบบมีขีด
    setForm((s) => ({ ...s, id_card: v }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isPwMismatch) {
      toast.error("รหัสผ่านไม่ตรงกัน");
      return;
    }
    if (isPwInvalid) {
      toast.error("รหัสผ่านอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (isPhoneInvalid) {
      toast.error("กรอกเบอร์โทรให้ครบ 10 หลัก");
      return;
    }
    if (isIdInvalid) {
      toast.error("กรอกเลขบัตรประชาชนให้ครบ 13 หลัก");
      return;
    }

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      phone: phoneDigits,         // ส่งเลขล้วน 10 หลัก
      id_card: idDigits,          // ส่งเลขล้วน 13 หลัก
    };

    try {
      setSubmitting(true);
      const res = await axios.post(`${API_BASE}/register`, payload, { timeout: 15000 });
      toast.success("สมัครสมาชิกสำเร็จ!");
      console.log(res.data);
      navigate("/login");
    } catch (err) {
      const errMsg = err?.response?.data?.message || err?.message || "เกิดข้อผิดพลาด";
      toast.error(errMsg);
      console.log(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* header card */}
        <div className="mb-5 rounded-2xl bg-white shadow-sm border p-5">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">สมัครสมาชิก</h1>
          <p className="text-sm text-gray-500 text-center mt-1">
            สร้างบัญชีเพื่อเริ่มสั่งซื้อและติดตามออเดอร์ของคุณ
          </p>
        </div>

        {/* form card */}
        <div className="rounded-2xl bg-white shadow-sm border p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* อีเมล */}
            <div>
              <label className="block text-sm font-medium text-gray-700">อีเมล</label>
              <div className="mt-1 relative">
                <Mail className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  className="w-full rounded-lg border px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  onChange={handleOnChange}
                  name="email"
                  type="email"
                  value={form.email}
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            {/* รหัสผ่าน */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">รหัสผ่าน</label>
                <div className="mt-1 relative">
                  <KeyRound className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    className="w-full rounded-lg border px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    onChange={handleOnChange}
                    name="password"
                    type="password"
                    value={form.password}
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    required
                  />
                </div>
                {isPwInvalid && (
                  <div className="mt-1 text-xs text-red-600">รหัสผ่านอย่างน้อย 6 ตัวอักษร</div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">ยืนยันรหัสผ่าน</label>
                <div className="mt-1 relative">
                  <KeyRound className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    className="w-full rounded-lg border px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    onChange={handleOnChange}
                    name="confirmPassword"
                    type="password"
                    value={form.confirmPassword}
                    placeholder="พิมพ์ซ้ำรหัสผ่าน"
                    required
                  />
                </div>
                {isPwMismatch && (
                  <div className="mt-1 text-xs text-red-600">รหัสผ่านไม่ตรงกัน</div>
                )}
              </div>
            </div>

            {/* ชื่อ-นามสกุล */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">ชื่อ</label>
                <div className="mt-1 relative">
                  <User2 className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    className="w-full rounded-lg border px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    onChange={handleOnChange}
                    name="first_name"
                    type="text"
                    value={form.first_name}
                    placeholder="ชื่อจริง"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">นามสกุล</label>
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 mt-1"
                  onChange={handleOnChange}
                  name="last_name"
                  type="text"
                  value={form.last_name}
                  placeholder="นามสกุล"
                  required
                />
              </div>
            </div>

            {/* เบอร์โทร */}
            <div>
              <label className="block text-sm font-medium text-gray-700">เบอร์โทร</label>
              <div className="mt-1 relative">
                <PhoneIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  className="w-full rounded-lg border px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  onChange={handlePhoneChange}
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phoneDigits}
                  placeholder="เช่น 0812345678"
                  required
                />
              </div>
              {isPhoneInvalid && (
                <div className="mt-1 text-xs text-red-600">กรอกเบอร์โทรให้ครบ 10 หลัก</div>
              )}
            </div>

            {/* เลขบัตรประชาชน */}
            <div>
              <label className="block text-sm font-medium text-gray-700">เลขบัตรประชาชน</label>
              <div className="mt-1 relative">
                <IdCardIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  className="w-full rounded-lg border px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  onChange={handleIdChange}
                  name="id_card"
                  type="text"
                  inputMode="numeric"
                  maxLength={17} // 13 ตัว + ขีด 4 ตัว
                  value={form.id_card}
                  placeholder="x-xxxx-xxxxx-xx-x"
                  required
                />
              </div>
              {isIdInvalid && (
                <div className="mt-1 text-xs text-red-600">
                  กรอกเลขบัตรประชาชนให้ครบ 13 หลัก
                </div>
              )}
            </div>

            {/* ปุ่ม */}
            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full font-semibold py-3 rounded-lg text-white transition ${canSubmit ? "bg-gray-900 hover:bg-black" : "bg-gray-300 cursor-not-allowed"
                }`}
            >
              {submitting ? "กำลังสมัครสมาชิก…" : "สมัครสมาชิก"}
            </button>
          </form>

          {/* เส้นคั่น */}
          <div className="my-6 border-t"></div>

          {/* ลิงก์เข้าสู่ระบบ */}
          <div className="text-center text-sm text-gray-600">
            มีบัญชีอยู่แล้วใช่ไหม?{" "}
            <button
              type="button"
              className="text-gray-900 font-semibold hover:underline"
              onClick={() => navigate("/login")}
            >
              เข้าสู่ระบบ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
