import { describe, it, expect, vi } from "vitest";
import { createCart } from "./cart";

describe("cart total", () => {
  it.each([
    { items: [], total: 0 },
    { items: [{ price: 3, qty: 2 }], total: 6 },
    { items: [{ price: 3, qty: 1 }, { price: 1.5, qty: 2 }], total: 6 },
  ])("sums price times quantity ($total)", ({ items, total }) => {
    const cart = createCart(items);
    expect(cart.total()).toBe(total);
  });

  it("rejects a negative quantity", () => {
    expect(() => createCart([{ price: 3, qty: -1 }])).toThrow("quantity must be positive");
  });

  it("expires a reservation after 15 minutes", () => {
    vi.useFakeTimers();
    const cart = createCart([{ price: 3, qty: 1 }]);
    vi.advanceTimersByTime(15 * 60 * 1000);
    expect(cart.isReserved()).toBe(false);
    vi.useRealTimers();
  });

  it("rejects checkout of an empty cart", async () => {
    await expect(createCart([]).checkout()).rejects.toThrow("cart is empty");
  });
});
