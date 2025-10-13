// client/src/components/admin/AdminUsers.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import useEcomStore from "../../store/ecom-store";
import {
    adminListUsers,
    adminCreateUser,
    adminUpdateUser,
    adminUpdateUserPassword,
    adminDeleteUser,
} from "../../api/adminUsers";
import {
    Loader2, RotateCw, Search, Plus, Pencil, Trash2, KeyRound,
    CheckCircle, XCircle, User, Shield, AlertTriangle
} from "lucide-react";

/* ================= Helpers ================ */
const digitsOnly = (s = "") => String(s).replace(/\D/g, "");

/** Thai ID: format as X-XXXX-XXXXX-XX-X while typing; validate 13 digits w/ hyphens */
const formatThaiId = (raw = "") => {
    const d = digitsOnly(raw).slice(0, 13);
    const a = d.slice(0, 1);
    const b = d.slice(1, 5);
    const c = d.slice(5, 10);
    const e = d.slice(10, 12);
    const f = d.slice(12, 13);
    let out = a;
    if (b) out += `-${b}`;
    if (c) out += `-${c}`;
    if (e) out += `-${e}`;
    if (f) out += `-${f}`;
    return out;
};
const isValidThaiId = (s = "") => /^\d-\d{4}-\d{5}-\d{2}-\d$/.test(String(s).trim());

/** phone: keep only 10 digits */
const normalizePhone10 = (raw = "") => digitsOnly(raw).slice(0, 10);
const isValidPhone10 = (raw = "") => digitsOnly(raw).length === 10;

/** normalize for search: lowercase, trim, strip spaces/ hyphens */
const norm = (s = "") => String(s).toLowerCase().normalize("NFKD").replace(/\s+/g, " ").trim();
const normLoose = (s = "") => norm(s).replace(/[-\s]/g, "");

/* ================= UI Bits ================ */
const RoleSegment = ({ value, onChange }) => {
    const v = value === "admin" ? "admin" : "user";
    return (
        <div className="inline-flex rounded-xl overflow-hidden ring-1 ring-indigo-200">
            <button
                type="button"
                onClick={() => onChange?.("user")}
                className={`px-3 py-1.5 text-sm transition ${v === "user"
                        ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
                        : "bg-white text-gray-700 hover:bg-indigo-50"
                    }`}
            >
                <span className="inline-flex items-center gap-1">
                    <User className="h-4 w-4" /> user
                </span>
            </button>
            <button
                type="button"
                onClick={() => onChange?.("admin")}
                className={`px-3 py-1.5 text-sm border-l border-indigo-100 transition ${v === "admin"
                        ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
                        : "bg-white text-gray-700 hover:bg-indigo-50"
                    }`}
            >
                <span className="inline-flex items-center gap-1">
                    <Shield className="h-4 w-4" /> admin
                </span>
            </button>
        </div>
    );
};

const Toggle = ({
    checked,
    onChange,
    size = "md",
    onLabel = "เปิดใช้งาน",
    offLabel = "ปิดใช้งาน",
    disabled = false,
}) => {
    const isOn = !!checked;
    const sizes = {
        sm: { w: "w-10", h: "h-5", knob: "h-4 w-4", translate: "translate-x-5", text: "text-xs" },
        md: { w: "w-12", h: "h-6", knob: "h-5 w-5", translate: "translate-x-6", text: "text-sm" },
        lg: { w: "w-14", h: "h-7", knob: "h-6 w-6", translate: "translate-x-7", text: "text-base" },
    }[size];

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange?.(!isOn)}
            className={`inline-flex items-center gap-2 ${sizes.text} select-none ${disabled ? "opacity-60 cursor-not-allowed" : ""
                }`}
            aria-pressed={isOn}
        >
            <span
                className={`relative ${sizes.w} ${sizes.h} rounded-full transition-colors duration-200
        ${isOn ? "bg-emerald-500" : "bg-gray-300"} ring-1 ${isOn ? "ring-emerald-400" : "ring-gray-300"}`}
            >
                <span
                    className={`absolute top-1/2 -translate-y-1/2 left-1 rounded-full bg-white shadow
            transition-transform duration-200 ${sizes.knob} ${isOn ? sizes.translate : ""}`}
                />
            </span>
            <span className={`${isOn ? "text-emerald-700" : "text-gray-600"}`}>
                {isOn ? onLabel : offLabel}
            </span>
        </button>
    );
};

