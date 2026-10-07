import type { Satang } from "../../shared/money.ts";

export interface PaymentInput {
  method: string;
  amount: Satang;
  reference?: string; // เลขอ้างอิงโอน / approval code บัตร
}

// เพิ่มวิธีจ่ายใหม่ = สร้างไฟล์ใหม่ที่ implement interface นี้ แล้ว register ใน payment-methods/index.ts
export interface PaymentMethod {
  readonly code: string;
  validate(input: PaymentInput): void; // throw ถ้าข้อมูลไม่ครบ
}

export class PaymentMethodRegistry {
  private methods = new Map<string, PaymentMethod>();

  register(method: PaymentMethod) {
    if (this.methods.has(method.code)) throw new Error(`payment method ${method.code} registered twice`);
    this.methods.set(method.code, method);
    return this;
  }

  get(code: string): PaymentMethod {
    const m = this.methods.get(code);
    if (!m) throw new Error(`unknown payment method: ${code}`);
    return m;
  }
}
