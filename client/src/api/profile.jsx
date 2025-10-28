import axios from "axios";
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5002/api";
const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });
const api = axios.create({ baseURL: API_BASE, timeout: 15000 });
api.interceptors.response.use(
    (res) => res,
    (err) => {
        const msg = err?.response?.data?.message || err?.message || "Network/Server Error";
        return Promise.reject(new Error(msg));
    }
);

export const getMyProfile = (token) =>
    api.get("/profile", auth(token));

export const updateMyProfile = (token, payload) =>
    api.put("/upprofile", payload, auth(token));

export const changeMyPassword = (token, body) =>
    api.put("/me/password", body, auth(token));


export const requestPasswordOtp = (email) =>
    api.post("/forgot-password-otp", { email });

export const verifyResetOtp = (email, code) =>
    api.post("/verify-reset-otp", { email, code });

export const resetPasswordWithOtp = (otpToken, password) =>
    api.post("/reset-password-otp", { otpToken, password });