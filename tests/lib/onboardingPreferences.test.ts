import assert from "node:assert/strict";
import test from "node:test";

import {
  detectCurrency,
  isCurrencyCode,
} from "../../lib/onboardingPreferences.ts";

test("detectCurrency prefers explicit country code", () => {
  assert.equal(
    detectCurrency({
      countryCode: "PL",
      locale: "en-US",
      timezone: "America/New_York",
    }),
    "PLN",
  );
});

test("detectCurrency maps locale region to supported currency", () => {
  assert.equal(
    detectCurrency({
      locale: "en-GB",
    }),
    "GBP",
  );
});

test("detectCurrency falls back to timezone when locale has no region", () => {
  assert.equal(
    detectCurrency({
      locale: "en",
      timezone: "Europe/Warsaw",
    }),
    "PLN",
  );
});

test("detectCurrency returns fallback when nothing can be inferred", () => {
  assert.equal(
    detectCurrency({
      locale: "xx",
      timezone: "UTC",
      fallback: "EUR",
    }),
    "EUR",
  );
});

test("isCurrencyCode accepts only configured currency codes", () => {
  assert.equal(isCurrencyCode("USD"), true);
  assert.equal(isCurrencyCode("BTC"), false);
  assert.equal(isCurrencyCode(undefined), false);
});
