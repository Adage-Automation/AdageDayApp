import { db } from "./firebase-init.js";
import {
  collection,
  query,
  orderBy,
  limit as fsLimit,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CATEGORY_STYLES = {
  important: { border: "border-red-500", badge: "bg-red-100 text-red-600", label: "Important" },
  reminder: { border: "border-yellow-500", badge: "bg-yellow-100 text-yellow-600", label: "Reminder" },
  general: { border: "border-teal-500", badge: "bg-teal-100 text-teal-600", label: "General" },
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

// Renders a live-updating announcement feed into #<containerId>.
// Pass { max } to cap how many show (e.g. index.html's "Latest Updates" teaser).
export function renderAnnouncements(containerId, { max } = {}) {
  const container = document.getElementById(containerId);
  let q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
  if (max) q = query(q, fsLimit(max));

  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      container.innerHTML = `<p class="text-xs text-gray-400 italic text-center py-2">No announcements yet.</p>`;
      return;
    }

    container.innerHTML = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        const style = CATEGORY_STYLES[data.category] || CATEGORY_STYLES.general;
        const when = formatWhen(data.createdAt);
        return `
          <div class="p-4 bg-white rounded-xl border border-gray-100 border-l-4 ${style.border} shadow-sm hover:shadow-md transition mt-3 first:mt-0">
            <div class="flex justify-between items-center mb-1">
              <span class="text-[10px] font-medium px-2 py-1 rounded-full ${style.badge}">${style.label}</span>
              ${when ? `<span class="text-[11px] text-gray-400">${when}</span>` : ""}
            </div>
            <p class="font-semibold text-sm">${escapeHtml(data.title)}</p>
            <p class="text-xs text-gray-600 mt-1">${escapeHtml(data.body)}</p>
          </div>`;
      })
      .join("");
  });
}
