import { createHash } from 'node:crypto';

import { readMultipartFormData } from 'h3';
import {
  deleteBailianFile,
  parseBailianJson,
  requestBailianChat,
  retrieveBailianFile,
  uploadBailianFile,
} from '~/utils/bailian';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

interface AmountBillLlmMeterItem {
  amount?: string;
  currentReading?: string;
  meterName?: string;
  multiplier?: string;
  monthlyUsage?: string;
  previousReading?: string;
  remark?: string;
  totalUsage?: string;
  unitPrice?: string;
}

interface AmountBillLlmResult {
  eleFee?: string;
  eleItems?: AmountBillLlmMeterItem[];
  extraProjectItems?: Array<{
    itemName?: string;
    value?: string;
  }>;
  factoryRent?: string;
  garbageFee?: string;
  invoiceTax?: string;
  managementFee?: string;
  parkName?: string;
  penaltyFee?: string;
  privateBankAccount?: {
    bank?: string;
    name?: string;
    number?: string;
  };
  projectName?: string;
  publicBankAccount?: {
    bank?: string;
    name?: string;
    number?: string;
  };
  receiptAmount?: string;
  receiptTime?: string;
  remark?: string;
  serviceFee?: string;
  tenantName?: string;
  totalFee?: string;
  waterFee?: string;
  waterItems?: AmountBillLlmMeterItem[];
}

const AMOUNT_BILL_CACHE_TTL_MS = 10 * 60_000;
const AMOUNT_BILL_FILE_MAX_SIZE_BYTES = 150 * 1024 * 1024;
const AMOUNT_BILL_FILE_READY_MAX_WAIT_MS = 90_000;
const AMOUNT_BILL_FILE_READY_POLL_INTERVAL_MS = 1500;
const AMOUNT_BILL_FORMULA_CONTEXT_MAX_CHARS = 20_000;
const AMOUNT_BILL_PRIMARY_MODEL = 'qwen-doc-turbo';
const AMOUNT_BILL_FALLBACK_MODEL = 'qwen-long';
const amountBillResultCache = new Map<
  string,
  {
    expiresAt: number;
    result: AmountBillLlmResult;
  }
>();

function getAmountBillCacheKey(fileData: Uint8Array) {
  return createHash('sha256').update(fileData).digest('hex');
}

function hasMeaningfulText(value: unknown) {
  return Boolean(String(value || '').trim());
}

function hasMeaningfulAmountBillResult(
  result: AmountBillLlmResult | null | undefined,
) {
  if (!result) {
    return false;
  }

  return Boolean(
    hasMeaningfulText(result.tenantName) ||
    hasMeaningfulText(result.projectName) ||
    hasMeaningfulText(result.parkName) ||
    hasMeaningfulText(result.receiptAmount) ||
    hasMeaningfulText(result.totalFee) ||
    hasMeaningfulText(result.eleFee) ||
    hasMeaningfulText(result.waterFee) ||
    (result.eleItems?.length ?? 0) > 0 ||
    (result.waterItems?.length ?? 0) > 0 ||
    (result.extraProjectItems?.length ?? 0) > 0,
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getErrorMessage(error: any) {
  return String(
    error?.response?.data?.error?.message ||
      error?.response?.data?.message ||
      error?.message ||
      '',
  );
}

function shouldFallbackToLongModel(error: any) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('model not exist') ||
    message.includes('unsupported') ||
    message.includes('not support') ||
    message.includes('invalid model') ||
    message.includes('region')
  );
}

function getMultipartText(part: undefined | { data?: Uint8Array }) {
  if (!part?.data) return '';
  return Buffer.from(part.data)
    .toString('utf8')
    .slice(0, AMOUNT_BILL_FORMULA_CONTEXT_MAX_CHARS)
    .trim();
}

async function requestAmountBillCompletion(
  uploadedFileId: string,
  prompt: string,
) {
  const models = [AMOUNT_BILL_PRIMARY_MODEL, AMOUNT_BILL_FALLBACK_MODEL];
  let lastError: any;

  for (const [index, model] of models.entries()) {
    try {
      return await requestBailianChat({
        messages: [
          {
            content:
              'You extract bill fields from uploaded Excel workbooks and return JSON only.',
            role: 'system',
          },
          {
            content: `fileid://${uploadedFileId}`,
            role: 'system',
          },
          {
            content: prompt,
            role: 'user',
          },
        ],
        model,
        temperature: 0,
      });
    } catch (error) {
      lastError = error;
      const canFallback =
        index < models.length - 1 && shouldFallbackToLongModel(error);
      if (!canFallback) {
        throw error;
      }
      console.warn(
        '[llm][amount-bill] primary model failed, fallback to qwen-long',
        {
          error: getErrorMessage(error),
          fromModel: model,
          toModel: models[index + 1],
        },
      );
    }
  }

  throw lastError;
}

