import React, { useEffect, useMemo, useState } from "react";
import { createSize, removeSize, updateSize } from "../../api/Size";
import useEcomStore from "../../store/ecom-store";
import { Ruler, Plus, Trash2, Search, AlertTriangle, PencilLine, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const FormSize = () => {
  const token = useEcomStore((s) => s.token);
  const sizes = useEcomStore((s) => s.sizes) || [];
  const getSize = useEcomStore((s) => s.getSize);

  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [confirmId, setConfirmId] = useState(null);

  // ✅ state สำหรับแก้ไข
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [topToast, setTopToast] = useState(null); // { message, type }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setIsLoading(true);
        await getSize(token);
      } catch (e) {
        if (mounted) setError("โหลด ขนาดสินค้า ไม่สำเร็จ");
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; if (showTopToast.timer) clearTimeout(showTopToast.timer); };
  }, [getSize, token]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sizes;
    return sizes.filter((s) => s.name?.toLowerCase().includes(q));
  }, [sizes, query]);

  // TOP toast
  const showTopToast = (message, type = "success", duration = 1500) => {
    setTopToast({ message, type });
    if (showTopToast.timer) clearTimeout(showTopToast.timer);
    showTopToast.timer = setTimeout(() => setTopToast(null), duration);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return showTopToast("ยังไม่ได้กรอกข้อมูล", "error");
    try {
      setIsLoading(true);
      const res = await createSize(token, { name: name.trim() });
      showTopToast(`เพิ่ม ขนาดสินค้า ${res?.data?.name ?? name} สำเร็จ`, "success");
      setName("");
      await getSize(token);
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || "ไม่สามารถเพิ่ม ขนาดสินค้า ได้";
      setError(msg);
      showTopToast(msg, "error", 1800);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (id) => {
    setError(null);
    try {
      setIsLoading(true);
      const res = await removeSize(token, id);
      showTopToast(`ลบ ${res?.data?.name ?? "ขนาดสินค้า"} สำเร็จ`, "success");
      await getSize(token);
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || "ลบไม่สำเร็จ";
      setError(msg);
      showTopToast(msg, "error", 1800);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ เริ่มแก้ไข
  const startEdit = (item) => {
    setEditId(item.id);
    setEditName(item.name || "");
  };

  // ✅ บันทึกการแก้ไข
  const handleUpdate = async () => {
    if (!editName.trim()) return showTopToast("ยังไม่ได้กรอกข้อมูล", "error");
    setError(null);
    try {
      setIsLoading(true);
      await updateSize(token, editId, { name: editName.trim() });
      showTopToast("บันทึกการแก้ไขสำเร็จ", "success");
      setEditId(null);
      setEditName("");
      await getSize(token);
    } catch (err) {
      console.error(err);
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || "บันทึกไม่สำเร็จ";
      setError(msg);
      // ถ้า server ส่ง 409 (unique) → แจ้งชื่อนี้ถูกใช้แล้ว
      showTopToast(status === 409 ? (msg || "ชื่อนี้ถูกใช้แล้ว") : msg, "error", 1800);
    } finally {
      setIsLoading(false);
    }
  };

  const countText = `${filtered.length} ขนาด`;

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Card */}
      <div className="bg-white/80 backdrop-blur shadow-xl rounded-2xl border border-gray-100">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-50 border border-violet-100">
              <Ruler className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">จัดการขนาดสินค้า</h1>
              <p className="text-sm text-gray-500">เพิ่ม / ค้นหา / ลบ / แก้ไข ขนาดสินค้า</p>
            </div>
          </div>
          <span className="text-sm px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">{countText}</span>
        </div>

        {/* Form */}
        <form className="px-6 pb-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="size-name">ชื่อขนาดสินค้า</label>
          <input
            id="size-name"
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm focus:outline-none focus:ring-4 focus:ring-violet-100 focus:border-violet-300 placeholder:text-gray-400"
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            placeholder="ชื่อ ขนาดสินค้า เช่น S, M, L, 2XL"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!name.trim() || isLoading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white shadow hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            aria-disabled={!name.trim() || isLoading}
          >
            <Plus className="w-4 h-4" />
            เพิ่มขนาดสินค้า
          </button>
        </form>

        {/* Toolbar */}
        <div className="px-6 pb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              className="w-full sm:w-72 pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-gray-100"
              placeholder="ค้นหา ขนาดสินค้า..."
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
                  <Ruler className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">ยังไม่มีข้อมูล ขนาดสินค้า</p>
                <p className="text-gray-400 text-sm">เพิ่ม ขนาดสินค้า ใหม่ หรือค้นหาด้วยคีย์เวิร์ดอื่น</p>
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
                        <Ruler className="w-4 h-4 text-gray-600" />
                      </div>
                      <span className="truncate text-gray-800">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* ✅ ปุ่มแก้ไข */}
                      <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-amber-700 border border-amber-200 bg-white hover:bg-amber-50 hover:border-amber-300 transition"
                        onClick={() => startEdit(item)}
                        aria-label={`แก้ไข ${item.name}`}
                      >
                        <PencilLine className="w-4 h-4" />
                        แก้ไข
                      </button>

                      <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-600 border border-red-200 bg-white hover:bg-red-50 hover:border-red-300 transition"
                        onClick={() => setConfirmId(item.id)}
                        aria-label={`ลบ ${item.name}`}
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

      {/* Confirm Dialog */}
      <AnimatePresence>
        {confirmId !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100"
            >
              <div className="p-6 flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-100">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">ยืนยันการลบ</h2>
                  <p className="text-gray-600 mt-1 text-sm">การลบ ขนาดสินค้า อาจมีผลต่อสินค้าที่ใช้ขนาดนี้ คุณแน่ใจหรือไม่?</p>
                </div>
              </div>
              <div className="px-6 pb-6 flex items-center justify-end gap-3">
                <button
                  className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition"
                  onClick={() => setConfirmId(null)}
                >
                  ยกเลิก
                </button>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition"
                  onClick={async () => { const id = confirmId; setConfirmId(null); await handleRemove(id); }}
                >
                  <Trash2 className="w-4 h-4" />
                  ลบเลย
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ✅ Edit Dialog */}
      <AnimatePresence>
        {editId !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100"
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditId(null);
                if (e.key === "Enter") handleUpdate();
              }}
            >
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900">แก้ไขขนาดสินค้า</h2>
                <p className="text-gray-500 text-sm mt-1">ปรับชื่อขนาดแล้วกดบันทึก</p>

                <label className="sr-only" htmlFor="edit-size-name">ชื่อขนาดสินค้า</label>
                <input
                  id="edit-size-name"
                  className="mt-4 w-full px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm focus:outline-none focus:ring-4 focus:ring-violet-100 focus:border-violet-300"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                />
                <p className="text-xs py-2 text-gray-600">
                  หลีกเลี่ยงชื่อซ้ำกับรายการอื่น (ระบบจะเตือนหากซ้ำ)
                </p>
              </div>
              <div className="px-6 pb-6 flex items-center justify-end gap-3">
                <button
                  className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition"
                  onClick={() => { setEditId(null); setEditName(""); }}
                >
                  ยกเลิก
                </button>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition disabled:opacity-60"
                  disabled={!editName.trim() || isLoading}
                  onClick={handleUpdate}
                >
                  <Save className="w-4 h-4" />
                  บันทึก
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Toast */}
      <AnimatePresence>
        {topToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-lg text-white text-sm font-medium bg-black/90"
          >
            {topToast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FormSize;
