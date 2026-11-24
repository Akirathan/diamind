import { fileURLToPath } from "node:url";
import { parseLinkUrl } from "@/shared/link-url";

/** The functions of Electron's `shell` that open a link. */
export interface LinkOpener {
  openExternal(url: string): Promise<void>;
  openPath(path: string): Promise<string>;
}

/** Throws for a URL with another protocol. The URL comes from the renderer, so it is not trusted. */
export async function openLink(
  url: unknown,
  opener: LinkOpener,
): Promise<void> {
  const parsed = typeof url === "string" ? parseLinkUrl(url) : null;
  if (parsed === null) {
    throw new Error("Not a http, https or file URL");
  }
  if (parsed.protocol !== "file:") {
    await opener.openExternal(parsed.href);
    return;
  }
  // On Windows, a file URL with a host is a network share.
  if (parsed.host !== "") {
    throw new Error("A file URL must not have a host");
  }
  const error = await opener.openPath(fileURLToPath(parsed));
  if (error !== "") {
    throw new Error(error);
  }
}
