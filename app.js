// State
let session = null;
let previousSession = null;
let previousMessageCount = 0;
let isHelper = window.HELPER_MODE || false;

// Audio context for mobile support
let audioCtx = null;

// Get or create audio context (needed for mobile)
function getAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  
  // Resume if suspended (mobile requirement)
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  
  return audioCtx;
}

// Play gentle message notification sound
function playMessageSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    // Single gentle ding
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.value = 0.2;
    
    const now = ctx.currentTime;
    osc.start(now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.stop(now + 0.2);
  } catch (e) {}
}

// Play gentler alert sound (sine wave, lower frequency) + vibration
function playAlertSound() {
  // Vibrate phone if supported (works on mobile even if sound blocked)
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200, 100, 200]);
  }
  
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    // Gentler settings: sine wave at 523Hz (C5 note - pleasant chime)
    osc.frequency.value = 523;
    osc.type = "sine";
    gain.gain.value = 0.3; // Lower volume
    
    osc.start();
    
    // Pleasant chime pattern: 3 gentle beeps
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    // Second chime
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 659; // E5 note - harmonious
    osc2.type = "sine";
    gain2.gain.value = 0;
    osc2.start(now + 0.4);
    gain2.gain.setValueAtTime(0.3, now + 0.4);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
    osc2.stop(now + 0.8);
    
    osc.stop(now + 0.3);
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
const videoCallBtn = document.getElementById("videoCallBtn");
const screenShareBtn = document.getElementById("screenShareBtn");
const voiceBtn = document.getElementById("voiceBtn");

const helperVideoArea = document.getElementById("helperVideoArea");
const helperLocalVideo = document.getElementById("helperLocalVideo");
const helperRemoteVideo = document.getElementById("helperRemoteVideo");
const helperVideoCallBtn = document.getElementById("helperVideoCallBtn");
const helperScreenShareBtn = document.getElementById("helperScreenShareBtn");
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

// WebRTC Peer Connection functions
let remoteStream = null;

// Create peer connection
function createPeerConnection(isHelperView) {
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" }
    ]
  });
  
  // Handle remote stream
  pc.ontrack = (event) => {
    if (isHelperView) {
      helperRemoteVideo.srcObject = event.streams[0];
    } else {
      remoteVideo.srcObject = event.streams[0];
    }
  };
  
  // Handle ICE candidates
  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      await api("/api/webrtc/candidate", "POST", { candidate: event.candidate });
    }
  };
  
  return pc;
}

// Start video call with peer connection
async function startVideoCall(isHelperView) {
  try {
    // Get local stream
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    
    // Show local video
    if (isHelperView) {
      helperLocalVideo.srcObject = localStream;
      helperVideoArea.classList.remove("hidden");
    } else {
      localVideo.srcObject = localStream;
      videoArea.classList.remove("hidden");
    }
    
    // Create peer connection
    peerConnection = createPeerConnection(isHelperView);
    
    // Add local tracks to peer connection
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
    
    // Create and send offer (Joe initiates)
    if (!isHelperView) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      await api("/api/webrtc/offer", "POST", { offer: offer });
    } else {
      // Helper waits for offer and creates answer
      pollForOffer();
    }
    
    // Poll for remote answer or candidates
    if (!isHelperView) {
      pollForAnswer();
    }
    pollForCandidates();
    
    return true;
  } catch (e) {
    console.error("Video call failed:", e);
    alert("Could not start video call. Please allow camera/microphone permission.");
    return false;
  }
}

// Poll for offer (helper side)
async function pollForOffer() {
  if (!peerConnection) return;
  
  try {
    const data = await api("/api/webrtc/offer");
    if (data.offer && peerConnection.signalingState !== "have-remote-offer") {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      await api("/api/webrtc/answer", "POST", { answer: answer });
    }
  } catch (e) {
    console.error("Poll offer failed:", e);
  }
  
  setTimeout(pollForOffer, 1000);
}

// Poll for answer (Joe side)
async function pollForAnswer() {
  if (!peerConnection) return;
  
  try {
    const data = await api("/api/webrtc/answer");
    if (data.answer && peerConnection.signalingState === "have-local-offer") {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  } catch (e) {
    console.error("Poll answer failed:", e);
  }
  
  if (peerConnection && peerConnection.connectionState !== "connected") {
    setTimeout(pollForAnswer, 1000);
  }
}

// Poll for ICE candidates
async function pollForCandidates() {
  if (!peerConnection) return;
  
  try {
    const data = await api("/api/webrtc/candidates");
    for (const candidate of data.candidates) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        // Ignore if already added
      }
    }
  } catch (e) {
    console.error("Poll candidates failed:", e);
  }
  
  if (peerConnection && peerConnection.connectionState !== "closed") {
    setTimeout(pollForCandidates, 1000);
  }
}

