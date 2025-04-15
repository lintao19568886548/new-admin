// 租赁管理项目类型（与原始类型保持一致）
export interface RentalManagementItem {
  address: string;
  contractDate: string;
  createTime: string;
  increaseDate: string;
  increaseRate: number;
  phoneNumber: string;
  remark?: string;
  rentalTenantId: number;
  status: string;
  tenantName: string;
  updateTime: string;
}
