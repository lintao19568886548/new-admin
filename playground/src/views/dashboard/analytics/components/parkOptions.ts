export type ParkOptionValue = 'all' | number;

export interface ParkOption {
  label: string;
  value: ParkOptionValue;
}

export const allParkOption: ParkOption = {
  label: '全部',
  value: 'all',
};
