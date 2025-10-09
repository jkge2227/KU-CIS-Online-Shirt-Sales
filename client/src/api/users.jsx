// client/src/api/users.jsx
import axios from "axios";

// ใช้ BASE URL เดียวกันทั้งไฟล์ (แก้ได้ด้วย VITE_API_URL)
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5001/api";

const api = axios.create({
  baseURL: API_BASE,
});

const authHeaders = (token) => ({
  headers: { Authorization: `Bearer ${token}` },
});

// ---------------- Cart ----------------
export const createUserCart = async (token, cart) => {
  return api.post("/user/cart", cart, authHeaders(token));
};

export const getUserCart = async (token) => {
  return api.get("/user/cart", authHeaders(token));
};

export const emptyCart = async (token) => {
  return api.delete("/user/cart", authHeaders(token));
};

// ---------------- Address ----------------
export const saveAddress = async (token, form) => {
  return api.post("/user/address", form, authHeaders(token));
};

// ---------------- Order ----------------
// สร้างออเดอร์จากตะกร้า
export const saveOrder = async (token) => {
  return api.post("/user/order", {}, authHeaders(token));
};

// ดึงออเดอร์ของผู้ใช้ (server คืน { ok: true, order: [...] })
export const listUserOrders = async (token) => {
  // ถ้าคุณมี /user/orders (พหูพจน์) ด้วย สามารถสลับ path ได้ตาม route จริง
  return api.get("/user/order", authHeaders(token));
};

// ยกเลิกออเดอร์ (เปลี่ยนสถานะเป็น "ยกเลิก", คืนสต็อกใน controller cancelMyOrder)
export const cancelUserOrder = async (id, token) => {
  return api.put(`/orders/${id}/cancel`, {}, authHeaders(token));
};

// ลบออเดอร์ (ยกเลิก+คืนสต็อก+ลบ ทั้งก้อน ใน controller cancelAndDeleteMyOrder)
export const deleteUserOrder = async (id, token) => {
  return api.delete(`/orders/${id}`, authHeaders(token));
};

// ดูประวัติคำสั่งซื้อ
export const listUserOrderHistory = async (token) => {
  return api.get("/user/order-history", authHeaders(token));
};