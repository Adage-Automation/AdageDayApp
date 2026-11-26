// Seating / standing plans on schedule.html. Each plan's PDF (see PLANS in
// adage-data.js) stays hidden until its opening time, then a button opens it.
// Opening times come from Firestore settings/plans (set on the admin "Plans"
// tab), falling back to 1 hour before reporting, and update live.
import { db } from "./firebase-init.js";
import { PLANS, planOpensAt, formatPlanTime } from "./adage-data.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let overrides = {};
let timer = 0;
// Whether each PDF exists, checked once per page load after it opens. A GET
// (not HEAD) so the service worker keeps a copy for weak signal at the venue.
const fileOk = {};

function checkFile(plan) {
  if (!(plan.id in fileOk)) {
    fileOk[plan.id] = fetch(plan.file, { cache: "no-cache" })
      .then((res) => res.ok && (res.headers.get("content-type") || "").includes("pdf"))
      .catch(() => false);
  }
  return fileOk[plan.id];
}

function emptyState(panel, icon, title, text) {
  panel.innerHTML = `
    <div class="empty">
      <div class="orb${panel.closest(".event--gold") ? " orb-gold" : ""}"><span class="material-icons-round">${icon}</span></div>
      <p class="empty-title">${title}</p>
      <p class="empty-text">${text}</p>
    </div>`;
}

async function renderPlan(plan, now) {
  const panel = document.getElementById(plan.panel);
  if (!panel) return;
  const opensAt = planOpensAt(plan, overrides);

  if (now < opensAt) {
    emptyState(panel, "lock_clock", `${plan.kind} opens at ${formatPlanTime(opensAt)}`,
      `It will appear here 1 hour before the event. Watch <a href="announcements.html">Announcements</a> for updates.`);
    return;
  }

  const ok = await checkFile(plan);
  // Opening time may have moved while the check ran; the next render wins.
  if (planOpensAt(plan, overrides) > Date.now()) return;
  if (!ok) {
    emptyState(panel, plan.kind.startsWith("Standing") ? "groups" : "event_seat", `${plan.kind} will be shared soon`,
      `Watch <a href="announcements.html">Announcements</a> for the update.`);
    return;
  }
  emptyState(panel, "picture_as_pdf", `${plan.kind} is ready`,
    `<a href="${plan.file}" target="_blank" rel="noopener" class="btn-ghost plan-open">
       <span class="material-icons-round">open_in_new</span>View ${plan.kind.toLowerCase()}
     </a>`);
}

function renderAll() {
  clearTimeout(timer);
  const now = Date.now();
  PLANS.forEach((plan) => renderPlan(plan, now));
  // Re-render exactly when the next plan opens (if the page stays open).
  const next = Math.min(...PLANS.map((p) => planOpensAt(p, overrides)).filter((t) => t > now));
  if (Number.isFinite(next)) timer = setTimeout(renderAll, Math.min(next - now + 500, 2 ** 31 - 1));
}

renderAll();
// Phones pause timers while asleep: re-check when the app comes back.
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && renderAll());
onSnapshot(
  doc(db, "settings", "plans"),
  (snap) => {
    overrides = snap.exists() ? snap.data() : {};
    renderAll();
  },
  () => {} // unreadable settings: default times still apply
);
