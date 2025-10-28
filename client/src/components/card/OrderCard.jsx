// client/src/components/card/OrderCard.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import useEcomStore from "../../store/ecom-store";
import { listUserOrders, deleteUserOrder } from "../../api/users";
import { toast } from "react-toastify";
import {
  CheckCircle2,
  Clock3,
  MapPin,
  ExternalLink,
  ShoppingBag,
  Info,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";
import Swal from "sweetalert2";

// ================= Helpers =================
const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const THB = (n) =>
  (Number(n) || 0).toLocaleString("th-TH", { style: "currency", currency: "THB" });

const fmtDateTimeTH = (v) =>
  v
    ? new Date(v).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })
    : "-";

const fmtRemain = (ms) => {
  if (ms <= 0) return "หมดเวลารับสินค้าแล้ว (รอตัดระบบ)";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / (24 * 3600));
  const hours = Math.floor((totalSec % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const parts = [];
  if (days) parts.push(`${days} วัน`);
  if (hours) parts.push(`${hours} ชั่วโมง`);
  if (minutes) parts.push(`${minutes} นาที`);
  if (seconds) parts.push(`${seconds} วินาที`);
  return parts.join(" ");
};

// ================= UI Primitives =================
const Badge = ({ className = "", children, title }) => (
  <span
    className={
      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 " +
      className
    }
    title={title}
  >
    {children}
  </span>
);

const StatusBadge = ({ enumStatus = "PENDING", text = "ผู้ขายได้รับคำสั่งซื้อแล้ว" }) => {
  const map = {
    PENDING: {
      cls: "bg-yellow-50 text-yellow-800 ring-yellow-200",
      Icon: Clock3,
      label: "สถานะ: ผู้ขายได้รับคำสั่งซื้อแล้ว",
    },
    CONFIRMED: {
      cls: "bg-blue-50 text-blue-700 ring-blue-200",
      Icon: CheckCircle2,
      label: "สถานะ: ผู้ขายจัดเตรียมสินค้าแล้วรอผู้ซื้อมารับ",
    },
  };
  const { cls, Icon, label } = map[enumStatus] ?? map.PENDING;
  return (
    <Badge className={cls} title={label} aria-label={`สถานะคำสั่งซื้อ: ${text}`}>
      <Icon className="h-3.5 w-3.5" />
      {text}
    </Badge>
  );
};

const SkeletonOrder = () => (
  <div className="animate-pulse space-y-3">
    <div className="h-6 w-52 bg-gray-200 rounded" />
    <div className="h-24 bg-gray-100 rounded-2xl" />
    <div className="h-24 bg-gray-100 rounded-2xl" />
  </div>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border bg-white p-10 text-center">
    <ShoppingBag className="h-10 w-10 text-gray-400" />
    <div className="text-base font-semibold text-gray-800">ยังไม่มีคำสั่งซื้อ</div>
    <p className="text-sm text-gray-500">
      เมื่อคุณสั่งซื้อสินค้า ระบบจะแสดงรายการคำสั่งซื้อไว้ที่นี่
    </p>
  </div>
);

// ================= Main =================
const DEFAULT_PAGE_SIZE = 5;
const PAGE_SIZE_OPTIONS = [3, 5, 10];

const Order = () => {
  const token = useEcomStore((s) => s.token);
  const users = useEcomStore((s) => s.users);
  const expiredRef = useRef(new Set());
  const topRef = useRef(null);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now()); // สำหรับนับถอยหลัง realtime

  // ===== Pagination state =====
  const [pageSize, setPageSize] = useState(() => {
    const saved = Number(localStorage.getItem("order_page_size"));
    return PAGE_SIZE_OPTIONS.includes(saved) ? saved : DEFAULT_PAGE_SIZE;
  });
  const [page, setPage] = useState(1);

  // อัปเดตเวลาทุก 1 วินาที
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // โหลดออเดอร์ (แบ็กเอนด์กรอง COMPLETED/CANCELED ให้แล้ว)
  useEffect(() => {
    const load = async () => {
      if (!token || !users) {
        setLoading(false);
        return;
      }
      try {
        const res = await listUserOrders(token);
        const list = res.data?.order ?? res.data?.orders ?? [];
        setOrders(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error(e);
        toast.error("โหลดคำสั่งซื้อไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, users]);

  // ลบออเดอร์ที่หมดเวลารับสินค้า (เฉพาะ CONFIRMED และเกิน expireAt)
  useEffect(() => {
    if (!token || orders.length === 0) return;

    const toDelete = [];
    for (const od of orders) {
      const isReady = od.orderStatusEnum === "CONFIRMED";
      const expireAtTs = od.expireAt ? new Date(od.expireAt).getTime() : null;
      const isExpired = isReady && expireAtTs != null && expireAtTs <= now;
      if (isExpired && !expiredRef.current.has(od.id)) {
        expiredRef.current.add(od.id);
        toDelete.push(od.id);
      }
    }

    (async () => {
      for (const id of toDelete) {
        try {
          await deleteUserOrder(id, token); // endpoint: ลบ + คืนสต็อก
          setOrders((prev) => prev.filter((o) => o.id !== id));
          toast.info(`ออเดอร์ #${String(id).padStart(5, "0")} เกินกำหนดและถูกลบแล้ว`);
        } catch (e) {
          console.error(e);
          toast.error(`ลบออเดอร์ #${id} ไม่สำเร็จ`);
          expiredRef.current.delete(id);
        }
      }
    })();
  }, [now, orders, token]);

  // ===== Derived totals =====
  const grandTotal = useMemo(
    () => orders.reduce((sum, od) => sum + toNum(od.cartTotal), 0),
    [orders]
  );

  const totalItems = useMemo(
    () =>
      orders.reduce(
        (sum, od) =>
          sum +
          (od.products?.reduce?.((sub, line) => sub + Number(line.count || 0), 0) || 0),
        0
      ),
    [orders]
  );

  // ===== Pagination derived =====
  const totalOrders = orders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize));

  // ป้องกันหน้าเกินช่วงเมื่อข้อมูลเปลี่ยน
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalOrders);
  const pagedOrders = useMemo(
    () => orders.slice(startIndex, endIndex),
    [orders, startIndex, endIndex]
  );

  const goToPage = (p) => {
    const clamped = Math.min(Math.max(1, p), totalPages);
    if (clamped !== page) {
      setPage(clamped);
      // scroll to top of list
      setTimeout(() => {
        if (topRef.current) topRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        else window.scrollTo({ top: 0, behavior: "smooth" });
      }, 0);
    }
  };

  const onChangePageSize = (e) => {
    const newSize = Number(e.target.value);
    setPageSize(newSize);
    localStorage.setItem("order_page_size", String(newSize));
    setPage(1);
  };

  const cancelAndRemoveOrder = async (orderId) => {
    if (!token) return toast.error("กรุณาเข้าสู่ระบบ");

    const confirm = await Swal.fire({
      title: "ยืนยันการยกเลิกคำสั่งซื้อ?",
      text: "เมื่อยกเลิกแล้ว ระบบจะลบออเดอร์นี้และคืนสต็อกทันที",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "ยืนยัน",
      cancelButtonText: "ยกเลิก",
      heightAuto: false,
    });
    if (!confirm.isConfirmed) return;

    try {
      await deleteUserOrder(orderId, token);
      toast.success("ยกเลิกคำสั่งซื้อสำเร็จ");
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.message ?? "ยกเลิก/ลบไม่สำเร็จ";
      toast.error(msg);
    }
  };

  // ================= Render =================
  if (loading && token && users) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <SkeletonOrder />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1295px] px-6 pt-6 space-y-6 md:p-4" ref={topRef}>
      {/* Header */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">
              คำสั่งซื้อของฉัน
            </h1>
            <p className="text-sm text-gray-500">
              ตรวจสอบสถานะการเตรียมสินค้า นัดรับ และยอดรวมทั้งหมดได้ในหน้านี้
            </p>
          </div>



          {/* Pagination controls (top) */}
          {totalOrders > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm text-gray-600">แสดงต่อหน้า</label>
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

              <span className="hidden sm:inline text-gray-300">|</span>

              <span className="text-sm text-gray-600">
                แสดง {totalOrders === 0 ? 0 : startIndex + 1}-{endIndex} จาก {totalOrders} รายการ
              </span>
            </div>
          )}
        </div>
      </div>

      {/* เพิ่มเติม + สรุปคำสั่งซื้อ (จัดให้อยู่บรรทัดเดียวกัน) */}
      {orders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* เพิ่มเติม */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1">
              <Info className="h-5 w-5 text-amber-600" />
              <span className="text-base font-semibold text-amber-700">เพิ่มเติม</span>
            </div>
            <p className="text-sm text-amber-800 leading-relaxed">
              โปรดมารับสินค้าภายใน <b>3 วัน</b> นับจากสถานะ
              <span className="font-semibold text-amber-700"> “ผู้ขายจัดเตรียมสินค้าแล้วรอผู้ซื้อมารับ” </span>
              มิฉะนั้นระบบจะยกเลิกอัตโนมัติ
            </p>
          </div>

          {/* สรุปคำสั่งซื้อ */}
          <div className="md:col-span-2 rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-3">สรุปคำสั่งซื้อ</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-xs text-gray-500">ราคารวมทุกคำสั่งซื้อ</div>
                <div className="mt-1 text-xl font-bold text-gray-900">{THB(grandTotal)}</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-xs text-gray-500">จำนวนสินค้าทั้งหมด</div>
                <div className="mt-1 text-xl font-bold text-gray-900">{totalItems.toLocaleString()} ตัว</div>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Not logged in */}
      {(!token || !users) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          โปรดเข้าสู่ระบบเพื่อดูคำสั่งซื้อของคุณ
        </div>
      )}

      {/* Empty */}
      {orders.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {pagedOrders.map((od) => {
            const created = fmtDateTimeTH(od.createdAt);
            const enumStatus = od.orderStatusEnum; // PENDING | CONFIRMED
            const statusText = od.orderStatusText || "";
            const isReady = enumStatus === "CONFIRMED";

            const expireAt = od.expireAt ? new Date(od.expireAt) : null;
            const remainMs = expireAt ? expireAt.getTime() - now : null;
            const isExpired = isReady && remainMs != null && remainMs <= 0;

            const products = Array.isArray(od.products) ? od.products : [];

            return (
              <section
                key={od.id}
                className="overflow-hidden rounded-2xl border bg-white shadow-sm ring-1 ring-gray-100"
                aria-label={`คำสั่งซื้อหมายเลข ${String(od.id).padStart(5, "0")}`}
              >
                {/* Header row */}
                <div className="border-b bg-gradient-to-r from-gray-50 to-white p-4 md:p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    {/* left */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <div className="text-sm text-gray-900">
                        เลขที่ออเดอร์:{" "}
                        <span className="font-medium text-gray-800">
                          #{String(od.id).padStart(5, "0")}
                        </span>
                      </div>
                      <span className="text-gray-300 text-xs">•</span>
                      <div className="text-sm text-gray-900">สร้างเมื่อ: {created}</div>
                    </div>

                    {/* right */}
                    <div className="flex flex-wrap items-center gap-2">
                      {isReady && (
                        <Badge
                          className="bg-blue-50 text-blue-700 ring-blue-200"
                          title="ชำระเงินที่จุดรับสินค้า"
                        >
                          ชำระเงิน: เงินสด หรือ QR ที่จุดรับสินค้า
                        </Badge>
                      )}

                      {isReady && od.expireAt && (
                        <Badge
                          className={
                            (isExpired
                              ? "bg-red-50 text-red-700 ring-red-200"
                              : "bg-orange-50 text-orange-700 ring-orange-200") +
                            " font-medium"
                          }
                          title={isExpired ? "หมดเวลารับสินค้า" : "เวลาคงเหลือ"}
                        >
                          {isExpired
                            ? "เกินกำหนดรับสินค้า"
                            : `ตัดอัตโนมัติใน ${fmtRemain(remainMs)}`}
                        </Badge>
                      )}

                      <StatusBadge enumStatus={enumStatus} text={statusText} />

                      {enumStatus === "PENDING" && (
                        <button
                          onClick={() => cancelAndRemoveOrder(od.id)}
                          className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 ring-1 ring-red-200 transition-colors hover:bg-red-100"
                          aria-label={`ยกเลิกคำสั่งซื้อ #${String(od.id).padStart(5, "0")}`}
                        >
                          ยกเลิกคำสั่งซื้อ
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lines */}
                <div className="p-4 md:p-5 space-y-4">
                  {products.length === 0 ? (
                    <div className="text-sm text-gray-500">ไม่มีรายการสินค้าในออเดอร์นี้</div>
                  ) : (
                    products.map((line) => {
                      const qty = toNum(line.count);
                      const price = toNum(line.price);
                      const lineTotal = qty * price;
                      const title = line.productTitle || "-";
                      const sizeName = line.sizeName || "-";
                      const generationName = line.generationName || "-";
                      const imageUrl = line.imageUrl || null;
                      const vid = line.variantId || line.variant?.id;

                      const hasPickup =
                        isReady && (od.pickupPlace || od.pickupAt || od.pickupNote);

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

                            {/* นัดรับสินค้า */}
                            {hasPickup && (
                              <div className="w-full sm:w-auto max-w-full sm:max-w-md rounded-xl border border-gray-200 bg-white p-4 text-gray-800 shadow-sm">
                                <div className="flex items-start gap-3">
                                  <div className="mt-1.5 shrink-0">
                                    <MapPin className="h-5 w-5 text-gray-700" />
                                  </div>

                                  <div className="w-full space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="text-base font-semibold tracking-tight">
                                        สถานที่นัดรับ
                                      </div>

                                      {od.pickupPlace && (
                                        <a
                                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                            od.pickupPlace
                                          )}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200 transition-colors hover:bg-blue-100"
                                          title="เปิดตำแหน่งนี้บน Google Maps"
                                        >
                                          <ExternalLink className="h-3.5 w-3.5" />
                                          เปิดแผนที่
                                        </a>
                                      )}
                                    </div>

                                    <div className="whitespace-pre-wrap break-words text-sm leading-snug">
                                      {od.pickupPlace || "-"}
                                    </div>

                                    {od.pickupAt && (
                                      <div className="text-sm text-gray-700">
                                        เวลา: <b>{fmtDateTimeTH(od.pickupAt)}</b>
                                      </div>
                                    )}

                                    {od.pickupNote && (
                                      <div className="text-sm text-gray-700">
                                        หมายเหตุ: {od.pickupNote}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* ยอดรวมต่อรายการ */}
                            <div className="min-w-[140px] text-right">
                              <div className="text-xs text-gray-500">ยอดรวม</div>
                              <div className="text-lg font-bold text-gray-900">
                                {THB(lineTotal)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Pagination controls (bottom) */}
      {totalOrders > pageSize && (
        <nav
          className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm"
          aria-label="ตัวแบ่งหน้ารายการคำสั่งซื้อ"
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
      )}




    </div>
  );
};

export default Order;
