import { describe, expect, it } from "vitest";
import { Pool } from "./pool";

function counterPool(maxFree: number) {
  let next = 0;
  const destroyed: number[] = [];
  const pool = new Pool(
    () => next++,
    (item: number) => destroyed.push(item),
    maxFree,
  );
  return { pool, destroyed };
}

describe("Pool", () => {
  it("creates items while none is free", () => {
    const { pool } = counterPool(10);
    expect([pool.acquire(), pool.acquire()]).toEqual([0, 1]);
    expect(pool.createdCount).toBe(2);
  });

  it("reuses released items", () => {
    const { pool } = counterPool(10);
    const item = pool.acquire();
    pool.release(item);
    expect(pool.acquire()).toBe(item);
    expect(pool.createdCount).toBe(1);
  });

  it("keeps the created count bounded when items move through it", () => {
    const { pool } = counterPool(10);
    const visible = Array.from({ length: 5 }, () => pool.acquire());
    for (let step = 0; step < 100; step++) {
      pool.release(visible.shift() as number);
      visible.push(pool.acquire());
    }
    expect(pool.createdCount).toBe(5);
  });

  it("destroys released items above maxFree", () => {
    const { pool, destroyed } = counterPool(1);
    const a = pool.acquire();
    const b = pool.acquire();
    pool.release(a);
    pool.release(b);
    expect(pool.freeCount).toBe(1);
    expect(destroyed).toEqual([b]);
  });

  it("destroys the free items on clear", () => {
    const { pool, destroyed } = counterPool(10);
    const a = pool.acquire();
    pool.release(a);
    pool.clear();
    expect(destroyed).toEqual([a]);
    expect(pool.freeCount).toBe(0);
  });
});
