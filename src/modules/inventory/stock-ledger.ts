// ตัวจำลองในหน่วยความจำของ stock_movements / stock_balances ใน db/schema.sql
// กติกาเหมือนฝั่ง DB: ห้ามแก้หรือลบ movement, ยอดคงเหลือห้ามติดลบ, ref เดิมตัดซ้ำไม่ได้

export type MovementType = "RECEIVE" | "CONSUME" | "ADJUST" | "REVERSAL";

export interface StockMovement {
  readonly id: number;
  readonly branchId: string;
  readonly itemId: string;
  readonly type: MovementType;
  readonly qty: number; // + เข้า, - ออก
  readonly refType: "BILL" | "PURCHASE" | "STOCK_COUNT" | "MOVEMENT";
  readonly refId: string;
  readonly reason?: string;
  readonly createdBy: string;
  readonly approvedBy?: string;
  readonly createdAt: Date;
}

export class InsufficientStockError extends Error {
  constructor(readonly branchId: string, readonly itemId: string, readonly onHand: number, readonly requested: number) {
    super(`stock not enough: ${itemId}@${branchId} on hand ${onHand}, need ${requested}`);
  }
}

type NewMovement = Omit<StockMovement, "id" | "createdAt">;

export class StockLedger {
  private movements: StockMovement[] = [];
  private balances = new Map<string, number>();
  private seq = 0;

  onHand(branchId: string, itemId: string): number {
    return this.balances.get(`${branchId}:${itemId}`) ?? 0;
  }

  history(branchId: string, itemId: string): readonly StockMovement[] {
    return this.movements.filter((m) => m.branchId === branchId && m.itemId === itemId);
  }

  // ทุก movement ของหนึ่ง request ต้องผ่านทั้งหมด หรือไม่บันทึกเลย (เหมือน DB transaction)
  record(batch: NewMovement[]): StockMovement[] {
    const fresh = batch.filter((m) => !this.alreadyRecorded(m));
    const next = new Map(this.balances);

    for (const m of fresh) {
      if (m.type === "ADJUST" && (!m.reason || !m.approvedBy)) {
        throw new Error("ADJUST ต้องมี reason และ approvedBy");
      }
      const key = `${m.branchId}:${m.itemId}`;
      const after = (next.get(key) ?? 0) + m.qty;
      if (after < 0) throw new InsufficientStockError(m.branchId, m.itemId, next.get(key) ?? 0, -m.qty);
      next.set(key, after);
    }

    this.balances = next;
    const saved = fresh.map((m) => ({ ...m, id: ++this.seq, createdAt: new Date() }));
    this.movements.push(...saved);
    return saved;
  }

  // ยกเลิกบิล = สร้าง movement กลับทิศ ไม่ลบของเดิม
  reverse(movementId: number, reason: string, by: string): StockMovement[] {
    const original = this.movements.find((m) => m.id === movementId);
    if (!original) throw new Error(`movement ${movementId} not found`);
    return this.record([
      {
        branchId: original.branchId,
        itemId: original.itemId,
        type: "REVERSAL",
        qty: -original.qty,
        refType: "MOVEMENT",
        refId: String(original.id),
        reason,
        createdBy: by,
      },
    ]);
  }

  // UNIQUE (ref_type, ref_id, item_id) ใน DB
  private alreadyRecorded(m: NewMovement) {
    return this.movements.some(
      (x) => x.refType === m.refType && x.refId === m.refId && x.itemId === m.itemId && x.type === m.type,
    );
  }
}
