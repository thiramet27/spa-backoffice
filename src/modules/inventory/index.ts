// Public API ของ inventory: module อื่น import ได้จากไฟล์นี้เท่านั้น
import type { EventBus } from "../../shared/events.ts";
import { StockLedger } from "./stock-ledger.ts";

export { StockLedger, InsufficientStockError } from "./stock-ledger.ts";
export type { StockMovement } from "./stock-ledger.ts";

// สูตรวัสดุต่อ 1 บริการ (ตาราง service_materials)
export type ServiceMaterials = Record<string, { itemId: string; qty: number }[]>;

export function registerInventory(bus: EventBus, ledger: StockLedger, materials: ServiceMaterials) {
  bus.on("BookingCompleted", (e) => {
    const lines = materials[e.serviceId] ?? [];
    ledger.record(
      lines.map((l) => ({
        branchId: e.branchId,
        itemId: l.itemId,
        type: "CONSUME" as const,
        qty: -l.qty,
        refType: "BILL" as const,
        refId: e.billId,
        createdBy: "system:booking-completed",
      })),
    );
  });
}
