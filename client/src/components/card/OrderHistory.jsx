// client/src/components/card/OrderHistory.jsx
import React, { useEffect, useMemo, useState } from "react";
import useEcomStore from "../../store/ecom-store";
import { listUserOrderHistory } from "../../api/users";
import { toast } from "react-toastify";
import { CheckCircle2, Star, XCircle, Clock, Eye } from "lucide-react";
import { createOrderReviews, getMyOrderReviews } from "../../api/review";

// ---------- Helpers ----------
const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmtMoney = (n) => toNum(n).toLocaleString("th-TH");
const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "-";
const makeKey = (orderId, variantId) => `${orderId}::${variantId}`;

// แยกสถานะ
const isOrderCompleted = (status = "") =>
  ["คำสั่งซื้อสำเร็จ", "รับออเดอร์เสร็จสิ้น"].includes(String(status).trim());

const isOrderCanceled = (status = "") =>
  ["ยกเลิก", "ยกเลิกคำสั่งซื้อ"].includes(String(status).trim());

const getStatusMeta = (status = "") => {
  const s = String(status).trim();
  if (isOrderCompleted(s)) {
    return {
      text: "คำสั่งซื้อสำเร็จ",
      cls: "bg-green-50 text-green-700 ring-green-200",
      Icon: CheckCircle2,
    };
  }
  if (isOrderCanceled(s)) {
    return {
      text: "คำสั่งซื้อถูกยกเลิก",
      cls: "bg-red-50 text-red-700 ring-red-200",
      Icon: XCircle,
    };
  }
  return {
    text: s || "กำลังดำเนินการ",
    cls: "bg-amber-50 text-amber-800 ring-amber-200",
    Icon: Clock,
  };
};

