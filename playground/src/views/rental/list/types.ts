// 如果文件不存在，需要创建
export interface FactoryListItem {
  address: string;
  area: number;
  availableArea: number;
  buildingNumber: string;
  content: string;
  date: string;
  floorCount: number;
  group: string;
  id: number;
  imgUrl: string;
  rentPrice: number;
  tag: string;
  title: string;
}

// 园区列表项
export interface ParkListItem {
  address: string;
  area: number;
  content: string;
  date: string;
  group: string;
  id: number;
  imgUrl: string;
  tag: string;
  title: string;
}

// 消防设施详情
export interface FirefightingDetail {
  address: string;
  checker: string;
  checkTime: string;
  extinguisher: string;
  fireExit: string;
  firefightingId: number;
  hydrant: string;
  imgUrl: string;
  remark: string;
  title: string;
}

// 变压器详情
export interface TransformerDetail {
  address: string;
  checkTime: string;
  contact: string;
  imgUrl: string;
  remark: string;
  specifications: string;
  status: string;
  title: string;
  transformerId: number;
}

// 宿舍详情
export interface DormitoryDetail {
  buildingNumber: string;
  capacity: number;
  createTime: string;
  description: string;
  dormitoryId: number;
  facilities: string;
  floorCount: number;
  occupancy: number;
  rentPrice: number;
  roomNumber: string;
  updateTime: string;
}

// 厂房详情
export interface FactoryDetail {
  address: string;
  area: number;
  availableArea: number;
  buildingNumber: string;
  buildTime: string;
  contact: string;
  createTime: string;
  description: string;
  factoryId: number;
  factoryName: string;
  // 关联数据
  firefighting: FirefightingDetail[];
  floorCount: number;
  imageUrls?: string[];
  imgUrl: string;
  rentPrice: number;
  status: string;
  transformers: TransformerDetail[];
  updateTime: string;
}

// 园区详情
export interface ParkDetail {
  address: string;
  area: number;
  createTime: string;
  description: string;
  dormitories: DormitoryDetail[];
  // 关联数据
  factories: FactoryDetail[];
  imageUrls?: string[];
  imgUrl: string;
  parkId: number;
  parkName: string;
  status: string;
  updateTime: string;
}

export type StatusTag = string;
