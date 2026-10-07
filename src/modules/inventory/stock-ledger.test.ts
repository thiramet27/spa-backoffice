import { test } from "node:test";
import assert from "node:assert/strict";
import { StockLedger, InsufficientStockError } from "./stock-ledger.ts";

const receive = (qty: number, refId = "PO-1") => ({
  branchId: "A",
  itemId: "massage-oil",
  type: "RECEIVE" as const,
  qty,
  refType: "PURCHASE" as const,
  refId,
  createdBy: "u1",
});

const consume = (qty: number, billId: string) => ({
  branchId: "A",
  itemId: "massage-oil",
  type: "CONSUME" as const,
  qty: -qty,
  refType: "BILL" as const,
  refId: billId,
  createdBy: "u1",
});

test("ตัดเกินของที่มี ต้อง error และยอดเดิมไม่เปลี่ยน", () => {
  const ledger = new StockLedger();
  ledger.record([receive(2)]);
  assert.throws(() => ledger.record([consume(3, "BILL-1")]), InsufficientStockError);
  assert.equal(ledger.onHand("A", "massage-oil"), 2);
});

test("ปิดบิลเดิมซ้ำ (กดสองครั้ง / retry) ตัดสต็อกครั้งเดียว", () => {
  const ledger = new StockLedger();
  ledger.record([receive(10)]);
  ledger.record([consume(1, "BILL-1")]);
  ledger.record([consume(1, "BILL-1")]);
  assert.equal(ledger.onHand("A", "massage-oil"), 9);
});

test("ปรับยอดมือต้องมีเหตุผลและคนอนุมัติ", () => {
  const ledger = new StockLedger();
  const adjust = { ...receive(-1, "COUNT-2026-10"), type: "ADJUST" as const, refType: "STOCK_COUNT" as const };
  ledger.record([receive(5)]);
  assert.throws(() => ledger.record([adjust]));
  ledger.record([{ ...adjust, reason: "ขวดแตก", approvedBy: "manager-a" }]);
  assert.equal(ledger.onHand("A", "massage-oil"), 4);
});

test("ยกเลิกบิล = movement กลับทิศ ประวัติเดิมยังอยู่ครบ", () => {
  const ledger = new StockLedger();
  ledger.record([receive(5)]);
  const [used] = ledger.record([consume(2, "BILL-9")]);
  ledger.reverse(used!.id, "ลูกค้ายกเลิก", "manager-a");
  assert.equal(ledger.onHand("A", "massage-oil"), 5);
  assert.deepEqual(
    ledger.history("A", "massage-oil").map((m) => m.type),
    ["RECEIVE", "CONSUME", "REVERSAL"],
  );
});

test("batch ที่มีบางรายการไม่พอ ต้องไม่บันทึกอะไรเลย", () => {
  const ledger = new StockLedger();
  ledger.record([receive(5)]);
  assert.throws(() =>
    ledger.record([consume(1, "BILL-2"), { ...consume(1, "BILL-2"), itemId: "towel" }]),
  );
  assert.equal(ledger.onHand("A", "massage-oil"), 5);
});
