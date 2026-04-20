// State
let session = null;
let isHelper = window.HELPER_MODE || false;

// DOM elements
const joeView = document.getElementById("joeView");
const ryderView = document.getElementById("ryderView");
const helpBtn = document.getElementById("helpBtn");
const waitingBox = document.getElementById("waitingBox");
const chatBox = document.getElementById("chatBox");
const messages = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const endBtn = document.getElementById("endBtn");
const switchBtn = document.getElementById("switchBtn");

const alertBox = document.getElementById("alertBox");
const connectBtn = document.getElementById("connectBtn");
const refreshBtn = document.getElementById("refreshBtn");
const statusText = document.getElementById("statusText");
const helperChatBox = document.getElementById("helperChatBox");
const helperMessages = document.getElementById("helperMessages");
const helperChatForm = document.getElementById("helperChatForm");
const helperChatInput = document.getElementById("helperChatInput");
const helperEndBtn = document.getElementById("helperEndBtn");

// API helper
async function api(endpoint, method = "GET", body = null) {
  const options = { method };
  if (body) {
    options.body = JSON.stringify(body);
    options.headers = { "Content-Type": "application/json" };
  }
  const res = await fetch(endpoint, options);
  return res.json();
}

// Render messages
function renderMessages(container, msgs) {
  container.innerHTML = "";
  if (!msgs || msgs.length === 0) {
    container.innerHTML = "<p>No messages yet</p>";
    return;
  }
  msgs.forEach(m => {
    const div = document.createElement("div");
    div.className = `message from-${m.from}`;
    div.innerHTML = `
      <div class="text">${escapeHtml(m.text)}</div>
      <div class="time">${formatTime(m.time)}</div>
    `;
    container.appendChild(div);
  });
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// Update UI based on session state
function updateUI() {
  if (isHelper) {
    joeView.classList.add("hidden");
    ryderView.classList.remove("hidden");
    
    if (!session) {
      alertBox.classList.add("hidden");
      helperChatBox.classList.add("hidden");
      statusText.textContent = "No help requests yet.";
    } else if (session.status === "pending") {
      alertBox.classList.remove("hidden");
      helperChatBox.classList.add("hidden");
      statusText.textContent = "Joe needs help!";
    } else if (session.status === "connected") {
      alertBox.classList.add("hidden");
      helperChatBox.classList.remove("hidden");
      renderMessages(helperMessages, session.messages);
    } else {
      alertBox.classList.add("hidden");
      helperChatBox.classList.add("hidden");
      statusText.textContent = "Session ended.";
    }
  } else {
    ryderView.classList.add("hidden");
    joeView.classList.remove("hidden");
    
    if (!session) {
      helpBtn.classList.remove("hidden");
      waitingBox.classList.add("hidden");
      chatBox.classList.add("hidden");
    } else if (session.status === "pending") {
      helpBtn.classList.add("hidden");
      waitingBox.classList.remove("hidden");
      chatBox.classList.add("hidden");
    } else if (session.status === "connected") {
      helpBtn.classList.add("hidden");
      waitingBox.classList.add("hidden");
      chatBox.classList.remove("hidden");
      renderMessages(messages, session.messages);
    } else {
      helpBtn.classList.remove("hidden");
      waitingBox.classList.add("hidden");
      chatBox.classList.add("hidden");
    }
  }
}

// Fetch session state
async function refresh() {
  try {
    const data = await api("/api/session");
    session = data.session;
    updateUI();
  } catch (e) {
    console.error("Refresh failed:", e);
  }
}

// Event handlers
helpBtn.addEventListener("click", async () => {
  await api("/api/help", "POST", { name: "joe" });
  await refresh();
});

connectBtn.addEventListener("click", async () => {
  await api("/api/connect", "POST");
  await refresh();
});

refreshBtn.addEventListener("click", refresh);

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = "";
  await api("/api/message", "POST", { from: "joe", text });
  await refresh();
});

helperChatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = helperChatInput.value.trim();
  if (!text) return;
  helperChatInput.value = "";
  await api("/api/message", "POST", { from: "ryder", text });
  await refresh();
});

endBtn.addEventListener("click", async () => {
  await api("/api/end", "POST");
  session = null;
  await refresh();
});

helperEndBtn.addEventListener("click", async () => {
  await api("/api/end", "POST");
  session = null;
  await refresh();
});

switchBtn.addEventListener("click", () => {
  isHelper = !isHelper;
  updateUI();
});

// Start polling
setInterval(refresh, 2000);
refresh();
updateUI();
