import React, { useMemo, useState, useEffect } from "react";
import { Trash2, CircleMinus, CirclePlus, Settings2, X } from "lucide-react";
import useEcomStore from "../../store/ecom-store";
import { Link, useNavigate } from "react-router-dom";
import { createUserCart, saveOrder } from "../../api/users";
import axios from "axios";

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

  const getTotalPrice = useEcomStore((s) => s.getTotalPrice);
  const navigate = useNavigate();

  // ---------- SUMMARY ----------
  const totalPrice = useMemo(() => getTotalPrice(), [carts]);
  const totalCount = useMemo(
    () => carts.reduce((sum, i) => sum + (Number(i.count) || 0), 0),
    [carts]
  );

  // ---------- EDIT VARIANT MODAL ----------
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [variants, setVariants] = useState([]);
  const [sizeSel, setSizeSel] = useState("");
  const [genSel, setGenSel] = useState("");

  // เฉพาะ variants ที่สต็อก > 0
  const availableVariants = useMemo(
    () => variants.filter((v) => Number(v.quantity) > 0),
    [variants]
  );

  // รายการ size ที่มี (จาก availableVariants)
  const sizeOptions = useMemo(() => {
    const set = new Set(
      availableVariants.map((v) => v.size?.name || "-")
    );
    return Array.from(set);
  }, [availableVariants]);

  // รายการ generation ที่มี สำหรับ sizeSel ที่เลือกอยู่
  const genOptions = useMemo(() => {
    const set = new Set(
      availableVariants
        .filter((v) => (v.size?.name || "-") === (sizeSel || "-"))
        .map((v) => v.generation?.name || "-")
    );
    return Array.from(set);
  }, [availableVariants, sizeSel]);

  // ตัวเลือกที่ match กับ (sizeSel, genSel)
  const selectedVariant = useMemo(() => {
    return availableVariants.find(
      (v) =>
        (v.size?.name || "-") === (sizeSel || "-") &&
        (v.generation?.name || "-") === (genSel || "-")
    );
  }, [availableVariants, sizeSel, genSel]);

  // เมื่อเปิด modal: โหลด variants + ตั้งค่า default ให้ตรง item หรือค่าสมเหตุสมผล
  const openEdit = async (item) => {
    try {
      const res = await axios.get(`${API}/products/${item.productId}/variants`);
      const list = Array.isArray(res.data) ? res.data : res.data?.variants ?? [];
      setVariants(list);
      setEditingItem(item);
      // ตั้งค่าเบื้องต้น: ถ้า size เดิมยังมีและมีสต็อก → ใช้, ไม่งั้นใช้ตัวแรกจาก sizeOptions (หลัง setVariants มีผล)
      // ค่าเริ่มต้นจะ finalize ใน useEffect ด้านล่างหลัง variants ถูก set แล้ว
      setSizeSel(item.sizeName || "");
      setGenSel(item.generationName || "");
      setEditOpen(true);
    } catch (e) {
      console.error("โหลด variants ไม่ได้", e);
    }
  };

  // หลัง variants หรือ editingItem เปลี่ยน → ทำให้ sizeSel/genSel เป็นค่าที่ "มีจริง"
  useEffect(() => {
    if (!editOpen) return;

    // ถ้า sizeSel เดิมไม่มีใน sizeOptions → เลือกตัวแรก
    if (!sizeSel || !sizeOptions.includes(sizeSel)) {
      setSizeSel(sizeOptions[0] || "-");
      return; // ให้รอบถัดไปค่อยเช็ค genSel หลัง sizeSel ใหม่ถูก set
    }

    // ถ้า genSel เดิมไม่มีใน genOptions ของ sizeSel → เลือกตัวแรก
    if (!genSel || !genOptions.includes(genSel)) {
      setGenSel(genOptions[0] || "-");
    }
  }, [editOpen, sizeOptions, genOptions, sizeSel, genSel]);

  const saveEditVariant = () => {
    if (!editingItem) return;
    if (!selectedVariant) {
      // ไม่มีคู่ที่แมตช์ (เช่นสต็อกหมด) — ไม่ให้บันทึก
      return;
    }

    const match = selectedVariant;
    const newCount = Math.min(Number(editingItem.count || 1), Number(match.quantity || 0));
    const newLine = {
      key: `${editingItem.productId}-${match.id}`,
      productId: editingItem.productId,
      variantId: match.id,
      productTitle: editingItem.productTitle ?? match.product?.title ?? "",
      sizeName: match.size?.name || "-",
      generationName: match.generation?.name || "-",
      image: editingItem.image ?? match.product?.images?.[0]?.url ?? null,
      price: Number(match.price ?? editingItem.price ?? 0),
      count: Math.min(Number(editingItem.count ?? 1), Number(match.quantity ?? Infinity)),
      maxStock: Number(match.quantity ?? Infinity),
    };

    actionChangeVariant(editingItem.productId, editingItem.variantId, newLine);
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
      await createUserCart(token, { cart: carts });
      await saveOrder(token);
      actionAllRemoveProduct();
      setConfirmOpen(false);
      navigate("/Order");
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 p-4">
      {/* ซ้าย: รายการสินค้า */}
      <div className="md:col-span-2 space-y-4">
        {carts.length === 0 ? (
          <div>
            {(!token || !users) && (
              <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg">
                โปรดเข้าสู่ระบบเพื่อดูคำสั่งซื้อของคุณ
              </div>
            )}  
            <div className="bg-white p-6 rounded-xl border text-gray-500">
              ยังไม่มีสินค้าในตะกร้า
            </div>
          </div>
        ) : (
          carts.map((item) => {
            const unitPrice = Number(item.price || 0);
            const count = Number(item.count || 0);
            const lineTotal = unitPrice * count;

            const maxStock =
              item.maxStock != null
                ? Number(item.maxStock)
                : Number.POSITIVE_INFINITY;

            const decDisabled = count <= 1;
            const incDisabled = Number.isFinite(maxStock) ? count >= maxStock : false;
            return (
              <div

                key={item.key}
                className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border"
              >
                {/* Left: Image + Info */}
                <div className="flex items-center gap-4">
                  {item.image ? (
                    <img
                      className="w-24 h-24 bg-gray-100 rounded-lg object-cover border"
                      src={item.image}
                      alt={item.productTitle}
                    />
                  ) : (
                    <div className="w-24 h-24 bg-gray-100 rounded-lg flex justify-center items-center text-gray-400 text-sm">
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

                    <p className="font-bold text-gray-700 mt-1">
                      {lineTotal.toLocaleString()} บาท
                    </p>

                    {Number.isFinite(maxStock) && (
                      <p className="text-sm text-red-500">
                        สต็อกคงเหลือ: {maxStock} ตัว
                      </p>
                    )}

                    {/* ปุ่มแก้ไซส์/รุ่น */}
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

                {/* Right: Quantity + Remove */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {/* ลดจำนวน */}
                    <button
                      onClick={() => {
                        const next = Math.max(1, count - 1);
                        if (next !== count) {
                          actionUpdateQuantity(item.productId, item.variantId, next);
                        }
                      }}
                      disabled={decDisabled}
                      className={`w-8 h-8 rounded-full flex items-center justify-center border transition ${decDisabled
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-white hover:bg-red-500 hover:text-white"
                        }`}
                      title="ลดจำนวน"
                    >
                      <CircleMinus />
                    </button>

                    {/* จำนวน */}
                    <span className="px-2 text-black font-medium">{count}</span>

                    {/* เพิ่มจำนวน */}
                    <button
                      onClick={() => {
                        const next = count + 1;
                        if (!incDisabled) {
                          actionUpdateQuantity(item.productId, item.variantId, next);
                        }
                      }}
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

                  {/* ลบรายการ */}
                  <button
                    onClick={() => actionRemoveProduct(item.productId, item.variantId)}
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

      {/* ขวา: Summary */}
      <div className="bg-white border rounded-xl shadow-sm p-4 h-fit">
        {/* ข้อมูลผู้ใช้ */}
        {users ? (
          <div className="mb-3">
            <p>เบอร์โทรศัพท์ : {users?.phone ?? "-"}</p>
            <p>เลขบัตรประจำตัวประชาชน : {users?.id_card ?? "-"}</p>
          </div>
        ) : (
          <div className="mb-3 text-sm text-gray-600">
            <p>กรุณาเข้าสู่ระบบเพื่อดูข้อมูลผู้ใช้</p>
          </div>
        )}

        <div className="border border-red-300 text-red-600 text-sm rounded-md p-3 mb-4">
          <strong>!!! คำเตือน !!!</strong>
          <p>หากไม่มารับสินค้าภายใน 3 วัน ระบบจะทำการยกเลิกคำสั่งซื้อ</p>
        </div>

        <div className="flex justify-between text-sm mb-1 text-gray-700">
          <span>จำนวนทั้งหมด</span>
          <span className="text-gray-700">{totalCount.toLocaleString()} ตัว</span>
        </div>

        <div className="flex justify-between text-lg font-semibold mb-4 text-gray-700">
          <span>ราคารวม</span>
          <span className="text-gray-700">
            {totalPrice.toLocaleString()} บาท
          </span>
        </div>

        {users ? (
          <button
            onClick={() => setConfirmOpen(true)}
            className="w-full bg-gray-800 text-white py-2 rounded-lg mb-2 hover:bg-gray-900 transition"
          >
            สั่งซื้อ
          </button>
        ) : (
          <Link to={"/login"}>
            <button className="w-full bg-gray-800 text-white py-2 rounded-lg mb-2 hover:bg-gray-900 transition">
              เข้าสู่ระบบ
            </button>
          </Link>
        )}

        <button
          onClick={actionAllRemoveProduct}
          className="w-full bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition"
        >
          ล้างตะกร้าสินค้า
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
              className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
            >
              ยกเลิก
            </button>
            <button
              onClick={saveEditVariant}
              className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-60"
              disabled={!selectedVariant}
            >
              บันทึก
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1">ขนาด (Size)</label>
            <select
              className="w-full border rounded-lg p-2"
              value={sizeSel}
              onChange={(e) => setSizeSel(e.target.value)}
            >
              {sizeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">รุ่น (Generation)</label>
            <select
              className="w-full border rounded-lg p-2"
              value={genSel}
              onChange={(e) => setGenSel(e.target.value)}
            >
              {genOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* แสดงสต็อกของคู่ที่เลือก (ถ้า match) */}
          {selectedVariant && (
            <div className="text-sm text-gray-600">
              สต็อกคงเหลือของตัวเลือกนี้:{" "}
              <b className="text-gray-900">{selectedVariant.quantity}</b> ตัว
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
              className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white"
              disabled={submitting}
            >
              ยกเลิก
            </button>
            <button
              onClick={doSubmitOrder}
              className="px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? "กำลังดำเนินการ..." : "ยืนยันสั่งซื้อ"}
            </button>
          </>
        }
      >
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>จำนวนทั้งหมด</span>
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
