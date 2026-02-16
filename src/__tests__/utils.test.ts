import { describe, expect, it } from "vitest";
import { uid, clamp, toHHMM } from "../utils";

describe("uid", () => {
  it("generates a string with the given prefix", () => {
    const id = uid("cat");
    expect(id).toMatch(/^cat_[a-z0-9]{7}$/);
  });

  it("uses 'id' as default prefix", () => {
    const id = uid();
    expect(id).toMatch(/^id_[a-z0-9]{7}$/);
  });

  it("generates unique values on successive calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => uid()));
    expect(ids.size).toBe(100);
  });
});

describe("clamp", () => {
  it("returns n when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps to minimum when n < a", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it("clamps to maximum when n > b", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("returns a when n equals a", () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it("returns b when n equals b", () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it("works with negative ranges", () => {
    expect(clamp(0, -5, -1)).toBe(-1);
    expect(clamp(-10, -5, -1)).toBe(-5);
    expect(clamp(-3, -5, -1)).toBe(-3);
  });

  it("works when a equals b", () => {
    expect(clamp(5, 3, 3)).toBe(3);
    expect(clamp(1, 3, 3)).toBe(3);
  });
});

describe("toHHMM", () => {
  it("formats single-digit hours with leading zero", () => {
    expect(toHHMM(7)).toBe("07:00");
    expect(toHHMM(0)).toBe("00:00");
    expect(toHHMM(9)).toBe("09:00");
  });

  it("formats double-digit hours without extra padding", () => {
    expect(toHHMM(10)).toBe("10:00");
    expect(toHHMM(22)).toBe("22:00");
    expect(toHHMM(23)).toBe("23:00");
  });

  it("formats midnight as 00:00", () => {
    expect(toHHMM(0)).toBe("00:00");
  });
});
