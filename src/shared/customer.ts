// Shared kernel: ข้อมูลลูกค้าที่ทุก module อ่านได้ แต่แก้ได้ที่เดียว (CustomerRepository ของระบบ CRM)
export interface CustomerSummary {
  id: string;
  displayName: string;
  // ลูกค้านิติบุคคลต้องถูกหัก ณ ที่จ่าย ดู billing/withholding
  kind: "individual" | "juristic";
  homeBranchId: string;
}

export interface CustomerReader {
  findById(id: string): Promise<CustomerSummary | undefined>;
}
