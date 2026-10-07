// Public API ของ commission
import type { EventBus } from "../../shared/events.ts";
import { percentOf, type Satang } from "../../shared/money.ts";

export interface CommissionEntry {
  billId: string;
  therapistId: string;
  amount: Satang;
}

// อัตราค่าคอมต่อบริการเก็บเป็นข้อมูล (ตาราง commission_rates) ไม่ hardcode
export type CommissionRates = Record<string, number>; // serviceId -> basis points

export class CommissionBook {
  readonly entries: CommissionEntry[] = [];

  add(entry: CommissionEntry) {
    if (this.entries.some((e) => e.billId === entry.billId && e.therapistId === entry.therapistId)) return;
    this.entries.push(entry);
  }

  totalFor(therapistId: string): Satang {
    return this.entries.filter((e) => e.therapistId === therapistId).reduce((sum, e) => sum + e.amount, 0);
  }
}

export function registerCommission(bus: EventBus, book: CommissionBook, rates: CommissionRates) {
  bus.on("BookingCompleted", (e) => {
    const bps = rates[e.serviceId];
    if (bps === undefined) return;
    book.add({ billId: e.billId, therapistId: e.therapistId, amount: percentOf(e.priceSatang, bps) });
  });
}
