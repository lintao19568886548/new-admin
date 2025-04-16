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
  floorCount: number;
  imageUrls?: string[]; // 添加图片数组字段
  imgUrl: string;
  rentPrice: number;
  status: string;
  updateTime: string;
}

export type StatusTag = string;
