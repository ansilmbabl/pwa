import { escapeHtml } from "./ui.js";
import { openCategoryPicker, getCategoryFilterSummary, expandCategorySelection } from "./category-picker.js";

/** @param {Set<number>} selectedIds mutated in place */
export function renderCategoryFilterTrigger(container, categories, selectedIds, onChange, label = "Categories") {
  if (!container) return;

  const summary = getCategoryFilterSummary(categories, selectedIds);
  const hasFilter = selectedIds.size > 0;

  container.innerHTML = `
    <button type="button" class="cat-pick-trigger cat-filter-trigger${hasFilter ? " has-filter" : ""}">
      <span class="cat-pick-label">${escapeHtml(summary)}</span>
      <span class="cat-pick-chevron" aria-hidden="true">›</span>
    </button>`;

  container.querySelector(".cat-filter-trigger")?.addEventListener("click", () => {
    if (!categories.length) {
      container.innerHTML = `<p class="muted hint">No categories yet</p>`;
      return;
    }
    openCategoryPicker({
      title: label,
      categories,
      selectedIds,
      multi: true,
      onApply: onChange,
    });
  });
}

export function bindCategoryFilterClear(clearBtn, selectedIds, onChange) {
  clearBtn?.addEventListener("click", () => {
    selectedIds.clear();
    onChange();
  });
}

export function categoryFilterMatches(categoryId, selectedIds, categories = []) {
  if (!selectedIds.size) return true;
  const expanded = expandCategorySelection(selectedIds, categories);
  return expanded.has(categoryId);
}

export async function populateCategoryFilter(container, selectedIds, onChange, getCategories) {
  const cats = await getCategories();
  renderCategoryFilterTrigger(container, cats, selectedIds, onChange);
}
