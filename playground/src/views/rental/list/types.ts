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

// 宿舍图片
export interface DormitoryImageDetail {
  createTime: string;
  dormitoryId: number;
  id: number;
  image: {
    imgUrl: string;
  };
  imgId: number;
  updateTime: string;
}

// 宿舍详情
export interface DormitoryDetail {
  createTime: string;
  dormitoryId: number;
  dormitoryName: string;
  floorCount: number;
  floorHeightFirst: number;
  floorHeightOther: number;
  images: DormitoryImageDetail[];
  imageUrls: string[];
  imgUrl: string;
  parkId: number;
  remark: string;
  rentPriceFirst: number;
  rentPriceOther: number;
  roomArea: number;
  totalRooms: number;
  updateTime: string;
  usedRoomsFirst: number;
  usedRoomsOther: number;
}

// 厂房详情
export interface FactoryDetail {
  address: string;
  buildTime: string;
  contact: string;
  createTime: string;
  description: string;
  factoryId: number;
  factoryName: string;
  // 关联数据
  firefighting: FirefightingDetail[];
  floors: FactoryFloorDetail[];
  imageUrls: string[];
  imgUrl: string;
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
  factories: FactoryDetail[];
  imageUrls: string[];
  imgUrl: string;
  parkId: number;
  parkName: string;
  status: string;
  updateTime: string;
}

// 状态标签类型 - 修改为更灵活的类型
export type StatusTag = '建设中' | '未设置' | '规划中' | '运营中' | string;
