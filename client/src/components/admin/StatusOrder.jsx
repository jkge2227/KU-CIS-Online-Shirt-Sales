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
  Search,
  Send,
  MapPin,
  Eye,
  CheckCircle,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  PackageOpen,
  Bell,
} from "lucide-react";

/* =========================
   OrderStatus adapters
   ========================= */
const STATUS = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED",
};
const DISPLAY_TH = {
  [STATUS.PENDING]: "ผู้ขายได้รับคำสั่งซื้อแล้ว",
  [STATUS.CONFIRMED]: "ผู้ขายจัดเตรียมสินค้าแล้วรอผู้ซื้อมารับ",
  [STATUS.COMPLETED]: "ผู้ซื้อมารับสินค้าแล้ว",
  [STATUS.CANCELED]: "ยกเลิก",
};
const KNOWN_THAI = {
  "ผู้ขายได้รับคำสั่งซื้อแล้ว": STATUS.PENDING,
  "ผู้ขายจัดเตรียมสินค้าแล้วรอผู้ซื้อมารับ": STATUS.CONFIRMED,
  "ผู้ซื้อมารับสินค้าแล้ว": STATUS.COMPLETED,
  ยกเลิก: STATUS.CANCELED,
};
const toEnumStatus = (od) => {
  if (od.orderStatusEnum && STATUS[od.orderStatusEnum]) return od.orderStatusEnum;
  const raw = String(od.orderStatus || od.orderStatusText || "").trim();
  return STATUS[raw] || KNOWN_THAI[raw] || STATUS.PENDING;
};
const toThai = (e) => DISPLAY_TH[e] || DISPLAY_TH[STATUS.PENDING];
const pill = (s) =>
  s === STATUS.COMPLETED
    ? "bg-emerald-100 text-emerald-700"
    : s === STATUS.CONFIRMED
      ? "bg-blue-100 text-blue-700"
      : s === STATUS.CANCELED
        ? "bg-red-100 text-red-700"
        : "bg-yellow-100 text-yellow-700";

/* =========================
   Allowed status transitions (one-way)
   ========================= */
const allowedStatusOptions = (current) => {
  switch (current) {
    case STATUS.PENDING:
      return [STATUS.PENDING, STATUS.CONFIRMED]; // ไปต่อได้แค่ CONFIRMED
    case STATUS.CONFIRMED:
      return [STATUS.CONFIRMED, STATUS.COMPLETED]; // ไปต่อได้แค่ COMPLETED
    case STATUS.COMPLETED:
      return [STATUS.COMPLETED]; // ดูอย่างเดียว
    case STATUS.CANCELED:
      return [STATUS.CANCELED]; // ดูอย่างเดียว
    default:
      return [STATUS.PENDING];
  }
};

/* =========================
   เวลาไทย & ค้นหา
   ========================= */
const TZ_TH = "Asia/Bangkok";
const fmtTH = (d) =>
  new Date(d).toLocaleString("th-TH", {
    timeZone: TZ_TH,
    dateStyle: "medium",
    timeStyle: "short",
  });

const FILTER_THAI_DAYS = true;
// 00:00 ของไทย = -7 ชั่วโมงใน UTC
const thDayStartUTC = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, -7, 0, 0, 0));
};
const thNextDayStartUTC = (s) => {
  const base = thDayStartUTC(s);
  return base ? new Date(base.getTime() + 24 * 60 * 60 * 1000) : null;
};

const norm = (str) =>
  String(str || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const buildSearchIndex = (od) => {
  const parts = [
    `#${od.id}`,
    toThai(toEnumStatus(od)),
    od.orderBuy?.first_name || "",
    od.orderBuy?.last_name || "",
    od.orderBuy?.email || "",
    od.orderBuy?.phone || "",
    ...(od.products || []).flatMap((p) => [
      p.productTitle || "",
      p.sizeName || "",
      p.generationName || "",
    ]),
    od.pickupPlace || "",
    od.pickupNote || "",
  ];
  return norm(parts.join(" | "));
};

const calcTotal = (od) =>
  (od.products || []).reduce(
    (s, p) => s + Number(p.price) * Number(p.count),
    0
  );

/* =========================
   เงื่อนไขข้อมูลนัดรับ
   ========================= */
const hasPickupInfo = (od) => !!String(od?.pickupPlace || "").trim();

// ===== Pagination config =====
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];

/* Debounce hook สำหรับช่องค้นหา */
const useDebounced = (value, delay = 250) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
};

