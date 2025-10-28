// client/src/components/card/OrderHistory.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import useEcomStore from "../../store/ecom-store";
import { listUserOrderHistory } from "../../api/users";
import { toast } from "react-toastify";
import {
  CheckCircle2,
  XCircle,
  Star,
  Eye,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  ClipboardList,
} from "lucide-react";
import { createOrderReviews, getMyOrderReviews } from "../../api/review";

/* =========================
   Status (เหลือ 2 สถานะ)
   ========================= */
const STATUS = { COMPLETED: "COMPLETED", CANCELED: "CANCELED" };
const DISPLAY_TH = {
  [STATUS.COMPLETED]: "ผู้ซื้อมารับสินค้าแล้ว",
  [STATUS.CANCELED]: "คำสั่งซื้อถูกยกเลิก",
};
const KNOWN_STATUS_TEXT = {
  // ไทย
  ยกเลิก: STATUS.CANCELED,
  ผู้ซื้อมารับสินค้าแล้ว: STATUS.COMPLETED,
  ผู้ขายจัดเตรียมสินค้าแล้วรอผู้ซื้อมารับ: STATUS.COMPLETED,
  ผู้ขายได้รับคำสั่งซื้อแล้ว: STATUS.COMPLETED,
  // อังกฤษ (กันข้อมูลเก่า)
  CANCELED: STATUS.CANCELED,
  COMPLETED: STATUS.COMPLETED,
  PENDING: STATUS.COMPLETED,
  CONFIRMED: STATUS.COMPLETED,
};
const toEnumStatus = (od) => {
  const raw = od?.orderStatusEnum || od?.orderStatusText || od?.orderStatus || "";
  const s = String(raw).trim();
  return KNOWN_STATUS_TEXT[s] || STATUS.COMPLETED;
};
const toThai = (v) => DISPLAY_TH[v] || DISPLAY_TH[STATUS.COMPLETED];

/* =========================
   Helpers (ให้เหมือนหน้า Order)
   ========================= */
const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const THB = (n) =>
  (Number(n) || 0).toLocaleString("th-TH", { style: "currency", currency: "THB" });
const fmtDateTimeTH = (v) =>
  v ? new Date(v).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "-";
const makeKey = (orderId, variantId) => `${orderId}::${variantId}`;

/* =========================
   UI primitives (ให้โทนเดียวกัน)
   ========================= */
const Badge = ({ as: Tag = "span", className = "", children, title, ...props }) => (
  <Tag
    className={
      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 " +
      className
    }
    title={title}
    {...props}
  >
    {children}
  </Tag>
);

const StatusPill = ({ status }) => {
  const map = {
    [STATUS.COMPLETED]: {
      cls: "bg-green-50 text-green-700 ring-green-200",
      Icon: CheckCircle2,
      text: toThai(STATUS.COMPLETED),
    },
    [STATUS.CANCELED]: {
      cls: "bg-red-50 text-red-700 ring-red-200",
      Icon: XCircle,
      text: toThai(STATUS.CANCELED),
    },
  };
  const { cls, Icon, text } = map[status] || map[STATUS.COMPLETED];
  return (
    <Badge className={cls} title={text} aria-label={`สถานะ: ${text}`}>
      <Icon className="h-3.5 w-3.5" />
      {text}
    </Badge>
  );
};

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border bg-white p-10 text-center">
    <ClipboardList className="h-10 w-10 text-gray-400" />
    <div className="text-base font-semibold text-gray-800">ยังไม่มีประวัติคำสั่งซื้อ</div>
    <p className="text-sm text-gray-500">
      เมื่อมีผู้ซื้อมารับสินค้าแล้ว/คำสั่งซื้อถูกยกเลิก จะแสดงรายการไว้ที่นี่
    </p>
  </div>
);

