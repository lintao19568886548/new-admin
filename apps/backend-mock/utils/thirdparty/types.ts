export interface ThirdPartyLoginResponse {
  msg: string;
  code: number;
  expire: number;
  token: string;
}

export interface GetDeviceParams {
  comAddress?: string;
  comtype?: string;
  projCode: number | string;
  pageSize: number | string;
  page: number | string;
}

export interface GetUseEnergyParams {
  timeFrom?: string;
  timeTo?: string;
  comAddress?: string;
  type: number | string;
  projCode: number | string;
  pageSize: number | string;
  page: number | string;
  comType?: string;
}

export interface GetHDMDataParams {
  comAddress?: string;
  type: number | string;
  timeFrom: string;
  timeTo: string;
  projCode: number | string;
  pageSize: number | string;
  page: number | string;
  comType?: string;
}

export interface GetControlParams {
  timeFrom: string;
  timeTo: string;
  comAddress?: string;
  projCode: number | string;
  pageSize: number | string;
  page: number | string;
  comType?: string;
}

export interface GetSingleDataBody {
  comAddress: string;
  projCode: number | string;
  comType: string;
  dataType: string;
}

export interface GetSingleDataResultParams {
  itemID: number | string;
}

export interface GetUserInfoParams {
  projCode: number | string;
  buildingType?: string;
  buildingid?: string;
  pageSize: number | string;
  page: number | string;
}
