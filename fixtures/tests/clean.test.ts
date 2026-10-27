import { describe, it, expect, test, vi } from "vitest";
import { createCart } from "./cart";

function expectTotal(cart: ReturnType<typeof createCart>, total: number) {
  expect(cart.total()).toBe(total);
}

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

  test("applies a coupon through a helper", { timeout: 1000 }, () => {
    const label = `coupon ${["a", "b"].map((c) => `${c}}`).join("")}`;
    const cart = createCart([{ price: 3, qty: 2 }], { coupon: label.replace(/[{}]/g, "") });
    expectTotal(cart, 5);
  });

  it("reports the failing line item", async () => {
    expect.assertions(1);
    try {
      await createCart([{ price: 3, qty: 1 }]).checkout({ card: "declined" });
    } catch (e) {
      expect((e as Error).message).toBe("card declined: line 1");
    }
  });

  it("flushes pending work before reading the total", async () => {
    const cart = createCart([{ price: 3, qty: 1 }]);
    await new Promise((r) => setTimeout(r, 0));
    expect(cart.total()).toBe(3);
  });
});