/* ---------- Stars ---------- */
const RATING_LABEL = [null, "ปรับปรุง", "พอใช้", "ปานกลาง", "ดี", "ดีมาก"];
const StarRating = ({ value = 0, onChange }) => {
  const [hover, setHover] = useState(0);
  const show = hover || value;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = show >= n;
        return (
          <button
            key={n}
            type="button"
            className="p-1"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange?.({ rating: n })}
            aria-label={`ให้ ${n} ดาว`}
            title={`ให้ ${n} ดาว`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" className={filled ? "text-yellow-400" : "text-gray-300"}>
              <path
                d="M12 .9l3.09 6.26L22 8.4l-5 4.88 1.18 6.86L12 16.9l-6.18 3.24L7 13.28 2 8.4l6.91-1.24L12 .9z"
                fill={filled ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        );
      })}
      <span className="ml-2 text-sm text-gray-600">
        {show ? RATING_LABEL[show] : "เลือกคะแนน"}
      </span>
    </div>
  );
};
const ReadOnlyStars = ({ rating = 0, size = 14, showLabel = false }) => (
  <div className="flex items-center gap-1">
    {[1, 2, 3, 4, 5].map((n) => {
      const filled = n <= rating;
      return (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24" className={filled ? "text-yellow-400" : "text-gray-300"}>
          <path
            d="M12 .9l3.09 6.26L22 8.4l-5 4.88 1.18 6.86L12 16.9l-6.18 3.24L7 13.28 2 8.4l6.91-1.24L12 .9z"
            fill={filled ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
    })}
    {showLabel && <span className="text-[11px] text-yellow-500 ml-1">{RATING_LABEL[rating] || ""}</span>}
  </div>
);

/* ---------- Modal รีวิวรายสินค้า ---------- */
const ReviewModal = ({ open, rating, text, lineInfo, isEditing, onChange, onClose, onSubmit }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="p-5 border-b">
          <div className="text-lg font-semibold tracking-tight">
            {isEditing ? "แก้ไขรีวิวสินค้า" : "ให้คะแนนสินค้า"}
          </div>
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
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-white bg-red-500 hover:bg-red-600">
            ยกเลิก
          </button>
          <button
            onClick={onSubmit}
            disabled={!rating}
            className={`px-4 py-2 rounded-lg text-white ${!rating ? "bg-gray-300 cursor-not-allowed" : "bg-gray-700 hover:bg-gray-800"
              }`}
          >
            {isEditing ? "อัปเดตรีวิว" : "ส่งรีวิว"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================
   Tabs + Pagination
   ========================= */
const VIEWS = { ALL: "ALL", COMPLETED: "COMPLETED", CANCELED: "CANCELED" };
const DEFAULT_PAGE_SIZE = 5;
const PAGE_SIZE_OPTIONS = [3, 5, 10];

const OrderHistory = () => {
  const token = useEcomStore((s) => s.token);
  const users = useEcomStore((s) => s.users);
  const topRef = useRef(null);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(VIEWS.ALL);

  // pagination state
  const [pageSize, setPageSize] = useState(() => {
    const saved = Number(localStorage.getItem("order_hist_page_size"));
    return PAGE_SIZE_OPTIONS.includes(saved) ? saved : DEFAULT_PAGE_SIZE;
  });
  const [page, setPage] = useState(1);

  // modal state
  const [reviewModal, setReviewModal] = useState({
    open: false,
    orderId: null,
    variantId: null,
    lineInfo: null,
  });
  const [viewCancel, setViewCancel] = useState({ open: false, order: null });

  // drafts/submitted reviews
  const [reviewDrafts, setReviewDrafts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("review-drafts-v2") || "{}");
    } catch {
      return {};
    }
  });
  const [submittedReviews, setSubmittedReviews] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("review-submitted-v2") || "{}");
    } catch {
      return {};
    }
  });
  const persistDrafts = (next) =>
    localStorage.setItem("review-drafts-v2", JSON.stringify(next));
  const persistSubmitted = (next) =>
    localStorage.setItem("review-submitted-v2", JSON.stringify(next));

  // refs สำหรับ select + กัน scroll เปลี่ยนค่า
  const topSelectRef = useRef(null);
  const bottomSelectRef = useRef(null);

  // ---- กัน scroll แล้ว select เปลี่ยนค่า: ใช้ native addEventListener(passive:false)
  useEffect(() => {
    const attachNoWheel = (el) => {
      if (!el) return () => { };
      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.blur();
      };
      el.addEventListener("wheel", handler, { passive: false });
      return () => el.removeEventListener("wheel", handler);
    };
    const cleanTop = attachNoWheel(topSelectRef.current);
    const cleanBottom = attachNoWheel(bottomSelectRef.current);
    return () => {
      cleanTop && cleanTop();
      cleanBottom && cleanBottom();
    };
  }, []);

  const preventArrowKeys = (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
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
        const list = res.data?.order ?? res.data?.orders ?? [];
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

  // ซิงค์รีวิวของฉัน
  useEffect(() => {
    const syncSubmitted = async () => {
      if (!token || !users) return;
      if (!Array.isArray(orders) || orders.length === 0) return;
      try {
        const results = await Promise.all(
          orders.map((od) =>
            getMyOrderReviews(od.id, token).catch(() => ({ data: { reviews: [] } }))
          )
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

  /* =========================
     Filtering & pagination
     ========================= */
  const filteredOrders = useMemo(() => {
    return orders.filter((od) => {
      const s = toEnumStatus(od);
      if (view === VIEWS.COMPLETED) return s === STATUS.COMPLETED;
      if (view === VIEWS.CANCELED) return s === STATUS.CANCELED;
      return true;
    });
  }, [orders, view]);

  const totalOrders = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalOrders);
  const pagedOrders = useMemo(
    () => filteredOrders.slice(startIndex, endIndex),
    [filteredOrders, startIndex, endIndex]
  );

  const goToPage = (p) => {
    const clamped = Math.min(Math.max(1, p), totalPages);
    if (clamped !== page) {
      setPage(clamped);
      setTimeout(() => {
        if (topRef.current) topRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        else window.scrollTo({ top: 0, behavior: "smooth" });
      }, 0);
    }
  };

  // ควบคุม page size: คงหน้าเดิม (ถ้าหน้าปัจจุบันเกินหน้าสูงสุดใหม่ก็ clamp ลง)
  const onChangePageSize = (e) => {
    const v = Number(e.target.value);
    localStorage.setItem("order_hist_page_size", String(v));
    setPageSize(v);
    const newTotalPages = Math.max(1, Math.ceil(totalOrders / v));
    setPage((p) => Math.min(Math.max(1, p), newTotalPages));
  };

  // summaries
  const grandTotalCompleted = useMemo(
    () =>
      orders
        .filter((od) => toEnumStatus(od) === STATUS.COMPLETED)
        .reduce((sum, od) => sum + toNum(od.cartTotal), 0),
    [orders]
  );
  const totalItemsInView = useMemo(
    () =>
      filteredOrders.reduce(
        (sum, od) => sum + (od.products?.reduce?.((s, l) => s + toNum(l.count), 0) || 0),
        0
      ),
    [filteredOrders]
  );

  // review handlers
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
        variants: [variantId],
      });
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
      toast.error(e?.response?.data?.message ?? "ส่งรีวิวไม่สำเร็จ", { position: "top-center" });
    }
  };

  // render
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
    <div className="mx-auto w-full max-w-[1310px] px-6 pt-4 space-y-6" ref={topRef}>
      {/* Header (เหมือนหน้า Order) */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">ประวัติคำสั่งซื้อ</h1>
            <p className="text-sm text-gray-500">ดูรายการที่สำเร็จและยกเลิก พร้อมให้คะแนนสินค้า</p>
          </div>

          {/* top controls: tabs + page size + counter */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: VIEWS.ALL, label: "ทั้งหมด" },
              { key: VIEWS.COMPLETED, label: "ผู้ซื้อมารับสินค้าแล้ว" },
              { key: VIEWS.CANCELED, label: "คำสั่งซื้อถูกยกเลิก" },
            ].map((t) => {
              const active = view === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => {
                    setView(t.key);
                    setPage(1);
                  }}
                  className={[
                    "px-3 py-1.5 rounded-lg text-sm ring-1",
                    active
                      ? "bg-gray-700 text-white ring-gray-700"
                      : "bg-white text-gray-700 ring-gray-200 hover:bg-gray-50",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              );
            })}

            <span className="hidden sm:inline text-gray-300">|</span>

            <label className="text-sm text-gray-600">แสดงต่อหน้า</label>
            <select
              ref={topSelectRef}
              value={pageSize}
              onChange={onChangePageSize}
              onKeyDown={preventArrowKeys}
              className="rounded-lg border px-2 py-1 text-sm"
              aria-label="จำนวนรายการต่อหน้า"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            <span className="text-sm text-gray-600">
              แสดง {totalOrders === 0 ? 0 : startIndex + 1}-{endIndex} จาก {totalOrders} รายการ
            </span>
          </div>
        </div>
      </div>

      {/* Not logged in */}
      {(!token || !users) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          โปรดเข้าสู่ระบบเพื่อดูประวัติคำสั่งซื้อของคุณ
        </div>
      )}

      {/* empty */}
      {totalOrders === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Summary (สไตล์เดียวกับหน้า Order) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border bg-white p-3 hover:shadow-sm transition">
              <div className="text-xs text-gray-500">ราคารวมทุกคำสั่งซื้อที่สำเร็จ</div>
              <div className="mt-0.5 text-xl font-bold text-gray-900">{THB(grandTotalCompleted)}</div>
            </div>

            <div className="rounded-lg border bg-white p-3 hover:shadow-sm transition">
              <div className="text-xs text-gray-500">จำนวนสินค้าทั้งหมดในรายการที่กำลังแสดง</div>
              <div className="mt-0.5 text-xl font-bold text-gray-900">
                {totalItemsInView.toLocaleString()} ตัว
              </div>
            </div>
          </div>

          {/* list */}
          <div className="space-y-6">
            {pagedOrders.map((od) => {
              const enumStatus = toEnumStatus(od);
              const isCompleted = enumStatus === STATUS.COMPLETED;
              const isCanceled = enumStatus === STATUS.CANCELED;

              return (
                <section
                  key={od.id}
                  className="overflow-hidden rounded-2xl border bg-white shadow-sm ring-1 ring-gray-100"
                  aria-label={`คำสั่งซื้อหมายเลข ${String(od.id).padStart(5, "0")}`}
                >
                  {/* header row */}
                  <div className="border-b bg-gradient-to-r from-gray-50 to-white p-4 md:p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-900">
                        <div>
                          เลขที่ออเดอร์:{" "}
                          <span className="font-medium text-gray-800">
                            #{String(od.id).padStart(5, "0")}
                          </span>
                        </div>
                        <span className="text-gray-300 text-xs">•</span>
                        <div>
                          สั่งเมื่อ:{" "}
                          <span className="font-medium text-gray-800">{fmtDateTimeTH(od.createdAt)}</span>
                        </div>

                        {isCompleted && (
                          <>
                            <span className="text-gray-300 text-xs">•</span>
                            <div>
                              สำเร็จเมื่อ:{" "}
                              <span className="font-medium text-gray-800">
                                {fmtDateTimeTH(od.completedAt)}
                              </span>
                            </div>
                          </>
                        )}
                        {isCanceled && (
                          <>
                            <span className="text-gray-300 text-xs">•</span>
                            <div>
                              ยกเลิกเมื่อ:{" "}
                              <span className="font-medium text-gray-800">
                                {fmtDateTimeTH(od.canceledAt || od.updatedAt)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={enumStatus} />
                        {isCanceled && (
                          <Badge
                            as="button"
                            onClick={() => setViewCancel({ open: true, order: od })}
                            className="bg-red-50 text-red-700 ring-red-200 hover:bg-red-100 appearance-none select-none focus:outline-none"
                            title="ดูเหตุผลการยกเลิก"
                            aria-label="ดูเหตุผลการยกเลิก"
                            type="button"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            ดูเหตุผล
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* lines */}
                  <div className="p-4 md:p-5 space-y-4">
                    {od.products?.map((line) => {
                      const qty = toNum(line.count);
                      const price = toNum(line.price);
                      const lineTotal = qty * price;
                      const title = line.productTitle || "-";
                      const sizeName = line.sizeName || "-";
                      const generationName = line.generationName || "-";
                      const imageUrl = line.imageUrl || null;
                      const vid = line.variantId || line.variant?.id;

                      const showReviewControls = isCompleted && Number.isFinite(Number(vid));
                      const key = makeKey(od.id, vid);
                      const submitted = submittedReviews[key];

                      return (
                        <div
                          key={line.id ?? `${od.id}-${vid}-${title}`}
                          className="grid grid-cols-12 gap-4 rounded-xl p-3 border bg-white shadow-sm hover:shadow transition"
                        >
                          <div className="col-span-12 sm:col-span-2">
                            <div className="w-full aspect-[4/3] overflow-hidden rounded-lg border bg-white">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={title}
                                  className="h-full w-full object-contain"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                                  ไม่มีรูปภาพ
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="col-span-12 sm:col-span-10 flex flex-wrap items-start justify-between gap-3">
                            {/* รายละเอียดสินค้า */}
                            <div className="min-w-[220px] space-y-0.5">
                              <div className="text-sm text-gray-800">
                                รหัสสินค้า:{" "}
                                <span className="font-medium">
                                  F{String(vid ?? 0).padStart(4, "0")}
                                </span>
                              </div>
                              <div className="text-sm text-gray-900">{title}</div>
                              <div className="text-sm text-gray-800">
                                รุ่น: <b className="font-medium">{generationName}</b>
                              </div>
                              <div className="text-sm text-gray-800">
                                ขนาด: <b className="font-medium">{sizeName}</b>
                              </div>
                              <div className="text-sm text-gray-800">
                                ราคา: <b className="font-medium">{THB(price)}</b>
                              </div>
                              <div className="text-sm text-gray-800">
                                จำนวน: <b className="font-medium">{qty} ตัว</b>
                              </div>
                            </div>

                            {/* ยอดรวมต่อรายการ + รีวิว */}
                            <div className="min-w-[160px] flex flex-col items-end gap-2">
                              <div className="text-right">
                                <div className="text-xs text-gray-500">ยอดรวม</div>
                                <div className="text-lg font-bold text-gray-900">{THB(lineTotal)}</div>
                              </div>

                              {showReviewControls &&
                                (submitted ? (
                                  <button
                                    onClick={() => openEditLineReview(od.id, line)}
                                    className="inline-flex items-center gap-2 rounded-lg bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200 px-3 py-1 hover:bg-yellow-100"
                                    title="แตะเพื่อแก้ไขรีวิวสินค้าชิ้นนี้"
                                  >
                                    <span className="text-xs font-medium text-yellow-800">แก้ไขรีวิว</span>
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
                                ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Pagination (ล่าง) */}
          {totalOrders > pageSize && (
            <nav
              className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm"
              aria-label="ตัวแบ่งหน้าประวัติคำสั่งซื้อ"
            >
              <div className="text-sm text-gray-600">
                แสดง {startIndex + 1}-{endIndex} จาก {totalOrders} รายการ
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => goToPage(1)}
                  className="rounded-lg border px-2 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                  disabled={page === 1}
                  aria-label="หน้าแรก"
                  title="หน้าแรก"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  className="rounded-lg border px-2 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                  disabled={page === 1}
                  aria-label="หน้าก่อนหน้า"
                  title="หน้าก่อนหน้า"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-3 text-sm text-gray-700">
                  หน้า <b>{page}</b> / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  className="rounded-lg border px-2 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                  disabled={page === totalPages}
                  aria-label="หน้าถัดไป"
                  title="หน้าถัดไป"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => goToPage(totalPages)}
                  className="rounded-lg border px-2 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                  disabled={page === totalPages}
                  aria-label="หน้าสุดท้าย"
                  title="หน้าสุดท้าย"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">แสดงต่อหน้า</label>
                <select
                  ref={bottomSelectRef}
                  value={pageSize}
                  onChange={onChangePageSize}
                  onKeyDown={preventArrowKeys}
                  className="rounded-lg border px-2 py-1 text-sm"
                  aria-label="จำนวนรายการต่อหน้า"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </nav>
          )}
        </>
      )}

      {/* Review modal */}
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

      {/* Cancel reason modal */}
      {viewCancel.open && viewCancel.order && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
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
              <div>
                <b>เลขที่ออเดอร์:</b> #{String(viewCancel.order.id).padStart(5, "0")}
              </div>
              <div>
                <b>ยกเลิกเมื่อ:</b>{" "}
                {fmtDateTimeTH(viewCancel.order.canceledAt || viewCancel.order.updatedAt)}
              </div>
              <div className="pt-2">
                <b>เหตุผล:</b> {viewCancel.order.cancelReason || "-"}
              </div>
              {!!(viewCancel.order.cancelNote ?? "").trim() && (
                <div>
                  <b>หมายเหตุ:</b> {viewCancel.order.cancelNote}
                </div>
              )}
            </div>

            <div className="p-5 border-t flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  const o = viewCancel.order;
                  const text = [
                    `เลขที่ออเดอร์: #${String(o.id).padStart(5, "0")}`,
                    `ยกเลิกเมื่อ: ${fmtDateTimeTH(o.canceledAt || o.updatedAt)}`,
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