// ---------- UI bits ----------
const StatusPill = ({ status }) => {
  const { text, cls, Icon } = getStatusMeta(status);
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ring-1 ${cls}`}>
      <Icon size={14} /> {text}
    </span>
  );
};

const RATING_LABEL = [null, "ปรับปรุง", "พอใช้", "ปานกลาง", "ดี", "ดีมาก"];
const StarRating = ({ value = 0, onChange }) => {
  const [hover, setHover] = useState(0);
  const show = hover || value;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="p-1"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange?.({ rating: n })}
          aria-label={`ให้ ${n} ดาว`}
        >
          <Star size={24} className={show >= n ? "fill-yellow-300 stroke-yellow-300" : "stroke-gray-300"} />
        </button>
      ))}
      <span className="ml-2 text-sm text-gray-600">{show ? RATING_LABEL[show] : "เลือกคะแนน"}</span>
    </div>
  );
};

const ReadOnlyStars = ({ rating = 0, size = 14, showLabel = false }) => (
  <div className="flex items-center gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} size={size} className={n <= rating ? "fill-yellow-300 stroke-yellow-300" : "stroke-gray-300"} />
    ))}
    {showLabel && <span className="text-[11px] text-yellow-400 ml-1">{RATING_LABEL[rating] || ""}</span>}
  </div>
);

// Controlled modal — สำหรับรีวิว “รายสินค้า”
const ReviewModal = ({ open, rating, text, lineInfo, isEditing, onChange, onClose, onSubmit }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="p-5 border-b">
          <div className="text-lg font-semibold tracking-tight">{isEditing ? "แก้ไขรีวิวสินค้า" : "ให้คะแนนสินค้า"}</div>
          <div className="text-sm text-gray-500 mt-1">
            {lineInfo?.title || "-"} {lineInfo?.sizeName ? `• ไซซ์ ${lineInfo.sizeName}` : ""}{" "}
            {lineInfo?.generationName ? `• รุ่น ${lineInfo.generationName}` : ""}
          </div>
        </div>
        <div className="p-5 space-y-4">
          <StarRating value={rating} onChange={onChange} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">รีวิว (ไม่บังคับ)</label>
            <textarea
              value={text}
              onChange={(e) => onChange?.({ text: e.target.value.slice(0, 500) })}
              rows={4}
              placeholder="บอกเล่าประสบการณ์ของคุณ…"
              className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="mt-1 text-xs text-gray-400">เหลือ {500 - (text?.length || 0)} อักขระ (สูงสุด 500)</div>
          </div>
        </div>
        <div className="p-5 flex items-center justify-end gap-2 border-t">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-white bg-red-400 hover:bg-red-500">
            ยกเลิก
          </button>
          <button
            onClick={onSubmit}
            disabled={!rating}
            className={`px-4 py-2 rounded-lg text-white ${!rating ? "bg-blue-300 cursor-not-allowed" : "bg-gray-700 hover:bg-gray-800"
              }`}
          >
            {isEditing ? "อัปเดตรีวิว" : "ส่งรีวิว"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------- Main ----------
const OrderHistory = () => {
  const token = useEcomStore((s) => s.token);
  const users = useEcomStore((s) => s.users);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // modal state สำหรับ “สินค้า” ที่กำลังรีวิว
  const [reviewModal, setReviewModal] = useState({
    open: false,
    orderId: null,
    variantId: null,
    lineInfo: null, // { title, sizeName, generationName }
  });

  // ★ โมดัล “เหตุผลการยกเลิก”
  const [viewCancel, setViewCancel] = useState({ open: false, order: null });

  // Draft รีวิวต่อชิ้น (เก็บ localStorage)
  const [reviewDrafts, setReviewDrafts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("review-drafts-v2") || "{}");
    } catch (_) {
      return {};
    }
  });
  const persistDrafts = (next) => localStorage.setItem("review-drafts-v2", JSON.stringify(next));

  // รีวิวที่ส่งแล้วต่อชิ้น (ซิงก์จากเซิร์ฟเวอร์ + เก็บ localStorage เพื่อ offline)
  const [submittedReviews, setSubmittedReviews] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("review-submitted-v2") || "{}");
    } catch (_) {
      return {};
    }
  });
  const persistSubmitted = (next) => localStorage.setItem("review-submitted-v2", JSON.stringify(next));

  const openLineReview = (orderId, line) => {
    const variantId = line.variantId || line.variant?.id;
    const k = makeKey(orderId, variantId);
    setReviewDrafts((prev) => {
      const next = { ...prev, [k]: prev[k] || { rating: 0, text: "" } };
      persistDrafts(next);
      return next;
    });
    setReviewModal({
      open: true,
      orderId,
      variantId,
      lineInfo: {
        title: line.productTitle || "-",
        sizeName: line.sizeName || line.variant?.size?.name || null,
        generationName: line.generationName || line.variant?.generation?.name || null,
      },
    });
  };

  const openEditLineReview = (orderId, line) => {
    const variantId = line.variantId || line.variant?.id;
    const k = makeKey(orderId, variantId);
    const prev = submittedReviews[k] || { rating: 0, text: "" };
    setReviewDrafts((old) => {
      const next = { ...old, [k]: { rating: prev.rating || 0, text: prev.text || "" } };
      persistDrafts(next);
      return next;
    });
    setReviewModal({
      open: true,
      orderId,
      variantId,
      lineInfo: {
        title: line.productTitle || "-",
        sizeName: line.sizeName || line.variant?.size?.name || null,
        generationName: line.generationName || line.variant?.generation?.name || null,
      },
    });
  };

  const updateDraft = (patch) => {
    const k = makeKey(reviewModal.orderId, reviewModal.variantId);
    setReviewDrafts((prev) => {
      const base = prev[k] || { rating: 0, text: "" };
      const next = { ...prev, [k]: { ...base, ...patch } };
      persistDrafts(next);
      return next;
    });
  };

  const clearDraft = (orderId, variantId) => {
    const k = makeKey(orderId, variantId);
    setReviewDrafts((prev) => {
      const next = { ...prev };
      delete next[k];
      persistDrafts(next);
      return next;
    });
  };

  const submitReview = async () => {
    const { orderId, variantId } = reviewModal;
    const k = makeKey(orderId, variantId);
    const draft = reviewDrafts[k] || { rating: 0, text: "" };

    try {
      const res = await createOrderReviews(orderId, token, {
        rating: draft.rating,
        text: draft.text,
        variants: [variantId], // ★ ระบุชิ้นที่รีวิว
      });

      // ใช้ผลตอบกลับ ถ้าไม่มีให้ fallback draft
      const items = res?.data?.reviews || [{ variantId, rating: draft.rating, text: draft.text }];

      setSubmittedReviews((prev) => {
        const next = { ...prev };
        for (const it of items) {
          const kk = makeKey(orderId, it.variantId);
          next[kk] = { rating: it.rating, text: it.text ?? "", at: Date.now() };
        }
        persistSubmitted(next);
        return next;
      });

      toast.success("ส่งรีวิวสินค้าแล้ว ขอบคุณมากครับ 🙏", { position: "top-center" });
      clearDraft(orderId, variantId);
      setReviewModal({ open: false, orderId: null, variantId: null, lineInfo: null });
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.message ?? "ส่งรีวิวไม่สำเร็จ";
      toast.error(msg, { position: "top-center" });
    }
  };

  // โหลดคำสั่งซื้อ
  useEffect(() => {
    const load = async () => {
      if (!token || !users) {
        setLoading(false);
        return;
      }
      try {
        const res = await listUserOrderHistory(token);
        const list = res.data?.order ?? [];
        setOrders(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error(e);
        toast.error("โหลดประวัติคำสั่งซื้อไม่สำเร็จ", { position: "top-center" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, users]);

  // ★ ซิงก์ "รีวิวของฉัน" จากเซิร์ฟเวอร์ เมื่อมี orders
  useEffect(() => {
    const syncSubmitted = async () => {
      if (!token || !users) return;
      if (!Array.isArray(orders) || orders.length === 0) return;

      try {
        const results = await Promise.all(
          orders.map((od) => getMyOrderReviews(od.id, token).catch(() => ({ data: { reviews: [] } })))
        );
        const collected = {};
        orders.forEach((od, i) => {
          const reviews = results[i]?.data?.reviews || [];
          for (const rv of reviews) {
            const k = makeKey(od.id, rv.variantId);
            collected[k] = { rating: rv.rating, text: rv.text ?? "", at: Date.now() };
          }
        });
        setSubmittedReviews(collected);
        persistSubmitted(collected);
      } catch (e) {
        console.error("syncSubmitted error:", e);
      }
    };
    syncSubmitted();
  }, [orders, token, users]);

  const grandTotal = useMemo(
    () => orders.reduce((sum, od) => sum + toNum(od.cartTotal), 0),
    [orders]
  );

  if (loading && token && users) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-56 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-100 rounded-2xl" />
          <div className="h-24 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  const activeKey = makeKey(reviewModal.orderId, reviewModal.variantId);
  const activeDraft = reviewDrafts[activeKey] || { rating: 0, text: "" };
  const isEditing = Boolean(submittedReviews[activeKey]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 font-sans">
      {(!token || !users) && (
        <div className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 px-4 py-3 rounded-xl">
          โปรดเข้าสู่ระบบเพื่อดูประวัติคำสั่งซื้อของคุณ
        </div>
      )}

      {orders.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border shadow-sm text-center text-gray-500">
          ยังไม่มีประวัติการสั่งซื้อ
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((od) => (
            <div key={od.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              {/* Card Header */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border-b">
                <div className="flex flex-wrap items-center gap-3 text-sm text-black">
                  <div>
                    เลขที่ออเดอร์:{" "}
                    <span className="font-semibold text-black">#{String(od.id).padStart(5, "0")}</span>
                  </div>
                  <span className="text-gray-300">•</span>
                  <div>
                    สั่งเมื่อ: <span className="font-medium text-black">{fmtDateTime(od.createdAt)}</span>
                  </div>

                  {isOrderCompleted(od.orderStatus) && (
                    <>
                      <span className="text-gray-300">•</span>
                      <div>
                        สำเร็จเมื่อ:{" "}
                        <span className="font-medium text-black">{fmtDateTime(od.completedAt)}</span>
                      </div>
                    </>
                  )}

                  {isOrderCanceled(od.orderStatus) && (
                    <>
                      <span className="text-gray-300">•</span>
                      <div>
                        ยกเลิกเมื่อ:{" "}
                        <span className="font-medium text-black">
                          {fmtDateTime(od.canceledAt || od.updatedAt)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <StatusPill status={od.orderStatus} />

                  {/* ★ ปุ่มดูเหตุผลการยกเลิก — แสดงเฉพาะเมื่อยกเลิก */}
                  {isOrderCanceled(od.orderStatus) && (
                    <button
                      type="button"
                      onClick={() => setViewCancel({ open: true, order: od })}
                      className="inline-flex items-center gap-1 text-xs rounded-lg bg-red-50 text-red-800 ring-1 ring-red-200 px-3 py-1.5 hover:bg-red-100"
                      title="ดูเหตุผลการยกเลิก"
                    >
                      <Eye size={14} className="shrink-0" />
                      ดูเหตุผล
                    </button>
                  )}
                </div>
              </div>

              {/* Lines */}
              <div className="p-4 space-y-3">
                {od.products?.map((line) => {
                  const qty = toNum(line.count);
                  const price = toNum(line.price);
                  const lineTotal = qty * price;
                  const title = line.productTitle || "-";
                  const sizeName = line.sizeName || "-";
                  const generationName = line.generationName || "-";
                  const imageUrl = line.imageUrl || null;
                  const vid = line.variantId || line.variant?.id;

                  // ✅ ซ่อนรีวิวทั้งหมดถ้าออเดอร์ไม่ได้ "สำเร็จ"
                  const showReviewControls =
                    isOrderCompleted(od.orderStatus) && Number.isFinite(Number(vid));

                  const key = makeKey(od.id, vid);
                  const submitted = submittedReviews[key];

                  return (
                    <div
                      key={line.id ?? `${od.id}-${vid}-${title}`}
                      className="grid grid-cols-12 gap-4 bg-gray-50 rounded-xl p-3"
                    >
                      <div className="col-span-12 sm:col-span-2">
                        <div className="w-full aspect-[4/3] overflow-hidden rounded-xl border bg-white">
                          {imageUrl ? (
                            <img src={imageUrl} alt={title} className="w-full h-full object-contain" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                              no image
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="col-span-12 sm:col-span-10 flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="text-sm text-black">
                            รหัสสินค้า :{" "}
                            <span className="font-medium text-black">
                              F{String(vid ?? 0).padStart(4, "0")}
                            </span>
                          </div>
                          <div className="text-base font-medium text-black tracking-tight">{title}</div>
                          <div className="text-sm text-black">
                            รุ่น : <b className="font-medium">{generationName}</b>
                          </div>
                          <div className="text-sm text-black">
                            ขนาด : <b className="font-medium">{sizeName}</b>
                          </div>
                          <div className="text-sm text-black">
                            ราคา : <b className="font-medium">{fmtMoney(price)} บาท</b>
                          </div>
                          <div className="text-sm text-black">
                            จำนวน : <b className="font-medium">{qty} ตัว</b>
                          </div>
                        </div>

                        <div className="flex flex-col items-end justify-between gap-2">
                          <div className="text-right">
                            <div className="text-xs text-gray-500">ยอดรวม</div>
                            <div className="text-lg font-bold text-gray-900">{fmtMoney(lineTotal)} บาท</div>
                          </div>

                          {/* ✅ ซ่อนทั้งหมดถ้าไม่ใช่สถานะ 'สำเร็จ' */}
                          {showReviewControls && (
                            submitted ? (
                              <button
                                onClick={() => openEditLineReview(od.id, line)}
                                className="inline-flex items-center gap-2 rounded-lg bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200 px-3 py-1 hover:bg-yellow-100"
                                title="แตะเพื่อแก้ไขรีวิวสินค้าชิ้นนี้"
                              >
                                <ReadOnlyStars rating={submitted.rating} />
                              </button>
                            ) : (
                              <button
                                onClick={() => openLineReview(od.id, line)}
                                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200 hover:bg-yellow-100"
                                title="รีวิวสินค้าชิ้นนี้"
                              >
                                <Star size={14} className="stroke-yellow-300" /> รีวิว/ดาว ชิ้นนี้
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {orders.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border shadow-sm p-4 space-y-2">
          <div className="flex justify-between text-lg font-light">
            <span className="font-semibold">ราคารวมทุกคำสั่งซื้อที่สำเร็จ</span>
            <span className="text-black font-semibold">{fmtMoney(grandTotal)} บาท</span>
          </div>
          <div className="flex justify-between text-lg font-light">
            <span className="font-semibold">จำนวนสินค้าทั้งหมด</span>
            <span className="text-black font-semibold">
              {orders
                .reduce((sum, od) => sum + (od.products?.reduce?.((s, l) => s + toNum(l.count), 0) || 0), 0)
                .toLocaleString("th-TH")}{" "}
              ตัว
            </span>
          </div>
        </div>
      )}

      {/* Modal (controlled) */}
      <ReviewModal
        open={reviewModal.open}
        rating={activeDraft.rating}
        text={activeDraft.text}
        lineInfo={reviewModal.lineInfo}
        isEditing={isEditing}
        onChange={updateDraft}
        onClose={() => setReviewModal({ open: false, orderId: null, variantId: null, lineInfo: null })}
        onSubmit={submitReview}
      />

      {/* ★ Modal: ดูเหตุผลการยกเลิก */}
      {viewCancel.open && viewCancel.order && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="p-5 border-b flex items-center justify-between">
              <div className="font-semibold flex items-center gap-2 text-red-700">
                <XCircle className="h-5 w-5" /> เหตุผลการยกเลิกคำสั่งซื้อ
              </div>
              <button
                onClick={() => setViewCancel({ open: false, order: null })}
                className="text-gray-500 hover:text-gray-700"
                aria-label="ปิด"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-2 text-sm">
              <div><b>เลขที่ออเดอร์:</b> #{String(viewCancel.order.id).padStart(5, "0")}</div>
              <div><b>ยกเลิกเมื่อ:</b> {fmtDateTime(viewCancel.order.canceledAt || viewCancel.order.updatedAt)}</div>
              <div className="pt-2"><b>เหตุผล:</b> {viewCancel.order.cancelReason || "-"}</div>
              {!!(viewCancel.order.cancelNote ?? "").trim() && (
                <div><b>หมายเหตุ:</b> {viewCancel.order.cancelNote}</div>
              )}
            </div>

            <div className="p-5 border-t flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  const o = viewCancel.order;
                  const text = [
                    `เลขที่ออเดอร์: #${String(o.id).padStart(5, "0")}`,
                    `ยกเลิกเมื่อ: ${fmtDateTime(o.canceledAt || o.updatedAt)}`,
                    `เหตุผล: ${o.cancelReason || "-"}`,
                    `หมายเหตุ: ${o.cancelNote || "-"}`,
                  ].join("\n");
                  navigator.clipboard.writeText(text);
                  toast.info("คัดลอกเหตุผลการยกเลิกแล้ว", { position: "top-center" });
                }}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                title="คัดลอกรายละเอียด"
              >
                คัดลอก
              </button>
              <button
                onClick={() => setViewCancel({ open: false, order: null })}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
