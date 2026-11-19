import { db } from "./firebase-init.js";
import {
  collection,
  query,
  orderBy,
  limit as fsLimit,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CATEGORY_STYLES = {
  important: { variant: "is-red", tag: "red", label: "Important" },
  reminder: { variant: "is-gold", tag: "gold", label: "Reminder" },
  general: { variant: "", tag: "", label: "General" },
};

// Prevents a malicious/typo'd title or body from being interpreted as HTML when rendered.
export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function formatWhen(createdAt) {
  if (!createdAt || !createdAt.toDate) return "";
  return createdAt.toDate().toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// One announcement card, as the public pages show it (admin.html previews with it too).
export function announcementCardHtml(data) {
  const style = CATEGORY_STYLES[data.category] || CATEGORY_STYLES.general;
  const when = formatWhen(data.createdAt);
  return `
    <article class="update ${style.variant}">
      <div class="update-top">
        <span class="tag ${style.tag}">${style.label}</span>
        ${when ? `<time>${when}</time>` : ""}
      </div>
      <h3>${escapeHtml(data.title)}</h3>
      <p>${escapeHtml(data.body)}</p>
    </article>`;
}

// Renders a live-updating announcement feed into #<containerId>.
// Pass { max } to cap how many show (e.g. index.html's "Latest Updates" teaser).
function skeletonCard() {
  return `
    <article class="update">
      <span class="skeleton" style="display:inline-block;height:12px;width:60px;margin-bottom:12px;"></span>
      <span class="skeleton" style="display:block;height:12px;width:75%;margin-bottom:8px;"></span>
      <span class="skeleton" style="display:block;height:12px;width:50%;"></span>
    </article>`;
}

export function renderAnnouncements(containerId, { max } = {}) {
  const container = document.getElementById(containerId);
  container.innerHTML = skeletonCard().repeat(max || 2);

  let q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
  if (max) q = query(q, fsLimit(max));

  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      container.innerHTML = `<p class="text-dim" style="text-align:center;font-size:13px;font-style:italic;padding:8px 0;">No announcements yet.</p>`;
      return;
    }

    container.innerHTML = snapshot.docs.map((doc) => announcementCardHtml(doc.data())).join("");
  }, () => {
    container.innerHTML = `<p class="text-dim" style="text-align:center;font-size:13px;font-style:italic;padding:8px 0;">Couldn't load announcements. Check your connection and refresh.</p>`;
  });
}
