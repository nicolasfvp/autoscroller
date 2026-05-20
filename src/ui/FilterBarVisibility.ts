// Coordinates visibility of HTML <input>s belonging to CardFilterBar
// instances. Those inputs are appended to document.body and live above the
// Phaser canvas in the DOM stacking order — Phaser depth has no effect on
// them. When a card detail popup or hover tooltip opens, callers invoke
// `hideFilterBarInputs()` so the input doesn't visually punch through; the
// matching `showFilterBarInputs()` restores them.
//
// Reference-counted so concurrent show/hide consumers (a popup AND a hover
// tooltip both visible at once) don't fight each other.

let hideRefCount = 0;

function applyVisibility(): void {
  const inputs = document.querySelectorAll<HTMLInputElement>('[data-card-filter-bar]');
  const shouldHide = hideRefCount > 0;
  inputs.forEach((el) => {
    el.style.display = shouldHide ? 'none' : '';
  });
}

export function hideFilterBarInputs(): void {
  hideRefCount += 1;
  applyVisibility();
}

export function showFilterBarInputs(): void {
  if (hideRefCount > 0) hideRefCount -= 1;
  applyVisibility();
}

// Test-only escape hatch — vitest can reset the counter between cases.
export function _resetFilterBarVisibility(): void {
  hideRefCount = 0;
  applyVisibility();
}
