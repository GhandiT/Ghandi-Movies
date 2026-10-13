/* Runs in <head> before first paint so the right theme is applied immediately
   (no flash). Kept as an external file so the site can use a strict CSP. */
(function () {
  var theme = "dark";
  try {
    var saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") theme = saved;
    else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) theme = "light";
  } catch (e) { /* storage blocked: fall back to the system preference / dark */
    try { if (window.matchMedia("(prefers-color-scheme: light)").matches) theme = "light"; } catch (e2) {}
  }
  document.documentElement.setAttribute("data-theme", theme);
})();
