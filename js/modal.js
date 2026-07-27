(function () {
  "use strict";

  var FOCUSABLE =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  var active = null; // { overlay, previousFocus, onClose, keyHandler }

  function getFocusableElements(overlay) {
    var els = overlay.querySelectorAll(FOCUSABLE);
    return Array.prototype.slice.call(els);
  }

  function handleKeydown(e) {
    if (!active) return;

    // Escape → close
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }

    // Tab / Shift+Tab → trap focus
    if (e.key === "Tab") {
      var els = getFocusableElements(active.overlay);
      if (els.length === 0) {
        e.preventDefault();
        return;
      }
      var first = els[0];
      var last = els[els.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }

  function open(contentHtml, options) {
    options = options || {};
    close(); // close any existing modal first

    var previousFocus = document.activeElement;

    var overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "modalOverlay";
    overlay.innerHTML = contentHtml;

    // ARIA attributes
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    // Find or create a title element for aria-labelledby
    var titleEl = overlay.querySelector("h2");
    if (titleEl) {
      if (!titleEl.id) titleEl.id = "modal-title-" + Date.now();
      overlay.setAttribute("aria-labelledby", titleEl.id);
    }

    document.body.appendChild(overlay);

    // Click outside to close
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });

    // Focus trap keydown handler
    var keyHandler = handleKeydown;
    document.addEventListener("keydown", keyHandler);

    active = {
      overlay: overlay,
      previousFocus: previousFocus,
      onClose: options.onClose || null,
      keyHandler: keyHandler,
    };

    // Focus first focusable element
    var focusable = getFocusableElements(overlay);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      overlay.setAttribute("tabindex", "-1");
      overlay.focus();
    }

    // Call onBind callback if provided
    if (options.onBind) {
      options.onBind(overlay);
    }
  }

  function close() {
    if (!active) return;

    var overlay = active.overlay;
    var previousFocus = active.previousFocus;
    var onClose = active.onClose;

    // Remove keydown listener
    document.removeEventListener("keydown", active.keyHandler);

    // Remove overlay from DOM
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }

    // Restore focus
    if (previousFocus && previousFocus.focus) {
      previousFocus.focus();
    }

    // Fire callback
    if (onClose) onClose();

    active = null;
  }

  function isActive() {
    return active !== null;
  }

  // --- Expose ---

  window.Modal = {
    open: open,
    close: close,
    isActive: isActive,
  };
})();
