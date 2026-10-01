import { describe, expect, it } from "vitest";
import {
  checkoutOption,
  isValidSignature,
  midtransSignature,
  parseGrossAmount,
  paymentOutcome,
  prorataCredit,
  renewalStart,
} from "./payment";

const KEY = "SB-Mid-server-contoh";

describe("signature Midtrans", () => {
  const base = { order_id: "SMI-261001-ABCD1234", status_code: "200", gross_amount: "39000.00" };

  it("menerima signature yang benar", () => {
    const signature_key = midtransSignature(base.order_id, base.status_code, base.gross_amount, KEY);
    expect(signature_key).toMatch(/^[0-9a-f]{128}$/);
    expect(isValidSignature({ ...base, signature_key }, KEY)).toBe(true);
  });

  it("menolak signature salah, nominal diubah, atau field hilang", () => {
    const signature_key = midtransSignature(base.order_id, base.status_code, base.gross_amount, KEY);
    expect(isValidSignature({ ...base, signature_key }, "kunci-lain")).toBe(false);
    expect(isValidSignature({ ...base, gross_amount: "1.00", signature_key }, KEY)).toBe(false);
    expect(isValidSignature({ ...base, signature_key: "abc" }, KEY)).toBe(false);
    expect(isValidSignature({ order_id: base.order_id, signature_key }, KEY)).toBe(false);
    expect(isValidSignature({ ...base, signature_key }, "")).toBe(false);
  });
});

describe("parseGrossAmount", () => {
  it("rupiah bulat dari string Midtrans", () => {
    expect(parseGrossAmount("39000.00")).toBe(39000);
    expect(parseGrossAmount("39000")).toBe(39000);
    expect(parseGrossAmount(129000)).toBe(129000);
  });

  it("menolak pecahan, negatif, dan teks", () => {
    expect(parseGrossAmount("39000.50")).toBeNull();
    expect(parseGrossAmount("-1")).toBeNull();
    expect(parseGrossAmount("abc")).toBeNull();
    expect(parseGrossAmount(null)).toBeNull();
  });
});

describe("paymentOutcome", () => {
  it("memetakan status transaksi", () => {
    expect(paymentOutcome("settlement")).toBe("paid");
    expect(paymentOutcome("capture", "accept")).toBe("paid");
    expect(paymentOutcome("capture", "challenge")).toBe("pending");
    expect(paymentOutcome("pending")).toBe("pending");
    expect(paymentOutcome("expire")).toBe("expired");
    expect(paymentOutcome("deny")).toBe("failed");
    expect(paymentOutcome("cancel")).toBe("failed");
    expect(paymentOutcome("refund")).toBeNull();
  });
});

describe("prorataCredit", () => {
  const start = new Date("2026-10-01T00:00:00Z");
  const end = new Date("2026-10-31T00:00:00Z");

  it("sisa nilai dibulatkan ke bawah", () => {
    expect(prorataCredit(39000, start, end, new Date("2026-10-16T00:00:00Z"))).toBe(19500);
    expect(prorataCredit(39000, start, end, new Date("2026-10-11T00:00:00Z"))).toBe(26000);
    expect(prorataCredit(69000, start, end, new Date("2026-10-30T23:00:00Z"))).toBe(95);
  });

  it("nol kalau periode sudah lewat", () => {
    expect(prorataCredit(39000, start, end, new Date("2026-11-01T00:00:00Z"))).toBe(0);
  });
});

describe("checkoutOption", () => {
  const now = new Date("2026-10-20T00:00:00Z");

  it("baru dari Benih atau trial", () => {
    expect(checkoutOption(null, 39000, now)).toEqual({ kind: "baru", opensAt: null });
    expect(checkoutOption({ status: "trialing", priceMonthly: 39000, periodEnd: null }, 39000, now).kind).toBe("baru");
  });

  it("upgrade ke paket lebih mahal kapan saja", () => {
    const current = { status: "active", priceMonthly: 39000, periodEnd: "2026-11-15T00:00:00Z" };
    expect(checkoutOption(current, 69000, now)).toEqual({ kind: "upgrade", opensAt: null });
  });

  it("perpanjang baru bisa 7 hari sebelum periode berakhir", () => {
    const early = { status: "active", priceMonthly: 69000, periodEnd: "2026-11-15T00:00:00Z" };
    expect(checkoutOption(early, 39000, now)).toEqual({
      kind: "perpanjang",
      opensAt: new Date("2026-11-08T00:00:00Z"),
    });
    const soon = { status: "active", priceMonthly: 69000, periodEnd: "2026-10-25T00:00:00Z" };
    expect(checkoutOption(soon, 69000, now)).toEqual({ kind: "perpanjang", opensAt: null });
  });
});

describe("renewalStart", () => {
  const end = new Date("2026-10-31T00:00:00Z");

  it("lanjut dari akhir periode selama tenggang", () => {
    expect(renewalStart(end, new Date("2026-10-28T00:00:00Z"))).toEqual(end);
    expect(renewalStart(end, new Date("2026-11-06T23:00:00Z"))).toEqual(end);
  });

  it("mulai saat bayar kalau sudah baca saja", () => {
    const paid = new Date("2026-11-08T00:00:00Z");
    expect(renewalStart(end, paid)).toEqual(paid);
  });
});
