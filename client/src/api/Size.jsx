import axios from "axios";

export const createSize = async (token, form) =>
  axios.post("http://localhost:5001/api/size", form, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const listSize = async () =>
  axios.get("http://localhost:5001/api/size");

export const removeSize = async (token, id) =>
  axios.delete(`http://localhost:5001/api/size/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
