import { describe, expect, it } from "vitest";
import {
  isValidPrecipSeries,
  isValidSourceDate,
  isValidTempSeries,
} from "../worker/validate";

const flat = (v: number): number[] => new Array(24).fill(v);

describe("isValidTempSeries", () => {
  it("accepts 24 in-range values", () => {
    expect(isValidTempSeries(flat(72))).toBe(true);
  });
  it("accepts the boundary values", () => {
    expect(isValidTempSeries(flat(-20))).toBe(true);
    expect(isValidTempSeries(flat(130))).toBe(true);
  });
  it("rejects out-of-range temps", () => {
    expect(isValidTempSeries(flat(131))).toBe(false);
    expect(isValidTempSeries(flat(-21))).toBe(false);
  });
  it("rejects a null slot", () => {
    expect(isValidTempSeries([...flat(72).slice(0, 23), null])).toBe(false);
  });
  it("rejects the wrong length", () => {
    expect(isValidTempSeries(flat(72).slice(0, 23))).toBe(false);
    expect(isValidTempSeries(undefined)).toBe(false);
  });
  it("rejects NaN", () => {
    expect(isValidTempSeries([...flat(72).slice(0, 23), NaN])).toBe(false);
  });
});

describe("isValidPrecipSeries", () => {
  it("accepts 0–100", () => {
    expect(isValidPrecipSeries(flat(0))).toBe(true);
    expect(isValidPrecipSeries(flat(100))).toBe(true);
  });
  it("rejects >100 or <0", () => {
    expect(isValidPrecipSeries(flat(101))).toBe(false);
    expect(isValidPrecipSeries(flat(-1))).toBe(false);
  });
});

describe("isValidSourceDate", () => {
  it("requires both temp and precip valid", () => {
    expect(isValidSourceDate(flat(72), flat(10))).toBe(true);
    expect(isValidSourceDate(flat(72), flat(101))).toBe(false);
    expect(isValidSourceDate(flat(200), flat(10))).toBe(false);
  });
});
