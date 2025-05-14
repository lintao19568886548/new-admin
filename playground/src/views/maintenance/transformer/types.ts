// 变压器管理项目类型
export interface TransformerItem {
  // 地址
  address: string;
  // 检查人
  checker: string;
  // 检查时间
  checkTime: string;
  // 创建时间
  createTime?: string;
  // 园区ID
  parkId?: number;
  // 备注
  remark?: string;
  // 变压器规格
  specifications: string;
  // 变压器状态
  status: string;
  // 变压器名称
  title: string;
  // 变压器ID
  transformerId: number;
  // 更新时间
  updateTime?: string;
}
