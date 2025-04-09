export interface CarItem {
  accessStatus: number; // 1: 进入, 0: 离开
  carId: number;
  carNumber: string;
  createTime?: string;
  registerTime: string;
  remark?: string;
  updateTime?: string;
}
