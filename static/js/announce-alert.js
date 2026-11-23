// In-app alert: when a new announcement is posted, every open page shows a
// gold toast linking to announcements.html. The last announcement the user
// has seen is remembered per phone in localStorage.
// ponytail: only works while the app is open; phone push needs Firebase Cloud Messaging.
import { db } from "./firebase-init.js";
import { escapeHtml } from "./announcements-feed.js";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const KEY = "annSeen";
const onAnnouncementsPage = location.pathname.endsWith("announcements.html");
const getSeen = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const setSeen = (id) => { try { localStorage.setItem(KEY, id); } catch {} };

let toast;

function show(id, title) {
  toast?.remove();
  toast = document.createElement("div");
  toast.className = "ann-toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <a href="announcements.html" class="ann-toast-link">
      <span class="material-icons" aria-hidden="true">campaign</span>
      <span class="ann-toast-text">
        <span class="ann-toast-label">New announcement</span>
        <span class="ann-toast-title">${escapeHtml(title)}</span>
      </span>
    </a>
    <button type="button" class="ann-toast-close" aria-label="Dismiss">
      <span class="material-icons" aria-hidden="true">close</span>
    </button>`;
  // A tap anywhere on the toast opens announcements; only the ✕ dismisses.
  const el = toast;
  el.style.cursor = "pointer";
  el.addEventListener("click", (e) => {
    setSeen(id);
    if (e.target.closest(".ann-toast-close")) return el.remove();
    if (!e.target.closest("a")) location.href = "announcements.html"; // the thin edge outside the link
  });
  document.body.appendChild(toast);
}

onSnapshot(
  query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(1)),
  (snapshot) => {
    const latest = snapshot.docs[0];
    if (!latest) return setSeen("none");
    const seen = getSeen();
    // Reading the full list, or a first-ever visit, counts as seen: no toast
    // for news the user is already looking at or that predates them.
    if (onAnnouncementsPage || seen === null) return setSeen(latest.id);
    if (latest.id !== seen) show(latest.id, latest.data().title);
  },
  () => {}
);
