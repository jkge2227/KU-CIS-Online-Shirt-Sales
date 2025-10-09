import axios from "axios";

export const createGeneration = async (token, form) =>
  axios.post("http://localhost:5001/api/generation", form, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const listGeneration = async () =>
  axios.get("http://localhost:5001/api/generation");

export const removeGeneration = async (token, id) =>
  axios.delete(`http://localhost:5001/api/generation/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
