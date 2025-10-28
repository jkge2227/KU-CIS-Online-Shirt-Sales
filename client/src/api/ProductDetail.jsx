// client/src/api/product.js
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5002/api";
const api = axios.create({ baseURL: API_BASE });

// ดึงสินค้าทั้งหมด
export const listProduct = async (count) => {
  return api.get(`/products/${count}`);
};

// ค้นหา
export const searchFilters = async (arg) => {
  return api.post("/search/filters", arg);
};

// ✅ ดึงสินค้าตาม ID
export const getProductById = async (id) => {
  return api.get(`/product/${id}`);
};

// ✅ ดึงรีวิวสินค้า
export const listProductReviewsDetail = async (productId, page = 1, limit = 5) => {
  return api.get(`/products/${productId}/reviews/detail`, {
    params: { page, limit },
  });
};
