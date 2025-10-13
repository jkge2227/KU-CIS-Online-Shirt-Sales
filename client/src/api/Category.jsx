// src/api/Category.jsx
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5001/api";
const api = axios.create({ baseURL: API_BASE });
const authHeaders = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export const createCategory = async (token, form) => {
    return api.post(`/category`, form, authHeaders(token));
};

export const listCategory = async () => {
    return api.get(`/category`);
};

export const removeCategory = async (token, id) => {
    return api.delete(`/category/${id}`, authHeaders(token));
};

export const updateCategory = async (token, id, form) => {
    return api.put(`/category/${id}`, form, authHeaders(token));
};
