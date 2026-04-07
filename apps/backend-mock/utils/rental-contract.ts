import type { Prisma } from '@prisma/.prisma/client/index.js';

export const CONTRACT_PARTY_ROLE = {
  PARTY_A: 'PARTY_A',
  PARTY_B: 'PARTY_B',
} as const;

export const CONTRACT_PARTY_SOURCE_MODE = {
  MANUAL: 'MANUAL',
  PARK_DEFAULT: 'PARK_DEFAULT',
  PARTY_MASTER: 'PARTY_MASTER',
} as const;

const ROOT_MUTATION_FIELDS = [
  'address',
  'area',
  'contractEnd',
  'contractNo',
  'contractStart',
  'images',
  'increaseData',
  'increaseDate',
  'increaseRate',
  'parkId',
  'penaltyRate',
  'remark',
  'rent',
  'sendMessage',
  'signDate',
  'status',
] as const;

type ContractPartyRole =
  (typeof CONTRACT_PARTY_ROLE)[keyof typeof CONTRACT_PARTY_ROLE];
type ContractPartySourceMode =
  (typeof CONTRACT_PARTY_SOURCE_MODE)[keyof typeof CONTRACT_PARTY_SOURCE_MODE];

type PartyMutationInput = {
  addressSnapshot: null | string;
  contactNameSnapshot: null | string;
  contactPhoneSnapshot: null | string;
  contractPartyId: null | number;
  partyNameSnapshot: string;
  remarkSnapshot: null | string;
  role: ContractPartyRole;
  sourceMode: ContractPartySourceMode;
};

type PartyMutationState = {
  hasInput: boolean;
  party: null | PartyMutationInput;
  role: ContractPartyRole;
};

type RentalTenantCreateData = Prisma.RentalTenantCreateInput;
type RentalTenantUpdateData = Prisma.RentalTenantUpdateInput;
type RentalTenantMutationData = RentalTenantCreateData | RentalTenantUpdateData;

