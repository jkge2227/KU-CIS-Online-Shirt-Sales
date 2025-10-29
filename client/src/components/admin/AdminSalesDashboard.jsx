// client/src/components/admin/AdminSalesDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import useEcomStore from "../../store/ecom-store";
import { adminListOrders } from "../../api/adminOrders";
import { adminListReviewStats, adminListReviews } from "../../api/review";
import {
    Loader2,
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
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    PieChart,
    Pie,
    BarChart,
    Bar,
    LabelList,
    Label,
    Legend,
} from "recharts";

/* ================= helpers ================= */
const THB = (n) =>
    (Number(n) || 0).toLocaleString("th-TH", { style: "currency", currency: "THB" });
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
        if (gran === "year") return String(x);
        if (gran === "month") {
            const [y, m] = String(x).split("-").map(Number);
            const d = new Date(Date.UTC(y, (m || 1) - 1, 1));
            return d.toLocaleDateString("th-TH", {
                month: "short",
                year: "numeric",
                timeZone: "Asia/Bangkok",
            });
        }
        // day
        const [y, m, d0] = String(x).split("-").map(Number);
        const d = new Date(Date.UTC(y, (m || 1) - 1, d0 || 1));
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
const startOfThaiDayUTC = (yyyy_mm_dd) => {
    if (!yyyy_mm_dd) return null;
    const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d) - TH_OFFSET_MS);
};
const nextThaiDayUTC = (d) => (d ? new Date(d.getTime() + 24 * 60 * 60 * 1000) : null);

// แปลง instant -> components ของ "วันที่ไทย"
const datePartsTH = (date) => {
    const t = new Date(date.getTime() + TH_OFFSET_MS);
    return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
};

const orderRevenue = (od) =>
    (od?.products || []).reduce(
        (s, p) => s + Number(p.price || 0) * Number(p.count || 0),
        0
    );

/* ========= สถานะตาม enum OrderStatus ========= */
const STATUS_LABEL = {
    PENDING: "ผู้ขายได้รับคำสั่งซื้อแล้ว",
    CONFIRMED: "ผู้ขายจัดเตรียมสินค้าแล้วรอผู้ซื้อมารับ",
    COMPLETED: "ผู้ซื้อมารับสินค้าแล้ว",
    CANCELED: "ยกเลิก",
};
const STATUS_COLOR = {
    PENDING: "#F59E0B",
    CONFIRMED: "#3B82F6",
    COMPLETED: "#10B981",
    CANCELED: "#EF4444",
};
const isCompletedOrder = (s) => String(s) === "COMPLETED";

// เดาประเภทเสื้อจากชื่อ (ไว้ใช้ในรีวิว/กราฟประเภท)
const reviewTypeFromTitle = (title) => {
    const t = String(title || "").trim();
    const m = t.match(/^เสื้อ\s*(.+)$/i);
    const type = (m ? m[1] : t).trim();
    return type || "อื่น ๆ";
};

/* =============== UI atoms =============== */
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

// ย่อจำนวนเงินแบบ 1k, 1.2k
const kfmt = (n) => {
    const x = Number(n) || 0;
    if (Math.abs(x) >= 1_000_000) return (x / 1e6).toFixed(1).replace(/\.0$/, "") + "m";
    if (Math.abs(x) >= 1000) return (x / 1e3).toFixed(0) + "k";
    return String(Math.round(x));
};

// หาเพดานแกนแบบมี headroom 10%
const niceMax = (arr, key) => {
    const mx = Math.max(0, ...arr.map((d) => Number(d?.[key] || 0)));
    if (mx === 0) return 10;
    const up = mx * 1.1;
    const pow = Math.pow(10, Math.floor(Math.log10(up)));
    return Math.ceil(up / pow) * pow;
};

// สำหรับกราฟแบบแยกแท่งต่อประเภท: หา max จากทุกประเภท
const niceMaxMulti = (rows, typeKeys) => {
    let mx = 0;
    for (const r of rows || []) {
        for (const t of typeKeys || []) {
            const v = Number(r?.[t] || 0);
            if (v > mx) mx = v;
        }
    }
    if (mx === 0) return 10;
    const up = mx * 1.1;
    const pow = Math.pow(10, Math.floor(Math.log10(up)));
    return Math.ceil(up / pow) * pow;
};

