// ล้างข้อมูลส่วนบุคคลออกจาก log / ผล query ก่อน paste ให้ LLM
// ค่าเดิมเจอกี่ครั้งก็ได้ token เดิม (CUSTOMER_1, PHONE_1) ทำให้ AI ยังไล่ความสัมพันธ์ของข้อมูลได้
// ตาราง token -> ค่าจริง เก็บไว้ในเครื่อง (.mask-map.json อยู่ใน .gitignore) ไว้แปลงคำตอบของ AI กลับ
//
// ใช้งาน: cat error.log | npx tsx tools/mask-for-llm.ts > safe.log

import { readFileSync, writeFileSync } from "node:fs";

type Kind = "EMAIL" | "PHONE" | "THAI_ID" | "CARD" | "CUSTOMER";

// ลำดับมีผล: THAI_ID ต้องมาก่อน CARD ไม่งั้นเลข 13 หลักจะถูกนับเป็นบัตร
const PATTERNS: [Kind, RegExp][] = [
  ["EMAIL", /[\w.+-]+@[\w-]+\.[\w.-]+/g],
  ["THAI_ID", /\b\d{1}-?\d{4}-?\d{5}-?\d{2}-?\d{1}\b/g],
  ["CARD", /\b\d(?:[ -]?\d){12,15}\b/g],
  ["PHONE", /(?<!\d)(?:\+66|0)[-\s]?\d{1,2}[-\s]?\d{3}[-\s]?\d{4}(?!\d)/g],
];

// key ใน JSON ที่ถือว่าเป็นชื่อคน แม้ไม่มี pattern ชัดเจน
const NAME_KEYS = /^(name|first_?name|last_?name|full_?name|customer_?name|ชื่อ.*)$/i;

export class Masker {
  private forward = new Map<string, string>();
  private counters: Partial<Record<Kind, number>> = {};

  token(kind: Kind, value: string): string {
    const key = `${kind}:${value}`;
    let t = this.forward.get(key);
    if (!t) {
      this.counters[kind] = (this.counters[kind] ?? 0) + 1;
      t = `${kind}_${this.counters[kind]}`;
      this.forward.set(key, t);
    }
    return t;
  }

  maskText(text: string): string {
    return PATTERNS.reduce((t, [kind, re]) => t.replace(re, (m) => this.token(kind, m)), text);
  }

  maskJson(value: unknown, key = ""): unknown {
    if (typeof value === "string") return NAME_KEYS.test(key) ? this.token("CUSTOMER", value) : this.maskText(value);
    if (Array.isArray(value)) return value.map((v) => this.maskJson(v, key));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.maskJson(v, k)]));
    }
    return value;
  }

  // แปลงคำตอบของ AI กลับเป็นค่าจริง (ทำในเครื่องเท่านั้น)
  unmask(text: string): string {
    // แทน token ยาวก่อน กัน PHONE_1 ไปกิน PHONE_10
    const pairs = [...this.forward].sort((a, b) => b[1].length - a[1].length);
    return pairs.reduce((out, [key, token]) => out.replaceAll(token, key.slice(key.indexOf(":") + 1)), text);
  }

  toJSON() {
    return Object.fromEntries(this.forward);
  }
}

// รันเป็น CLI: อ่านจาก stdin ทีละบรรทัด ถ้าเป็น JSON log ก็ mask ตาม key
if (import.meta.filename === process.argv[1]) {
  const masker = new Masker();
  const input = readFileSync(0, "utf8");
  const output = input
    .split("\n")
    .map((line) => {
      try {
        return JSON.stringify(masker.maskJson(JSON.parse(line)));
      } catch {
        return masker.maskText(line);
      }
    })
    .join("\n");
  process.stdout.write(output);
  writeFileSync(".mask-map.json", JSON.stringify(masker, null, 2));
}
