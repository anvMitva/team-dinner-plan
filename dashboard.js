const todayContainer = document.getElementById("todayMatches");
const upcomingContainer = document.getElementById("upcomingMatches");
const todayEmpty = document.getElementById("todayEmpty");
const upcomingEmpty = document.getElementById("upcomingEmpty");
const teamOptionCard = document.getElementById("teamOptionCard");
const teamOptionTitle = document.getElementById("teamOptionTitle");
const teamOptionMeta = document.getElementById("teamOptionMeta");
const teamOptionView = document.getElementById("teamOptionView");
const teamOptionUpdate = document.getElementById("teamOptionUpdate");
const teamOptionEmpty = document.getElementById("teamOptionEmpty");

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
  return `${match.date} ${match.time}`;
}

function createMatchCard(match, tag) {
  const card = document.createElement("article");
  const top = document.createElement("div");
  const id = document.createElement("span");
  const pill = document.createElement("span");
  const teams = document.createElement("h3");
  const meta = document.createElement("p");

  card.className = "match-card";
  top.className = "match-card-top";
  id.className = "match-id";
  pill.className = `pill ${tag === "today" ? "" : tag === "upcoming" ? "pill-upcoming" : "pill-completed"}`.trim();
  teams.className = "match-teams";
  meta.className = "match-meta";

  id.textContent = match.id;
  pill.textContent = tag.charAt(0).toUpperCase() + tag.slice(1);
  teams.textContent = `${match.teamA} vs ${match.teamB}`;
  meta.textContent = `${formatDate(match)} | ${match.venue}, ${match.city}`;

  top.appendChild(id);
  top.appendChild(pill);
  card.appendChild(top);
  card.appendChild(teams);
  card.appendChild(meta);
  return card;
}

async function loadDashboard() {
  const response = await fetch("ipl-matches.json");
  const data = await response.json();
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const todayMatches = [];
  const upcomingMatches = [];

  data.matches.forEach((match) => {
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
    const teamResponse = await fetch("/api/teams");
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
      teamOptionTitle.textContent = `${data.teamAName} vs ${data.teamBName}`;
      teamOptionMeta.textContent = `Saved: ${new Date(active.savedAt).toLocaleString()} | Players: ${(data.teamAPlayers || []).length + (data.teamBPlayers || []).length}`;
      teamOptionView.href = `team-details.html?id=${encodeURIComponent(active.id)}`;

      const prefillPlayers = [...new Set([...(data.teamAPlayers || []), ...(data.teamBPlayers || [])])].join("\n");
      teamOptionUpdate.href = `add-team.html?players=${encodeURIComponent(prefillPlayers)}`;

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
