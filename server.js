const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DB_FILE = path.join(ROOT_DIR, "teams-db.json");
const PICKS_DB_FILE = path.join(ROOT_DIR, "match-picks-db.json");
const IPL_MATCHES_FILE = path.join(ROOT_DIR, "ipl-matches.json");
const COMPLETED_MATCHES_FILE = path.join(ROOT_DIR, "backned", "completed_matches.json");

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

function ensurePicksDatabaseFile() {
  if (!fs.existsSync(PICKS_DB_FILE)) {
    fs.writeFileSync(PICKS_DB_FILE, JSON.stringify({ entries: {}, updatedAt: null }, null, 2), "utf8");
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

function readPicksDatabase() {
  ensurePicksDatabaseFile();
  const raw = fs.readFileSync(PICKS_DB_FILE, "utf8");
  const parsed = JSON.parse(raw || "{}");

  if (!parsed || typeof parsed !== "object") {
    return { entries: {}, updatedAt: null };
  }

  if (!parsed.entries || typeof parsed.entries !== "object" || Array.isArray(parsed.entries)) {
    parsed.entries = {};
  }

  return {
    entries: parsed.entries,
    updatedAt: parsed.updatedAt || null
  };
}

function writeDatabase(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

function writePicksDatabase(data) {
  fs.writeFileSync(PICKS_DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw || "{}");
}

function normalizeTeamName(value) {
  return String(value || "").trim().toLowerCase();
}

function buildMatchKey(dateValue, teamA, teamB) {
  const names = [normalizeTeamName(teamA), normalizeTeamName(teamB)].sort();
  return `${String(dateValue || "").trim()}|${names[0]}|${names[1]}`;
}

function syncWinnersFromCompletedMatches() {
  if (!fs.existsSync(IPL_MATCHES_FILE) || !fs.existsSync(COMPLETED_MATCHES_FILE)) {
    return { updated: 0, scanned: 0, matched: 0, skipped: 0 };
  }

  const scheduleJson = readJsonFile(IPL_MATCHES_FILE);
  const completedJson = readJsonFile(COMPLETED_MATCHES_FILE);
  const scheduleMatches = Array.isArray(scheduleJson.matches) ? scheduleJson.matches : [];
  const completedMatches = Array.isArray(completedJson.Matchsummary) ? completedJson.Matchsummary : [];

  const scheduleByKey = {};
  scheduleMatches.forEach((match) => {
    const key = buildMatchKey(match.date, match.teamA, match.teamB);
    scheduleByKey[key] = match;
  });

  const picksDb = readPicksDatabase();
  let updated = 0;
  let matched = 0;
  let skipped = 0;

  completedMatches.forEach((completed) => {
    const winningTeamId = String(completed.WinningTeamID || "").trim();
    if (!winningTeamId) {
      skipped += 1;
      return;
    }

    const homeTeamName = String(completed.HomeTeamName || "").trim();
    const awayTeamName = String(completed.AwayTeamName || "").trim();
    const key = buildMatchKey(completed.MatchDate, homeTeamName, awayTeamName);
    const scheduleMatch = scheduleByKey[key];

    if (!scheduleMatch) {
      skipped += 1;
      return;
    }

    matched += 1;
    const homeTeamId = String(completed.HomeTeamID || "").trim();
    const awayTeamId = String(completed.AwayTeamID || "").trim();

    let winnerName = "";
    if (winningTeamId === homeTeamId) {
      winnerName = homeTeamName;
    } else if (winningTeamId === awayTeamId) {
      winnerName = awayTeamName;
    }

    if (!winnerName) {
      skipped += 1;
      return;
    }

    const existing = picksDb.entries[scheduleMatch.id] || {
      matchId: scheduleMatch.id,
      teamAssignments: {},
      winner: "",
      updatedAt: null
    };

    if (existing.winner === winnerName) {
      return;
    }

    picksDb.entries[scheduleMatch.id] = {
      matchId: scheduleMatch.id,
      teamAssignments: existing.teamAssignments || {},
      winner: winnerName,
      updatedAt: new Date().toISOString()
    };
    updated += 1;
  });

  if (updated > 0) {
    picksDb.updatedAt = new Date().toISOString();
    writePicksDatabase(picksDb);
  }

  return {
    updated,
    scanned: completedMatches.length,
    matched,
    skipped
  };
}

function getDelayUntilNextRun(hour, minute) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

function scheduleDailyWinnerSync(hour, minute) {
  const scheduleNext = () => {
    const delay = getDelayUntilNextRun(hour, minute);
    const runAt = new Date(Date.now() + delay);
    console.log(`Winner sync scheduled at ${runAt.toISOString()}`);

    setTimeout(() => {
      try {
        const result = syncWinnersFromCompletedMatches();
        console.log(`Winner sync completed. Updated: ${result.updated}, Scanned: ${result.scanned}, Matched: ${result.matched}, Skipped: ${result.skipped}`);
      } catch (error) {
        console.error("Winner sync failed:", error.message);
      }

      scheduleNext();
    }, delay);
  };

  scheduleNext();
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

  if (req.url === "/api/match-picks" && req.method === "GET") {
    const picksDb = readPicksDatabase();
    sendJson(res, 200, picksDb);
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

  if (req.url === "/api/match-picks" && req.method === "POST") {
    try {
      const payload = await parseRequestBody(req);
      const matchId = String(payload.matchId || "").trim();

      if (!matchId) {
        sendJson(res, 400, { error: "matchId is required." });
        return;
      }

      const rawAssignments = payload.teamAssignments;
      const teamAssignments = rawAssignments && typeof rawAssignments === "object" ? rawAssignments : {};

      const picksDb = readPicksDatabase();
      const now = new Date().toISOString();
      const existingEntry = picksDb.entries[matchId] || { winner: "" };

      picksDb.entries[matchId] = {
        matchId,
        teamAssignments,
        winner: existingEntry.winner || "",
        updatedAt: now
      };

      picksDb.updatedAt = now;
      writePicksDatabase(picksDb);

      sendJson(res, 201, { message: "Saved", entry: picksDb.entries[matchId] });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (req.url === "/api/sync-match-results" && req.method === "POST") {
    try {
      const result = syncWinnersFromCompletedMatches();
      sendJson(res, 200, {
        message: "Match results synchronized.",
        result
      });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  serveFile(req, res);
});

server.listen(PORT, () => {
  ensureDatabaseFile();
  ensurePicksDatabaseFile();
  scheduleDailyWinnerSync(7, 0);
  console.log(`Team app running at http://localhost:${PORT}`);
  console.log(`JSON database: ${DB_FILE}`);
  console.log(`Match picks database: ${PICKS_DB_FILE}`);
});
