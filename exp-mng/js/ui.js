let toastTimer;

export function toast(msg, type = "info") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `toast toast-${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}

export function confirmInline(container, message, onConfirm) {
  container.innerHTML = `
    <div class="inline-confirm">
      <span>${message}</span>
      <button type="button" class="btn-sm btn-danger confirm-yes">Delete</button>
      <button type="button" class="btn-sm btn-secondary confirm-no">Cancel</button>
    </div>`;
  container.querySelector(".confirm-yes").onclick = () => onConfirm();
  container.querySelector(".confirm-no").onclick = () => { container.innerHTML = ""; };
}

export function showModal(title, bodyHtml, actions = []) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h3>${title}</h3>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-actions"></div>
    </div>`;
  const actionsEl = overlay.querySelector(".modal-actions");
  if (!actions.length) {
    actions = [{ label: "Close", className: "btn btn-secondary", onClick: () => {} }];
  }
  actions.forEach(({ label, className, onClick, keepOpen }) => {
    const btn = document.createElement("button");
    btn.className = className || "btn";
    btn.textContent = label;
    btn.onclick = () => {
      onClick();
      if (!keepOpen) overlay.remove();
    };
    actionsEl.appendChild(btn);
  });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.style.overflow = "hidden";
  overlay.addEventListener("remove", () => { document.body.style.overflow = ""; });
  const observer = new MutationObserver(() => {
    if (!document.body.contains(overlay)) {
      document.body.style.overflow = "";
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });
  document.body.appendChild(overlay);
  return overlay;
}

let currencySymbol = "₹";

export function setCurrencySymbol(sym) {
  currencySymbol = sym || "₹";
}

export function formatCurrency(n) {
  return `${currencySymbol}${Number(n || 0).toFixed(2)}`;
}

export function setLoading(on) {
  document.body.classList.toggle("loading", on);
}

export function categoryDot(color) {
  return `<span class="cat-dot" style="background:${color || "#64748b"}"></span>`;
}

export function escapeHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function categoryOptionLabel(c) {
  const icon = c.icon ? `${c.icon} ` : "";
  if (c.parentId) return `  └ ${icon}${escapeHtml(c.name)}`;
  return `${icon}${escapeHtml(c.name)}`;
}
