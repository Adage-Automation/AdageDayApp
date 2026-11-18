// Scroll reveal. theme.css hides these targets only under html.js-motion
// (set by a one-line script in <head>) with a 3s fail-safe, so content is
// never lost if this file fails to load. Keep this list in sync with theme.css.
const TARGETS = [
  ".event-card:not(.event-card .event-card)",
  ".leader-card",
  ".schedule-list .event-nav-card",
  ".live-cta",
  "a[href='message.html'].block",
  ".space-y-6 > *",
  ".space-y-8 > *",
  ".letter-panel",
].join(",");

const els = document.querySelectorAll(TARGETS);
const reveal = (el, delay) => {
  el.style.transitionDelay = `${delay}ms`;
  el.classList.add("is-in");
  // Drop the stagger delay afterwards so hover/press feedback stays instant.
  setTimeout(() => (el.style.transitionDelay = ""), delay + 800);
};

if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .forEach((e, i) => {
          reveal(e.target, Math.min(i, 6) * 80);
          io.unobserve(e.target);
        });
    },
    { rootMargin: "0px 0px -6% 0px" }
  );
  els.forEach((el) => io.observe(el));
} else {
  els.forEach((el) => reveal(el, 0));
}
