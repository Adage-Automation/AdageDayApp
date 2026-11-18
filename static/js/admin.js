import { db, auth } from "./firebase-init.js";
import {
  TEAMS,
  TEAM_COLORS,
  normalizeTeamName,
  PLACES,
  EVENTS,
  PRIZE_DISTRIBUTION,
  getPrizeTotals,
} from "./adage-data.js";
import { announcementCardHtml } from "./announcements-feed.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const formatCurrency = (amount) => amount.toLocaleString("en-IN");

const loginSection = document.getElementById("loginSection");
const adminSection = document.getElementById("adminSection");
const signOutBtn = document.getElementById("signOutBtn");
const loginError = document.getElementById("loginError");
const signInBtn = document.getElementById("signInBtn");

// Shows a status message next to a button; success messages clear themselves.
function setStatus(el, text, ok) {
  el.textContent = text;
  el.classList.toggle("text-green-500", ok);
  el.classList.toggle("text-red-400", !ok);
  clearTimeout(el._timer);
  if (ok) el._timer = setTimeout(() => (el.textContent = ""), 2500);
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  signInBtn.disabled = true;
  signInBtn.textContent = "Signing in…";
  try {
    await signInWithEmailAndPassword(
      auth,
      document.getElementById("email").value.trim(),
      document.getElementById("password").value
    );
  } catch (err) {
    loginError.textContent =
      err.code === "auth/network-request-failed"
        ? "No connection. Check your internet and try again."
        : "Sign-in failed: check email/password.";
  } finally {
    signInBtn.disabled = false;
    signInBtn.textContent = "Sign In";
  }
});

signOutBtn.addEventListener("click", () => {
  if (hasUnsaved() && !confirm("You have unsaved score changes. Sign out anyway?")) return;
  signOut(auth);
});

let unsubscribeAnnouncements = null;

onAuthStateChanged(auth, (user) => {
  loginSection.classList.toggle("hidden", !!user);
  adminSection.classList.toggle("hidden", !user);
  signOutBtn.classList.toggle("hidden", !user);
  if (user) {
    buildForms();
    unsubscribeAnnouncements = watchAnnouncements();
  } else if (unsubscribeAnnouncements) {
    unsubscribeAnnouncements();
    unsubscribeAnnouncements = null;
  }
});

// ---------- Scores ----------

function placeRowHtml(eventId, place, saved) {
  const savedTeams = (saved?.teams || []).map(normalizeTeamName);
  const prizeAmount = PRIZE_DISTRIBUTION[eventId][place.key];
  const teamCheckboxes = TEAMS.map((team) => {
    const checked = savedTeams.includes(team);
    return `
      <label class="team-chip mr-2 mb-2${checked ? " selected" : ""}">
        <input type="checkbox" value="${team}" data-event="${eventId}" data-place="${place.key}" class="team-check"
          ${checked ? "checked" : ""} />
        <span class="team-color-dot" style="background-color:${TEAM_COLORS[team]}" aria-hidden="true"></span>
        ${team}
      </label>`;
  }).join("");

  return `
    <div class="place-row">
      <p class="text-sm font-semibold text-gray-600 mb-2">${place.label}</p>
      <div class="flex flex-wrap mb-1">${teamCheckboxes}</div>
      <p class="text-xs text-gray-500">Prize money: <strong class="text-gray-700">₹${formatCurrency(prizeAmount)}</strong></p>
    </div>`;
}

// One-line summary under each collapsed event name, e.g. "1st Zeus, 2nd Thor + Ares".
function eventStatus(eventId) {
  const card = document.querySelector(`[data-event-card="${eventId}"]`);
  const parts = PLACES.map((place) => {
    const teams = [...card.querySelectorAll(`.team-check[data-place="${place.key}"]:checked`)].map((el) => el.value);
    return teams.length ? `${place.shortLabel} ${teams.join(" + ")}` : "";
  }).filter(Boolean);
  const status = card.querySelector(".event-status");
  status.textContent = parts.length ? parts.join(", ") : "No results entered";
  status.classList.toggle("done", parts.length > 0);
}

const eventFormsContainer = document.getElementById("eventForms");

function renderPrizePoolSummary() {
  const { positions, grandTotal } = getPrizeTotals();
  document.getElementById("prizePoolSummary").innerHTML = `
    <h3 class="text-sm font-semibold text-[#008B94] mb-3">Prize Pool Summary</h3>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
      ${PLACES.map((place) => `
        <p>${place.shortLabel} place: <strong>₹${formatCurrency(positions[place.key])}</strong></p>
      `).join("")}
    </div>
    <p class="text-sm font-semibold text-[#008B94] mt-3">
      Grand Total: ₹${formatCurrency(grandTotal)}
    </p>`;
}

