import { requestClient } from '#/api/request';

export interface SourceOrganization {
  city?: string;
  companyShortName?: string;
  id: number;
  memberRole: string;
  name: string;
  sourceCustomerId: string;
}

export interface CreateOrganizationPayload {
  organizationIdentity: {
    city: string;
    companyShortName: string;
  };
}

export interface CreateOrganizationResponse {
  sourceOrganization: SourceOrganization;
  sourceOrganizationCount: number;
}

export async function createSourceOrganizationApi(
  payload: CreateOrganizationPayload,
) {
  return requestClient.post<CreateOrganizationResponse>(
    '/organization/create',
    payload,
  );
}
