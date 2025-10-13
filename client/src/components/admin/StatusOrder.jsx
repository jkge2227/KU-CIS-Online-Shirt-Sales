// client/src/components/admin/StatusOrder.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  adminListOrders,
  adminUpdateOrderStatus,
  adminCancelOrder,
  adminBulkSetPickup,
  adminUpdateCancelInfo,
} from "../../api/adminOrders";
import useEcomStore from "../../store/ecom-store";
import {
  Loader2,
  XCircle,
  RotateCw,
  Search,
  Send,
  MapPin,
  Eye,
  CheckCircle,
} from "lucide-react";

// ---------------- Utils: สีสถานะ ----------------
const pill = (status) => {
  if (status === "คำสั่งซื้อสำเร็จ") return "bg-emerald-100 text-emerald-700";
  if (status === "รับออเดอร์เสร็จสิ้น") return "bg-blue-100 text-blue-700";
  if (status === "ยกเลิก") return "bg-red-100 text-red-700";
  return "bg-yellow-100 text-yellow-700"; // กำลังรับออเดอร์
};

// ---------------- Utils: เวลาไทย & ฟิลเตอร์วันไทย ----------------
const TZ_TH = "Asia/Bangkok";
const fmtTH = (d) =>
  new Date(d).toLocaleString("th-TH", {
    timeZone: TZ_TH,
    dateStyle: "medium",
    timeStyle: "short",
  });

// ฟิลเตอร์วันไทย (ไม่เหลื่อมวัน)
const FILTER_THAI_DAYS = true;
const TH_OFFSET_MS = 7 * 60 * 60 * 1000; // +07:00

// รับ "YYYY-MM-DD" -> คืน JS Date ที่เท่ากับ "เที่ยงคืน(ไทย) ในเขตเวลา UTC"
const thDayStartUTC = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - TH_OFFSET_MS);
};
const thNextDayStartUTC = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1) - TH_OFFSET_MS);
};

// ---------------- Utils: ค้นหาฝั่ง client ----------------
const norm = (str) =>
  String(str || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/\s+/g, " ")
    .trim();

const buildSearchIndex = (od) => {
  const parts = [];
  parts.push(`#${od.id}`);
  parts.push(od.orderStatus || "");
  parts.push(od.orderBuy?.first_name || "");
  parts.push(od.orderBuy?.last_name || "");
  parts.push(od.orderBuy?.email || "");
  parts.push(od.orderBuy?.phone || "");
  (od.products || []).forEach((p) => {
    parts.push(p.productTitle || "");
    parts.push(p.sizeName || "");
    parts.push(p.generationName || "");
  });
  parts.push(od.pickupPlace || "");
  parts.push(od.pickupNote || "");
  return norm(parts.join(" | "));
};

