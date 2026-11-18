import { db } from "./firebase-init.js";
import {
  TEAM_COLORS,
  normalizeTeamName,
  PLACES,
  EVENTS,
  PRIZE_DISTRIBUTION,
  getPrizeTotals,
  calculateTeamPrizeTotals,
} from "./adage-data.js";
import {
  collection,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN").format(amount);

function teamChip(name) {
  const team = normalizeTeamName(name);
  const color = TEAM_COLORS[team] || "#999";
  return `<span class="team-dot" style="background:${color}"></span>${team}`;
}

function placeCell(place) {
  if (!place || !place.teams || place.teams.length === 0) return "-";
  return [...new Set(place.teams.map(normalizeTeamName))]
    .map(teamChip)
    .join(", ");
}

function renderPrizeDistribution() {
  const header = document.getElementById("prizeDistributionHeader");
  header.innerHTML = `
    <th>Prize Money</th>
    ${PLACES.map((place) => `<th>${place.shortLabel}</th>`).join("")}`;

  const { positions: totals, grandTotal } = getPrizeTotals();
  const rows = EVENTS.map((event) => {
    const distribution = PRIZE_DISTRIBUTION[event.id];
    const cells = PLACES.map((place) => {
      const amount = distribution[place.key];
      return `<td>${amount ? `₹${formatCurrency(amount)}` : "-"}</td>`;
    }).join("");
    return `<tr><th scope="row">${distribution.label}</th>${cells}</tr>`;
  });

  document.getElementById("prizeDistributionBody").innerHTML = rows.join("");
  document.getElementById("prizeDistributionTotals").innerHTML = `
    <tr class="font-bold bg-[#241c0c]">
      <th scope="row">TOTAL</th>
      ${PLACES.map((place) => `<td>₹${formatCurrency(totals[place.key])}</td>`).join("")}
    </tr>
    <tr>
      <td colspan="${PLACES.length + 1}" class="text-right font-bold text-[#008B94]">
        Grand Total: ₹${formatCurrency(grandTotal)}
      </td>
    </tr>`;
}

function renderResultsHeader() {
  document.getElementById("resultsHeader").innerHTML = `
    <th>Event</th>
    ${PLACES.map((place) => `<th class="${place.className}">${place.label}</th>`).join("")}`;
}

function render(resultsById) {
  // Event-wise winners table, always in the fixed EVENTS order.
  document.getElementById("resultsBody").innerHTML = EVENTS.map((event) => {
    const result = resultsById[event.id];
    const cells = PLACES.map(
      (place) => `<td class="${place.className}">${placeCell(result && result[place.key])}</td>`
    ).join("");
    return `<tr><td>${event.name}</td>${cells}</tr>`;
  }).join("");

  // Team prize-money leaderboard, split evenly when a place is tied between teams.
  const totals = calculateTeamPrizeTotals(resultsById);

  const sorted = Object.entries(totals)
    .filter(([, money]) => money > 0)
    .sort((a, b) => b[1] - a[1]);

  document.getElementById("teamTotals").innerHTML =
    sorted.length > 0
      ? sorted
          .map(
            ([team, money], index) => `
        <tr class="${index === 0 ? "leader-gold" : ""}">
          <td><span class="rank-badge${index === 0 ? " rank-gold" : ""}">${index === 0 ? "🏆" : index + 1}</span></td>
          <td class="font-medium">${teamChip(team)}</td>
          <td class="font-semibold">₹${formatCurrency(money)}</td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="3" class="text-gray-400 italic py-3">No results yet</td></tr>`;
}

renderResultsHeader();
renderPrizeDistribution();

// Live listener: fires immediately with current data, then again every time
// admin.html writes an update, no page refresh needed on anyone's screen.
onSnapshot(collection(db, "results"), (snapshot) => {
  const resultsById = {};
  snapshot.forEach((doc) => {
    resultsById[doc.id] = doc.data();
  });
  render(resultsById);
});
