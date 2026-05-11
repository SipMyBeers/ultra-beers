// Run before any paint to apply the saved theme and avoid FOUC.
// Whitelisted theme ids only — no user-controlled HTML.
(function () {
  try {
    var t = localStorage.getItem("ub-theme");
    if (t === "pixel" || t === "minimal" || t === "terminal") {
      document.documentElement.setAttribute("data-theme", t);
    }
  } catch (e) {
    /* localStorage may be blocked; pixel (default) remains */
  }
})();
