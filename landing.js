const historyListEl = document.getElementById("historyList");
const historyEmptyEl = document.getElementById("historyEmpty");
const API_TEAMS_ENDPOINT = "/api/teams";

function formatDate(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function renderHistory(records) {
  historyListEl.innerHTML = "";

  if (!records.length) {
    historyEmptyEl.hidden = false;
    return;
  }

  historyEmptyEl.hidden = true;

  const activeRecord = records[records.length - 1];

  [activeRecord].forEach((record) => {
    if (!record || !record.data) {
      return;
    }

    const row = document.createElement("div");
    const left = document.createElement("div");
    const right = document.createElement("div");
    const main = document.createElement("div");
    const sub = document.createElement("div");

    row.className = "history-item";
    row.tabIndex = 0;
    row.title = "Double click to open details page";

    main.className = "history-item-main";
    main.textContent = `${record.data.teamAName} vs ${record.data.teamBName}`;

    sub.className = "history-item-sub";
    sub.textContent = formatDate(record.savedAt);

    left.appendChild(main);
    left.appendChild(sub);

    right.className = "history-item-sub";
    right.textContent = "Double click";

    row.appendChild(left);
    row.appendChild(right);

    const openDetails = () => {
      window.location.href = `team-details.html?id=${encodeURIComponent(record.id)}`;
    };

    row.addEventListener("dblclick", openDetails);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        openDetails();
      }
    });

    historyListEl.appendChild(row);
  });
}

async function loadHistory() {
  try {
    const response = await fetch(API_TEAMS_ENDPOINT);
    if (!response.ok) {
      throw new Error("Unable to load records.");
    }

    const db = await response.json();
    renderHistory(db.records || []);
  } catch (error) {
    historyEmptyEl.hidden = false;
    historyEmptyEl.textContent = "Could not load team records. Make sure server.js is running.";
  }
}

loadHistory();
