// client/src/pages/admin/FormProduct.jsx
import React, { useState, useEffect, useMemo } from 'react';
import useEcomStore from '../../store/ecom-store';
import { createProduct, deleteProduct } from '../../api/product';
import Uploadfile from './Uploadfile';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, Plus, Package, Search, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const initialState = {
  title: '',
  description: '',
  price: '',
  quantity: '',
  categoryId: '',
  images: [],
  samePriceAllSizes: true,
  variants: [], // {sizeId:'', generationId:'', quantity:0, sku:''}
};

// ---------- UI helpers ----------
function Pill({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition-all",
        active
          ? "bg-gray-900 text-white border-gray-900 shadow-sm"
          : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Chip({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl border px-3 py-1.5 text-sm transition-all",
        active
          ? "bg-gray-900 text-white border-gray-900 shadow-sm"
          : "bg-white text-gray-700 border-gray-300 hover:border-gray-400",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ---------- Variant row (แนวนอนยาว) ----------
function VariantRow({ v, sizes, generations, onChange, onRemove, index }) {
  return (
    <div className="flex flex-col gap-3 border-b border-gray-200 py-3 last:border-none">
      <div className="flex flex-wrap items-center gap-3">
        {/* Size */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Size:</span>
          {sizes.map((s) => (
            <Chip
              key={s.id}
              active={String(v.sizeId) === String(s.id)}
              onClick={() => onChange({ ...v, sizeId: s.id })}
            >
              {s.name}
            </Chip>
          ))}
        </div>

        {/* Generation */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-700">รุ่น:</span>
          {generations.map((g) => (
            <Chip
              key={g.id}
              active={String(v.generationId) === String(g.id)}
              onClick={() => onChange({ ...v, generationId: g.id })}
            >
              {g.name}
            </Chip>
          ))}
        </div>

        {/* จำนวน  / ลบ — ชิดขวา */}
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="number"
            min="0"
            value={v.quantity}
            onChange={(e) =>
              onChange({ ...v, quantity: Math.max(0, Number(e.target.value || 0)) })
            }
            className="w-20 rounded-md border border-gray-300 p-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            placeholder="จำนวน"
          />
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition"
            title={`ลบแถว #${index + 1}`}
          >
            ลบ
          </button>
        </div>
      </div>
    </div>
  );
}

const FormProduct = () => {
  const token = useEcomStore((s) => s.token);
  const getCategory = useEcomStore((s) => s.getCategory);
  const categories = useEcomStore((s) => s.categories);
  const getProduct = useEcomStore((s) => s.getProduct);
  const products = useEcomStore((s) => s.products);
  const getSize = useEcomStore((s) => s.getSize);
  const sizes = useEcomStore((s) => s.sizes);
  const getGeneration = useEcomStore((s) => s.getGeneration);
  const generations = useEcomStore((s) => s.generations);

  const [form, setForm] = useState(initialState);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [topToast, setTopToast] = useState(null); // { message, type }

  useEffect(() => {
    getCategory();
    getProduct(100);
    getSize();
    getGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showTopToast = (message, type = 'success', duration = 1500) => {
    setTopToast({ message, type });
    if (showTopToast.timer) clearTimeout(showTopToast.timer);
    showTopToast.timer = setTimeout(() => setTopToast(null), duration);
  };

  const handleOnChange = (e) => {
    const { name, value } = e.target;
    if (name === 'price' || name === 'quantity') {
      const num = Number(value);
      setForm((f) => ({ ...f, [name]: Number.isFinite(num) ? Math.max(0, num) : '' }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  const addVariant = () => {
    setForm((f) => ({
      ...f,
      variants: [...f.variants, { sizeId: '', generationId: '', quantity: 0, sku: '' }],
    }));
  };

  const updateVariant = (idx, newV) => {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, i) => (i === idx ? newV : v)),
    }));
  };

  const removeVariant = (idx) => {
    setForm((f) => ({
      ...f,
      variants: f.variants.filter((_, i) => i !== idx),
    }));
  };

  const totalVariantQty = useMemo(
    () => form.variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0),
    [form.variants]
  );

  const validate = () => {
    const errors = [];
    if (!form.title.trim()) errors.push('กรอกชื่อสินค้า');
    if (!form.description.trim()) errors.push('กรอกรายละเอียด');
    if (!form.price || Number(form.price) <= 0) errors.push('ราคาต้องมากกว่า 0');
    if (!form.categoryId) errors.push('เลือกหมวดหมู่');
    if (form.variants.length === 0) errors.push('เพิ่มอย่างน้อย 1 size');

    const keySet = new Set();
    form.variants.forEach((v, i) => {
      if (!v.sizeId) errors.push(`เลือกระบุ size แถวที่ ${i + 1}`);
      if (v.quantity == null || Number(v.quantity) < 0)
        errors.push(`จำนวนต้อง ≥ 0 ที่แถวที่ ${i + 1}`);
      const genKey = v.generationId === '' || v.generationId == null ? 'null' : String(v.generationId);
      const key = `${String(v.sizeId)}::${genKey}`;
      if (keySet.has(key)) errors.push(`ซ้ำ: size/รุ่น แถวที่ ${i + 1}`);
      keySet.add(key);
    });
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const errs = validate();
    if (errs.length) {
      showTopToast(errs[0], 'error', 1800); // โชว์ข้อแรกพอให้เห็นชัด
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        images: form.images,
        variants: form.variants.map((v) => ({
          sizeId: Number(v.sizeId),
          generationId: v.generationId === '' || v.generationId == null ? null : Number(v.generationId),
          quantity: Number(v.quantity || 0),
          sku: v.sku || null,
        })),
      };

      const res = await createProduct(token, payload);
      setForm(initialState);
      setUploaderKey((k) => k + 1);
      await getProduct(100);
      showTopToast(`เพิ่มข้อมูล ${res?.data?.title ?? payload.title} สำเร็จ`, 'success');
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || 'บันทึกไม่สำเร็จ';
      setError(msg);
      showTopToast(msg, 'error', 1800);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => setConfirmId(id);

  const confirmDelete = async () => {
    const id = confirmId;
    setConfirmId(null);
    if (!id) return;
    try {
      await deleteProduct(token, id);
      await getProduct(100);
      showTopToast('ลบสินค้าสำเร็จ', 'success');
    } catch (err) {
      console.error(err);
      showTopToast('ไม่สามารถลบสินค้าได้', 'error', 1800);
    }
  };

  // Sort latest + search
  const sortDesc = (a, b) => {
    const da = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const db = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (db !== da) return db - da;
    return (b?.id ?? 0) - (a?.id ?? 0);
  };

  const displayedProducts = useMemo(() => {
    const base = [...(products || [])].sort(sortDesc);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((p) =>
      [p.title, p.description, p.category?.name].filter(Boolean).some((txt) => String(txt).toLowerCase().includes(q))
    );
  }, [products, query]);

  const nfmt = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header Card */}
      <div className="bg-white/80 backdrop-blur shadow-xl rounded-2xl border border-gray-100 mb-6">
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100">
              <Package className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">เพิ่มข้อมูลสินค้า</h2>
              <p className="text-sm text-gray-500">กำหนดรายละเอียด รูปภาพ และตัวเลือกสินค้า</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-700 font-medium mb-1">ชื่อสินค้า</label>
              <input
                className="w-full border border-gray-200 rounded-xl p-2.5 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-100"
                name="title"
                placeholder="ชื่อสินค้า"
                value={form.title}
                onChange={handleOnChange}
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-1">รายละเอียด</label>
              <input
                className="w-full border border-gray-200 rounded-xl p-2.5 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-100"
                name="description"
                placeholder="รายละเอียด"
                value={form.description}
                onChange={handleOnChange}
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-1">ราคา</label>
              <input
                type="number"
                className="w-full border border-gray-200 rounded-xl p-2.5 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-100"
                name="price"
                placeholder="ราคา"
                value={form.price}
                onChange={handleOnChange}
                required
              />
              <p className="text-xs text-gray-500 mt-1">* ราคาเดียวทุก size</p>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-1">จำนวนรวม</label>
              <input
                type="number"
                className="w-full border border-gray-200 rounded-xl p-2.5 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-100"
                name="quantity"
                placeholder="จำนวนรวม"
                value={form.quantity}
                onChange={handleOnChange}
              />
              <p className="text-xs text-gray-500 mt-1">
                สต็อกรวม ตอนนี้: <b>{totalVariantQty}</b>
              </p>
            </div>
          </div>

          {/* หมวดหมู่แบบชิป */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">หมวดหมู่</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Pill
                  key={c.id}
                  active={String(form.categoryId) === String(c.id)}
                  onClick={() => setForm((f) => ({ ...f, categoryId: c.id }))}
                >
                  {c.name}
                </Pill>
              ))}
            </div>
          </div>

          {/* Upload */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">อัปโหลดรูปภาพ</label>
            <Uploadfile key={uploaderKey} form={form} setForm={setForm} />
          </div>

          {/* Variants */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-gray-700 font-medium">ตัวเลือกสินค้า </label>
              <button
                type="button"
                onClick={addVariant}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border hover:bg-gray-50"
              >
                <Plus size={16} /> เพิ่มแถว
              </button>
            </div>

            {/* แถวแนวนอนยาว */}
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              {form.variants.length ? (
                form.variants.map((v, idx) => (
                  <VariantRow
                    key={idx}
                    index={idx}
                    v={v}
                    sizes={sizes}
                    generations={generations}
                    onChange={(nv) => updateVariant(idx, nv)}
                    onRemove={() => removeVariant(idx)}
                  />
                ))
              ) : (
                <div className="text-sm text-gray-500 px-2 py-1.5">
                  ยังไม่มีตัวเลือก size — กด “เพิ่มแถว” เพื่อเริ่ม
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="bg-gray-900 text-white px-5 py-2.5 rounded-xl hover:bg-black transition-all shadow-md disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? 'กำลังบันทึก...' : 'เพิ่มสินค้า'}
            </button>
            {error && (
              <div className="mt-2 inline-flex items-center gap-2 text-red-600 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* รายการสินค้า */}
      <div className="bg-white/80 backdrop-blur shadow-xl rounded-2xl border border-gray-100">
        <div className="px-6 pt-6 pb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900">รายการสินค้า</h3>
          <span className="text-sm px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
            {displayedProducts.length} รายการ
          </span>
          <div className="relative ml-auto">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              className="w-64 pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-gray-100"
              placeholder="ค้นหาสินค้า..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto rounded-b-2xl border-t border-gray-100">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-600 font-medium">
                <th className="px-4 py-3">NO.</th>
                <th className="px-4 py-3">รูปภาพ</th>
                <th className="px-4 py-3">ชื่อสินค้า</th>
                <th className="px-4 py-3">รายละเอียด</th>
                <th className="px-4 py-3">ราคา</th>
                <th className="px-4 py-3">จำนวนรวม</th>
                <th className="px-4 py-3">ขายได้</th>
                <th className="px-4 py-3">อัปเดต</th>
                <th className="px-4 py-3 text-center">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayedProducts.map((item, index) => {
                const qtySum = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) ?? item.quantity;
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{index + 1}</td>
                    <td className="px-4 py-3">
                      {item.images?.length > 0 ? (
                        <img src={item.images[0].url} alt="" className="w-16 h-16 object-cover rounded-md shadow" />
                      ) : (
                        <div className="w-16 h-16 bg-gray-300 flex items-center justify-center text-white rounded-md">
                          ไม่มีรูป
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{item.title}</td>
                    <td className="px-4 py-3 max-w-[24ch] truncate" title={item.description}>{item.description}</td>
                    <td className="px-4 py-3">{nfmt.format(item.price)}</td>
                    <td className="px-4 py-3">{qtySum}</td>
                    <td className="px-4 py-3">{item.sold}</td>
                    <td className="px-4 py-3">
                      {new Date(item.updatedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-3">
                        <Link
                          to={`/admin/product/${item.id}`}
                          className="flex items-center gap-1 bg-amber-400 hover:bg-amber-500 text-white px-3 py-1.5 rounded-md text-sm shadow transition-all duration-200"
                        >
                          <Pencil size={16} />
                          <span>แก้ไข</span>
                        </Link>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-md text-sm shadow transition-all duration-200"
                        >
                          <Trash2 size={16} />
                          <span>ลบ</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {displayedProducts.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">ยังไม่มีสินค้า</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Delete Modal */}
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
                  <h2 className="text-lg font-semibold text-gray-900">ยืนยันการลบสินค้า</h2>
                  <p className="text-gray-600 mt-1 text-sm">การลบสินค้าไม่สามารถย้อนกลับได้ คุณแน่ใจหรือไม่?</p>
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
                  onClick={confirmDelete}
                >
                  <Trash2 className="w-4 h-4" />
                  ลบเลย
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
            className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-lg text-white text-sm font-medium ${topToast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
              }`}
          >
            {topToast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FormProduct;


















// // // client/src/pages/admin/FormProduct.jsx
// // import React, { useState, useEffect, useMemo } from 'react';
// // import useEcomStore from '../../store/ecom-store';
// // import { createProduct, deleteProduct } from '../../api/product';
// // import { toast } from 'react-toastify';
// // import Uploadfile from './Uploadfile';
// // import { Link } from 'react-router-dom';
// // import Swal from 'sweetalert2';
// // import { Pencil, Trash2, Plus, X } from 'lucide-react';

// // const initialState = {
// //   title: '',
// //   description: '',
// //   price: '',
// //   quantity: '',        // ถ้าใช้สต็อคตาม variants ให้ปล่อย 0 ได้
// //   categoryId: '',
// //   images: [],
// //   samePriceAllSizes: true, // ราคาเดียวทุก size
// //   variants: [],            // [{sizeId:1, generationId:null, quantity:10, sku:''}]
// // };

// // function VariantRow({ v, sizes, generations, onChange, onRemove }) {
// //   return (
// //     <div className="grid grid-cols-12 gap-2 items-center">
// //       {/* Size (required) */}
// //       <select
// //         className="col-span-3 border rounded-md p-2"
// //         value={v.sizeId ?? ''}
// //         onChange={(e) => onChange({ ...v, sizeId: e.target.value ? Number(e.target.value) : '' })}
// //       >
// //         <option value="">เลือก Size</option>
// //         {sizes.map((s) => (
// //           <option key={s.id} value={s.id}>{s.name}</option>
// //         ))}
// //       </select>

// //       {/* Generation (optional) */}
// //       <select
// //         className="col-span-3 border rounded-md p-2"
// //         value={v.generationId ?? ''}
// //         onChange={(e) =>
// //           onChange({
// //             ...v,
// //             generationId: e.target.value === '' ? '' : Number(e.target.value),
// //           })
// //         }
// //       >
// //         <option value="">เลือกรุ่น (optional)</option>
// //         {generations.map((g) => (
// //           <option key={g.id} value={g.id}>{g.name}</option>
// //         ))}
// //       </select>

// //       {/* Quantity */}
// //       <input
// //         type="number"
// //         min="0"
// //         className="col-span-3 border rounded-md p-2"
// //         placeholder="จำนวน"
// //         value={v.quantity}
// //         onChange={(e) => onChange({ ...v, quantity: Number(e.target.value || 0) })}
// //       />

// //       {/* SKU */}
// //       <input
// //         className="col-span-2 border rounded-md p-2"
// //         placeholder="SKU (ไม่บังคับ)"
// //         value={v.sku ?? ''}
// //         onChange={(e) => onChange({ ...v, sku: e.target.value })}
// //       />

// //       <button
// //         type="button"
// //         onClick={onRemove}
// //         className="col-span-1 inline-flex items-center justify-center rounded-md border text-red-600 hover:bg-red-50"
// //         title="ลบแถว"
// //       >
// //         <X size={18} />
// //       </button>
// //     </div>
// //   );
// // }

// // const FormProduct = () => {
// //   const token = useEcomStore((s) => s.token);

// //   const getCategory = useEcomStore((s) => s.getCategory);
// //   const categories = useEcomStore((s) => s.categories);

// //   const getProduct = useEcomStore((s) => s.getProduct);
// //   const products = useEcomStore((s) => s.products);

// //   const getSize = useEcomStore((s) => s.getSize);
// //   const sizes = useEcomStore((s) => s.sizes);

// //   const getGeneration = useEcomStore((s) => s.getGeneration);
// //   const generations = useEcomStore((s) => s.generations);

// //   const [form, setForm] = useState(initialState);
// //   const [uploaderKey, setUploaderKey] = useState(0);
// //   const [submitting, setSubmitting] = useState(false);

// //   useEffect(() => {
// //     getCategory();
// //     getProduct(100);
// //     getSize();
// //     getGeneration();
// //     // eslint-disable-next-line react-hooks/exhaustive-deps
// //   }, []);

// //   const handleOnChange = (e) => {
// //     setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
// //   };

// //   const addVariant = () => {
// //     setForm((f) => ({
// //       ...f,
// //       variants: [...f.variants, { sizeId: '', generationId: '', quantity: 0, sku: '' }],
// //     }));
// //   };

// //   const updateVariant = (idx, newV) => {
// //     setForm((f) => ({
// //       ...f,
// //       variants: f.variants.map((v, i) => (i === idx ? newV : v)),
// //     }));
// //   };

// //   const removeVariant = (idx) => {
// //     setForm((f) => ({
// //       ...f,
// //       variants: f.variants.filter((_, i) => i !== idx),
// //     }));
// //   };

// //   const totalVariantQty = useMemo(
// //     () => form.variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0),
// //     [form.variants]
// //   );

// //   const validate = () => {
// //     const errors = [];
// //     if (!form.title.trim()) errors.push('กรอกชื่อสินค้า');
// //     if (!form.description.trim()) errors.push('กรอกรายละเอียด');
// //     if (!form.price || Number(form.price) <= 0) errors.push('ราคาต้องมากกว่า 0');
// //     if (!form.categoryId) errors.push('เลือกหมวดหมู่');
// //     if (form.variants.length === 0) errors.push('เพิ่มอย่างน้อย 1 size');

// //     const keySet = new Set();
// //     form.variants.forEach((v, i) => {
// //       if (!v.sizeId) errors.push(`เลือกระบุ size แถวที่ ${i + 1}`);
// //       if (v.quantity == null || Number(v.quantity) < 0)
// //         errors.push(`จำนวนต้อง ≥ 0 ที่แถวที่ ${i + 1}`);
// //       const genKey = v.generationId === '' || v.generationId == null ? 'null' : String(v.generationId);
// //       const key = `${String(v.sizeId)}::${genKey}`;
// //       if (keySet.has(key)) errors.push(`ซ้ำ: size/generation แถวที่ ${i + 1}`);
// //       keySet.add(key);
// //     });
// //     return errors;
// //   };

// //   const handleSubmit = async (e) => {
// //     e.preventDefault();
// //     const errs = validate();
// //     if (errs.length) {
// //       errs.forEach((m) => toast.warning(m));
// //       return;
// //     }
// //     setSubmitting(true);
// //     try {
// //       // payload ตาม backend (ราคาเดียวทุก size) + ใช้ master ids
// //       const payload = {
// //         title: form.title.trim(),
// //         description: form.description.trim(),
// //         price: Number(form.price),
// //         categoryId: form.categoryId ? Number(form.categoryId) : null,
// //         images: form.images, // Uploadfile ใส่ให้แล้ว
// //         variants: form.variants.map((v) => ({
// //           sizeId: Number(v.sizeId),
// //           generationId:
// //             v.generationId === '' || v.generationId == null
// //               ? null
// //               : Number(v.generationId),
// //           quantity: Number(v.quantity || 0),
// //           sku: v.sku || null,
// //         })),
// //       };

// //       const res = await createProduct(token, payload);
// //       setForm(initialState);
// //       setUploaderKey((k) => k + 1);
// //       getProduct(100);
// //       toast.success(`เพิ่มข้อมูล ${res.data.title} สำเร็จ`);
// //     } catch (err) {
// //       console.error(err);
// //       toast.error(err?.response?.data?.message || 'บันทึกไม่สำเร็จ');
// //     } finally {
// //       setSubmitting(false);
// //     }
// //   };

// //   const handleDelete = async (id) => {
// //     const result = await Swal.fire({
// //       title: 'คุณแน่ใจหรือไม่?',
// //       text: 'คุณต้องการลบสินค้านี้ใช่หรือไม่?',
// //       icon: 'warning',
// //       showCancelButton: true,
// //       confirmButtonColor: '#d33',
// //       cancelButtonColor: '#3085d6',
// //       confirmButtonText: 'ใช่, ลบเลย!',
// //       cancelButtonText: 'ยกเลิก',
// //     });

// //     if (result.isConfirmed) {
// //       try {
// //         await deleteProduct(token, id);
// //         Swal.fire({
// //           title: 'ลบสำเร็จ',
// //           text: 'สินค้าถูกลบเรียบร้อยแล้ว',
// //           icon: 'success',
// //           confirmButtonText: 'ตกลง',
// //         });
// //         getProduct(100);
// //       } catch (err) {
// //         Swal.fire({
// //           title: 'เกิดข้อผิดพลาด',
// //           text: 'ไม่สามารถลบสินค้าได้',
// //           icon: 'error',
// //           confirmButtonText: 'ตกลง',
// //         });
// //       }
// //     }
// //   };

// //   return (
// //     <div className="max-w-6xl mx-auto p-6 bg-white rounded-xl shadow-lg">
// //       <form onSubmit={handleSubmit} className="space-y-6">
// //         <h2 className="text-2xl font-bold text-gray-800">เพิ่มข้อมูลสินค้า</h2>

// //         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
// //           <div>
// //             <label className="block text-gray-700 font-medium mb-1">ชื่อสินค้า</label>
// //             <input
// //               className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
// //               name="title"
// //               placeholder="ชื่อสินค้า"
// //               value={form.title}
// //               onChange={handleOnChange}
// //               required
// //             />
// //           </div>

// //           <div>
// //             <label className="block text-gray-700 font-medium mb-1">รายละเอียด</label>
// //             <input
// //               className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
// //               name="description"
// //               placeholder="รายละเอียด"
// //               value={form.description}
// //               onChange={handleOnChange}
// //               required
// //             />
// //           </div>

// //           <div>
// //             <label className="block text-gray-700 font-medium mb-1">ราคา</label>
// //             <input
// //               type="number"
// //               className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
// //               name="price"
// //               placeholder="ราคา"
// //               value={form.price}
// //               onChange={handleOnChange}
// //               required
// //             />
// //             <p className="text-xs text-gray-500 mt-1">* ราคาเดียวทุก size</p>
// //           </div>

// //           <div>
// //             <label className="block text-gray-700 font-medium mb-1">จำนวนรวม (ออปชัน)</label>
// //             <input
// //               type="number"
// //               className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
// //               name="quantity"
// //               placeholder="จำนวนรวม (ถ้าคุมตาม variants อาจปล่อย 0)"
// //               value={form.quantity}
// //               onChange={handleOnChange}
// //             />
// //             <p className="text-xs text-gray-500 mt-1">
// //               สต็อกรวมจาก variants ตอนนี้: <b>{totalVariantQty}</b>
// //             </p>
// //           </div>

// //           <div className="md:col-span-2">
// //             <label className="block text-gray-700 font-medium mb-1">หมวดหมู่</label>
// //             <select
// //               className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
// //               name="categoryId"
// //               onChange={handleOnChange}
// //               value={form.categoryId}
// //               required
// //             >
// //               <option value="" disabled>เลือกหมวดหมู่</option>
// //               {categories.map((item) => (
// //                 <option key={item.id} value={item.id}>{item.name}</option>
// //               ))}
// //             </select>
// //           </div>
// //         </div>

// //         {/* Upload */}
// //         <div>
// //           <label className="block text-gray-700 font-medium mb-2">อัปโหลดรูปภาพ</label>
// //           <Uploadfile key={uploaderKey} form={form} setForm={setForm} />
// //         </div>

// //         {/* Variants */}
// //         <div className="mt-2">
// //           <div className="flex items-center justify-between mb-2">
// //             <label className="block text-gray-700 font-medium">ตัวเลือกสินค้า (Variants)</label>
// //             <button
// //               type="button"
// //               onClick={addVariant}
// //               className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border hover:bg-gray-50"
// //             >
// //               <Plus size={16} /> เพิ่มแถว
// //             </button>
// //           </div>

// //           <div className="space-y-2">
// //             {form.variants.map((v, idx) => (
// //               <VariantRow
// //                 key={idx}
// //                 v={v}
// //                 sizes={sizes}
// //                 generations={generations}
// //                 onChange={(nv) => updateVariant(idx, nv)}
// //                 onRemove={() => removeVariant(idx)}
// //               />
// //             ))}
// //             {form.variants.length === 0 && (
// //               <div className="text-sm text-gray-500">ยังไม่มีตัวเลือก size — กด “เพิ่มแถว” เพื่อเริ่ม</div>
// //             )}
// //           </div>
// //         </div>

// //         <div className="pt-4">
// //           <button
// //             type="submit"
// //             className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 transition-all shadow-md disabled:opacity-60"
// //             disabled={submitting}
// //           >
// //             {submitting ? 'กำลังบันทึก...' : 'เพิ่มสินค้า'}
// //           </button>
// //         </div>
// //       </form>

// //       {/* รายการสินค้า */}
// //       <div className="mt-10">
// //         <h3 className="text-xl font-semibold text-gray-800 mb-4">รายการสินค้า</h3>
// //         <div className="overflow-x-auto rounded-lg shadow-sm border border-gray-200">
// //           <table className="min-w-full divide-y divide-gray-200 text-sm">
// //             <thead className="bg-gray-50">
// //               <tr className="text-left text-gray-600 font-medium">
// //                 <th className="px-4 py-3">NO.</th>
// //                 <th className="px-4 py-3">รูปภาพ</th>
// //                 <th className="px-4 py-3">ชื่อสินค้า</th>
// //                 <th className="px-4 py-3">รายละเอียด</th>
// //                 <th className="px-4 py-3">ราคา</th>
// //                 <th className="px-4 py-3">จำนวนรวม</th>
// //                 <th className="px-4 py-3">ขายได้</th>
// //                 <th className="px-4 py-3">อัปเดต</th>
// //                 <th className="px-4 py-3 text-center">การจัดการ</th>
// //               </tr>
// //             </thead>
// //             <tbody className="divide-y divide-gray-100">
// //               {products.map((item, index) => {
// //                 const qtySum =
// //                   item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) ??
// //                   item.quantity;

// //                 return (
// //                   <tr key={item.id} className="hover:bg-gray-50">
// //                     <td className="px-4 py-3">{index + 1}</td>
// //                     <td className="px-4 py-3">
// //                       {item.images?.length > 0 ? (
// //                         <img
// //                           src={item.images[0].url}
// //                           alt=""
// //                           className="w-16 h-16 object-cover rounded-md shadow"
// //                         />
// //                       ) : (
// //                         <div className="w-16 h-16 bg-gray-300 flex items-center justify-center text-white rounded-md">
// //                           ไม่มีรูป
// //                         </div>
// //                       )}
// //                     </td>
// //                     <td className="px-4 py-3">{item.title}</td>
// //                     <td className="px-4 py-3">{item.description}</td>
// //                     <td className="px-4 py-3">{item.price}</td>
// //                     <td className="px-4 py-3">{qtySum}</td>
// //                     <td className="px-4 py-3">{item.sold}</td>
// //                     <td className="px-4 py-3">
// //                       {new Date(item.updatedAt).toLocaleString('th-TH', {
// //                         dateStyle: 'medium',
// //                         timeStyle: 'short',
// //                       })}
// //                     </td>
// //                     <td className="px-4 py-3">
// //                       <div className="flex items-center justify-center gap-3">
// //                         <Link
// //                           to={`/admin/product/${item.id}`}
// //                           className="flex items-center gap-1 bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-1.5 rounded-md text-sm shadow transition-all duration-200"
// //                         >
// //                           <Pencil size={16} />
// //                           <span>แก้ไข</span>
// //                         </Link>

// //                         <button
// //                           onClick={() => handleDelete(item.id)}
// //                           className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-md text-sm shadow transition-all duration-200"
// //                         >
// //                           <Trash2 size={16} />
// //                           <span>ลบ</span>
// //                         </button>
// //                       </div>
// //                     </td>
// //                   </tr>
// //                 );
// //               })}
// //               {products.length === 0 && (
// //                 <tr>
// //                   <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
// //                     ยังไม่มีสินค้า
// //                   </td>
// //                 </tr>
// //               )}
// //             </tbody>
// //           </table>
// //         </div>
// //       </div>
// //     </div>
// //   );
// // };

// // export default FormProduct;
// // client/src/pages/admin/FormProduct.jsx – Polished UI/UX, no react-toastify
// import React, { useState, useEffect, useMemo } from 'react';
// import useEcomStore from '../../store/ecom-store';
// import { createProduct, deleteProduct } from '../../api/product';
// import Uploadfile from './Uploadfile';
// import { Link } from 'react-router-dom';
// import { Pencil, Trash2, Plus, X, Package, Search, AlertTriangle } from 'lucide-react';
// import { motion, AnimatePresence } from 'framer-motion';

// const initialState = {
//   title: '',
//   description: '',
//   price: '',
//   quantity: '',
//   categoryId: '',
//   images: [],
//   samePriceAllSizes: true,
//   variants: [], // {sizeId:'', generationId:'', quantity:0, sku:''}
// };

// function VariantRow({ v, sizes, generations, onChange, onRemove }) {
//   return (
//     <div className="grid grid-cols-12 gap-2 items-center">
//       {/* Size (required) */}
//       <select
//         className="col-span-3 border rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-indigo-100"
//         value={v.sizeId ?? ''}
//         onChange={(e) => onChange({ ...v, sizeId: e.target.value ? Number(e.target.value) : '' })}
//       >
//         <option value="">เลือก Size</option>
//         {sizes.map((s) => (
//           <option key={s.id} value={s.id}>{s.name}</option>
//         ))}
//       </select>

//       {/* Generation (optional) */}
//       <select
//         className="col-span-3 border rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-indigo-100"
//         value={v.generationId ?? ''}
//         onChange={(e) => onChange({
//           ...v,
//           generationId: e.target.value === '' ? '' : Number(e.target.value),
//         })}
//       >
//         <option value="">เลือกรุ่น (optional)</option>
//         {generations.map((g) => (
//           <option key={g.id} value={g.id}>{g.name}</option>
//         ))}
//       </select>

//       {/* Quantity */}
//       <input
//         type="number"
//         min="0"
//         className="col-span-3 border rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-indigo-100"
//         placeholder="จำนวน"
//         value={v.quantity}
//         onChange={(e) => onChange({ ...v, quantity: Number(e.target.value || 0) })}
//       />

//       {/* SKU */}
//       <input
//         className="col-span-2 border rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-indigo-100"
//         placeholder="SKU (ไม่บังคับ)"
//         value={v.sku ?? ''}
//         onChange={(e) => onChange({ ...v, sku: e.target.value })}
//       />

//       <button
//         type="button"
//         onClick={onRemove}
//         className="col-span-1 p-2.5 inline-flex items-center justify-center rounded-md border text-red-500 hover:bg-red-50"
//         title="ลบแถว"
//       >
//         <Trash2 size={18} />
//       </button>
//     </div>
//   );
// }

// const FormProduct = () => {
//   const token = useEcomStore((s) => s.token);
//   const getCategory = useEcomStore((s) => s.getCategory);
//   const categories = useEcomStore((s) => s.categories);
//   const getProduct = useEcomStore((s) => s.getProduct);
//   const products = useEcomStore((s) => s.products);
//   const getSize = useEcomStore((s) => s.getSize);
//   const sizes = useEcomStore((s) => s.sizes);
//   const getGeneration = useEcomStore((s) => s.getGeneration);
//   const generations = useEcomStore((s) => s.generations);

//   const [form, setForm] = useState(initialState);
//   const [uploaderKey, setUploaderKey] = useState(0);
//   const [submitting, setSubmitting] = useState(false);
//   const [confirmId, setConfirmId] = useState(null);
//   const [query, setQuery] = useState('');
//   const [error, setError] = useState(null);
//   const [topToast, setTopToast] = useState(null); // { message, type }

//   useEffect(() => {
//     getCategory();
//     getProduct(100);
//     getSize();
//     getGeneration();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   const showTopToast = (message, type = 'success', duration = 1500) => {
//     setTopToast({ message, type });
//     if (showTopToast.timer) clearTimeout(showTopToast.timer);
//     showTopToast.timer = setTimeout(() => setTopToast(null), duration);
//   };

//   const handleOnChange = (e) => {
//     setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
//   };

//   const addVariant = () => {
//     setForm((f) => ({
//       ...f,
//       variants: [...f.variants, { sizeId: '', generationId: '', quantity: 0, sku: '' }],
//     }));
//   };

//   const updateVariant = (idx, newV) => {
//     setForm((f) => ({
//       ...f,
//       variants: f.variants.map((v, i) => (i === idx ? newV : v)),
//     }));
//   };

//   const removeVariant = (idx) => {
//     setForm((f) => ({
//       ...f,
//       variants: f.variants.filter((_, i) => i !== idx),
//     }));
//   };

//   const totalVariantQty = useMemo(
//     () => form.variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0),
//     [form.variants]
//   );

//   const validate = () => {
//     const errors = [];
//     if (!form.title.trim()) errors.push('กรอกชื่อสินค้า');
//     if (!form.description.trim()) errors.push('กรอกรายละเอียด');
//     if (!form.price || Number(form.price) <= 0) errors.push('ราคาต้องมากกว่า 0');
//     if (!form.categoryId) errors.push('เลือกหมวดหมู่');
//     if (form.variants.length === 0) errors.push('เพิ่มอย่างน้อย 1 size');

//     const keySet = new Set();
//     form.variants.forEach((v, i) => {
//       if (!v.sizeId) errors.push(`เลือกระบุ size แถวที่ ${i + 1}`);
//       if (v.quantity == null || Number(v.quantity) < 0)
//         errors.push(`จำนวนต้อง ≥ 0 ที่แถวที่ ${i + 1}`);
//       const genKey = v.generationId === '' || v.generationId == null ? 'null' : String(v.generationId);
//       const key = `${String(v.sizeId)}::${genKey}`;
//       if (keySet.has(key)) errors.push(`ซ้ำ: size/generation แถวที่ ${i + 1}`);
//       keySet.add(key);
//     });
//     return errors;
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError(null);
//     const errs = validate();
//     if (errs.length) {
//       showTopToast(errs[0], 'error', 1800); // โชว์เฉพาะข้อความแรกเพื่อไม่รบกวนสายตา
//       return;
//     }
//     setSubmitting(true);
//     try {
//       const payload = {
//         title: form.title.trim(),
//         description: form.description.trim(),
//         price: Number(form.price),
//         categoryId: form.categoryId ? Number(form.categoryId) : null,
//         images: form.images,
//         variants: form.variants.map((v) => ({
//           sizeId: Number(v.sizeId),
//           generationId: v.generationId === '' || v.generationId == null ? null : Number(v.generationId),
//           quantity: Number(v.quantity || 0),
//           sku: v.sku || null,
//         })),
//       };

//       const res = await createProduct(token, payload);
//       setForm(initialState);
//       setUploaderKey((k) => k + 1);
//       await getProduct(100);
//       showTopToast(`เพิ่มข้อมูล ${res?.data?.title ?? payload.title} สำเร็จ`, 'success');
//     } catch (err) {
//       console.error(err);
//       const msg = err?.response?.data?.message || 'บันทึกไม่สำเร็จ';
//       setError(msg);
//       showTopToast(msg, 'error', 1800);
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const handleDelete = async (id) => {
//     setConfirmId(id);
//   };

//   const confirmDelete = async () => {
//     const id = confirmId;
//     setConfirmId(null);
//     if (!id) return;
//     try {
//       await deleteProduct(token, id);
//       await getProduct(100);
//       showTopToast('ลบสินค้าสำเร็จ', 'success');
//     } catch (err) {
//       console.error(err);
//       showTopToast('ไม่สามารถลบสินค้าได้', 'error', 1800);
//     }
//   };

//   // Sort latest first (createdAt desc, fallback id desc) + search
//   const sortDesc = (a, b) => {
//     const da = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
//     const db = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
//     if (db !== da) return db - da;
//     return (b?.id ?? 0) - (a?.id ?? 0);
//   };

//   const displayedProducts = useMemo(() => {
//     const base = [...(products || [])].sort(sortDesc);
//     const q = query.trim().toLowerCase();
//     if (!q) return base;
//     return base.filter((p) =>
//       [p.title, p.description, p.category?.name]
//         .filter(Boolean)
//         .some((txt) => String(txt).toLowerCase().includes(q))
//     );
//   }, [products, query]);

//   const nfmt = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });

//   return (
//     <div className="max-w-6xl mx-auto p-6">
//       {/* Header Card */}
//       <div className="bg-white/80 backdrop-blur shadow-xl rounded-2xl border border-gray-100 mb-6">
//         <div className="px-6 pt-6 pb-4 flex items-center justify-between">
//           <div className="flex items-center gap-3">
//             <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100">
//               <Package className="w-5 h-5 text-indigo-600" />
//             </div>
//             <div>
//               <h2 className="text-xl font-semibold text-gray-900">เพิ่มข้อมูลสินค้า</h2>
//               <p className="text-sm text-gray-500">กำหนดรายละเอียด รูปภาพ และตัวเลือกสินค้า (Variants)</p>
//             </div>
//           </div>

//         </div>

//         {/* Form */}
//         <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-6">
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//             <div>
//               <label className="block text-gray-700 font-medium mb-1">ชื่อสินค้า</label>
//               <input
//                 className="w-full border border-gray-200 rounded-xl p-2.5 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-100"
//                 name="title"
//                 placeholder="ชื่อสินค้า"
//                 value={form.title}
//                 onChange={handleOnChange}
//                 required
//               />
//             </div>

//             <div>
//               <label className="block text-gray-700 font-medium mb-1">รายละเอียด</label>
//               <input
//                 className="w-full border border-gray-200 rounded-xl p-2.5 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-100"
//                 name="description"
//                 placeholder="รายละเอียด"
//                 value={form.description}
//                 onChange={handleOnChange}
//                 required
//               />
//             </div>

//             <div>
//               <label className="block text-gray-700 font-medium mb-1">ราคา</label>
//               <input
//                 type="number"
//                 className="w-full border border-gray-200 rounded-xl p-2.5 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-100"
//                 name="price"
//                 placeholder="ราคา"
//                 value={form.price}
//                 onChange={handleOnChange}
//                 required
//               />
//               <p className="text-xs text-gray-500 mt-1">* ราคาเดียวทุก size</p>
//             </div>

//             <div>
//               <label className="block text-gray-700 font-medium mb-1">จำนวนรวม (ออปชัน)</label>
//               <input
//                 type="number"
//                 className="w-full border border-gray-200 rounded-xl p-2.5 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-100"
//                 name="quantity"
//                 placeholder="จำนวนรวม (ถ้าคุมตาม variants อาจปล่อย 0)"
//                 value={form.quantity}
//                 onChange={handleOnChange}
//               />
//               <p className="text-xs text-gray-500 mt-1">
//                 สต็อกรวมจาก variants ตอนนี้: <b>{totalVariantQty}</b>
//               </p>
//             </div>

//             <div className="md:col-span-2">
//               <label className="block text-gray-700 font-medium mb-1">หมวดหมู่</label>
//               <select
//                 className="w-full border border-gray-200 rounded-xl p-2.5 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-100"
//                 name="categoryId"
//                 onChange={handleOnChange}
//                 value={form.categoryId}
//                 required
//               >
//                 <option value="" disabled>เลือกหมวดหมู่</option>
//                 {categories.map((item) => (
//                   <option key={item.id} value={item.id}>{item.name}</option>
//                 ))}
//               </select>
//             </div>
//           </div>

//           {/* Upload */}
//           <div>
//             <label className="block text-gray-700 font-medium mb-2">อัปโหลดรูปภาพ</label>
//             <Uploadfile key={uploaderKey} form={form} setForm={setForm} />
//           </div>

//           {/* Variants */}
//           <div className="mt-2">
//             <div className="flex items-center justify-between mb-2">
//               <label className="block text-gray-700 font-medium">ตัวเลือกสินค้า (Variants)</label>
//               <button
//                 type="button"
//                 onClick={addVariant}
//                 className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border hover:bg-gray-50"
//               >
//                 <Plus size={16} /> เพิ่มแถว
//               </button>
//             </div>

//             <div className="space-y-2">
//               {form.variants.map((v, idx) => (
//                 <VariantRow
//                   key={idx}
//                   v={v}
//                   sizes={sizes}
//                   generations={generations}
//                   onChange={(nv) => updateVariant(idx, nv)}
//                   onRemove={() => removeVariant(idx)}
//                 />
//               ))}
//               {form.variants.length === 0 && (
//                 <div className="text-sm text-gray-500">ยังไม่มีตัวเลือก size — กด “เพิ่มแถว” เพื่อเริ่ม</div>
//               )}
//             </div>
//           </div>

//           <div className="pt-2">
//             <button
//               type="submit"
//               className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-md disabled:opacity-60"
//               disabled={submitting}
//             >
//               {submitting ? 'กำลังบันทึก...' : 'เพิ่มสินค้า'}
//             </button>
//             {error && (
//               <div className="mt-2 inline-flex items-center gap-2 text-red-600 text-sm">
//                 <AlertTriangle className="w-4 h-4" />
//                 <span>{error}</span>
//               </div>
//             )}
//           </div>
//         </form>
//       </div>

//       {/* รายการสินค้า */}
//       <div className="bg-white/80 backdrop-blur shadow-xl rounded-2xl border border-gray-100">
//         <div className="px-6 pt-6 pb-4 flex items-center justify-between">
//           <h3 className="text-lg font-semibold text-gray-900">รายการสินค้า</h3>

//           <span className="text-sm px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">{displayedProducts.length} รายการ</span>
//           <div className="relative">
//             <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
//             <input
//               className="w-64 pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-gray-100"
//               placeholder="ค้นหาสินค้า..."
//               value={query}
//               onChange={(e) => setQuery(e.target.value)}
//             />
//           </div>
//         </div>
//         <div className="overflow-x-auto rounded-b-2xl border-t border-gray-100">
//           <table className="min-w-full divide-y divide-gray-200 text-sm">
//             <thead className="bg-gray-50">
//               <tr className="text-left text-gray-600 font-medium">
//                 <th className="px-4 py-3">NO.</th>
//                 <th className="px-4 py-3">รูปภาพ</th>
//                 <th className="px-4 py-3">ชื่อสินค้า</th>
//                 <th className="px-4 py-3">รายละเอียด</th>
//                 <th className="px-4 py-3">ราคา</th>
//                 <th className="px-4 py-3">จำนวนรวม</th>
//                 <th className="px-4 py-3">ขายได้</th>
//                 <th className="px-4 py-3">อัปเดต</th>
//                 <th className="px-4 py-3 text-center">การจัดการ</th>
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-gray-100">
//               {displayedProducts.map((item, index) => {
//                 const qtySum = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) ?? item.quantity;
//                 return (
//                   <tr key={item.id} className="hover:bg-gray-50">
//                     <td className="px-4 py-3">{index + 1}</td>
//                     <td className="px-4 py-3">
//                       {item.images?.length > 0 ? (
//                         <img src={item.images[0].url} alt="" className="w-16 h-16 object-cover rounded-md shadow" />
//                       ) : (
//                         <div className="w-16 h-16 bg-gray-300 flex items-center justify-center text-white rounded-md">ไม่มีรูป</div>
//                       )}
//                     </td>
//                     <td className="px-4 py-3">{item.title}</td>
//                     <td className="px-4 py-3 max-w-[24ch] truncate" title={item.description}>{item.description}</td>
//                     <td className="px-4 py-3">{nfmt.format(item.price)}</td>
//                     <td className="px-4 py-3">{qtySum}</td>
//                     <td className="px-4 py-3">{item.sold}</td>
//                     <td className="px-4 py-3">
//                       {new Date(item.updatedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
//                     </td>
//                     <td className="px-4 py-3">
//                       <div className="flex items-center justify-center gap-3">
//                         <Link
//                           to={`/admin/product/${item.id}`}
//                           className="flex items-center gap-1 bg-amber-400 hover:bg-amber-500 text-white px-3 py-1.5 rounded-md text-sm shadow transition-all duration-200"
//                         >
//                           <Pencil size={16} />
//                           <span>แก้ไข</span>
//                         </Link>
//                         <button
//                           onClick={() => handleDelete(item.id)}
//                           className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-md text-sm shadow transition-all duration-200"
//                         >
//                           <Trash2 size={16} />
//                           <span>ลบ</span>
//                         </button>
//                       </div>
//                     </td>
//                   </tr>
//                 );
//               })}
//               {displayedProducts.length === 0 && (
//                 <tr>
//                   <td colSpan={9} className="px-4 py-8 text-center text-gray-500">ยังไม่มีสินค้า</td>
//                 </tr>
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>

//       {/* Confirm Delete Modal */}
//       <AnimatePresence>
//         {confirmId !== null && (
//           <motion.div
//             initial={{ opacity: 0 }}
//             animate={{ opacity: 1 }}
//             exit={{ opacity: 0 }}
//             className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
//             role="dialog"
//             aria-modal="true"
//           >
//             <motion.div
//               initial={{ scale: 0.96, opacity: 0 }}
//               animate={{ scale: 1, opacity: 1 }}
//               exit={{ scale: 0.98, opacity: 0 }}
//               className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100"
//             >
//               <div className="p-6 flex items-start gap-3">
//                 <div className="p-2.5 rounded-xl bg-red-50 border border-red-100">
//                   <AlertTriangle className="w-5 h-5 text-red-600" />
//                 </div>
//                 <div>
//                   <h2 className="text-lg font-semibold text-gray-900">ยืนยันการลบสินค้า</h2>
//                   <p className="text-gray-600 mt-1 text-sm">การลบสินค้าไม่สามารถย้อนกลับได้ คุณแน่ใจหรือไม่?</p>
//                 </div>
//               </div>
//               <div className="px-6 pb-6 flex items-center justify-end gap-3">
//                 <button
//                   className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition"
//                   onClick={() => setConfirmId(null)}
//                 >
//                   ยกเลิก
//                 </button>
//                 <button
//                   className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition"
//                   onClick={confirmDelete}
//                 >
//                   <Trash2 className="w-4 h-4" />
//                   ลบเลย
//                 </button>
//               </div>
//             </motion.div>
//           </motion.div>
//         )}
//       </AnimatePresence>

//       {/* Top Toast – small black/colored bar */}
//       <AnimatePresence>
//         {topToast && (
//           <motion.div
//             initial={{ opacity: 0, y: -20 }}
//             animate={{ opacity: 1, y: 0 }}
//             exit={{ opacity: 0, y: -20 }}
//             className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-lg text-white text-sm font-medium ${topToast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
//               }`}
//           >
//             {topToast.message}
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </div>
//   );
// };

// export default FormProduct;
