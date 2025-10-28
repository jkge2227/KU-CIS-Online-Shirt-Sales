// client/src/api/review.jsx
import axios from "axios";
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5002/api";
const api = axios.create({ baseURL: API_BASE });
const authHeaders = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

// ให้ดาว/รีวิวออเดอร์ (รีวิวทุกสินค้าภายในออเดอร์ ถ้าไม่ส่ง variants)
export const createOrderReviews = async (orderId, token, payload) => {
  // payload: { rating: 1..5, text?: string, variants?: number[] }
  return api.post(`/orders/${orderId}/reviews`, payload, authHeaders(token));
};

// ดึงเรตติ้งรวมของสินค้า
export const getProductRating = async (productId) => {
  return api.get(`/products/${productId}/rating`);
};

// สรุปคะแนนรีวิวต่อสินค้า (ภายในช่วงวันที่)
export const adminListReviewStats = (token, { startDate, endDate }) =>
  api.get("/admin/reviews/summary", { ...authHeaders(token), params: { startDate, endDate } });

// รีวิวล่าสุด (ภายในช่วงวันที่)
export const adminListReviews = (token, { startDate, endDate, page = 1, pageSize = 20 }) =>
  api.get("/admin/reviews", { ...authHeaders(token), params: { startDate, endDate, page, pageSize } });

export const getProductById = (id) =>
  api.get(`/product/${id}`);

export const listProductReviews = (productId, page = 1, pageSize = 20, rating) => {
  const params = { page, pageSize };
  if (Number.isFinite(rating)) params.rating = rating;
  return api.get(`/products/${productId}/reviews`, { params });
};

export const getMyOrderReviews = (orderId, token) =>
  api.get(`/orders/${orderId}/reviews/mine`, authHeaders(token));