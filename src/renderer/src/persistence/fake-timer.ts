import type { Timer } from "@/renderer/src/persistence/write-queue";

/** A timer for tests. Calls run only inside `advance`. */
export class FakeTimer implements Timer {
  private now = 0;
  private calls: { at: number; run: () => void }[] = [];

  schedule(run: () => void, delayMs: number): () => void {
    const call = { at: this.now + delayMs, run };
    this.calls.push(call);
    return () => {
      this.calls = this.calls.filter((other) => other !== call);
    };
  }

  /** Also lets the promises settle. */
  async advance(ms: number): Promise<void> {
    this.now += ms;
    const due = this.calls.filter((call) => call.at <= this.now);
    this.calls = this.calls.filter((call) => call.at > this.now);
    for (const call of due) {
      call.run();
    }
    await settle();
  }

  get scheduledCount(): number {
    return this.calls.length;
  }
}

export function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}
