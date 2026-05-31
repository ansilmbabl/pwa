import { escapeHtml } from "./ui.js";

export function groupCategories(categories) {
  const tops = categories.filter((c) => !c.parentId);
  const childMap = new Map();
  categories.filter((c) => c.parentId).forEach((c) => {
    if (!childMap.has(c.parentId)) childMap.set(c.parentId, []);
    childMap.get(c.parentId).push(c);
  });
  childMap.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));

  const groups = tops.map((top) => ({
    top,
    children: childMap.get(top.id) || [],
  }));

  const groupedIds = new Set([...tops.map((t) => t.id), ...categories.filter((c) => c.parentId).map((c) => c.id)]);
  categories.filter((c) => !groupedIds.has(c.id)).forEach((orphan) => {
    groups.push({ top: orphan, children: [] });
  });

  return groups;
}

/** Selecting a parent also matches its subcategories in filters. */
export function expandCategorySelection(selectedIds, categories) {
  if (!selectedIds?.size) return selectedIds;
  const expanded = new Set(selectedIds);
  for (const id of selectedIds) {
    categories.filter((c) => c.parentId === id).forEach((c) => expanded.add(c.id));
  }
  return expanded;
}

export function getCategoryPickLabel(categories, id) {
  if (!id) return null;
  const cat = categories.find((c) => c.id === Number(id));
  if (!cat) return null;
  const icon = cat.icon ? `${cat.icon} ` : "";
  if (cat.parentId) {
    const parent = categories.find((c) => c.id === cat.parentId);
    if (parent) return `${icon}${parent.name} › ${cat.name}`;
  }
  return `${icon}${cat.name}`;
}

export function getCategoryFilterSummary(categories, selectedIds) {
  if (!selectedIds?.size) return "All categories";
  const labels = [...selectedIds]
    .map((id) => getCategoryPickLabel(categories, id))
    .filter(Boolean);
  if (!labels.length) return "All categories";
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.length} categories selected`;
}

function matchesSearch(cat, parent, q) {
  if (!q) return true;
  const hay = `${cat.name} ${parent?.name || ""}`.toLowerCase();
  return hay.includes(q);
}

function closePicker(overlay) {
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  setTimeout(() => overlay.remove(), 200);
}

/**
 * @param {object} opts
 * @param {string} [opts.title]
 * @param {Array} opts.categories
 * @param {number|null} [opts.selectedId] single-select
 * @param {Set<number>} [opts.selectedIds] multi-select (mutated on Apply)
 * @param {boolean} [opts.multi]
 * @param {(id: number) => void} [opts.onSelect]
 * @param {() => void} [opts.onApply]
 */
export function openCategoryPicker(opts) {
  const {
    title = "Categories",
    categories,
    selectedId = null,
    selectedIds,
    multi = false,
    onSelect,
    onApply,
  } = opts;

  const draft = multi ? new Set(selectedIds) : null;
  let searchQ = "";

  const overlay = document.createElement("div");
  overlay.className = "popup-overlay open cat-picker-overlay";
  overlay.setAttribute("aria-hidden", "false");
  overlay.innerHTML = `
    <div class="popup popup-lg cat-picker-sheet" role="dialog" aria-labelledby="catPickerTitle">
      <div class="popup-head">
        <h3 id="catPickerTitle">${escapeHtml(title)}</h3>
        <button type="button" class="popup-close cat-picker-close" aria-label="Close">✕</button>
      </div>
      <div class="popup-body">
        <input type="search" class="cat-picker-search" placeholder="Search categories…" autocomplete="off">
        <div class="cat-picker-list" role="listbox"></div>
        ${multi ? `<div class="popup-actions cat-picker-actions">
          <button type="button" class="btn btn-secondary cat-picker-clear">Clear all</button>
          <button type="button" class="btn cat-picker-apply">Apply</button>
        </div>` : ""}
      </div>
    </div>`;

  const listEl = overlay.querySelector(".cat-picker-list");
  const searchEl = overlay.querySelector(".cat-picker-search");

  function renderList() {
    const q = searchQ.trim().toLowerCase();
    const groups = groupCategories(categories);
    let html = "";

    for (const { top, children } of groups) {
      const visibleChildren = children.filter((c) => matchesSearch(c, top, q));
      const topVisible = matchesSearch(top, null, q) || visibleChildren.length;
      if (!topVisible) continue;

      if (children.length) {
        html += `<div class="cat-picker-group" role="group" aria-label="${escapeHtml(top.name)}">`;
        html += `<div class="cat-picker-parent">${escapeHtml(top.icon || "📦")} ${escapeHtml(top.name)}</div>`;
      }

      const renderItem = (cat, isChild) => {
        const id = cat.id;
        const selected = multi ? draft.has(id) : Number(selectedId) === id;
        const cls = `cat-picker-item${isChild ? " cat-picker-child" : ""}${selected ? " selected" : ""}`;
        if (multi) {
          html += `<label class="${cls}">
            <input type="checkbox" data-cat-id="${id}" ${selected ? "checked" : ""}>
            <span>${escapeHtml(cat.icon || "📦")} ${escapeHtml(cat.name)}</span>
          </label>`;
        } else {
          html += `<button type="button" class="${cls}" data-cat-id="${id}" role="option" aria-selected="${selected}">
            ${escapeHtml(cat.icon || "📦")} ${escapeHtml(isChild ? cat.name : cat.name)}
          </button>`;
        }
      };

      if (!children.length) {
        if (matchesSearch(top, null, q)) renderItem(top, false);
      } else {
        if (matchesSearch(top, null, q) && !q) renderItem(top, false);
        visibleChildren.forEach((c) => renderItem(c, true));
        html += `</div>`;
      }
    }

    if (!html) {
      html = `<p class="muted hint cat-picker-empty">No categories match</p>`;
    }
    listEl.innerHTML = html;

    if (multi) {
      listEl.querySelectorAll("input[type=checkbox]").forEach((inp) => {
        inp.addEventListener("change", () => {
          const id = Number(inp.dataset.catId);
          if (inp.checked) draft.add(id);
          else draft.delete(id);
          inp.closest(".cat-picker-item")?.classList.toggle("selected", inp.checked);
        });
      });
    } else {
      listEl.querySelectorAll(".cat-picker-item[data-cat-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
          onSelect?.(Number(btn.dataset.catId));
          closePicker(overlay);
        });
      });
    }
  }

  searchEl.addEventListener("input", () => {
    searchQ = searchEl.value;
    renderList();
  });

  overlay.querySelector(".cat-picker-close")?.addEventListener("click", () => closePicker(overlay));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closePicker(overlay);
  });

  if (multi) {
    overlay.querySelector(".cat-picker-clear")?.addEventListener("click", () => {
      draft.clear();
      renderList();
    });
    overlay.querySelector(".cat-picker-apply")?.addEventListener("click", () => {
      selectedIds.clear();
      draft.forEach((id) => selectedIds.add(id));
      onApply?.();
      closePicker(overlay);
    });
  }

  document.body.style.overflow = "hidden";
  document.body.appendChild(overlay);
  renderList();
  setTimeout(() => searchEl.focus(), 80);
}
