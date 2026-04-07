const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DB_FILE = path.join(ROOT_DIR, "teams-db.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function ensureDatabaseFile() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ records: [] }, null, 2), "utf8");
  }
}

function readDatabase() {
  ensureDatabaseFile();
  const raw = fs.readFileSync(DB_FILE, "utf8");
  const parsed = JSON.parse(raw || "{}");
  if (!Array.isArray(parsed.records)) {
    return { records: [] };
  }
  return parsed;
}

function writeDatabase(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(payload));
}

function serveFile(req, res) {
  let requestPath = req.url === "/" ? "/index.html" : req.url;
  requestPath = requestPath.split("?")[0];

  const safePath = path.normalize(requestPath).replace(/^([.][.][/\\])+/, "");
  const absolutePath = path.join(ROOT_DIR, safePath);

  if (!absolutePath.startsWith(ROOT_DIR)) {
    sendJson(res, 403, { error: "Forbidden path." });
    return;
  }

  fs.readFile(absolutePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: "File not found." });
      return;
    }

    const ext = path.extname(absolutePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream"
    });
    res.end(data);
  });
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload too large."));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (error) {
        reject(new Error("Invalid JSON payload."));
      }
    });

    req.on("error", () => {
      reject(new Error("Request error."));
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.url === "/api/teams" && req.method === "GET") {
    const db = readDatabase();
    sendJson(res, 200, db);
    return;
  }

  if (url.pathname.startsWith("/api/teams/") && req.method === "GET") {
    const id = Number(url.pathname.split("/").pop());
    const db = readDatabase();
    const record = db.records.find((item) => item.id === id);

    if (!record) {
      sendJson(res, 404, { error: "Record not found." });
      return;
    }

    sendJson(res, 200, record);
    return;
  }

  if (req.url === "/api/teams" && req.method === "POST") {
    try {
      const payload = await parseRequestBody(req);
      const db = readDatabase();
      const nextId = db.records.length ? Number(db.records[db.records.length - 1].id || 0) + 1 : 1;

      const record = {
        id: nextId,
        savedAt: new Date().toISOString(),
        data: payload
      };

      // Single active record mode: replace old data with the newest generated teams.
      db.records = [record];
      writeDatabase(db);

      sendJson(res, 201, { message: "Saved", record });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  serveFile(req, res);
});

server.listen(PORT, () => {
  ensureDatabaseFile();
  console.log(`Team app running at http://localhost:${PORT}`);
  console.log(`JSON database: ${DB_FILE}`);
});
