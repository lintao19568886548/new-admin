// 租赁管理项目类型
export interface TenantImageItem {
  imgId: number;
  url: string;
}

export interface RentalManagementItem {
  address: string;
  // Fields used in mobile-list.vue, added as optional
  area?: number;
  contractDate: string[];
  contractEnd: string;
  contractStart: string;
  createTime: string;
  images?: TenantImageItem[];
  increaseData: object | string;
  increaseDate: string;
  increaseRate: number;
  // Field used in form.vue (via data.ts#useFormSchema)
  parkId?: number;
  phoneNumber: string;
  remark?: string;
  rent?: number | string;
  rentalTenantId: number;
  sendMessage?: string;
  status: string;
  tenantName: string;
  transactionType: boolean; // true=收入 false=支出

  updateTime: string;
}
