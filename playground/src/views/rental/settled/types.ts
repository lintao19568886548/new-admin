// 如果文件不存在，创建它
export interface FloorItem {
  [key: string]: any;
  description?: string;
  floorHeight: number | string;
  floorId?: number;
  floorName: string;
  images?: any[];
  loadBearing: number | string;
  rentPrice: number | string;
  status: string;
  totalArea: number | string;
  usedArea: number | string;
}

export interface Factory {
  [key: string]: any;
  address?: string;
  buildTime?: string;
  contact?: string;
  description?: string;
  factoryId?: number;
  factoryName?: string;
  floors?: FloorItem[];
  isOwn?: boolean;
}

export interface RentalManagementItem {
  [key: string]: any;
  address: string;
  contact: string;
  createTime: string;
  id: number;
  name: string;
  status: string;
}
