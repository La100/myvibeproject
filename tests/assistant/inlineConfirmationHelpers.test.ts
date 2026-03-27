import assert from "node:assert/strict";
import test from "node:test";

import { shouldHideSectionCard } from "../../components/ai/assistant/ui/confirmations/helpers.ts";

test("shouldHideSectionCard keeps unrelated shopping section visible", () => {
  const hidden = shouldHideSectionCard({
    canonicalType: "shoppingSection",
    sectionCardName: "Bathroom",
    referencedSectionNames: {
      shopping: new Set(["Kitchen"]),
      labor: new Set(),
    },
    hiddenSectionMeta: {},
  });

  assert.equal(hidden, false);
});

test("shouldHideSectionCard hides section only when referenced by shopping items", () => {
  const hidden = shouldHideSectionCard({
    canonicalType: "shoppingSection",
    sectionCardName: "Bathroom",
    referencedSectionNames: {
      shopping: new Set(["Bathroom"]),
      labor: new Set(),
    },
    hiddenSectionMeta: {},
  });

  assert.equal(hidden, true);
});
