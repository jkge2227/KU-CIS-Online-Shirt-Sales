// client/src/pages/admin/EditProduct.jsx
import React, { useEffect, useMemo, useState } from "react";
import useEcomStore from "../../store/ecom-store";
import { readProduct, updateProduct } from "../../api/product";
import { toast } from "react-toastify";
import Uploadfile from "./Uploadfile";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, X, Package, Layers } from "lucide-react";

// --- Chip helpers ---
function Chip({ active, children, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                "rounded-xl border px-3 py-1.5 text-sm transition-all",
                active
                    ? "bg-gray-700 text-white border-gray-700 shadow-sm"
                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-400",
            ].join(" ")}
        >
            {children}
        </button>
    );
}

// --- Variant row (no dropdowns) ---
function VariantRow({ v, sizes, generations, onChange, onRemove, index }) {
    return (
        <div className="flex flex-col gap-3 border-b border-gray-200 py-3 last:border-none">
            <div className="flex flex-wrap items-center gap-3">
                {/* Size */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Size:</span>
                    {sizes.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => onChange({ ...v, sizeId: s.id })}
                            className={`rounded-full border px-3 py-1 text-sm transition-all ${v.sizeId === s.id
                                    ? "bg-gray-700 text-white border-gray-700"
                                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                                }`}
                        >
                            {s.name}
                        </button>
                    ))}
                </div>

                {/* Generation */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">รุ่น:</span>
                    {generations.length > 0 ? (
                        <>
                            {generations.map((g) => (
                                <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => onChange({ ...v, generationId: g.id })}
                                    className={`rounded-full border px-3 py-1 text-sm transition-all ${v.generationId === g.id
                                            ? "bg-gray-700 text-white border-gray-700"
                                            : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                                        }`}
                                >
                                    {g.name}
                                </button>
                            ))}
                        </>
                    ) : (
                        <span className="text-sm text-gray-500">ไม่มีรุ่นในระบบ</span>
                    )}
                </div>

                {/* จำนวน */}
                <div className="flex items-center gap-2 ml-auto">
                    <input
                        type="number"
                        min="0"
                        value={v.quantity}
                        onChange={(e) =>
                            onChange({
                                ...v,
                                quantity: Math.max(0, Number(e.target.value || 0)),
                            })
                        }
                        className="w-20 rounded-md border border-gray-300 p-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-700/10"
                        placeholder="จำนวน"
                    />

                    {/* ลบแถว */}
                    <button
                        type="button"
                        onClick={onRemove}
                        className="rounded-md border border-red-200 px-2 py-1 text-sm text-red-600 hover:bg-red-50 transition"
                        title="ลบแถว"
                    >
                        ลบ
                    </button>
                </div>
            </div>
        </div>
    );
}


