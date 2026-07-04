export type YmsinoCapabilityStatus =
  | 'blocked-by-vendor'
  | 'not-applicable'
  | 'partial'
  | 'ready';

export interface YmsinoCapabilityResponse {
  capability: string;
  details: string[];
  missing: string[];
  status: YmsinoCapabilityStatus;
  supportedBy: string[];
}

export function createYmsinoCapability(
  payload: YmsinoCapabilityResponse,
): YmsinoCapabilityResponse {
  return payload;
}
