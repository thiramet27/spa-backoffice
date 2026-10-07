import { percentOf, type Satang } from "../../shared/money.ts";
import type { PaymentInput, PaymentMethodRegistry } from "./payment-method.ts";
import type { ServiceType, WithholdingRule } from "./withholding/rules.ts";

export const VAT_BPS = 700;

export interface BillLine {
  description: string;
  serviceType: ServiceType;
  amountBeforeVat: Satang;
}

export interface BillTotals {
  subtotal: Satang;
  vat: Satang;
  total: Satang;
  withholding: { ruleId: string; base: Satang; amount: Satang }[];
  netPayable: Satang; // ยอดที่ลูกค้าต้องจ่ายจริง = total - ภาษีหัก ณ ที่จ่าย
}

export function calculateBill(
  lines: BillLine[],
  customerKind: "individual" | "juristic",
  rules: WithholdingRule[],
): BillTotals {
  if (lines.length === 0) throw new Error("บิลต้องมีอย่างน้อย 1 รายการ");
  for (const l of lines) {
    if (!Number.isInteger(l.amountBeforeVat) || l.amountBeforeVat <= 0) {
      throw new Error(`ยอดของ "${l.description}" ไม่ถูกต้อง: ${l.amountBeforeVat}`);
    }
  }

  const subtotal = lines.reduce((s, l) => s + l.amountBeforeVat, 0);
  const vat = percentOf(subtotal, VAT_BPS);
  const total = subtotal + vat;

  // ฐานภาษีหัก ณ ที่จ่ายคิดจากยอดก่อน VAT แยกตามประเภทบริการ
  const baseByType = new Map<ServiceType, Satang>();
  for (const l of lines) baseByType.set(l.serviceType, (baseByType.get(l.serviceType) ?? 0) + l.amountBeforeVat);

  const withholding: BillTotals["withholding"] = [];
  for (const [serviceType, base] of baseByType) {
    const ctx = { customerKind, serviceType, billAmountBeforeVat: subtotal };
    const matched = rules.filter((r) => r.matches(ctx));
    if (matched.length > 1) throw new Error(`กฎภาษีชนกัน: ${matched.map((r) => r.id).join(", ")}`);
    if (matched[0]) withholding.push({ ruleId: matched[0].id, base, amount: percentOf(base, matched[0].rateBps) });
  }

  const netPayable = total - withholding.reduce((s, w) => s + w.amount, 0);
  return { subtotal, vat, total, withholding, netPayable };
}

export function settle(bill: BillTotals, payments: PaymentInput[], methods: PaymentMethodRegistry) {
  if (payments.length === 0) throw new Error("ต้องมีการชำระอย่างน้อย 1 รายการ");
  for (const p of payments) {
    if (!Number.isInteger(p.amount) || p.amount <= 0) throw new Error(`ยอดชำระไม่ถูกต้อง: ${p.amount}`);
    methods.get(p.method).validate(p);
  }
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  if (paid !== bill.netPayable) {
    throw new Error(`ยอดชำระ ${paid} ไม่ตรงกับยอดที่ต้องจ่าย ${bill.netPayable}`);
  }
  return { paid };
}