renderPrizePoolSummary();

async function buildForms() {
  eventFormsContainer.innerHTML = "<p class='text-center text-gray-400 text-sm'>Loading…</p>";

  try {
    const cards = await Promise.all(
      EVENTS.map(async (event) => {
        const snap = await getDoc(doc(db, "results", event.id));
        const data = snap.exists() ? snap.data() : {};
        const rows = PLACES.map((p) => placeRowHtml(event.id, p, data[p.key])).join("");
        return `
          <details class="card" data-event-card="${event.id}">
            <summary>
              <span class="min-w-0">
                <span class="block text-base font-semibold text-[#008B94]">${event.name}</span>
                <span class="event-status block"></span>
              </span>
            </summary>
            ${rows}
            <div class="flex items-center gap-3 mt-2 flex-wrap">
              <button class="primary save-btn" data-event="${event.id}">Save</button>
              <span class="unsaved-dot hidden" data-event="${event.id}">Unsaved changes</span>
              <span class="text-sm save-status" role="status" data-event="${event.id}"></span>
            </div>
          </details>`;
      })
    );
    eventFormsContainer.innerHTML = cards.join("");
  } catch (err) {
    eventFormsContainer.innerHTML = `
      <div class="card text-center text-sm">
        <p class="text-red-400 mb-3">Couldn't load saved results. Check your connection.</p>
        <button class="primary" id="retryLoadBtn">Try again</button>
      </div>`;
    document.getElementById("retryLoadBtn").addEventListener("click", buildForms);
    return;
  }

  EVENTS.forEach((event) => eventStatus(event.id));
  eventFormsContainer.querySelectorAll(".save-btn").forEach((btn) =>
    btn.addEventListener("click", () => saveEvent(btn.dataset.event))
  );
}

// A team can only hold one place per event; selecting a different place clears the prior one.
// Also marks the card "unsaved" so it's obvious a Save is still needed.
// Attached once (not inside buildForms) since #eventForms itself is never recreated,
// only its contents; re-attaching on every sign-in would stack duplicate listeners.
eventFormsContainer.addEventListener("change", (e) => {
  const checkbox = e.target.closest(".team-check");
  if (!checkbox) return;
  checkbox.closest("label").classList.toggle("selected", checkbox.checked);

  if (checkbox.checked) {
    const eventId = checkbox.dataset.event;
    const team = checkbox.value;
    eventFormsContainer
      .querySelectorAll(`.team-check[data-event="${eventId}"][value="${team}"]`)
      .forEach((other) => {
        if (other !== checkbox && other.checked) {
          other.checked = false;
          other.closest("label").classList.remove("selected");
        }
      });
  }

  const eventId = checkbox.closest("[data-event-card]").dataset.eventCard;
  document.querySelector(`.unsaved-dot[data-event="${eventId}"]`).classList.remove("hidden");
  eventStatus(eventId);
});

const hasUnsaved = () => !!document.querySelector(".unsaved-dot:not(.hidden)");

// Closing or refreshing the tab with unsaved scores asks first.
window.addEventListener("beforeunload", (e) => {
  if (hasUnsaved()) e.preventDefault();
});

async function saveEvent(eventId) {
  const card = document.querySelector(`[data-event-card="${eventId}"]`);
  const eventPrizes = PRIZE_DISTRIBUTION[eventId];
  const btn = card.querySelector(".save-btn");
  const status = card.querySelector(".save-status");
  const result = {};

  PLACES.forEach((place) => {
    const teams = Array.from(
      card.querySelectorAll(`.team-check[data-place="${place.key}"]:checked`)
    ).map((el) => el.value);
    result[place.key] = { teams, money: eventPrizes[place.key] };
  });

  btn.disabled = true;
  btn.textContent = "Saving…";
  try {
    await setDoc(doc(db, "results", eventId), result, { merge: true });
    card.querySelector(".unsaved-dot").classList.add("hidden");
    setStatus(status, "Saved ✓ Live for everyone", true);
  } catch (err) {
    setStatus(status, "Save failed: check your connection and try again.", false);
  } finally {
    btn.disabled = false;
    btn.textContent = "Save";
  }
}

// ---------- Announcements ----------

