const allMatchesContainer = document.getElementById("allMatches");
const allEmpty = document.getElementById("allEmpty");
const resultsHeading = document.getElementById("resultsHeading");
const searchInput = document.getElementById("searchInput");
const teamFilter = document.getElementById("teamFilter");
const tagFilter = document.getElementById("tagFilter");

let allMatches = [];

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
  return "all";
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
  pill.className = `pill ${tag === "today" ? "" : tag === "upcoming" ? "pill-upcoming" : tag === "completed" ? "pill-completed" : ""}`.trim();
  teams.className = "match-teams";
  meta.className = "match-meta";

  id.textContent = match.id;
  pill.textContent = tag === "all" ? "Scheduled" : tag.charAt(0).toUpperCase() + tag.slice(1);
  teams.textContent = `${match.teamA} vs ${match.teamB}`;
  meta.textContent = `${match.date} ${match.time} | ${match.stage} | ${match.venue}, ${match.city}`;

  top.appendChild(id);
  top.appendChild(pill);
  card.appendChild(top);
  card.appendChild(teams);
  card.appendChild(meta);
  return card;
}

function renderMatches() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const q = searchInput.value.trim().toLowerCase();
  const tag = tagFilter.value;
  const team = teamFilter.value;

  const filtered = allMatches.filter((match) => {
    const computedTag = getTag(match, now);
    const byTag = tag === "all" ? true : computedTag === tag;
    const byTeam = team ? match.teamA === team || match.teamB === team : true;

    const haystack = `${match.id} ${match.teamA} ${match.teamB} ${match.stage} ${match.venue} ${match.city} ${match.date} ${match.time}`.toLowerCase();
    const bySearch = q ? haystack.includes(q) : true;

    return byTag && byTeam && bySearch;
  });

  allMatchesContainer.innerHTML = "";

  if (!filtered.length) {
    allEmpty.hidden = false;
    resultsHeading.textContent = "Matches (0)";
    return;
  }

  allEmpty.hidden = true;
  resultsHeading.textContent = `Matches (${filtered.length})`;

  filtered.forEach((match) => {
    allMatchesContainer.appendChild(createMatchCard(match, getTag(match, now)));
  });
}

function fillTeamFilter(matches) {
  const teams = new Set();
  matches.forEach((match) => {
    teams.add(match.teamA);
    teams.add(match.teamB);
  });

  [...teams].sort().forEach((team) => {
    const option = document.createElement("option");
    option.value = team;
    option.textContent = team;
    teamFilter.appendChild(option);
  });
}

async function init() {
  const response = await fetch("ipl-matches.json");
  const data = await response.json();
  allMatches = data.matches || [];

  fillTeamFilter(allMatches);
  renderMatches();
}

searchInput.addEventListener("input", renderMatches);
teamFilter.addEventListener("change", renderMatches);
tagFilter.addEventListener("change", renderMatches);

init().catch(() => {
  allEmpty.hidden = false;
  allEmpty.textContent = "Could not load schedule data.";
});
