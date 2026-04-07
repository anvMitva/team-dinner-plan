const TEAM_NAME_POOL = [
  "Kubernetes Comets",
  "Tensor Titans",
  "Serverless Sparks",
  "Cloud Native Crew",
  "Binary Falcons",
  "TypeScript Tacticians",
  "Neural Navigators",
  "Docker Dynamos",
  "Git Guardians",
  "Quantum Committers",
  "Pixel Protocol",
  "API Mavericks",
  "Zero Day Zephyrs",
  "Open Source Orbit"
];

const playerInput = document.getElementById("playerInput");
const generateBtn = document.getElementById("generateBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const exportTxtBtn = document.getElementById("exportTxtBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const teamAEl = document.getElementById("teamA");
const teamBEl = document.getElementById("teamB");
const API_TEAMS_ENDPOINT = "/api/teams";

let lastPlayers = [];
let lastGenerated = null;

function loadPrefilledPlayersFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const players = params.get("players");
  if (!players || playerInput.value.trim()) {
    return;
  }

  playerInput.value = players;
  lastPlayers = parsePlayers(players);
  if (lastPlayers.length >= 2) {
    shuffleBtn.disabled = false;
    statusEl.textContent = "Players loaded from saved matchup. Click Update Teams.";
  }
}

function parsePlayers(inputText) {
  return [...new Set(
    inputText
      .split(/[\n,]+/)
      .map((name) => name.trim())
      .filter(Boolean)
  )];
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickTwoUniqueTeamNames() {
  const names = shuffle(TEAM_NAME_POOL);
  return [names[0], names[1]];
}

function splitIntoTwoTeams(players) {
  const shuffledPlayers = shuffle(players);
  const middle = Math.ceil(shuffledPlayers.length / 2);

  return {
    teamAPlayers: shuffledPlayers.slice(0, middle),
    teamBPlayers: shuffledPlayers.slice(middle)
  };
}

function pickLeaders(players) {
  if (!players.length) {
    return { captain: "", viceCaptain: "" };
  }

  if (players.length === 1) {
    return { captain: players[0], viceCaptain: "" };
  }

  const shuffled = shuffle(players);
  return {
    captain: shuffled[0],
    viceCaptain: shuffled[1]
  };
}

function renderTeam(cardEl, teamName, players, leaders) {
  const title = cardEl.querySelector(".team-title");
  const list = cardEl.querySelector(".team-list");

  title.textContent = teamName;
  list.innerHTML = "";

  players.forEach((player) => {
    const li = document.createElement("li");
    const nameText = document.createElement("span");
    nameText.textContent = player;
    li.appendChild(nameText);

    if (player === leaders.captain) {
      const badge = document.createElement("span");
      badge.className = "role-badge";
      badge.textContent = "Captain";
      li.appendChild(badge);
    } else if (player === leaders.viceCaptain) {
      const badge = document.createElement("span");
      badge.className = "role-badge role-badge-secondary";
      badge.textContent = "Vice Captain";
      li.appendChild(badge);
    }

    list.appendChild(li);
  });
}

async function persistToJsonDatabase(data) {
  try {
    const response = await fetch(API_TEAMS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}

function getExportFileName(extension) {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
  return `teams_${stamp}.${extension}`;
}

function getTeamsExportText(data) {
  const teamAText = data.teamAPlayers
    .map((name, index) => {
      const suffix = name === data.teamALeaders.captain
        ? " [Captain]"
        : name === data.teamALeaders.viceCaptain
          ? " [Vice Captain]"
          : "";
      return `${index + 1}. ${name}${suffix}`;
    })
    .join("\n");

  const teamBText = data.teamBPlayers
    .map((name, index) => {
      const suffix = name === data.teamBLeaders.captain
        ? " [Captain]"
        : name === data.teamBLeaders.viceCaptain
          ? " [Vice Captain]"
          : "";
      return `${index + 1}. ${name}${suffix}`;
    })
    .join("\n");

  return [
    "ANV satta teams",
    "",
    `${data.teamAName} (${data.teamAPlayers.length})`,
    `Captain: ${data.teamALeaders.captain || "N/A"}`,
    `Vice Captain: ${data.teamALeaders.viceCaptain || "N/A"}`,
    "",
    teamAText,
    "",
    `${data.teamBName} (${data.teamBPlayers.length})`,
    `Captain: ${data.teamBLeaders.captain || "N/A"}`,
    `Vice Captain: ${data.teamBLeaders.viceCaptain || "N/A"}`,
    "",
    teamBText
  ].join("\n");
}

function downloadTextFile(fileName, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCurrentTeamsAsTxt() {
  if (!lastGenerated) {
    statusEl.textContent = "Generate teams first, then export.";
    return;
  }

  downloadTextFile(getExportFileName("txt"), getTeamsExportText(lastGenerated));
  statusEl.textContent = "Exported team list as TXT.";
}

function exportCurrentTeamsAsPdf() {
  if (!lastGenerated) {
    statusEl.textContent = "Generate teams first, then export.";
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    statusEl.textContent = "PDF library did not load. Please refresh and try again.";
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const lines = getTeamsExportText(lastGenerated).split("\n");
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("ANV satta teams", 14, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  lines.slice(2).forEach((line) => {
    if (y > 280) {
      doc.addPage();
      y = 18;
    }
    doc.text(line || " ", 14, y);
    y += 7;
  });

  doc.save(getExportFileName("pdf"));
  statusEl.textContent = "Exported team list as PDF.";
}

function exportCurrentTeamsAsJson() {
  if (!lastGenerated) {
    statusEl.textContent = "Generate teams first, then export.";
    return;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    totalPlayers: lastGenerated.teamAPlayers.length + lastGenerated.teamBPlayers.length,
    teamA: {
      name: lastGenerated.teamAName,
      captain: lastGenerated.teamALeaders.captain || null,
      viceCaptain: lastGenerated.teamALeaders.viceCaptain || null,
      players: lastGenerated.teamAPlayers
    },
    teamB: {
      name: lastGenerated.teamBName,
      captain: lastGenerated.teamBLeaders.captain || null,
      viceCaptain: lastGenerated.teamBLeaders.viceCaptain || null,
      players: lastGenerated.teamBPlayers
    }
  };

  downloadTextFile(getExportFileName("json"), JSON.stringify(payload, null, 2));
  statusEl.textContent = "Exported team list as JSON.";
}

async function generateTeams(players) {
  const [teamAName, teamBName] = pickTwoUniqueTeamNames();
  const { teamAPlayers, teamBPlayers } = splitIntoTwoTeams(players);
  const teamALeaders = pickLeaders(teamAPlayers);
  const teamBLeaders = pickLeaders(teamBPlayers);

  renderTeam(teamAEl, teamAName, teamAPlayers, teamALeaders);
  renderTeam(teamBEl, teamBName, teamBPlayers, teamBLeaders);

  lastGenerated = {
    generatedAt: new Date().toISOString(),
    teamAName,
    teamAPlayers,
    teamALeaders,
    teamBName,
    teamBPlayers,
    teamBLeaders
  };

  const persisted = await persistToJsonDatabase(lastGenerated);

  resultsEl.hidden = false;
  statusEl.textContent = persisted
    ? `Generated ${players.length} players into ${teamAPlayers.length} vs ${teamBPlayers.length}. Saved in JSON database.`
    : `Generated ${players.length} players into ${teamAPlayers.length} vs ${teamBPlayers.length}.`;
  shuffleBtn.disabled = false;
  exportTxtBtn.disabled = false;
  exportPdfBtn.disabled = false;
  exportJsonBtn.disabled = false;
}

generateBtn.addEventListener("click", async () => {
  const players = parsePlayers(playerInput.value);

  if (players.length < 2) {
    resultsEl.hidden = true;
    shuffleBtn.disabled = true;
    statusEl.textContent = "Add at least 2 player names to generate teams.";
    return;
  }

  lastPlayers = players;
  await generateTeams(players);
});

shuffleBtn.addEventListener("click", async () => {
  if (lastPlayers.length < 2) {
    return;
  }

  await generateTeams(lastPlayers);
});

exportTxtBtn.addEventListener("click", exportCurrentTeamsAsTxt);
exportPdfBtn.addEventListener("click", exportCurrentTeamsAsPdf);
exportJsonBtn.addEventListener("click", exportCurrentTeamsAsJson);

clearBtn.addEventListener("click", () => {
  playerInput.value = "";
  lastPlayers = [];
  lastGenerated = null;
  shuffleBtn.disabled = true;
  exportTxtBtn.disabled = true;
  exportPdfBtn.disabled = true;
  exportJsonBtn.disabled = true;
  resultsEl.hidden = true;
  statusEl.textContent = "Cleared. Add names and generate again.";
});

loadPrefilledPlayersFromQuery();
