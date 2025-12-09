/**
 * app.js
 * UniSummarizer - Frontend logic (vanilla JS)
 */

/* ===========================
   Configuration
   =========================== */
const API_ENDPOINT = "/api/process";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "text/plain",
  "audio/mpeg",
  "audio/wav",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

const STORAGE_KEY = "unisummarizer_saved_notes";

/* ===========================
   Small DOM utils
   =========================== */
const qs  = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

function el(tag, attrs = {}, children = []) {
  const d = document.createElement(tag);
  for (const k in attrs) {
    if (k === "class") d.className = attrs[k];
    else if (k === "text") d.textContent = attrs[k];
    else if (k === "html") d.innerHTML = attrs[k];
    else d.setAttribute(k, attrs[k]);
  }
  children.forEach(c => d.appendChild(c));
  return d;
}

/* ===========================
   Toast
   =========================== */
function showToast(msg, type = "info") {
  const id = `toast-${Date.now()}`;
  const t = el("div", { class: `us-toast us-toast-${type}`, id, text: msg });

  Object.assign(t.style, {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    background: type === "error" ? "#ff6b6b" : "#111",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: "8px",
    boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
    zIndex: 9999,
    opacity: 0,
    transition: "opacity .18s"
  });

  document.body.appendChild(t);
  requestAnimationFrame(() => t.style.opacity = 1);

  setTimeout(() => {
    t.style.opacity = 0;
    setTimeout(() => t.remove(), 220);
  }, 3000);
}

/* ===========================
   Network helpers
   =========================== */
async function postFormData(url, formData, timeout = 600000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { method: "POST", body: formData, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Server ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function postJson(url, data, timeout = 180000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(data)
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Server ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/* ===========================
   Loader
   =========================== */
function _createLoader() {
  const wrap = el("div", { class: "us-loader-wrap" });
  wrap.innerHTML = `
    <div class="us-loader-box">
      <div class="spinner"></div>
      <div style="margin-top:10px;color:#111;font-weight:600">Processing...</div>
    </div>
  `;
  Object.assign(wrap.style, {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.6)",
    zIndex: 9998
  });
  return wrap;
}

function attachLoader() {
  if (!qs(".us-loader-wrap")) {
    document.body.appendChild(_createLoader());
  }
}

function detachLoader() {
  qs(".us-loader-wrap")?.remove();
}

/* ===========================
   LocalStorage helpers
   =========================== */
const getSavedNotes = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

function saveNoteToStorage(note) {
  const arr = getSavedNotes();
  arr.unshift(note);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function deleteSavedNote(index) {
  const arr = getSavedNotes();
  arr.splice(index, 1);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

/* ===========================
   Mock fallback
   =========================== */
function getMockResult() {
  return {
    summary: "Mock summary for UI testing.",
    keyPoints: [
      "Key concept A",
      "Key concept B",
      "Key concept C"
    ],
    flashcards: [
      { q: "What is A?", a: "A is something" }
    ],
    mcq: [
      {
        q: "Which is correct?",
        options: ["A", "B", "C"],
        answerIndex: 0
      }
    ],
    meta: { source: "mock" }
  };
}

/* ===========================
   Renderers
   =========================== */
function renderSummary(summaryText) {
  qs("#summary-output")?.(textContent = summaryText || "");
}

function renderKeyPoints(points = []) {
  const ul = qs("#key-points");
  if (!ul) return;
  ul.innerHTML = "";
  points.forEach(p => ul.appendChild(el("li", { text: p })));
}

/* flashcards */
function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, m =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])
  );
}

function renderFlashcards(cards = []) {
  const wrap = qs("#flashcards");
  if (!wrap) return;
  wrap.innerHTML = "";

  cards.forEach(c => {
    const card = el("div", { class: "flashcard" });
    const front = el("div", { class: "flash-front", html: `<b>Q:</b> ${escapeHtml(c.q)}` });
    const back  = el("div", { class: "flash-back",  html: `<b>A:</b> ${escapeHtml(c.a)}` });

    back.style.display = "none";
    card.append(front, back);

    card.onclick = () => {
      const showBack = back.style.display === "none";
      front.style.display = showBack ? "none" : "block";
      back.style.display  = showBack ? "block" : "none";
    };

    wrap.appendChild(card);
  });
}

/* MCQ */
function renderMCQs(mcqs = []) {
  const root = qs("#mcq-list");
  if (!root) return;
  root.innerHTML = "";

  mcqs.forEach((m, idx) => {
    const wrap = el("div", { class: "mcq" });
    wrap.appendChild(el("h4", { text: m.q }));

    m.options.forEach((opt, i) => {
      const label = el("label");
      const input = el("input", { type: "radio", name: `mcq-${idx}` });
      label.append(input, document.createTextNode(" " + opt));

      input.onchange = () => {
        const labs = wrap.querySelectorAll("label");
        labs.forEach(lb => lb.style.background = "");
        label.style.background =
          i === m.answerIndex
            ? "linear-gradient(90deg,#e6ffee,#d2fdd8)"
            : "linear-gradient(90deg,#ffe6e6,#ffd2d2)";
      };

      wrap.appendChild(label);
    });
    root.appendChild(wrap);
  });
}

/* ===========================
   Utilities
   =========================== */
function downloadTextAsFile(text, filename) {
  const blob = new Blob([text], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function debounce(fn, wait = 250) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), wait);
  };
}

/* ===========================
   Main result builder
   =========================== */
function makeNoteFromResult(result, source = "upload") {
  return {
    id: Date.now().toString(36),
    title: result.meta?.title || source,
    summary: result.summary || "",
    keyPoints: result.keyPoints || [],
    flashcards: result.flashcards || [],
    mcq: result.mcq || [],
    createdAt: Date.now(),
    meta: result.meta || {}
  };
}

/* ===========================
   Render all result
   =========================== */
function renderAllResult(res) {
  renderSummary(res.summary);
  renderKeyPoints(res.keyPoints);
  renderFlashcards(res.flashcards);
  renderMCQs(res.mcq);
}

/* ===========================
   Page Detect
   =========================== */
document.addEventListener("DOMContentLoaded", () => {

  /* upload.html */
  if (qs("#drag-area") || qs("#paste-input")) {
    initUploadPage();
  }

  /* result.html */
  if (qs("#summary-output")) {
    const notes = getSavedNotes();
    renderAllResult(notes[0] || getMockResult());
  }

  /* dashboard.html */
  if (qs(".recent-list")) {
    renderDashboardList();
  }
});