// End video call
function endVideoCall(isHelperView) {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  if (isHelperView) {
    helperLocalVideo.srcObject = null;
    helperRemoteVideo.srcObject = null;
    helperVideoArea.classList.add("hidden");
  } else {
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    videoArea.classList.add("hidden");
  }
}

// Screen sharing - works with or without active video call
async function startScreenShare(isHelperView) {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    
    // Show local screen preview
    if (isHelperView) {
      helperLocalVideo.srcObject = stream;
      helperVideoArea.classList.remove("hidden");
    } else {
      localVideo.srcObject = stream;
      videoArea.classList.remove("hidden");
    }
    
    // If video call is active, replace the video track
    if (peerConnection) {
      const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === "video");
      if (sender) {
        await sender.replaceTrack(stream.getVideoTracks()[0]);
      }
    } else {
      // No video call active - start one with screen share
      await startVideoCallWithStream(isHelperView, stream);
    }
    
    // Handle when user stops sharing
    stream.getVideoTracks()[0].onended = async () => {
      if (isHelperView) {
        helperLocalVideo.srcObject = localStream;
        // If we have local stream, restore it to peer connection
        if (peerConnection && localStream) {
          const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === "video");
          if (sender) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) await sender.replaceTrack(videoTrack);
          }
        }
      } else {
        localVideo.srcObject = localStream;
        if (peerConnection && localStream) {
          const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === "video");
          if (sender) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) await sender.replaceTrack(videoTrack);
          }
        }
      }
    };
    
    return true;
  } catch (e) {
    alert("Could not share screen. Please allow permission.");
    return false;
  }
}

// Start video call with specific stream (for screen sharing)
async function startVideoCallWithStream(isHelperView, stream) {
  try {
    localStream = stream;
    
    // Show local video
    if (isHelperView) {
      helperLocalVideo.srcObject = stream;
      helperVideoArea.classList.remove("hidden");
    } else {
      localVideo.srcObject = stream;
      videoArea.classList.remove("hidden");
    }
    
    // Create peer connection
    peerConnection = createPeerConnection(isHelperView);
    
    // Add local tracks to peer connection
    stream.getTracks().forEach(track => {
      peerConnection.addTrack(track, stream);
    });
    
    // Create and send offer
    if (!isHelperView) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      await api("/api/webrtc/offer", "POST", { offer: offer });
    } else {
      pollForOffer();
    }
    
    // Poll for connection
    if (!isHelperView) {
      pollForAnswer();
    }
    pollForCandidates();
    
    return true;
  } catch (e) {
    console.error("Video call failed:", e);
    return false;
  }
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
      getAudioContext(); // Initialize audio on mobile
      playAlertSound();
      showAlertNotification();
    }
    
    // Detect new messages and play sound
    const currentMsgCount = session?.messages?.length || 0;
    const newMsgCount = newSession?.messages?.length || 0;
    if (newMsgCount > currentMsgCount && newMsgCount > previousMessageCount) {
      playMessageSound();
    }
    previousMessageCount = newMsgCount;
    
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
  // Initialize audio context on user gesture (required for mobile)
  getAudioContext();
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

// Video call button handlers
videoCallBtn.addEventListener("click", async () => {
  if (peerConnection) {
    endVideoCall(false);
    videoCallBtn.textContent = "VIDEO CALL";
    videoCallBtn.classList.remove("active");
  } else {
    const success = await startVideoCall(false);
    if (success) {
      videoCallBtn.textContent = "END VIDEO";
      videoCallBtn.classList.add("active");
    }
  }
});

helperVideoCallBtn.addEventListener("click", async () => {
  if (peerConnection) {
    endVideoCall(true);
    helperVideoCallBtn.textContent = "VIDEO CALL";
    helperVideoCallBtn.classList.remove("active");
  } else {
    const success = await startVideoCall(true);
    if (success) {
      helperVideoCallBtn.textContent = "END VIDEO";
      helperVideoCallBtn.classList.add("active");
    }
  }
});

// Screen share button handlers
screenShareBtn.addEventListener("click", async () => {
  const success = await startScreenShare(false);
  if (success) {
    screenShareBtn.textContent = "STOP SHARING";
    screenShareBtn.classList.add("active");
    setTimeout(() => {
      screenShareBtn.textContent = "SHARE SCREEN";
      screenShareBtn.classList.remove("active");
    }, 5000);
  }
});

helperScreenShareBtn.addEventListener("click", async () => {
  const success = await startScreenShare(true);
  if (success) {
    helperScreenShareBtn.textContent = "STOP SHARING";
    helperScreenShareBtn.classList.add("active");
    setTimeout(() => {
      helperScreenShareBtn.textContent = "SHARE SCREEN";
      helperScreenShareBtn.classList.remove("active");
    }, 5000);
  }
});

// Voice call button handlers (local only)
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
