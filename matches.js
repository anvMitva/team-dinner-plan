const allMatchesContainer = document.getElementById("allMatches");
const allEmpty = document.getElementById("allEmpty");
const resultsHeading = document.getElementById("resultsHeading");
const searchInput = document.getElementById("searchInput");
const teamFilter = document.getElementById("teamFilter");
const tagFilter = document.getElementById("tagFilter");
const assignmentHelp = document.getElementById("assignmentHelp");
const pointsTable = document.getElementById("pointsTable");
const syncResultsBtn = document.getElementById("syncResultsBtn");
const syncStatus = document.getElementById("syncStatus");

const API_TEAMS_ENDPOINT = "/api/teams";
const API_PICKS_ENDPOINT = "/api/match-picks";
const TEAM_LOGOS_ENDPOINT = "/team-logos.json";
const focusMatchId = new URLSearchParams(window.location.search).get("matchId") || "";

let allMatches = [];
let customTeams = [];
let picksByMatchId = {};
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
  return "all";
}

function formatMatchDate(dateText) {
  const dateValue = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(dateValue.getTime())) {
    return dateText;
  }

  return dateValue.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function createSelectOptions(selectEl, values, includeEmptyLabel) {
  selectEl.innerHTML = "";

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = includeEmptyLabel;
  selectEl.appendChild(emptyOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectEl.appendChild(option);
  });
}

