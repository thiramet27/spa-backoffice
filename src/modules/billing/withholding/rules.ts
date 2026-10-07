import { baht, type Satang } from "../../../shared/money.ts";

export type ServiceType = "SERVICE" | "RENTAL";

export interface WithholdingContext {
  customerKind: "individual" | "juristic";
  serviceType: ServiceType;
  billAmountBeforeVat: Satang;
}

// เพิ่มกฎภาษีใหม่ = เพิ่ม object ใหม่ในลิสต์ ไม่แตะ checkout
export interface WithholdingRule {
  readonly id: string;
  readonly rateBps: number; // 300 = 3%
  matches(ctx: WithholdingContext): boolean;
}

// หักเฉพาะลูกค้านิติบุคคล และยอดจ่ายต่อครั้งตั้งแต่ 1,000 บาท (ไม่รวม VAT)
// เงื่อนไขนี้ควรให้ทีมบัญชียืนยันอีกรอบก่อนใช้จริง
const WHT_MIN_AMOUNT = baht(1000);
const isWithholdable = (ctx: WithholdingContext) =>
  ctx.customerKind === "juristic" && ctx.billAmountBeforeVat >= WHT_MIN_AMOUNT;

export const serviceFee3: WithholdingRule = {
  id: "service-3",
  rateBps: 300,
  matches: (ctx) => isWithholdable(ctx) && ctx.serviceType === "SERVICE",
};

export const rental5: WithholdingRule = {
  id: "rental-5",
  rateBps: 500,
  matches: (ctx) => isWithholdable(ctx) && ctx.serviceType === "RENTAL",
};

export const defaultWithholdingRules: WithholdingRule[] = [serviceFee3, rental5];
