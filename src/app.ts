// จุดเดียวที่รู้จักทุก module: ประกอบ module เข้าด้วยกันผ่าน EventBus
import { EventBus } from "./shared/events.ts";
import { BookingService } from "./modules/booking/index.ts";
import { StockLedger, registerInventory, type ServiceMaterials } from "./modules/inventory/index.ts";
import { CommissionBook, registerCommission, type CommissionRates } from "./modules/commission/index.ts";

export function createApp(config: { materials: ServiceMaterials; commissionRates: CommissionRates }) {
  const bus = new EventBus();
  const ledger = new StockLedger();
  const commissions = new CommissionBook();

  registerInventory(bus, ledger, config.materials);
  registerCommission(bus, commissions, config.commissionRates);

  return { bus, ledger, commissions, bookings: new BookingService(bus) };
}
