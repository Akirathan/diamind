/** Reuses objects that are expensive to create. Keeps at most `maxFree` released objects. */
export class Pool<T> {
  private readonly free: T[] = [];
  private created = 0;

  constructor(
    private readonly create: () => T,
    private readonly destroy: (item: T) => void,
    private readonly maxFree: number,
  ) {}

  get createdCount(): number {
    return this.created;
  }

  get freeCount(): number {
    return this.free.length;
  }

  acquire(): T {
    const item = this.free.pop();
    if (item !== undefined) {
      return item;
    }
    this.created++;
    return this.create();
  }

  release(item: T): void {
    if (this.free.length < this.maxFree) {
      this.free.push(item);
    } else {
      this.destroy(item);
    }
  }

  clear(): void {
    for (const item of this.free) {
      this.destroy(item);
    }
    this.free.length = 0;
  }
}
