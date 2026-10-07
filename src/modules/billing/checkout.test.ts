import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { baht } from "../../shared/money.ts";
import { calculateBill, settle } from "./checkout.ts";
import { defaultPaymentMethods } from "./payment-methods/index.ts";
import { defaultWithholdingRules, type WithholdingRule } from "./withholding/rules.ts";

const spa = (amount: number) => ({ description: "นวดอโรมา", serviceType: "SERVICE" as const, amountBeforeVat: baht(amount) });
const room = (amount: number) => ({ description: "เช่าห้องจัดงาน", serviceType: "RENTAL" as const, amountBeforeVat: baht(amount) });
const rules = defaultWithholdingRules;

describe("ภาษีหัก ณ ที่จ่าย", () => {
  test("ลูกค้าบุคคลธรรมดา ไม่หัก ไม่ว่ายอดเท่าไหร่", () => {
    const bill = calculateBill([spa(50_000)], "individual", rules);
    assert.deepEqual(bill.withholding, []);
    assert.equal(bill.netPayable, bill.total);
  });

  test("ขอบ 1,000 บาท: 999.99 ไม่หัก, 1,000.00 หัก", () => {
    assert.equal(calculateBill([spa(999.99)], "juristic", rules).withholding.length, 0);
    assert.equal(calculateBill([spa(1000)], "juristic", rules).withholding[0]?.amount, baht(30));
  });

  test("ฐานภาษีหักจากยอดก่อน VAT ไม่ใช่ยอดรวม VAT", () => {
    const bill = calculateBill([spa(1000)], "juristic", rules);
    assert.equal(bill.total, baht(1070));
    assert.equal(bill.withholding[0]?.amount, baht(30)); // ไม่ใช่ 32.10
    assert.equal(bill.netPayable, baht(1040));
  });

  test("ปัดเศษระดับสตางค์: 3% ของ 1,033.33 = 30.9999 -> 31.00", () => {
    assert.equal(calculateBill([spa(1033.33)], "juristic", rules).withholding[0]?.amount, baht(31));
  });

  test("บิลเดียวมีทั้งบริการ (3%) และค่าเช่า (5%) แยกฐานกัน", () => {
    const bill = calculateBill([spa(2000), room(1000)], "juristic", rules);
    assert.deepEqual(
      bill.withholding.map((w) => [w.ruleId, w.amount]),
      [["service-3", baht(60)], ["rental-5", baht(50)]],
    );
  });

  test("รายการย่อยต่ำกว่า 1,000 แต่ทั้งบิลเกิน ยังต้องหัก", () => {
    const bill = calculateBill([spa(600), spa(600)], "juristic", rules);
    assert.equal(bill.withholding[0]?.amount, baht(36));
  });

  test("กฎภาษีซ้อนกันต้อง error ไม่เลือกให้เอง", () => {
    const duplicate: WithholdingRule = { id: "promo-1", rateBps: 100, matches: () => true };
    assert.throws(() => calculateBill([spa(5000)], "juristic", [...rules, duplicate]), /ชนกัน/);
  });

  test("ยอด 0 หรือติดลบในรายการ ต้องไม่ผ่าน", () => {
    assert.throws(() => calculateBill([spa(0)], "juristic", rules));
    assert.throws(() => calculateBill([spa(-100)], "juristic", rules));
    assert.throws(() => calculateBill([], "juristic", rules));
  });
});

describe("การชำระเงิน", () => {
  const methods = defaultPaymentMethods();

  test("จ่ายหลายช่องทางในบิลเดียว (เงินสด + บัตร) รวมแล้วต้องตรงสตางค์", () => {
    const bill = calculateBill([spa(1000)], "juristic", rules); // net 1,040
    assert.doesNotThrow(() =>
      settle(bill, [
        { method: "CASH", amount: baht(40) },
        { method: "CARD", amount: baht(1000), reference: "A1B2C3" },
      ], methods),
    );
    assert.throws(() =>
      settle(bill, [
        { method: "CASH", amount: baht(40) },
        { method: "CARD", amount: baht(999.99), reference: "A1B2C3" },
      ], methods),
    );
  });

  test("ลูกค้านิติบุคคลจ่ายเต็มยอดโดยไม่หักภาษี ต้องไม่ผ่าน (กันออกใบ 50 ทวิผิด)", () => {
    const bill = calculateBill([spa(1000)], "juristic", rules);
    assert.throws(() => settle(bill, [{ method: "TRANSFER", amount: bill.total, reference: "SLIP-1" }], methods));
  });

  test("โอนไม่มีเลขอ้างอิง / วิธีจ่ายที่ไม่รู้จัก ต้องไม่ผ่าน", () => {
    const bill = calculateBill([spa(500)], "individual", rules);
    assert.throws(() => settle(bill, [{ method: "TRANSFER", amount: bill.netPayable }], methods));
    assert.throws(() => settle(bill, [{ method: "BITCOIN", amount: bill.netPayable }], methods), /unknown/);
  });

  test("เพิ่มวิธีจ่ายใหม่ได้โดยไม่แก้ checkout (Open-Closed)", () => {
    const withQr = defaultPaymentMethods().register({
      code: "PROMPTPAY",
      validate: (p) => {
        if (!p.reference?.startsWith("PP")) throw new Error("ต้องมี transaction id ของ PromptPay");
      },
    });
    const bill = calculateBill([spa(500)], "individual", rules);
    assert.doesNotThrow(() => settle(bill, [{ method: "PROMPTPAY", amount: bill.netPayable, reference: "PP123" }], withQr));
  });
});
