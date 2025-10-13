// client/src/components/admin/AdminSalesDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import useEcomStore from "../../store/ecom-store";
import { adminListOrders } from "../../api/adminOrders";
import { adminListReviewStats, adminListReviews } from "../../api/review";
import DatePicker from "react-datepicker";
import { toYMDThai, fromYMDThai } from "../common/ThaiDatePicker";
import {
    Loader2,
    RefreshCw,
    TrendingUp,
    ShoppingCart,
    Package,
    Users,
    PieChart as PieChartIcon,
    LineChart as LineChartIcon,
    Star,
} from "lucide-react";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
} from "recharts";

// ================= helpers =================
const THB = (n) =>
    (Number(n) || 0).toLocaleString("th-TH", {
        style: "currency",
        currency: "THB",
    });
const nfmt = (n) => (Number(n) || 0).toLocaleString();

const toDateUTC = (x) => {
    if (!x) return null;
    if (x instanceof Date) return x;
    const s = String(x);
    if (/Z|([+-]\d{2}:?\d{2})$/.test(s)) return new Date(s);
    return new Date(s + "Z");
};

// เงินแบบชิดสวย ๆ
const MoneyTight = ({ text }) => {
    const s = String(text || "");
    const amount = s.replace(/^฿\s?/, "");
    return (
        <span className="inline-flex items-baseline gap-[4px] tabular-nums">
            <span className="font-medium">฿</span>
            <span>{amount}</span>
        </span>
    );
};

// --- แปลง key ช่วงเวลาให้เป็นภาษาไทยบนกราฟ ---
const fmtThaiPeriodLabel = (x, gran) => {
    try {
        if (!x) return "";
        if (gran === "year") {
            // x = "2025"
            return String(x);
        }
        if (gran === "month") {
            // x = "YYYY-MM"
            const [y, m] = String(x).split("-").map(Number);
            const d = new Date(Date.UTC(y, (m || 1) - 1, 1));
            // ใช้ locale ไทย + timeZone ไทย เพื่อชื่อเดือนแบบ “ต.ค. 2025”
            return d.toLocaleDateString("th-TH", {
                month: "short",
                year: "numeric",
                timeZone: "Asia/Bangkok",
            });
        }
        // gran === "day", x = "YYYY-MM-DD"
        const [y, m, d0] = String(x).split("-").map(Number);
        const d = new Date(Date.UTC(y, (m || 1) - 1, d0 || 1));
        // “1 ต.ค.” (ไม่ต้องใส่ปีเพราะแกน X แน่นอยู่แล้ว)
        return d.toLocaleDateString("th-TH", {
            day: "numeric",
            month: "short",
            timeZone: "Asia/Bangkok",
        });
    } catch {
        return String(x);
    }
};


// ---- Thai day boundaries ----
const TH_OFFSET_MS = 7 * 60 * 60 * 1000; // +07:00

// yyyy-mm-dd -> Date ที่เท่ากับ 00:00:00 ของ "วันไทย" แต่เป็น instant UTC
const startOfThaiDayUTC = (yyyy_mm_dd) => {
    if (!yyyy_mm_dd) return null;
    const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
    // เที่ยงคืนเวลาไทย = 17:00 ของวันก่อนหน้าใน UTC
    return new Date(Date.UTC(y, m - 1, d) - TH_OFFSET_MS);
};
const nextThaiDayUTC = (d) => (d ? new Date(d.getTime() + 24 * 60 * 60 * 1000) : null);

// แปลง instant -> components ของ "วันที่ไทย"
const datePartsTH = (date) => {
    // ขยับเวลาไป +7 แล้วอ่านค่า UTC getter เพื่อได้ Y/M/D ของไทย
    const t = new Date(date.getTime() + TH_OFFSET_MS);
    return {
        year: t.getUTCFullYear(),
        month: t.getUTCMonth() + 1,
        day: t.getUTCDate(),
    };
};

const orderRevenue = (od) =>
    (od?.products || []).reduce(
        (s, p) => s + Number(p.price || 0) * Number(p.count || 0),
        0
    );

