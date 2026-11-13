// Registers the service worker and shows a custom "Install App" banner
// instead of relying on Chrome's own (easy-to-miss) address-bar icon.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

const banner = document.getElementById("installBanner");
const installBtn = document.getElementById("installBtn");
const dismissBtn = document.getElementById("installDismiss");
let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  if (localStorage.getItem("installDismissed") === "1") return;
  deferredPrompt = e;
  banner?.classList.remove("hidden");
});

installBtn?.addEventListener("click", async () => {
  banner.classList.add("hidden");
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
});

dismissBtn?.addEventListener("click", () => {
  banner.classList.add("hidden");
  localStorage.setItem("installDismissed", "1");
});

window.addEventListener("appinstalled", () => banner?.classList.add("hidden"));
