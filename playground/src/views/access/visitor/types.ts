export interface VisitorItem {
  carNum?: string;
  createTime?: string;
  parkName?: string; // 添加园区名称字段
  phoneNumber: string;
  registerTime: string;
  remark?: string;
  status: number | string; // 0: 进入, 1: 离开
  updateTime?: string;
  visitorId: number;
  visitorName: string;
}
