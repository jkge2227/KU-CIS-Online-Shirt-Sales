import React, { useMemo, useState, useEffect } from "react";
import {
  Trash2,
  CircleMinus,
  CirclePlus,
  Settings2,
  X,
  ShoppingBag,
  Info,
} from "lucide-react";
import useEcomStore from "../../store/ecom-store";
import { Link, useNavigate } from "react-router-dom";
import { createUserCart, saveOrder, emptyCart } from "../../api/users";
import axios from "axios";
import { toast } from "react-toastify";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:5001/api";

const Modal = ({ open, onClose, title, children, footer }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
          <div className="px-5 py-3 border-t bg-gray-50 rounded-b-2xl flex gap-2 justify-end">
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
};

const CartCard = () => {
  const carts = useEcomStore((s) => s.carts) || [];
  const users = useEcomStore((s) => s.users) || null;
  const token = useEcomStore((s) => s.token) || null;

  const actionUpdateQuantity = useEcomStore((s) => s.actionUpdateQuantity);
  const actionRemoveProduct = useEcomStore((s) => s.actionRemoveProduct);
  const actionAllRemoveProduct = useEcomStore((s) => s.actionAllRemoveProduct);
  const actionChangeVariant =
    useEcomStore((s) => s.actionChangeVariant) ||
    ((productId, oldVariantId, newLine) => {
      console.warn("⚠️ actionChangeVariant missing in store. Implement it.");
    });

  const navigate = useNavigate();

  // ---------- SELECTION ----------
  const [selectedKeys, setSelectedKeys] = useState(new Set());

  useEffect(() => {
    const existing = new Set(selectedKeys);
    const keysInCart = new Set(carts.map((i) => i.key));
    const next = new Set([...existing].filter((k) => keysInCart.has(k)));
    if (next.size === 0 && carts.length > 0) {
      carts.forEach((i) => next.add(i.key));
    }
    setSelectedKeys(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carts.map((i) => i.key).join("|")]);

  const toggleOne = (key) => {
    setSelectedKeys((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const selectAll = () => setSelectedKeys(new Set(carts.map((i) => i.key)));
  const clearSelection = () => setSelectedKeys(new Set());

  // ---------- helper: sync cart ไป server ----------
  const syncCartToServer = async (nextCart) => {
    if (!token) return;
    try {
      // 🔴 จุดสำคัญ: ถ้าหลังลบแล้วเหลือ 0 ชิ้น ให้เรียก emptyCart
      if (!nextCart || nextCart.length === 0) {
        await emptyCart(token);
      } else {
        await createUserCart(token, { cart: nextCart });
      }
    } catch (err) {
      console.error("sync cart failed", err);
    }
  };

  // ---------- ลบรายการที่เลือก ----------
  const removeSelected = async () => {
    if (selectedKeys.size === 0) return;

    const nextCart = carts.filter((i) => !selectedKeys.has(i.key));

    // ลบใน local ก่อน
    carts.forEach((i) => {
      if (selectedKeys.has(i.key)) {
        actionRemoveProduct(i.productId, i.variantId);
      }
    });

    // sync ไป server (จะเลือก emptyCart ให้ถ้าตะกร้าว่าง)
    await syncCartToServer(nextCart);

    // เคลียร์ selection
    setSelectedKeys(new Set());
  };

  const selectedItems = useMemo(
    () => carts.filter((i) => selectedKeys.has(i.key)),
    [carts, selectedKeys]
  );

  // ---------- SUMMARY ----------
  const totalCount = useMemo(
    () => selectedItems.reduce((sum, i) => sum + (Number(i.count) || 0), 0),
    [selectedItems]
  );

  const totalPrice = useMemo(
    () =>
      selectedItems.reduce(
        (sum, i) => sum + (Number(i.price || 0) * Number(i.count || 0)),
        0
      ),
    [selectedItems]
  );

  // ---------- EDIT VARIANT MODAL ----------
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [variants, setVariants] = useState([]);
  const [sizeSel, setSizeSel] = useState("");
  const [genSel, setGenSel] = useState("");

  const availableVariants = useMemo(
    () => variants.filter((v) => Number(v.quantity) > 0),
    [variants]
  );

  const sizeOptions = useMemo(() => {
    const set = new Set(availableVariants.map((v) => v.size?.name || "-"));
    return Array.from(set);
  }, [availableVariants]);

  const genOptions = useMemo(() => {
    const set = new Set(
      availableVariants
        .filter((v) => (v.size?.name || "-") === (sizeSel || "-"))
        .map((v) => v.generation?.name || "-")
    );
    return Array.from(set);
  }, [availableVariants, sizeSel]);

  const selectedVariant = useMemo(() => {
    return availableVariants.find(
      (v) =>
        (v.size?.name || "-") === (sizeSel || "-") &&
        (v.generation?.name || "-") === (genSel || "-")
    );
  }, [availableVariants, sizeSel, genSel]);

  const openEdit = async (item) => {
    try {
      const res = await axios.get(`${API}/products/${item.productId}/variants`);
      const list = Array.isArray(res.data) ? res.data : res.data?.variants ?? [];
      setVariants(list);
      setEditingItem(item);
      setSizeSel(item.sizeName || "");
      setGenSel(item.generationName || "");
      setEditOpen(true);
    } catch (e) {
      console.error("โหลด variants ไม่ได้", e);
    }
  };

  const digitsOnly = (v) => String(v ?? "").replace(/\D/g, "");

  const formatThaiIdCard = (value, { mask = false, visible = 7 } = {}) => {
    const pattern = [1, 4, 5, 2, 1];
    const raw = digitsOnly(value).slice(0, 13);
    const masked = (() => {
      if (!mask) return raw;
      const keep = raw.slice(0, visible);
      const rest = raw.length - visible;
      return keep + (rest > 0 ? "X".repeat(rest) : "");
    })();
    let i = 0;
    const groups = [];
    for (const len of pattern) {
      if (i >= masked.length) break;
      groups.push(masked.slice(i, i + len));
      i += len;
    }
    return groups.filter(Boolean).join("-");
  };

  const formatThaiPhone = (value, { mask = false, visible = 6 } = {}) => {
    const pattern = [3, 3, 4];
    const raw = digitsOnly(value).slice(0, 10);
    const masked = (() => {
      if (!mask) return raw;
      const keep = raw.slice(0, visible);
      const rest = raw.length - visible;
      return keep + (rest > 0 ? "X".repeat(rest) : "");
    })();
    let i = 0;
    const groups = [];
    for (const len of pattern) {
      if (i >= masked.length) break;
      groups.push(masked.slice(i, i + len));
      i += len;
    }
    return groups.filter(Boolean).join("-");
  };

  useEffect(() => {
    if (!editOpen) return;
    if (!sizeSel || !sizeOptions.includes(sizeSel)) {
      setSizeSel(sizeOptions[0] || "-");
      return;
    }
    if (!genSel || !genOptions.includes(genSel)) {
      setGenSel(genOptions[0] || "-");
    }
  }, [editOpen, sizeOptions, genOptions, sizeSel, genSel]);

  const saveEditVariant = async () => {
    if (!editingItem || !selectedVariant) return;
    const match = selectedVariant;
    const newLine = {
      key: `${editingItem.productId}-${match.id}`,
      productId: editingItem.productId,
      variantId: match.id,
      productTitle: editingItem.productTitle ?? match.product?.title ?? "",
      sizeName: match.size?.name || "-",
      generationName: match.generation?.name || "-",
      image: editingItem.image ?? match.product?.images?.[0]?.url ?? null,
      price: Number(match.price ?? editingItem.price ?? 0),
      count: Math.min(
        Number(editingItem.count ?? 1),
        Number(match.quantity ?? Infinity)
      ),
      maxStock: Number(match.quantity ?? Infinity),
    };
    // local
    actionChangeVariant(editingItem.productId, editingItem.variantId, newLine);

    // sync
    const nextCart = carts.map((c) => {
      if (
        c.productId === editingItem.productId &&
        c.variantId === editingItem.variantId
      ) {
        return newLine;
      }
      return c;
    });
    await syncCartToServer(nextCart);

    setEditOpen(false);
    setEditingItem(null);
  };

  // ---------- CONFIRM ORDER MODAL ----------
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const doSubmitOrder = async () => {
    if (!users || !token) {
      setConfirmOpen(false);
      return;
    }

    try {
      setSubmitting(true);

      // sync เฉพาะที่เลือก
      await createUserCart(token, { cart: selectedItems });
      await saveOrder(token);

      // ลบเฉพาะที่เลือกใน local
      selectedItems.forEach((i) => actionRemoveProduct(i.productId, i.variantId));

      setConfirmOpen(false);
      navigate("/Order");
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || "ดำเนินการสั่งซื้อไม่สำเร็จ";

      if (status === 403) {
        toast.error(msg);
      } else if (status === 401) {
        toast.error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- HANDLE CLEAR ALL ----------
  const handleClearAll = async () => {
    actionAllRemoveProduct();
    setSelectedKeys(new Set());
    if (token) {
      try {
        await emptyCart(token);
      } catch (err) {
        console.error("empty cart failed", err);
      }
    }
  };

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border bg-white p-10 text-center">
      <ShoppingBag className="h-10 w-10 text-gray-400" />
      <div className="text-base font-semibold text-gray-800">ยังไม่มีสินค้าในตะกร้า</div>
      <p className="text-sm text-gray-500">
        เมื่อคุณเพิ่มสินค้าลงตะกร้า ระบบจะแสดงรายการสินค้าที่นี่
      </p>
    </div>
  );

  const chipClass = (active) =>
    [
      "px-3 py-1.5 rounded-full border text-sm transition",
      "focus:outline-none focus:ring-2 focus:ring-gray-300",
      active
        ? "bg-gray-900 text-white border-gray-900"
        : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50",
    ].join(" ");

  // ---------- RENDER ----------
  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 p-4 md:p-4">
      {/* ซ้าย */}
      <div className="md:col-span-2 space-y-4">
        <div className="bg-white border rounded-xl p-3 flex flex-wrap items-center gap-2 justify-between">
          <div className="text-sm text-gray-700">
            เลือกแล้ว{" "}
            <span className="font-semibold">
              {selectedItems.length.toLocaleString()}
            </span>{" "}
            จาก {carts.length.toLocaleString()} รายการ
          </div>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="px-3 py-1.5 rounded-lg ring-1 ring-gray-300 hover:bg-gray-50 text-sm"
            >
              เลือกทั้งหมด
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 rounded-lg ring-1 ring-gray-300 hover:bg-gray-50 text-sm"
            >
              ล้างการเลือก
            </button>
            <button
              onClick={removeSelected}
              className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-sm"
              disabled={selectedItems.length === 0}
            >
              ลบรายการที่เลือก
            </button>
          </div>
        </div>

        {carts.length === 0 ? (
          <div>
            {(!token || !users) && (
              <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg">
                โปรดเข้าสู่ระบบเพื่อดูคำสั่งซื้อของคุณ
              </div>
            )}
            <EmptyState />
          </div>
        ) : (
          carts.map((item) => {
            const unitPrice = Number(item.price || 0);
            const count = Number(item.count || 0);
            const maxStock =
              item.maxStock != null
                ? Number(item.maxStock)
                : Number.POSITIVE_INFINITY;
            const decDisabled = count <= 1;
            const incDisabled = Number.isFinite(maxStock)
              ? count >= maxStock
              : false;
            const checked = selectedKeys.has(item.key);

            // ลบทีละชิ้น
            const handleRemoveOne = async () => {
              const nextCart = carts.filter(
                (c) =>
                  !(
                    c.productId === item.productId &&
                    c.variantId === item.variantId
                  )
              );
              actionRemoveProduct(item.productId, item.variantId);
              await syncCartToServer(nextCart);
            };

            // ลดจำนวน
            const handleDecrease = async () => {
              const next = Math.max(1, count - 1);
              if (next === count) return;
              actionUpdateQuantity(item.productId, item.variantId, next);
              const nextCart = carts.map((c) => {
                if (c.key === item.key) {
                  return { ...c, count: next };
                }
                return c;
              });
              await syncCartToServer(nextCart);
            };

            // เพิ่มจำนวน
            const handleIncrease = async () => {
              const next = count + 1;
              if (incDisabled) return;
              actionUpdateQuantity(item.productId, item.variantId, next);
              const nextCart = carts.map((c) => {
                if (c.key === item.key) {
                  return { ...c, count: next };
                }
                return c;
              });
              await syncCartToServer(nextCart);
            };

            return (
              <div
                key={item.key}
                className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border"
              >
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOne(item.key)}
                    className="h-5 w-5 rounded border-gray-300 accent-gray-700 focus:ring-gray-700"
                    aria-label="เลือกสินค้า"
                  />

                  {item.image ? (
                    <img
                      className="w-20 h-20 md:w-24 md:h-24 bg-gray-100 rounded-lg object-cover border"
                      src={item.image}
                      alt={item.productTitle}
                    />
                  ) : (
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-100 rounded-lg flex justify-center items-center text-gray-400 text-sm">
                      no image
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="font-semibold text-gray-800">
                      {item.productTitle}
                    </p>

                    <div className="text-sm text-gray-600">
                      ขนาด: <b>{item.sizeName || "-"}</b>{" "}
                      / รุ่น: <b>{item.generationName || "-"}</b>
                    </div>

                    <div className="text-sm text-gray-600">
                      ราคา:{" "}
                      <span className="font-semibold text-gray-800">
                        {unitPrice.toLocaleString()}
                      </span>{" "}
                      บาท
                    </div>

                    {Number.isFinite(maxStock) && (
                      <p
                        className={`text-xs ${Number(maxStock) < 9
                            ? "text-red-600"
                            : "text-gray-700"
                          }`}
                      >
                        สต็อกคงเหลือ: {maxStock} ตัว
                      </p>
                    )}

                    <button
                      onClick={() => openEdit(item)}
                      className="mt-1 inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md ring-1 ring-gray-300 hover:bg-gray-50"
                      title="แก้ไขไซส์/รุ่น"
                    >
                      <Settings2 size={14} />
                      แก้ไขไซส์/รุ่น
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDecrease}
                      disabled={decDisabled}
                      className={`w-8 h-8 rounded-full flex items-center justify-center border transition ${decDisabled
                          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                          : "bg-white hover:bg-red-500 hover:text-white"
                        }`}
                      title="ลดจำนวน"
                    >
                      <CircleMinus />
                    </button>

                    <span className="px-2 text-black font-medium">{count}</span>

                    <button
                      onClick={handleIncrease}
                      disabled={incDisabled}
                      className={`w-8 h-8 rounded-full flex items-center justify-center border transition ${incDisabled
                          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                          : "bg-white hover:bg-gray-800 hover:text-white"
                        }`}
                      title="เพิ่มจำนวน"
                    >
                      <CirclePlus />
                    </button>
                  </div>

                  <button
                    onClick={handleRemoveOne}
                    className="text-black hover:text-red-500 flex items-center"
                    title="ลบสินค้า"
                  >
                    <Trash2 size={20} className="mr-1" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ขวา */}
      <div className="bg-white border rounded-xl shadow-sm p-4 h-fit md:sticky md:top-4">
        {users ? (
          <div className="mb-3 text-sm">
            <p>
              เบอร์โทรศัพท์ :{" "}
              {users?.phone
                ? formatThaiPhone(users.phone, { mask: false, visible: 6 })
                : "-"}
            </p>
            <p>
              เลขบัตรประชาชน :{" "}
              {users?.id_card
                ? formatThaiIdCard(users.id_card, { mask: true, visible: 7 })
                : "-"}
            </p>
          </div>
        ) : (
          <div className="mb-3 text-sm text-gray-600">
            <p>กรุณาเข้าสู่ระบบเพื่อดูข้อมูลผู้ใช้</p>
          </div>
        )}

        <div className="border border-amber-300 text-amber-800 text-sm rounded-md p-3 mb-4 bg-amber-50">
          <div className="flex items-center gap-2 mb-1">
            <Info className="h-4 w-4 text-amber-600" />
            <strong>เพิ่มเติม</strong>
          </div>
          <p className="text-sm text-amber-800 leading-relaxed">
            โปรดมารับสินค้าภายใน <b>3 วัน</b> นับจากสถานะ
            <span className="font-semibold text-amber-700">
              {" "}
              “ผู้ขายจัดเตรียมสินค้าแล้วรอผู้ซื้อมารับ”{" "}
            </span>
            มิฉะนั้นระบบจะยกเลิกอัตโนมัติ
          </p>
        </div>

        <div className="flex justify-between text-sm mb-1 text-gray-700">
          <span>จำนวน</span>
          <span className="text-gray-900 font-medium">
            {totalCount.toLocaleString()} ตัว
          </span>
        </div>

        <div className="flex justify-between text-lg font-semibold mb-4 text-gray-900">
          <span>ราคารวม</span>
          <span>{totalPrice.toLocaleString()} บาท</span>
        </div>

        {users ? (
          <button
            onClick={() => setConfirmOpen(true)}
            className="w-full bg-gray-800 text-white py-2.5 rounded-lg mb-2 hover:bg-black transition disabled:opacity-700"
            disabled={selectedItems.length === 0}
            title={
              selectedItems.length === 0
                ? "โปรดเลือกสินค้าอย่างน้อย 1 รายการ"
                : "สั่งซื้อ"
            }
          >
            สั่งซื้อ
          </button>
        ) : (
          <Link to={"/login"}>
            <button className="w-full bg-gray-900 text-white py-2.5 rounded-lg mb-2 hover:bg-black transition">
              เข้าสู่ระบบเพื่อสั่งซื้อ
            </button>
          </Link>
        )}

        <button
          onClick={handleClearAll}
          className="w-full bg-red-500 text-white py-2.5 rounded-lg hover:bg-red-600 transition"
        >
          ล้างตะกร้าสินค้าทั้งหมด
        </button>
      </div>

      {/* Modal: แก้ไซส์/รุ่น */}
      <Modal
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditingItem(null);
        }}
        title="แก้ไขไซส์ / รุ่น"
        footer={
          <>
            <button
              onClick={() => {
                setEditOpen(false);
                setEditingItem(null);
              }}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              ยกเลิก
            </button>
            <button
              onClick={saveEditVariant}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black disabled:opacity-60"
              disabled={!selectedVariant}
            >
              บันทึก
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-2 text-gray-700">
              ขนาด (Size)
            </label>
            {sizeOptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {sizeOptions.map((s) => {
                  const active = s === sizeSel;
                  return (
                    <button
                      key={s}
                      type="button"
                      className={chipClass(active)}
                      aria-pressed={active}
                      onClick={() => setSizeSel(s)}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-gray-500">ไม่มีไซส์ที่พร้อมขาย</div>
            )}
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-700">
              รุ่น (Generation)
            </label>
            {genOptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {genOptions.map((g) => {
                  const active = g === genSel;
                  return (
                    <button
                      key={g}
                      type="button"
                      className={chipClass(active)}
                      aria-pressed={active}
                      onClick={() => setGenSel(g)}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                เลือกไซส์ก่อน หรือยังไม่มีรุ่นที่พร้อมขายสำหรับไซส์นี้
              </div>
            )}
          </div>

          {selectedVariant && (
            <div
              className={`text-sm ${Number(selectedVariant.quantity || 0) < 9
                  ? "text-red-600"
                  : "text-gray-700"
                }`}
            >
              สต็อกคงเหลือของตัวเลือกนี้:{" "}
              <b className="font-semibold">
                {Number(selectedVariant.quantity || 0)}
              </b>{" "}
              ตัว
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: ยืนยันสั่งซื้อ */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="ยืนยันการสั่งซื้อ"
        footer={
          <>
            <button
              onClick={() => setConfirmOpen(false)}
              className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
              disabled={submitting}
            >
              ยกเลิก
            </button>
            <button
              onClick={doSubmitOrder}
              className="px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-black disabled:opacity-60"
              disabled={submitting || selectedItems.length === 0}
            >
              {submitting ? "กำลังดำเนินการ..." : "ยืนยันสั่งซื้อ"}
            </button>
          </>
        }
      >
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>จำนวน </span>
            <span>{totalCount.toLocaleString()} ตัว</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>ราคารวม</span>
            <span>{totalPrice.toLocaleString()} บาท</span>
          </div>
          {!users && (
            <div className="mt-2 text-red-600">
              กรุณาเข้าสู่ระบบก่อนทำการสั่งซื้อ
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default CartCard;
