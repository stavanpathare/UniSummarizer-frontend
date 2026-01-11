/* ===========================
   CONFIG
=========================== */
const API_BASE = "https://unisummarizer-backend.onrender.com/api";   
// const API_BASE = "http://localhost:5000/api";

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
  const list = qs("#recent-list");
  const stats = qs("#stats-root");

  try {
    const res = await fetch(`${API_BASE}/files`);
    const files = await res.json();

    stats.innerHTML = `
      <div class="stat-card">
        <h3>${files.length}</h3>
        <p>Notes</p>
      </div>`;

    list.innerHTML = "";
    files.forEach(f => {
      const div = document.createElement("div");
      div.className = "recent-item";
      div.innerHTML = `
        <div>
          <h3>${f.title || "Untitled"}</h3>
          <p>${new Date(f.createdAt).toLocaleString()}</p>
        </div>
        <button class="view-btn">View</button>
      `;
      div.querySelector("button").onclick = () =>
        (window.location.href = `result.html?id=${f._id}`);
      list.appendChild(div);
    });
  } catch {
    showToast("Dashboard load failed", true);
  }
}

/* ===========================
   BOOT
=========================== */
document.addEventListener("DOMContentLoaded", () => {
  if (qs("#file-input")) initUploadPage();
  if (qs("#summary-output")) initResultPage();
  if (qs("#recent-list")) initDashboard();
});