const STATUS_COLOR = {
    "กำลังรับออเดอร์": "#F59E0B",
    "รับออเดอร์เสร็จสิ้น": "#3B82F6",
    "คำสั่งซื้อสำเร็จ": "#10B981",
    ยกเลิก: "#EF4444",
};

// เดาประเภทเสื้อจากชื่อ (ไว้ใช้ในรีวิว)
const reviewTypeFromTitle = (title) => {
    const t = String(title || "").trim();
    const m = t.match(/^เสื้อ\s*(.+)$/i);
    return (m ? m[1] : t) || "";
};

// =============== UI atoms ===============
const Card = ({ children, className = "" }) => (
    <div className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${className}`}>
        {children}
    </div>
);

const CardHeader = ({ title, icon, action, subtitle }) => (
    <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
            {icon}
            <div>
                <div className="text-sm text-gray-500">{subtitle}</div>
                <div className="text-lg font-semibold text-gray-900">{title}</div>
            </div>
        </div>
        {action}
    </div>
);

const Kpi = ({ label, value, icon, trend }) => (
    <Card>
        <div className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-50 text-gray-700 ring-1 ring-gray-200">
                {icon}
            </div>
            <div className="flex-1 leading-tight">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-lg sm:text-xl font-semibold tracking-tight">{value}</div>
                {trend && <div className="text-[11px] text-gray-500 mt-0.5">{trend}</div>}
            </div>
        </div>
    </Card>
);

// =============== Main ===============
export default function AdminSalesDashboard() {
    const token = useEcomStore((s) => s.token);

    const [gran, setGran] = useState("day"); // day | month | year
    const [range, setRange] = useState({ start: "", end: "" }); // yyyy-mm-dd (Thai day)

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");


    // รีวิว (แอดมิน)
    const [reviewStats, setReviewStats] = useState([]);
    const [latestReviews, setLatestReviews] = useState([]);
    const [reviewTypeFilter, setReviewTypeFilter] = useState("");

    // ตั้งค่า default range ตาม "วันไทย" (วันนี้ = วันไทย)
    const applyGranDefaultRange = (g) => {
        const now = new Date();
        // สร้างวันที่ไทย (ตัดเวลาออก)
        const { year, month, day } = datePartsTH(now);
        const endThai = new Date(Date.UTC(year, month - 1, day) - TH_OFFSET_MS); // 00:00 ไทย ของวันนี้ (instant)
        const startThai = new Date(endThai);

        if (g === "day") startThai.setUTCDate(startThai.getUTCDate() - 29);
        if (g === "month") startThai.setUTCMonth(startThai.getUTCMonth() - 11);
        if (g === "year") startThai.setUTCFullYear(startThai.getUTCFullYear() - 4);

        const toYMDThai = (instant) => {
            const p = datePartsTH(instant);
            return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
        };

        setRange({ start: toYMDThai(startThai), end: toYMDThai(endThai) });
    };

    useEffect(() => {
        applyGranDefaultRange(gran);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gran]);

    const fetchOrders = async () => {
        if (!token || !range.start || !range.end) return;
        try {
            setLoading(true);
            setErr("");

            const pageSize = 50;
            let page = 1;
            let all = [];
            while (true) {
                const { data } = await adminListOrders(token, {
                    page,
                    pageSize,
                    // ไม่ใช้ server filter ของวันที่ เพื่อความชัวร์เรื่อง timezone ก็ได้
                    startDate: range.start,
                    endDate: range.end,
                    status: "",
                    q: "",
                });
                const batch = data?.data || [];
                all = all.concat(batch);
                const { totalPages = 1 } = data?.pagination || {};
                if (page >= totalPages) break;
                page += 1;
            }
            setRows(all);
        } catch (e) {
            console.error(e);
            setErr(e?.response?.data?.message || "โหลดข้อมูลไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    };

    const fetchReviews = async () => {
        if (!token || !range.start || !range.end) return;
        try {
            const [statsRes, latestRes] = await Promise.all([
                adminListReviewStats(token, { startDate: range.start, endDate: range.end }),
                adminListReviews(token, { startDate: range.start, endDate: range.end, pageSize: 20 }),
            ]);
            setReviewStats(Array.isArray(statsRes?.data?.data) ? statsRes.data.data : []);
            setLatestReviews(Array.isArray(latestRes?.data?.data) ? latestRes.data.data : []);
        } catch (e) {
            console.error("fetchReviews error:", e?.response?.status, e?.response?.data);
            setReviewStats([]);
            setLatestReviews([]);
            setErr(e?.response?.data?.message || "ดึงข้อมูลรีวิวไม่สำเร็จ");
        }
    };

    useEffect(() => {
        fetchOrders();
        fetchReviews();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, range.start, range.end]);

    // ====== filter ช่วงวันที่แบบ "วันไทย" ======
    const filtered = useMemo(() => {
        const from = startOfThaiDayUTC(range.start);
        const to = nextThaiDayUTC(startOfThaiDayUTC(range.end)); // [from, to)
        return rows.filter((od) => {
            const t = toDateUTC(od.createdAt);
            if (from && t < from) return false;
            if (to && t >= to) return false;
            return true;
        });
    }, [rows, range.start, range.end]);

    // เฉพาะออเดอร์สำเร็จ
    const successOrders = useMemo(
        () => filtered.filter((o) => String(o.orderStatus).trim() === "คำสั่งซื้อสำเร็จ"),
        [filtered]
    );

    // ====== KPIs (ให้ตรง) ======
    const kpis = useMemo(() => {
        const orderCount = successOrders.length;
        const revenue = successOrders.reduce((s, od) => s + orderRevenue(od), 0);
        const items = successOrders.reduce(
            (s, od) => s + (od.products || []).reduce((x, p) => x + Number(p.count || 0), 0),
            0
        );
        return { orderCount, revenue, items };
    }, [successOrders]);

    // ====== กลุ่มตามช่วงเวลาแบบ "วันไทย" จริง ======
    const keyForThai = (dateStr) => {
        const d = toDateUTC(dateStr);
        if (!d) return "-";
        const p = datePartsTH(d);
        if (gran === "day") {
            return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
        }
        if (gran === "month") {
            return `${p.year}-${String(p.month).padStart(2, "0")}`;
        }
        return `${p.year}`;
    };

    const revenueByPeriod = useMemo(() => {
        const map = new Map();
        for (const od of successOrders) {
            const k = keyForThai(od.createdAt); // 🔒 ใช้วันไทย
            map.set(k, (map.get(k) || 0) + orderRevenue(od));
        }
        return Array.from(map.entries())
            .map(([x, total]) => ({ x, total }))
            .sort((a, b) => a.x.localeCompare(b.x));
    }, [successOrders, gran]);

    const statusPie = useMemo(() => {
        const map = new Map();
        for (const od of filtered) {
            const st = String(od.orderStatus || "").trim() || "-";
            map.set(st, (map.get(st) || 0) + 1);
        }
        return Array.from(map.entries()).map(([name, value]) => ({
            name,
            value,
            fill: STATUS_COLOR[name] ?? "#9CA3AF",
        }));
    }, [filtered]);

    const topProducts = useMemo(() => {
        const map = new Map();
        for (const od of successOrders) {
            for (const line of od.products || []) {
                const key = line.productTitle || `SKU-${line.variantId}`;
                const prev = map.get(key) || { title: key, qty: 0, revenue: 0 };
                prev.qty += Number(line.count || 0);
                prev.revenue += Number(line.price || 0) * Number(line.count || 0);
                map.set(key, prev);
            }
        }
        return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    }, [successOrders]);

    const topCustomers = useMemo(() => {
        const map = new Map();
        for (const od of successOrders) {
            const u = od.orderBuy || {};
            const key = u.email || `UID-${u.id}`;
            const prev =
                map.get(key) || {
                    name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || key,
                    orders: 0,
                    revenue: 0,
                };
            prev.orders += 1;
            prev.revenue += orderRevenue(od);
            map.set(key, prev);
        }
        return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
    }, [successOrders]);

    // ====== ประเภทเสื้อ + ฟิลเตอร์แบบปุ่มชิป ======
    const reviewTypesWithCount = useMemo(() => {
        const map = new Map();
        (latestReviews || []).forEach((rv) => {
            const type = reviewTypeFromTitle(rv.productTitle);
            if (!type) return;
            map.set(type, (map.get(type) || 0) + 1);
        });
        return Array.from(map.entries())
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => a.type.localeCompare(b.type, "th"));
    }, [latestReviews]);

    const latestReviewsFiltered = useMemo(() => {
        if (!reviewTypeFilter) return latestReviews;
        return (latestReviews || []).filter(
            (rv) => reviewTypeFromTitle(rv.productTitle) === reviewTypeFilter
        );
    }, [latestReviews, reviewTypeFilter]);

    // =============== UI ===============
    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div>
                    <div className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                        <LineChartIcon className="h-8 w-8 text-indigo-600" /> สรุปยอดขาย
                    </div>
                    <div className="text-gray-500 text-sm mt-1">
                        สรุปยอดออเดอร์ แสดงผลแบบ{" "}
                        {gran === "day" ? "รายวัน" : gran === "month" ? "รายเดือน" : "รายปี"}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* สลับวัน/เดือน/ปี */}
                    <div className="inline-flex rounded-xl border overflow-hidden">
                        {[
                            { k: "day", label: "รายวัน" },
                            { k: "month", label: "รายเดือน" },
                            { k: "year", label: "รายปี" },
                        ].map(({ k, label }) => (
                            <button
                                key={k}
                                onClick={() => setGran(k)}
                                className={`px-3 py-2 text-sm ${gran === k ? "bg-indigo-600 text-white" : "bg-white hover:bg-gray-50"
                                    }`}
                                title={label}
                                type="button"
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* ช่วงวันที่ (ไทย) */}
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            className="px-3 py-2 w-[150px] border rounded-lg"
                            value={range.start}
                            onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
                            title="วันที่เริ่ม (วันไทย)"
                        />
                        <span className="text-gray-500">ถึง</span>
                        <input
                            type="date"
                            className="px-3 py-2 w-[150px] border rounded-lg"
                            value={range.end}
                            onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
                            title="วันที่สิ้นสุด (วันไทย)"
                        />
                    </div>

                    {/* โหลดใหม่ */}
                    <button
                        onClick={() => {
                            fetchOrders();
                            fetchReviews();
                        }}
                        className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 inline-flex items-center gap-2"
                        title="รีเฟรช"
                        type="button"
                    >
                        <RefreshCw className="h-4 w-4" /> โหลดใหม่
                    </button>
                </div>
            </div>

            {/* Loading / Error */}
            {loading && (
                <div className="flex items-center justify-center py-12 text-gray-500">
                    <Loader2 className="animate-spin h-6 w-6 mr-2" /> กำลังโหลด…
                </div>
            )}
            {err && !loading && (
                <div className="rounded-xl border bg-red-50 text-red-700 p-4">{err}</div>
            )}

            {!loading && !err && (
                <>
                    {/* KPIs: ไม่มี AOV แล้ว */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Kpi
                            label="ยอดขายรวม"
                            value={<MoneyTight text={THB(kpis.revenue)} />}
                            icon={<TrendingUp className="h-5 w-5" />}
                        />
                        <Kpi
                            label="จำนวนออเดอร์สำเร็จ"
                            value={nfmt(kpis.orderCount)}
                            icon={<ShoppingCart className="h-5 w-5" />}
                        />
                        <Kpi
                            label="จำนวนชิ้นที่ขาย"
                            value={nfmt(kpis.items)}
                            icon={<Package className="h-5 w-5" />}
                        />
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card className="lg:col-span-2">
                            <CardHeader
                                title={`ยอดขายแบบ${gran === "day" ? "รายวัน" : gran === "month" ? "รายเดือน" : "รายปี"}`}
                                subtitle="แกน X เป็นช่วงเวลา (วันไทย) / แกน Y เป็นยอดขาย (บาท)"
                                icon={<LineChartIcon className="h-5 w-5 text-indigo-600" />}
                            />
                            <div className="p-4 h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={revenueByPeriod} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="x"
                                            tick={{ fontSize: 12 }}
                                            tickFormatter={(v) => fmtThaiPeriodLabel(v, gran)}     // ⬅️ ชื่อเดือนภาษาไทยบนแกน X
                                        />
                                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                                        <Tooltip
                                            formatter={(v) => THB(v)}
                                            labelFormatter={(v) => fmtThaiPeriodLabel(v, gran)}     // ⬅️ ชื่อเดือนภาษาไทยใน tooltip
                                        />
                                        <Line type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>

                            </div>
                        </Card>

                        <Card>
                            <CardHeader
                                title="สัดส่วนสถานะออเดอร์"
                                subtitle="ต่อจำนวนออเดอร์ (ช่วงวันที่ไทย)"
                                icon={<PieChartIcon className="h-5 w-5 text-indigo-600" />}
                            />
                            <div className="p-4">
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={statusPie}
                                                dataKey="value"
                                                nameKey="name"
                                                innerRadius={50}
                                                outerRadius={80}
                                                paddingAngle={2}
                                                label={false}
                                            >
                                                {statusPie.map((e, i) => (
                                                    <Cell key={i} fill={e.fill} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(v) => `${nfmt(v)} รายการ`} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {statusPie.map((s) => (
                                        <div key={s.name} className="justify-self-start">
                                            <div
                                                className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg ring-1 ring-gray-200 bg-white min-w-0"
                                                title={`${s.name} • ${nfmt(s.value)} รายการ`}
                                            >
                                                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.fill }} />
                                                <span className="max-w-[12rem] sm:max-w-[14rem] truncate text-sm">{s.name}</span>
                                                <span className="shrink-0 tabular-nums text-gray-700">{nfmt(s.value)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Tables */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader
                                title="สินค้า Top 10 (ตามยอดขาย)"
                                subtitle="ช่วงวันที่ไทยที่เลือก"
                                icon={<Package className="h-5 w-5 text-indigo-600" />}
                            />
                            <div className="p-4">
                                {topProducts.length === 0 ? (
                                    <div className="text-sm text-gray-500">ไม่มีข้อมูล</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-gray-50 text-gray-700">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">สินค้า</th>
                                                    <th className="px-3 py-2 text-right">จำนวน</th>
                                                    <th className="px-3 py-2 text-right">ยอดขาย</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {topProducts.map((p, idx) => (
                                                    <tr key={p.title} className="border-t">
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100">#{idx + 1}</span>
                                                                <span className="font-medium truncate max-w-[320px]" title={p.title}>
                                                                    {p.title}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-right">{nfmt(p.qty)}</td>
                                                        <td className="px-3 py-2 text-right">{THB(p.revenue)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </Card>

                        <Card>
                            <CardHeader
                                title="ลูกค้า Top (ตามยอดซื้อ)"
                                subtitle="ช่วงวันที่ไทยที่เลือก"
                                icon={<Users className="h-5 w-5 text-indigo-600" />}
                            />
                            <div className="p-4">
                                {topCustomers.length === 0 ? (
                                    <div className="text-sm text-gray-500">ไม่มีข้อมูล</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-gray-50 text-gray-700">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">ลูกค้า</th>
                                                    <th className="px-3 py-2 text-right">ออเดอร์</th>
                                                    <th className="px-3 py-2 text-right">ยอดซื้อ</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {topCustomers.map((c, idx) => (
                                                    <tr key={c.name + idx} className="border-t">
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100">#{idx + 1}</span>
                                                                <span className="font-medium truncate max-w-[320px]" title={c.name}>
                                                                    {c.name}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-right">{nfmt(c.orders)}</td>
                                                        <td className="px-3 py-2 text-right">{THB(c.revenue)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* ★ คะแนนรีวิว & รีวิวล่าสุด */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* คะแนนรีวิว */}
                        <Card>
                            <CardHeader
                                title="คะแนนรีวิวสินค้า (Top)"
                                subtitle="ช่วงวันที่ไทยที่เลือก"
                                icon={<Star className="h-5 w-5 text-yellow-500" />}
                            />
                            <div className="p-4">
                                {reviewStats.length === 0 ? (
                                    <div className="text-sm text-gray-500">ไม่มีข้อมูลรีวิว</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <div className="max-h-80 overflow-auto rounded-xl ring-1 ring-gray-100">
                                            <table className="min-w-full text-sm">
                                                <thead className="bg-gray-50 text-gray-700 sticky top-0 z-10">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left">สินค้า</th>
                                                        <th className="px-3 py-2 text-right">เรตติ้งเฉลี่ย</th>
                                                        <th className="px-3 py-2 text-right">จำนวนรีวิว</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {reviewStats.map((r) => (
                                                        <tr key={r.productId} className="border-t">
                                                            <td className="px-3 py-2">
                                                                <span className="font-medium truncate max-w-[320px]" title={r.title}>
                                                                    {r.title}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2 text-right">
                                                                <span className="inline-flex items-center gap-1">
                                                                    <Star className="h-4 w-4 fill-yellow-400 stroke-yellow-500" />
                                                                    {Number(r.ratingAvg || 0).toFixed(2)}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2 text-right">{nfmt(r.ratingCount)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* รีวิวล่าสุด + ฟิลเตอร์แบบชิป */}
                        <Card>
                            <CardHeader
                                title="รีวิวล่าสุด"
                                subtitle="ช่วงวันที่ไทยที่เลือก"
                                icon={<Star className="h-5 w-5 text-yellow-500" />}
                            />
                            <div className="p-4">
                                {/* ชิปฟิลเตอร์ */}
                                <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
                                    <button
                                        type="button"
                                        onClick={() => setReviewTypeFilter("")}
                                        className={`px-3 py-1.5 rounded-full text-sm ring-1 ${reviewTypeFilter === ""
                                            ? "bg-indigo-600 text-white ring-indigo-600"
                                            : "bg-white text-gray-700 ring-gray-200 hover:bg-gray-50"
                                            }`}
                                    >
                                        ทั้งหมด
                                    </button>
                                    {reviewTypesWithCount.map(({ type, count }) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setReviewTypeFilter((cur) => (cur === type ? "" : type))}
                                            className={`px-3 py-1.5 rounded-full text-sm ring-2 whitespace-nowrap ${reviewTypeFilter === type
                                                ? "bg-indigo-600 text-white ring-indigo-600"
                                                : "bg-white text-gray-900 ring-gray-200 hover:bg-gray-50"
                                                }`}
                                            title={`รีวิวประเภท: ${type}`}
                                        >
                                            {type} <span className="opacity-70">({count})</span>
                                        </button>
                                    ))}
                                </div>

                                {/* รายการรีวิว */}
                                <div className="space-y-3 max-h-80 overflow-auto pr-1">
                                    {(latestReviewsFiltered?.length ?? 0) === 0 ? (
                                        <div className="text-sm text-gray-500">
                                            {reviewTypeFilter ? "ไม่มีรีวิวในประเภทนี้" : "ไม่มีข้อมูลรีวิว"}
                                        </div>
                                    ) : (
                                        latestReviewsFiltered.map((rv) => {
                                            return (
                                                <div key={rv.id} className="p-3 rounded-xl border bg-gray-50">
                                                    <div className="flex items-center justify-between">
                                                        <div className="font-medium truncate max-w-[60%]" title={rv.productTitle}>
                                                            {rv.productTitle}
                                                        </div>
                                                        <div className="inline-flex items-center gap-1 text-sm">
                                                            <Star className="h-4 w-4 fill-yellow-400 stroke-yellow-500" />
                                                            {rv.rating}
                                                        </div>
                                                    </div>

                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                        โดย {rv.userName || "ผู้ใช้"} • {new Date(rv.createdAt).toLocaleString("th-TH")}
                                                    </div>
                                                    {rv.text && (
                                                        <div className="text-sm text-gray-700 mt-2 whitespace-pre-line">
                                                            {rv.text}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Mini bar chart top products */}
                    {topProducts.length > 0 && (
                        <Card>
                            <CardHeader
                                title="กราฟยอดขาย Top 10 สินค้า"
                                subtitle={gran === "day" ? "สรุปตามวันไทย" : gran === "month" ? "สรุปตามเดือนไทย" : "สรุปตามปีไทย"}
                                icon={<TrendingUp className="h-5 w-5 text-indigo-600" />}
                            />
                            <div className="p-4 h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={topProducts} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                                        <YAxis type="category" dataKey="title" width={220} tick={{ fontSize: 12 }} />
                                        <Tooltip formatter={(v) => THB(v)} />
                                        <Bar dataKey="revenue" radius={[4, 4, 4, 4]} fill="#4f46e5" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