async function waitForBailianFileReady(fileId: string) {
  const startedAt = Date.now();
  let lastStatus = '';

  while (Date.now() - startedAt <= AMOUNT_BILL_FILE_READY_MAX_WAIT_MS) {
    const fileInfo = await retrieveBailianFile(fileId);
    const status = String(fileInfo?.status || '')
      .trim()
      .toLowerCase();
    if (!status || ['processed', 'ready', 'succeeded'].includes(status)) {
      return fileInfo;
    }

    if (['cancelled', 'error', 'failed'].includes(status)) {
      throw new Error(`Bailian file parse failed: ${status}`);
    }

    lastStatus = status;
    await sleep(AMOUNT_BILL_FILE_READY_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Bailian file parse timed out${
      lastStatus ? ` with status ${lastStatus}` : ''
    }`,
  );
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const formData = await readMultipartFormData(event).catch(() => null);
  const file =
    formData?.find((part) => part.name === 'file' && part.filename) ||
    formData?.[0];
  const formulaContext = getMultipartText(
    formData?.find((part) => part.name === 'formulaContext'),
  );

  if (!file?.data || file.data.length === 0) {
    return badRequestResponse('Missing Excel file', event);
  }

  const fileName = String(file.filename || '').trim();
  if (!/\.xlsx$/i.test(fileName)) {
    return badRequestResponse(
      'Bailian direct file parsing currently supports only .xlsx files',
      event,
    );
  }

  if (file.data.length > AMOUNT_BILL_FILE_MAX_SIZE_BYTES) {
    return badRequestResponse('Excel file is too large', event);
  }

  const cacheKey = getAmountBillCacheKey(file.data);
  const cachedResult = amountBillResultCache.get(cacheKey);
  if (cachedResult && cachedResult.expiresAt > Date.now()) {
    return useResponseSuccess(cachedResult.result);
  }

  const prompt = [
    'Please read the uploaded Excel bill workbook and extract the bill fields.',
    'Return JSON only, and do not wrap the JSON in markdown code fences.',
    formulaContext
      ? [
          'The application also parsed this formula context from the same workbook.',
          'Use it to preserve original Excel formulas when they match extracted rows.',
          'If a meter row has formulas, put them in monthlyUsage, totalUsage and amount.',
          'If an extra fee row has a formula, put it in extraProjectItems.value.',
          formulaContext,
        ].join('\n')
      : '',
    'Rules:',
    '1. Keep all scalar values as strings. Use "" when the value is unknown.',
    '2. eleItems and waterItems should contain only real meter rows.',
    '3. extraProjectItems should keep only extra fee items outside the standard fields.',
    '4. Preserve original date text in receiptTime when you cannot normalize it.',
    '5. tenantName, parkName and projectName must be concise entity names, not document titles.',
    '6. If a candidate name contains words like 明细, 通知单, 账单, 水电, 房租, 租金, 收费 or looks like a heading, return "" instead.',
    '7. Keep remark short and useful.',
    '8. Use exactly this JSON object schema:',
    '{"tenantName":"","projectName":"","parkName":"","receiptTime":"","receiptAmount":"","eleFee":"","waterFee":"","factoryRent":"","managementFee":"","garbageFee":"","serviceFee":"","invoiceTax":"","penaltyFee":"","totalFee":"","remark":"","publicBankAccount":{"name":"","number":"","bank":""},"privateBankAccount":{"name":"","number":"","bank":""},"eleItems":[{"meterName":"","previousReading":"","currentReading":"","monthlyUsage":"","multiplier":"","totalUsage":"","unitPrice":"","amount":"","remark":""}],"waterItems":[{"meterName":"","previousReading":"","currentReading":"","monthlyUsage":"","multiplier":"","totalUsage":"","unitPrice":"","amount":"","remark":""}],"extraProjectItems":[{"itemName":"","value":""}]}',
  ]
    .filter(Boolean)
    .join('\n');

  let uploadedFileId = '';

  try {
    const requestStartedAt = Date.now();
    console.info('[llm][amount-bill] request start', {
      fileName,
      fileSize: file.data.length,
      fallbackModel: AMOUNT_BILL_FALLBACK_MODEL,
      primaryModel: AMOUNT_BILL_PRIMARY_MODEL,
    });

    const uploadedFile = await uploadBailianFile({
      contentType:
        file.type ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data: file.data,
      filename: fileName,
    });

    uploadedFileId = String(uploadedFile?.id || '').trim();
    if (!uploadedFileId) {
      throw new Error('Bailian file upload returned no file id');
    }

    await waitForBailianFileReady(uploadedFileId);

    const completion = await requestAmountBillCompletion(
      uploadedFileId,
      prompt,
    );

    const result = parseBailianJson<AmountBillLlmResult>(completion);
    console.info('[llm][amount-bill] request done', {
      durationMs: Date.now() - requestStartedAt,
      hasResult: hasMeaningfulAmountBillResult(result),
    });

    if (!hasMeaningfulAmountBillResult(result)) {
      return useResponseSuccess(null);
    }

    amountBillResultCache.set(cacheKey, {
      expiresAt: Date.now() + AMOUNT_BILL_CACHE_TTL_MS,
      result,
    });

    return useResponseSuccess(result);
  } catch (error: any) {
    console.error(
      'Amount bill AI analyze failed:',
      error?.response?.data || error,
    );
    const message = getErrorMessage(error) || 'Amount bill AI analyze failed';
    return serverErrorResponse(message, event);
  } finally {
    if (uploadedFileId) {
      void deleteBailianFile(uploadedFileId);
    }
  }
});
