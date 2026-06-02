/* ===========================
   CONFIG
=========================== */
const API_BASE = "https://unisummarizer-backend.onrender.com/api";   
// const API_BASE = "http://localhost:5000/api";
// const API_BASE = "https://unisummarizer-backend-rodo.onrender.com/api";

/* ===========================
   HELPERS
=========================== */
const qs = (s) => document.querySelector(s);

function showToast(msg, error = false) {
  const t = document.createElement("div");
  t.className = `us-toast ${error ? "us-toast-error" : ""}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/* ===========================
   AUTH HELPERS
   - keep minimal helpers for token checks and logout
============================ */
function getAuthToken() {
  return localStorage.getItem("authToken");
}

function requireAuth(redirectTo = "login.html") {
  if (!getAuthToken()) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

function logout() {
  localStorage.removeItem("authToken");
  window.location.href = "login.html";
}

function showLoader(show = true) {
  let l = qs(".us-loader-wrap");
  if (show && !l) {
    l = document.createElement("div");
    l.className = "us-loader-wrap";
    l.innerHTML = `
      <div class="us-loader-box">
        <div class="spinner"></div>
        <p>Processing...</p>
      </div>`;
    document.body.appendChild(l);
  }
  if (!show && l) l.remove();
}

/* ===========================
   UPLOAD PAGE
=========================== */
async function initUploadPage() {
  const fileInput = qs("#file-input");
  const processBtn = qs("#process-btn");
  const pasteBtn = qs("#paste-summarize-btn");
  const pasteInput = qs("#paste-input");

  // 📄 PDF UPLOAD
  processBtn?.addEventListener("click", async () => {
    if (!fileInput.files[0]) {
      showToast("Select a PDF first", true);
      return;
    }

    const fd = new FormData();
    fd.append("file", fileInput.files[0]); // ✅ correct key

    showLoader(true);
    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      window.location.href = `result.html?id=${data.id}`;
    } catch (e) {
      showToast(e.message, true);
    }
    showLoader(false);
  });

  // ✏️ TEXT SUBMIT
  pasteBtn?.addEventListener("click", async () => {
    const text = pasteInput.value.trim();
    if (!text) {
      showToast("Paste some text", true);
      return;
    }

    showLoader(true);
    try {
      const res = await fetch(`${API_BASE}/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI failed");

      window.location.href = `result.html?id=${data.id}`;
    } catch (e) {
      showToast(e.message, true);
    }
    showLoader(false);
  });
}

/* ===========================
   RESULT PAGE
=========================== */
async function initResultPage() {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return;

  showLoader(true);
  try {
    const res = await fetch(`${API_BASE}/result/${id}`);
    const data = await res.json();

    if (!res.ok) throw new Error("Result not found");

    // ✅ STORE DATA GLOBALLY
    window.resultData = data;
    console.log("🔥 RESULT DATA:", data);

    /* ---------- SUMMARY ---------- */
    qs("#summary-output").textContent = data.summary || "No summary";

    /* ---------- KEY POINTS ---------- */
    const kp = qs("#key-points");
    kp.innerHTML = "";
    (data.keyPoints || []).forEach(p => {
      const li = document.createElement("li");
      li.textContent = p;
      kp.appendChild(li);
    });

    /* ---------- FLASHCARDS (FLIP ANIMATION) ---------- */
const flashBox = document.getElementById("flashcards");
flashBox.innerHTML = "";

(data.flashcards || []).forEach(f => {
  const card = document.createElement("div");
  card.className = "flashcard";
  card.tabIndex = 0; // accessibility

  card.innerHTML = `
    <div class="flashcard-inner">
      <div class="flashcard-front">${f.question}</div>
      <div class="flashcard-back">${f.answer}</div>
    </div>
  `;

  // click / tap
  card.addEventListener("click", () => {
    card.classList.toggle("is-flipped");
  });

  // keyboard support (Enter / Space)
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      card.classList.toggle("is-flipped");
    }
  });

  flashBox.appendChild(card);
});

    /* ---------- MCQs ---------- */
const mcqBox = document.getElementById("mcq-list");
mcqBox.innerHTML = "";