const StatusOrder = () => {
  const token = useEcomStore((s) => s.token);
  const topRef = useRef(null);

  // data
  const [rowsRaw, setRowsRaw] = useState([]);
  const rowsRawRef = useRef([]); // snapshot ล่าสุดที่เรา render แล้ว
  const [loading, setLoading] = useState(false);

  // เปิด/ปิดการ auto refresh
  const [autoRefresh, setAutoRefresh] = useState(false);

  // เก็บ id ออเดอร์ก่อนหน้าเพื่อตรวจว่ามีออเดอร์ใหม่ไหม
  const prevOrderIdsRef = useRef([]);
  const hasShownNewToastRef = useRef(false); // ป้องกัน spam toast

  // filters
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const qDebounced = useDebounced(q, 250);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // pagination
  const [pageSize, setPageSize] = useState(() => {
    const saved = Number(localStorage.getItem("admin_order_page_size"));
    return PAGE_SIZE_OPTIONS.includes(saved) ? saved : DEFAULT_PAGE_SIZE;
  });
  const [page, setPage] = useState(1);

  // selection
  const [selected, setSelected] = useState([]);

  // pickup modals
  const [pickupOpen, setPickupOpen] = useState(false);
  const [place, setPlace] = useState("");
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [viewPickup, setViewPickup] = useState({ open: false, order: null });

  // cancel modals
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

  // edit cancel info
  const [editCancelOpen, setEditCancelOpen] = useState(false);
  const [editCancelId, setEditCancelId] = useState(null);
  const [editReason, setEditReason] = useState("");
  const [editNote, setEditNote] = useState("");

  // expand rows
  const [expandedOrders, setExpandedOrders] = useState({});
  const toggleExpand = (id) =>
    setExpandedOrders((p) => ({ ...p, [id]: !p[id] }));

  // toast
  const [toast, setToast] = useState({
    open: false,
    msg: "",
    type: "success", // "success" | "error" | "info" | "new"
  });
  const toastTimerRef = useRef(null);
  const showToast = (msg, type = "success", ms = 2500) => {
    setToast({ open: true, msg, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(
      () => setToast((t) => ({ ...t, open: false })),
      ms
    );
  };
  useEffect(
    () => () =>
      toastTimerRef.current && clearTimeout(toastTimerRef.current),
    []
  );

  // ESC ปิดโมดัล
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (pickupOpen) setPickupOpen(false);
        if (viewPickup.open)
          setViewPickup({ open: false, order: null });
        if (cancelOpen) setCancelOpen(false);
        if (editCancelOpen) setEditCancelOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickupOpen, viewPickup.open, cancelOpen, editCancelOpen]);

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border bg-white p-10 text-center">
      <PackageOpen className="h-10 w-10 text-gray-400" />
      <div className="text-base font-semibold text-gray-800">
        ยังไม่มีคำสั่งซื้อ
      </div>
      <p className="text-sm text-gray-500">
        เมื่อคุณสั่งซื้อสินค้า ระบบจะแสดงรายการคำสั่งซื้อไว้ที่นี่
      </p>
    </div>
  );

  // โหลดข้อมูล (แบบมี silent mode)
  const load = async ({
    preserveSelection = false,
    preservePage = false,
    silent = false, // ถ้า true = ไม่แกว่ง loading, ไม่รบกวน UI
  } = {}) => {
    if (!token) return;
    try {
      if (!silent) {
        setLoading(true);
      }

      const { data } = await adminListOrders(token, { page: 1, pageSize: 500 });
      const list = data?.data || data?.orders || [];
      const safeList = Array.isArray(list) ? list : [];

      // เปิด/ปิด autoRefresh เมื่อมี/ไม่มีออเดอร์
      setAutoRefresh(safeList.length > 0);

      // ----- (A) ตรวจคำสั่งซื้อใหม่ -----
      const incomingIds = safeList.map((od) => od.id);
      const prevIds = prevOrderIdsRef.current;
      const hasNewOrder = incomingIds.some((id) => !prevIds.includes(id));

      if (hasNewOrder && !hasShownNewToastRef.current) {
        showToast("มีคำสั่งซื้อใหม่เข้ามา", "new", 3000);
        hasShownNewToastRef.current = true;
        setTimeout(() => {
          hasShownNewToastRef.current = false;
        }, 5000);
      }

      prevOrderIdsRef.current = incomingIds;

      // ----- (B) เช็คว่าข้อมูลเปลี่ยนจริงไหม -----
      // เปรียบเทียบแบบเบาๆ: ความยาว + (id, updatedAt) รายแถว
      const prevRows = rowsRawRef.current;
      const isSameLength = prevRows.length === safeList.length;
      let sameContent = isSameLength;

      if (sameContent) {
        for (let i = 0; i < safeList.length; i++) {
          const a = safeList[i];
          const b = prevRows[i];
          if (!b || a.id !== b.id || a.updatedAt !== b.updatedAt) {
            sameContent = false;
            break;
          }
        }
      }

      if (!sameContent) {
        setRowsRaw(safeList);
        rowsRawRef.current = safeList;
      }
      // ถ้าข้อมูลเหมือนเดิม เราจะไม่ setRowsRaw → React ไม่ re-render

      // ----- (C) auto-select ครั้งแรกเท่านั้น -----
      if (!preserveSelection) {
        const autoSelected = safeList
          .filter(
            (od) =>
              toEnumStatus(od) === STATUS.CONFIRMED &&
              !hasPickupInfo(od)
          )
          .map((od) => od.id);
        setSelected(autoSelected);
      }

      // ----- (D) กลับไปหน้า 1 ครั้งแรกเท่านั้น -----
      if (!preservePage) {
        setPage(1);
      }
    } catch (e) {
      console.error(e);
      showToast(
        e?.response?.data?.message || "โหลดข้อมูลไม่สำเร็จ",
        "error",
        3500
      );
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // โหลดครั้งแรกเมื่อ token พร้อม
  useEffect(() => {
    load({
      preserveSelection: false,
      preservePage: false,
      silent: false, // initial load → แสดง loader ได้
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // auto refresh ทุก 15 วิ แต่เฉพาะตอนที่มีออเดอร์ (autoRefresh = true)
  useEffect(() => {
    if (!token) return;
    if (!autoRefresh) return; // ถ้ายังไม่มีออเดอร์เลย -> ไม่ต้องตั้ง interval

    const iv = setInterval(() => {
      load({
        preserveSelection: true,
        preservePage: true,
        silent: true, // ไม่แกว่ง loading, ไม่ reset อะไร
      });
    }, 15000);

    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, autoRefresh]);

  // search index
  const searchMap = useMemo(() => {
    const m = new Map();
    for (const od of rowsRaw) m.set(od.id, buildSearchIndex(od));
    return m;
  }, [rowsRaw]);

  // rowById map สำหรับ lookup เร็ว ๆ
  const rowById = useMemo(() => {
    const m = new Map();
    rowsRaw.forEach((r) => m.set(r.id, r));
    return m;
  }, [rowsRaw]);

  // filter client
  const filteredRows = useMemo(() => {
    let arr = rowsRaw;
    if (status) arr = arr.filter((od) => toEnumStatus(od) === status);

    const from = FILTER_THAI_DAYS ? thDayStartUTC(startDate) : null;
    const to = FILTER_THAI_DAYS ? thNextDayStartUTC(endDate) : null;
    if (from) arr = arr.filter((od) => new Date(od.createdAt) >= from);
    if (to) arr = arr.filter((od) => new Date(od.createdAt) < to);

    const qq = norm(qDebounced);
    if (qq)
      arr = arr.filter((od) =>
        (searchMap.get(od.id) || "").includes(qq)
      );

    return arr;
  }, [rowsRaw, status, startDate, endDate, qDebounced, searchMap]);

  // ลบ selection ที่ไม่อยู่ในผลลัพธ์หลังฟิลเตอร์
  useEffect(() => {
    const ids = new Set(filteredRows.map((r) => r.id));
    setSelected((prev) => prev.filter((id) => ids.has(id)));
  }, [filteredRows]);

  // pagination derive
  const totalOrders = filteredRows.length;
  const totalPages = Math.max(
    1,
    Math.ceil(totalOrders / pageSize)
  );
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalOrders);
  const displayFrom = totalOrders === 0 ? 0 : startIndex + 1;
  const displayTo = totalOrders === 0 ? 0 : endIndex;

  const viewRows = useMemo(
    () => filteredRows.slice(startIndex, endIndex),
    [filteredRows, startIndex, endIndex]
  );

  const goToPage = (p) => {
    const clamped = Math.min(Math.max(1, p), totalPages);
    if (clamped !== page) {
      setPage(clamped);
      setTimeout(() => {
        if (topRef.current)
          topRef.current.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        else
          window.scrollTo({
            top: 0,
            behavior: "smooth",
          });
      }, 0);
    }
  };
  const onChangePageSize = (e) => {
    const n = Number(e.target.value);
    setPageSize(n);
    localStorage.setItem(
      "admin_order_page_size",
      String(n)
    );
    setPage(1);
  };

  // selection helpers
  const allInPageIds = viewRows.map((r) => r.id);
  const allSelectedInPage =
    allInPageIds.length > 0 &&
    allInPageIds.every((id) => selected.includes(id));
  const toggleOne = (id) =>
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  const toggleAllInPage = () =>
    setSelected((prev) =>
      allSelectedInPage
        ? prev.filter(
          (id) => !allInPageIds.includes(id)
        )
        : Array.from(
          new Set([...prev, ...allInPageIds])
        )
    );

  // pickup enable
  const selectedReadyIds = useMemo(
    () =>
      selected.filter(
        (id) =>
          toEnumStatus(rowById.get(id) || {}) ===
          STATUS.CONFIRMED
      ),
    [selected, rowById]
  );
  const canSendPickup =
    selectedReadyIds.length > 0 &&
    place.trim().length > 0;

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
    return `${d.getFullYear()}-${pad(
      d.getMonth() + 1
    )}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  };

  // actions
  const sendPickup = async () => {
    if (!canSendPickup) return;
    try {
      await adminBulkSetPickup(token, {
        orderIds: selectedReadyIds,
        place: place.trim(),
        pickupAt: when
          ? new Date(when).toISOString()
          : undefined,
        note: note?.trim() || undefined,
      });
      showToast(
        `ตั้งค่านัดรับให้ ${selectedReadyIds.length} ออเดอร์แล้ว`,
        "success"
      );
      closePickup();
      load({
        preserveSelection: true,
        preservePage: true,
        silent: false,
      });
    } catch (e) {
      console.error(e);
      showToast(
        e?.response?.data?.message ||
        "ตั้งค่านัดรับไม่สำเร็จ",
        "error",
        3500
      );
    }
  };

  const onQuickStatus = async (id, nextEnum) => {
    const row = rowById.get(id);
    const current = toEnumStatus(row || {});
    const allowed = new Set(
      allowedStatusOptions(current)
    );

    if (!allowed.has(nextEnum)) {
      showToast(
        `ไม่อนุญาตให้ย้อนสถานะ (#${id} จาก '${toThai(
          current
        )}' ไป '${toThai(nextEnum)}')`,
        "error",
        3500
      );
      return;
    }

    // ต้องมีสถานที่นัดรับก่อนเปลี่ยนเป็น COMPLETED
    if (
      current === STATUS.CONFIRMED &&
      nextEnum === STATUS.COMPLETED
    ) {
      if (!hasPickupInfo(row)) {
        showToast(
          "กรุณาส่งสถานที่นัดรับก่อนเปลี่ยนเป็น 'ผู้ซื้อมารับสินค้าแล้ว'",
          "error",
          3500
        );
        // เปิดโมดัล 'ส่งสถานที่นัดรับ' พร้อมติ๊กออเดอร์นี้ให้
        setPlace(row?.pickupPlace || "");
        setWhen(isoToLocalInput(row?.pickupAt));
        setNote(row?.pickupNote || "");
        setSelected([id]);
        setPickupOpen(true);
        return;
      }
    }

    if (current === nextEnum) return; // เลือกสถานะเดิม ไม่ต้องยิง API

    try {
      await adminUpdateOrderStatus(token, id, nextEnum);

      // ถ้าเพิ่งเปลี่ยนเป็น CONFIRMED แล้วยังไม่มี pickup -> auto-select
      if (
        nextEnum === STATUS.CONFIRMED &&
        !hasPickupInfo(row)
      ) {
        setSelected((prev) =>
          Array.from(new Set([...prev, id]))
        );
      }

      showToast(
        `อัปเดตสถานะ #${id} -> ${toThai(
          nextEnum
        )}`,
        "success"
      );

      load({
        preserveSelection: true,
        preservePage: true,
        silent: false,
      });
    } catch (e) {
      console.error(e);
      showToast(
        e?.response?.data?.message ||
        "อัปเดตสถานะไม่สำเร็จ",
        "error",
        3500
      );
    }
  };

  const onCancel = (id) => {
    setCancelId(id);
    setCancelReason("");
    setCancelNote("");
    setCancelOpen(true);
  };
  const sendCancel = async () => {
    if (!cancelId) return;
    if (!cancelReason.trim()) {
      showToast(
        "กรุณาเลือก/กรอกสาเหตุการยกเลิก",
        "error"
      );
      return;
    }
    try {
      await adminCancelOrder(token, cancelId, {
        reason: cancelReason.trim(),
        note:
          cancelNote?.trim() ||
          undefined,
      });
      setCancelOpen(false);
      setCancelId(null);
      setCancelReason("");
      setCancelNote("");
      showToast(
        `ยกเลิกออเดอร์ #${cancelId} สำเร็จ`,
        "success"
      );
      load({
        preserveSelection: true,
        preservePage: true,
        silent: false,
      });
    } catch (e) {
      console.error(e);
      showToast(
        e?.response?.data?.message ||
        "ยกเลิกไม่สำเร็จ",
        "error",
        3500
      );
    }
  };

  // render
  return (
    <div className="max-w-7xl mx-auto p-6" ref={topRef}>
      {/* Toast */}
      {toast.open && (
        <div className="fixed top-4 left-0 right-0 z-[9999] flex justify-center pointer-events-none">
          <div
            className={[
              "pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 shadow-lg ring-1",

              // success = เขียว
              toast.type === "success" &&
              "bg-emerald-50 text-emerald-700 ring-emerald-200",

              // error = แดง
              toast.type === "error" &&
              "bg-red-50 text-red-700 ring-red-200",

              // info = น้ำเงิน (ทั่วไป)
              toast.type === "info" &&
              "bg-blue-50 text-blue-700 ring-blue-200",

              // new = ออเดอร์ใหม่เข้ามา → เหลือง
              toast.type === "new" &&
              "bg-amber-50 text-amber-700 ring-amber-200 border-amber-200",
            ]
              .filter(Boolean)
              .join(" ")}
            role="status"
            aria-live="polite"
          >
            {toast.type === "success" && (
              <CheckCircle className="h-5 w-5 shrink-0" />
            )}

            {toast.type === "error" && (
              <XCircle className="h-5 w-5 shrink-0" />
            )}

            {toast.type === "info" && (
              <MapPin className="h-5 w-5 shrink-0" />
            )}

            {toast.type === "new" && (
              <Bell className="h-5 w-5 shrink-0" />
            )}

            <span className="text-sm">{toast.msg}</span>

            <button
              type="button"
              onClick={() =>
                setToast((t) => ({ ...t, open: false }))
              }
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
        <h1 className="text-2xl font-bold">
          คำสั่งซื้อทั้งหมด
        </h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {/* Search */}
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
              type="button"
              onClick={() => setQ("")}
              className="px-3 py-2 rounded-lg border hover:bg-gray-50"
              title="ล้างคำค้น"
            >
              ล้าง
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
            title="กรองสถานะ"
          >
            <option value="">ทุกสถานะ</option>
            <option value={STATUS.PENDING}>
              {DISPLAY_TH[STATUS.PENDING]}
            </option>
            <option value={STATUS.CONFIRMED}>
              {DISPLAY_TH[STATUS.CONFIRMED]}
            </option>
            <option value={STATUS.COMPLETED}>
              {DISPLAY_TH[STATUS.COMPLETED]}
            </option>
            <option value={STATUS.CANCELED}>
              {DISPLAY_TH[STATUS.CANCELED]}
            </option>
          </select>

          {/* Date filter */}
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
        </div>
      </div>

      {/* Bulk toolbar */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-600">
          <p className="text-black">
            ทำการเลือกรายการเพื่อส่งจุดนัดรับเสื้อ
          </p>
          เลือกแล้ว <b>{selected.length}</b>{" "}
          รายการ{" "}
          {selected.length > 0 &&
            `(${selectedReadyIds.length} รายการที่อยู่สถานะ '${DISPLAY_TH[STATUS.CONFIRMED]}')`}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              selectedReadyIds.length > 0 &&
              setPickupOpen(true)
            }
            disabled={selectedReadyIds.length === 0}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ring-1 ${selectedReadyIds.length === 0
                ? "bg-gray-100 text-gray-400 ring-gray-200 cursor-not-allowed"
                : "bg-blue-50 text-blue-700 ring-blue-200 hover:bg-blue-100"
              }`}
            title="ทำการเลือกรายการก่อน"
          >
            <MapPin className="h-4 w-4" /> ส่งสถานที่นัดรับ
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12 text-gray-500">
          <Loader2 className="animate-spin h-6 w-6 mr-2" />{" "}
          กำลังโหลด…
        </div>
      ) : viewRows.length === 0 ? (
        <div>
          <EmptyState />
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border rounded-xl">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    ref={(el) => {
                      if (el)
                        el.indeterminate =
                          !allSelectedInPage &&
                          selected.some((id) =>
                            allInPageIds.includes(id)
                          );
                    }}
                    checked={allSelectedInPage}
                    onChange={toggleAllInPage}
                    title="เลือกทั้งหมดในหน้านี้"
                    aria-label="เลือกทั้งหมดในหน้านี้"
                  />
                </th>
                <th
                  className="px-4 py-3 text-left"
                  scope="col"
                >
                  เลขคำสั่งซื้อ
                </th>
                <th
                  className="px-4 py-3 text-left"
                  scope="col"
                >
                  ลูกค้า
                </th>
                <th
                  className="px-4 py-3 text-left"
                  scope="col"
                >
                  สินค้า
                </th>
                <th
                  className="px-4 py-3 text-right"
                  scope="col"
                >
                  รวม (฿)
                </th>
                <th
                  className="px-4 py-3 text-center"
                  scope="col"
                >
                  สถานะ
                </th>
                <th
                  className="px-4 py-3 text-center"
                  scope="col"
                >
                  สถานที่นัดรับ
                </th>
                <th
                  className="px-4 py-3 text-center"
                  scope="col"
                >
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody>
              {viewRows.map((od) => {
                const enumStatus = toEnumStatus(od);
                const statusText = toThai(enumStatus);
                const total = calcTotal(od);
                const checked = selected.includes(od.id);
                const canSelect =
                  enumStatus === STATUS.CONFIRMED;
                const cancelDisabled =
                  enumStatus === STATUS.COMPLETED;

                const isExpanded =
                  !!expandedOrders[od.id];
                const products = od.products || [];
                const visible = isExpanded
                  ? products
                  : products.slice(0, 3);
                const hiddenCount = Math.max(
                  0,
                  products.length - 3
                );

                const options =
                  allowedStatusOptions(enumStatus);

                return (
                  <tr key={od.id} className="border-t">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          toggleOne(od.id)
                        }
                        disabled={!canSelect}
                        title={
                          canSelect
                            ? "เลือกออเดอร์นี้"
                            : `เลือกไม่ได้ (สถานะไม่ใช่ '${DISPLAY_TH[STATUS.CONFIRMED]}')`
                        }
                        aria-label={
                          canSelect
                            ? "เลือกออเดอร์นี้"
                            : "เลือกไม่ได้"
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">
                        #{od.id}
                      </div>
                      <div className="text-xs text-gray-500">
                        {fmtTH(od.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {od.orderBuy?.first_name}{" "}
                        {od.orderBuy?.last_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {od.orderBuy?.email}
                      </div>
                      <div className="text-xs text-gray-500">
                        {od.orderBuy?.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {visible.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2"
                        >
                          {p.variant?.product
                            ?.images?.[0]?.url ? (
                            <img
                              src={
                                p.variant.product
                                  .images[0].url
                              }
                              className="h-8 w-8 rounded object-cover border"
                              alt=""
                            />
                          ) : (
                            <div className="h-8 w-8 rounded bg-gray-100 border" />
                          )}
                          <div className="truncate">
                            <div className="truncate">
                              {p.productTitle}
                            </div>
                            <div className="text-xs text-gray-500">
                              {p.sizeName}
                              {p.generationName
                                ? ` / ${p.generationName}`
                                : ""}{" "}
                              × {p.count}
                            </div>
                          </div>
                        </div>
                      ))}

                      {products.length > 3 &&
                        !isExpanded && (
                          <button
                            type="button"
                            onClick={() =>
                              toggleExpand(
                                od.id
                              )
                            }
                            className="text-xs text-gray-500 underline underline-offset-2 mt-1 hover:text-gray-700"
                            aria-expanded="false"
                            aria-controls={`order-${od.id}-products`}
                            title="แสดงสินค้าทั้งหมดในออเดอร์นี้"
                          >
                            + อีก {hiddenCount}{" "}
                            รายการ
                          </button>
                        )}

                      {products.length > 3 &&
                        isExpanded && (
                          <button
                            type="button"
                            onClick={() =>
                              toggleExpand(
                                od.id
                              )
                            }
                            className="text-xs text-gray-500 underline underline-offset-2 mt-1 hover:text-gray-700"
                            aria-expanded="true"
                            aria-controls={`order-${od.id}-products`}
                            title="ย่อรายการสินค้า"
                          >
                            ย่อรายการ
                          </button>
                        )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {total.toLocaleString(
                        "th-TH"
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex justify-center">
                        <span
                          className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium ${pill(
                            enumStatus
                          )}`}
                          aria-label={`สถานะคำสั่งซื้อ: ${statusText}`}
                        >
                          {statusText}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      {(od.pickupPlace ||
                        od.pickupAt ||
                        od.pickupNote) && (
                          <button
                            type="button"
                            onClick={() =>
                              setViewPickup({
                                open: true,
                                order: od,
                              })
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
                    <td className="px-4 py-3 text-right align-middle min-w-[300px]">
                      <div className="flex items-center justify-end gap-3">
                        <select
                          className={`w-44 h-9 border rounded-lg px-2 text-sm shrink-0 ${enumStatus === STATUS.CANCELED ||
                              enumStatus === STATUS.COMPLETED
                              ? "opacity-60 cursor-not-allowed"
                              : ""
                            }`}
                          value={enumStatus}
                          disabled={
                            enumStatus ===
                            STATUS.CANCELED ||
                            enumStatus ===
                            STATUS.COMPLETED
                          }
                          onChange={(e) =>
                            onQuickStatus(
                              od.id,
                              e.target.value
                            )
                          }
                          title={
                            enumStatus ===
                              STATUS.CANCELED
                              ? "คำสั่งซื้อถูกยกเลิกแล้ว"
                              : enumStatus ===
                                STATUS.COMPLETED
                                ? "ออเดอร์สำเร็จแล้ว ไม่สามารถเปลี่ยนได้"
                                : "เปลี่ยนสถานะ"
                          }
                        >
                          {options.map((opt) => (
                            <option
                              key={opt}
                              value={opt}
                              disabled={
                                opt === enumStatus
                              }
                            >
                              {DISPLAY_TH[opt]}
                            </option>
                          ))}
                        </select>

                        {enumStatus ===
                          STATUS.CANCELED ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditCancelId(
                                od.id
                              );
                              setEditReason(
                                od.cancelReason ||
                                ""
                              );
                              setEditNote(
                                od.cancelNote ||
                                ""
                              );
                              setEditCancelOpen(
                                true
                              );
                            }}
                            className="h-9 min-w-[84px] inline-flex items-center justify-center gap-1 px-3 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                            title="แก้ไขเหตุผล/หมายเหตุการยกเลิก"
                          >
                            แก้ไข
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                enumStatus !==
                                STATUS.COMPLETED
                              )
                                onCancel(od.id);
                            }}
                            disabled={
                              cancelDisabled
                            }
                            className={`h-9 min-w-[84px] inline-flex items-center justify-center gap-1 px-3 rounded-lg ${cancelDisabled
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-red-100 text-red-700 hover:bg-red-200"
                              }`}
                            title={
                              cancelDisabled
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

      {/* Pagination */}
      <nav
        className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm mt-4"
        aria-label="ตัวแบ่งหน้ารายการคำสั่งซื้อ"
      >
        <div className="text-sm text-gray-600">
          แสดง {displayFrom}-{displayTo} จาก{" "}
          {totalOrders.toLocaleString(
            "th-TH"
          )}{" "}
          รายการ
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
          <label className="text-sm text-gray-600">
            แสดงต่อหน้า
          </label>
          <select
            value={pageSize}
            onChange={onChangePageSize}
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

      {/* Modal: ส่งสถานที่นัดรับ (bulk) */}
      {pickupOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="p-5 border-b">
              <div className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <MapPin className="h-5 w-5" />{" "}
                ส่งสถานที่นัดรับ
              </div>
              <div className="text-sm text-gray-500 mt-1">
                ออเดอร์ที่เลือก:{" "}
                {selectedReadyIds.length.toLocaleString(
                  "th-TH"
                )}{" "}
                รายการ
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  สถานที่นัดรับ *
                </label>
                <input
                  value={place}
                  onChange={(e) =>
                    setPlace(e.target.value)
                  }
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
                  onChange={(e) =>
                    setWhen(e.target.value)
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ข้อความเพิ่มเติม (ถ้ามี)
                </label>
                <textarea
                  value={note}
                  onChange={(e) =>
                    setNote(
                      e.target.value.slice(0, 300)
                    )
                  }
                  rows={3}
                  placeholder="เช่น โปรดนำบัตร ปชช. มาแสดง…"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <div className="text-xs text-gray-400 mt-1">
                  เหลือ{" "}
                  {300 - (note?.length || 0)}{" "}
                  อักขระ
                </div>
              </div>
            </div>
            <div className="p-5 border-t flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPickupOpen(false)}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={sendPickup}
                disabled={!canSendPickup}
                className={`px-4 py-2 rounded-lg text-white inline-flex items-center gap-2 ${!canSendPickup
                    ? "bg-blue-300 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                  }`}
              >
                <Send className="h-4 w-4" />{" "}
                ส่งให้ลูกค้า
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
                <MapPin className="h-5 w-5" />{" "}
                รายละเอียดสถานที่นัดรับ
              </div>
              <button
                type="button"
                onClick={() =>
                  setViewPickup({
                    open: false,
                    order: null,
                  })
                }
                className="text-gray-500 hover:text-gray-700"
                aria-label="ปิด"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-2 text-sm">
              <div>
                <b>เลขคำสั่งซื้อ:</b> #
                {viewPickup.order.id}
              </div>
              <div>
                <b>สถานที่:</b>{" "}
                {viewPickup.order.pickupPlace ||
                  "-"}
              </div>
              <div>
                <b>เวลา (เวลาไทย):</b>{" "}
                {viewPickup.order.pickupAt
                  ? fmtTH(
                    viewPickup.order.pickupAt
                  )
                  : "-"}
              </div>
              <div>
                <b>หมายเหตุ:</b>{" "}
                {viewPickup.order.pickupNote ||
                  "-"}
              </div>
            </div>
            <div className="p-5 border-t flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={async () => {
                  const o = viewPickup.order;
                  const text = [
                    `เลขคำสั่งซื้อ: #${o.id}`,
                    `สถานที่: ${o.pickupPlace || "-"
                    }`,
                    `เวลา(เวลาไทย): ${o.pickupAt
                      ? fmtTH(o.pickupAt)
                      : "-"
                    }`,
                    `หมายเหตุ: ${o.pickupNote || "-"
                    }`,
                  ].join("\n");
                  try {
                    if (
                      !navigator.clipboard
                        ?.writeText
                    )
                      throw new Error(
                        "Clipboard API not available"
                      );
                    await navigator.clipboard.writeText(
                      text
                    );
                    showToast(
                      "คัดลอกเรียบร้อย",
                      "success"
                    );
                  } catch {
                    showToast(
                      "คัดลอกไม่สำเร็จ กรุณาเลือกข้อความเอง",
                      "error"
                    );
                  }
                }}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                title="คัดลอกรายละเอียด"
              >
                คัดลอก
              </button>
              <button
                type="button"
                onClick={() => {
                  const o = viewPickup.order;
                  setPlace(
                    o.pickupPlace || ""
                  );
                  setWhen(
                    isoToLocalInput(o.pickupAt)
                  );
                  setNote(
                    o.pickupNote || ""
                  );
                  setSelected(
                    toEnumStatus(o) ===
                      STATUS.CONFIRMED
                      ? [o.id]
                      : []
                  );
                  setPickupOpen(true);
                  setViewPickup({
                    open: false,
                    order: null,
                  });
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
              >
                แก้ไข
              </button>
              <button
                type="button"
                onClick={() =>
                  setViewPickup({
                    open: false,
                    order: null,
                  })
                }
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: ยกเลิกออเดอร์ */}
      {cancelOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="p-5 border-b flex items-center justify-between">
              <div className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />{" "}
                ยกเลิกออเดอร์
              </div>
              <button
                type="button"
                onClick={() =>
                  setCancelOpen(false)
                }
                className="text-gray-500 hover:text-gray-700"
                aria-label="ปิด"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-sm text-gray-600">
                ยืนยันการยกเลิกออเดอร์{" "}
                <b>#{cancelId}</b> หรือไม่? <br />
                ระบบจะคืนสต็อกสินค้าโดยอัตโนมัติ
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เลือกสาเหตุการยกเลิก *
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_REASONS.map((r) => {
                    const active =
                      cancelReason === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() =>
                          setCancelReason(r)
                        }
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
                  onChange={(e) =>
                    setCancelReason(
                      e.target.value
                    )
                  }
                  placeholder="เช่น ลูกค้าขอเลื่อน / ... "
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  หมายเหตุเพิ่มเติม (ถ้ามี)
                </label>
                <textarea
                  value={cancelNote}
                  onChange={(e) =>
                    setCancelNote(
                      e.target.value.slice(
                        0,
                        300
                      )
                    )
                  }
                  rows={3}
                  placeholder="รายละเอียดประกอบ เช่น ช่องทางติดต่อกลับ ฯลฯ"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <div className="text-xs text-gray-400 mt-1">
                  เหลือ{" "}
                  {300 -
                    (cancelNote?.length ||
                      0)}{" "}
                  อักขระ
                </div>
              </div>
            </div>
            <div className="p-5 border-t flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setCancelOpen(false)
                }
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                ปิด
              </button>
              <button
                type="button"
                onClick={sendCancel}
                disabled={
                  !cancelReason.trim()
                }
                className={`px-4 py-2 rounded-lg text-white inline-flex items-center gap-2 ${!cancelReason.trim()
                    ? "bg-red-300 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-700"
                  }`}
              >
                <XCircle className="h-4 w-4" />{" "}
                ยืนยันยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: แก้ไขเหตุผล/หมายเหตุการยกเลิก */}
      {editCancelOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="p-5 border-b flex items-center justify-between">
              <div className="text-lg font-semibold tracking-tight">
                แก้ไขเหตุผลการยกเลิก
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditCancelOpen(false)
                }
                className="text-gray-500 hover:text-gray-700"
                aria-label="ปิด"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-sm text-gray-600">
                เลขคำสั่งซื้อ:{" "}
                <b>#{editCancelId}</b>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เหตุผล *
                </label>
                <input
                  value={editReason}
                  onChange={(e) =>
                    setEditReason(
                      e.target.value
                    )
                  }
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
                  onChange={(e) =>
                    setEditNote(
                      e.target.value.slice(
                        0,
                        300
                      )
                    )
                  }
                  rows={3}
                  placeholder="รายละเอียดประกอบ เช่น เบอร์ติดต่อกลับ ฯลฯ"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <div className="text-xs text-gray-400 mt-1">
                  เหลือ{" "}
                  {300 -
                    (editNote?.length ||
                      0)}{" "}
                  อักขระ
                </div>
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:underline"
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "ยืนยันล้างเหตุผลและหมายเหตุของคำสั่งซื้อนี้?"
                      )
                    )
                      return;
                    try {
                      await adminUpdateCancelInfo(
                        token,
                        editCancelId,
                        { clear: true }
                      );
                      setEditCancelOpen(false);
                      setEditCancelId(null);
                      setEditReason("");
                      setEditNote("");
                      load({
                        preserveSelection: true,
                        preservePage: true,
                        silent: false,
                      });
                    } catch (e) {
                      console.error(e);
                      showToast(
                        e?.response?.data
                          ?.message ||
                        "ล้างไม่สำเร็จ",
                        "error"
                      );
                    }
                  }}
                >
                  ล้างเหตุผล/หมายเหตุ
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditCancelOpen(false)
                    }
                    className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                  >
                    ปิด
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        !editReason.trim()
                      ) {
                        showToast(
                          "กรุณากรอกเหตุผล",
                          "error"
                        );
                        return;
                      }
                      try {
                        await adminUpdateCancelInfo(
                          token,
                          editCancelId,
                          {
                            reason:
                              editReason.trim(),
                            note:
                              editNote
                                ?.trim() ||
                              undefined,
                          }
                        );
                        setEditCancelOpen(false);
                        setEditCancelId(null);
                        setEditReason("");
                        setEditNote("");
                        load({
                          preserveSelection: true,
                          preservePage: true,
                          silent: false,
                        });
                      } catch (e) {
                        console.error(e);
                        showToast(
                          e?.response?.data
                            ?.message ||
                          "บันทึกไม่สำเร็จ",
                          "error"
                        );
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
