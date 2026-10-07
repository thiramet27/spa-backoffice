-- PostgreSQL schema สำหรับส่วนที่ตอบในข้อ 1, 2, 3, 4
-- เงินเก็บเป็นสตางค์ (bigint) ทั้งหมด

------------------------------------------------------------------
-- ข้อ 1: สต็อกแบบ ledger
------------------------------------------------------------------
CREATE TABLE items (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  unit        text NOT NULL            -- ml, ผืน, ชิ้น
);

-- สูตรวัสดุต่อ 1 บริการ (BOM) เช่น นวดน้ำมัน 90 นาที = น้ำมัน 30ml + ผ้าขนหนู 2 ผืน
CREATE TABLE service_materials (
  service_id  text    NOT NULL,
  item_id     text    NOT NULL REFERENCES items(id),
  qty         numeric NOT NULL CHECK (qty > 0),
  valid_from  date    NOT NULL DEFAULT current_date,  -- สูตรเปลี่ยนได้ แต่บิลเก่ายังอ้างสูตรเดิม
  PRIMARY KEY (service_id, item_id, valid_from)
);

-- ทุกการเคลื่อนไหวของสต็อก บันทึกเพิ่มได้อย่างเดียว ห้ามแก้ห้ามลบ
CREATE TABLE stock_movements (
  id           bigserial PRIMARY KEY,
  branch_id    text        NOT NULL,
  item_id      text        NOT NULL REFERENCES items(id),
  type         text        NOT NULL CHECK (type IN ('RECEIVE','CONSUME','ADJUST','REVERSAL','TRANSFER_IN','TRANSFER_OUT')),
  qty          numeric     NOT NULL CHECK (qty <> 0),   -- + เข้า / - ออก
  ref_type     text        NOT NULL,                     -- BILL, PURCHASE, STOCK_COUNT, MOVEMENT
  ref_id       text        NOT NULL,
  reason       text,
  created_by   text        NOT NULL,
  approved_by  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- ปิดบิลเดิมซ้ำ (retry / กดสองครั้ง) ตัดของชิ้นเดิมไม่ได้
  UNIQUE (ref_type, ref_id, item_id, type),
  -- ปรับยอดมือต้องมีเหตุผลและคนอนุมัติ
  CHECK (type <> 'ADJUST' OR (reason IS NOT NULL AND approved_by IS NOT NULL))
);

CREATE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'stock_movements is append-only; create a REVERSAL instead';
END $$;

CREATE TRIGGER stock_movements_append_only
  BEFORE UPDATE OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- ยอดคงเหลือ: อัปเดตใน transaction เดียวกับการ insert movement
-- CHECK ตรงนี้คือด่านสุดท้ายกันสต็อกติดลบ ต่อให้ application มี bug
CREATE TABLE stock_balances (
  branch_id  text    NOT NULL,
  item_id    text    NOT NULL REFERENCES items(id),
  on_hand    numeric NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  PRIMARY KEY (branch_id, item_id)
);

-- ตอนปิดบิล (ทั้งหมดใน transaction เดียว):
--   UPDATE stock_balances SET on_hand = on_hand - $qty
--    WHERE branch_id = $b AND item_id = $i AND on_hand >= $qty;   -- 0 row = ของไม่พอ -> rollback
--   INSERT INTO stock_movements (...) VALUES (...);
-- UPDATE แบบมีเงื่อนไขจะ lock row เอง สองบิลที่ปิดพร้อมกันจึงไม่ตัดเกิน

-- ตรวจย้อนหลัง: ยอดใน balances ต้องเท่ากับผลรวม ledger เสมอ (รันเป็น job ทุกคืน)
CREATE VIEW stock_drift AS
SELECT b.branch_id, b.item_id, b.on_hand, coalesce(sum(m.qty), 0) AS ledger_sum
FROM stock_balances b
LEFT JOIN stock_movements m USING (branch_id, item_id)
GROUP BY b.branch_id, b.item_id, b.on_hand
HAVING b.on_hand <> coalesce(sum(m.qty), 0);

------------------------------------------------------------------
-- ข้อ 2: สิทธิ์แบบ data-driven
------------------------------------------------------------------
CREATE TABLE areas    (id text PRIMARY KEY, name text NOT NULL);
CREATE TABLE branches (id text PRIMARY KEY, area_id text NOT NULL REFERENCES areas(id), name text NOT NULL);

CREATE TABLE role_permissions (
  role        text NOT NULL,
  permission  text NOT NULL,          -- sales:read, customer:read_contact, ...
  PRIMARY KEY (role, permission)
);

CREATE TABLE user_roles (user_id text NOT NULL, role text NOT NULL, PRIMARY KEY (user_id, role));

CREATE TABLE user_scopes (
  user_id     text NOT NULL,
  scope_type  text NOT NULL CHECK (scope_type IN ('BRANCH','AREA','COMPANY')),
  scope_id    text,                    -- branch_id / area_id, NULL ถ้า COMPANY
  CHECK ((scope_type = 'COMPANY') = (scope_id IS NULL))
);

-- ด่านที่สอง: ต่อให้ลืมใส่ WHERE ใน query ก็ยังไม่หลุดข้ามสาขา
CREATE FUNCTION visible_branch_ids(uid text) RETURNS SETOF text LANGUAGE sql STABLE AS $$
  SELECT b.id FROM branches b
  JOIN user_scopes s ON s.user_id = uid
  WHERE s.scope_type = 'COMPANY'
     OR (s.scope_type = 'BRANCH' AND s.scope_id = b.id)
     OR (s.scope_type = 'AREA'   AND s.scope_id = b.area_id)
$$;

CREATE TABLE sales (
  id          bigserial PRIMARY KEY,
  branch_id   text   NOT NULL REFERENCES branches(id),
  amount      bigint NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_by_scope ON sales
  USING (branch_id IN (SELECT visible_branch_ids(current_setting('app.user_id'))));

------------------------------------------------------------------
-- ข้อ 3: outbox สำหรับ event ข้าม module
------------------------------------------------------------------
-- booking เขียน event ลงตารางนี้ใน transaction เดียวกับตอนปิดงาน
-- worker อ่านไปส่งให้ inventory / commission (ถ้า handler พังก็ retry ได้ เพราะ handler เป็น idempotent)
CREATE TABLE outbox (
  id            bigserial PRIMARY KEY,
  event_type    text        NOT NULL,
  payload       jsonb       NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz,
  attempts      int         NOT NULL DEFAULT 0
);
CREATE INDEX outbox_pending ON outbox (id) WHERE processed_at IS NULL;

------------------------------------------------------------------
-- ข้อ 4: ประวัติสถานะงาน
------------------------------------------------------------------
CREATE TABLE housekeeping_tasks (
  id      bigserial PRIMARY KEY,
  status  text NOT NULL DEFAULT 'PENDING'
);

CREATE TABLE housekeeping_task_status_history (
  task_id     bigint      NOT NULL REFERENCES housekeeping_tasks(id),
  from_status text        NOT NULL,
  to_status   text        NOT NULL,
  changed_by  text        NOT NULL,
  reason      text,
  changed_at  timestamptz NOT NULL DEFAULT now()
);
