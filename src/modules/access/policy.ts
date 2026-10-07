// สิทธิ์แบ่งเป็น 2 คำถาม:
//   1) "ทำอะไรได้"  -> permission ที่ผูกกับ role   (ตาราง role_permissions)
//   2) "เห็นของที่ไหน" -> scope ที่ผูกกับ user       (ตาราง user_scopes)
// ทั้งคู่เป็นข้อมูลใน DB เพิ่มตำแหน่ง/สาขาใหม่ = insert row ไม่ต้องแก้โค้ด

export type Permission = "sales:read" | "sales:export" | "customer:read" | "customer:read_contact" | "stock:adjust";

export type Scope =
  | { type: "BRANCH"; branchId: string }
  | { type: "AREA"; areaId: string }
  | { type: "COMPANY" };

export interface Principal {
  userId: string;
  roles: string[];
  scopes: Scope[];
}

export interface PolicyData {
  rolePermissions: Record<string, Permission[]>;
  branches: { id: string; areaId: string }[];
}

export class Forbidden extends Error {}

export function permissionsOf(user: Principal, data: PolicyData): Set<Permission> {
  return new Set(user.roles.flatMap((r) => data.rolePermissions[r] ?? []));
}

// คืนรายการสาขาที่ user เห็นได้ เอาไปต่อเป็น WHERE branch_id = ANY($1) ใน repository
export function visibleBranchIds(user: Principal, data: PolicyData): string[] {
  const ids = new Set<string>();
  for (const s of user.scopes) {
    if (s.type === "COMPANY") return data.branches.map((b) => b.id);
    if (s.type === "BRANCH") ids.add(s.branchId);
    if (s.type === "AREA") data.branches.filter((b) => b.areaId === s.areaId).forEach((b) => ids.add(b.id));
  }
  return [...ids];
}

export interface AccessContext {
  can: (p: Permission) => boolean;
  branchIds: string[];
  assertBranch: (branchId: string) => void;
}

// middleware: ทำครั้งเดียวต่อ request แล้วแนบ context ให้ handler ใช้
// handler ไม่ต้องรู้ว่าใครเป็น role อะไร แค่เรียก ctx.can() / ใช้ ctx.branchIds
export function authorize(required: Permission, data: PolicyData) {
  return (req: { user?: Principal; access?: AccessContext }) => {
    if (!req.user) throw new Forbidden("not logged in");
    const perms = permissionsOf(req.user, data);
    if (!perms.has(required)) throw new Forbidden(`missing permission ${required}`);

    const branchIds = visibleBranchIds(req.user, data);
    req.access = {
      can: (p) => perms.has(p),
      branchIds,
      assertBranch: (id) => {
        if (!branchIds.includes(id)) throw new Forbidden(`no access to branch ${id}`);
      },
    };
  };
}
