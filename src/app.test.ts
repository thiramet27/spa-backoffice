import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./app.ts";
import { baht } from "./shared/money.ts";

const setup = () => {
  const app = createApp({
    materials: { "thai-massage-90": [{ itemId: "massage-oil", qty: 1 }, { itemId: "towel", qty: 2 }] },
    commissionRates: { "thai-massage-90": 1500 }, // 15%
  });
  app.ledger.record(
    ["massage-oil", "towel"].map((itemId) => ({
      branchId: "A",
      itemId,
      type: "RECEIVE" as const,
      qty: 10,
      refType: "PURCHASE" as const,
      refId: "PO-1",
      createdBy: "u1",
    })),
  );
  app.bookings.create({
    id: "BK-1",
    branchId: "A",
    customerId: "C-1",
    therapistId: "T-1",
    serviceId: "thai-massage-90",
    priceSatang: baht(1200),
  });
  return app;
};

test("จองเสร็จ -> ตัดสต็อกตามสูตร และคิดค่าคอมให้หมอนวด", async () => {
  const app = setup();
  await app.bookings.complete("BK-1", "BILL-1");

  assert.equal(app.ledger.onHand("A", "massage-oil"), 9);
  assert.equal(app.ledger.onHand("A", "towel"), 8);
  assert.equal(app.commissions.totalFor("T-1"), baht(180));
});

test("ปิด booking เดิมซ้ำไม่ได้", async () => {
  const app = setup();
  await app.bookings.complete("BK-1", "BILL-1");
  await assert.rejects(app.bookings.complete("BK-1", "BILL-1"));
  assert.equal(app.ledger.onHand("A", "towel"), 8);
});
