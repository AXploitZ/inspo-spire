(function () {
  "use strict";

  var FOCUSABLE =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  var active = null;

  function getFocusableElements(overlay) {
    var els = overlay.querySelectorAll(FOCUSABLE);
    return Array.prototype.slice.call(els);
  }

  function cleanup() {
    if (!active) return;
    document.removeEventListener("keydown", active.keyHandler);
    if (active.overlay && active.overlay.parentNode) {
      active.overlay.parentNode.removeChild(active.overlay);
    }
    if (active.previousFocus && active.previousFocus.focus) {
      active.previousFocus.focus();
    }
    active = null;
  }

  function dismiss() {
    if (!active) return;
    var onClose = active.onClose;
    cleanup();
    if (onClose) onClose();
  }

  function handleKeydown(e) {
    if (!active) return;
    if (e.key === "Escape") {
      e.preventDefault();
      dismiss();
      return;
    }
    if (e.key === "Tab") {
      var els = getFocusableElements(active.overlay);
      if (els.length === 0) { e.preventDefault(); return; }
      var first = els[0];
      var last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
  }

  function open(contentHtml, options) {
    options = options || {};
    cleanup();

    var previousFocus = document.activeElement;

    var overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "modalOverlay";
    overlay.innerHTML = contentHtml;

    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    var titleEl = overlay.querySelector("h2");
    if (titleEl) {
      if (!titleEl.id) titleEl.id = "modal-title-" + Date.now();
      overlay.setAttribute("aria-labelledby", titleEl.id);
    }

    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) dismiss();
    });

    var keyHandler = handleKeydown;
    document.addEventListener("keydown", keyHandler);

    active = {
      overlay: overlay,
      previousFocus: previousFocus,
      onClose: options.onClose || null,
      keyHandler: keyHandler,
    };

    var focusable = getFocusableElements(overlay);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      overlay.setAttribute("tabindex", "-1");
      overlay.focus();
    }

    if (options.onBind) {
      options.onBind(overlay);
    }
  }

  function isActive() {
    return active !== null;
  }

  window.Modal = {
    open: open,
    close: dismiss,
    isActive: isActive,
  };
})();
