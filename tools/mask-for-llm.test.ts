import { test } from "node:test";
import assert from "node:assert/strict";
import { Masker } from "./mask-for-llm.ts";

test("mask อีเมล เบอร์โทร เลขบัตรประชาชน ใน log ธรรมดา", () => {
  const m = new Masker();
  const out = m.maskText("payment failed for somchai@example.com tel 081-234-5678 id 1-1037-01234-56-7");
  assert.equal(out, "payment failed for EMAIL_1 tel PHONE_1 id THAI_ID_1");
});

test("ค่าเดิมได้ token เดิม AI จึงยังเห็นว่าเป็นลูกค้าคนเดียวกัน", () => {
  const m = new Masker();
  const rows = m.maskJson([
    { customer_name: "สมชาย ใจดี", phone: "0812345678", total: 1200 },
    { customer_name: "สมชาย ใจดี", phone: "0812345678", total: 800 },
    { customer_name: "สมหญิง รักดี", phone: "0899999999", total: 500 },
  ]) as any[];
  assert.equal(rows[0].customer_name, rows[1].customer_name);
  assert.notEqual(rows[0].customer_name, rows[2].customer_name);
  assert.equal(rows[0].total, 1200); // ตัวเลขที่ไม่ใช่ข้อมูลส่วนตัวต้องอยู่ครบ
});

test("แปลงคำตอบของ AI กลับเป็นค่าจริงได้", () => {
  const m = new Masker();
  const masked = m.maskText("ลูกค้า somchai@example.com จ่ายซ้ำ");
  assert.equal(m.unmask(`ลองเช็ก ${masked.split(" ")[1]} ในตาราง payments`), "ลองเช็ก somchai@example.com ในตาราง payments");
});

test("เลขบัตรเครดิตถูก mask", () => {
  assert.equal(new Masker().maskText("card 4111 1111 1111 1111 declined"), "card CARD_1 declined");
});
