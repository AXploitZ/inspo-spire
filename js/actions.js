(function () {
  "use strict";

  var App = window.App = window.App || {};
  var state = App.state;
  var showToast = App.showToast;
  var uid = App.uid;
  var render = App.render;

  var saveQueue = Promise.resolve();

  App.saveLibraryToGitHub = function (message) {
    var msg = message || "Update library";
    state.syncStatus = "syncing"; render();

    saveQueue = saveQueue.then(async function () {
      try {
        await GitHubAPI.saveLibrary({ items: state.items, customTypes: state.customTypes }, msg);
        state.syncStatus = "ok";
      } catch (e) {
        state.syncStatus = "error";
        showToast("Sync failed: " + e.message, true);
      }
      render();
    });

    return saveQueue;
  };

  App.handleConnect = async function () {
    var f = state.setupForm;
    var owner = f.owner.trim(), repo = f.repo.trim(), branch = (f.branch || "main").trim() || "main", token = f.token.trim();
    if (!owner || !repo || !token) { showToast("Fill in owner, repo, and token.", true); return; }
    var btn = document.getElementById("su_connect");
    btn.textContent = "Connecting…"; btn.disabled = true;

    state.config = { owner: owner, repo: repo, branch: branch, visibility: f.visibility, token: token };
    try {
      GitHubAPI.configure(state.config);
      var lib = await GitHubAPI.loadLibrary();
      state.items = lib.items;
      state.customTypes = lib.customTypes;
      localStorage.setItem(App.CONFIG_KEY, JSON.stringify(state.config));
      state.connected = true;
      showToast("Connected to " + owner + "/" + repo + ".");
      render();
    } catch (e) {
      state.connected = false;
      GitHubAPI.clearCache();
      showToast(e.message, true);
      btn.textContent = "Connect"; btn.disabled = false;
    }
  };

  App.disconnect = function () {
    if (!confirm("Disconnect this browser from the repo? Your data stays safe on GitHub — you can reconnect anytime.")) return;
    localStorage.removeItem(App.CONFIG_KEY);
    state.config = null; state.connected = false; state.items = []; state.customTypes = [];
    state.setupForm = { owner: "", repo: "", branch: "main", visibility: "public", token: "" };
    GitHubAPI.clearCache();
    render();
  };

  App.handleRefresh = async function () {
    state.loading = true; render();
    try {
      GitHubAPI.configure(state.config);
      var lib = await GitHubAPI.loadLibrary();
      state.items = lib.items;
      state.customTypes = lib.customTypes;
      showToast("Synced with GitHub.");
    } catch (e) { showToast("Refresh failed: " + e.message, true); }
    state.loading = false; render();
  };

  App.openAddModal = function () {
    state.editingItem = null; state.formImageMode = "upload"; state.formImageData = ""; state.formImageIsNew = false;
    state.formVocab = [];
    state.formTitle = ""; state.formElementType = App.DEFAULT_TYPES[0]; state.formTheme = "";
    state.formBrief = ""; state.formSourceUrl = "";
    state.modal = "add"; render();
  };

  App.openEditModal = function (item) {
    state.editingItem = item; state.formImageMode = "url";
    state.formImageData = GitHubAPI.resolveImageUrl(item.image) || item.image || "";
    state.formImageIsNew = false;
    state.formVocab = (item.vocabulary || []).slice();
    state.formTitle = item.title || ""; state.formElementType = item.elementType || "";
    state.formTheme = item.theme || ""; state.formBrief = item.brief || ""; state.formSourceUrl = item.sourceUrl || "";
    state.modal = "edit"; state.detailItem = null; render();
  };

  App.closeModal = function () { Modal.close(); };

  App.handleSave = async function () {
    var overlay = document.getElementById("modalOverlay");
    var saveBtn = overlay.querySelector("#saveForm");
    var statusEl = overlay.querySelector("#formStatus");
    App.syncFormToState();
    var title = state.formTitle.trim();
    var elementType = state.formElementType;
    var theme = state.formTheme.trim();
    var brief = state.formBrief.trim();
    var sourceUrl = state.formSourceUrl.trim();

    if (!title) { showToast("Give it a title first.", true); overlay.querySelector("#titleInput").focus(); return; }

    saveBtn.disabled = true; saveBtn.textContent = "Saving…"; state.saving = true;
    var itemId = state.editingItem ? state.editingItem.id : uid();
    var imagePath = state.editingItem ? state.editingItem.image : "";
    var previousImage = state.editingItem ? state.editingItem.image : "";

    try {
      if (state.formImageMode === "upload" && state.formImageIsNew && state.formImageData) {
        statusEl.textContent = "Uploading image…";
        imagePath = await GitHubAPI.uploadImage(state.formImageData, itemId);
      } else if (state.formImageMode === "url") {
        var urlVal = overlay.querySelector("#urlInput") ? overlay.querySelector("#urlInput").value.trim() : "";
        if (urlVal && urlVal !== previousImage) {
          statusEl.textContent = "Fetching image…";
          try {
            var res = await fetch(urlVal, { mode: "cors" });
            if (!res.ok) throw new Error("fetch failed");
            var blob = await res.blob();
            var resized = await App.resizeImageFromBlob(blob);
            statusEl.textContent = "Uploading image…";
            imagePath = await GitHubAPI.uploadImage(resized, itemId);
          } catch (imgErr) {
            imagePath = urlVal;
            showToast("Couldn't save a local copy of that image (source blocked it) — linked to the live URL instead.", true);
          }
        } else if (urlVal) {
          imagePath = urlVal;
        }
      }

      statusEl.textContent = "Saving to GitHub…";

      if (state.modal === "edit" && state.editingItem) {
        state.editingItem.title = title; state.editingItem.elementType = elementType;
        state.editingItem.theme = theme; state.editingItem.brief = brief;
        state.editingItem.sourceUrl = sourceUrl; state.editingItem.image = imagePath;
        state.editingItem.vocabulary = state.formVocab.slice();
        await App.saveLibraryToGitHub("Update: " + title);
      } else {
        state.items.unshift({
          id: itemId, title: title, elementType: elementType, theme: theme, brief: brief,
          sourceUrl: sourceUrl, image: imagePath, vocabulary: state.formVocab.slice(), createdAt: Date.now()
        });
        await App.saveLibraryToGitHub("Add: " + title);
      }

      showToast(state.modal === "edit" ? "Changes saved to GitHub." : "Added to archive.");
      state.saving = false;
      App.closeModal();
    } catch (e) {
      state.saving = false;
      showToast("Couldn't save: " + e.message, true);
      saveBtn.disabled = false; saveBtn.textContent = state.modal === "edit" ? "Save changes" : "Add to archive";
      if (statusEl) statusEl.textContent = "";
    }
  };

  App.init = async function () {
    var saved = localStorage.getItem(App.CONFIG_KEY);
    if (saved) {
      try { state.config = JSON.parse(saved); state.connected = true; } catch (e) { }
    }
    if (state.connected) {
      try {
        GitHubAPI.configure(state.config);
        var lib = await GitHubAPI.loadLibrary();
        state.items = lib.items;
        state.customTypes = lib.customTypes;
      } catch (e) { showToast("Couldn't sync with GitHub: " + e.message, true); }
    }
    state.loading = false;
    render();
  };
})();
