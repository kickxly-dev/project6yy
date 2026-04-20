// State
let session = null;
let previousSession = null;
let isHelper = window.HELPER_MODE || false;

// Play alert sound using Web Audio API (louder and more reliable)
function playAlertSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.value = 800;
    osc.type = "square";
    gain.gain.value = 1.0;
    
    osc.start();
    
    // Beep pattern: on for 200ms, off for 100ms, on for 200ms
    setTimeout(() => { gain.gain.value = 0; }, 200);
    setTimeout(() => { gain.gain.value = 1.0; }, 300);
    setTimeout(() => { gain.gain.value = 0; }, 500);
    setTimeout(() => { osc.stop(); ctx.close(); }, 600);
  } catch (e) {
    console.error("Sound failed:", e);
  }
}

// Request notification permission
async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

// Show notification
function showAlertNotification() {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  
  new Notification("JOE NEEDS HELP!", {
    body: "Tap to connect and help Joe",
    icon: "/icon.svg",
    requireInteraction: true,
    tag: "tech-support-alert"
  });
}

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
const testAlertBtn = document.getElementById("testAlertBtn");
const statusText = document.getElementById("statusText");
const helperChatBox = document.getElementById("helperChatBox");
const helperMessages = document.getElementById("helperMessages");
const helperChatForm = document.getElementById("helperChatForm");
const helperChatInput = document.getElementById("helperChatInput");
const helperEndBtn = document.getElementById("helperEndBtn");

// Video elements
const videoArea = document.getElementById("videoArea");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const cameraBtn = document.getElementById("cameraBtn");
const voiceBtn = document.getElementById("voiceBtn");

const helperVideoArea = document.getElementById("helperVideoArea");
const helperLocalVideo = document.getElementById("helperLocalVideo");
const helperRemoteVideo = document.getElementById("helperRemoteVideo");
const helperCameraBtn = document.getElementById("helperCameraBtn");
const helperVoiceBtn = document.getElementById("helperVoiceBtn");

// WebRTC state
let localStream = null;
let peerConnection = null;
let isVideoOn = false;
let isVoiceOn = false;

// WebRTC config (free STUN servers)
const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};

// Start camera
async function startCamera(isHelperView) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream = stream;
    
    if (isHelperView) {
      helperLocalVideo.srcObject = stream;
      helperVideoArea.classList.remove("hidden");
    } else {
      localVideo.srcObject = stream;
      videoArea.classList.remove("hidden");
    }
    
    isVideoOn = true;
    return true;
  } catch (e) {
    alert("Could not access camera. Please allow camera permission.");
    return false;
  }
}

// Stop camera
function stopCamera(isHelperView) {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  if (isHelperView) {
    helperLocalVideo.srcObject = null;
    helperVideoArea.classList.add("hidden");
  } else {
    localVideo.srcObject = null;
    videoArea.classList.add("hidden");
  }
  
  isVideoOn = false;
}

// Start voice call
async function startVoice(isHelperView) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStream = stream;
    
    if (isHelperView) {
      helperLocalVideo.srcObject = stream;
      helperLocalVideo.muted = true;
    } else {
      localVideo.srcObject = stream;
      localVideo.muted = true;
    }
    
    isVoiceOn = true;
    return true;
  } catch (e) {
    alert("Could not access microphone. Please allow microphone permission.");
    return false;
  }
}

// Stop voice
function stopVoice(isHelperView) {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  if (isHelperView) {
    helperLocalVideo.srcObject = null;
  } else {
    localVideo.srcObject = null;
  }
  
  isVoiceOn = false;
}

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
    const newSession = data.session;
    
    // Detect new help request (helper only)
    if (isHelper && !previousSession && newSession && newSession.status === "pending") {
      playAlertSound();
      showAlertNotification();
    }
    
    previousSession = session;
    session = newSession;
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

// Test alert button - also unlocks audio context
testAlertBtn.addEventListener("click", async () => {
  playAlertSound();
  await requestNotificationPermission();
  
  // Show test notification
  if (Notification.permission === "granted") {
    new Notification("TEST ALERT", {
      body: "This is a test. You will hear this sound when Joe needs help!",
      icon: "/icon.svg",
      tag: "test-alert"
    });
  }
  
  alert("If you heard a beep and saw a notification, alerts are working!");
});

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

switchBtn.addEventListener("click", async () => {
  isHelper = !isHelper;
  updateUI();
  
  // Request notification permission when switching to helper mode
  if (isHelper) {
    await requestNotificationPermission();
  }
});

// Camera button handlers
cameraBtn.addEventListener("click", async () => {
  if (isVideoOn) {
    stopCamera(false);
    cameraBtn.textContent = "CAMERA";
    cameraBtn.classList.remove("active");
  } else {
    const success = await startCamera(false);
    if (success) {
      cameraBtn.textContent = "STOP CAMERA";
      cameraBtn.classList.add("active");
    }
  }
});

voiceBtn.addEventListener("click", async () => {
  if (isVoiceOn) {
    stopVoice(false);
    voiceBtn.textContent = "VOICE CALL";
    voiceBtn.classList.remove("active");
  } else {
    const success = await startVoice(false);
    if (success) {
      voiceBtn.textContent = "END CALL";
      voiceBtn.classList.add("active");
    }
  }
});

helperCameraBtn.addEventListener("click", async () => {
  if (isVideoOn) {
    stopCamera(true);
    helperCameraBtn.textContent = "CAMERA";
    helperCameraBtn.classList.remove("active");
  } else {
    const success = await startCamera(true);
    if (success) {
      helperCameraBtn.textContent = "STOP CAMERA";
      helperCameraBtn.classList.add("active");
    }
  }
});

helperVoiceBtn.addEventListener("click", async () => {
  if (isVoiceOn) {
    stopVoice(true);
    helperVoiceBtn.textContent = "VOICE CALL";
    helperVoiceBtn.classList.remove("active");
  } else {
    const success = await startVoice(true);
    if (success) {
      helperVoiceBtn.textContent = "END CALL";
      helperVoiceBtn.classList.add("active");
    }
  }
});

// Start polling
setInterval(refresh, 2000);
refresh();
updateUI();

// Request notification permission on load (for helper mode)
if (isHelper) {
  requestNotificationPermission();
}
