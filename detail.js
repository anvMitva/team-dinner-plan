const detailsHeadingEl = document.getElementById("detailsHeading");
const detailsSubEl = document.getElementById("detailsSub");
const detailsStatusEl = document.getElementById("detailsStatus");
const detailsResultsEl = document.getElementById("detailsResults");
const detailTeamAEl = document.getElementById("detailTeamA");
const detailTeamBEl = document.getElementById("detailTeamB");
const updateTeamLinkEl = document.getElementById("updateTeamLink");

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

    detailsHeadingEl.textContent = "Team Details";
    detailsSubEl.textContent = `${data.teamAName} vs ${data.teamBName}`;
    detailsStatusEl.textContent = `Saved at: ${new Date(record.savedAt).toLocaleString()}`;

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
