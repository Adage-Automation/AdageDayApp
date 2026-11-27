// Admin "Plans" tab: upload each seating / standing plan PDF (from a phone
// too, no code push; see plan-files.js) and set when it opens on the schedule
// page. Time overrides live in Firestore settings/plans as
// { "<plan id>": Timestamp }; a plan with no override opens 1 hour before
// reporting (see PLANS in adage-data.js, read by static/js/plans.js).
import { db } from "./firebase-init.js";
import { PLANS, planOpensAt, defaultPlanOpensAt, formatPlanTime } from "./adage-data.js";
import { uploadPlanPdf, removePlanPdf, loadPlanPdf, formatSize } from "./plan-files.js";
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

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Uploads in progress, so a re-render (snapshot) doesn't lose the progress line.
const uploading = new Set();

async function fileStatus(plan, el) {
  const meta = overrides.files?.[plan.id];
  if (meta?.version) {
    const when = meta.uploadedAt?.toMillis ? `, ${formatPlanTime(meta.uploadedAt.toMillis())}` : "";
    el.innerHTML = `<span class="text-green-600">Uploaded ✓</span> ${escapeHtml(meta.name || "PDF")} (${formatSize(meta.size)}${when})`;
    return;
  }
  try {
    const res = await fetch(plan.file, { method: "HEAD", cache: "no-store" });
    const isPdf = res.ok && (res.headers.get("content-type") || "").includes("pdf");
    el.innerHTML = isPdf
      ? `<span class="text-amber-600">Using the pushed file <code>${plan.file}</code></span> (upload one below to replace it)`
      : `<span class="text-red-400">No PDF uploaded yet</span>`;
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
    const uploaded = !!overrides.files?.[plan.id]?.version;
    return `
      <div class="card space-y-2" data-plan="${plan.id}">
        <div>
          <p class="text-base font-semibold text-[#008B94]">${plan.event}: ${plan.kind}</p>
          <p class="text-sm text-gray-500 file-status">Checking…</p>
        </div>
        <label class="field-label" for="f-${plan.id}">${uploaded ? "Replace PDF" : "Upload PDF"}</label>
        <input type="file" id="f-${plan.id}" class="plan-file" accept="application/pdf,.pdf" />
        <div class="flex items-center gap-3 flex-wrap">
          <button type="button" class="primary plan-upload">${uploaded ? "Upload replacement" : "Upload"}</button>
          ${uploaded ? `<button type="button" class="ghost plan-preview">Preview</button><button type="button" class="ghost plan-remove">Remove upload</button>` : ""}
          <span class="text-sm upload-status" role="status"></span>
        </div>
        <p class="text-sm plan-state">${stateHtml(plan)}</p>
        <label class="field-label" for="t-${plan.id}">Opens at (India time)</label>
        <input type="datetime-local" id="t-${plan.id}" class="plan-time" value="${toInputValue(opensAt)}" />
        <p class="field-hint">Default: ${formatPlanTime(defaultPlanOpensAt(plan))} (1 hour before reporting)</p>
        <div class="flex items-center gap-3 flex-wrap">
          <button type="button" class="primary plan-save">Save time</button>
          ${custom ? `<button type="button" class="ghost plan-reset">Reset to default</button>` : ""}
          <span class="text-sm plan-status" role="status"></span>
        </div>
      </div>`;
  }).join("");
  PLANS.forEach((plan) => {
    const card = list.querySelector(`[data-plan="${plan.id}"]`);
    fileStatus(plan, card.querySelector(".file-status"));
    if (uploading.has(plan.id)) {
      card.querySelectorAll(".plan-upload, .plan-preview, .plan-remove").forEach((b) => (b.disabled = true));
      card.querySelector(".upload-status").textContent = "Uploading…";
    }
  });
}

const uploadStatusEl = (plan) => list.querySelector(`[data-plan="${plan.id}"] .upload-status`);

