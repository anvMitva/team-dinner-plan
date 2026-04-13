const todayContainer = document.getElementById("todayMatches");
const upcomingContainer = document.getElementById("upcomingMatches");
const todayEmpty = document.getElementById("todayEmpty");
const upcomingEmpty = document.getElementById("upcomingEmpty");
const teamOptionCard = document.getElementById("teamOptionCard");
const teamOptionTitle = document.getElementById("teamOptionTitle");
const teamOptionMeta = document.getElementById("teamOptionMeta");
const teamOptionPoints = document.getElementById("teamOptionPoints");
const teamOptionView = document.getElementById("teamOptionView");
const teamOptionUpdate = document.getElementById("teamOptionUpdate");
const teamOptionEmpty = document.getElementById("teamOptionEmpty");

const API_TEAMS_ENDPOINT = "/api/teams";
const API_PICKS_ENDPOINT = "/api/match-picks";
const TEAM_LOGOS_ENDPOINT = "/team-logos.json";

let allMatches = [];
let activeCustomTeams = [];
let teamLogos = {};

function parseDate(match) {
  return new Date(`${match.date}T00:00:00`);
}

function getTag(match, now) {
  const matchDate = parseDate(match);
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((matchDate - now) / dayMs);

  if (diffDays === 0) {
    return "today";
  }
  if (diffDays > 0 && diffDays <= 2) {
    return "upcoming";
  }
  if (diffDays < 0) {
    return "completed";
  }
  return "other";
}

function formatDate(match) {
  const dateValue = new Date(`${match.date}T00:00:00`);
  const prettyDate = Number.isNaN(dateValue.getTime())
    ? match.date
    : dateValue.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
  return `${prettyDate} ${match.time}`;
}

function getTeamLogo(teamName) {
  return teamLogos[teamName] || { shortCode: teamName, logoUrl: "" };
}

function createTeamPill(teamName) {
  const wrapper = document.createElement("div");
  const logo = document.createElement("img");
  const text = document.createElement("span");

  wrapper.className = "team-pill";
  logo.className = "team-pill-logo";
  logo.alt = `${teamName} logo`;
  logo.loading = "lazy";

  const info = getTeamLogo(teamName);
  logo.src = info.logoUrl || "";
  logo.hidden = !info.logoUrl;

  text.className = "team-pill-text";
  text.textContent = teamName;

  wrapper.appendChild(logo);
  wrapper.appendChild(text);
  return wrapper;
}

function createMatchCard(match, tag) {
  const card = document.createElement("article");
  const top = document.createElement("div");
  const id = document.createElement("span");
  const pill = document.createElement("span");
  const teams = document.createElement("div");
  const meta = document.createElement("p");

  card.className = "match-card";
  if (tag === "today") {
    card.classList.add("match-card-today");
  }
  top.className = "match-card-top";
  id.className = "match-id";
  pill.className = `pill ${tag === "today" ? "" : tag === "upcoming" ? "pill-upcoming" : "pill-completed"}`.trim();
  teams.className = tag === "today" ? "match-teams match-teams-inline" : "match-teams match-teams-stacked";
  meta.className = "match-meta";

  id.textContent = match.id;
  pill.textContent = tag.charAt(0).toUpperCase() + tag.slice(1);
  teams.appendChild(createTeamPill(match.teamA));
  const vsPill = document.createElement("span");
  vsPill.className = "match-vs-pill";
  vsPill.textContent = "VS";
  teams.appendChild(vsPill);
  teams.appendChild(createTeamPill(match.teamB));
  meta.textContent = `${formatDate(match)} | ${match.city}`;

  top.appendChild(id);
  top.appendChild(pill);
  card.appendChild(top);
  card.appendChild(teams);
  card.appendChild(meta);

  card.tabIndex = 0;
  card.title = "Double click to open assignment for this match";

  const openAssignment = () => {
    window.location.href = `matches.html?matchId=${encodeURIComponent(match.id)}`;
  };

  card.addEventListener("dblclick", openAssignment);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      openAssignment();
    }
  });

  return card;
}