export default function EditProduct() {
    const { id } = useParams();
    const navigate = useNavigate();
    const token = useEcomStore((s) => s.token);

    const getCategory = useEcomStore((s) => s.getCategory);
    const categories = useEcomStore((s) => s.categories);
    const getSize = useEcomStore((s) => s.getSize);
    const sizes = useEcomStore((s) => s.sizes);
    const getGeneration = useEcomStore((s) => s.getGeneration);
    const generations = useEcomStore((s) => s.generations);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        title: "", description: "", price: "", quantity: 0,
        categoryId: "", images: [], variants: []
    });

    useEffect(() => {
        (async () => {
            try {
                await Promise.all([getCategory(), getSize(), getGeneration()]);
                const res = await readProduct(token, id);
                const p = res.data;
                setForm({
                    title: p.title || "",
                    description: p.description || "",
                    price: p.price || "",
                    quantity: Math.max(0, p.quantity || 0),
                    categoryId: p.categoryId || "",
                    images: p.images || [],
                    variants: (p.variants || []).map(v => ({
                        sizeId: v.sizeId ?? "",
                        generationId: v.generationId ?? "",
                        quantity: Math.max(0, v.quantity || 0),
                        sku: v.sku || ""
                    }))
                });
            } catch {
                toast.error("โหลดข้อมูลสินค้าไม่สำเร็จ");
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    const totalStock = useMemo(
        () => form.variants.reduce((s, v) => s + (Number(v.quantity) || 0), 0),
        [form.variants]
    );

    const addVariant = () =>
        setForm(f => ({ ...f, variants: [...f.variants, { sizeId: "", generationId: "", quantity: 0, sku: "" }] }));
    const updateVariant = (i, nv) =>
        setForm(f => ({ ...f, variants: f.variants.map((v, idx) => idx === i ? nv : v) }));
    const removeVariant = (i) =>
        setForm(f => ({ ...f, variants: f.variants.filter((_, idx) => idx !== i) }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                title: form.title.trim(),
                description: form.description.trim(),
                price: Number(form.price),
                quantity: Number(form.quantity),
                categoryId: Number(form.categoryId),
                images: form.images,
                variants: form.variants.map(v => ({
                    sizeId: Number(v.sizeId),
                    generationId: v.generationId ? Number(v.generationId) : null,
                    quantity: Number(v.quantity),
                    sku: v.sku || null
                }))
            };
            await updateProduct(token, id, payload);
            toast.success("แก้ไขสินค้าเรียบร้อย");
            navigate("/admin/product");
        } catch {
            toast.error("เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="mx-auto max-w-5xl p-6 text-gray-500">กำลังโหลด…</div>;

    return (
        <div className="mx-auto max-w-5xl px-4 py-6">
            {/* Header */}
            <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                    <Package size={18} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-700">แก้ไขสินค้า</h1>
                    <p className="text-sm text-gray-500">กำหนดรายละเอียด รูปภาพ และตัวเลือกสินค้า </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* ข้อมูลหลัก */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="text-sm text-gray-700">ชื่อสินค้า</label>
                            <input
                                name="title" value={form.title}
                                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-gray-700/10"
                                placeholder="ชื่อสินค้า"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-700">รายละเอียด</label>
                            <input
                                name="description" value={form.description}
                                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-gray-700/10"
                                placeholder="รายละเอียดสินค้า"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-700">ราคา (บาท)</label>
                            <input
                                type="number" name="price" value={form.price}
                                onChange={(e) => setForm(f => ({ ...f, price: Math.max(0, Number(e.target.value || 0)) }))}
                                className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-gray-700/10"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-700">จำนวนรวม</label>
                            <input
                                type="number" name="quantity" value={form.quantity}
                                onChange={(e) => setForm(f => ({ ...f, quantity: Math.max(0, Number(e.target.value || 0)) }))}
                                className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-gray-700/10"
                            />
                            <p className="mt-1 text-xs text-gray-500">สต็อกรวม <b>{totalStock}</b></p>
                        </div>
                    </div>

                    {/* หมวดหมู่แบบชิป */}
                    <div className="mt-4">
                        <div className="mb-1 text-sm text-gray-700 font-medium">หมวดหมู่สินค้า</div>
                        <div className="flex flex-wrap gap-2">
                            {categories.map((c) => (
                                <Chip
                                    key={c.id}
                                    active={String(form.categoryId) === String(c.id)}
                                    onClick={() => setForm(f => ({ ...f, categoryId: c.id }))}
                                >
                                    {c.name}
                                </Chip>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Upload รูป */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="mb-2 text-base font-semibold text-gray-700">รูปภาพสินค้า</div>
                    <Uploadfile form={form} setForm={setForm} />
                </div>

                {/* Variants */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                        <div className="text-base font-semibold text-gray-700">ตัวเลือกสินค้า</div>
                        <button
                            type="button"
                            onClick={addVariant}
                            className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 hover:bg-gray-50"
                        >
                            <Plus size={16} /> เพิ่มแถว
                        </button>
                    </div>

                    <div className="space-y-2">
                        {form.variants.length ? (
                            form.variants.map((v, i) => (
                                <VariantRow
                                    key={i}
                                    index={i}
                                    v={v}
                                    sizes={sizes}
                                    generations={generations}
                                    onChange={(nv) => updateVariant(i, nv)}
                                    onRemove={() => removeVariant(i)}
                                />
                            ))
                        ) : (
                            <div className="flex items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                                <Layers size={16} /> ยังไม่มีตัวเลือก — กด “เพิ่มแถว” เพื่อเริ่ม
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-xl bg-gray-700 px-6 py-2.5 font-semibold text-white shadow-md transition hover:bg-black disabled:opacity-60"
                    >
                        {submitting ? "กำลังบันทึก…" : "บันทึกสินค้า"}
                    </button>
                </div>
            </form>
        </div>
    );
}

