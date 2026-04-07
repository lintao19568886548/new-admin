// 租赁管理项目类型
export interface TenantImageItem {
  imgId: number;
  url: string;
}

export interface ContractPartyItem {
  address?: string;
  contactName?: string;
  contactPhone?: string;
  contractPartyId?: null | number;
  idCardNo?: null | string;
  partyName: string;
  partyType?: null | string;
  remark?: string;
  role?: 'PARTY_A' | 'PARTY_B';
  sourceMode?: string;
  unifiedCreditCode?: null | string;
}

export interface RentalManagementItem {
  address: string;
  // Fields used in mobile-list.vue, added as optional
  area?: number;
  contractDate: string[];
  contractEnd: string;
  contractNo?: string;
  contractStart: string;
  createTime: string;
  images?: TenantImageItem[];
  increaseData: object | string;
  increaseDate: string;
  increaseRate: number;
  // Field used in form.vue (via data.ts#useFormSchema)
  parkId?: number;
  partyA?: ContractPartyItem | null;
  partyAAddress?: string;
  partyAContactName?: string;
  partyAContactPhone?: string;
  partyAContractPartyId?: null | number;
  partyAName?: string;
  partyARemark?: string;
  partyB?: ContractPartyItem | null;
  partyBAddress?: string;
  partyBContactName?: string;
  partyBContactPhone?: string;
  partyBContractPartyId?: null | number;
  partyBName?: string;
  partyBRemark?: string;
  phoneNumber: string;
  remark?: string;
  rent?: number | string;
  rentalTenantId: number;
  sendMessage?: string;
  signDate?: string;
  status: string;
  tenantName: string;

  updateTime: string;
}
