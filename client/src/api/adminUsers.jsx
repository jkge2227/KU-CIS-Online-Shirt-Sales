// client/src/api/adminUsers.jsx
import axios from "axios";
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5001/api";

const api = axios.create({ baseURL: API_BASE });
const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export const adminListUsers = (token, { page = 1, pageSize = 10, q = "" } = {}) =>
    api.get("/admin/users", { ...auth(token), params: { page, pageSize, q } });

export const adminCreateUser = (token, payload) =>
    api.post("/admin/users", payload, auth(token));

export const adminUpdateUser = (token, id, payload) =>
    api.put(`/admin/users/${id}`, payload, auth(token));

export const adminUpdateUserPassword = (token, id, newPassword) =>
    api.patch(`/admin/users/${id}/password`, { newPassword }, auth(token));

export const adminDeleteUser = (token, id) =>
    api.delete(`/admin/users/${id}`, auth(token));
