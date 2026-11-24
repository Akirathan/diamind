import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/renderer/src/App";
import { trackOpenLinkKey } from "@/renderer/src/markdown/open-link-key";
import "@/renderer/src/index.css";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("Missing #root element");
}

trackOpenLinkKey();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
