// Admin "Plans" tab: when each seating / standing plan PDF opens on the
// schedule page. Overrides live in Firestore settings/plans as
// { "<plan id>": Timestamp }; a plan with no override opens 1 hour before
// reporting (see PLANS in adage-data.js, read by static/js/plans.js).
import { db } from "./firebase-init.js";
import { PLANS, planOpensAt, defaultPlanOpensAt, formatPlanTime } from "./adage-data.js";
import {
  doc,
  setDoc,
  onSnapshot,
  deleteField,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const settingsRef = doc(db, "settings", "plans");
const list = document.getElementById("plansList");
const IST_MS = 5.5 * 60 * 60 * 1000;
let overrides = {};

// <input type="datetime-local"> works in the laptop's own timezone; convert
// explicitly so times always mean India time.
const toInputValue = (ms) => new Date(ms + IST_MS).toISOString().slice(0, 16);
const fromInputValue = (value) => (value ? new Date(`${value}:00+05:30`).getTime() : NaN);

function setStatus(el, text, ok) {
  el.textContent = text;
  el.className = `text-sm plan-status ${ok ? "text-green-500" : "text-red-400"}`;
}

async function fileStatus(plan, el) {
  try {
    const res = await fetch(plan.file, { method: "HEAD", cache: "no-store" });
    const isPdf = res.ok && (res.headers.get("content-type") || "").includes("pdf");
    el.innerHTML = isPdf
      ? `<span class="text-green-600">PDF uploaded ✓</span>`
      : `<span class="text-red-400">PDF not uploaded yet</span>`;
  } catch {
    el.textContent = "Couldn't check the PDF (offline?)";
  }
}

function stateHtml(plan) {
  const opensAt = planOpensAt(plan, overrides);
  const state = Date.now() >= opensAt ? `<strong class="text-green-600">Visible now</strong>` : `Opens ${formatPlanTime(opensAt)}`;
  return `${state}${overrides[plan.id] ? ` <span class="text-xs text-amber-600">(custom time)</span>` : ""}`;
}

function render() {
  list.innerHTML = PLANS.map((plan) => {
    const opensAt = planOpensAt(plan, overrides);
    const custom = !!overrides[plan.id];
    return `
      <div class="card space-y-2" data-plan="${plan.id}">
        <div>
          <p class="text-base font-semibold text-[#008B94]">${plan.event}: ${plan.kind}</p>
          <p class="text-xs text-gray-500">File: <code>${plan.file}</code> · <span class="file-status">Checking…</span></p>
        </div>
        <p class="text-sm plan-state">${stateHtml(plan)}</p>
        <label class="field-label" for="t-${plan.id}">Opens at (India time)</label>
        <input type="datetime-local" id="t-${plan.id}" value="${toInputValue(opensAt)}" />
        <p class="field-hint">Default: ${formatPlanTime(defaultPlanOpensAt(plan))} (1 hour before reporting)</p>
        <div class="flex items-center gap-3 flex-wrap">
          <button type="button" class="primary plan-save">Save time</button>
          ${custom ? `<button type="button" class="ghost plan-reset">Reset to default</button>` : ""}
          <span class="text-sm plan-status" role="status"></span>
        </div>
      </div>`;
  }).join("");
  PLANS.forEach((plan) => fileStatus(plan, list.querySelector(`[data-plan="${plan.id}"] .file-status`)));
}

async function save(planId, value, card) {
  const status = card.querySelector(".plan-status");
  const buttons = card.querySelectorAll("button");
  buttons.forEach((b) => (b.disabled = true));
  try {
    await setDoc(settingsRef, { [planId]: value }, { merge: true });
    // The snapshot listener re-renders the list with the new time.
  } catch (err) {
    setStatus(status, "Save failed: are you signed in, and are the Firestore rules published?", false);
    buttons.forEach((b) => (b.disabled = false));
  }
}

list.addEventListener("click", (e) => {
  const card = e.target.closest("[data-plan]");
  if (!card) return;
  const planId = card.dataset.plan;
  if (e.target.closest(".plan-save")) {
    const ms = fromInputValue(card.querySelector("input").value);
    if (Number.isNaN(ms)) return setStatus(card.querySelector(".plan-status"), "Pick a date and time first.", false);
    save(planId, Timestamp.fromMillis(ms), card);
  } else if (e.target.closest(".plan-reset")) {
    save(planId, deleteField(), card);
  }
});

render();
onSnapshot(
  settingsRef,
  (snap) => {
    overrides = snap.exists() ? snap.data() : {};
    render();
  },
  () => {}
);
// Keep "Opens …" / "Visible now" current while the tab is open, without
// touching the inputs (an admin may be mid-edit).
setInterval(() => {
  PLANS.forEach((plan) => {
    const el = list.querySelector(`[data-plan="${plan.id}"] .plan-state`);
    if (el) el.innerHTML = stateHtml(plan);
  });
}, 15 * 1000);
