// import React, { useEffect, useState } from 'react';
// import { createGeneration, removeGeneration } from '../../api/Generation';
// import useEcomStore from '../../store/ecom-store';
// import { toast } from 'react-toastify';

// const FormGeneration = () => {
//   const token = useEcomStore((s) => s.token);
//   const generations = useEcomStore((s) => s.generations);
//   const getGeneration = useEcomStore((s) => s.getGeneration);

//   const [name, setName] = useState('');

//   useEffect(() => {
//     getGeneration(token);
//   }, [getGeneration, token]);

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     if (!name.trim()) {
//       return toast.warning('ยังไม่ได้กรอกข้อมูล');
//     }
//     try {
//       const res = await createGeneration(token, { name: name.trim() });
//       toast.success(`เพิ่ม Generation ${res.data.name} สำเร็จ`);
//       setName('');
//       getGeneration(token);
//     } catch (err) {
//       console.log(err);
//       toast.error(err?.response?.data?.message || 'เกิดข้อผิดพลาด');
//     }
//   };

//   const handleRemove = async (id) => {
//     if (!window.confirm('ยืนยันการลบ Generation นี้?')) return;
//     try {
//       const res = await removeGeneration(token, id);
//       toast.success(`ลบ ${res.data.name} สำเร็จ`);
//       getGeneration(token);
//     } catch (err) {
//       console.log(err);
//       toast.error(err?.response?.data?.message || 'ลบไม่สำเร็จ');
//     }
//   };

//   return (
//     <div className="max-w-xl mx-auto p-6 bg-white shadow-lg rounded-lg">
//       <h1 className="text-2xl font-bold text-gray-800 mb-4">จัดการ รุ่นเสื้อ</h1>

//       <form className="flex gap-4 mb-6" onSubmit={handleSubmit}>
//         <input
//           className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
//           value={name}
//           onChange={(e) => setName(e.target.value)}
//           type="text"
//           placeholder="รุ่นเสื้อ เช่น KU82-KU84"
//         />
//         <button
//           type="submit"
//           className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition"
//         >
//           เพิ่ม รุ่นเสื้อ 
//         </button>
//       </form>

//       <hr className="mb-4" />

//       <ul className="space-y-3">
//         {generations.map((item) => (
//           <li
//             key={item.id}
//             className="flex justify-between items-center bg-gray-50 p-3 rounded-md shadow-sm hover:bg-gray-100 transition"
//           >
//             <span className="text-gray-800">{item.name}</span>
//             <button
//               className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition"
//               onClick={() => handleRemove(item.id)}
//             >   
//               ลบ
//             </button>
//           </li>
//         ))}
//         {generations.length === 0 && (
//           <li className="text-center text-gray-500 py-4">ยังไม่มีข้อมูล</li>
//         )}
//       </ul>
//     </div>
//   );
// };

// export default FormGeneration;
import React, { useEffect, useMemo, useState } from "react";
import { createGeneration, removeGeneration } from "../../api/Generation";
import useEcomStore from "../../store/ecom-store";
import { Layers, Plus, Trash2, Search, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const FormGeneration = () => {
  const token = useEcomStore((s) => s.token);
  const generations = useEcomStore((s) => s.generations) || [];
  const getGeneration = useEcomStore((s) => s.getGeneration);

  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [confirmId, setConfirmId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [topToast, setTopToast] = useState(null); // { message }

  // initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setIsLoading(true);
        await getGeneration(token);
      } catch (e) {
        if (mounted) setError("โหลดรุ่นเสื้อไม่สำเร็จ");
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
      if (showTopToast.timer) clearTimeout(showTopToast.timer);
    };
  }, [getGeneration, token]);

  // sort latest first by createdAt (fallback to id)
  const sortDesc = (a, b) => {
    const da = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const db = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (db !== da) return db - da;
    return (b?.id ?? 0) - (a?.id ?? 0);
  };

  const filtered = useMemo(() => {
    const base = [...generations].sort(sortDesc);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((g) => g.name?.toLowerCase().includes(q));
  }, [generations, query]);

  // tiny black TOP toast
  const showTopToast = (message, duration = 1500) => {
    setTopToast({ message });
    if (showTopToast.timer) clearTimeout(showTopToast.timer);
    showTopToast.timer = setTimeout(() => setTopToast(null), duration);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return showTopToast("ยังไม่ได้กรอกข้อมูล");

    try {
      setIsLoading(true);
      const res = await createGeneration(token, { name: name.trim() });
      showTopToast(`เพิ่มรุ่นเสื้อ ${res?.data?.name ?? name} สำเร็จ`);
      setName("");
      await getGeneration(token);
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || "ไม่สามารถเพิ่มรุ่นเสื้อได้";
      setError(msg);
      showTopToast(msg, 1800);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (id) => {
    setError(null);
    try {
      setIsLoading(true);
      const res = await removeGeneration(token, id);
      showTopToast(`ลบ ${res?.data?.name ?? "รุ่นเสื้อ"} สำเร็จ`);
      await getGeneration(token);
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || "ลบไม่สำเร็จ";
      setError(msg);
      showTopToast(msg, 1800);
    } finally {
      setIsLoading(false);
    }
  };

  const countText = `${filtered.length} รุ่น`;

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Card */}
      <div className="bg-white/80 backdrop-blur shadow-xl rounded-2xl border border-gray-100">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
              <Layers className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">จัดการรุ่นเสื้อ</h1>
              <p className="text-sm text-gray-500">เพิ่ม / ค้นหา / ลบ รุ่นเสื้อ</p>
            </div>
          </div>
          <span className="text-sm px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">{countText}</span>
        </div>

        {/* Form */}
        <form className="px-6 pb-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="generation-name">ชื่อรุ่น</label>
          <input
            id="generation-name"
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm focus:outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-300 placeholder:text-gray-400"
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            placeholder="รุ่นเสื้อ เช่น KU82-KU84"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!name.trim() || isLoading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 text-white shadow hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            aria-disabled={!name.trim() || isLoading}
          >
            <Plus className="w-4 h-4" />
            เพิ่ม รุ่นเสื้อ
          </button>
        </form>

        {/* Toolbar */}
        <div className="px-6 pb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              className="w-full sm:w-72 pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-gray-100"
              placeholder="ค้นหารุ่นเสื้อ..."
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
                  <Layers className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">ยังไม่มีข้อมูลรุ่นเสื้อ</p>
                <p className="text-gray-400 text-sm">เพิ่มรุ่นใหม่ หรือค้นหาด้วยคำอื่น</p>
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
                        <Layers className="w-4 h-4 text-gray-600" />
                      </div>
                      <span className="truncate text-gray-800">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
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
                  <p className="text-gray-600 mt-1 text-sm">การลบรุ่นเสื้ออาจมีผลต่อสินค้าที่เกี่ยวข้อง คุณแน่ใจหรือไม่?</p>
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

      {/* Top Toast – small black bar */}
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

export default FormGeneration;