/* Top toast (colorful) */
const useToast = () => {
    const [toast, setToast] = useState({ open: false, msg: "", type: "success" }); // success | error | info
    const timerRef = useRef(null);
    const show = (msg, type = "success", ms = 2600) => {
        setToast({ open: true, msg, type });
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setToast((t) => ({ ...t, open: false })), ms);
    };
    const node = toast.open && (
        <div className="fixed top-4 left-0 right-0 z-[9999] flex justify-center pointer-events-none" role="status" aria-live="polite">
            <div
                className={[
                    "pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 shadow-lg ring-1",
                    toast.type === "success" && "bg-emerald-50 text-emerald-700 ring-emerald-200",
                    toast.type === "error" && "bg-rose-50 text-rose-700 ring-rose-200",
                    toast.type === "info" && "bg-indigo-50 text-indigo-700 ring-indigo-200",
                ].filter(Boolean).join(" ")}
            >
                {toast.type === "success" && <CheckCircle className="h-5 w-5 shrink-0" />}
                {toast.type === "error" && <XCircle className="h-5 w-5 shrink-0" />}
                {toast.type === "info" && <AlertTriangle className="h-5 w-5 shrink-0" />}
                <span className="text-sm">{toast.msg}</span>
                <button onClick={() => setToast((t) => ({ ...t, open: false }))} className="ml-2 text-xs opacity-70 hover:opacity-100">
                    ปิด
                </button>
            </div>
        </div>
    );
    useEffect(() => () => timerRef.current && clearTimeout(timerRef.current), []);
    return { show, node };
};

const ConfirmModal = ({
    open,
    title,
    message,
    confirmText = "ยืนยัน",
    cancelText = "ยกเลิก",
    onConfirm,
    onCancel,
    tone = "info", // info | danger | warn
}) => {
    if (!open) return null;
    const tones = {
        danger: { head: "text-rose-700", btn: "bg-rose-600 hover:bg-rose-700 text-white" },
        warn: { head: "text-amber-700", btn: "bg-amber-500 hover:bg-amber-600 text-white" },
        info: { head: "text-indigo-700", btn: "bg-indigo-600 hover:bg-indigo-700 text-white" },
    }[tone] || {};
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
                <div className="p-5 border-b flex items-center justify-between">
                    <div className={`text-lg font-semibold ${tones.head}`}>{title}</div>
                    <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>
                <div className="p-5 text-sm whitespace-pre-line text-gray-700">{message}</div>
                <div className="p-5 border-t flex items-center justify-end gap-2">
                    <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">
                        {cancelText}
                    </button>
                    <button onClick={onConfirm} className={`px-4 py-2 rounded-lg ${tones.btn}`}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
};

