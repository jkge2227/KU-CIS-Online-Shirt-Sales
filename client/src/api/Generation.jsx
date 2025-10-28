// client/src/api/generation.jsx
import axios from "axios";

const API_BASE = import.meta.env?.VITE_API_URL ?? "http://localhost:5002/api";
const api = axios.create({ baseURL: API_BASE });
const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export const createGeneration = (token, form) =>
  api.post("/generation", form, auth(token));

export const listGeneration = () =>
  api.get("/generation");

export const removeGeneration = (token, id) =>
  api.delete(`/generation/${id}`, auth(token));

export const updateGeneration = (token, id, form) =>
  api.put(`/generation/${id}`, form, auth(token));
