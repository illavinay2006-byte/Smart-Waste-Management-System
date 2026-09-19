// SmartWaste Professional Notification System
const SWNotice = {
  container: null,
  loadingOverlay: null,
  init() {
    if (!document.getElementById("sw-toast-container")) {
      this.container = document.createElement("div");
      this.container.id = "sw-toast-container";
      this.container.className = "sw-toast-container";
      document.body.appendChild(this.container);
    } else {
      this.container = document.getElementById("sw-toast-container");
    }
    if (!document.getElementById("sw-loading-overlay")) {
      this.loadingOverlay = document.createElement("div");
      this.loadingOverlay.id = "sw-loading-overlay";
      this.loadingOverlay.className = "sw-loading-overlay";
      this.loadingOverlay.style.display = "none";
      this.loadingOverlay.innerHTML = '<div class="sw-loading-box"><div class="sw-loading-spinner"></div><div class="sw-loading-text" id="sw-loading-msg">Submitting to municipal server...</div></div>';
      document.body.appendChild(this.loadingOverlay);
    } else {
      this.loadingOverlay = document.getElementById("sw-loading-overlay");
    }
  },
  toast(message, type = "info", durationMs = 4000) {
    this.init();
    const icons = { success: "\u2705", error: "\u274c", warning: "\u26a0\ufe0f", info: "\u2139\ufe0f" };
    const titles = { success: "Success", error: "Error / Alert", warning: "Attention", info: "Information" };
    const toastEl = document.createElement("div");
    toastEl.className = "sw-toast sw-toast-" + type;
    toastEl.innerHTML = '<div class="sw-toast-icon">' + (icons[type] || "\ud83d\udd14") + '</div><div class="sw-toast-content"><div class="sw-toast-title">' + (titles[type] || "Notification") + '</div><div class="sw-toast-message">' + message + '</div></div><button class="sw-toast-close">&times;</button><div class="sw-toast-progress" style="animation-duration: ' + durationMs + 'ms;"></div>';
    const closeBtn = toastEl.querySelector(".sw-toast-close");
    closeBtn.onclick = () => {
      toastEl.classList.remove("sw-toast-show");
      toastEl.classList.add("sw-toast-hide");
      setTimeout(() => { if (toastEl.parentElement) toastEl.parentElement.removeChild(toastEl); }, 300);
    };
    this.container.appendChild(toastEl);
    setTimeout(() => { toastEl.classList.add("sw-toast-show"); }, 10);
    setTimeout(() => {
      if (toastEl.parentElement) {
        toastEl.classList.remove("sw-toast-show");
        toastEl.classList.add("sw-toast-hide");
        setTimeout(() => { if (toastEl.parentElement) toastEl.parentElement.removeChild(toastEl); }, 300);
      }
    }, durationMs);
  },
  success(message, durationMs = 4000) { this.toast(message, "success", durationMs); },
  error(message, durationMs = 5000) { this.toast(message, "error", durationMs); },
  warning(message, durationMs = 4500) { this.toast(message, "warning", durationMs); },
  info(message, durationMs = 4000) { this.toast(message, "info", durationMs); },
  showLoading(message = "Submitting complaint to municipal server...") {
    this.init();
    const msgEl = document.getElementById("sw-loading-msg");
    if (msgEl) msgEl.innerText = message;
    if (this.loadingOverlay) this.loadingOverlay.style.display = "flex";
  },
  hideLoading() {
    if (this.loadingOverlay) this.loadingOverlay.style.display = "none";
  },
  confirm({ title = "Please Confirm", message = "Are you sure you want to proceed?", confirmText = "Confirm", cancelText = "Cancel", type = "warning", icon = "\u26a0\ufe0f" } = {}) {
    this.init();
    return new Promise((resolve) => {
      const modalEl = document.createElement("div");
      modalEl.className = "sw-modal-backdrop sw-dialog-backdrop";
      const btnClass = type === "danger" ? "danger" : (type === "success" ? "success" : "primary");
      modalEl.innerHTML = '<div class="sw-modal sw-dialog-modal" style="max-width: 440px;"><div class="p-4 text-center"><div class="sw-dialog-icon sw-dialog-icon-' + type + ' mb-3">' + icon + '</div><h5 class="fw-bold mb-2 text-dark">' + title + '</h5><p class="text-secondary small mb-4">' + message + '</p><div class="d-flex justify-content-center gap-2"><button class="btn btn-outline-secondary px-3 py-2 fw-semibold" id="sw-dialog-cancel-btn">' + cancelText + '</button><button class="btn btn-' + btnClass + ' px-4 py-2 fw-bold" id="sw-dialog-confirm-btn">' + confirmText + '</button></div></div></div>';
      document.body.appendChild(modalEl);
      const cancelBtn = modalEl.querySelector("#sw-dialog-cancel-btn");
      const confirmBtn = modalEl.querySelector("#sw-dialog-confirm-btn");
      const cleanup = (result) => {
        modalEl.classList.add("sw-dialog-fadeout");
        setTimeout(() => {
          if (modalEl.parentElement) modalEl.parentElement.removeChild(modalEl);
          resolve(result);
        }, 200);
      };
      cancelBtn.onclick = () => cleanup(false);
      confirmBtn.onclick = () => cleanup(true);
      modalEl.onclick = (e) => { if (e.target === modalEl) cleanup(false); };
    });
  },
  prompt({ title = "Input Required", message = "Please provide details below:", placeholder = "Type details here...", defaultValue = "", confirmText = "Submit", cancelText = "Cancel", required = true, rows = 3 } = {}) {
    this.init();
    return new Promise((resolve) => {
      const modalEl = document.createElement("div");
      modalEl.className = "sw-modal-backdrop sw-dialog-backdrop";
      const inputHtml = rows > 1 ? '<textarea id="sw-prompt-input" class="form-control" rows="' + rows + '" placeholder="' + placeholder + '">' + defaultValue + '</textarea>' : '<input type="text" id="sw-prompt-input" class="form-control" placeholder="' + placeholder + '" value="' + defaultValue + '">';
      modalEl.innerHTML = '<div class="sw-modal sw-dialog-modal" style="max-width: 480px;"><div class="p-4"><div class="d-flex align-items-center gap-2 mb-2"><span class="fs-4">\ud83d\udcdd</span><h5 class="fw-bold mb-0 text-dark">' + title + '</h5></div><p class="text-secondary small mb-3">' + message + '</p><div class="mb-3">' + inputHtml + '<div id="sw-prompt-err" class="text-danger small mt-1" style="display: none;">This field is mandatory.</div></div><div class="d-flex justify-content-end gap-2"><button class="btn btn-outline-secondary px-3" id="sw-prompt-cancel-btn">' + cancelText + '</button><button class="btn btn-primary fw-bold px-4" id="sw-prompt-confirm-btn">' + confirmText + '</button></div></div></div>';
      document.body.appendChild(modalEl);
      const input = modalEl.querySelector("#sw-prompt-input");
      const errEl = modalEl.querySelector("#sw-prompt-err");
      const cancelBtn = modalEl.querySelector("#sw-prompt-cancel-btn");
      const confirmBtn = modalEl.querySelector("#sw-prompt-confirm-btn");
      input.focus();
      const cleanup = (result) => {
        modalEl.classList.add("sw-dialog-fadeout");
        setTimeout(() => {
          if (modalEl.parentElement) modalEl.parentElement.removeChild(modalEl);
          resolve(result);
        }, 200);
      };
      cancelBtn.onclick = () => cleanup(null);
      confirmBtn.onclick = () => {
        const val = input.value.trim();
        if (required && !val) {
          errEl.style.display = "block";
          input.focus();
          return;
        }
        cleanup(val);
      };
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (rows === 1 || e.ctrlKey || e.metaKey)) {
          confirmBtn.click();
        } else if (e.key === "Escape") {
          cleanup(null);
        }
      });
    });
  },
  alert({ title = "Notice", message = "", type = "info", buttonText = "Acknowledge" } = {}) {
    this.init();
    return new Promise((resolve) => {
      const icons = { success: "\u2705", error: "\u274c", warning: "\u26a0\ufe0f", info: "\u2139\ufe0f" };
      const modalEl = document.createElement("div");
      modalEl.className = "sw-modal-backdrop sw-dialog-backdrop";
      modalEl.innerHTML = '<div class="sw-modal sw-dialog-modal" style="max-width: 420px;"><div class="p-4 text-center"><div class="fs-1 mb-2">' + (icons[type] || "\u2139\ufe0f") + '</div><h5 class="fw-bold mb-2 text-dark">' + title + '</h5><p class="text-secondary small mb-4">' + message + '</p><button class="btn btn-primary w-100 fw-bold py-2 rounded-pill" id="sw-alert-ok-btn">' + buttonText + '</button></div></div>';
      document.body.appendChild(modalEl);
      const okBtn = modalEl.querySelector("#sw-alert-ok-btn");
      const cleanup = () => {
        modalEl.classList.add("sw-dialog-fadeout");
        setTimeout(() => {
          if (modalEl.parentElement) modalEl.parentElement.removeChild(modalEl);
          resolve();
        }, 200);
      };
      okBtn.onclick = cleanup;
      modalEl.onclick = (e) => { if (e.target === modalEl) cleanup(); };
    });
  }
};
window.addEventListener("DOMContentLoaded", () => { SWNotice.init(); });
