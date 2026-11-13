import { db, auth } from "./firebase-init.js";
import { TEAMS, EVENTS } from "./adage-data.js";
import { escapeHtml } from "./announcements-feed.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const PLACES = [
  { key: "first", label: "🥇 1st Place" },
  { key: "second", label: "🥈 2nd Place" },
  { key: "third", label: "🥉 3rd Place" },
];

const loginSection = document.getElementById("loginSection");
const adminSection = document.getElementById("adminSection");
const signOutBtn = document.getElementById("signOutBtn");
const loginError = document.getElementById("loginError");
const signInBtn = document.getElementById("signInBtn");

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
    loginError.textContent = "Sign-in failed — check email/password.";
  } finally {
    signInBtn.disabled = false;
    signInBtn.textContent = "Sign In";
  }
});

signOutBtn.addEventListener("click", () => signOut(auth));

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

function placeRowHtml(eventId, place, saved) {
  const savedTeams = saved?.teams || [];
  const savedMoney = saved?.money ?? "";
  const teamCheckboxes = TEAMS.map((team) => {
    const checked = savedTeams.includes(team);
    return `
      <label class="team-chip mr-2 mb-2${checked ? " selected" : ""}">
        <input type="checkbox" value="${team}" data-event="${eventId}" data-place="${place.key}" class="team-check"
          ${checked ? "checked" : ""} />
        ${team}
      </label>`;
  }).join("");

  return `
    <div class="place-row">
      <p class="text-xs font-semibold text-gray-600 mb-1">${place.label}</p>
      <div class="flex flex-wrap mb-2">${teamCheckboxes}</div>
      <input type="number" min="0" placeholder="Prize money (₹)" value="${savedMoney}"
        data-event="${eventId}" data-place="${place.key}" class="money-input max-w-[160px]" />
    </div>`;
}

const eventFormsContainer = document.getElementById("eventForms");

async function buildForms() {
  eventFormsContainer.innerHTML = "<p class='text-center text-gray-400 text-sm'>Loading…</p>";

  const cards = await Promise.all(
    EVENTS.map(async (event) => {
      const snap = await getDoc(doc(db, "results", event.id));
      const data = snap.exists() ? snap.data() : {};
      const rows = PLACES.map((p) => placeRowHtml(event.id, p, data[p.key])).join("");
      return `
        <div class="card" data-event-card="${event.id}">
          <h3 class="text-base font-semibold text-[#008B94] mb-2">${event.name}</h3>
          ${rows}
          <div class="flex items-center gap-3 mt-2">
            <button class="primary save-btn" data-event="${event.id}">Save</button>
            <span class="unsaved-dot hidden" data-event="${event.id}">Unsaved changes</span>
            <span class="text-xs save-status" data-event="${event.id}"></span>
          </div>
        </div>`;
    })
  );

  eventFormsContainer.innerHTML = cards.join("");
  eventFormsContainer.querySelectorAll(".save-btn").forEach((btn) =>
    btn.addEventListener("click", () => saveEvent(btn.dataset.event))
  );
}

// A team can only hold one place per event — picking it for 2nd clears it from 1st/3rd.
// Also marks the card "unsaved" so it's obvious a Save is still needed.
// Attached once (not inside buildForms) since #eventForms itself is never recreated,
// only its contents — re-attaching on every sign-in would stack duplicate listeners.
eventFormsContainer.addEventListener("change", (e) => {
  const checkbox = e.target.closest(".team-check");
  if (checkbox) {
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
  }

  if (e.target.closest(".team-check") || e.target.closest(".money-input")) {
    markUnsaved(e.target.closest("[data-event-card]").dataset.eventCard);
  }
});

function markUnsaved(eventId) {
  const dot = document.querySelector(`.unsaved-dot[data-event="${eventId}"]`);
  if (dot) dot.classList.remove("hidden");
}

async function saveEvent(eventId) {
  const card = document.querySelector(`[data-event-card="${eventId}"]`);
  const result = {};

  PLACES.forEach((place) => {
    const teams = Array.from(
      card.querySelectorAll(`.team-check[data-place="${place.key}"]:checked`)
    ).map((el) => el.value);
    const moneyInput = card.querySelector(`.money-input[data-place="${place.key}"]`);
    const money = parseInt(moneyInput.value) || 0;
    result[place.key] = { teams, money };
  });

  const status = card.querySelector(".save-status");
  try {
    await setDoc(doc(db, "results", eventId), result, { merge: true });
    card.querySelector(".unsaved-dot").classList.add("hidden");
    status.classList.remove("text-red-500");
    status.classList.add("text-green-600");
    status.textContent = "Saved ✓";
  } catch (err) {
    status.classList.remove("text-green-600");
    status.classList.add("text-red-500");
    status.textContent = "Save failed — check your connection and try again.";
    return;
  }
  setTimeout(() => (status.textContent = ""), 2000);
}

const CATEGORY_PREVIEW = {
  important: "bg-red-100 text-red-600",
  reminder: "bg-yellow-100 text-yellow-600",
  general: "bg-teal-100 text-teal-600",
};

const annCategorySelect = document.getElementById("annCategory");
const annCategoryPreview = document.getElementById("annCategoryPreview");

function updateCategoryPreview() {
  const value = annCategorySelect.value;
  annCategoryPreview.className =
    "text-[10px] font-medium px-2 py-1 rounded-full whitespace-nowrap " + CATEGORY_PREVIEW[value];
  annCategoryPreview.textContent = value.charAt(0).toUpperCase() + value.slice(1);
}

annCategorySelect.addEventListener("change", updateCategoryPreview);
updateCategoryPreview();

document.getElementById("postAnnouncementBtn").addEventListener("click", async () => {
  const titleInput = document.getElementById("annTitle");
  const bodyInput = document.getElementById("annBody");
  const categorySelect = document.getElementById("annCategory");
  const status = document.getElementById("announcementStatus");

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (!title || !body) {
    status.textContent = "Title and message are required.";
    status.classList.add("text-red-500");
    return;
  }

  try {
    await addDoc(collection(db, "announcements"), {
      title,
      body,
      category: categorySelect.value,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    status.classList.add("text-red-500");
    status.textContent = "Post failed — check your connection and try again.";
    return;
  }

  titleInput.value = "";
  bodyInput.value = "";
  status.classList.remove("text-red-500");
  status.textContent = "Posted ✓";
  setTimeout(() => (status.textContent = ""), 2000);
});

function watchAnnouncements() {
  const list = document.getElementById("announcementsAdminList");
  const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      list.innerHTML = "<p class='text-xs text-gray-400 italic'>No announcements posted yet.</p>";
      return;
    }

    list.innerHTML = snapshot.docs
      .map(
        (docSnap) => `
      <div class="ann-item" data-id="${docSnap.id}">
        <div>
          <strong>${escapeHtml(docSnap.data().title)}</strong>
          <span class="text-gray-500"> — ${escapeHtml(docSnap.data().body)}</span>
        </div>
        <button class="danger delete-ann-btn" data-id="${docSnap.id}">Delete</button>
      </div>`
      )
      .join("");

    list.querySelectorAll(".delete-ann-btn").forEach((btn) =>
      btn.addEventListener("click", () => {
        if (confirm("Delete this announcement? This can't be undone.")) {
          deleteDoc(doc(db, "announcements", btn.dataset.id));
        }
      })
    );
  });
}
