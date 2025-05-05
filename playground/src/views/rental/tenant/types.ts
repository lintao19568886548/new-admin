// 租赁管理项目类型
export interface RentalManagementItem {
  address: string;
  contractDate: string[];
  contractEnd: string;
  contractStart: string;
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
