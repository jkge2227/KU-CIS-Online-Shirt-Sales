// client/src/components/card/OrderCard.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import useEcomStore from "../../store/ecom-store";
import { listUserOrders, deleteUserOrder } from "../../api/users";
import { toast } from "react-toastify";
import { CheckCircle2, Clock3, XCircle, MapPin, ExternalLink } from "lucide-react";
import Swal from "sweetalert2";

// ---------- Helpers ----------
const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

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

const normalizeStatus = (s) => {
  if (!s) return "กำลังรับออเดอร์";
  const t = String(s).trim().toLowerCase();
  if (t === "กำลังรับออเดอร์") return "กำลังรับออเดอร์";
  if (t === "processing" || t === "รับออเดอร์เสร็จสิ้น") return "รับออเดอร์เสร็จสิ้น";
  if (t === "completed" || t === "คำสั่งซื้อสำเร็จ") return "คำสั่งซื้อสำเร็จ";
  if (t === "cancelled" || t === "ยกเลิก") return "ยกเลิก";
  return s;
};

// ---------- UI ----------
const StatusBadge = ({ status = "กำลังรับออเดอร์" }) => {
  const styles = {
    "กำลังรับออเดอร์": "bg-yellow-50 text-yellow-700 ring-yellow-200",
    "รับออเดอร์เสร็จสิ้น": "bg-blue-50 text-blue-700 ring-blue-200",
    "คำสั่งซื้อสำเร็จ": "bg-green-50 text-green-700 ring-green-200",
    "ยกเลิก": "bg-red-50 text-red-700 ring-red-200",
  };
  const Icon =
    status === "คำสั่งซื้อสำเร็จ" ? CheckCircle2 :
      status === "ยกเลิก" ? XCircle : Clock3;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ring-1 ${styles[status] ?? styles["กำลังรับออเดอร์"]}`}>
      <Icon size={14} />
      {status}
    </span>
  );
};

const Order = () => {
  const token = useEcomStore((s) => s.token);
  const users = useEcomStore((s) => s.users);
  const expiredRef = useRef(new Set());

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now()); // ใช้สำหรับนับถอยหลัง realtime

  // อัปเดตเวลาทุก 1 วินาที
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!token || !users) {
        setLoading(false);
        return;
      }
      try {
        const res = await listUserOrders(token);
        const list = res.data?.order ?? res.data?.orders ?? [];

        // ✅ กันพลาดฝั่ง client: กรอง Completed ทิ้ง
        const cleaned = (Array.isArray(list) ? list : []).filter(o => {
          const t = String(o.orderStatus || "").trim().toLowerCase();
          return t !== "completed" && t !== "คำสั่งซื้อสำเร็จ";
        });

        setOrders(cleaned);
      } catch (e) {
        console.error(e);
        toast.error("โหลดคำสั่งซื้อไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, users]);

  // ลบออเดอร์ที่หมดเวลารับสินค้า (สถานะ "รับออเดอร์เสร็จสิ้น")
  useEffect(() => {
    if (!token) return;
    const toDelete = [];
    for (const od of orders) {
      const status = normalizeStatus(od.orderStatus);
      const isReady = status === "รับออเดอร์เสร็จสิ้น";
      if (!isReady || !od.expireAt) continue;

      const expire = new Date(od.expireAt).getTime();
      const isExpired = expire <= now;

      if (isExpired && !expiredRef.current.has(od.id)) {
        expiredRef.current.add(od.id); // กันยิงซ้ำ
        toDelete.push(od.id);
      }
    }

    (async () => {
      for (const id of toDelete) {
        try {
          await deleteUserOrder(id, token); // endpoint ที่ลบ+คืนสต็อก
          setOrders((prev) => prev.filter((o) => o.id !== id));
          toast.info(`ออเดอร์ #${String(id).padStart(5, "0")} เกินกำหนดและถูกลบแล้ว`);
        } catch (e) {
          console.error(e);
          toast.error(`ลบออเดอร์ #${id} ไม่สำเร็จ`);
          expiredRef.current.delete(id); // ให้ยิงซ้ำรอบต่อไปได้
        }
      }
    })();
  }, [now, orders, token]);

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

  const cancelAndRemoveOrder = async (orderId) => {
    if (!token) return toast.error("กรุณาเข้าสู่ระบบ");

    const confirm = await Swal.fire({
      title: "ยืนยันการยกเลิก?",
      text: "เมื่อยกเลิกแล้ว ออเดอร์นี้จะถูกลบออกจากระบบ และคืนสต็อกสินค้า",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "ใช่ ยกเลิกเลย",
      cancelButtonText: "ไม่",
    });

    if (!confirm.isConfirmed) return;

    try {
      await deleteUserOrder(orderId, token);
      toast.success("ยกเลิกและลบออเดอร์แล้ว");
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.message ?? "ยกเลิก/ลบไม่สำเร็จ";
      toast.error(msg);
    }
  };

  if (loading && token && users) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-56 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-100 rounded-xl" />
          <div className="h-24 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      {(!token || !users) && (
        <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg">
          โปรดเข้าสู่ระบบเพื่อดูคำสั่งซื้อของคุณ
        </div>
      )}

      {orders.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border text-gray-500 text-center">
          ยังไม่มีคำสั่งซื้อ
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((od) => {
            const created = od.createdAt
              ? new Date(od.createdAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })
              : "-";

            const status = normalizeStatus(od.orderStatus);
            const isReady = status === "รับออเดอร์เสร็จสิ้น";
            const expire = od.expireAt ? new Date(od.expireAt) : null;
            const remainMs = expire ? expire.getTime() - now : null;
            const isExpired = expire ? remainMs <= 0 : false;

            return (
              <div key={od.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    {/* left */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <div className="text-sm text-black">
                        เลขที่ออเดอร์:{" "}
                        <span className="font-medium text-gray-700">
                          #{String(od.id).padStart(5, "0")}
                        </span>
                      </div>
                      <div className="text-xs text-gray-300">•</div>
                      <div className="text-sm text-black">วันที่: {created}</div>
                    </div>

                    {/* right */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 ring-1 ring-gray-200">
                        ชำระเงิน : เงินสด หรือ QR code ที่จุดรับ
                      </span>
                      {isReady && expire && (
                        <span
                          className={`text-xs px-2.5 py-1 rounded-lg ring-1 ${isExpired
                            ? "bg-red-50 text-red-700 ring-red-200"
                            : "bg-orange-50 text-orange-700 ring-orange-200"
                            }`}
                          title={isExpired ? "หมดเวลารับสินค้า" : "เวลาคงเหลือ"}
                        >
                          {isExpired ? "เกินกำหนดรับสินค้า" : `ตัดอัตโนมัติใน ${fmtRemain(remainMs)}`}
                        </span>
                      )}
                      <StatusBadge status={status} />
                      {status === "กำลังรับออเดอร์" && (
                        <button
                          onClick={() => cancelAndRemoveOrder(od.id)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100"
                        >
                          ยกเลิกออเดอร์
                        </button>
                      )}
                    </div>
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

                    const hasPickup = isReady && (od.pickupPlace || od.pickupAt || od.pickupNote);

                    return (
                      <div
                        key={line.id ?? `${od.id}-${vid}-${title}`}
                        className="grid grid-cols-12 gap-4 bg-white rounded-xl p-3"
                      >
                        <div className="col-span-12 sm:col-span-2">
                          <div className="w-full aspect-[4/3] overflow-hidden rounded-lg border bg-white">
                            {imageUrl ? (
                              <img src={imageUrl} alt={title} className="w-full h-full object-contain" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                no image
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="col-span-12 sm:col-span-10 flex flex-wrap items-start justify-between gap-3">
                          {/* รายละเอียดสินค้า (ซ้าย) */}
                          <div className="space-y-0.5 min-w-[220px]">
                            <div className="text-sm text-black">
                              รหัสสินค้า :{" "}
                              <span className="font-medium text-black">
                                F{String(vid ?? 0).padStart(4, "0")}
                              </span>
                            </div>
                            <div className="text-sm text-black">{title}</div>
                            <div className="text-sm text-black">รุ่น : <b className=" text-black font-medium">{generationName}</b></div>
                            <div className="text-sm text-black">ขนาด : <b className=" text-black font-medium">{sizeName}</b></div>
                            <div className="text-sm text-black">ราคา : <b className=" text-black font-medium">{price.toLocaleString()} บาท</b></div>
                            <div className="text-sm text-black">จำนวน : <b className=" text-black font-medium">{qty} ตัว</b></div>
                          </div>

                          {/* ✅ นัดรับสินค้า (อยู่ตำแหน่งเดิม แต่ปรับสไตล์ให้สวย/อ่านง่าย) */}
                          {hasPickup && (
                            <div className="w-full sm:w-auto max-w-full sm:max-w-md py-4 px-5 rounded-xl border border-gray-200 bg-white text-gray-800 shadow-sm">
                              <div className="flex items-start gap-3">
                                <div className="mt-1.5 shrink-0">
                                  <MapPin className="h-5 w-5 text-blue-600" />
                                </div>

                                {/* เนื้อหา */}
                                <div className="w-full space-y-2">
                                  {/* หัวข้อ + ปุ่ม เปิดแผนที่ ชิดขวา */}
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
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 ring-1 ring-blue-200 text-xs font-medium transition-colors"
                                        title="เปิดตำแหน่งนี้บน Google Maps"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        เปิดแผนที่
                                      </a>
                                    )}
                                  </div>

                                  {/* ที่อยู่ */}
                                  <div className="text-sm leading-snug whitespace-pre-wrap break-words">
                                    {od.pickupPlace || "-"}
                                  </div>

                                  {/* เวลา */}
                                  {od.pickupAt && (
                                    <div className="text-sm text-gray-700">
                                      เวลา:{" "}
                                      <b>
                                        {new Date(od.pickupAt).toLocaleString("th-TH", {
                                          dateStyle: "medium",
                                          timeStyle: "short",
                                        })}
                                      </b>
                                    </div>
                                  )}

                                  {/* หมายเหตุ */}
                                  {od.pickupNote && (
                                    <div className="text-sm text-gray-700">
                                      หมายเหตุ: {od.pickupNote}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ยอดรวม (ขวา) */}
                          <div className="text-right min-w-[140px]">
                            <div className="text-xs text-gray-500">ยอดรวม</div>
                            <div className="text-lg font-bold text-gray-900">
                              {lineTotal.toLocaleString()} บาท
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {orders.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border shadow-sm p-4 space-y-2">
          <div className="flex justify-between text-lg font-semibold">
            <span>ราคารวมทุกคำสั่งซื้อ</span>
            <span className="text-black">{grandTotal.toLocaleString()} บาท</span>
          </div>
          <div className="flex justify-between text-lg font-semibold">
            <span>จำนวนทั้งหมด</span>
            <span className="text-black">{totalItems.toLocaleString()} ตัว</span>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-4 text-red-700">
        <div className="font-semibold">!!! คำเตือน !!!</div>
        <div className="text-sm">หากไม่มารับสินค้าภายใน 3 วัน ระบบจะทำการยกเลิกคำสั่งซื้อ</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
        <div className="rounded-xl border border-yellow-300/70 bg-yellow-50 p-4">
          <div className="font-semibold text-yellow-800 mb-1">กำลังรับออเดอร์</div>
          <div className="text-sm text-yellow-700">กำลังเตรียมสินค้า</div>
        </div>
        <div className="rounded-xl border border-blue-300/70 bg-blue-50 p-4">
          <div className="font-semibold text-blue-800 mb-1">รับออเดอร์เสร็จสิ้น</div>
          <div className="text-sm text-blue-700">จัดเตรียมสินค้าเสร็จ รอผู้ซื้อมารับและชำระเงิน</div>
        </div>
        <div className="rounded-xl border border-green-300/70 bg-green-50 p-4">
          <div className="font-semibold text-green-800 mb-1">คำสั่งซื้อสำเร็จ</div>
          <div className="text-sm text-green-700">ผู้ซื้อมารับสินค้าแล้ว</div>
        </div>
      </div>
    </div>
  );
};

export default Order;
