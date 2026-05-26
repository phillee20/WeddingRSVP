const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me";
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "responses.json");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
};

function normalizeGuestName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function displayGuestName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
}

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(
      DATA_FILE,
      JSON.stringify({ responses: {}, headcount: 0, declined: 0 }, null, 2),
    );
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  const store = JSON.parse(raw);

  return {
    responses: store.responses || {},
    headcount: typeof store.headcount === "number" ? store.headcount : 0,
    declined: typeof store.declined === "number" ? store.declined : 0,
  };
}

async function writeStore(store) {
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function verifyAdmin(req) {
  const header = req.headers.authorization || "";
  const [scheme, value] = header.split(" ");
  if (scheme !== "Bearer" || !value) return false;
  const expected = Buffer.from(ADMIN_PASSWORD);
  const actual = Buffer.from(value);
  return (
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual)
  );
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path
    .normalize(decodeURIComponent(route))
    .replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type":
        mimeTypes[path.extname(filePath)] || "application/octet-stream",
    });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

async function handleRsvp(req, res) {
  const body = JSON.parse((await readBody(req)) || "{}");
  const guestName = displayGuestName(body.guestName);
  const guestKey = normalizeGuestName(guestName);
  const songChoice = String(body.songChoice || "").trim();
  const attending = body.attending;

  if (!guestKey || guestName.length < 2) {
    sendJson(res, 400, { error: "Please enter your name." });
    return;
  }

  if (attending !== true && attending !== false) {
    sendJson(res, 400, { error: "Please choose Yes or No." });
    return;
  }

  const store = await readStore();
  if (store.responses[guestKey]) {
    sendJson(res, 409, {
      error: "A response has already been recorded for this guest.",
      response: {
        guestName: store.responses[guestKey].guestName,
        attending: store.responses[guestKey].attending,
      },
    });
    return;
  }

  store.responses[guestKey] = {
    guestName,
    songChoice,
    attending,
    submittedAt: new Date().toISOString(),
  };

  if (attending) {
    store.headcount = (store.headcount || 0) + 1;
  } else {
    store.declined = (store.declined || 0) + 1;
  }

  await writeStore(store);

  sendJson(res, 201, { ok: true, attending });
}

async function handleAdmin(req, res) {
  if (!verifyAdmin(req)) {
    sendJson(res, 401, { error: "Admin password required." });
    return;
  }

  const store = await readStore();
  const responses = Object.values(store.responses).sort((a, b) =>
    a.submittedAt.localeCompare(b.submittedAt),
  );
  const attending = responses.filter((response) => response.attending).length;
  const declined = responses.length - attending;

  sendJson(res, 200, {
    headcount: attending,
    declined,
    totalResponses: responses.length,
    responses,
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS" && req.url.startsWith("/api/")) {
      // Handle CORS preflight for API routes
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      });
      res.end();
      return;
    }

    if (req.method === "POST" && req.url === "/api/rsvp") {
      await handleRsvp(req, res);
      return;
    }

    if (req.method === "GET" && req.url === "/api/admin") {
      await handleAdmin(req, res);
      return;
    }

    if (req.method === "GET") {
      await serveStatic(req, res);
      return;
    }

    res.writeHead(405);
    res.end("Method not allowed");
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Something went wrong. Please try again." });
  }
});

ensureStore().then(() => {
  server.listen(PORT, () => {
    console.log(`Wedding RSVP site running at http://localhost:${PORT}`);
    console.log(`Admin page: http://localhost:${PORT}/admin.html`);
    if (ADMIN_PASSWORD === "change-me") {
      console.log("Set ADMIN_PASSWORD before sharing this site.");
    }
  });
});