function setControlsLocked(controls, locked) {
  controls.forEach((control) => {
    control.disabled = locked;
  });
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

function shuffle(array) {
  const copy = [...array];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function wait(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function openLockedTossDialog(match) {
  const overlay = document.createElement("div");
  const dialog = document.createElement("div");
  const title = document.createElement("h3");
  const subtitle = document.createElement("p");
  const coinWrap = document.createElement("div");
  const coin = document.createElement("div");
  const commentary = document.createElement("p");
  const reveal = document.createElement("div");
  const actions = document.createElement("div");
  const closeBtn = document.createElement("button");
  let resolveClose;
  const waitForClose = new Promise((resolve) => {
    resolveClose = resolve;
  });

  overlay.className = "toss-dialog-overlay";
  dialog.className = "toss-dialog";
  title.className = "toss-dialog-title";
  subtitle.className = "toss-dialog-subtitle";
  coinWrap.className = "toss-dialog-coin-wrap toss-dialog-coin-wrap-active";
  coin.className = "toss-dialog-coin";
  commentary.className = "toss-dialog-commentary";
  reveal.className = "toss-reveal";
  actions.className = "toss-dialog-actions";
  closeBtn.className = "btn btn-primary toss-dialog-close";
  closeBtn.type = "button";
  closeBtn.textContent = "Close Reveal";
  closeBtn.hidden = true;
  reveal.hidden = true;

  title.textContent = `Live Toss • ${match.id}`;
  subtitle.textContent = `${match.teamA} vs ${match.teamB}`;
  commentary.textContent = "Coin is up in the air...";

  coinWrap.appendChild(coin);
  dialog.appendChild(title);
  dialog.appendChild(subtitle);
  dialog.appendChild(coinWrap);
  dialog.appendChild(commentary);
  dialog.appendChild(reveal);
  actions.appendChild(closeBtn);
  dialog.appendChild(actions);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  document.body.classList.add("toss-dialog-open");

  closeBtn.addEventListener("click", () => {
    if (resolveClose) {
      resolveClose();
    }
  });

  const sequence = [
    { text: "Coin is up in the air...", duration: 2000 },
    { text: "Its flipping fast...", duration: 1200 },
    { text: "The crowd is cheering loud...", duration: 900 },
    { text: "Who will win today?", duration: 900 }
  ];

  const playSequence = async () => {
    for (let index = 0; index < sequence.length; index += 1) {
      commentary.textContent = sequence[index].text;
      await wait(sequence[index].duration);
    }
  };

  const showReveal = (teamAssignments, customTeams, getLogoByTeam) => {
    dialog.classList.add("toss-dialog-reveal");
    commentary.textContent = "Toss complete! Group reveal!";
    coinWrap.classList.remove("toss-dialog-coin-wrap-active");
    reveal.hidden = false;
    closeBtn.hidden = false;
    reveal.innerHTML = "";

    customTeams.forEach((ourTeamName) => {
      const assignedTeam = teamAssignments[ourTeamName] || "";
      const info = getLogoByTeam(assignedTeam);
      const row = document.createElement("div");
      const ourTeam = document.createElement("div");
      const arrow = document.createElement("span");
      const assigned = document.createElement("div");
      const logo = document.createElement("img");
      const assignedText = document.createElement("span");

      row.className = "toss-reveal-row";
      ourTeam.className = "toss-reveal-our-team";
      arrow.className = "toss-reveal-arrow";
      assigned.className = "toss-reveal-assigned";
      logo.className = "toss-reveal-logo";
      assignedText.className = "toss-reveal-assigned-text";

      ourTeam.textContent = ourTeamName;
      arrow.textContent = "assigned to";
      logo.src = info.logoUrl || "";
      logo.alt = assignedTeam ? `${assignedTeam} logo` : "Team logo";
      logo.hidden = !info.logoUrl;
      assignedText.textContent = assignedTeam || "Not assigned";

      assigned.appendChild(logo);
      assigned.appendChild(assignedText);
      row.appendChild(ourTeam);
      row.appendChild(arrow);
      row.appendChild(assigned);
      reveal.appendChild(row);
    });
  };

  const showError = (message) => {
    dialog.classList.remove("toss-dialog-reveal");
    commentary.textContent = message;
    coinWrap.classList.remove("toss-dialog-coin-wrap-active");
    reveal.hidden = true;
    closeBtn.hidden = false;
  };

  const close = () => {
    overlay.remove();
    document.body.classList.remove("toss-dialog-open");
  };

  return {
    playSequence,
    showReveal,
    showError,
    waitForClose,
    close
  };
}

function getPointsSummary() {
  const summary = {};
  customTeams.forEach((teamName) => {
    summary[teamName] = {
      points: 0,
      decidedMatches: 0
    };
  });

  Object.values(picksByMatchId).forEach((entry) => {
    if (!entry || !entry.winner) {
      return;
    }

    customTeams.forEach((teamName) => {
      if (!summary[teamName]) {
        return;
      }

      summary[teamName].decidedMatches += 1;
      if ((entry.teamAssignments || {})[teamName] === entry.winner) {
        summary[teamName].points += 1;
      }
    });
  });

  return summary;
}

function renderPointsBoard() {
  pointsTable.innerHTML = "";

  if (!customTeams.length) {
    assignmentHelp.textContent = "No saved custom teams found. Create teams first from Add Team page, then return here.";
    return;
  }


  const summary = getPointsSummary();

  customTeams.forEach((teamName) => {
    const card = document.createElement("article");
    const header = document.createElement("div");
    const title = document.createElement("h3");
    const logo = document.createElement("img");
    const points = document.createElement("p");
    const decided = document.createElement("p");

    card.className = "point-card";
    header.className = "point-card-header";
    title.className = "point-card-title";
    logo.className = "point-card-logo";
    logo.alt = `${teamName} logo`;
    logo.loading = "lazy";
    points.className = "point-card-points";
    decided.className = "point-card-meta";

    const info = getTeamLogo(teamName);
    logo.src = info.logoUrl || "";
    logo.hidden = !info.logoUrl;

    title.textContent = teamName;
    points.textContent = `${summary[teamName].points} points`;
    decided.textContent = `Matches with result: ${summary[teamName].decidedMatches}`;

    header.appendChild(logo);
    header.appendChild(title);
    card.appendChild(header);
    card.appendChild(points);
    card.appendChild(decided);
    pointsTable.appendChild(card);
  });
}

async function saveMatchPick(matchId, teamAssignments) {
  const response = await fetch(API_PICKS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      matchId,
      teamAssignments
    })
  });

  if (!response.ok) {
    throw new Error("Save failed");
  }

  const payload = await response.json();
  picksByMatchId[matchId] = payload.entry;
  return payload.entry;
}

async function refreshPicks() {
  const picksResponse = await fetch(API_PICKS_ENDPOINT);
  if (!picksResponse.ok) {
    throw new Error("Picks unavailable");
  }

  const picksDb = await picksResponse.json();
  picksByMatchId = picksDb.entries || {};
}

