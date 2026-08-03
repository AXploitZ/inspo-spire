(function () {
  "use strict";

  var App = window.App = window.App || {};
  var state = App.state;
  var escapeHtml = App.escapeHtml;
  var allTypes = App.allTypes;
  var showToast = App.showToast;
  var filteredItems = App.filteredItems;
  var typeCounts = App.typeCounts;
  var themesForActiveType = App.themesForActiveType;

  App.render = function () {
    var app = document.getElementById("app");
    if (state.loading) {
      if (state.connected) {
        app.innerHTML = '<div class="skeleton-grid">' +
          '<div class="skeleton-card"><div class="skeleton-img"></div><div class="skeleton-body"><div class="skeleton-line"></div><div class="skeleton-line short"></div><div class="skeleton-line tiny"></div></div></div>' +
          '<div class="skeleton-card"><div class="skeleton-img"></div><div class="skeleton-body"><div class="skeleton-line"></div><div class="skeleton-line short"></div><div class="skeleton-line tiny"></div></div></div>' +
          '<div class="skeleton-card"><div class="skeleton-img"></div><div class="skeleton-body"><div class="skeleton-line"></div><div class="skeleton-line short"></div><div class="skeleton-line tiny"></div></div></div>' +
          '</div>';
      } else {
        app.innerHTML = '<div class="loading-screen">LOADING ARCHIVE…</div>';
      }
      return;
    }
    if (!state.connected) { app.innerHTML = renderSetupScreen(); bindSetupEvents(); return; }

    var html = "";
    html += renderHeader();
    html += renderTabs();
    html += renderThemeFilters();
    html += renderGrid();
    app.innerHTML = html;

    bindHeaderEvents(); bindTabEvents(); bindThemeChipEvents(); bindCardEvents();
    if (state.modal && !state.saving) renderModal();
  };

  function renderSetupScreen() {
    var f = state.setupForm;
    return '' +
      '<div class="setup-wrap"><div class="setup-card">' +
      '<h2>Connect your GitHub repo</h2>' +
      '<p>Your library data and screenshots will be read and written directly to a repo you control. Nothing is stored anywhere except that repo and this browser\'s local storage (for your token).</p>' +
      '<div class="setup-field"><span class="field-label">Repo owner (your GitHub username)</span>' +
      '<input class="field-input" id="su_owner" placeholder="e.g. janedoe" value="' + escapeHtml(f.owner) + '"></div>' +
      '<div class="setup-field"><span class="field-label">Repository name</span>' +
      '<input class="field-input" id="su_repo" placeholder="e.g. design-library" value="' + escapeHtml(f.repo) + '"></div>' +
      '<div class="setup-field"><span class="field-label">Branch</span>' +
      '<input class="field-input" id="su_branch" placeholder="main" value="' + escapeHtml(f.branch) + '"></div>' +
      '<div class="setup-field"><span class="field-label">Repository visibility</span>' +
      '<div class="radio-row">' +
      '<div class="radio-opt' + (f.visibility === 'public' ? ' active' : '') + '" data-vis="public">Public</div>' +
      '<div class="radio-opt' + (f.visibility === 'private' ? ' active' : '') + '" data-vis="private">Private</div>' +
      '</div></div>' +
      '<div class="setup-field"><span class="field-label">Fine-grained personal access token</span>' +
      '<input class="field-input" id="su_token" type="password" placeholder="github_pat_…" value="' + escapeHtml(f.token) + '"></div>' +
      '<button class="btn btn-primary" id="su_connect" style="width:100%;justify-content:center;">Connect</button>' +
      '<div class="setup-note">Token needs only <strong>Contents: Read and write</strong> permission, scoped to this one repo. It\'s saved solely in this browser\'s local storage — never sent anywhere but api.github.com.</div>' +
      '</div></div>';
  }

  function bindSetupEvents() {
    var f = state.setupForm;
    ["su_owner", "su_repo", "su_branch", "su_token"].forEach(function (id) {
      var el = document.getElementById(id);
      el.addEventListener("input", function (e) {
        var key = { su_owner: "owner", su_repo: "repo", su_branch: "branch", su_token: "token" }[id];
        f[key] = e.target.value;
      });
    });
    document.querySelectorAll(".radio-opt").forEach(function (el) {
      el.addEventListener("click", function () { f.visibility = el.getAttribute("data-vis"); App.render(); });
    });
    document.getElementById("su_connect").addEventListener("click", App.handleConnect);
  }

  function renderHeader() {
    var total = state.items.length;
    var dotClass = state.syncStatus === "syncing" ? "syncing" : (state.syncStatus === "error" ? "err" : "");
    var statusText = state.syncStatus === "syncing" ? "syncing…" : (state.syncStatus === "error" ? "sync error" : (state.config.owner + "/" + state.config.repo));
    return '' +
      '<header class="topbar">' +
      '<div class="brand">' +
      '<span class="brand-mark">Archive</span>' +
      '<div><h1>Specimen</h1><div class="brand-sub"><span class="sync-dot ' + dotClass + '"></span>' + escapeHtml(statusText) + ' · ' + total + ' element' + (total === 1 ? '' : 's') + '</div></div>' +
      '</div>' +
      '<div class="topbar-actions">' +
      '<div class="search-box">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
      '<input id="searchInput" type="text" placeholder="Search title, theme, vocabulary…" value="' + escapeHtml(state.search) + '" aria-label="Search designs">' +
      (state.search ? '<button class="search-clear" id="searchClear" title="Clear search">&times;</button>' : '') +
      '</div>' +
      '<button class="btn btn-ghost btn-sm" id="refreshBtn" title="Pull latest from GitHub">↻ Refresh</button>' +
      '<button class="btn btn-primary" id="addBtn">+ Add design</button>' +
      '<button class="btn btn-ghost btn-sm" id="disconnectBtn">Disconnect</button>' +
      '</div>' +
      '</header>';
  }

  function renderTabs() {
    var counts = typeCounts();
    var types = ["All"].concat(allTypes());
    var tabsHtml = types.map(function (t) {
      var cnt = t === "All" ? state.items.length : (counts[t] || 0);
      var active = state.activeType === t;
      return '<button class="type-tab' + (active ? ' active' : '') + '" data-type="' + escapeHtml(t) + '">' + escapeHtml(t) + '<span class="count">' + cnt + '</span></button>';
    }).join("");
    tabsHtml += '<button class="type-tab-add" id="addTypeBtn" title="Add custom category">+</button>';
    return '<div class="type-tabs">' + tabsHtml + '</div><div class="tabs-underline"></div>';
  }

  function renderThemeFilters() {
    var themes = themesForActiveType();
    if (themes.length === 0) return "";
    var chips = '<span class="label">Theme</span>';
    chips += '<button class="chip' + (state.activeTheme === "All" ? ' active' : '') + '" data-theme="All">All</button>';
    themes.forEach(function (th) {
      chips += '<button class="chip' + (state.activeTheme === th ? ' active' : '') + '" data-theme="' + escapeHtml(th) + '">' + escapeHtml(th) + '</button>';
    });
    return '<div class="theme-filters">' + chips + '</div>';
  }

  function cardImageHtml(it) {
    var src = GitHubAPI.resolveImageUrl(it.image);
    if (it.image && !src) return '<span class="img-loading">loading…</span>';
    if (!src) return '';
    return '<img src="' + src.replace(/"/g, '&quot;') + '" alt="' + escapeHtml(it.title) + '" loading="lazy">';
  }

  function renderGrid() {
    var items = filteredItems();
    if (state.items.length === 0) {
      return '<div class="empty-state">' +
        '<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="3" width="18" height="14" rx="1"/><path d="M3 13l4-4 3 3 5-6 6 7"/><circle cx="8" cy="8" r="1"/></svg>' +
        '<h3>Your archive is empty</h3>' +
        '<p>Start collecting hero sections, nav bars, buttons and more. Everything you add is committed straight to your GitHub repo.</p>' +
        '<button class="btn btn-primary" id="emptyAddBtn">+ Add your first design</button>' +
        '</div>';
    }
    if (items.length === 0) {
      return '<div class="empty-state"><h3>No matches</h3><p>Nothing fits the current filters. Try a different category, theme, or search term.</p></div>';
    }
    var cards = items.map(function (it) {
      var indexLabel = "SPEC." + String(state.items.indexOf(it) + 1).padStart(3, "0");
      var vocabHtml = (it.vocabulary || []).slice(0, 4).map(function (v) { return '<span class="vocab-pill">' + escapeHtml(v) + '</span>'; }).join("");
      var isLiveUrl = it.image && it.image.indexOf("http") === 0;
      return '<div class="card" data-id="' + it.id + '">' +
        '<div class="card-image-wrap">' + cardImageHtml(it) +
        '<span class="card-index">' + indexLabel + '</span>' +
        (it.theme ? '<span class="card-theme-tag">' + escapeHtml(it.theme) + '</span>' : '') +
        (isLiveUrl ? '<span class="card-live-badge" title="Image linked live — not committed to repo">live</span>' : '') +
        '</div>' +
        '<div class="card-body">' +
        '<div class="card-title">' + escapeHtml(it.title || "Untitled") + '</div>' +
        '<div class="card-meta">' + escapeHtml(it.elementType) + '</div>' +
        (it.brief ? '<div class="card-brief">' + escapeHtml(it.brief) + '</div>' : '') +
        (vocabHtml ? '<div class="card-vocab">' + vocabHtml + '</div>' : '') +
        '</div>' +
        '</div>';
    }).join("");
    return '<div class="grid">' + cards + '</div>';
  }

  function bindHeaderEvents() {
    var search = document.getElementById("searchInput");
    if (search) {
      var searchTimer;
      search.addEventListener("input", function (e) {
        state.search = e.target.value;
        var pos = e.target.selectionStart;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          App.render();
          var again = document.getElementById("searchInput");
          if (again) { again.focus(); again.setSelectionRange(pos, pos); }
        }, 200);
      });
    }
    var searchClear = document.getElementById("searchClear");
    if (searchClear) searchClear.addEventListener("click", function () {
      state.search = ""; App.render();
      var input = document.getElementById("searchInput");
      if (input) input.focus();
    });
    var addBtn = document.getElementById("addBtn");
    if (addBtn) addBtn.addEventListener("click", App.openAddModal);
    var emptyAddBtn = document.getElementById("emptyAddBtn");
    if (emptyAddBtn) emptyAddBtn.addEventListener("click", App.openAddModal);
    var refreshBtn = document.getElementById("refreshBtn");
    if (refreshBtn) refreshBtn.addEventListener("click", App.handleRefresh);
    var disconnectBtn = document.getElementById("disconnectBtn");
    if (disconnectBtn) disconnectBtn.addEventListener("click", App.disconnect);
  }

  function bindTabEvents() {
    document.querySelectorAll(".type-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.activeType = btn.getAttribute("data-type"); state.activeTheme = "All"; App.render();
      });
    });
    var addTypeBtn = document.getElementById("addTypeBtn");
    if (addTypeBtn) addTypeBtn.addEventListener("click", function () {
      var name = prompt("New category name (e.g. 'Modals', 'Onboarding'):");
      if (name && name.trim()) {
        name = name.trim();
        if (allTypes().indexOf(name) === -1) { state.customTypes.push(name); App.saveLibraryToGitHub("Add category: " + name); }
        state.activeType = name; App.render();
      }
    });
  }

  function bindThemeChipEvents() {
    document.querySelectorAll(".chip").forEach(function (chip) {
      chip.addEventListener("click", function () { state.activeTheme = chip.getAttribute("data-theme"); App.render(); });
    });
  }

  function bindCardEvents() {
    document.querySelectorAll(".card").forEach(function (card) {
      card.addEventListener("click", function () {
        var id = card.getAttribute("data-id");
        var item = state.items.find(function (it) { return it.id === id; });
        if (item) { state.detailItem = item; state.modal = "detail"; App.render(); }
      });
    });
  }

  function renderModal() {
    var html = state.modal === "detail" ? renderDetailModal(state.detailItem) : renderFormModal();
    Modal.open(html, {
      onBind: function (overlay) {
        if (state.modal === "detail") bindDetailModalEvents(overlay); else bindFormModalEvents(overlay);
      },
      onClose: function () { if (!state.saving) { state.modal = null; state.editingItem = null; state.detailItem = null; } }
    });
  }

  function renderDetailModal(it) {
    if (!it) return "";
    var vocabHtml = (it.vocabulary || []).map(function (v) { return '<span class="vocab-pill">' + escapeHtml(v) + '</span>'; }).join("");
    var src = GitHubAPI.resolveImageUrl(it.image);
    var isLiveUrl = it.image && it.image.indexOf("http") === 0;
    return '' +
      '<div class="modal detail-modal">' +
      '<div class="modal-header"><h2>' + escapeHtml(it.title || "Untitled") + '</h2><button class="modal-close" id="closeDetail">&times;</button></div>' +
      (src ? '<img class="detail-image" src="' + src.replace(/"/g, '&quot;') + '" alt="">' : '') +
      '<div class="modal-body">' +
      '<div class="detail-tags-row">' +
      '<span class="detail-badge badge-type">' + escapeHtml(it.elementType) + '</span>' +
      (it.theme ? '<span class="detail-badge badge-theme">' + escapeHtml(it.theme) + '</span>' : '') +
      (isLiveUrl ? '<span class="detail-badge badge-live" title="Image linked live — not committed to repo. May break if source removes it.">live link</span>' : '') +
      '</div>' +
      (it.brief ? '<div class="detail-brief">' + escapeHtml(it.brief) + '</div>' : '') +
      (vocabHtml ? '<div><div class="field-label">Vocabulary</div><div class="card-vocab">' + vocabHtml + '</div></div>' : '') +
      (it.sourceUrl ? '<div><div class="field-label">Source</div><a class="detail-source" href="' + escapeHtml(it.sourceUrl) + '" target="_blank" rel="noopener">' + escapeHtml(it.sourceUrl) + '</a></div>' : '') +
      '</div>' +
      '<div class="modal-footer">' +
      '<button class="btn btn-danger" id="deleteItemBtn">Delete</button>' +
      '<button class="btn" id="editItemBtn">Edit</button>' +
      '<button class="btn btn-primary" id="closeDetailBtn">Close</button>' +
      '</div>' +
      '</div>';
  }

  App.syncFormToState = function () {
    var overlay = document.getElementById("modalOverlay");
    if (!overlay) return;
    var titleEl = overlay.querySelector("#titleInput");
    var themeEl = overlay.querySelector("#themeInput");
    var briefEl = overlay.querySelector("#briefInput");
    var sourceEl = overlay.querySelector("#sourceInput");
    var typeEl = overlay.querySelector("#typeInput");
    var urlEl = overlay.querySelector("#urlInput");
    if (titleEl) state.formTitle = titleEl.value;
    if (themeEl) state.formTheme = themeEl.value;
    if (briefEl) state.formBrief = briefEl.value;
    if (sourceEl) state.formSourceUrl = sourceEl.value;
    if (typeEl) state.formElementType = typeEl.value;
    if (urlEl) state.formImageData = urlEl.value;
    var videoUrlEl = overlay.querySelector("#videoUrlInput");
    if (videoUrlEl) state.formVideoData = videoUrlEl.value;
  };

  function bindDetailModalEvents(overlay) {
    overlay.querySelector("#closeDetail").addEventListener("click", App.closeModal);
    overlay.querySelector("#closeDetailBtn").addEventListener("click", App.closeModal);
    overlay.querySelector("#editItemBtn").addEventListener("click", function () { App.openEditModal(state.detailItem); });
    overlay.querySelector("#deleteItemBtn").addEventListener("click", async function () {
      if (!confirm("Delete this item from your archive?")) return;
      var target = state.detailItem;
      var targetIndex = state.items.indexOf(target);
      state.items = state.items.filter(function (it) { return it.id !== target.id; });
      App.closeModal();
      await App.saveLibraryToGitHub("Delete: " + target.title);
      if (target.video && target.video.indexOf("videos/") === 0) {
        try {
          var vfMeta = await fetch(
            "https://api.github.com/repos/" + state.config.owner + "/" + state.config.repo + "/contents/" + target.video + "?ref=" + encodeURIComponent(state.config.branch),
            { headers: { Authorization: "Bearer " + state.config.token, Accept: "application/vnd.github+json" } }
          );
          if (vfMeta.ok) {
            var vfData = await vfMeta.json();
            await GitHubAPI.deleteFile(target.video, vfData.sha, "Remove video: " + target.title);
          }
        } catch (e) { /* best effort */ }
      }
      showToast("Item deleted.", false, {
        label: "Undo",
        callback: async function () {
          state.items.splice(targetIndex, 0, target);
          await App.saveLibraryToGitHub("Restore: " + target.title);
          showToast("Item restored.");
          App.render();
        }
      });
    });
  }

  function renderFormModal() {
    var isEdit = state.modal === "edit";
    var it = state.editingItem || {};
    var titleVal = state.formTitle !== undefined ? state.formTitle : (it.title || "");
    var elementTypeVal = state.formElementType || it.elementType || "";
    var themeVal = state.formTheme !== undefined ? state.formTheme : (it.theme || "");
    var briefVal = state.formBrief !== undefined ? state.formBrief : (it.brief || "");
    var sourceVal = state.formSourceUrl !== undefined ? state.formSourceUrl : (it.sourceUrl || "");
    var typeOptions = allTypes().map(function (t) {
      return '<option value="' + escapeHtml(t) + '"' + (elementTypeVal === t ? ' selected' : '') + '>' + escapeHtml(t) + '</option>';
    }).join("");
    var vocabChips = state.formVocab.map(function (v, i) {
      return '<span class="vocab-chip">' + escapeHtml(v) + '<button type="button" data-vocab-index="' + i + '">&times;</button></span>';
    }).join("");
    var themeDatalist = Array.from(new Set(App.THEME_SUGGESTIONS.concat(state.items.map(function (x) { return x.theme; }).filter(Boolean))));
    var themeOptionsHtml = themeDatalist.map(function (t) { return '<option value="' + escapeHtml(t) + '">'; }).join("");

    var imgSectionHtml;
    if (state.formImageMode === "upload") {
      imgSectionHtml = '<div class="dropzone" id="dropzone">' +
        (state.formImageData ? '<div class="image-preview"><img src="' + state.formImageData.replace(/"/g, '&quot;') + '"></div>' : 'Drag &amp; drop an image, or click to browse') +
        '<input type="file" id="fileInput" accept="image/*">' +
        '</div>';
    } else {
      var urlVal = (state.formImageData && state.formImageData.indexOf("data:") !== 0) ? state.formImageData : "";
      imgSectionHtml = '<input class="field-input" id="urlInput" type="text" placeholder="https://…" value="' + escapeHtml(urlVal) + '">' +
        (urlVal ? '<div class="image-preview" style="margin-top:8px;"><img src="' + urlVal.replace(/"/g, '&quot;') + '" onerror="this.parentElement.style.display=\'none\'"></div>' : '');
    }

    return '' +
      '<div class="modal">' +
      '<div class="modal-header"><h2>' + (isEdit ? "Edit design" : "Add a design") + '</h2><button class="modal-close" id="closeForm">&times;</button></div>' +
      '<div class="modal-body">' +
      '<div>' +
      '<span class="field-label">Screenshot</span>' +
      '<div class="image-source-toggle">' +
      '<button type="button" class="toggle-btn' + (state.formImageMode === "upload" ? ' active' : '') + '" data-mode="upload">Upload file</button>' +
      '<button type="button" class="toggle-btn' + (state.formImageMode === "url" ? ' active' : '') + '" data-mode="url">Paste URL</button>' +
      '</div>' +
      imgSectionHtml +
      '<div class="field-hint">Uploads and URLs are both committed to your repo as real image files when possible. If a source blocks downloading, we\'ll link to it live instead and let you know.</div>' +
      '</div>' +
      '<div>' +
      '<span class="field-label">Video (optional)</span>' +
      '<div class="image-source-toggle">' +
        '<button type="button" class="toggle-btn' + (state.formVideoMode === "upload" ? ' active' : '') + '" data-video-mode="upload">Upload file</button>' +
        '<button type="button" class="toggle-btn' + (state.formVideoMode === "url" ? ' active' : '') + '" data-video-mode="url">Paste URL</button>' +
      '</div>' +
      (state.formVideoMode === "upload"
        ? '<div class="dropzone" id="videoDropzone">' +
          (state.formVideoData
            ? '<div style="padding:14px;"><div style="font-family:var(--font-mono);font-size:11px;color:var(--ok);">Video ready to commit</div>' + (state.formVideoData.indexOf("data:") === 0 ? '<div style="font-size:11px;color:var(--text-faint);margin-top:4px;">' + escapeHtml((state.formVideoData.match(/data:([^;]+)/) || [])[1] || "") + '</div>' : '') + '</div>'
            : 'Drag &amp; drop a video, or click to browse<span style="display:block;font-size:10px;margin-top:4px;">mp4, webm, gif — max 100MB</span>') +
          '<input type="file" id="videoFileInput" accept="video/mp4,video/webm,image/gif">' +
        '</div>'
        : '<input class="field-input" id="videoUrlInput" type="text" placeholder="https://youtube.com/… or direct .mp4 link" value="' + escapeHtml(state.formVideoData && state.formVideoData.indexOf("data:") !== 0 ? state.formVideoData : "") + '">' +
          (state.formVideoData && state.formVideoData.indexOf("http") === 0
            ? '<div class="field-hint" style="color:var(--ok);">Video URL will show as live embed</div>'
            : '<div class="field-hint">YouTube, Loom, and direct video links. URL stays live — not committed to repo.</div>')
      ) +
      '<div class="field-hint">Video is shown alongside the screenshot. For moving or interactive designs.</div>' +
      '</div>' +
      '<div><span class="field-label">Title</span>' +
      '<input class="field-input" id="titleInput" type="text" placeholder="e.g. Split-screen hero with video bg" value="' + escapeHtml(titleVal) + '"></div>' +
      '<div class="field-row">' +
      '<div><span class="field-label">Element type</span><select class="field-input" id="typeInput">' + typeOptions + '</select></div>' +
      '<div><span class="field-label">Theme</span><input class="field-input" id="themeInput" list="themeList" placeholder="e.g. Brutalist" value="' + escapeHtml(themeVal) + '"><datalist id="themeList">' + themeOptionsHtml + '</datalist></div>' +
      '</div>' +
      '<div><span class="field-label">Brief</span><textarea class="field-input" id="briefInput" placeholder="What makes this work — layout, spacing, contrast, motion…">' + escapeHtml(briefVal) + '</textarea></div>' +
      '<div><span class="field-label">Vocabulary</span><div class="vocab-input-wrap" id="vocabWrap">' + vocabChips + '<input type="text" id="vocabInput" placeholder="Type a term, press Enter…"></div>' +
      '<div class="field-hint">e.g. asymmetric grid, kinetic type, oversized ghost button</div></div>' +
      '<div><span class="field-label">Source link (optional)</span><input class="field-input" id="sourceInput" type="text" placeholder="https://…" value="' + escapeHtml(sourceVal) + '"></div>' +
      '</div>' +
      '<div class="modal-footer">' +
      '<span class="field-hint" id="formStatus"></span>' +
      '<button class="btn" id="cancelForm">Cancel</button>' +
      '<button class="btn btn-primary" id="saveForm">' + (isEdit ? "Save changes" : "Add to archive") + '</button>' +
      '</div>' +
      '</div>';
  }

  function bindFormModalEvents(overlay) {
    overlay.querySelector("#closeForm").addEventListener("click", App.closeModal);
    overlay.querySelector("#cancelForm").addEventListener("click", App.closeModal);

    overlay.querySelectorAll(".toggle-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { App.syncFormToState(); state.formImageMode = btn.getAttribute("data-mode"); App.render(); });
    });

    if (state.formImageMode === "upload") {
      var dropzone = overlay.querySelector("#dropzone");
      var fileInput = overlay.querySelector("#fileInput");
      fileInput.addEventListener("change", function (e) { if (e.target.files && e.target.files[0]) App.handleFile(e.target.files[0]); });
      dropzone.addEventListener("dragover", function (e) { e.preventDefault(); dropzone.classList.add("drag-over"); });
      dropzone.addEventListener("dragleave", function () { dropzone.classList.remove("drag-over"); });
      dropzone.addEventListener("drop", function (e) {
        e.preventDefault(); dropzone.classList.remove("drag-over");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) App.handleFile(e.dataTransfer.files[0]);
      });
    } else {
      var urlInput = overlay.querySelector("#urlInput");
      if (urlInput) {
        urlInput.addEventListener("input", function (e) { state.formImageData = e.target.value; state.formImageIsNew = true; });
        urlInput.addEventListener("blur", function () { App.syncFormToState(); App.render(); });
      }
    }

    overlay.querySelectorAll("[data-video-mode]").forEach(function (btn) {
      btn.addEventListener("click", function () { App.syncFormToState(); state.formVideoMode = btn.getAttribute("data-video-mode"); App.render(); });
    });

    if (state.formVideoMode === "upload") {
      var videoDropzone = overlay.querySelector("#videoDropzone");
      var videoFileInput = overlay.querySelector("#videoFileInput");
      if (videoFileInput) videoFileInput.addEventListener("change", function (e) { if (e.target.files && e.target.files[0]) App.handleVideoFile(e.target.files[0]); });
      if (videoDropzone) {
        videoDropzone.addEventListener("dragover", function (e) { e.preventDefault(); videoDropzone.classList.add("drag-over"); });
        videoDropzone.addEventListener("dragleave", function () { videoDropzone.classList.remove("drag-over"); });
        videoDropzone.addEventListener("drop", function (e) {
          e.preventDefault(); videoDropzone.classList.remove("drag-over");
          if (e.dataTransfer.files && e.dataTransfer.files[0]) App.handleVideoFile(e.dataTransfer.files[0]);
        });
      }
    } else {
      var videoUrlInput = overlay.querySelector("#videoUrlInput");
      if (videoUrlInput) {
        videoUrlInput.addEventListener("input", function (e) { state.formVideoData = e.target.value; state.formVideoIsNew = true; });
        videoUrlInput.addEventListener("blur", function () { App.syncFormToState(); App.render(); });
      }
    }

    var vocabInput = overlay.querySelector("#vocabInput");
    vocabInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        var val = vocabInput.value.trim().replace(/,$/, "");
        if (val && state.formVocab.indexOf(val) === -1) { App.syncFormToState(); state.formVocab.push(val); App.render(); App.focusVocabInput(); }
        else vocabInput.value = "";
      } else if (e.key === "Backspace" && vocabInput.value === "" && state.formVocab.length) {
        App.syncFormToState(); state.formVocab.pop(); App.render(); App.focusVocabInput();
      }
    });
    overlay.querySelectorAll("[data-vocab-index]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        App.syncFormToState(); state.formVocab.splice(parseInt(btn.getAttribute("data-vocab-index"), 10), 1); App.render();
      });
    });

    overlay.querySelector("#saveForm").addEventListener("click", App.handleSave);
  }
})();
