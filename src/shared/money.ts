// เงินเก็บเป็น "สตางค์" (integer) เสมอ ไม่ใช้ float
export type Satang = number;

export const baht = (amount: number): Satang => Math.round(amount * 100);

export const toBaht = (s: Satang): string => (s / 100).toFixed(2);

// คิดเปอร์เซ็นต์จากหน่วย basis point (300 = 3%) แล้วปัดครึ่งขึ้นที่ระดับสตางค์
export function percentOf(amount: Satang, basisPoints: number): Satang {
  if (!Number.isInteger(amount)) throw new Error(`amount must be integer satang, got ${amount}`);
  return Math.round((amount * basisPoints) / 10_000);
}
