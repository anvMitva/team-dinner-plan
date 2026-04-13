const detailsHeadingEl = document.getElementById("detailsHeading");
const detailsSubEl = document.getElementById("detailsSub");
const detailsStatusEl = document.getElementById("detailsStatus");
const detailsResultsEl = document.getElementById("detailsResults");
const scoreTeamANameEl = document.getElementById("scoreTeamAName");
const scoreTeamADescEl = document.getElementById("scoreTeamADesc");
const scoreTeamAPointsEl = document.getElementById("scoreTeamAPoints");
const scoreTeamBNameEl = document.getElementById("scoreTeamBName");
const scoreTeamBDescEl = document.getElementById("scoreTeamBDesc");
const scoreTeamBPointsEl = document.getElementById("scoreTeamBPoints");
const detailTeamAEl = document.getElementById("detailTeamA");
const detailTeamBEl = document.getElementById("detailTeamB");
const updateTeamLinkEl = document.getElementById("updateTeamLink");

const API_PICKS_ENDPOINT = "/api/match-picks";
const TEAM_LOGOS_ENDPOINT = "/team-logos.json";

let teamLogos = {};

function getPointsSummary(matches, entries, teamAName, teamBName) {
  const summary = {
    [teamAName]: 0,
    [teamBName]: 0
  };

  matches.forEach((match) => {
    const entry = entries[match.id];
    if (!entry || !entry.winner) {
      return;
    }

    if ((entry.teamAssignments || {})[teamAName] === entry.winner) {
      summary[teamAName] += 1;
    }

    if ((entry.teamAssignments || {})[teamBName] === entry.winner) {
      summary[teamBName] += 1;
    }
  });

  return summary;
}

function getTeamLogo(teamName) {
  return teamLogos[teamName] || { shortCode: teamName, logoUrl: "" };
}

function createTeamBadge(teamName) {
  const wrapper = document.createElement("div");
  const logo = document.createElement("img");
  const text = document.createElement("span");

  wrapper.className = "score-board-team";
  logo.className = "score-board-logo";
  logo.alt = `${teamName} logo`;
  logo.loading = "lazy";

  const info = getTeamLogo(teamName);
  logo.src = info.logoUrl || "";
  logo.hidden = !info.logoUrl;

  text.className = "score-board-team-name";
  text.textContent = teamName;

  wrapper.appendChild(logo);
  wrapper.appendChild(text);
  return wrapper;
}

function normalizeId(value) {
  const parsed = Number(String(value).trim());
  return Number.isNaN(parsed) ? null : parsed;
}

function renderTeam(cardEl, teamName, players, leaders) {
  const title = cardEl.querySelector(".team-title");
  const list = cardEl.querySelector(".team-list");

  title.textContent = teamName;
  list.innerHTML = "";

  (players || []).forEach((player) => {
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

async function loadDetails() {
  const params = new URLSearchParams(window.location.search);
  const rawId = params.get("id");
  const id = normalizeId(rawId);

  if (!id) {
    detailsStatusEl.textContent = "Missing record id in URL.";
    detailsSubEl.textContent = "Open this page from landing page double click.";
    return;
  }

  try {
    let record = null;

    const singleResponse = await fetch(`/api/teams/${encodeURIComponent(id)}`);
    if (singleResponse.ok) {
      record = await singleResponse.json();
    } else {
      // Fallback for older server instances that only expose /api/teams.
      const allResponse = await fetch("/api/teams");
      if (!allResponse.ok) {
        throw new Error("Could not read team records.");
      }

      const db = await allResponse.json();
      record = (db.records || []).find((item) => Number(item.id) === id) || null;
    }

    if (!record || !record.data) {
      throw new Error("Record not found.");
    }

    const data = record.data;

    renderTeam(detailTeamAEl, data.teamAName, data.teamAPlayers, data.teamALeaders || { captain: "", viceCaptain: "" });
    renderTeam(detailTeamBEl, data.teamBName, data.teamBPlayers, data.teamBLeaders || { captain: "", viceCaptain: "" });

    const [matchesResponse, picksResponse, logoResponse] = await Promise.all([
      fetch("ipl-matches.json"),
      fetch(API_PICKS_ENDPOINT),
      fetch(TEAM_LOGOS_ENDPOINT)
    ]);

    if (logoResponse.ok) {
      teamLogos = await logoResponse.json();
    }

    const matchesDb = await matchesResponse.json();
    const picksDb = picksResponse.ok ? await picksResponse.json() : { entries: {} };
    const summary = getPointsSummary(matchesDb.matches || [], picksDb.entries || {}, data.teamAName, data.teamBName);

    detailsHeadingEl.textContent = "Team Details";
    detailsSubEl.textContent = `${data.teamAName} vs ${data.teamBName}`;
    detailsStatusEl.textContent = `Saved at: ${new Date(record.savedAt).toLocaleString()}`;

    scoreTeamANameEl.textContent = data.teamAName;
    scoreTeamADescEl.textContent = "Your team points";
    scoreTeamAPointsEl.textContent = String(summary[data.teamAName] || 0);
    scoreTeamBNameEl.textContent = data.teamBName;
    scoreTeamBDescEl.textContent = "Your team points";
    scoreTeamBPointsEl.textContent = String(summary[data.teamBName] || 0);

    const scoreBoard = document.getElementById("scoreBoard");
    const teamAContainer = document.getElementById("scoreTeamAContainer");
    const teamBContainer = document.getElementById("scoreTeamBContainer");

    if (teamAContainer && teamBContainer) {
      teamAContainer.innerHTML = "";
      teamBContainer.innerHTML = "";
      teamAContainer.appendChild(createTeamBadge(data.teamAName));
      teamBContainer.appendChild(createTeamBadge(data.teamBName));
    }

    const allPlayers = [...(data.teamAPlayers || []), ...(data.teamBPlayers || [])];
    const uniquePlayers = [...new Set(allPlayers)];
    const playersParam = encodeURIComponent(uniquePlayers.join("\n"));
    updateTeamLinkEl.href = `add-team.html?players=${playersParam}`;

    detailsResultsEl.hidden = false;
  } catch (error) {
    detailsStatusEl.textContent = "Could not load this record from JSON database. Restart server and try again.";
  }
}

loadDetails();