async function upload(plan, card) {
  const file = card.querySelector(".plan-file").files[0];
  if (!file) return setStatus(card.querySelector(".upload-status"), "Choose a PDF first.", false);
  const meta = overrides.files?.[plan.id];
  if (meta?.version && !confirm(`Replace the uploaded ${plan.kind.toLowerCase()} for ${plan.event}?`)) return;
  uploading.add(plan.id);
  card.querySelectorAll("button").forEach((b) => (b.disabled = true));
  try {
    await uploadPlanPdf(plan.id, file, meta, (done, total) => {
      // Look the card up again: a snapshot may have re-rendered the list.
      const el = uploadStatusEl(plan);
      if (el) setStatus(el, `Uploading… ${Math.round((done / total) * 100)}%`, true);
    });
    uploading.delete(plan.id);
    render();
    setStatus(uploadStatusEl(plan), "Uploaded. It shows on the Schedule page at the opening time.", true);
  } catch (err) {
    console.error("Plan upload failed", err);
    uploading.delete(plan.id);
    render();
    setStatus(uploadStatusEl(plan), `Upload failed. ${failReason(err)}`, false);
  }
}

async function remove(plan, card) {
  const meta = overrides.files?.[plan.id];
  if (!meta || !confirm(`Remove the uploaded ${plan.kind.toLowerCase()} for ${plan.event}?`)) return;
  card.querySelectorAll("button").forEach((b) => (b.disabled = true));
  try {
    await removePlanPdf(plan.id, meta);
    // The snapshot listener re-renders the card without the upload.
  } catch (err) {
    console.error("Plan remove failed", err);
    setStatus(card.querySelector(".upload-status"), `Remove failed. ${failReason(err)}`, false);
    card.querySelectorAll("button").forEach((b) => (b.disabled = false));
  }
}

// Downloads the uploaded PDF, then turns the button into a link (browsers
// block opening a new tab after a wait, so the second tap opens it).
async function preview(plan, button) {
  const meta = overrides.files?.[plan.id];
  if (!meta) return;
  button.disabled = true;
  button.textContent = "Loading…";
  try {
    const url = await loadPlanPdf(plan.id, meta);
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.className = "text-sm font-semibold text-[#008B94] underline";
    link.textContent = "Open PDF";
    button.replaceWith(link);
  } catch (err) {
    console.error("Plan preview failed", err);
    button.disabled = false;
    button.textContent = "Preview";
    setStatus(button.closest("[data-plan]").querySelector(".upload-status"), `Couldn't load it. ${failReason(err)}`, false);
  }
}

function failReason(err) {
  return err?.code === "permission-denied"
    ? "Firebase blocked it. Check you are signed in and the settings rule is published (Firestore → Rules)."
    : err?.code === "unavailable"
      ? "No connection. Check your internet and try again."
      : err?.code
        ? `Error: ${err.code}`
        : err?.message || String(err);
}

async function save(planId, value, card) {
  const status = card.querySelector(".plan-status");
  const buttons = card.querySelectorAll("button");
  buttons.forEach((b) => (b.disabled = true));
  try {
    await setDoc(settingsRef, { [planId]: value }, { merge: true });
    // The snapshot listener re-renders the list with the new time.
  } catch (err) {
    console.error("Plans save failed", err);
    setStatus(status, `Save failed. ${failReason(err)}`, false);
    buttons.forEach((b) => (b.disabled = false));
  }
}

list.addEventListener("click", (e) => {
  const card = e.target.closest("[data-plan]");
  if (!card) return;
  const planId = card.dataset.plan;
  const plan = PLANS.find((p) => p.id === planId);
  if (e.target.closest(".plan-upload")) {
    upload(plan, card);
  } else if (e.target.closest(".plan-preview")) {
    preview(plan, e.target.closest(".plan-preview"));
  } else if (e.target.closest(".plan-remove")) {
    remove(plan, card);
  } else if (e.target.closest(".plan-save")) {
    const ms = fromInputValue(card.querySelector(".plan-time").value);
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
