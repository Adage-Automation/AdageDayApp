import { db } from "./firebase-init.js";
import { TEAMS, EVENTS } from "./adage-data.js";
import {
  collection,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const PLACES = [
  { key: "first", cls: "gold" },
  { key: "second", cls: "silver" },
  { key: "third", cls: "bronze" },
];

function placeCell(place) {
  if (!place || !place.teams || place.teams.length === 0) return "—";
  return place.teams.join(", ");
}

function render(resultsById) {
  // Event-wise winners table, always in the fixed EVENTS order.
  document.getElementById("resultsBody").innerHTML = EVENTS.map((event) => {
    const result = resultsById[event.id];
    const cells = PLACES.map(
      (p) => `<td class="${p.cls}">${placeCell(result && result[p.key])}</td>`
    ).join("");
    return `<tr><td>${event.name}</td>${cells}</tr>`;
  }).join("");

  // Team prize-money leaderboard, split evenly when a place is tied between teams.
  const totals = {};
  TEAMS.forEach((t) => (totals[t] = 0));

  Object.values(resultsById).forEach((result) => {
    PLACES.forEach(({ key }) => {
      const place = result[key];
      if (!place || !place.teams || place.teams.length === 0) return;
      const share = Math.floor((place.money || 0) / place.teams.length);
      place.teams.forEach((team) => {
        if (totals[team] !== undefined) totals[team] += share;
      });
    });
  });

  const sorted = Object.entries(totals)
    .filter(([, money]) => money > 0)
    .sort((a, b) => b[1] - a[1]);

  document.getElementById("teamTotals").innerHTML =
    sorted.length > 0
      ? sorted
          .map(
            ([team, money], index) => `
        <tr class="${index === 0 ? "leader-gold" : ""}">
          <td>${index === 0 ? "🏆" : index + 1}</td>
          <td class="font-medium">${team}</td>
          <td class="font-semibold">₹${money.toLocaleString()}</td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="3" class="text-gray-400 italic py-3">No results yet</td></tr>`;
}

// Live listener: fires immediately with current data, then again every time
// admin.html writes an update — no page refresh needed on anyone's screen.
onSnapshot(collection(db, "results"), (snapshot) => {
  const resultsById = {};
  snapshot.forEach((doc) => {
    resultsById[doc.id] = doc.data();
  });
  render(resultsById);
});
