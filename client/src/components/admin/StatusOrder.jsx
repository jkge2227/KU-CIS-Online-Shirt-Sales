// client/src/components/admin/StatusOrder.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  adminListOrders,
  adminUpdateOrderStatus,
  adminCancelOrder,
  adminDeleteOrder,
  adminBulkSetPickup,
} from "../../api/adminOrders";
import useEcomStore from "../../store/ecom-store";
import { Loader2, Trash2, XCircle, RotateCw, Search, Send, MapPin, Eye } from "lucide-react";

const pill = (status) => {
  if (status === "คำสั่งซื้อสำเร็จ") return "bg-emerald-100 text-emerald-700";
  if (status === "รับออเดอร์เสร็จสิ้น") return "bg-blue-100 text-blue-700";
  if (status === "ยกเลิก") return "bg-red-100 text-red-700";
  return "bg-yellow-100 text-yellow-700";
};

// ====== ตัวเลือกโหมดกรองวันที่ ======
// false = กรองตามวันแบบ UTC (เริ่ม 00:00Z จน <00:00Z วันถัดไป)
// true  = กรองตามวันแบบไทย (Asia/Bangkok) แล้วแปลงเป็น UTC ช่วงเดียวกัน
const FILTER_THAI_DAYS = false;

const DAY_MS = 24 * 60 * 60 * 1000;
const utcStartOfDay = (s) => (s ? new Date(`${s}T00:00:00Z`) : null);
const utcStartOfNextDay = (s) => (s ? new Date(utcStartOfDay(s).getTime() + DAY_MS) : null);

const thaiStartOfDayUTC = (s) => (s ? new Date(`${s}T00:00:00+07:00`) : null);
const thaiStartOfNextDayUTC = (s) =>
  s ? new Date(thaiStartOfDayUTC(s).getTime() + DAY_MS) : null;

// แสดงเวลาเป็น UTC เสมอ
const fmtUTC = (d) =>
  new Date(d).toLocaleString("th-TH", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  });

