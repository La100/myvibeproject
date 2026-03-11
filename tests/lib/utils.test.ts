import assert from "node:assert/strict";
import test from "node:test";

import {
  cn,
  formatCurrency,
  getTaskPreview,
  htmlToPlainText,
} from "../../lib/utils.ts";

const decodeEntities = (value: string) =>
  value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const installDocumentStub = () => {
  const originalDocument = (globalThis as { document?: unknown }).document;

  (globalThis as { document?: unknown }).document = {
    createElement() {
      return {
        _innerHTML: "",
        value: "",
        set innerHTML(next: string) {
          this._innerHTML = next;
          this.value = decodeEntities(next);
        },
        get innerHTML() {
          return this._innerHTML;
        },
      };
    },
  };

  return () => {
    if (originalDocument === undefined) {
      delete (globalThis as { document?: unknown }).document;
      return;
    }

    (globalThis as { document?: unknown }).document = originalDocument;
  };
};

test("cn merges class names and tailwind conflicts", () => {
  assert.equal(cn("px-2", false && "hidden", "px-4", "font-bold"), "px-4 font-bold");
});

test("htmlToPlainText strips html, decodes entities and truncates words", () => {
  const restore = installDocumentStub();

  try {
    const value = htmlToPlainText(
      "<p>Hello &amp; <strong>world</strong> from <em>Myvibe</em></p>",
      3,
    );

    assert.equal(value, "Hello & world...");
  } finally {
    restore();
  }
});

test("getTaskPreview prefers rich text content over description", () => {
  const restore = installDocumentStub();

  try {
    const preview = getTaskPreview(
      {
        content: "<div>Projekt <strong>startuje</strong> jutro rano</div>",
        description: "Opis zapasowy",
      },
      2,
    );

    assert.equal(preview, "Projekt startuje...");
  } finally {
    restore();
  }
});

test("getTaskPreview falls back to trimmed description", () => {
  const preview = getTaskPreview(
    {
      description: "Raz dwa trzy cztery",
    },
    3,
  );

  assert.equal(preview, "Raz dwa trzy...");
});

test("formatCurrency uses locale-aware formatting when possible", () => {
  const value = formatCurrency(1234.5, "PLN");
  assert.match(value, /1[\s\xa0]?234,50/);
  assert.match(value, /zł/);
});

test("formatCurrency falls back when Intl.NumberFormat throws", () => {
  const originalNumberFormat = Intl.NumberFormat;

  Intl.NumberFormat = class BrokenNumberFormat {
    constructor() {
      throw new Error("boom");
    }
  } as unknown as typeof Intl.NumberFormat;

  try {
    assert.equal(formatCurrency(42, "USD"), "42.00 $");
  } finally {
    Intl.NumberFormat = originalNumberFormat;
  }
});
