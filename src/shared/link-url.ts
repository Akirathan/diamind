/** Parses the URL of a link. Returns `null` for anything but `http://`, `https://` and `file://`. */
export function parseLinkUrl(text: string): URL | null {
  if (!/^(?:https?|file):\/\//i.test(text) || !URL.canParse(text)) {
    return null;
  }
  return new URL(text);
}
