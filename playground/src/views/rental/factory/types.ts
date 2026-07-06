// 厂房列表项
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
  priorityColor?: string;
  priorityLabel?: string;
  priorityReason?: string;
  rentPrice: number;
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
  checker: string;
  checkTime: string;
  contact: string;
  imgUrl: string;
  remark: string;
  specifications: string;
  status: string;
  title: string;
  transformerId: number;
}

// 升降机详情
export interface ElevatorDetail {
  address: string;
  area: number;
  brand: string;
  checker: string;
  checkTime: string;
  elevatorId: number;
  imgUrl: string;
  loadCapacity: number;
  name: string;
  productionDate: string;
  remark: string;
  size: string;
  title: string;
}

// 厂房楼层图片
export interface FactoryFloorImageDetail {
  createTime: string;
  floorId: number;
  id: number;
  image: {
    imgUrl: string;
  };
  imgId: number;
  updateTime: string;
}

// 厂房楼层详情
export interface FactoryFloorDetail {
  createTime: string;
  description: string;
  factoryId: number;
  floorHeight: number;
  floorId: number;
  floorName: string;
  images: FactoryFloorImageDetail[];
  imageUrls: string[];
  imgUrl: string;
  loadBearing: number;
  rentPrice: number;
  status: string;
  totalArea: number;
  updateTime: string;
  usedArea: number;
}

// 厂房详情
export interface FactoryDetail {
  address: string;
  buildTime: string;
  contact: string;
  createTime: string;
  description: string;
  elevators: ElevatorDetail[];
  factoryId: number;
  factoryName: string;
  firefighting: FirefightingDetail[];
  floors: FactoryFloorDetail[];
  imageUrls: string[];
  imgUrl: string;
  transformers: TransformerDetail[];
  updateTime: string;
}

// 状态标签类型
export type StatusTag =
  | '建设中'
  | '异常'
  | '未设置'
  | '正常'
  | '维护'
  | '规划中'
  | '运营中'
  | string;
