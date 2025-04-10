export interface CarItem {
  carId: number;
  carNumber: string;
  createTime?: string;
  readonly?: boolean; // 添加可选的readonly属性，用于表单只读模式
  registerTime: string;
  remark?: string;
  status: number; // 1: 进入, 0: 离开
  updateTime?: string;
}
