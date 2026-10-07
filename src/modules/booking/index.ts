// Public API ของ booking
// booking ไม่รู้จัก inventory หรือ commission เลย แค่ประกาศว่า "งานเสร็จแล้ว"
import type { EventBus } from "../../shared/events.ts";

export interface Booking {
  id: string;
  branchId: string;
  customerId: string;
  therapistId: string;
  serviceId: string;
  priceSatang: number;
  status: "BOOKED" | "COMPLETED" | "CANCELLED";
}

export class BookingService {
  private bookings = new Map<string, Booking>();

  constructor(private bus: EventBus) {}

  create(b: Omit<Booking, "status">): Booking {
    const booking = { ...b, status: "BOOKED" as const };
    this.bookings.set(b.id, booking);
    return booking;
  }

  async complete(bookingId: string, billId: string) {
    const b = this.bookings.get(bookingId);
    if (!b) throw new Error(`booking ${bookingId} not found`);
    if (b.status !== "BOOKED") throw new Error(`booking ${bookingId} is ${b.status}`);
    b.status = "COMPLETED";
    await this.bus.publish({
      type: "BookingCompleted",
      bookingId: b.id,
      billId,
      branchId: b.branchId,
      customerId: b.customerId,
      therapistId: b.therapistId,
      serviceId: b.serviceId,
      priceSatang: b.priceSatang,
    });
  }
}
