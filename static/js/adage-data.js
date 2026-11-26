// Shared team, place, event, and prize data for the admin and public results pages.

export const TEAMS = ["Poseidon", "Hermes", "Ares", "Apollo", "Zeus", "Thor"];

export const TEAM_COLORS = {
  Poseidon: "rgb(254, 254, 255)",
  Hermes: "#f17d10",
  Ares: "#fc640d",
  Apollo: "rgb(239, 47, 26)",
  Zeus: "#6bcaf3",
  Thor: "#000000",
};

export const TEAM_NAME_MIGRATIONS = {
  "Red Bull": "Poseidon",
  Alpine: "Hermes",
  "Aston Martin": "Ares",
  Mercedes: "Apollo",
  Ferrari: "Zeus",
  McLaren: "Thor",
};

export function normalizeTeamName(name) {
  return TEAM_NAME_MIGRATIONS[name] || name;
}

export const PLACES = [
  { key: "first", label: "🥇 1st Place", shortLabel: "1st", className: "gold" },
  { key: "second", label: "🥈 2nd Place", shortLabel: "2nd", className: "silver" },
  { key: "third", label: "🥉 3rd Place", shortLabel: "3rd", className: "bronze" },
  { key: "fourth", label: "4th Place", shortLabel: "4th", className: "fourth" },
];

export const EVENTS = [
  { id: "1km", name: "1 KM Race" },
  { id: "100m", name: "100 MTR Race" },
  { id: "football", name: "Football" },
  { id: "futsal", name: "Futsal" },
  { id: "gtm", name: "GTM" },
  { id: "treasureHunt", name: "Treasure Hunt" },
];

export const PRIZE_DISTRIBUTION = {
  "1km": { label: "1 KM", first: 70000, second: 30000, third: 20000, fourth: 15000 },
  "100m": { label: "100 MTR", first: 60000, second: 30000, third: 20000, fourth: 15000 },
  football: { label: "Football", first: 80000, second: 0, third: 0, fourth: 0 },
  futsal: { label: "Futsal", first: 80000, second: 0, third: 0, fourth: 0 },
  gtm: { label: "GTM", first: 60000, second: 30000, third: 20000, fourth: 10000 },
  treasureHunt: { label: "TH (Treasure Hunt)", first: 60000, second: 0, third: 0, fourth: 0 },
};

export function getPrizeTotals() {
  const positions = Object.fromEntries(PLACES.map((place) => [place.key, 0]));
  Object.values(PRIZE_DISTRIBUTION).forEach((distribution) => {
    PLACES.forEach((place) => {
      positions[place.key] += distribution[place.key];
    });
  });

  return {
    positions,
    grandTotal: Object.values(positions).reduce((sum, amount) => sum + amount, 0),
  };
}

// Draw rule (standard sports ranking): when N teams tie for a place, they
// take that place and the next N-1 places. Those prizes are added together
// and split evenly between the tied teams, and the places they took get no
// winner. Example: 2 teams tie for 1st, they share 1st + 2nd prize money,
// 2nd place is skipped, and the next team is 3rd.
//
// `teamsByPlace` is { first: [...], second: [...], ... }. Returns one entry
// per place, in PLACES order:
//   { key, teams, blockedBy, pool, share }
// blockedBy is the key of the tied place that took this place, or null.
// Teams entered for a blocked place are ignored.
export function resolvePlaces(eventId, teamsByPlace) {
  const distribution = PRIZE_DISTRIBUTION[eventId];
  const resolved = PLACES.map(({ key }) => ({ key, teams: [], blockedBy: null, pool: 0, share: 0 }));

  for (let i = 0; i < PLACES.length; ) {
    const teams = [...new Set((teamsByPlace[PLACES[i].key] || []).map(normalizeTeamName))];
    const span = Math.max(1, Math.min(teams.length, PLACES.length - i));
    let pool = 0;
    for (let j = i; j < i + span; j++) {
      pool += distribution[PLACES[j].key];
      if (j > i) resolved[j].blockedBy = PLACES[i].key;
    }
    Object.assign(resolved[i], {
      teams,
      pool,
      share: teams.length ? Math.floor(pool / teams.length) : 0,
    });
    i += span;
  }
  return resolved;
}

// Pulls { first: [...teams], ... } out of a saved Firestore result doc.
export function teamsByPlaceFromResult(result = {}) {
  return Object.fromEntries(
    PLACES.map(({ key }) => [key, Array.isArray(result[key]?.teams) ? result[key].teams : []])
  );
}

export function calculateTeamPrizeTotals(resultsById) {
  const totals = Object.fromEntries(TEAMS.map((team) => [team, 0]));

  EVENTS.forEach((event) => {
    const resolved = resolvePlaces(event.id, teamsByPlaceFromResult(resultsById[event.id]));
    resolved.forEach(({ teams, share }) => {
      teams.forEach((team) => {
        if (totals[team] !== undefined) totals[team] += share;
      });
    });
  });

  return totals;
}

// ---------- Seating / standing plans ----------
// Each plan is a PDF pushed ahead of time to static/arrangements/ under the
// file name below. The schedule page keeps it hidden until `opensAt`:
// by default 1 hour before the event's reporting time. The admin "Plans" tab
// can override that time per plan (stored in Firestore settings/plans), so
// timings can change without a code push.
export const PLAN_LEAD_MS = 60 * 60 * 1000;

export const PLANS = [
  { id: "day1-seating", panel: "awardsSeating", event: "Game Night (Day 1)", kind: "Seating plan", reportingAt: "2026-11-28T16:30:00+05:30" },
  { id: "day2-standing", panel: "photoStand", event: "Photoshoot (Day 2)", kind: "Standing positions", reportingAt: "2026-11-29T06:30:00+05:30" },
  { id: "day2-seating", panel: "awardsSeatingDay2", event: "Awards Night (Day 2)", kind: "Seating plan", reportingAt: "2026-11-29T16:30:00+05:30" },
  { id: "day3-seating", panel: "galaSeating", event: "Gala Night (Day 3)", kind: "Seating plan", reportingAt: "2026-11-30T17:00:00+05:30" },
].map((plan) => ({ ...plan, file: `static/arrangements/${plan.id}.pdf` }));

export const defaultPlanOpensAt = (plan) => new Date(plan.reportingAt).getTime() - PLAN_LEAD_MS;

// overrides: the settings/plans doc data, { "<plan id>": Timestamp }.
export function planOpensAt(plan, overrides = {}) {
  return overrides[plan.id]?.toMillis?.() ?? defaultPlanOpensAt(plan);
}

// "3:30 PM, Sat 28 Nov" in venue time, whatever the phone's timezone.
export function formatPlanTime(ms) {
  const d = new Date(ms);
  const time = d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
  const day = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });
  return `${time.toUpperCase()}, ${day}`;
}
