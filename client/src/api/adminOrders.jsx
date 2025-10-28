// client/src/api/adminOrders.jsx
import axios from "axios";
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5002/api";

const api = axios.create({ baseURL: API_BASE });
const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export const adminListOrders = async (
    token,
    { page = 1, pageSize = 10, status = "", q = "", startDate = "", endDate = "" } = {}
) =>
    api.get(`/admin/orders`, {
        ...auth(token),
        params: { page, pageSize, status, q, startDate, endDate },
    });

export const adminUpdateOrderStatus = async (token, id, status) =>
    api.put(`/admin/orders/${id}/status`, { status }, auth(token));


// แนบ token แบบเดียวกันทุกฟังก์ชัน
const authHeaders = (token) => ({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
});


export const getNewOrderNotifications = async (token, { hours = 24 } = {}) => {
    const { data } = await api.get(`/admin/new-orders?hours=${hours}`, auth(token));
    const list = Array.isArray(data) ? data : [];
    return list.map((n) => ({
        id: n.id,
        title: n.title ?? "ออเดอร์ใหม่",
        time: n.time ?? "",
        unread: Boolean(n.unread ?? true),
        href: n.href || "/admin/statusorder",
        type: n.type || "order",
        ts: n.ts ?? Date.now(),
    }));
};

export const adminBulkSetPickup = async (token, payload) => {
    // payload: { orderIds: number[], place: string, pickupAt?: string(ISO), note?: string }
    return api.post('/admin/orders/pickup', payload, authHeaders(token));
};

export const adminUpdatePickup = async (token, id, payload) => {
    // payload: { place, pickupAt, note } หรือ { clear: true }
    return api.patch(`/admin/orders/${id}/pickup`, payload, authHeaders(token));
};
export const adminCancelOrder = (token, id, payload = {}) =>
    api.put(`/admin/orders/${id}/cancel`, payload, auth(token));

export const adminUpdateCancelInfo = (token, id, payload = {}) =>
    api.patch(`/admin/orders/${id}/cancel`, payload, auth(token));


// ===== SETTINGS =====
export const getLowStockThreshold = async (token) => {
    const res = await api.get("/admin/settings/low-stock-threshold", auth(token));
    return Number(res.data?.value ?? 9);
};

export const setLowStockThreshold = async (token, value) => {
    const res = await api.put("/admin/settings/low-stock-threshold", { value }, auth(token));
    return Number(res.data?.value);
};

// ===== LOW STOCK NOTIFICATIONS =====
export const getLowStockNotifications = async (token, options = {}) => {
    const { threshold } = options; // optional override per request
    const params = {};
    if (threshold !== undefined) params.threshold = threshold;

    const res = await api.get("/admin/low-stock", { ...auth(token), params });
    const data = Array.isArray(res.data?.items)
        ? res.data.items
        : Array.isArray(res.data)
            ? res.data
            : [];

    return data.map((n) => {
        const pid =
            n.productId ??
            n.product_id ??
            n.id ??
            (() => {
                if (typeof n.href === "string") {
                    const m = n.href.match(/\/products\/(\d+)/);
                    return m ? Number(m[1]) : undefined;
                }
                return undefined;
            })();

        const href = Number.isInteger(pid) ? `/admin/product/${pid}` : "/admin/statusorder";

        return {
            id: n.id ?? `stock:${pid ?? Date.now()}`,
            title: n.title ?? "สต็อกต่ำ",
            time: n.time ?? "",
            unread: Boolean(n.unread ?? true),
            href,
            type: "stock",
            ts: n.ts ?? Date.now(),
            productId: pid,
            variantId: n.variantId,
        };
    });
};

export const setVariantLowStockThreshold = async (token, variantId, value) => {
    // value: number | null | "" (ค่าว่าง = ล้างเป็น null)
    const res = await api.put(`/admin/variants/${variantId}/low-stock-threshold`, { value }, auth(token));
    return res.data; // { id, lowStockThreshold }
};