const StatusOrder = () => {
  const token = useEcomStore((s) => s.token);

  // ====== CONFIG: ช่วงเวลาอัปเดตอัตโนมัติ (มิลลิวินาที) ======
  const POLL_MS = 10000;

  // data
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // filters (server: q, status, page / client: startDate, endDate)
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [startDate, setStartDate] = useState(""); // YYYY-MM-DD
  const [endDate, setEndDate] = useState("");     // YYYY-MM-DD
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });

  // selection for bulk pickup
  const [selected, setSelected] = useState([]);

  // pickup modal
  const [pickupOpen, setPickupOpen] = useState(false);
  const [place, setPlace] = useState("");
  const [when, setWhen] = useState(""); // datetime-local (local browser)
  const [note, setNote] = useState("");

  // view pickup modal
  const [viewPickup, setViewPickup] = useState({ open: false, order: null });

  // expanded product lists per order
  const [expanded, setExpanded] = useState(new Set());
  const toggleExpand = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // auto refresh toggle
  const [autoRefresh] = useState(true);

  // ป้องกันโหลดซ้อน
  const fetchingRef = useRef(false);

  const isoToLocalInput = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // รองรับ soft-load (ไม่โชว์ spinner ทุกครั้งเมื่อเป็นงานเบื้องหลัง)
  const load = async (opts = { silent: false }) => {
    if (!token) return;
    if (opts.silent && fetchingRef.current) return; // กันโหลดซ้ำในเบื้องหลัง
    try {
      fetchingRef.current = true;
      if (!opts.silent) setLoading(true);

      const { data } = await adminListOrders(token, { page, pageSize, status, q });
      const list = data?.data || [];
      setRows(list);
      setMeta(data?.pagination || { total: 0, totalPages: 1 });

      // เก็บ selection เฉพาะที่ยังอยู่ในหน้าปัจจุบัน
      setSelected((prev) => prev.filter((id) => list.some((r) => r.id === id)));

      // ล้าง expanded ของออเดอร์ที่ไม่อยู่ในชุดรายการปัจจุบัน
      setExpanded((prev) => {
        const keep = new Set([...prev].filter((id) => list.some((r) => r.id === id)));
        return keep;
      });
    } catch (e) {
      console.error(e);
      if (!opts.silent) alert(e?.response?.data?.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      fetchingRef.current = false;
      if (!opts.silent) setLoading(false);
    }
  };

  // โหลดเมื่อเปลี่ยน token/page/pageSize/status (โชว์ spinner ครั้งหลัก)
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, pageSize, status]);

  const onSearchClick = () => {
    setPage(1);
    load();
  };

  // ====== Client-side date filtering ======
  const viewRows = useMemo(() => {
    let arr = rows;
    const startFn = FILTER_THAI_DAYS ? thaiStartOfDayUTC : utcStartOfDay;
    const endFn = FILTER_THAI_DAYS ? thaiStartOfNextDayUTC : utcStartOfNextDay;
    const from = startFn(startDate);
    const to = endFn(endDate);
    if (from) arr = arr.filter((od) => new Date(od.createdAt) >= from);
    if (to) arr = arr.filter((od) => new Date(od.createdAt) < to);
    return arr;
  }, [rows, startDate, endDate]);

  // selection helpers (based on filtered rows)
  const allInPageIds = viewRows.map((r) => r.id);
  const allSelectedInPage =
    allInPageIds.length > 0 && allInPageIds.every((id) => selected.includes(id));

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

  // allow pickup only for 'รับออเดอร์เสร็จสิ้น'
  const selectedReadyIds = selected.filter((id) => {
    const row = rows.find((r) => r.id === id);
    return row?.orderStatus === "รับออเดอร์เสร็จสิ้น";
  });

  const canSendPickup = selectedReadyIds.length > 0 && place.trim().length > 0;

  const openPickup = () => setPickupOpen(true);
  const closePickup = () => {
    setPickupOpen(false);
    setPlace("");
    setWhen("");
    setNote("");
  };

  const sendPickup = async () => {
    if (!canSendPickup) return;
    try {
      await adminBulkSetPickup(token, {
        orderIds: selectedReadyIds,
        place: place.trim(),
        pickupAt: when ? new Date(when).toISOString() : undefined, // เซฟเป็น UTC ISO
        note: note?.trim() || undefined,
      });
      alert(`ตั้งค่านัดรับให้ ${selectedReadyIds.length} ออเดอร์แล้ว`);
      closePickup();
      load();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "ตั้งค่านัดรับไม่สำเร็จ");
    }
  };

  const onQuickStatus = async (id, next) => {
    try {
      await adminUpdateOrderStatus(token, id, next);
      load({ silent: true });
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "อัปเดตสถานะไม่สำเร็จ");
    }
  };

  const onCancel = async (id) => {
    if (!confirm("ยืนยันยกเลิกออเดอร์นี้? (ระบบจะคืนสต็อกให้)")) return;
    try {
      await adminCancelOrder(token, id);
      load({ silent: true });
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "ยกเลิกไม่สำเร็จ");
    }
  };

  const onDelete = async (id) => {
    if (!confirm("ยืนยันลบออเดอร์นี้? (หากยังไม่ยกเลิก ระบบจะคืนสต็อกก่อนลบ)")) return;
    try {
      await adminDeleteOrder(token, id);
      load({ silent: true });
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "ลบไม่สำเร็จ");
    }
  };

  // ====== Auto Refresh: Polling ทุก POLL_MS ======
  useEffect(() => {
    if (!token || !autoRefresh) return;
    const id = setInterval(() => {
      load({ silent: true });
    }, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, autoRefresh, page, pageSize, status, q]);

  // ====== รีโหลดเมื่อกลับมาโฟกัสแท็บ/หน้าต่าง ======
  useEffect(() => {
    const onFocus = () => load({ silent: true });
    const onVis = () => { if (!document.hidden) load({ silent: true }); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, pageSize, status, q]);

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4">
        <h1 className="text-2xl font-bold">คำสั่งซื้อทั้งหมด</h1>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {/* Search */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="pl-9 pr-3 py-2 w-64 border rounded-lg"
                placeholder="ค้นหา: ออเดอร์/เบอร์/อีเมล"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearchClick()}
              />
            </div>
            <button
              onClick={onSearchClick}
              className="px-3 py-2 rounded-lg border hover:bg-gray-50"
              title="ค้นหา"
            >
              ค้นหา
            </button>
          </div>

          {/* Status */}
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

          {/* Date filter (client-side) */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="border rounded-lg px-3 py-2"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title={FILTER_THAI_DAYS ? "วันที่เริ่ม (วันไทย)" : "วันที่เริ่ม (UTC)"}
            />
            <span className="text-gray-500">ถึง</span>
            <input
              type="date"
              className="border rounded-lg px-3 py-2"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title={FILTER_THAI_DAYS ? "วันที่สิ้นสุด (วันไทย)" : "วันที่สิ้นสุด (UTC)"}
            />
          </div>

          {/* Refresh */}
          <button
            onClick={() => {
              setPage(1);
              load();
            }}
            className="px-3 py-2 rounded-lg border hover:bg-gray-50"
            title="รีเฟรช"
          >
            <RotateCw className="h-4 w-4 inline mr-1" />
            รีเฟรช
          </button>
        </div>
      </div>

      {/* Bulk Toolbar */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-600">
          เลือกแล้ว <b>{selected.length}</b> รายการ{" "}
          {selected.length > 0 && `(${selectedReadyIds.length} ที่อยู่ในสถานะ 'รับออเดอร์เสร็จสิ้น')`}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => selectedReadyIds.length > 0 && setPickupOpen(true)}
            disabled={selectedReadyIds.length === 0}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ring-1 ${selectedReadyIds.length === 0
              ? "bg-gray-100 text-gray-400 ring-gray-200 cursor-not-allowed"
              : "bg-blue-50 text-blue-700 ring-blue-200 hover:bg-blue-100"
              }`}
            title="ส่งสถานที่นัดรับให้หลายคำสั่งซื้อ"
          >
            <MapPin className="h-4 w-4" />
            ส่งสถานที่นัดรับ
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
                        {fmtUTC(od.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {od.orderBuy?.first_name} {od.orderBuy?.last_name}
                      </div>
                      <div className="text-xs text-gray-500">{od.orderBuy?.email}</div>
                      <div className="text-xs text-gray-500">{od.orderBuy?.phone}</div>
                    </td>

                    {/* สินค้า: แสดง 2 รายการแรก และกดเพื่อขยาย/ย่อ */}
                    <td className="px-4 py-3">
                      {(() => {
                        const all = od.products || [];
                        const isOpen = expanded.has(od.id);
                        const show = isOpen ? all : all.slice(0, 2);

                        return (
                          <div className="space-y-1">
                            {show.map((p) => (
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
                                    {p.generationName ? ` / ${p.generationName}` : ""} × {p.count}
                                  </div>
                                </div>
                              </div>
                            ))}

                            {all.length > 2 && (
                              <button
                                type="button"
                                onClick={() => toggleExpand(od.id)}
                                className="text-xs text-blue-600 hover:underline"
                                title={isOpen ? "ย่อรายการ" : `ดูอีก ${all.length - 2} รายการ`}
                              >
                                {isOpen ? "ย่อรายการ" : `+ อีก ${all.length - 2} รายการ`}
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold">
                      {total.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${pill(
                          od.orderStatus
                        )}`}
                      >
                        {od.orderStatus}
                      </span>
                    </td>

                    {/* ปุ่มดูรายละเอียดนัดรับ (ปุ่มเดียว ไม่มีปุ่มซ้อน) */}
                    <td className="px-4 py-3">
                      {(od.pickupPlace || od.pickupAt || od.pickupNote) && (
                        <button
                          type="button"
                          onClick={() => setViewPickup({ open: true, order: od })}
                          className="relative z-10 mt-0 w-full text-left text-xs rounded-lg bg-blue-50 text-blue-800 ring-1 ring-blue-200 p-1.5 hover:bg-blue-100 focus:outline-none pointer-events-auto"
                          title="กดเพื่อดูรายละเอียดสถานที่นัดรับ"
                        >
                          <div className="flex items-center mb-0.5">
                            <span className="ml-auto inline-flex items-center gap-1 leading-none select-none">
                              <Eye className="h-3 w-3 shrink-0" />
                              <span className="text-[10px]">ดูรายละเอียด</span>
                            </span>
                          </div>
                        </button>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <select
                          className="border rounded-lg px-2 py-1 text-sm"
                          value={od.orderStatus}
                          onChange={(e) => onQuickStatus(od.id, e.target.value)}
                        >
                          <option value="กำลังรับออเดอร์">กำลังรับออเดอร์</option>
                          <option value="รับออเดอร์เสร็จสิ้น">รับออเดอร์เสร็จสิ้น</option>
                          <option value="คำสั่งซื้อสำเร็จ">คำสั่งซื้อสำเร็จ</option>
                        </select>

                        <button
                          onClick={() => onCancel(od.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                          title="ยกเลิกออเดอร์"
                        >
                          <XCircle className="h-4 w-4" /> ยกเลิก
                        </button>

                        <button
                          onClick={() => onDelete(od.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200"
                          title="ลบออเดอร์"
                        >
                          <Trash2 className="h-4 w-4" /> ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination (server) */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg border hover:bg-gray-50"
            disabled={page <= 1}
          >
            ก่อนหน้า
          </button>
          <div className="text-sm text-gray-600">
            หน้า {page} / {meta.totalPages} (ทั้งหมด {meta.total.toLocaleString()} รายการ)
          </div>
          <button
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            className="px-3 py-1.5 rounded-lg border hover:bg-gray-50"
            disabled={page >= meta.totalPages}
          >
            ถัดไป
          </button>
        </div>
      )}

      {/* Modal: ส่งสถานที่นัดรับ */}
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
                  placeholder="เช่น หน้าร้านสาขา… / จุดนัด…"
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
                onClick={closePickup}
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
                <MapPin className="h-5 w-5" />
                รายละเอียดสถานที่นัดรับ
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
                <b>เวลา (UTC):</b>{" "}
                {viewPickup.order.pickupAt ? fmtUTC(viewPickup.order.pickupAt) : "-"}
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
                    `เวลา(UTC): ${o.pickupAt ? fmtUTC(o.pickupAt) : "-"}`,
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
                  setWhen(isoToLocalInput(o.pickupAt)); // เปิดแก้ไขโดยพรีฟิลด์
                  setNote(o.pickupNote || "");
                  // แก้เฉพาะออเดอร์นี้ (ถ้าสถานะอนุญาต)
                  setSelected(o.orderStatus === "รับออเดอร์เสร็จสิ้น" ? [o.id] : []);
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
    </div>
  );
};

export default StatusOrder;