(data.mcq || []).forEach((q) => {
  const block = document.createElement("div");
  block.className = "mcq";

  const title = document.createElement("h4");
  title.textContent = q.question;
  block.appendChild(title);

  let locked = false;
  const optionButtons = [];

  // 🔧 FIX: determine correct index safely
  let correctIndex = q.answerIndex;

  // fallback if AI sends "answer" instead of index
  if (correctIndex === undefined && q.answer !== undefined) {
    correctIndex = q.options.indexOf(q.answer);
  }

  console.log("Resolved correct index:", correctIndex);

  q.options.forEach((opt, idx) => {
    const btn = document.createElement("div");
    btn.className = "mcq-option";
    btn.textContent = opt;

    btn.onclick = () => {
      if (locked) return;
      locked = true;

      // ✅ highlight correct
      if (correctIndex !== -1 && correctIndex !== undefined) {
        optionButtons[correctIndex].style.background = "#86efac";
      }

      // ❌ highlight wrong clicked
      if (idx !== correctIndex) {
        btn.style.background = "#fca5a5";
      }
    };

    optionButtons.push(btn);
    block.appendChild(btn);
  });

  mcqBox.appendChild(block);
});
  } catch (e) {
    showToast(e.message, true);
  }
  showLoader(false);
}
/* ===========================
   DASHBOARD
=========================== */
async function initDashboard() {
  // Require auth for dashboard
  if (!requireAuth()) return;

  const list = qs("#recent-list");
  const stats = qs("#stats-root");

  try {
    showLoader(true);
    const s = await window.api.getStats();
    const files = await window.api.getSummaries();

    stats.innerHTML = `
      <div class="stat-card">
        <h3>${s.totalSummaries || 0}</h3>
        <p>Total Summaries</p>
      </div>
      <div class="stat-card">
        <h3>${s.totalFlashcards || 0}</h3>
        <p>Total Flashcards</p>
      </div>
      <div class="stat-card">
        <h3>${s.totalMcqs || 0}</h3>
        <p>Total MCQs</p>
      </div>`;

    list.innerHTML = "";
    (files || []).slice().reverse().forEach(f => {
      const div = document.createElement("div");
      div.className = "recent-item";
      div.innerHTML = `
        <div>
          <strong>${f.title || "Untitled"}</strong>
          <p class="muted">${new Date(f.createdAt).toLocaleString()}</p>
        </div>

        <div class="recent-actions">
          <button class="view-btn">View</button>
          <button class="delete-btn">Delete</button>
        </div>
      `;

      div.querySelector(".view-btn").addEventListener("click", async () => {
        try {
          showLoader(true);
          const detail = await window.api.getSummary(f._id);
          openSummaryModal(detail);
        } catch (e) {
          showToast(e.message || 'Failed to load summary', true);
        } finally { showLoader(false); }
      });

      div.querySelector(".delete-btn").addEventListener("click", async () => {
        const ok = confirm("Are you sure you want to delete this summary?");
        if (!ok) return;
        try {
          showLoader(true);
          await window.api.deleteSummary(f._id);
          showToast("Deleted successfully");
          // remove from DOM
          div.remove();
          // refresh stats
          const ns = await window.api.getStats();
          stats.querySelectorAll(".stat-card").forEach((c, i) => {
            // re-render basic values
          });
          // simple approach: re-run initDashboard to refresh
          await initDashboard();
        } catch (e) {
          showToast(e.message || "Delete failed", true);
        }
        showLoader(false);
      });

      list.appendChild(div);
    });
  } catch (e) {
    showToast(e.message || "Dashboard load failed", true);
  }
  showLoader(false);
}

/* ==============================
   SUMMARY MODAL (used by dashboard)
============================== */
function openSummaryModal(data) {
  const modal = document.createElement("div");
  modal.className = "summary-modal";

  modal.innerHTML = `
    <div class="summary-modal-content">
      <h2>${data.title || 'Summary'}</h2>
      <p class="muted">${new Date(data.createdAt).toLocaleString()}</p>

      <h3>Summary</h3>
      <p>${data.summary || ''}</p>

      <h3>Key Points</h3>
      <ul>
        ${(data.keyPoints || []).map(p => `<li>${p}</li>`).join('')}
      </ul>

      <h3>Flashcards</h3>
      <div class="modal-flashcards">
        ${(data.flashcards || []).map(card => `
          <div class="modal-flashcard"><strong>Q:</strong> ${card.question}<br><strong>A:</strong> ${card.answer}</div>
        `).join('')}
      </div>

      <h3>MCQs</h3>
      <div class="modal-mcqs">
        ${(data.mcqs || []).map(mc => `
          <div class="mcq"><h4>${mc.question}</h4>${(mc.options||[]).map(opt=>`<div class="mcq-option">${opt}</div>`).join('')}</div>
        `).join('')}
      </div>

      <div style="margin-top:12px;text-align:right;"><button class="btn close-btn">Close</button></div>
    </div>
  `;

  modal.querySelector('.close-btn').addEventListener('click', ()=> modal.remove());
  modal.addEventListener('click', (e)=> { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}


/* ===========================
   BOOT
=========================== */
document.addEventListener("DOMContentLoaded", () => {
  if (qs("#file-input")) initUploadPage();
  if (qs("#summary-output")) initResultPage();
  if (qs("#recent-list")) initDashboard();
  const logoutLink = qs('.logout');
  if (logoutLink) logoutLink.addEventListener('click', (e)=>{ e.preventDefault(); logout(); });
});