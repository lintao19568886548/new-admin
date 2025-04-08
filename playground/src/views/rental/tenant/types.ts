// 租赁管理项目类型
export interface RentalManagementItem {
  address: string;
  contractDate: string;
  createTime: string;
  increaseDate: string;
  increaseRate: number;
  phoneNumber: string;
  remark?: string;
  status: string;
  tenantId: number;
  tenantName: string;
  updateTime: string;
}
