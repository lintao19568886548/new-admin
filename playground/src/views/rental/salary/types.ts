// 工资图片
export interface SalaryImageItem {
  imgId: number;
  url: string;
}

// 工资管理项目类型
export interface SalaryItem {
  createTime?: string;
  images?: SalaryImageItem[];
  isDeleted?: boolean;
  issued?: boolean | null;
  issueDate?: null | string;
  phoneNumber?: string;
  remark?: null | string;
  rentalTenantId: number;
  salaryAmount?: null | number;
  salaryId: number;
  tenantName?: string;
  updateTime?: null | string;
}
