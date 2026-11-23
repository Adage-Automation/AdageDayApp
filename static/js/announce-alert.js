// In-app alerts, shown on every open page as a toast:
//   1. A new announcement is posted -> "New announcement", links to announcements.html.
//   2. An event's results are saved -> "Results updated", links to live_status.html.
// What each phone has already seen is remembered in localStorage.
// ponytail: only works while the app is open; phone push needs Firebase Cloud Messaging.
import { db } from "./firebase-init.js";
import { escapeHtml } from "./announcements-feed.js";
import { EVENTS, PLACES, resolvePlaces, teamsByPlaceFromResult } from "./adage-data.js";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const page = location.pathname;
const get = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const set = (key, value) => { try { localStorage.setItem(key, value); } catch {} };

// One toast slot: a newer alert replaces an older one. A replaced alert
// wasn't marked seen, so it comes back on the next page load.
let toast;

function show({ icon, label, title, href, onSeen }) {
  toast?.remove();
  toast = document.createElement("div");
  toast.className = "ann-toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <a href="${href}" class="ann-toast-link">
      <span class="material-icons" aria-hidden="true">${icon}</span>
      <span class="ann-toast-text">
        <span class="ann-toast-label">${label}</span>
        <span class="ann-toast-title">${escapeHtml(title)}</span>
      </span>
    </a>
    <button type="button" class="ann-toast-close" aria-label="Dismiss">
      <span class="material-icons" aria-hidden="true">close</span>
    </button>`;
  const el = toast;
  // A tap anywhere on the toast opens the page; only the ✕ dismisses.
  el.style.cursor = "pointer";
  el.addEventListener("click", (e) => {
    onSeen();
    if (e.target.closest(".ann-toast-close")) return el.remove();
    if (!e.target.closest("a")) location.href = href; // the thin edge outside the link
  });
  document.body.appendChild(el);
}

// ---------- 1. Announcements ----------
const ANN_KEY = "annSeen";
const onAnnouncementsPage = page.endsWith("announcements.html");

onSnapshot(
  query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(1)),
  (snapshot) => {
    const latest = snapshot.docs[0];
    if (!latest) return set(ANN_KEY, "none");
    const seen = get(ANN_KEY);
    // Reading the full list, or a first-ever visit, counts as seen: no toast
    // for news the user is already looking at or that predates them.
    if (onAnnouncementsPage || seen === null) return set(ANN_KEY, latest.id);
    if (latest.id !== seen) {
      show({
        icon: "campaign",
        label: "New announcement",
        title: latest.data().title,
        href: "announcements.html",
        onSeen: () => set(ANN_KEY, latest.id),
      });
    }
  },
  () => {}
);

// ---------- 2. Results ----------
// Remembers the time of the newest results save this phone has seen.
const RES_KEY = "resSeen";
const onResultsPage = page.endsWith("live_status.html");
const eventNames = Object.fromEntries(EVENTS.map((e) => [e.id, e.name]));

// "1st Zeus + Thor (tie), 3rd Ares"
function winnersLine(eventId, data) {
  return resolvePlaces(eventId, teamsByPlaceFromResult(data))
    .map(({ teams }, i) => {
      if (!teams.length) return "";
      return `${PLACES[i].shortLabel} ${teams.join(" + ")}${teams.length > 1 ? " (tie)" : ""}`;
    })
    .filter(Boolean)
    .join(", ");
}

onSnapshot(
  collection(db, "results"),
  (snapshot) => {
    // Newest save across all events. Saves made before this feature have no
    // updatedAt and never alert.
    let newest = null;
    snapshot.forEach((doc) => {
      const time = doc.data().updatedAt?.toMillis?.();
      if (time && (!newest || time > newest.time)) newest = { id: doc.id, data: doc.data(), time };
    });
    if (!newest) return;

    const seen = Number(get(RES_KEY));
    const markSeen = () => set(RES_KEY, String(newest.time));
    // Looking at live scores, or a first-ever visit, counts as seen.
    if (onResultsPage || !seen) return markSeen();
    if (newest.time <= seen) return;

    const winners = winnersLine(newest.id, newest.data);
    if (!winners) return markSeen(); // a result was cleared: nothing to announce
    show({
      icon: "emoji_events",
      label: "Results updated",
      title: `${eventNames[newest.id] || newest.id}: ${winners}`,
      href: "live_status.html",
      onSeen: markSeen,
    });
  },
  () => {}
);