const annForm = document.getElementById("annForm");
const annTitle = document.getElementById("annTitle");
const annBody = document.getElementById("annBody");
const annCategory = document.getElementById("annCategory");
const annStatus = document.getElementById("announcementStatus");
const postBtn = document.getElementById("postAnnouncementBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
let editingId = null;

function updatePreview() {
  document.getElementById("annBodyCount").textContent = `${annBody.value.length} / 500`;
  document.getElementById("annPreview").innerHTML = announcementCardHtml({
    title: annTitle.value.trim() || "Title",
    body: annBody.value.trim() || "Message",
    category: annCategory.value,
  });
}

[annTitle, annBody, annCategory].forEach((el) =>
  el.addEventListener("input", () => {
    updatePreview();
    if (annStatus.classList.contains("text-red-400")) annStatus.textContent = "";
  })
);
updatePreview();

function resetForm() {
  editingId = null;
  annForm.reset();
  document.getElementById("annFormTitle").textContent = "New announcement";
  postBtn.textContent = "Post";
  cancelEditBtn.classList.add("hidden");
  updatePreview();
}

cancelEditBtn.addEventListener("click", resetForm);

function startEdit(id, data) {
  editingId = id;
  annTitle.value = data.title || "";
  annBody.value = data.body || "";
  annCategory.value = data.category || "general";
  document.getElementById("annFormTitle").textContent = "Edit announcement";
  postBtn.textContent = "Update";
  cancelEditBtn.classList.remove("hidden");
  annStatus.textContent = "";
  updatePreview();
  annForm.scrollIntoView({ behavior: "smooth", block: "start" });
  annTitle.focus({ preventScroll: true });
}

annForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = annTitle.value.trim();
  const body = annBody.value.trim();
  if (!title || !body) {
    setStatus(annStatus, "Title and message are required.", false);
    (title ? annBody : annTitle).focus();
    return;
  }

  const confirmText = editingId
    ? "Update this announcement for everyone?"
    : "Post this announcement? Everyone with the app open will get an alert.";
  if (!confirm(confirmText)) return;

  postBtn.disabled = true;
  try {
    if (editingId) {
      // createdAt is kept, so the post stays in place and doesn't re-alert people.
      await updateDoc(doc(db, "announcements", editingId), { title, body, category: annCategory.value });
    } else {
      await addDoc(collection(db, "announcements"), {
        title,
        body,
        category: annCategory.value,
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    setStatus(annStatus, `${editingId ? "Update" : "Post"} failed: check your connection and try again.`, false);
    postBtn.disabled = false;
    return;
  }

  const done = editingId ? "Updated ✓" : "Posted ✓";
  postBtn.disabled = false;
  resetForm();
  setStatus(annStatus, done, true);
});

function watchAnnouncements() {
  const list = document.getElementById("announcementsAdminList");
  const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        list.innerHTML = "<p class='text-sm text-gray-400 italic'>No announcements posted yet.</p>";
        return;
      }

      list.innerHTML =
        `<h3 class="text-base font-semibold text-[#008B94] mb-2">Posted (${snapshot.size})</h3>` +
        snapshot.docs
          .map(
            (docSnap) => `
        <div class="ann-item" data-id="${docSnap.id}">
          <div class="flex-1 min-w-0">${announcementCardHtml(docSnap.data())}</div>
          <div class="flex flex-col items-end">
            <button class="link edit-ann-btn" data-id="${docSnap.id}">Edit</button>
            <button class="danger delete-ann-btn" data-id="${docSnap.id}">Delete</button>
          </div>
        </div>`
          )
          .join("");

      const byId = Object.fromEntries(snapshot.docs.map((d) => [d.id, d.data()]));
      list.querySelectorAll(".edit-ann-btn").forEach((btn) =>
        btn.addEventListener("click", () => startEdit(btn.dataset.id, byId[btn.dataset.id]))
      );
      list.querySelectorAll(".delete-ann-btn").forEach((btn) =>
        btn.addEventListener("click", async () => {
          const title = byId[btn.dataset.id].title;
          if (!confirm(`Delete "${title}"? This can't be undone.`)) return;
          try {
            await deleteDoc(doc(db, "announcements", btn.dataset.id));
            if (editingId === btn.dataset.id) resetForm();
          } catch (err) {
            alert("Delete failed: check your connection and try again.");
          }
        })
      );
    },
    () => {
      list.innerHTML = "<p class='text-sm text-red-400'>Couldn't load announcements. Check your connection and refresh.</p>";
    }
  );
}
