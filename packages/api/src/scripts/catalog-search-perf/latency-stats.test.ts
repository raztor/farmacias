import { describe, expect, it } from "vitest";

import { percentile, summarizeLatencies } from "./latency-stats";

const oneToHundred = Array.from({ length: 100 }, (_, index) => index + 1);

describe("percentile (nearest rank)", () => {
  it("returns the nearest-rank value of sorted samples", () => {
    expect(percentile(oneToHundred, 50)).toBe(50);
    expect(percentile(oneToHundred, 95)).toBe(95);
    expect(percentile(oneToHundred, 99)).toBe(99);
    expect(percentile(oneToHundred, 100)).toBe(100);
  });

  it("rounds the rank up for small samples", () => {
    expect(percentile([10, 20, 30], 50)).toBe(20);
    expect(percentile([10, 20, 30], 95)).toBe(30);
    expect(percentile([7], 99)).toBe(7);
  });

  it("rejects empty samples and invalid percentages", () => {
    expect(() => percentile([], 50)).toThrow(/no samples/);
    expect(() => percentile([1], 0)).toThrow(/invalid/);
    expect(() => percentile([1], 101)).toThrow(/invalid/);
  });
});

describe("summarizeLatencies", () => {
  it("summarizes unsorted samples without mutating them", () => {
    const samples = [...oneToHundred].reverse();

    expect(summarizeLatencies(samples)).toEqual({
      count: 100,
      min: 1,
      mean: 50.5,
      p50: 50,
      p95: 95,
      p99: 99,
      max: 100,
    });
    expect(samples[0]).toBe(100);
  });

  it("rejects an empty list", () => {
    expect(() => summarizeLatencies([])).toThrow(/no samples/);
  });

  it("rounds to hundredths of a millisecond", () => {
    expect(summarizeLatencies([1.23456, 2.34567])).toMatchObject({ min: 1.23, max: 2.35 });
  });
});
