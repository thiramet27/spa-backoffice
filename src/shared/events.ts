// Event ที่ใช้คุยข้าม module ทั้งหมดอยู่ที่ไฟล์นี้ไฟล์เดียว
// module ไหนอยากรู้ว่าอีก module ทำอะไรเสร็จ ให้ subscribe event ไม่ใช่ import service ของกันและกัน
export type DomainEvent =
  | {
      type: "BookingCompleted";
      bookingId: string;
      billId: string;
      branchId: string;
      customerId: string;
      therapistId: string;
      serviceId: string;
      priceSatang: number;
    }
  | { type: "BookingCancelled"; bookingId: string; reason: string };

type Handler<E> = (event: E) => void | Promise<void>;

export class EventBus {
  private handlers = new Map<string, Handler<any>[]>();

  on<T extends DomainEvent["type"]>(type: T, handler: Handler<Extract<DomainEvent, { type: T }>>) {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  // demo นี้ dispatch ใน process เดียว
  // ของจริงจะเขียนลงตาราง outbox ใน transaction เดียวกับตอนปิด booking (ดู db/schema.sql)
  async publish(event: DomainEvent) {
    for (const handler of this.handlers.get(event.type) ?? []) {
      await handler(event);
    }
  }
}
