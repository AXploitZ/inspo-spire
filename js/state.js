(function () {
  "use strict";

  var App = window.App = window.App || {};

  App.DEFAULT_TYPES = ["Hero","Navigation","Buttons","Cards","Forms","Footer","Pricing","Testimonials","Features","CTA Sections","Other"];
  App.THEME_SUGGESTIONS = ["Minimalist","Brutalist","Glassmorphism","Neumorphism","Dark Mode","Maximalist","Editorial","Corporate","Playful","Retro / Vaporwave","Luxury","Organic","Cyberpunk","Swiss / International","Y2K","Neo-Brutalism","Skeuomorphic"];
  App.CONFIG_KEY = "specimen_gh_config";

  App.state = {
    items: [], customTypes: [],
    activeType: "All", activeTheme: "All", search: "",
    loading: true, syncStatus: "idle",
    config: null, connected: false,
    modal: null, editingItem: null, detailItem: null, saving: false,
    formImageMode: "upload", formImageData: "", formImageIsNew: false, formVocab: [],
    setupForm: {owner:"", repo:"", branch:"main", visibility:"public", token:""}
  };

  App.uid = function () {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  };

  App.escapeHtml = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  App.allTypes = function () {
    return App.DEFAULT_TYPES.concat(App.state.customTypes);
  };

  App.showToast = function (msg, isError) {
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.className = isError ? "show error" : "show";
    clearTimeout(App.showToast._t);
    App.showToast._t = setTimeout(function () { t.className = ""; }, 3800);
  };

  App.filteredItems = function () {
    var s = App.state;
    return s.items.filter(function (it) {
      if (s.activeType !== "All" && it.elementType !== s.activeType) return false;
      if (s.activeTheme !== "All" && it.theme !== s.activeTheme) return false;
      if (s.search) {
        var q = s.search.toLowerCase();
        var hay = [it.title, it.brief, it.theme, it.elementType].concat(it.vocabulary || []).join(" ").toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  };

  App.typeCounts = function () {
    var counts = {};
    App.state.items.forEach(function (it) {
      counts[it.elementType] = (counts[it.elementType] || 0) + 1;
    });
    return counts;
  };

  App.themesForActiveType = function () {
    var s = App.state;
    var pool = s.activeType === "All" ? s.items : s.items.filter(function (it) { return it.elementType === s.activeType; });
    var set = {};
    pool.forEach(function (it) { if (it.theme) set[it.theme] = true; });
    return Object.keys(set).sort();
  };
})();
