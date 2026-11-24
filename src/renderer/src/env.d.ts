import type { DiamindApi } from "@/shared/api";

declare global {
  interface Window {
    diamind: DiamindApi;
  }
}
