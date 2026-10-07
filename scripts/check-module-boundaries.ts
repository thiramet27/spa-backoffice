// กันโค้ดพันกัน: ไฟล์ใน src/modules/<X> ห้าม import ไส้ในของ module อื่น
// อนุญาตแค่ src/shared/* และ src/modules/<Y>/index.ts
// รันใน CI ทุก PR (npm run check:boundaries) โดยเฉพาะ PR ที่ AI เขียน เพราะ AI ชอบ import ทางลัด
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const modulesDir = join(root, "src", "modules");

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
  });

const moduleOf = (file: string) => relative(modulesDir, file).split(sep)[0];

const violations: string[] = [];
for (const file of walk(modulesDir)) {
  const source = readFileSync(file, "utf8");
  for (const [, spec] of source.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
    const target = resolve(dirname(file), spec!);
    if (!target.startsWith(modulesDir)) continue; // shared/ หรือไฟล์นอก modules
    const from = moduleOf(file);
    const to = moduleOf(target);
    const isPublicApi = target === join(modulesDir, to!, "index.ts");
    if (from !== to && !isPublicApi) {
      violations.push(`${relative(root, file)} -> ${relative(root, target)}`);
    }
  }
}

if (violations.length) {
  console.error("Module boundary violations (import ผ่าน index.ts เท่านั้น):\n  " + violations.join("\n  "));
  process.exit(1);
}
console.log("module boundaries OK");
