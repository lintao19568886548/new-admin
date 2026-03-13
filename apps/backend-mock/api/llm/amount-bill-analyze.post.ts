import { parseBailianJson, requestBailianChat } from '~/utils/bailian';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

interface AmountBillLlmMeterItem {
  currentReading?: null | number | string;
  meterName?: string;
  multiplier?: null | number | string;
  previousReading?: null | number | string;
  remark?: string;
  unitPrice?: null | number | string;
}

interface AmountBillLlmResult {
  eleFee?: null | number | string;
  eleItems?: AmountBillLlmMeterItem[];
  extraProjectItems?: Array<{
    itemName?: string;
    value?: null | number | string;
  }>;
  factoryRent?: null | number | string;
  garbageFee?: null | number | string;
  invoiceTax?: null | number | string;
  managementFee?: null | number | string;
  parkName?: string;
  penaltyFee?: null | number | string;
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
  receiptAmount?: null | number | string;
  receiptTime?: string;
  remark?: string;
  serviceFee?: null | number | string;
  tenantName?: string;
  totalFee?: null | number | string;
  waterFee?: null | number | string;
  waterItems?: AmountBillLlmMeterItem[];
}

const MAX_CHAR_LENGTH = 25_000;

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = ((await readBody(event).catch(() => ({}))) || {}) as {
    workbookText?: string;
  };
  const workbookText = String(body.workbookText || '').trim();

  if (!workbookText) {
    return badRequestResponse('缺少 Excel 文本内容', event);
  }

  const prompt = `你会从账单Excel中提取“新增总账单”字段。请严格返回 JSON，不要 markdown，不要解释。

JSON结构如下（字段缺失时请返回空字符串、null 或空数组）：
{
  "tenantName": "",
  "projectName": "",
  "parkName": "",
  "receiptTime": "YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss",
  "receiptAmount": null,
  "eleFee": null,
  "waterFee": null,
  "factoryRent": null,
  "managementFee": null,
  "garbageFee": null,
  "serviceFee": null,
  "invoiceTax": null,
  "penaltyFee": null,
  "totalFee": null,
  "remark": "",
  "publicBankAccount": {"name": "", "number": "", "bank": ""},
  "privateBankAccount": {"name": "", "number": "", "bank": ""},
  "eleItems": [
    {"meterName": "", "previousReading": null, "currentReading": null, "multiplier": null, "unitPrice": null, "remark": ""}
  ],
  "waterItems": [
    {"meterName": "", "previousReading": null, "currentReading": null, "multiplier": null, "unitPrice": null, "remark": ""}
  ],
  "extraProjectItems": [
    {"itemName": "", "value": null}
  ]
}`;

  try {
    const truncatedText =
      workbookText.length > MAX_CHAR_LENGTH
        ? workbookText.slice(0, MAX_CHAR_LENGTH)
        : workbookText;
    const requestStartedAt = Date.now();
    console.info('[llm][amount-bill] request start', {
      maxTokens: 1000,
      truncatedTextLength: truncatedText.length,
      workbookTextLength: workbookText.length,
    });

    const completion = await requestBailianChat({
      maxTokens: 1000,
      messages: [
        {
          content: '你是财务账单字段提取助手，只能输出 JSON。',
          role: 'system',
        },
        {
          content: `${prompt}\n\n以下是Excel提取的文本（TSV，首列为行号）：\n${truncatedText}`,
          role: 'user',
        },
      ],
      temperature: 0,
    });

    const result = parseBailianJson<AmountBillLlmResult>(completion);
    console.info('[llm][amount-bill] request done', {
      durationMs: Date.now() - requestStartedAt,
      hasResult: Boolean(result),
    });
    return useResponseSuccess(result);
  } catch (error: any) {
    console.error('账单 AI 识别失败:', error?.response?.data || error);
    const message =
      error?.response?.data?.error?.message ||
      error?.response?.data?.message ||
      error?.message ||
      '账单 AI 识别失败';
    return serverErrorResponse(message, event);
  }
});
