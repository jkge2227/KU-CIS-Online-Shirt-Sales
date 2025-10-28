// client/src/pages/ProductDetail.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useEcomStore from "../store/ecom-store";
import { getProductById } from "../api/ProductDetail";
import { listProductReviews } from "../api/review";
import ProductRating from "../components/product/ProductRating";
import { ShoppingBasket, Star, Minus, Plus, Check } from "lucide-react";
import { toast } from "react-toastify";
import { createUserCart } from "../api/users";

const makeKey = (productId, variantId) => `${productId}::${variantId}`;
const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// ---------- cart helper ----------
const buildNextCarts = (currentCarts, payload) => {
    const {
        productId,
        variantId,
        count,
        price,
        productTitle,
        sizeName,
        generationName,
        image,
        maxStock,
    } = payload;
    const key = makeKey(productId, variantId);
    const idx = currentCarts.findIndex((c) => c.key === key);

    if (idx >= 0) {
        const updated = [...currentCarts];
        const prev = updated[idx];
        const nextCount = Math.max(1, Number(prev.count || 0) + Number(count || 0));
        updated[idx] = {
            ...prev,
            count: maxStock != null ? Math.min(nextCount, Number(maxStock)) : nextCount,
            ...(maxStock != null ? { maxStock: Number(maxStock) } : {}),
        };
        return updated;
    } else {
        const initCount = Math.max(1, Number(count || 1));
        return [
            ...currentCarts,
            {
                key,
                productId,
                variantId,
                count: maxStock != null ? Math.min(initCount, Number(maxStock)) : initCount,
                price,
                productTitle,
                sizeName,
                generationName,
                image,
                ...(maxStock != null ? { maxStock: Number(maxStock) } : {}),
            },
        ];
    }
};

// ---------- small pick helpers ----------
const pickSizeName = (rv) =>
    rv?.sizeName ?? rv?.variantSizeName ?? rv?.variant?.size?.name ?? null;
const pickGenerationName = (rv) =>
    rv?.generationName ??
    rv?.variantGenerationName ??
    rv?.variant?.generation?.name ??
    null;

