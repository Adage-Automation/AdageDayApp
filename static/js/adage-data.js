// Shared constants used by both live_status.html (public display) and admin.html (score entry).
// Keep this as the single source of truth for team/event names so the two pages never drift apart.

export const TEAMS = ["Red Bull", "Alpine", "Aston Martin", "Mercedes", "Ferrari", "McLaren"];

// Real F1 livery colors — a small branding touch tying the team names back to their namesakes
// wherever a team shows up on the public results pages.
export const TEAM_COLORS = {
  "Red Bull": "#1E3A8A",
  "Alpine": "#0090FF",
  "Aston Martin": "#006F62",
  "Mercedes": "#00D2BE",
  "Ferrari": "#DC0000",
  "McLaren": "#FF8000",
};

export const EVENTS = [
  { id: "1km", name: "1 KM Race" },
  { id: "100m", name: "100 MTR Race" },
  { id: "football", name: "Football" },
  { id: "futsal", name: "Futsal" },
  { id: "gtm", name: "GTM" },
  { id: "treasureHunt", name: "Treasure Hunt" },
];
