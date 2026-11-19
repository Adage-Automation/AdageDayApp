// Adage Day 2026 · gala mock behaviour (plain script, no build step).
(() => {
  const root = document.documentElement;
  root.classList.add("js");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = matchMedia("(hover: hover)").matches;

  // ---- Rising gold dust inside the hero ----
  if (!reduce) {
    document.querySelectorAll("[data-dust]").forEach((el) => {
      const n = Number(el.dataset.dust) || 20;
      for (let i = 0; i < n; i++) {
        const s = document.createElement("i");
        s.style.left = (Math.random() * 100).toFixed(1) + "%";
        s.style.top = (35 + Math.random() * 65).toFixed(1) + "%";
        s.style.setProperty("--d", (6 + Math.random() * 8).toFixed(1) + "s");
        s.style.setProperty("--delay", (-Math.random() * 12).toFixed(1) + "s");
        s.style.setProperty("--s", (1 + Math.random() * 2.2).toFixed(1) + "px");
        if (Math.random() < 0.25) s.className = "t";
        el.appendChild(s);
      }
    });
  }

  // ---- 3D tilt cards (feedback: the card answers the finger/cursor) ----
  if (!reduce) {
    document.querySelectorAll("[data-tilt]").forEach((el) => {
      const max = Number(el.dataset.tilt) || 7;
      let frame = 0;
      el.addEventListener("pointermove", (e) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const r = el.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width;
          const y = (e.clientY - r.top) / r.height;
          el.style.setProperty("--ry", ((x - 0.5) * max * 2).toFixed(2) + "deg");
          el.style.setProperty("--rx", ((0.5 - y) * max * 2).toFixed(2) + "deg");
          el.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
          el.style.setProperty("--my", (y * 100).toFixed(1) + "%");
          el.classList.add("is-tilting");
        });
      });
      const reset = () => {
        cancelAnimationFrame(frame);
        el.style.setProperty("--rx", "0deg");
        el.style.setProperty("--ry", "0deg");
        el.classList.remove("is-tilting");
      };
      el.addEventListener("pointerleave", reset);
      el.addEventListener("pointercancel", reset);
    });
  }

  // ---- Emblem parallax: follows the cursor, or the phone's tilt ----
  const emblem = document.querySelector(".emblem-3d");
  if (emblem && !reduce) {
    const set = (x, y) => {
      emblem.style.setProperty("--px", (x * 18).toFixed(2) + "deg");
      emblem.style.setProperty("--py", (-y * 14).toFixed(2) + "deg");
    };
    if (canHover) {
      window.addEventListener("pointermove", (e) => {
        set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5);
      }, { passive: true });
    } else {
      // Android sends orientation without a prompt; iOS needs a permission
      // tap, so there the emblem just floats on its own.
      window.addEventListener("deviceorientation", (e) => {
        if (e.gamma == null) return;
        const clamp = (v) => Math.max(-1, Math.min(1, v));
        set(clamp(e.gamma / 30) / 2, clamp((e.beta - 45) / 30) / 2);
      });
    }
  }

  // ---- Scroll reveal (IntersectionObserver, no scroll listeners) ----
  const revealables = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add("in"));
  }
  setTimeout(() => revealables.forEach((el) => el.classList.add("in")), 3000); // fail-safe

  // ---- Countdown (home) ----
  const tiles = document.getElementById("cdTiles");
  if (tiles) {
    const start = new Date("2026-11-28T05:00:00+05:30").getTime();
    const end = new Date("2026-12-01T00:00:00+05:30").getTime();
    const nums = tiles.querySelectorAll(".cd-num");
    const caption = document.getElementById("cdCaption");
    const tick = () => {
      const now = Date.now();
      if (now >= start) {
        tiles.outerHTML = now >= end
          ? '<p class="cd-live metal">That\'s a wrap. See you next year</p>'
          : '<p class="cd-live metal">Adage Day is live</p>';
        if (caption) caption.textContent = now >= end ? "Thank you for celebrating with us" : "Check Live Status for today's results";
        return false;
      }
      const d = start - now;
      const vals = [d / 864e5, (d % 864e5) / 36e5, (d % 36e5) / 6e4, (d % 6e4) / 1e3].map(Math.floor);
      vals.forEach((v, i) => {
        const t = String(v).padStart(2, "0");
        if (nums[i].textContent === t) return;
        nums[i].textContent = t;
        if (!reduce) { nums[i].classList.remove("flip"); void nums[i].offsetWidth; nums[i].classList.add("flip"); }
      });
      return true;
    };
    if (tick()) { const timer = setInterval(() => { if (!tick()) clearInterval(timer); }, 1000); }
  }

  // ---- Schedule: day switch + per-event sub tabs + deep links ----
  const sw = document.querySelector(".day-switch");
  if (sw) {
    const tabs = [...sw.querySelectorAll(".day-tab")];
    const showDay = (n) => {
      tabs.forEach((t, i) => t.setAttribute("aria-selected", String(i === n - 1)));
      sw.style.setProperty("--i", n - 1);
      document.querySelectorAll(".day-panel").forEach((p) => p.classList.toggle("active", p.id === "day" + n));
    };
    tabs.forEach((t, i) => t.addEventListener("click", () => showDay(i + 1)));

    // Tabs are scoped to their own event card, so one event never hides another.
    const openPanel = (id) => {
      const panel = document.getElementById(id);
      if (!panel) return null;
      const ev = panel.closest(".event");
      ev.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p === panel));
      ev.querySelectorAll(".subtab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.panel === id)));
      return ev;
    };
    document.querySelectorAll(".subtab").forEach((b) => b.addEventListener("click", () => openPanel(b.dataset.panel)));

    const params = new URLSearchParams(location.search);
    const day = Number(params.get("day"));
    showDay(day >= 1 && day <= 3 ? day : 1);
    const section = params.get("section");
    if (section) {
      const ev = openPanel(section);
      if (ev) requestAnimationFrame(() => ev.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
    }
  }
})();
