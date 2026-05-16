import { createHash } from 'node:crypto';

function buildSha256Hex(parts: Array<null | number | string | undefined>) {
  return createHash('sha256')
    .update(parts.map((part) => String(part ?? '')).join('|'))
    .digest('hex');
}

export function isSha256Hex(value: unknown) {
  return /^[a-f0-9]{64}$/.test(String(value || ''));
}

export function buildExternalLeadDedupeKey(input: {
  companyName: string;
  sourceUrl: string;
}) {
  return buildSha256Hex([input.sourceUrl, input.companyName]);
}

export function buildExternalLeadEvidenceHash(input: {
  evidenceType: string;
  rawText?: null | string;
  sourceLink: string;
}) {
  return buildSha256Hex([
    input.sourceLink,
    input.evidenceType,
    input.rawText || '',
  ]);
}

export function buildSignalEventHash(input: {
  companyName: string;
  eventTitle: string;
  relatedExternalLeadId?: null | number;
  sourceUrl: string;
}) {
  return buildSha256Hex([
    input.relatedExternalLeadId || '',
    input.companyName,
    input.sourceUrl,
    input.eventTitle,
  ]);
}

export function buildSignalEvidenceHash(input: {
  evidenceType: string;
  rawText?: null | string;
  sourceLink: string;
}) {
  return buildExternalLeadEvidenceHash(input);
}
