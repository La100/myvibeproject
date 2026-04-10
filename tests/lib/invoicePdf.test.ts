import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { generateInvoicePdf, sanitizeFileName } from "../../lib/invoicePdf.ts";

const createInvoiceInput = () => ({
  invoiceNumber: "INV/2026/0001",
  issuedAt: Date.parse("2026-03-15T00:00:00Z"),
  dueDate: Date.parse("2026-03-20T00:00:00Z"),
  amount: 1234.56,
  currency: "PLN",
  lineText: "Projekt testowy - zaliczka",
  paymentReference: "REF-123",
  seller: {
    name: "MyVibe Sp. z o.o.",
    addressLines: ["ul. Testowa 1", "00-001 Warszawa", "Polska"],
    taxId: "1234567890",
    email: "seller@example.com",
    phone: "+48123123123",
    bankAccountHolder: "MyVibe Sp. z o.o.",
    bankName: "mBank",
    bankAccountNumber: "12 3456 7890 1234 5678 9012 3456",
    paymentInstructions: "Zapłata przelewem.",
  },
  customer: {
    name: "Klient Testowy",
    addressLines: ["ul. Kliencka 2", "00-002 Kraków", "Polska"],
    email: "client@example.com",
  },
});

test("generateInvoicePdf does not depend on runtime filesystem fonts", () => {
  const originalReadFileSync = fs.readFileSync;
  fs.readFileSync = (() => {
    throw new Error("readFileSync should not be called while generating invoice PDF");
  }) as typeof fs.readFileSync;

  try {
    const pdfBuffer = generateInvoicePdf(createInvoiceInput());

    assert.equal(pdfBuffer.subarray(0, 4).toString("ascii"), "%PDF");
    assert.ok(pdfBuffer.length > 1000);
    assert.ok(pdfBuffer.includes(Buffer.from("ArialUnicode")));
  } finally {
    fs.readFileSync = originalReadFileSync;
  }
});

test("sanitizeFileName preserves a safe invoice fallback", () => {
  assert.equal(sanitizeFileName("  FÄ/2026: ąść  "), "fa2026-asc");
  assert.equal(sanitizeFileName("   "), "invoice");
});
