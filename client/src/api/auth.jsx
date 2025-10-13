// api/client.js
import axios from "axios";
const API_BASE = import.meta?.env?.VITE_API_URL ?? "http://localhost:5001/api";

export const api = axios.create({
    baseURL: API_BASE,
    timeout: 15000,
});

export const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

// ใช้แบบนี้
export const currentUser = (token) =>
    api.post("/current-user", {}, { headers: authHeader(token) });

export const currentAdmin = (token) =>
    api.post("/current-admin", {}, { headers: authHeader(token) });

// OTP helpers
export const requestEmailOtp = (email) =>
    api.post("/auth/otp/request", { email });

export const verifyEmailOtp = (email, otp) =>
    api.post("/auth/otp/verify", { email, otp });
