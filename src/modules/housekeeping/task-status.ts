// สถานะงานแม่บ้าน: กฎการเปลี่ยนสถานะทั้งหมดอยู่ในตารางนี้ที่เดียว
// ส่วนอื่นของระบบห้ามเช็ก status เอง ให้เรียก transition() หรือ canTransition()

export const TASK_STATUSES = ["PENDING", "ON_THE_WAY", "IN_PROGRESS", "WAITING_REVIEW", "DONE", "CANCELLED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type Role = "customer" | "maid" | "supervisor" | "system";

interface Rule {
  to: TaskStatus;
  allowedRoles: Role[];
  requiresReason?: boolean;
}

export const TRANSITIONS: Record<TaskStatus, Rule[]> = {
  PENDING: [
    { to: "ON_THE_WAY", allowedRoles: ["maid"] },
    { to: "CANCELLED", allowedRoles: ["customer", "supervisor"], requiresReason: true },
  ],
  ON_THE_WAY: [
    { to: "IN_PROGRESS", allowedRoles: ["maid"] },
    { to: "CANCELLED", allowedRoles: ["supervisor"], requiresReason: true },
  ],
  IN_PROGRESS: [{ to: "WAITING_REVIEW", allowedRoles: ["maid"] }],
  WAITING_REVIEW: [
    { to: "DONE", allowedRoles: ["supervisor", "customer"] },
    // ตรวจแล้วไม่ผ่าน ส่งกลับไปแก้
    { to: "IN_PROGRESS", allowedRoles: ["supervisor"], requiresReason: true },
  ],
  DONE: [],
  CANCELLED: [],
};

export class InvalidTransitionError extends Error {}

export function canTransition(from: TaskStatus, to: TaskStatus, role: Role): boolean {
  return TRANSITIONS[from].some((r) => r.to === to && r.allowedRoles.includes(role));
}

export interface StatusChange {
  from: TaskStatus;
  to: TaskStatus;
  by: Role;
  reason?: string;
  at: Date;
}

export function transition(
  task: { status: TaskStatus; history: StatusChange[] },
  to: TaskStatus,
  by: Role,
  reason?: string,
) {
  const rule = TRANSITIONS[task.status].find((r) => r.to === to);
  if (!rule) throw new InvalidTransitionError(`${task.status} -> ${to} ไม่อนุญาต`);
  if (!rule.allowedRoles.includes(by)) throw new InvalidTransitionError(`${by} เปลี่ยน ${task.status} -> ${to} ไม่ได้`);
  if (rule.requiresReason && !reason?.trim()) throw new InvalidTransitionError(`${task.status} -> ${to} ต้องระบุเหตุผล`);

  task.history.push({ from: task.status, to, by, reason, at: new Date() });
  task.status = to;
}
