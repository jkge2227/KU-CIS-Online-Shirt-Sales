import axios from "axios";

const API_BASE = import.meta.env?.VITE_API_URL ?? "http://localhost:5002/api";
const api = axios.create({ baseURL: API_BASE });
const auth = (t) => ({ headers: { Authorization: `Bearer ${t}` } });

export const createSize = (token, form) =>
  api.post("/size", form, auth(token));

export const listSize = () =>
  api.get("/size");

export const removeSize = (token, id) =>
  api.delete(`/size/${id}`, auth(token));

// ✅ เพิ่มฟังก์ชันแก้ไข
export const updateSize = (token, id, form) =>
  api.put(`/size/${id}`, form, auth(token));
