// 厂房列表项类型
export interface FactoryListItem {
  address: string; // 地址
  area: number; // 总面积
  availableArea: number; // 可用面积
  buildingNumber: string; // 楼号
  color: string; // 状态颜色
  contact: string; // 联系人
  content: string; // 描述内容
  createTime: string; // 创建时间
  date: string; // 格式化后的日期
  description?: string; // 详细描述
  factoryId: number; // 主键ID
  factoryName: string; // 厂房名称
  floorCount?: number; // 层数
  group: string; // 分组（联系人）
  id: number; // 用于导航的ID
  imgUrl: string; // 图片URL
  rentPrice: number; // 租金
  status?: string; // 状态
  tag: string; // 标签
  title: string; // 标题
  updateTime?: string; // 更新时间
}

// 厂房详情类型
export interface FactoryDetail {
  address: string; // 地址
  area: number; // 总面积
  availableArea: number; // 可用面积
  buildingNumber: string; // 楼号
  buildTime?: string; // 建造时间
  contact: string; // 联系人
  createTime: string; // 创建时间
  description?: string; // 详细描述
  factoryId: number; // 主键ID
  factoryName: string; // 厂房名称
  floorCount?: number; // 层数
  imgUrl: string; // 图片URL
  rentPrice: number; // 租金
  status?: string; // 状态
  updateTime?: string; // 更新时间
}

// 状态标签参数类型
export interface StatusParams {
  availableArea: number; // 可用面积
  status?: string; // 状态
  totalArea: number; // 总面积
}

// 状态标签类型
export type StatusTag = string;