const Kpi = ({ label, value, icon, trend }) => (
    <Card>
        <div className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-50 text-gray-700 ring-1 ring-gray-200">{icon}</div>
            <div className="flex-1 leading-tight">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-lg sm:text-xl font-semibold tracking-tight">{value}</div>
                {trend && <div className="text-[11px] text-gray-500 mt-0.5">{trend}</div>}
            </div>
        </div>
    </Card>
);

/* ===== Label: ยอดบาทบนหัวแท่ง (โหมด total) ===== */
const BarValueTHBLabelTop = (props) => {
    const { value, x, y, width } = props || {};
    const v = Number(value || 0);
    if (v <= 0) return null;
    const cx = (x ?? 0) + (width ?? 0) / 2;
    const cy = (y ?? 0) - 8;
    return (
        <text
            x={cx}
            y={cy}
            textAnchor="middle"
            fontSize={12}
            fill="#334155"
            style={{ fontVariantNumeric: "tabular-nums" }}
        >
            {THB(v)}
        </text>
    );
};

/* ===== Label: ยอดบาทบนหัวแท่ง (โหมด byType, ใช้ font เล็กกว่านิด) ===== */
const BarValueTHBLabelTopSmall = (props) => {
    const { value, x, y, width } = props || {};
    const v = Number(value || 0);
    if (v <= 0) return null;

    const cx = (x ?? 0) + (width ?? 0) / 2;
    const cy = (y ?? 0) - 6;

    return (
        <text
            x={cx}
            y={cy}
            textAnchor="middle"
            fontSize={11}
            fill="#334155"
            style={{ fontVariantNumeric: "tabular-nums" }}
        >
            {THB(v)}
        </text>
    );
};

