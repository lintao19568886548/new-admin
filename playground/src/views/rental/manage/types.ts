// 租赁管理项目类型
export interface RentalManagementItem {
  address: string; // 地址
  area: number; // 总面积
  availableArea: number; // 可用面积
  contact: string; // 联系人
  createTime?: string; // 创建时间
  price: number; // 价格
  remark?: string; // 备注
  // 使用与数据库一致的字段
  rentalManageId: number; // 主键ID
  title: string; // 标题
  updateTime?: string; // 更新时间
}
