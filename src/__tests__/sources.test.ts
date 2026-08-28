import { describe, expect, it } from "vitest";
import { parseNwsWind } from "../worker/sources";

describe("parseNwsWind", () => {
  it("parses a single speed", () => {
    expect(parseNwsWind("15 mph")).toBe(15);
    expect(parseNwsWind("0 mph")).toBe(0);
  });

  it("takes the upper bound of a range", () => {
    expect(parseNwsWind("5 to 10 mph")).toBe(10);
    expect(parseNwsWind("20 to 30 mph")).toBe(30);
  });

  it("returns null for missing or unparseable values", () => {
    expect(parseNwsWind(null)).toBeNull();
    expect(parseNwsWind(undefined)).toBeNull();
    expect(parseNwsWind("")).toBeNull();
    expect(parseNwsWind("calm")).toBeNull();
  });
});
