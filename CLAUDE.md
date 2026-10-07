# กติกาของ repo นี้ (สำหรับ AI coding agent)

ไฟล์นี้ AI จะอ่านทุกครั้งก่อนเริ่มงาน เขียนไว้สั้นๆ เฉพาะเรื่องที่ AI มักทำพลาด

## โครงสร้าง
- `src/modules/<name>/` หนึ่ง module ต่อหนึ่งเรื่อง (booking, inventory, commission, billing, access, housekeeping)
- module อื่นเรียกใช้ได้ผ่าน `index.ts` ของ module นั้นเท่านั้น ห้าม import ไฟล์ข้างใน
- ถ้า module A ต้องทำอะไรเมื่อ module B ทำงานเสร็จ ให้ subscribe event ใน `src/shared/events.ts` ห้ามเรียก service ของอีก module ตรงๆ
- ข้อมูลลูกค้าอ่านผ่าน `CustomerReader` (src/shared/customer.ts) เท่านั้น

## เงินและตัวเลข
- เงินเป็นสตางค์ (integer) เสมอ ใช้ `src/shared/money.ts` ห้ามใช้ float กับเงิน
- เปอร์เซ็นต์ใช้ basis point (300 = 3%)

## ข้อมูล
- `stock_movements` เพิ่มได้อย่างเดียว ยกเลิกให้สร้าง REVERSAL
- query ที่รับค่าจาก user ต้อง parameterized เสมอ
- ทุก query ที่ดึงยอดขายหรือข้อมูลลูกค้าต้องกรองด้วย `access.branchIds`

## ก่อนส่งงาน
- `npm run check` ต้องผ่าน (typecheck + module boundaries + test)
- แก้ logic ต้องมี test ที่ fail ก่อนแก้และผ่านหลังแก้
- ถ้าไม่แน่ใจ business rule (ภาษี, ค่าคอม) ให้ถาม อย่าเดา
