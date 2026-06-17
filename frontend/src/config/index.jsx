import axios from "axios";

// Point this at your backend. For local testing use "http://localhost:5050".
export const BASE_URL = "https://scanme-wkq3.onrender.com";

export const clientServer = axios.create({
  baseURL: BASE_URL,
});

// Layer 4: attach the JWT to every request from either axios instance.
function attachAuth(config) {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}
clientServer.interceptors.request.use(attachAuth);
axios.interceptors.request.use(attachAuth);

// Layer 3: a stable per-device id, created once and persisted in localStorage.
export function getDeviceId() {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id =
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem("deviceId", id);
  }
  return id;
}
