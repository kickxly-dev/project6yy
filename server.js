import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 8080;

// In-memory session storage
let session = null;
let webrtcData = { offer: null, answer: null, candidates: [] };

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

// Helper to parse JSON body
const parseBody = (req) => new Promise((resolve, reject) => {
  let body = "";
  req.on("data", chunk => body += chunk);
  req.on("end", () => {
    try { resolve(JSON.parse(body || "{}")); }
    catch (e) { reject(e); }
  });
  req.on("error", reject);
});

// Helper to send JSON response
const json = (res, status, data) => {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
};

// Helper to serve static files
const serveFile = (res, filePath) => {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(fullPath).pipe(res);
};

// Create server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // API Routes
  if (pathname === "/api/session" && req.method === "GET") {
    return json(res, 200, { session });
  }

  if (pathname === "/api/help" && req.method === "POST") {
    const body = await parseBody(req);
    session = {
      id: `session-${Date.now()}`,
      requester: body.name || "joe",
      status: "pending",
      messages: [{
        id: 1,
        from: "system",
        text: `${body.name || "joe"} needs help`,
        time: new Date().toISOString()
      }]
    };
    return json(res, 200, { session });
  }

  if (pathname === "/api/connect" && req.method === "POST") {
    if (!session) {
      return json(res, 404, { error: "No session" });
    }
    session.status = "connected";
    session.helper = "Ryder";
    session.messages.push({
      id: session.messages.length + 1,
      from: "system",
      text: "Ryder connected",
      time: new Date().toISOString()
    });
    return json(res, 200, { session });
  }

  if (pathname === "/api/message" && req.method === "POST") {
    const body = await parseBody(req);
    if (!session) {
      return json(res, 404, { error: "No session" });
    }
    session.messages.push({
      id: session.messages.length + 1,
      from: body.from,
      text: body.text,
      time: new Date().toISOString()
    });
    return json(res, 200, { session });
  }

  if (pathname === "/api/end" && req.method === "POST") {
    if (session) {
      session.status = "ended";
      session.messages.push({
        id: session.messages.length + 1,
        from: "system",
        text: "Session ended",
        time: new Date().toISOString()
      });
    }
    // Clear WebRTC data
    webrtcData = { offer: null, answer: null, candidates: [] };
    return json(res, 200, { session });
  }

  // WebRTC signaling endpoints
  if (pathname === "/api/webrtc/offer" && req.method === "POST") {
    const body = await parseBody(req);
    webrtcData.offer = body.offer;
    webrtcData.candidates = [];
    return json(res, 200, { success: true });
  }

  if (pathname === "/api/webrtc/offer" && req.method === "GET") {
    return json(res, 200, { offer: webrtcData.offer });
  }

  if (pathname === "/api/webrtc/answer" && req.method === "POST") {
    const body = await parseBody(req);
    webrtcData.answer = body.answer;
    return json(res, 200, { success: true });
  }

  if (pathname === "/api/webrtc/answer" && req.method === "GET") {
    return json(res, 200, { answer: webrtcData.answer });
  }

  if (pathname === "/api/webrtc/candidate" && req.method === "POST") {
    const body = await parseBody(req);
    webrtcData.candidates.push(body.candidate);
    return json(res, 200, { success: true });
  }

  if (pathname === "/api/webrtc/candidates" && req.method === "GET") {
    return json(res, 200, { candidates: webrtcData.candidates });
  }

  // /ryder route - helper view
  if (pathname === "/ryder") {
    res.writeHead(200, { "Content-Type": "text/html" });
    let html = fs.readFileSync(path.join(__dirname, "index.html"), "utf-8");
    html = html.replace("</head>", `<script>window.HELPER_MODE = true;</script></head>`);
    return res.end(html);
  }

  // Static files
  if (pathname === "/" || pathname === "/index.html") {
    return serveFile(res, "index.html");
  }
  if (pathname === "/styles.css") {
    return serveFile(res, "styles.css");
  }
  if (pathname === "/app.js") {
    return serveFile(res, "app.js");
  }
  if (pathname === "/icon.svg") {
    return serveFile(res, "icon.svg");
  }

  // 404
  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Joe's view: http://localhost:${PORT}/`);
  console.log(`Ryder's view: http://localhost:${PORT}/ryder`);
});
