// client/src/components/admin/HeaderAdmin.jsx
import React, { useEffect, useRef, useState } from "react";
import { Bell, ShoppingCart, ChevronDown, User2, LogOut } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import useEcomStore from "../../store/ecom-store";
import { getLowStockNotifications, getNewOrderNotifications } from "../../api/adminOrders";

const HeaderAdmin = () => {
  const navigate = useNavigate();
  const token = useEcomStore((s) => s.token);
  const users = useEcomStore((s) => s.users);
  const actionLogout = useEcomStore((s) => s.actionLogout);

  const [openNoti, setOpenNoti] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noti, setNoti] = useState([]);
  const notiBtnRef = useRef(null);
  const notiPopRef = useRef(null);

  // ▼ เมนูโปรไฟล์
  const [openUser, setOpenUser] = useState(false);
  const userBtnRef = useRef(null);
  const userPopRef = useRef(null);

  // ▼ ตัวแปรกัน reload ถี่เกิน
  const prevUnreadRef = useRef(0);
  const firstRunRef = useRef(true);
  const lastReloadAtRef = useRef(0);

  // ฟังก์ชันกัน reload ถี่เกิน
  const triggerReloadIfNeeded = () => {
    const now = Date.now();
    if (now - lastReloadAtRef.current < 5000) return; // กัน spam
    lastReloadAtRef.current = now;
    try {
      navigate(0); // soft reload
    } catch {
      window.location.reload(); // fallback
    }
  };

  // helper time-safe
  const pickTs = (...cands) => {
    for (const c of cands) {
      if (!c) continue;
      const t = (c instanceof Date) ? c.getTime() : new Date(c).getTime();
      if (Number.isFinite(t)) return t;
    }
    return Date.now();
  };

  const fetchNoti = async () => {
    try {
      setLoading(true);
      const [ordersRes, stocksRes] = await Promise.all([
        getNewOrderNotifications(token, { hours: 24 }),
        getLowStockNotifications(token, { threshold: 5 }),
      ]);

      const orders = Array.isArray(ordersRes) ? ordersRes : [];
      const stocks = Array.isArray(stocksRes) ? stocksRes : [];

      const mapOrder = (o) => {
        const orderId = o.orderId ?? o.id;
        return {
          id: `order:${orderId}`,
          title: o.title ?? `ออเดอร์ใหม่ #${orderId}`,
          time: o.time ?? "",
          unread: o.unread ?? true,
          type: "order",
          href: o.href || `/admin/statusorder?focus=${encodeURIComponent(orderId)}`,
          ts: Number.isFinite(Number(o.ts)) ? Number(o.ts) : pickTs(o.createdAt, o.time),
        };
      };

      const mapStock = (s) => ({
        id: s.id ?? `stock:${s.variantId ?? "x"}`,
        title: s.title ?? "สต็อกต่ำ",
        time: s.time ?? "",
        unread: s.unread ?? true,
        type: "stock",
        href: s.href || (s.productId ? `/admin/product/${encodeURIComponent(s.productId)}` : "/admin/product"),
        ts: Number.isFinite(Number(s.ts)) ? Number(s.ts) : pickTs(s.updatedAt, s.time),
      });

      const merged = [...orders.map(mapOrder), ...stocks.map(mapStock)]
        .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));

      setNoti(merged);

      // ตรวจสอบว่ามีแจ้งเตือนใหม่หรือไม่
      const unreadNow = merged.filter((n) => n.unread).length;
      if (!firstRunRef.current && unreadNow > prevUnreadRef.current) {
        triggerReloadIfNeeded();
      }
      prevUnreadRef.current = unreadNow;
      firstRunRef.current = false;

    } catch (e) {
      console.error("load notifications error:", e?.response?.data || e.message);
      setNoti([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => { if (!mounted) return; await fetchNoti(); })();
    const t = setInterval(fetchNoti, 30_000);
    return () => { mounted = false; clearInterval(t); };
  }, [token]);

  // ปิด dropdown เมื่อคลิกนอก
  useEffect(() => {
    const handler = (e) => {
      if (openNoti) {
        if (
          notiPopRef.current &&
          !notiPopRef.current.contains(e.target) &&
          notiBtnRef.current &&
          !notiBtnRef.current.contains(e.target)
        ) {
          setOpenNoti(false);
        }
      }
      if (openUser) {
        if (
          userPopRef.current &&
          !userPopRef.current.contains(e.target) &&
          userBtnRef.current &&
          !userBtnRef.current.contains(e.target)
        ) {
          setOpenUser(false);
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openNoti, openUser]);

  const unreadCount = noti.filter((n) => n.unread).length;

  const initials = (() => {
    const fn = users?.first_name?.trim?.() || "";
    const ln = users?.last_name?.trim?.() || "";
    const a = (fn[0] || "").toUpperCase();
    const b = (ln[0] || (users?.email?.[0] || "")).toUpperCase();
    return (a + b) || "U";
  })();

  const handleLogout = () => {
    actionLogout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
      <div className="mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <NavLink
          to="/admin/statusorder"
          end
          className={({ isActive }) =>
            [
              "inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
              isActive
                ? "bg-gray-800 text-white border-black"
                : "border-gray-200 text-gray-800 hover:bg-gray-800 hover:text-white hover:border-black"
            ].join(" ")
          }
          title="ไปหน้า คำสั่งซื้อ"
        >
          <ShoppingCart className="h-5 w-5 text-current" />
          <span className="hidden sm:inline font-medium">คำสั่งซื้อ</span>
        </NavLink>

        <div className="flex items-center gap-3">
          {/* แจ้งเตือน */}
          <div className="relative">
            <button
              ref={notiBtnRef}
              onClick={() => setOpenNoti((s) => !s)}
              className={`group relative inline-flex items-center gap-1 px-3 py-2 rounded-lg border transition-colors
                ${openNoti ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-800 hover:bg-gray-800 hover:text-white hover:border-black"}`}
              title="การแจ้งเตือน"
            >
              <Bell className="h-5 w-5 text-current" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center">
                  {unreadCount}
                </span>
              )}
              <ChevronDown className={`h-4 w-4 ml-1 transition ${openNoti ? "rotate-180 text-white" : "text-gray-700 group-hover:text-white"}`} />
            </button>

            {openNoti && (
              <div
                ref={notiPopRef}
                className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden"
              >
                <div className="px-4 py-3 border-b bg-gray-50 flex justify-between items-center">
                  <p className="font-medium">การแจ้งเตือน</p>
                  <span className="text-xs text-gray-500">
                    {loading ? "กำลังโหลด…" : `${noti.length} รายการ`}
                  </span>
                </div>

                <ul className="max-h-80 overflow-auto">
                  {!loading && noti.length === 0 && (
                    <li className="px-4 py-8 text-center text-gray-500 text-sm">ไม่มีการแจ้งเตือน</li>
                  )}
                  {noti.map((n) => (
                    <li key={n.id}>
                      <Link
                        to={n.href}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50"
                        onClick={() => setOpenNoti(false)}
                      >
                        <span
                          className={`mt-1 h-2 w-2 rounded-full ${n.type === "order"
                            ? "bg-emerald-600"
                            : n.type === "stock"
                              ? "bg-red-500"
                              : "bg-blue-500"
                            }`}
                        />
                        <div className="flex-1">
                          <p className="text-sm text-gray-800 line-clamp-1">{n.title}</p>
                          {n.time ? <p className="text-xs text-gray-500 mt-0.5">{n.time}</p> : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>

                <div className="px-4 py-2 border-t bg-white">
                  <Link
                    to="/admin/statusorder"
                    className="block text-center text-sm text-blue-600 hover:text-blue-700"
                    onClick={() => setOpenNoti(false)}
                  >
                    ดูทั้งหมดใน “คำสั่งซื้อ”
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* โปรไฟล์ */}
          <div className="relative">
            <button
              ref={userBtnRef}
              onClick={() => setOpenUser((s) => !s)}
              className="h-9 w-9 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 ring-2 ring-white flex items-center justify-center text-sm font-semibold text-gray-700 hover:brightness-95"
              title={`${users?.first_name ?? ""} ${users?.last_name ?? ""}`.trim() || users?.email || "บัญชีผู้ใช้"}
            >
              {initials}
            </button>

            {openUser && (
              <div
                ref={userPopRef}
                className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden"
              >
                <div className="px-4 py-3 border-b bg-gray-50">
                  <div className="text-sm font-semibold text-gray-900">
                    {(users?.first_name || "") + " " + (users?.last_name || "")}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{users?.email}</div>
                </div>

                <div className="py-1">
                  <Link
                    to={`/user`}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setOpenUser(false)}
                  >
                    <User2 className="h-4 w-4" /> โปรไฟล์ของฉัน
                  </Link>
                </div>

                <div className="border-t">
                  <button
                    onClick={() => { setOpenUser(false); handleLogout(); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" /> ออกจากระบบ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default HeaderAdmin;
