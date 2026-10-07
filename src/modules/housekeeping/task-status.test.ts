import { test } from "node:test";
import assert from "node:assert/strict";
import { TASK_STATUSES, TRANSITIONS, canTransition, transition, InvalidTransitionError, type TaskStatus } from "./task-status.ts";

const newTask = (status: TaskStatus = "PENDING") => ({ status, history: [] as any[] });

test("happy path จนจบงาน และเก็บประวัติครบ", () => {
  const task = newTask();
  transition(task, "ON_THE_WAY", "maid");
  transition(task, "IN_PROGRESS", "maid");
  transition(task, "WAITING_REVIEW", "maid");
  transition(task, "DONE", "supervisor");
  assert.equal(task.status, "DONE");
  assert.equal(task.history.length, 4);
});

// สร้าง test จากตาราง: ทุกคู่สถานะที่ไม่ได้อยู่ใน TRANSITIONS ต้องโดนปฏิเสธ
// เพิ่มสถานะใหม่เมื่อไหร่ test ชุดนี้ครอบคลุมให้เองโดยไม่ต้องเขียนเพิ่ม
for (const from of TASK_STATUSES) {
  for (const to of TASK_STATUSES) {
    const allowed = TRANSITIONS[from].some((r) => r.to === to);
    if (allowed) continue;
    test(`ห้าม ${from} -> ${to}`, () => {
      assert.throws(() => transition(newTask(from), to, "supervisor", "x"), InvalidTransitionError);
    });
  }
}

test("ข้ามขั้นจาก PENDING ไป DONE ไม่ได้", () => {
  assert.equal(canTransition("PENDING", "DONE", "supervisor"), false);
});

test("แม่บ้านยกเลิกงานเองไม่ได้ และยกเลิกต้องมีเหตุผล", () => {
  assert.throws(() => transition(newTask(), "CANCELLED", "maid", "ไม่ว่าง"));
  assert.throws(() => transition(newTask(), "CANCELLED", "customer"));
  const task = newTask();
  transition(task, "CANCELLED", "customer", "เปลี่ยนวัน");
  assert.equal(task.status, "CANCELLED");
});

test("ตรวจไม่ผ่าน ส่งกลับไปแก้ได้", () => {
  const task = newTask("WAITING_REVIEW");
  transition(task, "IN_PROGRESS", "supervisor", "ห้องน้ำยังไม่สะอาด");
  assert.equal(task.status, "IN_PROGRESS");
});