/* ======================= Main ======================= */
const AdminUsers = () => {
    const token = useEcomStore((s) => s.token);

    const { show: showToast, node: toastNode } = useToast();

    // โหลดทั้งหมด -> ค้นหา/แบ่งหน้าในฝั่ง client
    const [allRows, setAllRows] = useState([]);
    const [loading, setLoading] = useState(false);

    // client-side search + pagination
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize] = useState(12);

    // modals & forms
    const [editOpen, setEditOpen] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

    const [pwdOpen, setPwdOpen] = useState(false);
    const [pwdUserId, setPwdUserId] = useState(null);
    const [newPwd, setNewPwd] = useState("");

    const [createOpen, setCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
        first_name: "", last_name: "", email: "", phone: "", id_card: "",
        role: "user", enabled: true, password: ""
    });

    const [createErrors, setCreateErrors] = useState({ id_card: "", phone: "" });
    const [editErrors, setEditErrors] = useState({ id_card: "", phone: "" });

    const [confirmToggle, setConfirmToggle] = useState({ open: false, user: null, next: null });
    const [busyId, setBusyId] = useState(null);

    // --------- Load ALL users (iterate pages) ----------
    const loadAll = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const first = await adminListUsers(token, { page: 1, pageSize: 100, q: "" });
            const meta = first?.data?.pagination || { totalPages: 1, page: 1 };
            const data = first?.data?.data || [];
            const totalPages = Math.max(1, Number(meta.totalPages || 1));
            const chunks = [data];

            for (let p = 2; p <= totalPages; p++) {
                // เรียกทุกหน้าจนครบ => เก็บไว้ allRows
                const res = await adminListUsers(token, { page: p, pageSize: 100, q: "" });
                chunks.push(res?.data?.data || []);
            }
            setAllRows(chunks.flat());
            setPage(1);
        } catch (e) {
            console.error(e);
            showToast(e?.response?.data?.message || "โหลดผู้ใช้ไม่สำเร็จ", "error", 3500);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [token]);

    // --------- Client-side search (debounce) ----------
    const [typed, setTyped] = useState("");
    useEffect(() => {
        const id = setTimeout(() => { setQ(typed); setPage(1); }, 220);
        return () => clearTimeout(id);
    }, [typed]);

    // fields to search: first_name, last_name, email, phone(10-digit), id_card(dashed & plain), role
    const filtered = useMemo(() => {
        const qq = norm(typed);
        const qqLoose = normLoose(typed);
        if (!qq) return allRows;

        const has = (t = "") => norm(t).includes(qq);
        const hasLoose = (t = "") => normLoose(t).includes(qqLoose);

        return allRows.filter((u) => {
            return (
                has(u.first_name) ||
                has(u.last_name) ||
                has(u.email) ||
                hasLoose(u.phone) ||
                hasLoose(u.id_card) ||
                has(u.role)
            );
        });
    }, [allRows, typed]);

    // client-side pagination
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

    // --------- Actions ---------
    const openEdit = (u) => { setEditUser({ ...u }); setEditOpen(true); };
    const validateEdit = () => {
        const idOkE = isValidThaiId(editUser.id_card);
        const phOkE = isValidPhone10(editUser.phone);
        setEditErrors({
            id_card: idOkE ? "" : "รูปแบบไม่ถูกต้อง (เช่น 1-2345-67890-12-3)",
            phone: phOkE ? "" : "ต้องเป็นตัวเลข 10 หลัก",
        });
        if (!idOkE || !phOkE) showToast("กรอกข้อมูลไม่ถูกต้อง กรุณาตรวจสอบ", "error");
        return idOkE && phOkE;
    };
    const saveEdit = async () => {
        try {
            await adminUpdateUser(token, editUser.id, {
                first_name: editUser.first_name,
                last_name: editUser.last_name,
                email: editUser.email,
                phone: editUser.phone,
                id_card: editUser.id_card,
                role: editUser.role,
                enabled: editUser.enabled,
            });
            setEditOpen(false); setEditUser(null);
            showToast("บันทึกข้อมูลผู้ใช้สำเร็จ");
            loadAll();
        } catch (e) {
            console.error(e);
            showToast(e?.response?.data?.message || "บันทึกไม่สำเร็จ", "error", 3500);
        }
    };
    const onAskConfirmSave = () => { if (validateEdit()) setConfirmSaveOpen(true); };

    const openPwd = (u) => { setPwdUserId(u.id); setNewPwd(""); setPwdOpen(true); };
    const savePwd = async () => {
        if (!newPwd || newPwd.length < 6) return showToast("รหัสผ่านต้องอย่างน้อย 6 ตัว", "error");
        try {
            await adminUpdateUserPassword(token, pwdUserId, newPwd);
            setPwdOpen(false); setNewPwd(""); setPwdUserId(null);
            showToast("อัปเดตรหัสผ่านสำเร็จ");
        } catch (e) {
            console.error(e);
            showToast(e?.response?.data?.message || "อัปเดตรหัสผ่านไม่สำเร็จ", "error", 3500);
        }
    };

    const onDelete = (u) => setConfirmToggle({ open: true, user: u, next: "delete" });
    const actuallyDelete = async () => {
        const u = confirmToggle.user;
        setBusyId(u.id);
        try {
            await adminDeleteUser(token, u.id);
            setConfirmToggle({ open: false, user: null, next: null });
            showToast(`ลบผู้ใช้ ${u.email} สำเร็จ`);
            loadAll();
        } catch (e) {
            console.error(e);
            showToast(e?.response?.data?.message || "ลบผู้ใช้ไม่สำเร็จ", "error", 3500);
        } finally {
            setBusyId(null);
        }
    };

    const requestToggleEnabled = (user, next) => {
        setConfirmToggle({ open: true, user, next });
    };
    const actuallyToggle = async () => {
        const { user, next } = confirmToggle;
        setBusyId(user.id);
        try {
            await adminUpdateUser(token, user.id, { enabled: next });
            setAllRows((prev) => prev.map((u) => (u.id === user.id ? { ...u, enabled: next } : u)));
            setConfirmToggle({ open: false, user: null, next: null });
            showToast(`${next ? "เปิดใช้งาน" : "ปิดใช้งาน"} ${user.email} สำเร็จ`);
        } catch (e) {
            console.error(e);
            showToast(e?.response?.data?.message || `สลับสถานะไม่สำเร็จ`, "error", 3500);
        } finally {
            setBusyId(null);
        }
    };

    const openCreate = () => {
        setCreateForm({
            first_name: "", last_name: "", email: "", phone: "", id_card: "",
            role: "user", enabled: true, password: ""
        });
        setCreateErrors({ id_card: "", phone: "" });
        setCreateOpen(true);
    };
    const saveCreate = async () => {
        if (!createForm.email || !createForm.password) {
            showToast("กรอก email / password", "error");
            return;
        }
        const idOkC = isValidThaiId(createForm.id_card);
        const phOkC = isValidPhone10(createForm.phone);
        setCreateErrors({
            id_card: idOkC ? "" : "รูปแบบไม่ถูกต้อง (เช่น 1-2345-67890-12-3)",
            phone: phOkC ? "" : "ต้องเป็นตัวเลข 10 หลัก",
        });
        if (!idOkC || !phOkC) {
            showToast("กรอกข้อมูลไม่ถูกต้อง กรุณาตรวจสอบ", "error");
            return;
        }

        try {
            await adminCreateUser(token, createForm);
            setCreateOpen(false);
            showToast("สร้างผู้ใช้สำเร็จ");
            loadAll();
        } catch (e) {
            console.error(e);
            showToast(e?.response?.data?.message || "สร้างผู้ใช้ไม่สำเร็จ", "error", 3500);
        }
    };

    /* ======================= Render ======================= */
    return (
        <div className="max-w-7xl mx-auto p-6 text-gray-800">
            {toastNode}

            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-700 to-violet-700 bg-clip-text text-transparent">
                    จัดการผู้ใช้
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <Search className="h-4 w-4 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            className="pl-9 pr-9 py-2 w-80 border rounded-lg border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            placeholder="พิมพ์เพื่อค้นหา (ชื่อ/อีเมล/เบอร์/เลขบัตร/บทบาท)"
                            value={typed}
                            onChange={(e) => setTyped(e.target.value)}
                        />
                        {typed && (
                            <button
                                type="button"
                                onClick={() => setTyped("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-700"
                                title="ล้างคำค้นหา"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <button
                        onClick={loadAll}
                        className="px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:opacity-95 shadow-sm"
                    >
                        <RotateCw className="h-4 w-4 inline mr-1" /> โหลดใหม่
                    </button>

                    <button
                        onClick={openCreate}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:opacity-95 shadow-sm"
                        title="เพิ่มผู้ใช้ใหม่"
                    >
                        <Plus className="h-4 w-4" /> เพิ่มผู้ใช้
                    </button>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex justify-center items-center py-12 text-indigo-600">
                    <Loader2 className="animate-spin h-6 w-6 mr-2" /> กำลังโหลด…
                </div>
            ) : pageRows.length === 0 ? (
                <div className="border rounded-xl p-8 text-center text-gray-500 bg-white">
                    ไม่พบผู้ใช้{typed ? ` ที่ตรงกับ "${typed}"` : ""}
                </div>
            ) : (
                <div className="overflow-x-auto bg-white border border-indigo-100 rounded-xl shadow-sm">
                    <table className="min-w-full text-sm">
                        <thead className="bg-indigo-50 text-indigo-900">
                            <tr>
                                <th className="px-4 py-3 text-left">ผู้ใช้</th>
                                <th className="px-4 py-3 text-left">ติดต่อ</th>
                                <th className="px-4 py-3 text-left">บทบาท</th>
                                <th className="px-4 py-3 text-center">สถานะ</th>
                                <th className="px-4 py-3 text-right">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageRows.map((u) => {
                                const toggling = busyId === u.id;
                                return (
                                    <tr key={u.id} className="border-t border-indigo-50">
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-gray-900">{u.first_name} {u.last_name}</div>
                                            <div className="text-xs text-gray-500">#{u.id}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm">{u.email}</div>
                                            <div className="text-xs text-gray-500">{u.phone}</div>
                                            {u.id_card && <div className="text-xs text-gray-500">ID: {u.id_card}</div>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2.5 py-1 rounded-full text-xs ring-1 ${u.role === 'admin'
                                                    ? 'bg-purple-50 text-purple-700 ring-purple-200'
                                                    : 'bg-sky-50 text-sky-700 ring-sky-200'
                                                }`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-3">
                                                <Toggle
                                                    checked={u.enabled}
                                                    disabled={toggling}
                                                    onChange={(next) => requestToggleEnabled(u, next)}
                                                    size="sm"
                                                    onLabel="เปิดใช้งาน"
                                                    offLabel="ปิดใช้งาน"
                                                />
                                                {u.enabled ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                                                        เปิดอยู่
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                                                        ปิดอยู่
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="inline-flex gap-2">
                                                <button
                                                    onClick={() => openEdit(u)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50"
                                                    title="แก้ไขข้อมูล"
                                                >
                                                    <Pencil className="h-4 w-4" /> แก้ไข
                                                </button>
                                                <button
                                                    onClick={() => openPwd(u)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-amber-700 ring-1 ring-amber-200 hover:bg-amber-50"
                                                    title="เปลี่ยนรหัสผ่าน"
                                                >
                                                    <KeyRound className="h-4 w-4" /> รหัสผ่าน
                                                </button>
                                                <button
                                                    onClick={() => onDelete(u)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50"
                                                    title="ลบผู้ใช้"
                                                >
                                                    <Trash2 className="h-4 w-4" /> ลบ
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination (client-side) */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 mt-4">
                    <div className="text-sm text-gray-600">
                        พบ {total.toLocaleString()} รายการ • หน้า {page} / {totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className="px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 text-indigo-700"
                            disabled={page <= 1}
                        >
                            ก่อนหน้า
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            className="px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 text-indigo-700"
                            disabled={page >= totalPages}
                        >
                            ถัดไป
                        </button>
                    </div>
                </div>
            )}

            {/* Modal: สร้างผู้ใช้ */}
            {createOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
                        <div className="p-5 border-b flex items-center justify-between">
                            <div className="text-lg font-semibold text-indigo-700">เพิ่มผู้ใช้</div>
                            <button onClick={() => setCreateOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
                        </div>

                        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <label className="block text-sm font-medium mb-1">ชื่อ</label>
                                <input
                                    value={createForm.first_name}
                                    onChange={(e) => setCreateForm(f => ({ ...f, first_name: e.target.value }))}
                                    className="w-full rounded-lg border border-indigo-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">นามสกุล</label>
                                <input
                                    value={createForm.last_name}
                                    onChange={(e) => setCreateForm(f => ({ ...f, last_name: e.target.value }))}
                                    className="w-full rounded-lg border border-indigo-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">อีเมล *</label>
                                <input
                                    value={createForm.email}
                                    onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))}
                                    className="w-full rounded-lg border border-indigo-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">เบอร์โทร *</label>
                                <input
                                    value={createForm.phone}
                                    onChange={(e) => setCreateForm(f => ({ ...f, phone: normalizePhone10(e.target.value) }))}
                                    onBlur={() =>
                                        setCreateErrors((er) => ({
                                            ...er,
                                            phone: createForm.phone && !isValidPhone10(createForm.phone)
                                                ? "ต้องเป็นตัวเลข 10 หลัก"
                                                : ""
                                        }))
                                    }
                                    inputMode="numeric"
                                    className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${createErrors.phone ? "border-rose-300 ring-1 ring-rose-200" : "border-indigo-200"
                                        }`}
                                    placeholder="0812345678"
                                />
                                {createErrors.phone && (
                                    <div className="mt-1 text-xs text-rose-600">{createErrors.phone}</div>
                                )}
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium mb-1">เลขบัตรประชาชน *</label>
                                <input
                                    value={createForm.id_card}
                                    onChange={(e) => setCreateForm(f => ({ ...f, id_card: formatThaiId(e.target.value) }))}
                                    onBlur={() =>
                                        setCreateErrors((er) => ({
                                            ...er,
                                            id_card: createForm.id_card && !isValidThaiId(createForm.id_card)
                                                ? "รูปแบบไม่ถูกต้อง (เช่น 1-2345-67890-12-3)"
                                                : ""
                                        }))
                                    }
                                    className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${createErrors.id_card ? "border-rose-300 ring-1 ring-rose-200" : "border-indigo-200"
                                        }`}
                                    placeholder="1-2345-67890-12-3"
                                />
                                {createErrors.id_card && (
                                    <div className="mt-1 text-xs text-rose-600">{createErrors.id_card}</div>
                                )}
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium mb-1">รหัสผ่าน *</label>
                                <input
                                    type="password"
                                    value={createForm.password}
                                    onChange={(e) => setCreateForm(f => ({ ...f, password: e.target.value }))}
                                    className="w-full rounded-lg border border-indigo-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                    placeholder="อย่างน้อย 6 ตัว"
                                />
                            </div>

                            <div className="md:col-span-2 flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="text-sm font-medium">บทบาท</div>
                                    <RoleSegment value={createForm.role} onChange={(v) => setCreateForm(f => ({ ...f, role: v }))} />
                                </div>
                                <div className="flex items-center">
                                    <Toggle
                                        checked={createForm.enabled}
                                        onChange={(v) => setCreateForm(f => ({ ...f, enabled: v }))}
                                        size="md"
                                        onLabel="เปิดใช้งาน"
                                        offLabel="ปิดใช้งาน"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t flex items-center justify-end gap-2">
                            <button
                                onClick={() => setCreateOpen(false)}
                                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                            >
                                ปิด
                            </button>
                            <button
                                onClick={saveCreate}
                                className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:opacity-95"
                            >
                                บันทึก
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: แก้ไขผู้ใช้ */}
            {editOpen && editUser && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
                        <div className="p-5 border-b flex items-center justify-between">
                            <div className="text-lg font-semibold text-indigo-700">แก้ไขผู้ใช้ #{editUser.id}</div>
                            <button onClick={() => { setEditOpen(false); setEditUser(null); }} className="text-gray-500 hover:text-gray-700">✕</button>
                        </div>

                        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <label className="block text-sm font-medium mb-1">ชื่อ</label>
                                <input
                                    value={editUser.first_name || ''}
                                    onChange={(e) => setEditUser(u => ({ ...u, first_name: e.target.value }))}
                                    className="w-full rounded-lg border border-indigo-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">นามสกุล</label>
                                <input
                                    value={editUser.last_name || ''}
                                    onChange={(e) => setEditUser(u => ({ ...u, last_name: e.target.value }))}
                                    className="w-full rounded-lg border border-indigo-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">อีเมล</label>
                                <input
                                    value={editUser.email || ''}
                                    onChange={(e) => setEditUser(u => ({ ...u, email: e.target.value }))}
                                    className="w-full rounded-lg border border-indigo-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">เบอร์โทร *</label>
                                <input
                                    value={editUser.phone || ""}
                                    onChange={(e) => setEditUser(u => ({ ...u, phone: normalizePhone10(e.target.value) }))}
                                    onBlur={() =>
                                        setEditErrors((er) => ({
                                            ...er,
                                            phone: editUser.phone && !isValidPhone10(editUser.phone)
                                                ? "ต้องเป็นตัวเลข 10 หลัก"
                                                : ""
                                        }))
                                    }
                                    inputMode="numeric"
                                    className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${editErrors.phone ? "border-rose-300 ring-1 ring-rose-200" : "border-indigo-200"
                                        }`}
                                    placeholder="0812345678"
                                />
                                {editErrors.phone && (
                                    <div className="mt-1 text-xs text-rose-600">{editErrors.phone}</div>
                                )}
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium mb-1">เลขบัตรประชาชน *</label>
                                <input
                                    value={editUser.id_card || ""}
                                    onChange={(e) => setEditUser(u => ({ ...u, id_card: formatThaiId(e.target.value) }))}
                                    onBlur={() =>
                                        setEditErrors((er) => ({
                                            ...er,
                                            id_card: editUser.id_card && !isValidThaiId(editUser.id_card)
                                                ? "รูปแบบไม่ถูกต้อง (เช่น 1-2345-67890-12-3)"
                                                : ""
                                        }))
                                    }
                                    className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${editErrors.id_card ? "border-rose-300 ring-1 ring-rose-200" : "border-indigo-200"
                                        }`}
                                    placeholder="1-2345-67890-12-3"
                                />
                                {editErrors.id_card && (
                                    <div className="mt-1 text-xs text-rose-600">{editErrors.id_card}</div>
                                )}
                            </div>

                            <div className="md:col-span-2 flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="text-sm font-medium">บทบาท</div>
                                    <RoleSegment value={editUser.role} onChange={(v) => setEditUser(u => ({ ...u, role: v }))} />
                                </div>
                                <div className="flex items-center">
                                    <Toggle
                                        checked={!!editUser.enabled}
                                        onChange={(v) => setEditUser(u => ({ ...u, enabled: v }))}
                                        size="md"
                                        onLabel="เปิดใช้งาน"
                                        offLabel="ปิดใช้งาน"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t flex items-center justify-end gap-2">
                            <button
                                onClick={() => { setEditOpen(false); setEditUser(null); }}
                                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                            >
                                ปิด
                            </button>
                            <button
                                onClick={onAskConfirmSave}
                                className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:opacity-95"
                            >
                                บันทึก
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: เปลี่ยนรหัสผ่าน */}
            {pwdOpen && (
                <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
                        <div className="p-5 border-b flex items-center justify-between">
                            <div className="text-lg font-semibold text-indigo-700">ตั้งรหัสผ่านใหม่</div>
                            <button onClick={() => setPwdOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
                        </div>
                        <div className="p-5 space-y-3">
                            <label className="block text-sm font-medium mb-1">รหัสผ่านใหม่</label>
                            <input
                                type="password"
                                value={newPwd}
                                onChange={(e) => setNewPwd(e.target.value)}
                                className="w-full rounded-lg border border-indigo-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                placeholder="อย่างน้อย 6 ตัว"
                            />
                        </div>
                        <div className="p-5 border-t flex items-center justify-end gap-2">
                            <button onClick={() => setPwdOpen(false)} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">ยกเลิก</button>
                            <button onClick={savePwd} className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-95">บันทึก</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm: toggle / delete / save */}
            <ConfirmModal
                open={confirmToggle.open && confirmToggle.next !== "delete"}
                title={confirmToggle.next ? "ยืนยันการเปิดใช้งาน" : "ยืนยันการปิดใช้งาน"}
                message={
                    confirmToggle.user
                        ? `${confirmToggle.next ? "เปิดใช้งาน" : "ปิดใช้งาน"} ผู้ใช้:\n${confirmToggle.user.email}`
                        : ""
                }
                confirmText="ยืนยัน"
                cancelText="ยกเลิก"
                onConfirm={actuallyToggle}
                onCancel={() => setConfirmToggle({ open: false, user: null, next: null })}
                tone="info"
            />

            <ConfirmModal
                open={confirmToggle.open && confirmToggle.next === "delete"}
                title="ยืนยันการลบผู้ใช้"
                message={
                    confirmToggle.user
                        ? `ต้องการลบผู้ใช้:\n${confirmToggle.user.email}\n(การลบอาจไม่สำเร็จหากมีข้อมูลเกี่ยวข้อง)`
                        : ""
                }
                confirmText="ลบผู้ใช้"
                cancelText="ยกเลิก"
                onConfirm={actuallyDelete}
                onCancel={() => setConfirmToggle({ open: false, user: null, next: null })}
                tone="danger"
            />

            <ConfirmModal
                open={confirmSaveOpen}
                title={`ยืนยันบันทึกข้อมูลผู้ใช้ #${editUser?.id ?? ""}`}
                message={`ต้องการบันทึกการเปลี่ยนแปลงของผู้ใช้:\n${editUser?.email || "-"}`}
                confirmText="บันทึก"
                cancelText="ยกเลิก"
                onConfirm={() => { setConfirmSaveOpen(false); saveEdit(); }}
                onCancel={() => setConfirmSaveOpen(false)}
                tone="info"
            />
        </div>
    );
};

export default AdminUsers;
