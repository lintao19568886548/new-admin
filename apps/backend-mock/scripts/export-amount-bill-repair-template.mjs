import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendMockDir = path.resolve(scriptDir, '..');
const defaultReportsDir = path.resolve(backendMockDir, 'reports');

function stripWrappingQuotes(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }
  return text;
}

function parseArgs(argv) {
  const options = {
    input: '',
    outputDir: 'default',
  };

  for (const arg of argv.filter((item) => item !== '--')) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) {
      throw new Error(`未知参数: ${arg}`);
    }

    const [, key, value] = match;
    if (key === 'input') {
      options.input = path.resolve(process.cwd(), stripWrappingQuotes(value));
      continue;
    }

    if (key === 'output-dir') {
      const outputDir = stripWrappingQuotes(value);
      options.outputDir =
        outputDir === 'default'
          ? outputDir
          : path.resolve(process.cwd(), outputDir);
      continue;
    }

    throw new Error(`未知参数: ${arg}`);
  }

  return options;
}

async function findLatestAnomalyReport() {
  const files = await readdir(defaultReportsDir);
  const reportFile = files
    .filter((file) => /^amount-bill-anomalies-.*\.json$/.test(file))
    .sort()
    .at(-1);

  if (!reportFile) {
    throw new Error('未找到 amount-bill-anomalies-*.json 诊断报告');
  }

  return path.join(defaultReportsDir, reportFile);
}

function getSection(payload, key) {
  return payload.sections?.find((section) => section.key === key)?.rows || [];
}

function toReviewItem(type, row, allowedActions, suggestedAction = '') {
  return {
    action: suggestedAction,
    allowedActions,
    approved: false,
    current: row,
    note: '',
    type,
  };
}

function buildTemplate(inputPath, payload) {
  return {
    generatedAt: new Date().toISOString(),
    instructions: [
      '该文件是业务确认模板，不会自动修改数据库。',
      '只在确认无误的条目上填写 action，并把 approved 改为 true。',
      '不要删除 current 中的原始字段；修复脚本会用它做二次校验。',
      '批量执行前必须重新备份关键表。',
    ],
    items: {
      duplicateTenantProjectBills: getSection(
        payload,
        'duplicateTenantProjectBills',
      ).map((row) =>
        toReviewItem('duplicateTenantProjectBills', row, [
          'keep_one_void_others',
          'merge_then_void_duplicates',
          'not_duplicate',
          'needs_manual_review',
        ]),
      ),
      eleFeeDetailMismatch: getSection(payload, 'eleFeeDetailMismatch').map(
        (row) =>
          toReviewItem('eleFeeDetailMismatch', row, [
            'set_ele_fee_to_detail_total',
            'keep_total_review_detail',
            'ignore_rounding_diff',
            'needs_manual_review',
          ]),
      ),
      emptyOrZeroBills: getSection(payload, 'emptyOrZeroBills').map((row) =>
        toReviewItem('emptyOrZeroBills', row, [
          'fill_missing_project_or_tenant',
          'set_total_fee_after_recheck',
          'void_bill',
          'delete_test_bill',
          'needs_manual_review',
        ]),
      ),
      originalTextPercentPollution: getSection(
        payload,
        'originalTextPercentPollution',
      ).map((row) =>
        toReviewItem(
          'originalTextPercentPollution',
          row,
          ['clean_original_text', 'resave_bill', 'needs_manual_review'],
          row.originalText ? 'clean_original_text' : '',
        ),
      ),
      projectYearOutlier: getSection(payload, 'projectYearOutlier').map((row) =>
        toReviewItem('projectYearOutlier', row, [
          'fix_project_name',
          'keep_project_name',
          'needs_manual_review',
        ]),
      ),
      receiptOverTotal: getSection(payload, 'receiptOverTotal').map((row) =>
        toReviewItem('receiptOverTotal', row, [
          'set_total_fee_to_receipt_amount',
          'record_as_overpayment',
          'split_prepayment',
          'clear_wrong_receipt',
          'needs_manual_review',
        ]),
      ),
      totalFeeComponentMismatch: getSection(
        payload,
        'totalFeeComponentMismatch',
      ).map((row) =>
        toReviewItem('totalFeeComponentMismatch', row, [
          'set_total_fee_to_component_total',
          'adjust_component_field',
          'keep_total_fee',
          'needs_manual_review',
        ]),
      ),
      waterFeeDetailMismatch: getSection(payload, 'waterFeeDetailMismatch').map(
        (row) =>
          toReviewItem('waterFeeDetailMismatch', row, [
            'set_water_fee_to_detail_total',
            'keep_total_review_detail',
            'ignore_rounding_diff',
            'needs_manual_review',
          ]),
      ),
    },
    sourceReport: path.relative(process.cwd(), inputPath),
    sourceReportGeneratedAt: payload.generatedAt || '',
  };
}

function buildTemplateFileName() {
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  return `amount-bill-repair-confirmation-template-${timestamp}.json`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = options.input || (await findLatestAnomalyReport());
  const outputDir =
    options.outputDir === 'default' ? defaultReportsDir : options.outputDir;
  const payload = JSON.parse(await readFile(inputPath, 'utf8'));
  const template = buildTemplate(inputPath, payload);
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, buildTemplateFileName());
  await writeFile(outputPath, JSON.stringify(template, null, 2), 'utf8');

  console.log(
    JSON.stringify(
      {
        itemCounts: Object.fromEntries(
          Object.entries(template.items).map(([key, rows]) => [
            key,
            rows.length,
          ]),
        ),
        outputPath,
        sourceReport: template.sourceReport,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('[export-amount-bill-repair-template] 执行失败:', error);
  process.exitCode = 1;
});