function hasOwn(value: Record<string, any>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeContractPartyId(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function normalizeSourceMode(value: unknown): ContractPartySourceMode {
  const sourceMode = normalizeString(value);
  if (
    sourceMode &&
    Object.values(CONTRACT_PARTY_SOURCE_MODE).includes(
      sourceMode as ContractPartySourceMode,
    )
  ) {
    return sourceMode as ContractPartySourceMode;
  }
  return CONTRACT_PARTY_SOURCE_MODE.MANUAL;
}

function buildPartyState(
  body: Record<string, any>,
  key: 'partyA' | 'partyB',
  role: ContractPartyRole,
) {
  const nestedValue = body[key];
  const nested = isRecord(nestedValue) ? nestedValue : {};
  const flatPrefix = key === 'partyA' ? 'partyA' : 'partyB';
  const isPartyB = role === CONTRACT_PARTY_ROLE.PARTY_B;

  const hasNested = hasOwn(body, key);
  const hasFlat =
    hasOwn(body, `${flatPrefix}Name`) ||
    hasOwn(body, `${flatPrefix}ContactName`) ||
    hasOwn(body, `${flatPrefix}ContactPhone`) ||
    hasOwn(body, `${flatPrefix}Address`) ||
    hasOwn(body, `${flatPrefix}Remark`) ||
    hasOwn(body, `${flatPrefix}ContractPartyId`) ||
    hasOwn(body, `${flatPrefix}SourceMode`);
  const hasLegacyCompat =
    isPartyB && (hasOwn(body, 'tenantName') || hasOwn(body, 'phoneNumber'));
  const hasInput = hasNested || hasFlat || hasLegacyCompat;

  if (!hasInput) {
    return {
      hasInput: false,
      party: null,
      role,
    } satisfies PartyMutationState;
  }

  if (hasNested && nestedValue === null) {
    return {
      hasInput: true,
      party: null,
      role,
    } satisfies PartyMutationState;
  }

  const contractPartyId = normalizeContractPartyId(
    nested.contractPartyId ??
      nested.partyId ??
      body[`${flatPrefix}ContractPartyId`],
  );
  const partyNameSnapshot = normalizeString(
    nested.partyName ??
      body[`${flatPrefix}Name`] ??
      (isPartyB ? body.tenantName : undefined),
  );
  const contactNameSnapshot = normalizeString(
    nested.contactName ?? body[`${flatPrefix}ContactName`],
  );
  const contactPhoneSnapshot = normalizeString(
    nested.contactPhone ??
      body[`${flatPrefix}ContactPhone`] ??
      (isPartyB ? body.phoneNumber : undefined),
  );
  const addressSnapshot = normalizeString(
    nested.address ?? body[`${flatPrefix}Address`],
  );
  const remarkSnapshot = normalizeString(
    nested.remark ?? body[`${flatPrefix}Remark`],
  );
  const sourceMode = normalizeSourceMode(
    nested.sourceMode ?? body[`${flatPrefix}SourceMode`],
  );

  if (
    !partyNameSnapshot &&
    !contactNameSnapshot &&
    !contactPhoneSnapshot &&
    !addressSnapshot &&
    !remarkSnapshot &&
    !contractPartyId
  ) {
    return {
      hasInput: true,
      party: null,
      role,
    } satisfies PartyMutationState;
  }

  return {
    hasInput: true,
    party: {
      addressSnapshot,
      contactNameSnapshot,
      contactPhoneSnapshot,
      contractPartyId,
      partyNameSnapshot: partyNameSnapshot ?? '',
      remarkSnapshot,
      role,
      sourceMode,
    },
    role,
  } satisfies PartyMutationState;
}

async function hydratePartySnapshots(
  tx: any,
  partyStates: PartyMutationState[],
) {
  const partyIds = [
    ...new Set(
      partyStates
        .map((item) => item.party?.contractPartyId)
        .filter((item): item is number => Number.isFinite(item)),
    ),
  ];

  let partyMasterMap = new Map<number, Record<string, any>>();
  if (partyIds.length > 0) {
    const masters = await tx.contractParty.findMany({
      where: {
        contractPartyId: {
          in: partyIds,
        },
        isDeleted: false,
      },
    });
    partyMasterMap = new Map(
      masters.map((master: Record<string, any>) => [
        master.contractPartyId,
        master,
      ]),
    );
  }

  return partyStates.map((state) => {
    if (!state.party) {
      return state;
    }

    const master = state.party.contractPartyId
      ? partyMasterMap.get(state.party.contractPartyId)
      : null;

    return {
      ...state,
      party: {
        ...state.party,
        addressSnapshot:
          state.party.addressSnapshot ?? normalizeString(master?.address),
        contactNameSnapshot:
          state.party.contactNameSnapshot ??
          normalizeString(master?.defaultContactName),
        contactPhoneSnapshot:
          state.party.contactPhoneSnapshot ??
          normalizeString(master?.defaultContactPhone),
        partyNameSnapshot:
          state.party.partyNameSnapshot ||
          normalizeString(master?.partyName) ||
          '',
        remarkSnapshot:
          state.party.remarkSnapshot ?? normalizeString(master?.remark),
      },
    } satisfies PartyMutationState;
  });
}

function buildPartyNestedWrite(
  partyStates: PartyMutationState[],
  isUpdate: boolean,
) {
  const create = partyStates.map((item) => item.party).filter(Boolean);

  if (isUpdate) {
    const deleteMany = partyStates
      .filter((item) => item.hasInput)
      .map((item) => ({
        role: item.role,
      }));

    if (deleteMany.length === 0) {
      return undefined;
    }

    return {
      create,
      deleteMany,
    };
  }

  if (create.length === 0) {
    return undefined;
  }

  return {
    create,
  };
}

export async function buildRentalTenantMutationData(
  tx: any,
  body: Record<string, any>,
): Promise<RentalTenantCreateData>;
export async function buildRentalTenantMutationData(
  tx: any,
  body: Record<string, any>,
  options: {
    isUpdate: true;
  },
): Promise<RentalTenantUpdateData>;

export async function buildRentalTenantMutationData(
  tx: any,
  body: Record<string, any>,
  options: {
    isUpdate?: boolean;
  } = {},
): Promise<RentalTenantMutationData> {
  const isUpdate = Boolean(options.isUpdate);
  const data: Record<string, any> = {};

  for (const field of ROOT_MUTATION_FIELDS) {
    if (!isUpdate || hasOwn(body, field)) {
      data[field] = body[field];
    }
  }

  const hydratedPartyStates = await hydratePartySnapshots(tx, [
    buildPartyState(body, 'partyA', CONTRACT_PARTY_ROLE.PARTY_A),
    buildPartyState(body, 'partyB', CONTRACT_PARTY_ROLE.PARTY_B),
  ]);

  const partyAMutation = hydratedPartyStates[0];
  const partyBMutation = hydratedPartyStates[1];

  if (
    !isUpdate ||
    hasOwn(body, 'partyASourceMode') ||
    partyAMutation?.hasInput
  ) {
    data.partyASourceMode =
      partyAMutation?.party?.sourceMode ??
      normalizeSourceMode(body.partyASourceMode);
  }
  if (
    !isUpdate ||
    hasOwn(body, 'partyBSourceMode') ||
    partyBMutation?.hasInput
  ) {
    data.partyBSourceMode =
      partyBMutation?.party?.sourceMode ??
      normalizeSourceMode(body.partyBSourceMode);
  }

  if (!isUpdate || hasOwn(body, 'tenantName') || partyBMutation?.hasInput) {
    data.tenantName =
      partyBMutation?.party?.partyNameSnapshot ??
      normalizeString(body.tenantName) ??
      '';
  }
  if (!isUpdate || hasOwn(body, 'phoneNumber') || partyBMutation?.hasInput) {
    data.phoneNumber =
      partyBMutation?.party?.contactPhoneSnapshot ??
      normalizeString(body.phoneNumber) ??
      '';
  }

  const rentalTenantParties = buildPartyNestedWrite(
    hydratedPartyStates,
    isUpdate,
  );
  if (rentalTenantParties) {
    data.rentalTenantParties = rentalTenantParties;
  }

  return data as RentalTenantMutationData;
}

export function createRentalTenantInclude(
  options: { includeImages?: boolean } = {},
): Prisma.RentalTenantInclude {
  const includeImages = options.includeImages ?? true;

  return {
    ...(includeImages
      ? {
          images: {
            include: {
              image: true,
            },
          },
        }
      : {}),
    rentalTenantParties: {
      include: {
        contractParty: true,
      },
    },
  };
}

function mapTenantImage(item: Record<string, any>) {
  if (!item?.image?.imgId || !item?.image?.imgUrl) {
    return null;
  }
  return {
    imgId: item.image.imgId,
    url: item.image.imgUrl,
  };
}

function mapContractPartySnapshot(item?: null | Record<string, any>) {
  if (!item) {
    return null;
  }

  const master = item.contractParty;
  return {
    address: item.addressSnapshot ?? master?.address ?? '',
    contactName: item.contactNameSnapshot ?? master?.defaultContactName ?? '',
    contactPhone:
      item.contactPhoneSnapshot ?? master?.defaultContactPhone ?? '',
    contractPartyId: item.contractPartyId ?? null,
    idCardNo: master?.idCardNo ?? null,
    partyName: item.partyNameSnapshot ?? master?.partyName ?? '',
    partyType: master?.partyType ?? null,
    remark: item.remarkSnapshot ?? master?.remark ?? '',
    role: item.role,
    sourceMode: item.sourceMode,
    unifiedCreditCode: master?.unifiedCreditCode ?? null,
  };
}

export function mapRentalTenantOutput(item: Record<string, any>) {
  const { images, rentalTenantParties, ...rest } = item;

  const mappedImages = Array.isArray(images)
    ? images
        .map((image) => mapTenantImage(image))
        .filter(
          (image): image is { imgId: number; url: string } => image !== null,
        )
    : [];

  const partyA = mapContractPartySnapshot(
    Array.isArray(rentalTenantParties)
      ? rentalTenantParties.find(
          (party) => party.role === CONTRACT_PARTY_ROLE.PARTY_A,
        )
      : null,
  );
  const partyB = mapContractPartySnapshot(
    Array.isArray(rentalTenantParties)
      ? rentalTenantParties.find(
          (party) => party.role === CONTRACT_PARTY_ROLE.PARTY_B,
        )
      : null,
  );

  return {
    ...rest,
    images: mappedImages,
    partyA,
    partyAAddress: partyA?.address ?? '',
    partyAContactName: partyA?.contactName ?? '',
    partyAContactPhone: partyA?.contactPhone ?? '',
    partyAContractPartyId: partyA?.contractPartyId ?? null,
    partyAName: partyA?.partyName ?? '',
    partyARemark: partyA?.remark ?? '',
    partyB,
    partyBAddress: partyB?.address ?? '',
    partyBContactName: partyB?.contactName ?? '',
    partyBContactPhone: partyB?.contactPhone ?? '',
    partyBContractPartyId: partyB?.contractPartyId ?? null,
    partyBName: partyB?.partyName ?? rest.tenantName ?? '',
    partyBRemark: partyB?.remark ?? '',
    phoneNumber: partyB?.contactPhone ?? rest.phoneNumber ?? '',
    tenantName: partyB?.partyName ?? rest.tenantName ?? '',
  };
}
