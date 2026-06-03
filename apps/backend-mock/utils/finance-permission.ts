import { forbiddenResponse } from '~/utils/response';

export function getAccessibleFinanceParkIds(userinfo: Record<string, any>) {
  return (userinfo.parks || [])
    .map((park: { parkId: number }) => Number(park.parkId))
    .filter((parkId: number) => Number.isInteger(parkId) && parkId > 0);
}

export function hasFinanceParkAccess(
  userinfo: Record<string, any>,
  parkId?: null | number,
) {
  if (parkId === null || parkId === undefined) {
    return true;
  }

  return getAccessibleFinanceParkIds(userinfo).includes(Number(parkId));
}

export function forbiddenFinanceParkResponse(event: any) {
  return forbiddenResponse(event, '无该园区财务权限');
}
