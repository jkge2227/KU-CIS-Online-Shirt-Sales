import React, { useMemo, useState, useEffect, useRef } from "react";
import { createCategory, removeCategory, updateCategory } from "../../api/Category";
import useEcomStore from "../../store/ecom-store";
import { toast } from "react-toastify";
import { FolderTree, Plus, Trash2, Search, AlertTriangle, Edit2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const FormCategory = () => {
    const token = useEcomStore((state) => state.token);
    const categories = useEcomStore((state) => state.categories) || [];
    const getCategory = useEcomStore((state) => state.getCategory);

    const [name, setName] = useState("");
    const [query, setQuery] = useState("");
    const [confirmItem, setConfirmItem] = useState(null); // { id, name } for delete
    const [editItem, setEditItem] = useState(null);       // { id, name } for edit
    const [editName, setEditName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [bottomToast, setBottomToast] = useState(null);

    const editInputRef = useRef(null);
    const confirmBtnRef = useRef(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setIsLoading(true);
                await getCategory(token);
            } catch (e) {
                if (mounted) setError("โหลดประเภทสินค้าไม่สำเร็จ");
            } finally {
                if (mounted) setIsLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [getCategory, token]);

    const sortDesc = (a, b) => {
        const da = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (db !== da) return db - da;
        return (b?.id ?? 0) - (a?.id ?? 0);
    };

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const base = [...(categories || [])].sort(sortDesc);
        if (!q) return base;
        return base.filter((c) => c.name?.toLowerCase().includes(q));
    }, [categories, query]);

    const showBottomToast = (message, type = "success") => {
        setBottomToast({ message, type });
        if (showBottomToast.timer) clearTimeout(showBottomToast.timer);
        showBottomToast.timer = setTimeout(() => setBottomToast(null), 2500);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        if (!name.trim()) {
            return toast.warning("ยังไม่ได้กรอกข้อมูล", { autoClose: 1200 });
        }
        try {
            setIsLoading(true);
            const res = await createCategory(token, { name: name.trim() });
            showBottomToast(`เพิ่มประเภทสินค้า ${res?.data?.name ?? name} สำเร็จ`, "success");
            setName("");
            await getCategory(token);
        } catch (err) {
            console.error(err);
            const msg = err?.response?.data?.message || "ไม่สามารถเพิ่มประเภทสินค้าได้";
            setError(msg);
            showBottomToast(msg, "error");
        } finally {
            setIsLoading(false);
        }
    };

    const doRemove = async () => {
        if (!confirmItem) return;
        setError(null);
        try {
            setIsLoading(true);
            const res = await removeCategory(token, confirmItem.id);
            showBottomToast(`ลบ ${res?.data?.name ?? confirmItem.name ?? "ประเภทสินค้า"} สำเร็จ`, "success");
            setConfirmItem(null);
            await getCategory(token);
        } catch (err) {
            console.error(err);
            const msg = err?.response?.data?.message || "ลบไม่สำเร็จ";
            setError(msg);
            showBottomToast(msg, "error");
        } finally {
            setIsLoading(false);
        }
    };

    // ====== Edit logic ======
    const openEdit = (item) => {
        setEditItem({ id: item.id, name: item.name });
        setEditName(item.name ?? "");
    };

    // focus input + lock scroll
    useEffect(() => {
        if (!editItem) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const t = setTimeout(() => editInputRef.current?.focus(), 120);
        return () => {
            document.body.style.overflow = prev;
            clearTimeout(t);
        };
    }, [editItem]);

    // ESC/Enter in edit modal
    useEffect(() => {
        if (!editItem) return;
        const onKey = (e) => {
            if (e.key === "Escape") setEditItem(null);
            if (e.key === "Enter" && !isLoading) doEditSave();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [editItem, isLoading]);

    const doEditSave = async () => {
        if (!editItem) return;
        const newName = (editName ?? "").trim();
        if (!newName) {
            return toast.warning("กรุณากรอกชื่อประเภทสินค้า", { autoClose: 1200 });
        }
        if (newName === editItem.name) {
            setEditItem(null);
            return; // ไม่มีการเปลี่ยนแปลง
        }
        setError(null);
        try {
            setIsLoading(true);
            const res = await updateCategory(token, editItem.id, { name: newName });
            showBottomToast(`แก้ไขเป็น “${res?.data?.name ?? newName}” สำเร็จ`, "success");
            setEditItem(null);
            await getCategory(token);
        } catch (err) {
            console.error(err);
            const msg = err?.response?.data?.message || "แก้ไขไม่สำเร็จ";
            setError(msg);
            showBottomToast(msg, "error");
        } finally {
            setIsLoading(false);
        }
    };

    const countText = `${filtered.length} ประเภทสินค้า`;

    return (
        <div className="max-w-2xl mx-auto p-6">
            {/* Card */}
            <div className="bg-white/80 backdrop-blur shadow-xl rounded-2xl border border-gray-100">
                {/* Header */}
                <div className="px-6 pt-6 pb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100">
                            <FolderTree className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-gray-900">จัดการประเภทสินค้า</h1>
                            <p className="text-sm text-gray-500">เพิ่ม / ค้นหา / แก้ไข / ลบประเภทสินค้า</p>
                        </div>
                    </div>
                    <span className="text-sm px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">{countText}</span>
                </div>

                {/* Form */}
                <form className="px-6 pb-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
                    <label className="sr-only" htmlFor="category-name">ชื่อประเภทสินค้า</label>
                    <input
                        id="category-name"
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300 placeholder:text-gray-400"
                        onChange={(e) => setName(e.target.value)}
                        value={name}
                        type="text"
                        placeholder="ชื่อประเภทสินค้า"
                        autoComplete="off"
                    />
                    <button
                        type="submit"
                        disabled={!name.trim() || isLoading}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white shadow hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
                        aria-disabled={!name.trim() || isLoading}
                    >
                        <Plus className="w-4 h-4" />
                        เพิ่มประเภทสินค้า
                    </button>
                </form>

                {/* Toolbar */}
                <div className="px-6 pb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            className="w-full sm:w-72 pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-gray-100"
                            placeholder="ค้นหาประเภทสินค้า..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>
                    {error && (
                        <div className="flex items-center gap-2 text-red-600 text-sm">
                            <AlertTriangle className="w-4 h-4" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <hr className="border-gray-100" />

                {/* List */}
                <div className="px-2 py-3">
                    <AnimatePresence initial={false}>
                        {filtered.length === 0 ? (
                            <motion.div
                                key="empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="px-4 py-10 text-center"
                            >
                                <div className="mx-auto w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-3">
                                    <FolderTree className="w-6 h-6 text-gray-400" />
                                </div>
                                <p className="text-gray-600 font-medium">ยังไม่มีรายการที่ตรงกับการค้นหา</p>
                                <p className="text-gray-400 text-sm">ลองใช้คำค้นหาอื่น หรือเพิ่มประเภทสินค้าใหม่</p>
                            </motion.div>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {filtered.map((item) => (
                                    <motion.li
                                        layout
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        key={item.id}
                                        className="group flex items-center justify-between px-4 py-3 hover:bg-gray-50/60 rounded-xl"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                                <FolderTree className="w-4 h-4 text-gray-600" />
                                            </div>
                                            <span className="truncate text-gray-800">{item.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-amber-700 border border-amber-200 bg-white hover:bg-amber-50 hover:border-amber-300 transition"
                                                onClick={() => openEdit(item)}
                                                disabled={isLoading}
                                                aria-label={`แก้ไข ${item.name}`}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                                แก้ไข
                                            </button>
                                            <button
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-600 border border-red-200 bg-white hover:bg-red-50 hover:border-red-300 transition disabled:opacity-60"
                                                onClick={() => setConfirmItem({ id: item.id, name: item.name })}
                                                aria-label={`ลบ ${item.name}`}
                                                disabled={isLoading}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                ลบ
                                            </button>
                                        </div>
                                    </motion.li>
                                ))}
                            </ul>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Delete Confirm Dialog */}
            <AnimatePresence>
                {confirmItem && (
                    <motion.div
                        key="confirm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
                        role="dialog"
                        aria-modal="true"
                        onMouseDown={(e) => {
                            if (e.target === e.currentTarget && !isLoading) setConfirmItem(null);
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.96, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.98, opacity: 0 }}
                            className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100"
                        >
                            <div className="p-6">
                                <h2 className="text-lg font-semibold text-gray-900">ยืนยันการลบ</h2>
                                <p className="text-gray-600 mt-1 text-sm">
                                    ต้องการลบ <span className="font-medium text-gray-900">“{confirmItem?.name}”</span> ใช่หรือไม่?
                                </p>
                            </div>
                            <div className="px-6 pb-6 flex items-center justify-end gap-3">
                                <button
                                    className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition disabled:opacity-60"
                                    onClick={() => setConfirmItem(null)}
                                    disabled={isLoading}
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    ref={confirmBtnRef}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-60"
                                    onClick={doRemove}
                                    disabled={isLoading}
                                >
                                    <Trash2 className="w-4 h-4" />
                                    {isLoading ? "กำลังลบ..." : "ลบเลย"}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Dialog */}
            <AnimatePresence>
                {editItem && (
                    <motion.div
                        key="edit"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
                        role="dialog"
                        aria-modal="true"
                        onMouseDown={(e) => {
                            if (e.target === e.currentTarget && !isLoading) setEditItem(null);
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.96, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.98, opacity: 0 }}
                            className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100"
                        >
                            <div className="p-6 space-y-3">
                                <h2 className="text-lg font-semibold text-gray-900">แก้ไขประเภทสินค้า</h2>
                                <label className="text-sm text-gray-600">ชื่อประเภทสินค้า</label>
                                <input
                                    ref={editInputRef}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    placeholder="เช่น S M L XL "
                                />
                                <p className="text-xs text-gray-600">
                                    หลีกเลี่ยงชื่อซ้ำกับรายการอื่น (ระบบจะเตือนหากซ้ำ)
                                </p>
                            </div>
                            <div className="px-6 pb-6 flex items-center justify-end gap-3">
                                <button
                                    className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition disabled:opacity-60"
                                    onClick={() => setEditItem(null)}
                                    disabled={isLoading}
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-60"
                                    onClick={doEditSave}
                                    disabled={isLoading}
                                >
                                    <Edit2 className="w-4 h-4" />
                                    {isLoading ? "กำลังบันทึก..." : "บันทึก"}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bottom Toast */}
            <AnimatePresence>
                {bottomToast && (
                    <motion.div
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-white bg-black/90"
                        role="status"
                        aria-live="polite"
                    >
                        <span className="inline-block w-2 h-2 rounded-full bg-white/80" />
                        <span className="text-sm font-medium">{bottomToast.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default FormCategory;
