import { PaymentMethodRegistry, type PaymentMethod } from "../payment-method.ts";

export const cash: PaymentMethod = {
  code: "CASH",
  validate() {},
};

export const bankTransfer: PaymentMethod = {
  code: "TRANSFER",
  validate(p) {
    if (!p.reference) throw new Error("โอนเงินต้องมีเลขอ้างอิงจากสลิป");
  },
};

export const creditCard: PaymentMethod = {
  code: "CARD",
  validate(p) {
    if (!p.reference || !/^\w{6}$/.test(p.reference)) throw new Error("บัตรเครดิตต้องมี approval code 6 หลัก");
  },
};

// จุดเดียวที่ต้องแก้ตอนเพิ่มวิธีจ่ายใหม่ (เช่น QR PromptPay, e-wallet)
export const defaultPaymentMethods = () =>
  new PaymentMethodRegistry().register(cash).register(bankTransfer).register(creditCard);