async function syncResultsNow() {
  if (!syncResultsBtn || !syncStatus) {
    return;
  }

  syncResultsBtn.disabled = true;
  syncStatus.hidden = false;
  syncStatus.textContent = "Syncing result data from completed matches...";

  try {
    const response = await fetch("/api/sync-match-results", { method: "POST" });
    if (!response.ok) {
      throw new Error("Sync failed");
    }

    await refreshPicks();
    renderPointsBoard();
    renderMatches();
    syncStatus.textContent = "Result data synced and points updated.";
  } catch (error) {
    syncStatus.textContent = "Could not sync result data right now.";
  } finally {
    syncResultsBtn.disabled = false;
  }
}

function createMatchCard(match, tag) {
  const entry = picksByMatchId[match.id] || { teamAssignments: {}, winner: "" };
  const card = document.createElement("article");
  const top = document.createElement("div");
  const id = document.createElement("span");
  const pill = document.createElement("span");
  const teams = document.createElement("div");
  const meta = document.createElement("p");

  const actions = document.createElement("div");
  const randomAssignBtn = document.createElement("button");
  const status = document.createElement("p");
  const assignHelp = document.createElement("p");
  const assignmentPanel = document.createElement("div");

  card.className = "match-card";
  card.dataset.matchId = match.id;
  top.className = "match-card-top";
  id.className = "match-id";
  pill.className = `pill ${tag === "today" ? "" : tag === "upcoming" ? "pill-upcoming" : tag === "completed" ? "pill-completed" : ""}`.trim();
  teams.className = "match-teams match-teams-stacked";
  meta.className = "match-meta";
  actions.className = "assignment-grid";
  assignmentPanel.className = "match-assign-panel";
  randomAssignBtn.className = "btn btn-ghost";
  randomAssignBtn.type = "button";
  status.className = "history-note";
  assignHelp.className = "history-note";

  id.textContent = match.id;
  pill.textContent = tag === "all" ? "Scheduled" : tag.charAt(0).toUpperCase() + tag.slice(1);
  const teamARow = createTeamPill(match.teamA);
  const teamBRow = createTeamPill(match.teamB);
  const vsPill = document.createElement("span");
  vsPill.className = "match-vs-pill";
  vsPill.textContent = "VS";
  teams.appendChild(teamARow);
  teams.appendChild(vsPill);
  teams.appendChild(teamBRow);
  meta.textContent = `${formatMatchDate(match.date)} ${match.time} | ${match.stage} | ${match.city}`;

  top.appendChild(id);
  top.appendChild(pill);
  card.appendChild(top);
  card.appendChild(teams);
  card.appendChild(meta);
  card.appendChild(assignHelp);

  if (!customTeams.length) {
    status.textContent = "Create your own teams first to enable assignment and result scoring.";
    card.appendChild(status);
    return card;
  }

  customTeams.forEach((ourTeamName) => {
    const row = document.createElement("div");
    const label = document.createElement("label");
    const select = document.createElement("select");

    row.className = "assignment-row";
    label.className = "assignment-label";
    select.className = "text-input";

    label.textContent = `${ourTeamName} pick`;
    createSelectOptions(select, [match.teamA, match.teamB], "Not assigned");
    select.value = (entry.teamAssignments || {})[ourTeamName] || "";
    select.disabled = true;

    row.appendChild(label);
    row.appendChild(select);
    actions.appendChild(row);
  });


  randomAssignBtn.textContent = "Random Assign";

  const hasSavedAssignments = customTeams.every((teamName) => Boolean((entry.teamAssignments || {})[teamName]));
  let step = hasSavedAssignments ? 1 : 0;
  let tossInProgress = false;

  if (entry.winner) {
    const winnerGroups = customTeams.filter((teamName) => (entry.teamAssignments || {})[teamName] === entry.winner);
    status.textContent = winnerGroups.length
        ? `Result synced: ${entry.winner}. Point goes to: ${winnerGroups.join(", ")}.`
        : `Result synced: ${entry.winner}. No custom team matched this winner.`;
  } else {
  }

  const getTeamAssignmentsFromUi = () => {
    const teamAssignments = {};
    const rows = actions.querySelectorAll(".assignment-row");

    customTeams.forEach((teamName, index) => {
      const select = rows[index].querySelector("select");
      teamAssignments[teamName] = select.value || "";
    });

    return teamAssignments;
  };

  const renderStep = () => {
    assignmentPanel.hidden = step < 1;
    card.classList.toggle("match-card-focus", step > 0 || match.id === focusMatchId);
  };

  const lockAssignmentControls = () => {
    const assignmentSelects = [...actions.querySelectorAll(".assignment-row select")];
    setControlsLocked([...assignmentSelects, randomAssignBtn], true);
  };

  const buildAssignmentAnnouncement = (teamAssignments) => customTeams
    .map((teamName) => `${teamName} assigned to ${teamAssignments[teamName] || "Not assigned"}`)
    .join(" | ");

  randomAssignBtn.addEventListener("click", async () => {
    if (!customTeams.length || tossInProgress) {
      return;
    }

    const rows = actions.querySelectorAll(".assignment-row");
    const teamsForMatch = shuffle([match.teamA, match.teamB]);
    const tossDialog = openLockedTossDialog(match);

    tossInProgress = true;
    randomAssignBtn.disabled = true;
    assignHelp.textContent = "Live toss started. Please wait for the reveal.";

    try {
      await tossDialog.playSequence();

      customTeams.forEach((teamName, index) => {
        const select = rows[index].querySelector("select");
        select.value = teamsForMatch[index] || "";
      });

      const teamAssignments = getTeamAssignmentsFromUi();
      const announcement = buildAssignmentAnnouncement(teamAssignments);

      await saveMatchPick(match.id, teamAssignments);
      tossDialog.showReveal(teamAssignments, customTeams, getTeamLogo);
      await tossDialog.waitForClose;
      tossDialog.close();

      lockAssignmentControls();
      step = Math.max(step, 1);
      const latest = picksByMatchId[match.id] || { winner: "" };
      renderStep();
      renderPointsBoard();
    } catch (error) {
      tossDialog.showError("Could not save random assignment. Please try again.");
      await tossDialog.waitForClose;
      tossDialog.close();
      status.textContent = "Could not save random assignment. Try again.";
      randomAssignBtn.disabled = false;
      assignHelp.textContent = "";
    } finally {
      tossInProgress = false;
    }
  });


  card.addEventListener("dblclick", () => {
    if (step === 0) {
      step = 1;
      renderStep();
      return;
    }

    step = 0;
    renderStep();
  });

  assignmentPanel.appendChild(actions);
  assignmentPanel.appendChild(randomAssignBtn);
  card.appendChild(assignmentPanel);
  card.appendChild(status);

  if (match.id === focusMatchId) {
    step = Math.max(step, 1);
  }

  if (hasSavedAssignments) {
    lockAssignmentControls();
  }


  renderStep();

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
    const byTag = tag === "all"
      ? true
      : tag === "today-upcoming"
        ? computedTag === "today" || computedTag === "upcoming"
        : computedTag === tag;
    const byTeam = team ? match.teamA === team || match.teamB === team : true;

    const haystack = `${match.id} ${match.teamA} ${match.teamB} ${match.stage} ${match.city} ${match.date} ${match.time}`.toLowerCase();
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

  if (focusMatchId) {
    const safeMatchId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(focusMatchId) : focusMatchId.replace(/"/g, "\\\"");
    const targetCard = allMatchesContainer.querySelector(`.match-card[data-match-id="${safeMatchId}"]`);
    if (targetCard) {
      targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
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
  const [matchesResponse, teamsResponse, picksResponse, logosResponse] = await Promise.all([
    fetch("ipl-matches.json"),
    fetch(API_TEAMS_ENDPOINT),
    fetch(API_PICKS_ENDPOINT),
    fetch(TEAM_LOGOS_ENDPOINT)
  ]);

  const data = await matchesResponse.json();
  allMatches = data.matches || [];

  if (teamsResponse.ok) {
    const teamsDb = await teamsResponse.json();
    const records = teamsDb.records || [];
    const active = records[records.length - 1];
    if (active && active.data && active.data.teamAName && active.data.teamBName) {
      customTeams = [active.data.teamAName, active.data.teamBName];
    }
  }

  if (picksResponse.ok) {
    const picksDb = await picksResponse.json();
    picksByMatchId = picksDb.entries || {};
  }

  if (logosResponse.ok) {
    teamLogos = await logosResponse.json();
  }

  tagFilter.value = "today-upcoming";

  fillTeamFilter(allMatches);
  renderPointsBoard();
  renderMatches();
}

searchInput.addEventListener("input", renderMatches);
teamFilter.addEventListener("change", renderMatches);
tagFilter.addEventListener("change", renderMatches);
if (syncResultsBtn) {
  syncResultsBtn.addEventListener("click", syncResultsNow);
}

init().catch(() => {
  allEmpty.hidden = false;
  allEmpty.textContent = "Could not load schedule data.";
});
