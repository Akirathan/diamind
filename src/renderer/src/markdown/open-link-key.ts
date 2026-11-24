const isMac = navigator.platform.startsWith("Mac");

/** On macOS, `Ctrl` + click is a right click. */
function hasOpenLinkKey(event: MouseEvent | KeyboardEvent): boolean {
  return isMac ? event.metaKey : event.ctrlKey;
}

export function isOpenLinkClick(event: MouseEvent): boolean {
  return hasOpenLinkKey(event) && !event.shiftKey && !event.altKey;
}

/** Marks the document while the key that opens links is pressed, for the mouse cursor over links. */
export function trackOpenLinkKey(): void {
  const root = document.documentElement;

  function update(event: MouseEvent | KeyboardEvent) {
    root.toggleAttribute("data-open-link-key", hasOpenLinkKey(event));
  }

  window.addEventListener("keydown", update, true);
  window.addEventListener("keyup", update, true);
  window.addEventListener("mousemove", update, true);
  window.addEventListener("blur", () => {
    root.removeAttribute("data-open-link-key");
  });
}
