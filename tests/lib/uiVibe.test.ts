import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_UI_VIBE,
  UI_VIBES,
  getAvailableUiVibes,
  getUiVibe,
  getUiVibeCssVariables,
  resolveUiVibeId,
} from "../../lib/ui-system/vibe.ts";

test("resolveUiVibeId falls back to default for missing or unknown values", () => {
  assert.equal(resolveUiVibeId(), DEFAULT_UI_VIBE);
  assert.equal(resolveUiVibeId("unknown"), DEFAULT_UI_VIBE);
});

test("resolveUiVibeId is case-insensitive and trims whitespace", () => {
  assert.equal(resolveUiVibeId("  GRAPHITE "), "graphite");
});

test("getUiVibe returns the configured definition", () => {
  const vibe = getUiVibe("linen");

  assert.equal(vibe.id, "linen");
  assert.equal(vibe.label, UI_VIBES.linen.label);
});

test("getUiVibeCssVariables exposes light and dark token sets", () => {
  const variables = getUiVibeCssVariables("graphite") as Record<string, string>;

  assert.equal(variables["--vibe-radius"], UI_VIBES.graphite.radius);
  assert.equal(
    variables["--vibe-light-background"],
    UI_VIBES.graphite.light.background,
  );
  assert.equal(
    variables["--vibe-dark-ui-gradient-brand"],
    UI_VIBES.graphite.dark.uiGradientBrand,
  );
});

test("getAvailableUiVibes exposes all configured vibe ids", () => {
  assert.deepEqual(getAvailableUiVibes().sort(), ["graphite", "linen"]);
});
