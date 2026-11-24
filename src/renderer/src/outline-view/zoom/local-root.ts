/** The node that is zoomed into. Fits `useSyncExternalStore`. */
export class LocalRoot {
  private readonly listeners = new Set<() => void>();

  constructor(private id: string) {}

  readonly get = (): string => this.id;

  set(id: string): void {
    if (id === this.id) {
      return;
    }
    this.id = id;
    for (const listener of this.listeners) {
      listener();
    }
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
