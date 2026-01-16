// 财务管理项目类型
export interface FinanceItem {
  amount: number | string; // 金额
  billCategory: string; // 账单类别
  billName: string; // 账单名称
  createTime?: string; // 创建时间
  financeId: number; // 主键ID
  images?: { url: string }[]; // 图片
  parkId?: number; // 园区ID
  parkName?: string; // 园区名称
  remark?: string; // 备注
  transactionTime: string; // 交易时间
  transactionType: string; // 交易类型（收入/支出）
  updateTime?: string; // 更新时间
}
