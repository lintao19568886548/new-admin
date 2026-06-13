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
  return (
    payload.sections?.find((section) => section.key === key) || {
      count: 0,
      rows: [],
      title: key,
    }
  );
}

function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function escapeCell(value) {
  return asText(value)
    .replaceAll('|', String.raw`\|`)
    .replaceAll('\r', ' ')
    .replaceAll('\n', ' ');
}

function formatAmount(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : asText(value);
}

function buildTable(headers, rows) {
  if (rows.length === 0) {
    return '无。\n';
  }

  const lines = [
    `| ${headers.map((header) => escapeCell(header)).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(
      (row) => `| ${row.map((cell) => escapeCell(cell)).join(' | ')} |`,
    ),
  ];

  return `${lines.join('\n')}\n`;
}

function summarizeOverpaid(rows) {
  const overpaidAmount = rows.reduce(
    (total, row) => total + Number(row.overpaidAmount || 0),
    0,
  );
  const zeroTotalCount = rows.filter(
    (row) => Number(row.totalFee || 0) === 0,
  ).length;

  return {
    overpaidAmount,
    positiveTotalCount: rows.length - zeroTotalCount,
    zeroTotalCount,
  };
}

function getEmptyBillReasons(row) {
  const reasons = [];
  if (!asText(row.projectName).trim()) reasons.push('空项目');
  if (!asText(row.tenantName).trim()) reasons.push('空租户');
  if (Number(row.totalFee || 0) <= 0) reasons.push('应收<=0');
  return reasons;
}

function suggestOverpaidAction(row) {
  if (Number(row.totalFee || 0) === 0) {
    return '先核对应收是否漏填，确认后补应收或作废';
  }
  return '确认是多收/预收/应收少算，再调整账单或流水';
}

function suggestEmptyBillAction(row) {
  const reasons = getEmptyBillReasons(row);
  if (reasons.includes('应收<=0') && Number(row.receiptAmount || 0) > 0) {
    return '优先核对应收漏填，不能直接删除';
  }
  return '确认是否测试/空白单，确认后补字段或作废';
}

function buildReviewMarkdown(inputPath, payload) {
  const unpaidWithReceiptTime = getSection(payload, 'unpaidWithReceiptTime');
  const paidWithoutReceiptTime = getSection(payload, 'paidWithoutReceiptTime');
  const receiptOverTotal = getSection(payload, 'receiptOverTotal');
  const financeMismatch = getSection(payload, 'financeMismatch');
  const eleTotalRows = getSection(payload, 'eleTotalRows');
  const waterTotalRows = getSection(payload, 'waterTotalRows');
  const emptyOrZeroBills = getSection(payload, 'emptyOrZeroBills');
  const totalFeeComponentMismatch = getSection(
    payload,
    'totalFeeComponentMismatch',
  );
  const eleFeeDetailMismatch = getSection(payload, 'eleFeeDetailMismatch');
  const waterFeeDetailMismatch = getSection(payload, 'waterFeeDetailMismatch');
  const projectYearOutlier = getSection(payload, 'projectYearOutlier');
  const originalTextPercentPollution = getSection(
    payload,
    'originalTextPercentPollution',
  );
  const duplicateTenantProjectBills = getSection(
    payload,
    'duplicateTenantProjectBills',
  );

  const overpaidSummary = summarizeOverpaid(receiptOverTotal.rows);
  const extraDuplicateBills = duplicateTenantProjectBills.rows.reduce(
    (total, row) => total + Math.max(Number(row.duplicateCount || 0) - 1, 0),
    0,
  );

  const summaryRows = [
    ['未收款但有收款时间', unpaidWithReceiptTime.count, '安全项'],
    ['有收款金额但无收款时间', paidWithoutReceiptTime.count, '安全项'],
    ['电费明细保存合计行', eleTotalRows.count, '安全项'],
    ['水费明细保存合计行', waterTotalRows.count, '安全项'],
    ['收款金额大于应收金额', receiptOverTotal.count, '需业务确认'],
    ['已收款账单与财务流水不一致', financeMismatch.count, '需业务确认'],
    ['空项目/空租户/零金额账单', emptyOrZeroBills.count, '需业务确认'],
    ['应收总额与费用项合计不一致', totalFeeComponentMismatch.count, '需复核'],
    ['电费总账与电费明细合计不一致', eleFeeDetailMismatch.count, '需复核'],
    ['水费总账与水费明细合计不一致', waterFeeDetailMismatch.count, '需复核'],
    ['项目名年份疑似异常', projectYearOutlier.count, '需复核'],
    [
      '金额 originalText 保存了百分比展示值',
      originalTextPercentPollution.count,
      '需复核',
    ],
    [
      '同园区/同项目/同租户疑似重复账单',
      duplicateTenantProjectBills.count,
      '需业务确认',
    ],
  ];

  const overpaidRows = receiptOverTotal.rows.map((row) => [
    row.billId,
    row.tenantName,
    row.projectName,
    formatAmount(row.totalFee),
    formatAmount(row.receiptAmount),
    formatAmount(row.overpaidAmount),
    row.receiptTime,
    suggestOverpaidAction(row),
  ]);

  const emptyRows = emptyOrZeroBills.rows.map((row) => [
    row.billId,
    row.tenantName,
    row.projectName,
    formatAmount(row.totalFee),
    formatAmount(row.receiptAmount),
    row.createTime,
    getEmptyBillReasons(row).join(', '),
    suggestEmptyBillAction(row),
  ]);

  const duplicateRows = duplicateTenantProjectBills.rows.map((row) => [
    row.parkId,
    row.tenantName,
    row.projectName,
    row.duplicateCount,
    row.billIds,
    formatAmount(row.totalFee),
    '确认保留哪张，确认后再合并/作废多余账单',
  ]);

  return [
    '# 账单管理异常业务确认清单',
    '',
    `- 来源诊断报告：\`${path.relative(process.cwd(), inputPath)}\``,
    `- 诊断生成时间：\`${payload.generatedAt || ''}\``,
    `- 审核清单生成时间：\`${new Date().toISOString()}\``,
    '',
    '## 异常汇总',
    '',
    buildTable(['异常类型', '数量', '处理属性'], summaryRows),
    '',
    '## 剩余业务异常拆分',
    '',
    `- 多收异常合计差额：\`${overpaidSummary.overpaidAmount.toFixed(2)}\`。`,
    `- 多收异常中，应收为 \`0\` 但有实收：\`${overpaidSummary.zeroTotalCount}\` 条。`,
    `- 多收异常中，应收大于 \`0\` 但实收超过应收：\`${overpaidSummary.positiveTotalCount}\` 条。`,
    `- 疑似重复账单多余副本估算：\`${extraDuplicateBills}\` 张。`,
    '',
    '## 收款金额大于应收金额',
    '',
    buildTable(
      [
        'billId',
        '租户',
        '项目',
        '应收',
        '实收',
        '多收差额',
        '收款时间',
        '建议处理',
      ],
      overpaidRows,
    ),
    '',
    '## 空项目/空租户/零金额账单',
    '',
    buildTable(
      [
        'billId',
        '租户',
        '项目',
        '应收',
        '实收',
        '创建时间',
        '原因',
        '建议处理',
      ],
      emptyRows,
    ),
    '',
    '## 同园区/同项目/同租户疑似重复账单',
    '',
    buildTable(
      ['parkId', '租户', '项目', '重复数', 'billIds', '应收合计', '建议处理'],
      duplicateRows,
    ),
    '',
    '## 应收总额与费用项合计不一致',
    '',
    buildTable(
      ['billId', '租户', '项目', '应收', '费用项合计', '差额', '建议处理'],
      totalFeeComponentMismatch.rows.map((row) => [
        row.billId,
        row.tenantName,
        row.projectName,
        formatAmount(row.totalFee),
        formatAmount(row.componentTotal),
        formatAmount(row.diffAmount),
        '核对表格项目合计，确认 totalFee 是否漏算或多算',
      ]),
    ),
    '',
    '## 电费总账与电费明细合计不一致',
    '',
    buildTable(
      [
        'billId',
        '租户',
        '项目',
        '电费总账',
        '电费明细合计',
        '差额',
        '建议处理',
      ],
      eleFeeDetailMismatch.rows.map((row) => [
        row.billId,
        row.tenantName,
        row.projectName,
        formatAmount(row.eleFee),
        formatAmount(row.detailAmount),
        formatAmount(row.diffAmount),
        '核对电费明细是否缺行、重复或总账字段未同步',
      ]),
    ),
    '',
    '## 水费总账与水费明细合计不一致',
    '',
    buildTable(
      [
        'billId',
        '租户',
        '项目',
        '水费总账',
        '水费明细合计',
        '差额',
        '建议处理',
      ],
      waterFeeDetailMismatch.rows.map((row) => [
        row.billId,
        row.tenantName,
        row.projectName,
        formatAmount(row.waterFee),
        formatAmount(row.detailAmount),
        formatAmount(row.diffAmount),
        '核对水费明细是否缺行、重复或总账字段未同步',
      ]),
    ),
    '',
    '## 项目名年份疑似异常',
    '',
    buildTable(
      ['billId', '租户', '项目', '应收', '实收', '创建时间', '建议处理'],
      projectYearOutlier.rows.map((row) => [
        row.billId,
        row.tenantName,
        row.projectName,
        formatAmount(row.totalFee),
        formatAmount(row.receiptAmount),
        row.createTime,
        '核对项目名月份/年份是否写错',
      ]),
    ),
    '',
    '## 金额 originalText 保存了百分比展示值',
    '',
    buildTable(
      [
        'billId',
        '租户',
        '项目',
        '来源',
        '行名',
        '字段',
        'originalText',
        'value',
        '建议处理',
      ],
      originalTextPercentPollution.rows.map((row) => [
        row.billId,
        row.tenantName,
        row.projectName,
        row.source,
        row.rowName,
        row.fieldName,
        row.originalText,
        row.value,
        '重新保存账单或按确认结果清洗 originalText',
      ]),
    ),
    '',
  ].join('\n');
}

function buildReviewFileName() {
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  return `amount-bill-anomaly-review-${timestamp}.md`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = options.input || (await findLatestAnomalyReport());
  const outputDir =
    options.outputDir === 'default' ? defaultReportsDir : options.outputDir;
  const payload = JSON.parse(await readFile(inputPath, 'utf8'));
  const markdown = buildReviewMarkdown(inputPath, payload);
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, buildReviewFileName());
  await writeFile(outputPath, markdown, 'utf8');

  console.log(
    JSON.stringify(
      {
        inputPath,
        outputPath,
        sections: payload.sections?.map((section) => ({
          count: section.count,
          key: section.key,
          title: section.title,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('[export-amount-bill-anomaly-review] 执行失败:', error);
  process.exitCode = 1;
});