/** กลุ่มตัวเลือกแบบ pill (a11y + สัมผัสดี) */
function OptionGroup({ label, options, value, onChange, emptyLabel = "— ไม่มีข้อมูล —" }) {
    if (!options || options.length === 0) {
        return (
            <div>
                <div className="text-sm font-medium mb-1">{label}</div>
                <div className="text-sm text-gray-500">{emptyLabel}</div>
            </div>
        );
    }
    return (
        <div>
            <div className="text-sm font-medium mb-1">{label}</div>
            <div role="radiogroup" className="flex flex-wrap gap-2">
                {options.map((opt) => {
                    const selected = String(value) === String(opt.id ?? "");
                    const disabled = !!opt.disabled;
                    return (
                        <button
                            key={String(opt.id)}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-disabled={disabled}
                            disabled={disabled}
                            onClick={() => onChange(opt.id ?? "")}
                            className={[
                                "h-9 px-3 rounded-full border text-sm transition-all shadow-sm",
                                "focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300",
                                selected
                                    ? "border-gray-800 bg-gray-800 text-white"
                                    : "bg-white text-gray-700 hover:border-gray-300",
                                disabled ? "opacity-50 cursor-not-allowed" : "",
                            ].join(" ")}
                            title={disabled ? "สินค้าหมด" : opt.name}
                        >
                            <span className="inline-flex items-center gap-1">
                                {selected && <Check size={16} />}
                                {opt.name}
                            </span>
                            {opt.note && (
                                <span className="ml-2 text-xs text-gray-400">({opt.note})</span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default function ProductDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const token = useEcomStore((s) => s.token);
    const carts = useEcomStore((s) => s.carts);
    const actionAddtoCart = useEcomStore((s) => s.actionAddtoCart);

    const [item, setItem] = useState(null);
    const [activeIdx, setActiveIdx] = useState(0);
    const [showLightbox, setShowLightbox] = useState(false);
    const [loading, setLoading] = useState(true);

    const [sizeId, setSizeId] = useState("");
    const [generationId, setGenerationId] = useState("");
    const [count, setCount] = useState(1);

    const autoSelectedOnce = useRef(false);

    // reviews
    const [reviews, setReviews] = useState([]);
    const [reviewPage, setReviewPage] = useState(1);
    const [reviewTotal, setReviewTotal] = useState(0);
    const pageSize = 5;

    // ---------- load product ----------
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setLoading(true);
                const res = await getProductById(id);
                if (!alive) return;
                setItem(res.data);
                setActiveIdx(0);
            } catch (e) {
                console.error(e);
                toast.error("ไม่พบสินค้า");
                navigate("/");
            } finally {
                setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [id, navigate]);

    // ---------- load reviews ----------
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const r = await listProductReviews(id, reviewPage, pageSize);
                if (!alive) return;
                const data = Array.isArray(r.data?.data) ? r.data.data : [];
                setReviews(data);
                setReviewTotal(Number(r.data?.pagination?.total || 0));
            } catch {
                // silent
            }
        })();
        return () => {
            alive = false;
        };
    }, [id, reviewPage]);

    // ---------- options meta ----------
    const sizeMeta = useMemo(() => {
        const map = new Map(); // sizeId -> { name, totalQty }
        (item?.variants || []).forEach((v) => {
            if (!v.size) return;
            const prev = map.get(v.size.id) || { name: v.size.name, totalQty: 0 };
            prev.totalQty += Number(v.quantity || 0);
            map.set(v.size.id, prev);
        });
        return map;
    }, [item]);

    const sizeOptions = useMemo(
        () =>
            Array.from(sizeMeta.entries()).map(([id, { name, totalQty }]) => ({
                id,
                name,
                disabled: totalQty <= 0,
                note: totalQty > 0 ? `คงเหลือ ${totalQty}` : "หมด",
            })),
        [sizeMeta]
    );

    const generationOptions = useMemo(() => {
        if (!sizeId) return [];
        const list = (item?.variants || [])
            .filter((v) => v.sizeId === Number(sizeId))
            .map((v) => ({
                id: v.generation ? v.generation.id : null,
                name: v.generation ? v.generation.name : "ไม่มีรุ่น",
                qty: Number(v.quantity || 0),
            }));
        const agg = new Map();
        list.forEach((g) => {
            const prev = agg.get(g.id) || { id: g.id, name: g.name, qty: 0 };
            prev.qty += g.qty;
            agg.set(g.id, prev);
        });
        return Array.from(agg.values()).map((g) => ({
            id: g.id,
            name: g.name,
            disabled: g.qty <= 0,
            note: g.qty > 0 ? `คงเหลือ ${g.qty}` : "หมด",
        }));
    }, [item, sizeId]);

    const selectedVariant = useMemo(() => {
        if (!sizeId) return null;
        const genId = generationId === "" ? null : Number(generationId);
        return (
            (item?.variants || []).find(
                (v) => v.sizeId === Number(sizeId) && (v.generationId ?? null) === genId
            ) || null
        );
    }, [item, sizeId, generationId]);

    const stock = selectedVariant?.quantity ?? 0;
    const canAdd = selectedVariant && stock > 0 && count > 0;

    // ---------- auto-select once ----------
    useEffect(() => {
        if (!item || autoSelectedOnce.current) return;
        const list = Array.isArray(item.variants) ? item.variants : [];
        let first = list.find((v) => Number(v.quantity) > 0) || list[0];
        if (first) {
            setSizeId(String(first.sizeId));
            setGenerationId(String(first.generationId ?? ""));
            autoSelectedOnce.current = true;
        }
    }, [item]);

    // Ensure generation valid when size changes
    useEffect(() => {
        if (!sizeId) {
            setGenerationId("");
            return;
        }
        const validSet = new Set(generationOptions.map((g) => String(g.id ?? "")));
        if (!validSet.has(String(generationId))) {
            const firstEnabled = generationOptions.find((g) => !g.disabled) ?? generationOptions[0];
            setGenerationId(firstEnabled ? String(firstEnabled.id ?? "") : "");
        }
    }, [sizeId, generationOptions]); // omit generationId by design

    // ---------- add to cart ----------
    const handleAdd = async () => {
        if (!item || !selectedVariant) return;

        const payload = {
            productId: item.id,
            variantId: selectedVariant.id,
            count,
            productTitle: item.title,
            price: item.price,
            sizeName: selectedVariant.size?.name,
            generationName: selectedVariant.generation?.name ?? null,
            image: item.images?.[0]?.url || null,
            maxStock: selectedVariant.quantity,
        };

        const nextCarts = buildNextCarts(carts, payload);

        try {
            if (token) {
                await createUserCart(token, { cart: nextCarts });  // 🔐 โดนแบนจะเด้ง 403 ตรงนี้
                actionAddtoCart(payload);
                toast.success("เพิ่มลงตะกร้าและบันทึกแล้ว");
            } else {
                actionAddtoCart(payload);
                toast.info("เพิ่มลงตะกร้าแล้ว (ยังไม่บันทึกเพราะยังไม่ได้เข้าสู่ระบบ)");
            }
        } catch (e) {
            const msg = e?.response?.data?.message || "บันทึกตะกร้าขึ้นเซิร์ฟเวอร์ไม่สำเร็จ";
            if (e?.response?.status === 403) {
                // จะได้ข้อความ: "บัญชีถูกปิดใช้งาน: อนุญาตเฉพาะการอ่านข้อมูล"
                toast.error(msg);
            } else {
                toast.error(msg);
            }
        }
    };


    // ---------- loading ----------
    if (loading) {
        return (
            <div className="max-w-6xl mx-auto p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 w-56 bg-gray-200 rounded" />
                    <div className="h-72 bg-gray-100 rounded-xl" />
                    <div className="h-28 bg-gray-100 rounded-xl" />
                </div>
            </div>
        );
    }
    if (!item) return null;

    const totalPages = Math.max(1, Math.ceil(reviewTotal / pageSize));

    return (
        <div className="mx-auto w-full max-w-[1289px] px-6 pt-6 space-y-6 md:p-5">
            {/* Breadcrumb */}
            <div className="text-sm text-gray-500 mb-3">
                <button
                    className="hover:underline"
                    onClick={() => navigate("/")}
                    aria-label="กลับไปหน้าสินค้าทั้งหมด"
                >
                    สินค้าทั้งหมด
                </button>{" "}
                / <span className="text-gray-700">{item.title}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Gallery */}
                <div className="md:col-span-5">
                    <div className="rounded-2xl border bg-white p-3">
                        <div className="w-full aspect-[4/3] rounded-xl overflow-hidden border flex items-center justify-center">
                            {item.images?.[activeIdx]?.url ? (
                                <img
                                    src={item.images[activeIdx].url}
                                    alt={item.title}
                                    className="w-full h-full object-contain cursor-zoom-in"
                                    onClick={() => setShowLightbox(true)}
                                />
                            ) : (
                                <div className="text-gray-400 text-sm">ไม่มีรูปภาพ</div>
                            )}
                            {showLightbox && (
                                <div
                                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
                                    onClick={() => setShowLightbox(false)}
                                >
                                    <button
                                        className="absolute top-4 right-4 text-white text-2xl"
                                        onClick={() => setShowLightbox(false)}
                                        aria-label="ปิดรูปขยาย"
                                    >
                                        ✕
                                    </button>
                                    <button
                                        className="absolute left-4 text-white text-3xl"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveIdx(
                                                (i) => (i - 1 + item.images.length) % item.images.length
                                            );
                                        }}
                                        aria-label="รูปก่อนหน้า"
                                    >
                                        ‹
                                    </button>
                                    <img
                                        src={item.images[activeIdx].url}
                                        alt={item.title}
                                        className="max-h-[90vh] max-w-[90vw] object-contain"
                                    />
                                    <button
                                        className="absolute right-4 text-white text-3xl"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveIdx((i) => (i + 1) % item.images.length);
                                        }}
                                        aria-label="รูปถัดไป"
                                    >
                                        ›
                                    </button>
                                </div>
                            )}
                        </div>

                        {item.images?.length > 1 && (
                            <div className="mt-3 grid grid-cols-5 gap-2">
                                {item.images.map((im, i) => (
                                    <button
                                        type="button"
                                        key={im.id ?? `${i}-${im.url}`}
                                        onClick={() => setActiveIdx(i)}
                                        className={`h-16 border rounded-lg overflow-hidden flex items-center justify-center bg-white ${i === activeIdx ? "ring-2 ring-gray-600 border-gray-600" : "hover:border-gray-300"
                                            }`}
                                        aria-label={`ดูรูปที่ ${i + 1}`}
                                    >
                                        <img src={im.url} alt="" className="max-h-full object-contain" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Info + Buy */}
                <div className="md:col-span-7">
                    <div className="rounded-2xl border bg-white p-4 md:p-6 space-y-3">
                        <h1 className="text-2xl font-semibold text-gray-900">{item.title}</h1>
                        <p className="text-sm text-gray-600 line-clamp-3">{item.description}</p>

                        <div className="pt-1">
                            <ProductRating productId={item.id} size={20} />
                        </div>

                        <div className="text-3xl font-bold text-gray-700 pt-1">
                            ฿{toNum(item.price).toLocaleString("th-TH")}
                        </div>

                        {item.pickupLocation && (
                            <div className="text-sm text-gray-600">
                                จุดรับสินค้า: <b>{item.pickupLocation}</b>
                            </div>
                        )}

                        {/* selectors */}
                        <div className="grid grid-cols-1 gap-3 pt-2">
                            <OptionGroup
                                label="ไซซ์"
                                options={sizeOptions}
                                value={sizeId}
                                onChange={(val) => {
                                    setSizeId(String(val));
                                    setGenerationId("");
                                }}
                            />
                            <OptionGroup
                                label="รุ่น"
                                options={generationOptions}
                                value={generationId}
                                onChange={(val) => setGenerationId(String(val))}
                                emptyLabel={sizeId ? "ไม่มีตัวเลือกรุ่นของไซซ์นี้" : "เลือกไซซ์ก่อน"}
                            />
                        </div>

                        {/* qty + add */}
                        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pt-2">
                            <div>
                                <div className="text-sm font-medium mb-1">จำนวน</div>
                                <div className="inline-flex items-center h-9 rounded-full border bg-white overflow-hidden">
                                    <button
                                        type="button"
                                        className="w-9 h-9 flex items-center justify-center disabled:opacity-50"
                                        onClick={() => setCount((c) => Math.max(1, c - 1))}
                                        disabled={!selectedVariant || count <= 1}
                                        aria-label="ลดจำนวน"
                                        title="ลดจำนวน"
                                    >
                                        <Minus size={16} />
                                    </button>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-14 h-9 text-center border-x outline-none
                      [appearance:textfield]
                      [&::-webkit-outer-spin-button]:appearance-none
                      [&::-webkit-inner-spin-button]:appearance-none"
                                        value={count}
                                        onChange={(e) =>
                                            setCount(Math.max(1, Number(e.target.value || 1)))
                                        }
                                        disabled={!selectedVariant}
                                        aria-label="จำนวนสินค้า"
                                    />
                                    <button
                                        type="button"
                                        className="w-9 h-9 flex items-center justify-center disabled:opacity-50"
                                        onClick={() =>
                                            setCount((c) => Math.min(Number(stock || 1), c + 1))
                                        }
                                        disabled={!selectedVariant || count >= Number(stock || 1)}
                                        aria-label="เพิ่มจำนวน"
                                        title="เพิ่มจำนวน"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    คงเหลือ: {selectedVariant ? stock : "-"}
                                </div>
                            </div>

                            <button
                                onClick={handleAdd}
                                disabled={!canAdd}
                                className={[
                                    "w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2",
                                    "text-sm font-semibold shadow-md transition-all",
                                    canAdd
                                        ? "bg-gray-800 hover:bg-gray-900 text-white"
                                        : "bg-gray-200 text-gray-600 cursor-not-allowed",
                                ].join(" ")}
                                title={
                                    !sizeId
                                        ? "กรุณาเลือกไซซ์"
                                        : !selectedVariant
                                            ? "กรุณาเลือกรุ่น"
                                            : stock <= 0
                                                ? "สินค้าหมด"
                                                : "เพิ่มลงตะกร้า"
                                }
                                aria-label="เพิ่มลงตะกร้า"
                            >
                                <ShoppingBasket size={18} />
                                เพิ่มลงตะกร้า
                            </button>
                        </div>
                    </div>

                    {/* Reviews */}
                    <div className="mt-6 rounded-2xl border bg-white p-4 md:p-6">
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-lg font-semibold">รีวิวสินค้า</div>
                            <div className="text-sm text-gray-500">
                                หน้า {reviewPage}/{totalPages}
                            </div>
                        </div>

                        {reviews.length === 0 ? (
                            <div className="text-gray-500 text-sm">ยังไม่มีรีวิว</div>
                        ) : (
                            <div className="space-y-3">
                                {reviews.map((rv) => {
                                    const sizeName = pickSizeName(rv);
                                    const genName = pickGenerationName(rv);
                                    const hasVariantMeta = !!(sizeName || genName);
                                    return (
                                        <div key={rv.id} className="p-3 rounded-xl border bg-gray-50">
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm font-medium text-gray-800">
                                                    {rv.userName || "ผู้ใช้"}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {new Date(rv.createdAt).toLocaleDateString("th-TH", {
                                                        dateStyle: "medium",
                                                    })}
                                                </div>
                                            </div>

                                            <div className="mt-1 flex items-center gap-2">
                                                <div className="flex items-center">
                                                    {[1, 2, 3, 4, 5].map((n) => (
                                                        <Star
                                                            key={n}
                                                            size={16}
                                                            className={
                                                                (rv.rating || 0) >= n
                                                                    ? "fill-yellow-300 stroke-yellow-300"
                                                                    : "stroke-gray-300"
                                                            }
                                                        />
                                                    ))}
                                                </div>
                                                {hasVariantMeta && (
                                                    <div className="text-xs text-gray-600">
                                                        {sizeName ? `ไซซ์: ${sizeName}` : null}
                                                        {sizeName && genName ? " • " : ""}
                                                        {genName ? `รุ่น: ${genName}` : null}
                                                    </div>
                                                )}
                                            </div>

                                            {rv.text && (
                                                <div className="text-sm text-gray-700 mt-1 whitespace-pre-line">
                                                    {rv.text}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {totalPages > 1 && (
                            <div className="flex items-center justify-end gap-2 mt-4">
                                <button
                                    onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
                                    disabled={reviewPage <= 1}
                                    className="px-3 py-1.5 rounded-lg border bg-white disabled:opacity-50 hover:border-gray-300"
                                >
                                    ก่อนหน้า
                                </button>
                                <button
                                    onClick={() => setReviewPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={reviewPage >= totalPages}
                                    className="px-3 py-1.5 rounded-lg border bg-white disabled:opacity-50 hover:border-gray-300"
                                >
                                    ถัดไป
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
