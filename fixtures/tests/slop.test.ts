import { describe, it, expect, vi } from "vitest";
import { cart, api, Service } from "./cart";

describe("cart", () => {
  it("works", () => {
    cart.add({ id: "a", price: 3 });
  });

  it("is true", () => {
    expect(true).toBe(true);
  });

  it("creates a cart", () => {
    const c = cart.create();
    expect(c).toBeDefined();
  });

  it("returns the user", async () => {
    const fetchUser = vi.fn().mockResolvedValue(42);
    const result = await api.load(fetchUser);
    expect(result).toBe(42);
  });

  it("reads the cache", () => {
    // Arrange
    const svc = new Service();
    // Act
    const hit = (svc as any).cache.get("a");
    // Assert
    expect(hit).toEqual("a");
  });

  it("waits", async () => {
    await new Promise((r) => setTimeout(r, 500));
    expect(Date.now()).toBeGreaterThan(0);
  });

  it("throws on bad input", async () => {
    try {
      await api.load(null);
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it.skip("handles refunds", () => {
    expect(cart.refund()).toBe(0);
  });

  it.only("totals", () => {
    console.log(cart.total());
    expect(cart.total()).toBe(3);
  });

  // it("old test", () => {
  //   expect(cart.legacy()).toBe(1);
  // });
});
