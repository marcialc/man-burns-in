import { describe, expect, it } from "vitest";
import {
  GATES_OPEN_MS,
  MAN_BURN_MS,
  TEMPLE_BURN_MS,
  formatCountdown,
  resolvePhase,
} from "../lib/countdown";

describe("resolvePhase", () => {
  it("is 'before' well ahead of gates", () => {
    const p = resolvePhase(new Date("2026-07-08T12:00:00Z"));
    expect(p.kind).toBe("before");
    expect(p.label).toBe("");
    expect(p.target).toBe(GATES_OPEN_MS);
  });

  it("is 'before' one second before gates open", () => {
    expect(resolvePhase(new Date(GATES_OPEN_MS - 1000)).kind).toBe("before");
  });

  it("flips to 'onPlaya' exactly at gates open", () => {
    const p = resolvePhase(new Date(GATES_OPEN_MS));
    expect(p.kind).toBe("onPlaya");
    expect(p.label).toBe("The Man burns in");
    expect(p.target).toBe(MAN_BURN_MS);
  });

  it("stays 'onPlaya' until the Man burn", () => {
    expect(resolvePhase(new Date(MAN_BURN_MS - 1000)).kind).toBe("onPlaya");
  });

  it("flips to 'betweenBurns' at the Man burn", () => {
    const p = resolvePhase(new Date(MAN_BURN_MS));
    expect(p.kind).toBe("betweenBurns");
    expect(p.label).toBe("The Temple burns in");
    expect(p.target).toBe(TEMPLE_BURN_MS);
  });

  it("stays 'betweenBurns' until the Temple burn", () => {
    expect(resolvePhase(new Date(TEMPLE_BURN_MS - 1000)).kind).toBe("betweenBurns");
  });

  it("is 'after' at and past the Temple burn", () => {
    const p = resolvePhase(new Date(TEMPLE_BURN_MS));
    expect(p.kind).toBe("after");
    expect(p.label).toBe("See you in the dust 🔥");
    expect(p.target).toBeUndefined();
  });
});

describe("formatCountdown", () => {
  it("formats days/hours/minutes/seconds with zero-padding", () => {
    const ms = ((53 * 24 + 4) * 3600 + 12 * 60 + 9) * 1000;
    expect(formatCountdown(ms)).toBe("53d 04h 12m 09s");
  });

  it("clamps negatives to zero", () => {
    expect(formatCountdown(-5000)).toBe("0d 00h 00m 00s");
  });

  it("handles exact day boundaries", () => {
    expect(formatCountdown(24 * 3600 * 1000)).toBe("1d 00h 00m 00s");
  });
});
