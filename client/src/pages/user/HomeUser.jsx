// client/src/pages/user/HomeUser.jsx
import React, { useEffect, useState } from "react";
import useEcomStore from "../../store/ecom-store";
import {
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  requestPasswordOtp,
  verifyResetOtp,
  resetPasswordWithOtp,
} from "../../api/profile";
import { toast } from "react-toastify";
import { User2, Mail, Phone, IdCard, Save, KeyRound } from "lucide-react";

const COOLDOWN_SECONDS = 60;

const Label = ({ children }) => (
  <label className="text-sm font-medium text-gray-700">{children}</label>
);

const Inp = (props) => (
  <input
    {...props}
    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${props.className || ""}`}
  />
);

const Section = ({ title, icon, children, footer }) => (
  <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
    <div className="px-4 sm:px-5 py-3 border-b flex items-center gap-2">
      {icon}
      <div className="font-semibold">{title}</div>
    </div>
    <div className="p-4 sm:p-5 space-y-4">{children}</div>
    {footer && <div className="px-4 sm:px-5 py-3 border-t bg-gray-50">{footer}</div>}
  </div>
);

// helpers
const onlyDigits = (s) => String(s || "").replace(/\D+/g, "");

// ฟอร์แมตรูปแบบบัตร: x-xxxx-xxxxx-xx-x (รวมขีดสูงสุด 17 ตัวอักษร)
function formatThaiID(input) {
  const d = onlyDigits(input).slice(0, 13);
  const seg = [1, 4, 5, 2, 1];
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

const HomeUser = () => {
  const token = useEcomStore((s) => s.token);
  const users = useEcomStore((s) => s.users);
  const [loading, setLoading] = useState(true);

  // --- โปรไฟล์ ---
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "",
    phone: "", id_card: "",
  });
  const [saving, setSaving] = useState(false);

  // --- เปลี่ยนรหัสผ่าน (รู้รหัสเดิม) ---
  const [pwd, setPwd] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [savingPwd, setSavingPwd] = useState(false);

  // --- ลืมรหัสผ่านด้วย OTP (3 ขั้นตอน) ---
  const [forgotOpen, setForgotOpen] = useState(false);
  const [otpStep, setOtpStep] = useState(1); // 1: ขอ OTP, 2: ใส่ OTP, 3: ตั้งรหัสใหม่
  const [sendingReset, setSendingReset] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [otpNewPwd, setOtpNewPwd] = useState("");
  const [otpConfirm, setOtpConfirm] = useState("");
  const [cooldown, setCooldown] = useState(0); // วินาที

  const load = async () => {
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await getMyProfile(token);
      const u = data?.user || users || {};
      setForm({
        first_name: u.first_name ?? "",
        last_name: u.last_name ?? "",
        email: u.email ?? "",
        phone: onlyDigits(u.phone ?? "").slice(0, 10), // เก็บเป็นเลขล้วน
        id_card: formatThaiID(u.id_card ?? ""),        // แสดงแบบมีขีด
      });
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message ?? "โหลดโปรไฟล์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  // โหลดโปรไฟล์ครั้งแรก + กันโหลดค้าง
  useEffect(() => {
    let timedOut = false;
    const hardTimeout = setTimeout(() => {
      timedOut = true;
      setLoading(false);
      toast.error("โหลดโปรไฟล์นานผิดปกติ (ตรวจสอบเซิร์ฟเวอร์หรือการเชื่อมต่อ)");
    }, 10000); // 10 วินาที

    (async () => {
      try {
        await load();
      } finally {
        if (!timedOut) clearTimeout(hardTimeout);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // 🔥 นับถอยหลัง cooldown ขอ OTP ใหม่
  useEffect(() => {
    if (cooldown <= 0) return; // ไม่ต้องตั้ง interval ถ้าเหลือ 0
    const id = setInterval(() => {
      setCooldown((sec) => {
        const next = sec - 1;
        return next > 0 ? next : 0;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // invalid states
  const phoneDigits = onlyDigits(form.phone);
  const idDigits = onlyDigits(form.id_card);
  const isPhoneInvalid = form.phone !== "" && phoneDigits.length !== 10;
  const isIdInvalid = form.id_card !== "" && idDigits.length !== 13;

  const onSave = async () => {
    if (!token) return toast.error("กรุณาเข้าสู่ระบบ");
    if (isPhoneInvalid) return toast.error("กรุณากรอกเบอร์โทรให้ครบ 10 หลัก");
    if (isIdInvalid) return toast.error("กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก");
    try {
      setSaving(true);
      const payload = {
        ...form,
        email: String(form.email || "").trim().toLowerCase(),
        phone: onlyDigits(form.phone).slice(0, 10),     // ส่งเลขล้วน
        id_card: onlyDigits(form.id_card).slice(0, 13), // ส่งเลขล้วน
      };
      const { data } = await updateMyProfile(token, payload);
      // sync ไปที่ store (Zustand)
      useEcomStore.setState((s) => ({ users: { ...(s.users || {}), ...(data?.user || {}) } }));
      toast.success("บันทึกโปรไฟล์เรียบร้อย");
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const onChangePwd = async () => {
    if (!token) return toast.error("กรุณาเข้าสู่ระบบ");
    if (!pwd.currentPassword || !pwd.newPassword) {
      return toast.error("กรอกรหัสผ่านให้ครบ");
    }
    if (pwd.newPassword.length < 6) {
      return toast.error("รหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร");
    }
    if (pwd.newPassword !== pwd.confirm) {
      return toast.error("ยืนยันรหัสผ่านไม่ตรงกัน");
    }
    try {
      setSavingPwd(true);
      await changeMyPassword(token, { currentPassword: pwd.currentPassword, newPassword: pwd.newPassword });
      toast.success("เปลี่ยนรหัสผ่านสำเร็จ");
      setPwd({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    } finally {
      setSavingPwd(false);
    }
  };

  // ===== Forgot Password with OTP =====
  const resetOtpModal = () => {
    setOtpStep(1);
    setOtpCode("");
    setOtpToken("");
    setOtpNewPwd("");
    setOtpConfirm("");
    setCooldown(0);
  };

  const openForgot = () => {
    if (!form.email) return toast.error("ไม่พบอีเมลในโปรไฟล์");
    resetOtpModal();
    setForgotOpen(true);
  };

  // กรอง OTP เป็นเลข 0-9 สูงสุด 6 หลัก
  const onOtpInput = (v) => {
    const onlyNum = String(v || "").replace(/\D+/g, "").slice(0, 6);
    setOtpCode(onlyNum);
  };

  // Step 1: ขอ OTP
  const sendOtp = async () => {
    const email = String(form.email || "").trim().toLowerCase();
    if (!email) return toast.error("ไม่พบอีเมลในโปรไฟล์");
    try {
      setSendingReset(true);
      await requestPasswordOtp(email);
      toast.success("ถ้ามีบัญชีนี้ เราได้ส่งรหัส OTP ไปยังอีเมลแล้ว");
      setOtpStep(2);
      setCooldown(COOLDOWN_SECONDS); // ขอรหัสใหม่ได้อีกครั้งใน 60 วินาที
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || e?.message || "ขอ OTP ไม่สำเร็จ");
    } finally {
      setSendingReset(false);
    }
  };

  // Step 2: ยืนยัน OTP
  const verifyOtp = async () => {
    const email = String(form.email || "").trim().toLowerCase();
    if (!otpCode || otpCode.length < 6) return toast.error("กรอกรหัส OTP 6 หลัก");
    try {
      setSendingReset(true);
      const { data } = await verifyResetOtp(email, String(otpCode).trim());
      const token = data?.otpToken;
      if (!token) throw new Error("ไม่มี otpToken");
      setOtpToken(token);
      toast.success("ยืนยัน OTP สำเร็จ");
      setOtpStep(3);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || e?.message || "OTP ไม่ถูกต้อง หรือหมดอายุ");
    } finally {
      setSendingReset(false);
    }
  };

  // Step 3: ตั้งรหัสใหม่
  const doResetWithOtp = async () => {
    if (otpNewPwd.length < 6) return toast.error("รหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร");
    if (otpNewPwd !== otpConfirm) return toast.error("ยืนยันรหัสผ่านไม่ตรงกัน");
    try {
      setSendingReset(true);
      await resetPasswordWithOtp(otpToken, otpNewPwd);
      toast.success("ตั้งรหัสผ่านใหม่สำเร็จ");
      setForgotOpen(false);
      resetOtpModal();
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || e?.message || "รีเซ็ตรหัสผ่านไม่สำเร็จ");
    } finally {
      setSendingReset(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-100 rounded-2xl" />
          <div className="h-56 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">

      {/* ข้อมูลผู้ใช้ */}
      <Section
        title="ข้อมูลส่วนตัว"
        icon={<User2 className="h-5 w-5 text-blue-600" />}
        footer={
          <button
            onClick={onSave}
            disabled={saving || isPhoneInvalid || isIdInvalid}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white ${saving || isPhoneInvalid || isIdInvalid ? "bg-blue-300 cursor-not-allowed" : "bg-gray-700 hover:bg-gray-800"}`}
          >
            <Save className="h-4 w-4" /> บันทึก
          </button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>ชื่อ</Label>
            <div className="mt-1 flex items-center gap-2">
              <Inp value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} placeholder="ชื่อจริง" />
            </div>
          </div>
          <div>
            <Label>นามสกุล</Label>
            <Inp value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} placeholder="นามสกุล" />
          </div>
          <div>
            <Label>เบอร์โทร</Label>
            <div className="mt-1 relative">
              <Phone className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Inp
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: onlyDigits(e.target.value).slice(0, 10) })}
                placeholder="เช่น 0812345678"
                style={{ paddingLeft: 36 }}
                inputMode="numeric"
                maxLength={10}
              />
              {isPhoneInvalid && (
                <div className="mt-1 text-xs text-red-600">กรอกเบอร์โทรให้ครบ 10 หลัก</div>
              )}
            </div>
          </div>

          <div>
            <Label>เลขบัตรประชาชน</Label>
            <div className="mt-1 relative">
              <IdCard className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Inp
                value={form.id_card}
                onChange={(e) => setForm({ ...form, id_card: formatThaiID(e.target.value) })}
                placeholder="x-xxxx-xxxxx-xx-x"
                style={{ paddingLeft: 36 }}
                inputMode="numeric"
                maxLength={17} // 13 ตัว + ขีด 4 ตัว
              />
              {isIdInvalid && (
                <div className="mt-1 text-xs text-red-600">กรอกเลขบัตรประชาชนให้ครบ 13 หลัก</div>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* เปลี่ยนรหัสผ่าน (รู้รหัสเดิม) */}
      <Section
        title="เปลี่ยนรหัสผ่าน"
        icon={<KeyRound className="h-5 w-5 text-gray-600" />}
        footer={
          <div className="flex items-center justify-between">
            <button
              onClick={onChangePwd}
              disabled={savingPwd}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white ${savingPwd ? "bg-gray-300 cursor-not-allowed" : "bg-gray-700 hover:bg-gray-800"}`}
              type="button"
            >
              เปลี่ยนรหัสผ่าน
            </button>
            <button
              onClick={openForgot}
              className="px-4 py-2 rounded-lg text-white bg-gray-700 hover:bg-gray-800"
              type="button"
            >
              ลืมรหัสผ่าน
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>รหัสผ่านเดิม</Label>
            <Inp type="password" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} placeholder="••••••" />
          </div>
          <div>
            <Label>รหัสผ่านใหม่</Label>
            <Inp type="password" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} placeholder="อย่างน้อย 6 ตัวอักษร" />
          </div>
          <div>
            <Label>ยืนยันรหัสผ่านใหม่</Label>
            <Inp type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} placeholder="พิมพ์ซ้ำ" />
          </div>
        </div>
      </Section>

      {/* โมดัล ลืมรหัสผ่าน (OTP 3 ขั้นตอน) */}
      {forgotOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="p-5 border-b font-semibold">ลืมรหัสผ่าน</div>

            <div className="p-5 space-y-4">
              {/* แสดงอีเมล */}
              <div className="text-sm text-gray-600">อีเมลที่จะใช้รับ OTP</div>
              <div className="relative">
                <Mail className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={form.email}
                  readOnly
                  className="w-full rounded-lg border px-3 py-2 text-sm pl-9 bg-gray-50"
                />
              </div>

              {/* Step indicator */}
              <div className="text-xs text-gray-500">
                ขั้นตอน {otpStep} / 3
              </div>

              {/* Step 1: ขอ OTP */}
              {otpStep === 1 && (
                <div className="space-y-2">
                  {/* คำอธิบาย */}
                  <div className="text-sm text-gray-700">
                    กด “ส่งรหัส OTP” ระบบจะส่งรหัสไปทางอีเมลของคุณ
                  </div>
                </div>
              )}

              {/* Step 2: กรอก OTP */}
              {otpStep === 2 && (
                <div className="space-y-2">
                  <Label>กรอกรหัส OTP 6 หลัก</Label>
                  <Inp
                    value={otpCode}
                    onChange={(e) => onOtpInput(e.target.value)}
                    onPaste={(e) => {
                      e.preventDefault();
                      onOtpInput(e.clipboardData.getData("text") || "");
                    }}
                    placeholder="กรอกรหัส OTP 6 หลัก"
                    inputMode="numeric"
                    maxLength={6}
                  />
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setOtpStep(1)}
                      className="text-sm underline"
                    >
                      แก้ไขอีเมล
                    </button>
                    <button
                      type="button"
                      disabled={sendingReset || cooldown > 0}
                      onClick={sendOtp}
                      className={`text-sm px-3 py-1 rounded-lg text-white ${cooldown > 0 ? "bg-gray-400" : "bg-gray-700 hover:bg-gray-800"}`}
                    >
                      {cooldown > 0 ? `ขอรหัสใหม่ (${cooldown}s)` : "ขอรหัสใหม่"}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: ตั้งรหัสใหม่ */}
              {otpStep === 3 && (
                <div className="space-y-3">
                  <div>
                    <Label>รหัสผ่านใหม่</Label>
                    <Inp
                      type="password"
                      value={otpNewPwd}
                      onChange={(e) => setOtpNewPwd(e.target.value)}
                      placeholder="อย่างน้อย 6 ตัวอักษร"
                    />
                  </div>
                  <div>
                    <Label>ยืนยันรหัสผ่านใหม่</Label>
                    <Inp
                      type="password"
                      value={otpConfirm}
                      onChange={(e) => setOtpConfirm(e.target.value)}
                      placeholder="พิมพ์ซ้ำ"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t flex items-center justify-between gap-2">
              <div className="text-xs text-gray-500">
                {otpStep > 1 && (
                  <button
                    onClick={() => setOtpStep((s) => Math.max(1, s - 1))}
                    className="underline"
                    type="button"
                  >
                    ย้อนกลับ
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setForgotOpen(false); resetOtpModal(); }}
                  className="px-4 py-2 rounded-lg text-white bg-red-500 hover:bg-red-600"
                  type="button"
                >
                  ปิด
                </button>

                {otpStep === 1 && (
                  <button
                    onClick={sendOtp}
                    disabled={sendingReset}
                    className={`px-4 py-2 rounded-lg text-white ${sendingReset ? "bg-gray-500 cursor-not-allowed" : "bg-gray-700 hover:bg-gray-800"}`}
                    type="button"
                  >
                    ส่งรหัส OTP
                  </button>
                )}
                {otpStep === 2 && (
                  <button
                    onClick={verifyOtp}
                    disabled={sendingReset || otpCode.length < 6}
                    className={`px-4 py-2 rounded-lg text-white ${sendingReset ? "bg-gray-500 cursor-not-allowed" : "bg-gray-700 hover:bg-gray-800"}`}
                    type="button"
                  >
                    ยืนยัน OTP
                  </button>
                )}
                {otpStep === 3 && (
                  <button
                    onClick={doResetWithOtp}
                    disabled={sendingReset || !otpNewPwd || !otpConfirm}
                    className={`px-4 py-2 rounded-lg text-white ${sendingReset ? "bg-gray-500 cursor-not-allowed" : "bg-gray-700 hover:bg-gray-800"}`}
                    type="button"
                  >
                    ตั้งรหัสใหม่
                  </button>
                )}
              </div>
            </div>
          </div>
        </div >
      )}

    </div >
  );
};

export default HomeUser;
