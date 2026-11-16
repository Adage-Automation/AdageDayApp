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

export function calculateTeamPrizeTotals(resultsById) {
  const totals = Object.fromEntries(TEAMS.map((team) => [team, 0]));

  EVENTS.forEach((event) => {
    const result = resultsById[event.id] || {};
    const distribution = PRIZE_DISTRIBUTION[event.id];
    PLACES.forEach(({ key }) => {
      const place = result[key];
      if (!place || !Array.isArray(place.teams) || place.teams.length === 0) return;

      const teams = [...new Set(place.teams.map(normalizeTeamName))];
      const share = Math.floor(distribution[key] / teams.length);
      teams.forEach((team) => {
        if (totals[team] !== undefined) totals[team] += share;
      });
    });
  });

  return totals;
}
