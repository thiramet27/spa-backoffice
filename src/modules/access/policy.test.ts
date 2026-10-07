import { test } from "node:test";
import assert from "node:assert/strict";
import { authorize, Forbidden, type PolicyData, type Principal } from "./policy.ts";

// ข้อมูลชุดนี้ของจริงมาจากตาราง role_permissions / branches / user_scopes
const data: PolicyData = {
  rolePermissions: {
    staff: ["sales:read", "customer:read"],
    branch_manager: ["sales:read", "customer:read", "customer:read_contact", "stock:adjust"],
    area_manager: ["sales:read", "sales:export", "customer:read", "customer:read_contact"],
  },
  branches: [
    { id: "A", areaId: "BKK-EAST" },
    { id: "B", areaId: "BKK-EAST" },
    { id: "C", areaId: "BKK-WEST" },
  ],
};

const staffA: Principal = { userId: "u1", roles: ["staff"], scopes: [{ type: "BRANCH", branchId: "A" }] };
const areaEast: Principal = { userId: "u2", roles: ["area_manager"], scopes: [{ type: "AREA", areaId: "BKK-EAST" }] };

const run = (user: Principal, perm: Parameters<typeof authorize>[0], d = data) => {
  const req: { user: Principal; access?: any } = { user };
  authorize(perm, d)(req);
  return req.access!;
};

test("พนักงานสาขา A เห็นแค่สาขา A", () => {
  const access = run(staffA, "sales:read");
  assert.deepEqual(access.branchIds, ["A"]);
  assert.throws(() => access.assertBranch("B"), Forbidden);
});

test("Area Manager เห็นทุกสาขาในเขต แต่ไม่เห็นเขตอื่น", () => {
  const access = run(areaEast, "sales:read");
  assert.deepEqual(access.branchIds.sort(), ["A", "B"]);
  assert.throws(() => access.assertBranch("C"), Forbidden);
});

test("พนักงานทั่วไปไม่เห็นเบอร์โทรลูกค้า", () => {
  assert.equal(run(staffA, "customer:read").can("customer:read_contact"), false);
  assert.throws(() => run(staffA, "sales:export"), Forbidden);
});

test("เพิ่มสาขาใหม่ในเขต -> Area Manager เห็นทันที โดยไม่แก้โค้ด", () => {
  const withNewBranch = { ...data, branches: [...data.branches, { id: "D", areaId: "BKK-EAST" }] };
  assert.ok(run(areaEast, "sales:read", withNewBranch).branchIds.includes("D"));
});

test("เพิ่มตำแหน่งใหม่ (auditor ดูได้ทั้งบริษัท แต่ export ไม่ได้) ด้วยข้อมูลอย่างเดียว", () => {
  const withAuditor = { ...data, rolePermissions: { ...data.rolePermissions, auditor: ["sales:read" as const] } };
  const auditor: Principal = { userId: "u9", roles: ["auditor"], scopes: [{ type: "COMPANY" }] };
  const access = run(auditor, "sales:read", withAuditor);
  assert.deepEqual(access.branchIds, ["A", "B", "C"]);
  assert.equal(access.can("sales:export"), false);
});