function calculatePointsSummary(matches, entries, customTeams) {
  const summary = {};
  customTeams.forEach((teamName) => {
    summary[teamName] = 0;
  });

  matches.forEach((match) => {
    const entry = entries[match.id];
    if (!entry || !entry.winner) {
      return;
    }

    customTeams.forEach((teamName) => {
      if ((entry.teamAssignments || {})[teamName] === entry.winner) {
        summary[teamName] += 1;
      }
    });
  });

  return summary;
}

async function loadDashboard() {
  const [response, logoResponse] = await Promise.all([
    fetch("ipl-matches.json"),
    fetch(TEAM_LOGOS_ENDPOINT)
  ]);

  if (logoResponse.ok) {
    teamLogos = await logoResponse.json();
  }

  const data = await response.json();
  allMatches = data.matches || [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const todayMatches = [];
  const upcomingMatches = [];

  allMatches.forEach((match) => {
    const tag = getTag(match, now);
    if (tag === "today") {
      todayMatches.push(match);
    }
    if (tag === "upcoming") {
      upcomingMatches.push(match);
    }
  });

  todayContainer.innerHTML = "";
  upcomingContainer.innerHTML = "";

  if (!todayMatches.length) {
    todayEmpty.hidden = false;
  } else {
    todayEmpty.hidden = true;
    todayMatches.forEach((match) => {
      todayContainer.appendChild(createMatchCard(match, "today"));
    });
  }

  if (!upcomingMatches.length) {
    upcomingEmpty.hidden = false;
  } else {
    upcomingEmpty.hidden = true;
    upcomingMatches.forEach((match) => {
      upcomingContainer.appendChild(createMatchCard(match, "upcoming"));
    });
  }

  try {
    const teamResponse = await fetch(API_TEAMS_ENDPOINT);
    if (!teamResponse.ok) {
      throw new Error("Team data unavailable");
    }

    const teamDb = await teamResponse.json();
    const records = teamDb.records || [];
    const active = records[records.length - 1];

    if (!active || !active.data) {
      teamOptionCard.hidden = true;
      teamOptionEmpty.hidden = false;
    } else {
      const data = active.data;
      activeCustomTeams = [data.teamAName, data.teamBName];

      teamOptionTitle.textContent = `${data.teamAName} vs ${data.teamBName}`;
      teamOptionMeta.textContent = `Saved: ${new Date(active.savedAt).toLocaleString()} | Players: ${(data.teamAPlayers || []).length + (data.teamBPlayers || []).length}`;
      teamOptionView.href = `team-details.html?id=${encodeURIComponent(active.id)}`;

      const prefillPlayers = [...new Set([...(data.teamAPlayers || []), ...(data.teamBPlayers || [])])].join("\n");
      teamOptionUpdate.href = `add-team.html?players=${encodeURIComponent(prefillPlayers)}`;

      teamOptionCard.title = "Double click to show points summary";
      teamOptionCard.tabIndex = 0;
      teamOptionPoints.hidden = true;
      teamOptionPoints.textContent = "";

      const showPointsSummary = async () => {
        try {
          const picksResponse = await fetch(API_PICKS_ENDPOINT);
          if (!picksResponse.ok) {
            throw new Error("Picks unavailable");
          }

          const picksDb = await picksResponse.json();
          const summary = calculatePointsSummary(allMatches, picksDb.entries || {}, activeCustomTeams);
          teamOptionPoints.textContent = `${activeCustomTeams[0]}: ${summary[activeCustomTeams[0]] || 0} points | ${activeCustomTeams[1]}: ${summary[activeCustomTeams[1]] || 0} points`;
          teamOptionPoints.hidden = false;
        } catch (error) {
          teamOptionPoints.textContent = "Could not load points summary right now.";
          teamOptionPoints.hidden = false;
        }
      };

      teamOptionCard.addEventListener("dblclick", showPointsSummary);
      teamOptionCard.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          showPointsSummary();
        }
      });

      teamOptionCard.hidden = false;
      teamOptionEmpty.hidden = true;
    }
  } catch (error) {
    teamOptionCard.hidden = true;
    teamOptionEmpty.hidden = false;
    teamOptionEmpty.textContent = "Could not load team data.";
  }
}

loadDashboard().catch(() => {
  todayEmpty.hidden = false;
  upcomingEmpty.hidden = false;
  todayEmpty.textContent = "Could not load schedule data.";
  upcomingEmpty.textContent = "Could not load schedule data.";
});
