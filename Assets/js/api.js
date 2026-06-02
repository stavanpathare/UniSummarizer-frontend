/* Centralized API utility for UniSummarizer
   - Attaches JWT from localStorage key `authToken`
   - Exposes promise-based functions for frontend features
*/
(function (window) {
  const API_BASE = window.API_BASE || "https://unisummarizer-backend.onrender.com/api";

  function getAuthToken() {
    return localStorage.getItem("authToken") || null;
  }

  async function request(path, opts = {}) {
    const headers = opts.headers || {};
    const token = getAuthToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers
    });

    const contentType = res.headers.get("content-type") || "";
    let body = null;
    if (contentType.includes("application/json")) body = await res.json();
    else body = await res.text();

    if (!res.ok) {
      const err = (body && body.error) || body || res.statusText || "API error";
      const e = new Error(err);
      e.status = res.status;
      throw e;
    }

    return body;
  }

  // AUTH
  async function registerUser({ name, email, password }) {
    return request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });
  }

  async function loginUser({ email, password }) {
    return request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
  }

  // SUMMARIES / DASHBOARD
  async function saveSummary(payload) {
    return request("/save-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  async function getSummaries() {
    return request("/summaries", { method: "GET" });
  }

  async function getSummary(id) {
    return request(`/summaries/${id}`, { method: "GET" });
  }

  async function deleteSummary(id) {
    return request(`/summaries/${id}`, { method: "DELETE" });
  }

  async function getStats() {
    return request(`/dashboard/stats`, { method: "GET" });
  }

  // FLASHCARDS / MCQS
  async function getFlashcards() {
    return request(`/flashcards`, { method: "GET" });
  }

  async function getMcqs() {
    return request(`/mcqs`, { method: "GET" });
  }

  window.api = {
    registerUser,
    loginUser,
    saveSummary,
    getSummaries,
    getSummary,
    deleteSummary,
    getStats,
    getFlashcards,
    getMcqs,
    _getAuthToken: getAuthToken
  };
})(window);