const StatusOrder = () => {
  const token = useEcomStore((s) => s.token);

  // data ที่โหลดมาจาก server (ดิบ ๆ)
  const [rowsRaw, setRowsRaw] = useState([]);
  const [loading, setLoading] = useState(false);

  // ค่ากรอง (ฝั่ง client ทั้งหมด)
  const [status, setStatus] = useState(""); // "", "กำลังรับออเดอร์", "รับออเดอร์เสร็จสิ้น", "คำสั่งซื้อสำเร็จ", "ยกเลิก"
  const [q, setQ] = useState("");
  const [startDate, setStartDate] = useState(""); // "YYYY-MM-DD"
  const [endDate, setEndDate] = useState(""); // "YYYY-MM-DD"

  // page client-side
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // เลือกหลายออเดอร์เพื่อส่งนัดรับ
  const [selected, setSelected] = useState([]);

  // Pickup modal (bulk)
  const [pickupOpen, setPickupOpen] = useState(false);
  const [place, setPlace] = useState("");
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");

  // View pickup modal
  const [viewPickup, setViewPickup] = useState({ open: false, order: null });

  // Cancel modal (ครั้งแรก)
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelId, setCancelId] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const COMMON_REASONS = [
    "ลูกค้ายกเลิกเอง",
    "สต็อกไม่เพียงพอ",
    "ข้อมูลออเดอร์ไม่ครบถ้วน",
    "ชำระเงินไม่สำเร็จ/เกินกำหนด",
    "เหตุผลอื่นๆ",
  ];

  // Edit cancel info modal (หลังยกเลิกแล้ว)
  const [editCancelOpen, setEditCancelOpen] = useState(false);
  const [editCancelId, setEditCancelId] = useState(null);
  const [editReason, setEditReason] = useState("");
  const [editNote, setEditNote] = useState("");

  // Toast
  const [toast, setToast] = useState({ open: false, msg: "", type: "success" });
  const toastTimerRef = useRef(null);
  const showToast = (msg, type = "success", ms = 2500) => {
    setToast({ open: true, msg, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(
      () => setToast((t) => ({ ...t, open: false })),
      ms
    );
  };
  useEffect(() => () => toastTimerRef.current && clearTimeout(toastTimerRef.current), []);

  // โหลดข้อมูล (ไม่ส่งพารามิเตอร์ค้นหา/กรองไป server)
  const load = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const { data } = await adminListOrders(token, {
        page: 1,
        pageSize: 500, // ดึงมาทีเดียวเพื่อให้ client ค้นหา/กรองได้เต็มที่
      });
      const list = data?.data || [];
      setRowsRaw(Array.isArray(list) ? list : []);
      setSelected([]);
      setPage(1);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // แปลงเป็น index ค้นหา
  const searchMap = useMemo(() => {
    const m = new Map();
    for (const od of rowsRaw) m.set(od.id, buildSearchIndex(od));
    return m;
  }, [rowsRaw]);

  // ฟิลเตอร์ฝั่ง client ทั้งหมด (สถานะ, วันที่, ค้นหา)
  const filteredRows = useMemo(() => {
    let arr = rowsRaw;

    // สถานะ
    if (status) {
      arr = arr.filter((od) => String(od.orderStatus || "") === status);
    }

    // วันที่ (วันไทย)
    const from = FILTER_THAI_DAYS ? thDayStartUTC(startDate) : null;
    const to = FILTER_THAI_DAYS ? thNextDayStartUTC(endDate) : null;
    if (from) arr = arr.filter((od) => new Date(od.createdAt) >= from);
    if (to) arr = arr.filter((od) => new Date(od.createdAt) < to);

    // ค้นหา (พิมพ์บางส่วนก็เจอ)
    const qq = norm(q);
    if (qq) {
      arr = arr.filter((od) => {
        const hay = searchMap.get(od.id) || "";
        return hay.includes(qq);
      });
    }

    return arr;
  }, [rowsRaw, status, startDate, endDate, q, searchMap]);

  // จัดหน้า (client-side)
  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const viewRows = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageSafe, pageSize]);

  // selection helpers
  const allInPageIds = viewRows.map((r) => r.id);
  const allSelectedInPage =
    allInPageIds.length > 0 &&
    allInPageIds.every((id) => selected.includes(id));

  const toggleOne = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const toggleAllInPage = () => {
    setSelected((prev) =>
      allSelectedInPage
        ? prev.filter((id) => !allInPageIds.includes(id))
        : Array.from(new Set([...prev, ...allInPageIds]))
    );
  };

  // เฉพาะออเดอร์ที่อยู่ในสถานะ "รับออเดอร์เสร็จสิ้น" เท่านั้นถึงส่งนัดรับได้
  const selectedReadyIds = selected.filter(
    (id) => rowsRaw.find((r) => r.id === id)?.orderStatus === "รับออเดอร์เสร็จสิ้น"
  );
  const canSendPickup = selectedReadyIds.length > 0 && place.trim().length > 0;

  const closePickup = () => {
    setPickupOpen(false);
    setPlace("");
    setWhen("");
    setNote("");
  };

  const isoToLocalInput = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // ---------- Actions ----------
  const sendPickup = async () => {
    if (!canSendPickup) return;
    try {
      await adminBulkSetPickup(token, {
        orderIds: selectedReadyIds,
        place: place.trim(),
        pickupAt: when ? new Date(when).toISOString() : undefined, // เก็บ UTC
        note: note?.trim() || undefined,
      });
      showToast(`ตั้งค่านัดรับให้ ${selectedReadyIds.length} ออเดอร์แล้ว`, "success");
      closePickup();
      load();
    } catch (e) {
      console.error(e);
      showToast(e?.response?.data?.message || "ตั้งค่านัดรับไม่สำเร็จ", "error", 3500);
    }
  };

  const onQuickStatus = async (id, next) => {
    try {
      await adminUpdateOrderStatus(token, id, next);
      showToast(`อัปเดตสถานะ #${id} -> ${next}`, "success");
      load();
    } catch (e) {
      console.error(e);
      showToast(e?.response?.data?.message || "อัปเดตสถานะไม่สำเร็จ", "error", 3500);
    }
  };

  // cancel (ครั้งแรก)
  const onCancel = (id) => {
    setCancelId(id);
    setCancelReason("");
    setCancelNote("");
    setCancelOpen(true);
  };

  const sendCancel = async () => {
    if (!cancelId) return;
    if (!cancelReason.trim()) {
      alert("กรุณาเลือก/กรอกสาเหตุการยกเลิก");
      return;
    }
    try {
      await adminCancelOrder(token, cancelId, {
        reason: cancelReason.trim(),
        note: cancelNote?.trim() || undefined,
      });
      setCancelOpen(false);
      setCancelId(null);
      setCancelReason("");
      setCancelNote("");
      showToast(`ยกเลิกออเดอร์ #${cancelId} สำเร็จ`, "success");
      load();
    } catch (e) {
      console.error(e);
      showToast(e?.response?.data?.message || "ยกเลิกไม่สำเร็จ", "error", 3500);
    }
  };

  // ---------- Render ----------
  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Toast */}
      {toast.open && (
        <div className="fixed top-4 left-0 right-0 z-[9999] flex justify-center pointer-events-none">
          <div
            className={[
              "pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 shadow-lg ring-1",
              toast.type === "success" &&
              "bg-emerald-50 text-emerald-700 ring-emerald-200",
              toast.type === "error" &&
              "bg-red-50 text-red-700 ring-red-200",
              toast.type === "info" && "bg-blue-50 text-blue-700 ring-blue-200",
            ]
              .filter(Boolean)
              .join(" ")}
            role="status"
            aria-live="polite"
          >
            {toast.type === "success" && (
              <CheckCircle className="h-5 w-5 shrink-0" />
            )}
            {toast.type === "error" && <XCircle className="h-5 w-5 shrink-0" />}
            <span className="text-sm">{toast.msg}</span>
            <button
              onClick={() => setToast((t) => ({ ...t, open: false }))}
              className="ml-2 text-xs opacity-70 hover:opacity-100"
              aria-label="ปิดการแจ้งเตือน"
            >
              ปิด
            </button>
          </div>
        </div>
      )}

      {/* Header + Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4">
        <h1 className="text-2xl font-bold">คำสั่งซื้อทั้งหมด</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {/* Search (client) */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="pl-9 pr-3 py-2 w-72 border rounded-lg"
                placeholder="พิมพ์เพื่อค้นหา: #ออเดอร์/ชื่อ/อีเมล/เบอร์/สินค้า"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <button
              onClick={() => setQ("")}
              className="px-3 py-2 rounded-lg border hover:bg-gray-50"
              title="ล้างคำค้น"
            >
              ล้าง
            </button>
          </div>

          {/* Status (client) */}
          <select
            className="border rounded-lg px-3 py-2"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">ทุกสถานะ</option>
            <option value="กำลังรับออเดอร์">กำลังรับออเดอร์</option>
            <option value="รับออเดอร์เสร็จสิ้น">รับออเดอร์เสร็จสิ้น</option>
            <option value="คำสั่งซื้อสำเร็จ">คำสั่งซื้อสำเร็จ</option>
            <option value="ยกเลิก">ยกเลิก</option>
          </select>

          {/* Date filter (client, วันไทย) */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="border rounded-lg px-3 py-2"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              title="วันที่เริ่ม (วันไทย)"
            />
            <span className="text-gray-500">ถึง</span>
            <input
              type="date"
              className="border rounded-lg px-3 py-2"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              title="วันที่สิ้นสุด (วันไทย)"
            />
          </div>

          {/* Refresh (รีโหลดจาก server ครั้งเดียว) */}
          <button
            onClick={() => load()}
            className="px-3 py-2 rounded-lg border hover:bg-gray-50"
            title="รีเฟรช"
          >
            <RotateCw className="h-4 w-4 inline mr-1" /> รีเฟรช
          </button>
        </div>
      </div>

      {/* Bulk toolbar */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-600">
          เลือกแล้ว <b>{selected.length}</b> รายการ{" "}
          {selected.length > 0 &&
            `(${selectedReadyIds.length} รายการที่อยู่สถานะ 'รับออเดอร์เสร็จสิ้น')`}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              selectedReadyIds.length > 0 && setPickupOpen(true)
            }
            disabled={selectedReadyIds.length === 0}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ring-1 ${selectedReadyIds.length === 0
              ? "bg-gray-100 text-gray-400 ring-gray-200 cursor-not-allowed"
              : "bg-blue-50 text-blue-700 ring-blue-200 hover:bg-blue-100"
              }`}
            title="ส่งสถานที่นัดรับ (หลายคำสั่งซื้อ)"
          >
            <MapPin className="h-4 w-4" /> ส่งสถานที่นัดรับ
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12 text-gray-500">
          <Loader2 className="animate-spin h-6 w-6 mr-2" /> กำลังโหลด…
        </div>
      ) : viewRows.length === 0 ? (
        <div className="border rounded-xl p-8 text-center text-gray-500 bg-gray-50">
          ไม่พบข้อมูลตามเงื่อนไข
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border rounded-xl">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelectedInPage}
                    onChange={toggleAllInPage}
                    title="เลือกทั้งหมดในหน้านี้"
                  />
                </th>
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">ลูกค้า</th>
                <th className="px-4 py-3 text-left">สินค้า</th>
                <th className="px-4 py-3 text-right">รวม (฿)</th>
                <th className="px-4 py-3 text-center">สถานะ</th>
                <th className="px-4 py-3 text-center">สถานที่นัดรับ</th>
                <th className="px-4 py-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {viewRows.map((od) => {
                const total =
                  od.products?.reduce(
                    (s, p) => s + Number(p.price) * Number(p.count),
                    0
                  ) || 0;
                const checked = selected.includes(od.id);
                const canSelect = od.orderStatus === "รับออเดอร์เสร็จสิ้น";

                // สไตล์ปุ่มยกเลิก (active/disabled)
                const cancelDisabled = od.orderStatus === "คำสั่งซื้อสำเร็จ";
                const cancelBtnClass = [
                  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg shrink-0 whitespace-nowrap",
                  cancelDisabled
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-red-100 text-red-700 hover:bg-red-200",
                ].join(" ");

                return (
                  <tr key={od.id} className="border-t">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(od.id)}
                        disabled={!canSelect}
                        title={
                          canSelect
                            ? "เลือกออเดอร์นี้"
                            : "เลือกไม่ได้ (สถานะไม่ใช่ 'รับออเดอร์เสร็จสิ้น')"
                        }
                      />
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-semibold">#{od.id}</div>
                      <div className="text-xs text-gray-500">
                        {fmtTH(od.createdAt)}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {od.orderBuy?.first_name} {od.orderBuy?.last_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {od.orderBuy?.email}
                      </div>
                      <div className="text-xs text-gray-500">
                        {od.orderBuy?.phone}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {(od.products || []).slice(0, 3).map((p) => (
                        <div key={p.id} className="flex items-center gap-2">
                          {p.variant?.product?.images?.[0]?.url ? (
                            <img
                              src={p.variant.product.images[0].url}
                              className="h-8 w-8 rounded object-cover border"
                              alt=""
                            />
                          ) : (
                            <div className="h-8 w-8 rounded bg-gray-100 border" />
                          )}
                          <div className="truncate">
                            <div className="truncate">{p.productTitle}</div>
                            <div className="text-xs text-gray-500">
                              {p.sizeName}
                              {p.generationName ? ` / ${p.generationName}` : ""}{" "}
                              × {p.count}
                            </div>
                          </div>
                        </div>
                      ))}
                      {(od.products || []).length > 3 && (
                        <div className="text-xs text-gray-400 mt-1">
                          + อีก {(od.products || []).length - 3} รายการ
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold">
                      {total.toLocaleString()}
                    </td>

                    <td className="px-4 py-3 align-middle">
                      <div className="flex justify-center">
                        <span
                          className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium ${pill(
                            od.orderStatus
                          )}`}
                          aria-label={`สถานะคำสั่งซื้อ: ${od.orderStatus}`}
                        >
                          {od.orderStatus}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center align-middle">
                      {(od.pickupPlace || od.pickupAt || od.pickupNote) && (
                        <button
                          type="button"
                          onClick={() =>
                            setViewPickup({ open: true, order: od })
                          }
                          className="inline-flex items-center justify-center mx-auto rounded-lg bg-blue-50 text-blue-800 ring-1 ring-blue-200 px-3 py-2 hover:bg-blue-100 focus:outline-none"
                          title="กดเพื่อดูรายละเอียดสถานที่นัดรับ"
                        >
                          <Eye className="h-4 w-4 mr-1 shrink-0" />
                          <span className="text-xs leading-none select-none">
                            ดูรายละเอียด
                          </span>
                        </button>
                      )}
                    </td>

                    {/* ==== คอลัมน์จัดการ: layout คงที่ทุกแถว ==== */}
                    <td className="px-4 py-3 text-right align-middle min-w-[300px]">
                      <div className="flex items-center justify-end gap-3">
                        {/* Select: ความกว้าง/สูงคงที่เสมอ */}
                        <select
                          className={`w-44 h-9 border rounded-lg px-2 text-sm shrink-0 ${od.orderStatus === "ยกเลิก" ? "opacity-60 cursor-not-allowed" : ""
                            }`}
                          value={od.orderStatus}
                          disabled={od.orderStatus === "ยกเลิก"} // แถวที่ยกเลิกแล้ว lock ไว้
                          onChange={(e) => onQuickStatus(od.id, e.target.value)}
                          title={
                            od.orderStatus === "ยกเลิก"
                              ? "คำสั่งซื้อถูกยกเลิกแล้ว"
                              : "เปลี่ยนสถานะ"
                          }
                        >
                          {/* ให้ UI ตรงกับค่าเสมอ: ถ้าเป็น 'ยกเลิก' ให้มี option นี้ให้แสดงผล */}
                          {od.orderStatus === "ยกเลิก" && (
                            <option value="ยกเลิก" disabled>ยกเลิก</option>
                          )}
                          <option value="กำลังรับออเดอร์">กำลังรับออเดอร์</option>
                          <option value="รับออเดอร์เสร็จสิ้น">รับออเดอร์เสร็จสิ้น</option>
                          <option value="คำสั่งซื้อสำเร็จ">คำสั่งซื้อสำเร็จ</option>
                        </select>

                        {/* ปุ่มด้านขวา: ขนาดคงที่เสมอ */}
                        {od.orderStatus === "ยกเลิก" ? (
                          // แถวที่ถูกยกเลิกแล้ว -> ปุ่ม "แก้ไข"
                          <button
                            onClick={() => {
                              setEditCancelId(od.id);
                              setEditReason(od.cancelReason || "");
                              setEditNote(od.cancelNote || "");
                              setEditCancelOpen(true);
                            }}
                            className="h-9 min-w-[84px] inline-flex items-center justify-center gap-1 px-3 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                            title="แก้ไขเหตุผล/หมายเหตุการยกเลิก"
                          >
                            แก้ไข
                          </button>
                        ) : (
                          // แถวอื่น ๆ -> ปุ่ม "ยกเลิก" (ถ้า 'คำสั่งซื้อสำเร็จ' ก็ disabled แต่ยังคงที่)
                          <button
                            onClick={() => {
                              if (od.orderStatus !== "คำสั่งซื้อสำเร็จ") onCancel(od.id);
                            }}
                            disabled={od.orderStatus === "คำสั่งซื้อสำเร็จ"}
                            className={`h-9 min-w-[84px] inline-flex items-center justify-center gap-1 px-3 rounded-lg ${od.orderStatus === "คำสั่งซื้อสำเร็จ"
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-red-100 text-red-700 hover:bg-red-200"
                              }`}
                            title={
                              od.orderStatus === "คำสั่งซื้อสำเร็จ"
                                ? "ออเดอร์สำเร็จแล้ว ไม่สามารถยกเลิกได้"
                                : "ยกเลิกออเดอร์"
                            }
                          >
                            <XCircle className="h-4 w-4" />
                            ยกเลิก
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination (client-side) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg border hover:bg-gray-50"
            disabled={pageSafe <= 1}
          >
            ก่อนหน้า
          </button>
          <div className="text-sm text-gray-600">
            หน้า {pageSafe} / {totalPages} (ทั้งหมด {total.toLocaleString()} รายการ)
          </div>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 rounded-lg border hover:bg-gray-50"
            disabled={pageSafe >= totalPages}
          >
            ถัดไป
          </button>
        </div>
      )}

      {/* Modal: ส่งสถานที่นัดรับ (bulk) */}
      {pickupOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="p-5 border-b">
              <div className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <MapPin className="h-5 w-5" /> ส่งสถานที่นัดรับ
              </div>
              <div className="text-sm text-gray-500 mt-1">
                ออเดอร์ที่เลือก: {selectedReadyIds.length.toLocaleString()} รายการ
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  สถานที่นัดรับ *
                </label>
                <input
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="เช่น หน้าร้าน… / จุดนัด…"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  วัน-เวลานัดรับ (ถ้ามี)
                </label>
                <input
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <div className="text-xs text-gray-500 mt-1">
                  * จะถูกบันทึกเป็น UTC (ISO 8601)
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ข้อความเพิ่มเติม (ถ้ามี)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 300))}
                  rows={3}
                  placeholder="เช่น โปรดนำบัตร ปชช. มาแสดง…"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <div className="text-xs text-gray-400 mt-1">
                  เหลือ {300 - (note?.length || 0)} อักขระ
                </div>
              </div>
            </div>
            <div className="p-5 border-t flex items-center justify-end gap-2">
              <button
                onClick={() => setPickupOpen(false)}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                ยกเลิก
              </button>
              <button
                onClick={sendPickup}
                disabled={!canSendPickup}
                className={`px-4 py-2 rounded-lg text-white inline-flex items-center gap-2 ${!canSendPickup
                  ? "bg-blue-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
                  }`}
              >
                <Send className="h-4 w-4" /> ส่งให้ลูกค้า
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: ดูรายละเอียดสถานที่นัดรับ */}
      {viewPickup.open && viewPickup.order && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="p-5 border-b flex items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5" /> รายละเอียดสถานที่นัดรับ
              </div>
              <button
                onClick={() => setViewPickup({ open: false, order: null })}
                className="text-gray-500 hover:text-gray-700"
                aria-label="ปิด"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-2 text-sm">
              <div>
                <b>Order:</b> #{viewPickup.order.id}
              </div>
              <div>
                <b>สถานที่:</b> {viewPickup.order.pickupPlace || "-"}
              </div>
              <div>
                <b>เวลา (เวลาไทย):</b>{" "}
                {viewPickup.order.pickupAt
                  ? fmtTH(viewPickup.order.pickupAt)
                  : "-"}
              </div>
              <div>
                <b>หมายเหตุ:</b> {viewPickup.order.pickupNote || "-"}
              </div>
            </div>

            <div className="p-5 border-t flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  const o = viewPickup.order;
                  const text = [
                    `Order: #${o.id}`,
                    `สถานที่: ${o.pickupPlace || "-"}`,
                    `เวลา(เวลาไทย): ${o.pickupAt ? fmtTH(o.pickupAt) : "-"}`,
                    `หมายเหตุ: ${o.pickupNote || "-"}`,
                  ].join("\n");
                  navigator.clipboard.writeText(text);
                }}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                title="คัดลอกรายละเอียด"
              >
                คัดลอก
              </button>

              <button
                onClick={() => {
                  const o = viewPickup.order;
                  setPlace(o.pickupPlace || "");
                  setWhen(isoToLocalInput(o.pickupAt));
                  setNote(o.pickupNote || "");
                  setSelected(
                    o.orderStatus === "รับออเดอร์เสร็จสิ้น" ? [o.id] : []
                  );
                  setPickupOpen(true);
                  setViewPickup({ open: false, order: null });
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
              >
                แก้ไข
              </button>

              <button
                onClick={() => setViewPickup({ open: false, order: null })}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: ยกเลิกออเดอร์ (ครั้งแรก) */}
      {cancelOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="p-5 border-b flex items-center justify-between">
              <div className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" /> ยกเลิกออเดอร์
              </div>
              <button
                onClick={() => setCancelOpen(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="ปิด"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-sm text-gray-600">
                ยืนยันการยกเลิกออเดอร์ <b>#{cancelId}</b> หรือไม่? <br />
                ระบบจะคืนสต็อกสินค้าโดยอัตโนมัติ
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เลือกสาเหตุการยกเลิก *
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_REASONS.map((r) => {
                    const active = cancelReason === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setCancelReason(r)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition ${active
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  หรือพิมพ์สาเหตุเอง *
                </label>
                <input
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="เช่น ลูกค้าขอเลื่อน / ที่อยู่จัดส่งไม่ถูกต้อง / ..."
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  หมายเหตุเพิ่มเติม (ถ้ามี)
                </label>
                <textarea
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value.slice(0, 300))}
                  rows={3}
                  placeholder="รายละเอียดประกอบ เช่น ช่องทางติดต่อกลับ เหตุผลแบบยาว ฯลฯ"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <div className="text-xs text-gray-400 mt-1">
                  เหลือ {300 - (cancelNote?.length || 0)} อักขระ
                </div>
              </div>
            </div>

            <div className="p-5 border-t flex items-center justify-end gap-2">
              <button
                onClick={() => setCancelOpen(false)}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                ปิด
              </button>
              <button
                onClick={sendCancel}
                disabled={!cancelReason.trim()}
                className={`px-4 py-2 rounded-lg text-white inline-flex items-center gap-2 ${!cancelReason.trim()
                  ? "bg-red-300 cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-700"
                  }`}
              >
                <XCircle className="h-4 w-4" /> ยืนยันยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: แก้ไขเหตุผล/หมายเหตุการยกเลิก (หลังยกเลิกแล้ว) */}
      {editCancelOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="p-5 border-b flex items-center justify-between">
              <div className="text-lg font-semibold tracking-tight">
                แก้ไขเหตุผลการยกเลิก
              </div>
              <button
                onClick={() => setEditCancelOpen(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="ปิด"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-sm text-gray-600">
                Order: <b>#{editCancelId}</b>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เหตุผล *
                </label>
                <input
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="เช่น ลูกค้ายกเลิกเอง / ชำระเงินไม่สำเร็จ / ..."
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  หมายเหตุเพิ่มเติม (ถ้ามี)
                </label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value.slice(0, 300))}
                  rows={3}
                  placeholder="รายละเอียดประกอบ เช่น เบอร์ติดต่อกลับ เหตุผลแบบยาว ฯลฯ"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <div className="text-xs text-gray-400 mt-1">
                  เหลือ {300 - (editNote?.length || 0)} อักขระ
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  className="text-xs text-gray-500 hover:underline"
                  onClick={async () => {
                    if (!window.confirm("ยืนยันล้างเหตุผลและหมายเหตุของคำสั่งซื้อนี้?"))
                      return;
                    try {
                      await adminUpdateCancelInfo(token, editCancelId, {
                        clear: true,
                      });
                      setEditCancelOpen(false);
                      setEditCancelId(null);
                      setEditReason("");
                      setEditNote("");
                      load();
                    } catch (e) {
                      console.error(e);
                      alert(e?.response?.data?.message || "ล้างไม่สำเร็จ");
                    }
                  }}
                >
                  ล้างเหตุผล/หมายเหตุ
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditCancelOpen(false)}
                    className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                  >
                    ปิด
                  </button>
                  <button
                    onClick={async () => {
                      if (!editReason.trim()) {
                        alert("กรุณากรอกเหตุผล");
                        return;
                      }
                      try {
                        await adminUpdateCancelInfo(token, editCancelId, {
                          reason: editReason.trim(),
                          note: editNote?.trim() || undefined,
                        });
                        setEditCancelOpen(false);
                        setEditCancelId(null);
                        setEditReason("");
                        setEditNote("");
                        load();
                      } catch (e) {
                        console.error(e);
                        alert(e?.response?.data?.message || "บันทึกไม่สำเร็จ");
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
                  >
                    บันทึก
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusOrder;
