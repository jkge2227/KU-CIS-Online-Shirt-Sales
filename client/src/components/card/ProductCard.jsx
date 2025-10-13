// client/src/components/card/ProductCard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ShoppingBasket, Minus, Plus, Check, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import useEcomStore from "../../store/ecom-store";
import { createUserCart } from "../../api/users";
import ProductRating from "../product/ProductRating";

const makeKey = (productId, variantId) => `${productId}::${variantId}`;

// ปุ่มชิปสวยๆ ใช้ซ้ำ
function Chip({ active, disabled, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "px-3 py-1.5 rounded-xl text-sm border transition-all",
        "focus:outline-none focus:ring-2 focus:ring-black/15",
        disabled
          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
          : active
            ? "bg-black text-white border-black shadow-sm"
            : "bg-white text-gray-700 border-gray-300 hover:border-gray-400",
      ].join(" ")}
    >
      <span className="inline-flex items-center gap-1">
        {active && <Check size={14} />}
        {children}
      </span>
    </button>
  );
}

const ProductCard = ({ item }) => {
  const navigate = useNavigate();

  const actionAddtoCart = useEcomStore((s) => s.actionAddtoCart);
  const carts = useEcomStore((s) => s.carts);
  const token = useEcomStore((s) => s.token);
  const users = useEcomStore((s) => s.users);

  const [sizeId, setSizeId] = useState("");
  const [generationId, setGenerationId] = useState("");
  const [count, setCount] = useState(1);
  const [saving, setSaving] = useState(false);

  // ----- Helpers -----
  const pickFirstAvailableVariant = (variants = []) => {
    // เลือกตัวที่มีสต็อกก่อน ถ้าไม่มีเลยเอาตัวแรก
    return (
      variants.find((v) => (v.quantity ?? 0) > 0) ??
      (variants.length ? variants[0] : null)
    );
  };

  // ----- Options -----
  const sizeOptions = useMemo(() => {
    const map = new Map();
    (item.variants || []).forEach((v) => {
      if (v.size) map.set(v.size.id, v.size.name);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [item?.variants]);

  const generationOptions = useMemo(() => {
    if (!sizeId) return [];
    const list = (item.variants || [])
      .filter((v) => v.sizeId === Number(sizeId))
      .map((v) =>
        v.generation
          ? { id: v.generation.id, name: v.generation.name }
          : { id: null, name: "ไม่มีรุ่น" }
      );
    const uniq = new Map();
    list.forEach((g) => uniq.set(g.id, g.name));
    return Array.from(uniq, ([id, name]) => ({ id, name }));
  }, [item?.variants, sizeId]);

  // ----- Auto select: ครั้งแรก / เมื่อข้อมูลเปลี่ยน -----
  // 1) ครั้งแรก: auto เลือก size+generation จาก variant ที่มีสต็อกก่อน
  useEffect(() => {
    if (!item?.variants?.length) return;
    if (sizeId) return; // ผู้ใช้เลือกไปแล้ว ไม่ override

    const first = pickFirstAvailableVariant(item.variants);
    if (!first) return;

    setSizeId(String(first.sizeId));
    setGenerationId(first.generationId ? String(first.generationId) : "");
  }, [item?.variants]); // ทำเมื่อรายการ variant เปลี่ยน

  // 2) เมื่อเปลี่ยนไซซ์ ให้เลือกรุ่นที่ "มีสต็อก" ของไซซ์นั้นให้อัตโนมัติ
  useEffect(() => {
    if (!sizeId) return;

    // หา variant ที่ตรงกับไซซ์นี้และมีสต็อกก่อน
    const candidates = (item.variants || []).filter(
      (v) => v.sizeId === Number(sizeId)
    );
    if (!candidates.length) {
      setGenerationId("");
      return;
    }

    // ถ้า generation ตอนนี้ยังว่าง หรือไม่มีในตัวเลือกของไซซ์นี้ ให้จัดให้ใหม่
    const currentGenId = generationId === "" ? null : Number(generationId);
    const stillValid = candidates.some(
      (v) => (v.generationId ?? null) === currentGenId
    );
    if (!stillValid) {
      const picked = pickFirstAvailableVariant(candidates);
      setGenerationId(picked?.generationId ? String(picked.generationId) : "");
    }
  }, [sizeId, item?.variants]); // เปลี่ยนไซซ์หรือข้อมูล

  // 3) ถ้าไซซ์เดียวและรุ่นเดียวอยู่แล้ว จะตั้งค่าให้เอง (ตัวนี้ยังช่วยกรณีไม่มีสต็อกด้วย)
  useEffect(() => {
    if (!sizeId) {
      setGenerationId("");
      return;
    }
    if (generationOptions.length === 1) {
      const only = generationOptions[0];
      setGenerationId(only.id === null ? "" : String(only.id));
    }
  }, [sizeId, generationOptions]);

  const selectedVariant = useMemo(() => {
    if (!sizeId) return null;
    const genId = generationId === "" ? null : Number(generationId);
    return (
      (item.variants || []).find(
        (v) => v.sizeId === Number(sizeId) && (v.generationId ?? null) === genId
      ) ?? null
    );
  }, [item?.variants, sizeId, generationId]);

  const selectedStock = selectedVariant?.quantity ?? null;
  const canAdd =
    Boolean(selectedVariant) && (selectedStock ?? 0) > 0 && count > 0 && !saving;

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
      const nextCount = Math.max(
        1,
        Number(prev.count || 0) + Number(count || 0)
      );
      updated[idx] = {
        ...prev,
        count:
          maxStock != null ? Math.min(nextCount, Number(maxStock)) : nextCount,
        ...(maxStock != null ? { maxStock: Number(maxStock) } : {}),
      };
      return updated;
    } else {
      const initCount = Math.max(1, Number(count || 1));
      const newItem = {
        key,
        productId,
        variantId,
        count:
          maxStock != null
            ? Math.min(initCount, Number(maxStock))
            : initCount,
        price,
        productTitle,
        sizeName,
        generationName,
        image,
        ...(maxStock != null ? { maxStock: Number(maxStock) } : {}),
      };
      return [...currentCarts, newItem];
    }
  };

  const handleAdd = async () => {
    if (!canAdd) return;

    const payload = {
      productId: item.id,
      variantId: selectedVariant.id,
      count,
      productTitle: item.title,
      price: item.price, // ราคาเดียวทุก size
      sizeName: selectedVariant.size?.name,
      generationName: selectedVariant.generation?.name ?? null,
      image: item.images?.[0]?.url || null,
      maxStock: selectedVariant.quantity,
    };

    // เพิ่มลง store ก่อน (ลื่นไหล)
    actionAddtoCart(payload);

    // ถ้าไม่ล็อกอิน แค่แจ้งเตือนพอ
    if (!token || !users) {
      toast.info("เพิ่มลงตะกร้าแล้ว (ยังไม่บันทึกเพราะยังไม่ได้เข้าสู่ระบบ)");
      return;
    }

    // ล็อกอินแล้ว บันทึกขึ้นเซิร์ฟเวอร์
    try {
      setSaving(true);
      const nextCarts = buildNextCarts(carts, payload);
      await createUserCart(token, { cart: nextCarts });
      toast.success("บันทึกตะกร้าบนเซิร์ฟเวอร์เรียบร้อย");
    } catch (e) {
      console.error(e);
      toast.error("บันทึกตะกร้าไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const minusDisabled = !selectedVariant || saving || count <= 1;
  const plusDisabled =
    !selectedVariant ||
    saving ||
    (selectedStock != null && count >= selectedStock);

  return (
    <div
      className="
        w-full max-w-sm h-full
        border border-gray-200 rounded-2xl bg-white
        flex flex-col overflow-hidden
        shadow-sm hover:shadow-xl hover:-translate-y-1
        transition-all duration-300
      "
    >
      {/* Image */}
      <div
        onClick={() => navigate(`/product/${item.id}`)}
        className="relative cursor-pointer"
      >
        <div className="aspect-[4/3] w-full bg-gray-50 flex items-center justify-center">
          {item.images?.length ? (
            <img
              src={item.images[0].url}
              alt={item.title}
              className="h-full w-full object-contain transition-transform duration-500 hover:scale-105"
            />
          ) : (
            <div className="text-gray-400 text-sm">No Image</div>
          )}
        </div>

        {/* ราคา */}
        <div className="absolute left-3 top-3 rounded-full bg-white/95 border px-3 py-1 text-sm font-semibold shadow-sm">
          {item.price}฿
        </div>

        {/* สต็อก */}
        {selectedVariant && (selectedStock ?? 0) <= 0 && (
          <div className="absolute right-3 top-3 rounded-full bg-red-50 text-red-600 border border-red-200 px-3 py-1 text-xs font-medium shadow-sm">
            หมดสต็อก
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="space-y-1">
          <p className="text-base font-semibold text-gray-900 line-clamp-1">
            {item.title}
          </p>
          <p className="text-sm text-gray-500 line-clamp-2">
            {item.description}
          </p>
        </div>
        {/* ⭐ รีวิว */}
        <div className="pt-1">
          <ProductRating productId={item.id} />
        </div>

        {/* Size */}
        <div className="mt-3">
          <div className="text-xs text-gray-500 mb-2">เลือก Size</div>
          <div className="flex flex-wrap gap-2">
            {sizeOptions.length ? (
              sizeOptions.map((s) => (
                <Chip
                  key={s.id}
                  active={String(s.id) === String(sizeId)}
                  onClick={() => {
                    setSizeId(String(s.id));
                    // generation จะถูก auto เลือกใหม่ใน useEffect ด้านบน
                  }}
                >
                  {s.name}
                </Chip>
              ))
            ) : (
              <span className="text-sm text-gray-400">ไม่มีตัวเลือก</span>
            )}
          </div>
        </div>

        {/* Generation */}
        {sizeId && (
          <div className="mt-3">
            <div className="text-xs text-gray-500 mb-2">เลือกรุ่น</div>
            <div className="flex flex-wrap gap-2">
              {generationOptions.map((g) => (
                <Chip
                  key={String(g.id)}
                  active={String(g.id ?? "") === String(generationId)}
                  onClick={() =>
                    setGenerationId(g.id === null ? "" : String(g.id))
                  }
                >
                  {g.name}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* จำนวน + สต็อก */}
        <div className="mt-4 flex items-center justify-between">
          <div className="inline-flex items-center border rounded-xl overflow-hidden">
            <button
              type="button"
              className="p-2 disabled:opacity-40"
              onClick={() => setCount((c) => Math.max(1, c - 1))}
              disabled={minusDisabled}
              title={minusDisabled ? "ต่ำสุดคือ 1" : "ลดจำนวน"}
            >
              <Minus size={16} />
            </button>
            <input
              type="number"
              min="1"
              className="w-16 text-center outline-none border-x p-2"
              value={count}
              onChange={(e) =>
                setCount(Math.max(1, Number(e.target.value || 1)))
              }
              disabled={!selectedVariant || saving}
            />
            <button
              type="button"
              className="p-2 disabled:opacity-40"
              onClick={() =>
                setCount((c) =>
                  Math.min(selectedStock ?? Number.MAX_SAFE_INTEGER, c + 1)
                )
              }
              disabled={plusDisabled}
              title={plusDisabled ? "ถึงสต็อกแล้ว" : "เพิ่มจำนวน"}
            >
              <Plus size={16} />
            </button>
          </div>

          <span className="text-sm text-gray-500">
            สต็อก: {selectedVariant ? selectedStock : "-"}
          </span>
        </div>

        {/* ปุ่มเพิ่มลงตะกร้า */}
        <div className="mt-4">
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className={[
              "w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5",
              "text-sm font-semibold shadow-md transition-all",
              canAdd
                ? "bg-black text-white hover:bg-gray-900 hover:shadow-lg"
                : "bg-gray-200 text-gray-600 cursor-not-allowed",
            ].join(" ")}
            title={
              !sizeId
                ? "กรุณาเลือก Size"
                : !selectedVariant
                  ? "เลือกรุ่นให้ครบ"
                  : (selectedStock ?? 0) <= 0
                    ? "สินค้าหมด"
                    : "เพิ่มลงตะกร้า"
            }
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <ShoppingBasket size={16} />
                เพิ่มลงตะกร้า
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