/* =============== Main =============== */
export default function AdminSalesDashboard() {
    const token = useEcomStore((s) => s.token);

    // เปิดมาเป็น "รายวัน" + "ตามประเภทเสื้อ"
    const [gran, setGran] = useState("day"); // day | month | year
    const [range, setRange] = useState({ start: "", end: "" }); // yyyy-mm-dd (Thai day)
    const [chartMode, setChartMode] = useState("byType"); // default: ตามประเภทเสื้อ

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    // รีวิว (แอดมิน)
    const [reviewStats, setReviewStats] = useState([]);
    const [latestReviews, setLatestReviews] = useState([]);
    const [reviewTypeFilter, setReviewTypeFilter] = useState("");

    // ตั้งค่า default range ตาม "วันไทย"
    const applyGranDefaultRange = (g) => {
        const now = new Date();
        const { year, month, day } = datePartsTH(now);
        const endThai = new Date(Date.UTC(year, month - 1, day) - TH_OFFSET_MS); // 00:00 ไทย ของวันนี้
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
    }, [token, range.start, range.end]);

    /* ====== filter ช่วงวันที่แบบ "วันไทย" ====== */
    const filtered = useMemo(() => {
        const from = startOfThaiDayUTC(range.start);
        const to = nextThaiDayUTC(startOfThaiDayUTC(range.end)); // [from, to)
        return (rows || []).filter((od) => {
            const t = toDateUTC(od?.createdAt);
            if (!t) return false;
            if (from && t < from) return false;
            if (to && t >= to) return false;
            return true;
        });
    }, [rows, range.start, range.end]);

    /* เฉพาะออเดอร์สำเร็จ */
    const successOrders = useMemo(
        () => filtered.filter((o) => isCompletedOrder(o?.orderStatus)),
        [filtered]
    );

    /* ====== KPIs ====== */
    const kpis = useMemo(() => {
        const orderCount = successOrders.length;
        const revenue = successOrders.reduce((s, od) => s + orderRevenue(od), 0);
        const items = successOrders.reduce(
            (s, od) =>
                s + (od?.products || []).reduce((x, p) => x + Number(p?.count || 0), 0),
            0
        );
        return { orderCount, revenue, items };
    }, [successOrders]);

    /* ====== กลุ่มตามช่วงเวลาแบบ "วันไทย" จริง ====== */
    const keyForThai = (dateStr) => {
        const d = toDateUTC(dateStr);
        if (!d) return "-";
        const p = datePartsTH(d);
        if (gran === "day")
            return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(
                2,
                "0"
            )}`;
        if (gran === "month") return `${p.year}-${String(p.month).padStart(2, "0")}`;
        return `${p.year}`;
    };

    // ยอดขาย + จำนวนชิ้น + 2 ชื่อสินค้าท็อปต่อช่วงเวลา (tooltip โหมด total)
    const revenueQtyByPeriod = useMemo(() => {
        const map = new Map();

        for (const od of successOrders) {
            const k = keyForThai(od?.createdAt);
            const cur =
                map.get(k) || { x: k, total: 0, qty: 0, titlesMap: new Map() };

            for (const line of od?.products || []) {
                const price = Number(line?.price) || 0;
                const count = Number(line?.count ?? line?.quantity ?? 0) || 0;
                const title = String(line?.productTitle || `SKU-${line?.variantId}`);

                cur.total += price * count;
                cur.qty += count;
                cur.titlesMap.set(
                    title,
                    (cur.titlesMap.get(title) || 0) + price * count
                );
            }
            map.set(k, cur);
        }

        const toLabel = (m) => {
            const tops = Array.from(m.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 2)
                .map(([t]) => t);
            const joined = tops.join(" • ");
            return joined.length > 26 ? joined.slice(0, 24) + "…" : joined;
        };

        return Array.from(map.values())
            .map((o) => ({
                x: o.x,
                total: Number(o.total) || 0,
                qty: Number(o.qty) || 0,
                titles: o.titlesMap?.size ? toLabel(o.titlesMap) : "",
            }))
            .sort((a, b) => a.x.localeCompare(b.x));
    }, [successOrders, gran]);

    /* ====== ยอดขายตามประเภทเสื้อ (แยกแท่งต่อประเภท) ====== */
    const groupedByType = useMemo(() => {
        // periodKey -> { x, types: Map<type, {revenue, qty}> }
        const per = new Map();
        const allTypesSet = new Set();

        for (const od of successOrders) {
            const k = keyForThai(od?.createdAt);
            const cur = per.get(k) || { x: k, types: new Map() };

            for (const line of od?.products || []) {
                const price = Number(line?.price) || 0;
                const count = Number(line?.count ?? line?.quantity ?? 0) || 0;

                const rawType = reviewTypeFromTitle(line?.productTitle);
                const type = rawType && rawType.trim() ? rawType : "อื่น ๆ";

                allTypesSet.add(type);

                const t = cur.types.get(type) || { revenue: 0, qty: 0 };
                t.revenue += price * count;
                t.qty += count;
                cur.types.set(type, t);
            }

            per.set(k, cur);
        }

        const typeKeys = Array.from(allTypesSet.values()).sort((a, b) =>
            a.localeCompare(b, "th")
        );

        const rows = Array.from(per.values())
            .map((o) => {
                const base = { x: o.x };
                typeKeys.forEach((t) => {
                    const v = o.types.get(t) || { revenue: 0, qty: 0 };
                    base[t] = v.revenue;
                    base[`${t}__qty`] = v.qty;
                });
                return base;
            })
            .sort((a, b) => String(a.x).localeCompare(String(b.x)));

        return { rows, typeKeys };
    }, [successOrders, gran]);

    // สีสำหรับประเภท (วนซ้ำถ้าไม่พอ) + mapping คงที่ต่อชื่อ
    const TYPE_COLORS = [
        "#4f46e5", // Indigo
        "#10b981", // Emerald
        "#ef4444", // Red
        "#f59e0b", // Amber
        "#06b6d4", // Cyan
        "#8b5cf6", // Violet
        "#22c55e", // Green
        "#e11d48", // Rose
        "#14b8a6", // Teal
        "#a855f7", // Purple
    ];
    const typeColorMap = useMemo(
        () =>
            Object.fromEntries(
                (groupedByType.typeKeys || []).map((t, i) => [
                    t,
                    TYPE_COLORS[i % TYPE_COLORS.length],
                ])
            ),
        [groupedByType.typeKeys]
    );

    /* ---------- สัดส่วนสถานะ ---------- */
    const statusPie = useMemo(() => {
        const map = new Map();
        for (const od of filtered) {
            const key = String(od?.orderStatus || "");
            map.set(key, (map.get(key) || 0) + 1);
        }
        return Array.from(map.entries()).map(([key, value]) => ({
            name: STATUS_LABEL[key] ?? key,
            value,
            fill: STATUS_COLOR[key] ?? "#9CA3AF",
        }));
    }, [filtered]);

    /* ---------- Top Products ---------- */
    const topProducts = useMemo(() => {
        const map = new Map();
        for (const od of successOrders) {
            for (const line of od?.products || []) {
                const key = line?.productTitle || `SKU-${line?.variantId}`;
                const prev =
                    map.get(key) || { title: key, qty: 0, revenue: 0 };
                prev.qty += Number(line?.count || 0);
                prev.revenue +=
                    Number(line?.price || 0) *
                    Number(line?.count || 0);
                map.set(key, prev);
            }
        }
        return Array.from(map.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
    }, [successOrders]);

    /* ---------- Tooltip โหมด "ตามประเภทเสื้อ" (แยกแท่ง) ---------- */
    const GroupedTooltip = ({ active, payload, label }) => {
        if (!active || !payload || payload.length === 0) return null;

        const sortedItems = [...payload]
            .filter((it) => Number(it.value || 0) > 0)
            .sort((a, b) => Number(b.value || 0) - Number(a.value || 0));

        const totalBar = sortedItems.reduce(
            (s, it) => s + Number(it.value || 0),
            0
        );
        const totalQty = sortedItems.reduce((s, it) => {
            const qty = Number(it?.payload?.[`${it.name}__qty`] || 0) || 0;
            return s + qty;
        }, 0);

        return (
            <div
                className="rounded-lg bg-white/95 shadow border p-2.5"
                style={{ backdropFilter: "saturate(120%) blur(2px)" }}
            >
                <div className="font-medium mb-1">
                    {fmtThaiPeriodLabel(label, gran)}
                </div>

                <div className="mb-1 text-sm font-medium">
                    ราคารวม : {THB(totalBar)} • {nfmt(totalQty)} ชิ้น
                </div>

                {sortedItems.map((it) => {
                    const qty = Number(it?.payload?.[`${it.name}__qty`] || 0);
                    return (
                        <div key={it.name} className="flex items-center gap-2">
                            <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ background: it.color }}
                            />
                            <span className="text-sm">
                                {it.name} : {THB(it.value)} • {nfmt(qty)} ชิ้น
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    /* ---------- Tooltip โหมด "ยอดขายรวม" ---------- */
    const TotalTooltip = (props) => {
        const { active, payload, label } = props || {};
        if (!active || !payload || payload.length === 0) return null;
        const p0 = payload[0];
        const qty = p0?.payload?.qty ?? 0;
        const title = p0?.payload?.titles ? ` • ${p0.payload.titles}` : "";
        return (
            <div className="rounded-lg bg-white/95 shadow border p-2.5">
                <div className="font-medium mb-1">
                    {fmtThaiPeriodLabel(label, gran)}
                    {title}
                </div>
                <div className="text-sm">
                    ยอดขาย : {THB(p0?.value || 0)} • {nfmt(qty)} ชิ้น
                </div>
            </div>
        );
    };

    /* =============== UI =============== */
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
                    {/* โหมดกราฟ */}
                    <div className="inline-flex rounded-xl border overflow-hidden">
                        {[
                            { k: "total", label: "ยอดขายรวม" },
                            { k: "byType", label: "ตามประเภทเสื้อ" },
                        ].map(({ k, label }) => (
                            <button
                                key={k}
                                onClick={() => setChartMode(k)}
                                className={`px-3 py-2 text-sm ${
                                    chartMode === k
                                        ? "bg-indigo-600 text-white"
                                        : "bg-white hover:bg-gray-50"
                                }`}
                                title={label}
                                type="button"
                            >
                                {label}
                            </button>
                        ))}
                    </div>

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
                                className={`px-3 py-2 text-sm ${
                                    gran === k
                                        ? "bg-indigo-600 text-white"
                                        : "bg-white hover:bg-gray-50"
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
                            onChange={(e) =>
                                setRange((r) => ({ ...r, start: e.target.value }))
                            }
                            title="วันที่เริ่ม"
                        />
                        <span className="text-gray-500">ถึง</span>
                        <input
                            type="date"
                            className="px-3 py-2 w-[150px] border rounded-lg"
                            value={range.end}
                            onChange={(e) =>
                                setRange((r) => ({ ...r, end: e.target.value }))
                            }
                            title="วันที่สิ้นสุด"
                        />
                    </div>
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
                    {/* KPIs */}
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
                                title={
                                    chartMode === "total"
                                        ? `ยอดขายแบบ${
                                              gran === "day"
                                                  ? "รายวัน"
                                                  : gran === "month"
                                                  ? "รายเดือน"
                                                  : "รายปี"
                                          }`
                                        : `ยอดขายตามประเภทเสื้อ (${
                                              gran === "day"
                                                  ? "รายวัน"
                                                  : gran === "month"
                                                  ? "รายเดือน"
                                                  : "รายปี"
                                          })`
                                }
                                subtitle={
                                    chartMode === "total"
                                        ? "แกน X = ช่วงเวลา • แกน Y = ยอดขาย(บาท) • ตัวเลข (บาท) อยู่บนหัวแท่ง"
                                        : "Bar แยกสีและแท่งต่อประเภทเสื้อในช่วงเวลาเดียวกัน • Tooltip โชว์ยอดแต่ละประเภท + รวมทั้งหมด • ตัวเลขบนหัวแท่งคือยอดขายของประเภทนั้น"
                                }
                                icon={<LineChartIcon className="h-5 w-5 text-indigo-600" />}
                            />

                            {/* ===== โหมด: ยอดขายรวม ===== */}
                            {chartMode === "total" && (
                                <div className="p-4 h-96">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={revenueQtyByPeriod}
                                            margin={{
                                                top: 48,
                                                right: 24,
                                                bottom: 28,
                                                left: 56,
                                            }}
                                            barCategoryGap="40%"
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis
                                                dataKey="x"
                                                tick={{ fontSize: 12 }}
                                                tickMargin={10}
                                                height={36}
                                                tickFormatter={(v) =>
                                                    fmtThaiPeriodLabel(v, gran)
                                                }
                                            >
                                                <Label
                                                    value={
                                                        gran === "day"
                                                            ? "วันที่ (ไทย)"
                                                            : gran === "month"
                                                            ? "เดือน (ไทย)"
                                                            : "ปี"
                                                    }
                                                    position="insideBottom"
                                                    dy={18}
                                                    style={{
                                                        fill: "#64748b",
                                                        fontSize: 12,
                                                    }}
                                                />
                                            </XAxis>
                                            <YAxis
                                                tick={{ fontSize: 12 }}
                                                tickFormatter={(v) => kfmt(v)}
                                                domain={[
                                                    0,
                                                    niceMax(
                                                        revenueQtyByPeriod,
                                                        "total"
                                                    ),
                                                ]}
                                            >
                                                <Label
                                                    value="ยอดขาย (บาท)"
                                                    angle={-90}
                                                    position="insideLeft"
                                                    style={{
                                                        fill: "#64748b",
                                                        fontSize: 12,
                                                        textAnchor: "middle",
                                                    }}
                                                    dy={-10}
                                                    dx={-26}
                                                />
                                            </YAxis>
                                            <Tooltip content={<TotalTooltip />} />
                                            <Bar
                                                dataKey="total"
                                                fill="#4f46e5"
                                                radius={[10, 10, 4, 4]}
                                                maxBarSize={44}
                                                isAnimationActive={false}
                                            >
                                                <LabelList
                                                    dataKey="total"
                                                    content={(p) => (
                                                        <BarValueTHBLabelTop {...p} />
                                                    )}
                                                />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* ===== โหมด: ยอดขายตามประเภทเสื้อ (แยกแท่ง ไม่ซ้อน) ===== */}
                            {chartMode === "byType" && (
                                <div className="p-4 h-96">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={groupedByType.rows}
                                            margin={{
                                                top: 48,
                                                right: 24,
                                                bottom: 28,
                                                left: 56,
                                            }}
                                            barCategoryGap="20%" // ระยะห่างกลุ่ม
                                            barGap={4} // ระยะห่างแท่งในกลุ่ม
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis
                                                dataKey="x"
                                                tick={{ fontSize: 12 }}
                                                tickMargin={10}
                                                height={36}
                                                tickFormatter={(v) =>
                                                    fmtThaiPeriodLabel(v, gran)
                                                }
                                            >
                                                <Label
                                                    value={
                                                        gran === "day"
                                                            ? "วันที่ (ไทย)"
                                                            : gran === "month"
                                                            ? "เดือน (ไทย)"
                                                            : "ปี"
                                                    }
                                                    position="insideBottom"
                                                    dy={18}
                                                    style={{
                                                        fill: "#64748b",
                                                        fontSize: 12,
                                                    }}
                                                />
                                            </XAxis>
                                            <YAxis
                                                tick={{ fontSize: 12 }}
                                                tickFormatter={(v) => kfmt(v)}
                                                domain={[
                                                    0,
                                                    niceMaxMulti(
                                                        groupedByType.rows,
                                                        groupedByType.typeKeys
                                                    ),
                                                ]}
                                            >
                                                <Label
                                                    value="ยอดขาย (บาท)"
                                                    angle={-90}
                                                    position="insideLeft"
                                                    style={{
                                                        fill: "#64748b",
                                                        fontSize: 12,
                                                        textAnchor: "middle",
                                                    }}
                                                    dy={-10}
                                                    dx={-26}
                                                />
                                            </YAxis>

                                            {/* Tooltip แบบกำหนดเองสำหรับกราฟแบบแบ่งแท่ง */}
                                            <Tooltip content={<GroupedTooltip />} />

                                            <Legend
                                                layout="horizontal"
                                                verticalAlign="top"
                                                align="center"
                                                iconType="circle"
                                                iconSize={10}
                                                wrapperStyle={{
                                                    top: 8,
                                                    lineHeight: "18px",
                                                }}
                                            />

                                            {/* วาดแท่งแบบไม่ใช้ stackId -> จะได้แท่งแยกกันตามประเภท */}
                                            {groupedByType.typeKeys.map((t) => (
                                                <Bar
                                                    key={t}
                                                    dataKey={t}
                                                    name={t}
                                                    fill={typeColorMap[t]}
                                                    isAnimationActive={false}
                                                    maxBarSize={44}
                                                    radius={[6, 6, 4, 4]}
                                                >
                                                    {/* ป้ายราคาบนหัวแท่ง (บาทของประเภทนั้นเอง) */}
                                                    <LabelList
                                                        dataKey={t}
                                                        content={(p) => (
                                                            <BarValueTHBLabelTopSmall
                                                                {...p}
                                                            />
                                                        )}
                                                    />
                                                </Bar>
                                            ))}
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </Card>

                        <Card>
                            <CardHeader
                                title="สัดส่วนสถานะออเดอร์"
                                subtitle="ต่อจำนวนออเดอร์ (ช่วงวันที่ไทย)"
                                icon={
                                    <PieChartIcon className="h-5 w-5 text-indigo-600" />
                                }
                            />
                            <div className="p-4">
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={statusPie}
                                                dataKey="value"
                                                innerRadius={50}
                                                outerRadius={80}
                                                paddingAngle={2}
                                                labelLine={false}
                                                label={({
                                                    cx,
                                                    cy,
                                                    midAngle,
                                                    outerRadius,
                                                    fill,
                                                    percent,
                                                }) => {
                                                    const RAD = Math.PI / 180;
                                                    const GAP_FROM_ARC = 6;
                                                    const ELBOW_LEN = 10;
                                                    const HORIZ_LEN = 15;
                                                    const LABEL_PAD = 6;
                                                    const FONT_SIZE = 16;
                                                    const FONT_WEIGHT = 800;

                                                    const pct = Math.max(
                                                        0,
                                                        Math.min(
                                                            100,
                                                            (percent || 0) * 100
                                                        )
                                                    );
                                                    const label = `${pct.toFixed(
                                                        1
                                                    )}%`;

                                                    const a = -midAngle * RAD;
                                                    const cos = Math.cos(a);
                                                    const sin = Math.sin(a);
                                                    const isRight = cos >= 0;

                                                    const x1 =
                                                        cx +
                                                        (outerRadius +
                                                            GAP_FROM_ARC) *
                                                            cos;
                                                    const y1 =
                                                        cy +
                                                        (outerRadius +
                                                            GAP_FROM_ARC) *
                                                            sin;

                                                    const x2 =
                                                        cx +
                                                        (outerRadius +
                                                            GAP_FROM_ARC +
                                                            ELBOW_LEN) *
                                                            cos;
                                                    const y2 =
                                                        cy +
                                                        (outerRadius +
                                                            GAP_FROM_ARC +
                                                            ELBOW_LEN) *
                                                            sin;

                                                    const x3 =
                                                        x2 +
                                                        (isRight
                                                            ? HORIZ_LEN
                                                            : -HORIZ_LEN);
                                                    const y3 = y2;

                                                    const tx =
                                                        x3 +
                                                        (isRight
                                                            ? LABEL_PAD
                                                            : -LABEL_PAD);
                                                    const ty = y3;

                                                    const strokeColor =
                                                        fill || "#94a3b8";
                                                    const textColor =
                                                        fill || "#0f172a";

                                                    return (
                                                        <g>
                                                            <path
                                                                d={`M ${x1},${y1} L ${x2},${y2} L ${x3},${y3}`}
                                                                stroke={
                                                                    strokeColor
                                                                }
                                                                strokeWidth="2"
                                                                fill="none"
                                                                strokeLinecap="round"
                                                            />
                                                            <text
                                                                x={tx}
                                                                y={ty}
                                                                stroke="white"
                                                                strokeWidth="3"
                                                                fill="white"
                                                                fontSize={
                                                                    FONT_SIZE
                                                                }
                                                                fontWeight={
                                                                    FONT_WEIGHT
                                                                }
                                                                textAnchor={
                                                                    isRight
                                                                        ? "start"
                                                                        : "end"
                                                                }
                                                                dominantBaseline="middle"
                                                                style={{
                                                                    fontVariantNumeric:
                                                                        "tabular-nums",
                                                                }}
                                                            >
                                                                {label}
                                                            </text>
                                                            <text
                                                                x={tx}
                                                                y={ty}
                                                                fill={textColor}
                                                                fontSize={
                                                                    FONT_SIZE
                                                                }
                                                                fontWeight={
                                                                    FONT_WEIGHT
                                                                }
                                                                textAnchor={
                                                                    isRight
                                                                        ? "start"
                                                                        : "end"
                                                                }
                                                                dominantBaseline="middle"
                                                                style={{
                                                                    fontVariantNumeric:
                                                                        "tabular-nums",
                                                                }}
                                                            >
                                                                {label}
                                                            </text>
                                                        </g>
                                                    );
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* legend statuses */}
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {statusPie.map((s) => (
                                        <div key={s.name} className="max-w-full">
                                            <div
                                                className="flex items-center gap-2 px-2.5 py-1 rounded-lg ring-1 ring-gray-200 bg-white max-w-full"
                                                title={`${s.name} • ${nfmt(
                                                    s.value
                                                )} รายการ`}
                                            >
                                                {/* จุดสี */}
                                                <span
                                                    className="h-2.5 w-2.5 rounded-full shrink-0"
                                                    style={{
                                                        backgroundColor:
                                                            s.fill,
                                                    }}
                                                />

                                                {/* ชื่อสถานะ */}
                                                <span className="flex-1 min-w-0 text-sm truncate text-gray-900 max-w-[12rem] sm:max-w-[16rem]">
                                                    {s.name}
                                                </span>

                                                {/* จำนวนออเดอร์ */}
                                                <span className="shrink-0 tabular-nums text-gray-700">
                                                    {nfmt(s.value)}
                                                </span>
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
                                                    <tr
                                                        key={p.title}
                                                        className="border-t"
                                                    >
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100">
                                                                    #{idx + 1}
                                                                </span>
                                                                <span
                                                                    className="font-medium truncate max-w-[320px]"
                                                                    title={p.title}
                                                                >
                                                                    {p.title}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            {nfmt(p.qty)}
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            {THB(p.revenue)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </Card>

                        <TopCustomersTable customersSource={successOrders} />
                    </div>

                    {/* ★ คะแนนรีวิว & รีวิวล่าสุด */}
                    <ReviewsPanels
                        reviewStats={reviewStats}
                        latestReviews={latestReviews}
                        reviewTypeFilter={reviewTypeFilter}
                        setReviewTypeFilter={setReviewTypeFilter}
                    />
                </>
            )}
        </div>
    );
}

/* ======= แยกย่อยตารางลูกค้า Top ======= */
function TopCustomersTable({ customersSource = [] }) {
    const nfmt = (n) => (Number(n) || 0).toLocaleString();
    const THB = (n) =>
        (Number(n) || 0).toLocaleString("th-TH", {
            style: "currency",
            currency: "THB",
        });
    const orderRevenue = (od) =>
        (od?.products || []).reduce(
            (s, p) => s + Number(p.price || 0) * Number(p.count || 0),
            0
        );

    const topCustomers = useMemo(() => {
        const map = new Map();
        for (const od of customersSource) {
            const u = od?.orderBuy || {};
            const key = u?.email || `UID-${u?.id}`;
            const prev =
                map.get(key) || {
                    name:
                        `${u?.first_name || ""} ${u?.last_name || ""}`.trim() ||
                        key,
                    orders: 0,
                    revenue: 0,
                };
            prev.orders += 1;
            prev.revenue += orderRevenue(od);
            map.set(key, prev);
        }
        return Array.from(map.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 8);
    }, [customersSource]);

    return (
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
                                                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100">
                                                    #{idx + 1}
                                                </span>
                                                <span
                                                    className="font-medium truncate max-w-[320px]"
                                                    title={c.name}
                                                >
                                                    {c.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {nfmt(c.orders)}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {THB(c.revenue)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Card>
    );
}

/* ======= แยกย่อยรีวิว ======= */
function ReviewsPanels({
    reviewStats,
    latestReviews,
    reviewTypeFilter,
    setReviewTypeFilter,
}) {
    const nfmt = (n) => (Number(n) || 0).toLocaleString();
    const reviewTypeFromTitle = (title) => {
        const t = String(title || "").trim();
        const m = t.match(/^เสื้อ\s*(.+)$/i);
        const type = (m ? m[1] : t).trim();
        return type || "อื่น ๆ";
    };

    const reviewTypesWithCount = useMemo(() => {
        const map = new Map();
        (latestReviews || []).forEach((rv) => {
            const type = reviewTypeFromTitle(rv?.productTitle);
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
            (rv) => reviewTypeFromTitle(rv?.productTitle) === reviewTypeFilter
        );
    }, [latestReviews, reviewTypeFilter]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
                <CardHeader
                    title="คะแนนรีวิวสินค้า (Top)"
                    subtitle="ช่วงวันที่ไทยที่เลือก"
                    icon={<Star className="h-5 w-5 text-yellow-400" />}
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
                                                    <span
                                                        className="font-medium truncate max-w-[320px]"
                                                        title={r.title}
                                                    >
                                                        {r.title}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <span className="inline-flex items-center gap-1">
                                                        <Star className="h-4 w-4 fill-yellow-300 stroke-yellow-300" />
                                                        {Number(
                                                            r?.ratingAvg || 0
                                                        ).toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    {nfmt(r?.ratingCount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            <Card>
                <CardHeader
                    title={`รีวิวล่าสุด (${nfmt(
                        latestReviewsFiltered.length
                    )} จาก ${nfmt(latestReviews.length)})`}
                    subtitle="ช่วงวันที่ไทยที่เลือก"
                    icon={<Star className="h-5 w-5 text-yellow-400" />}
                />
                <div className="p-4">
                    <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1 py-1 sm:px-1 flex-nowrap">
                        <button
                            type="button"
                            onClick={() => setReviewTypeFilter("")}
                            className={`px-3 py-1.5 rounded-full text-sm ring-1 ${
                                reviewTypeFilter === ""
                                    ? "bg-indigo-600 text-white ring-indigo-600"
                                    : "bg-white text-gray-700 ring-gray-200 hover:bg-gray-50"
                            }`}
                            title="แสดงรีวิวทั้งหมด"
                        >
                            ทั้งหมด <span className="opacity-70"></span>
                        </button>
                        {reviewTypesWithCount.map(({ type, count }) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() =>
                                    setReviewTypeFilter((cur) =>
                                        cur === type ? "" : type
                                    )
                                }
                                className={`px-3 py-1.5 rounded-full text-sm ring-2 whitespace-nowrap ${
                                    reviewTypeFilter === type
                                        ? "bg-indigo-600 text-white ring-indigo-600"
                                        : "bg-white text-gray-900 ring-gray-200 hover:bg-gray-50"
                                }`}
                                title={`รีวิวประเภท: ${type}`}
                            >
                                {type}{" "}
                                <span className="opacity-70">
                                    ({nfmt(count)})
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="space-y-3 max-h-80 overflow-auto pr-1">
                        {(latestReviewsFiltered?.length ?? 0) === 0 ? (
                            <div className="text-sm text-gray-500">
                                {reviewTypeFilter
                                    ? "ไม่มีรีวิวในประเภทนี้"
                                    : "ไม่มีข้อมูลรีวิว"}
                            </div>
                        ) : (
                            latestReviewsFiltered.map((rv) => (
                                <div
                                    key={rv.id}
                                    className="p-3 rounded-xl border bg-gray-50"
                                >
                                    <div className="flex items-center justify-between">
                                        <div
                                            className="font-medium truncate max-w-[60%]"
                                            title={rv.productTitle}
                                        >
                                            {rv.productTitle}
                                        </div>
                                        <div className="inline-flex items-center gap-1 text-sm">
                                            <Star className="h-4 w-4 fill-yellow-300 stroke-yellow-300" />
                                            {rv.rating}
                                        </div>
                                    </div>

                                    <div className="text-xs text-gray-500 mt-0.5">
                                        โดย {rv.userName || "ผู้ใช้"} •{" "}
                                        {rv.createdAt
                                            ? new Date(
                                                  rv.createdAt
                                              ).toLocaleString("th-TH")
                                            : "-"}
                                    </div>
                                    {rv.text && (
                                        <div className="text-sm text-gray-700 mt-2 whitespace-pre-line">
                                            {rv.text}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}
