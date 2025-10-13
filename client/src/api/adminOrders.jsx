// client/src/api/adminOrders.jsx
import axios from "axios";
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5001/api";

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

/**
 * ดึงแจ้งเตือนสินค้าสต็อกต่ำ (< 10)
 * server ควรคืนเป็น array ของ { id, title, time?, unread?, href? }
 */
export const getLowStockNotifications = async (token) => {
    const res = await api.get("/admin/low-stock", authHeaders(token));
    const list = Array.isArray(res.data) ? res.data : [];

    return list.map((n) => {
        // พยายามหา productId จากฟิลด์ที่ backend อาจส่งมา
        const pid =
            n.productId ??
            n.product_id ??
            n.id ?? // บาง backend ใช้ id เป็น product id
            (() => {
                // เผื่อ backend ส่ง href แบบ /products/123 → ดึงเลขออกมา
                if (typeof n.href === "string") {
                    const m = n.href.match(/\/products\/(\d+)/);
                    return m ? Number(m[1]) : undefined;
                }
                return undefined;
            })();

        // ถ้าเดา pid ไม่ได้จริง ๆ ก็ fallback ไปหน้า statusorder
        const href = Number.isInteger(pid) ? `/admin/product/${pid}` : "/admin/statusorder";

        return {
            id: pid ?? n.id ?? Date.now(), // ให้มี id เสมอเพื่อใช้เป็น key
            title: n.title ?? "สต็อกต่ำ",
            time: n.time ?? "",
            unread: Boolean(n.unread ?? true),
            href,
            type: "stock",
            ts: n.ts ?? Date.now(),
        };
    });
};


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
