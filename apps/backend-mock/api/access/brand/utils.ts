export function normalizeBoolean(value: unknown, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return value === true || value === 'true' || Number(value) === 1;
}

export function normalizeAccessBrandData(body: Record<string, any>) {
  const data = { ...body };

  if (data.brandCode !== undefined) {
    data.brandCode = String(data.brandCode || '')
      .trim()
      .toUpperCase();
  }
  if (data.brandName !== undefined) {
    data.brandName = String(data.brandName || '').trim();
  }
  if (data.enabled !== undefined) {
    data.enabled = normalizeBoolean(data.enabled, true);
  }
  if (data.isDefault !== undefined) {
    data.isDefault = normalizeBoolean(data.isDefault, false);
  }

  return data;
}

export async function ensureSingleDefaultAccessBrand(params: {
  excludeId?: number;
  prismaClient: any;
}) {
  await params.prismaClient.accessBrand.updateMany({
    data: {
      isDefault: false,
    },
    where: {
      accessBrandId: params.excludeId
        ? {
            not: params.excludeId,
          }
        : undefined,
    },
  });
}
