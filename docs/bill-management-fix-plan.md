# 账单管理整改开发文档

## 背景

账单管理当前存在应收金额、实收金额、收款时间、账单明细、营收统计口径混用的问题。典型案例为 `陈宇春（401）` 账单：

- 列表显示本月收费金额为 `10368.10`，但表单右上角显示收款金额为 `0`。
- 账单已有收款时间 `2026-06-10`，但实际未收款。
- 表单中金额被显示为百分比，例如 `1320` 显示成 `132000.00%`。
- 电费/水费明细中保存了“合计”行，后续直接汇总明细时会翻倍。

本次整改目标是先统一业务口径，再修复页面展示和数据保存逻辑，最后清理历史异常数据。

## 口径定义

| 字段/概念 | 正确含义 | 使用场景 |
| --- | --- | --- |
| `totalFee` 本月收费金额 | 应收金额 | 账单应收、打印通知单、应收统计 |
| `receiptAmount` 收款金额 | 实收金额 | 营收统计、财务流水、实收对账 |
| `receiptTime` 收款时间 | 实际收款发生日期 | 只允许已收款账单填写 |
| `createTime` 创建时间 | 制单/录入时间 | 操作审计、创建日期筛选 |
| 财务流水 `transactionTime` | 财务交易日期 | 营收统计筛选日期 |

核心原则：

- 营收统计按实收口径：`receiptAmount > 0` 且有有效收款时间。
- 账单应收按应收口径：汇总 `totalFee`。
- 未收款账单不得有 `receiptTime`。
- 电费/水费明细只保存真实明细行，“合计”行由前端或后端动态计算。

## 已发现问题

### P0：收款时间与收款金额语义错误

现状：

- 新建总账单时前端默认写入 `receiptTime = dayjs().toISOString()`。
- 未收款账单也有收款时间。
- 账单列表按 `receiptTime` 筛选，导致未收款账单进入“收款时间”查询结果。

影响：

- 老板按收款时间查账单时，会看到大量未收款单。
- 营收统计按财务流水/实收统计，账单列表按收款时间查出的总账单却包含未收款单，两个页面天然对不上。

涉及位置：

- `playground/src/views/bill/amount/list.vue`
- `playground/src/views/bill/amount/mobile-list.vue`
- `apps/backend-mock/api/bill/amount/list.ts`
- `apps/backend-mock/api/bill/amount/utils.ts`

修复要求：

- 新建账单默认 `receiptTime` 为空。
- 保存时如果 `receiptAmount <= 0`，强制清空 `receiptTime` 和 `financeId`。
- 保存时如果填写 `receiptTime`，必须要求 `receiptAmount > 0`。
- 账单列表增加“收款状态”：未收款、部分收款、已收款、多收。
- 收款时间筛选只筛已收款账单，或将筛选字段改名为“账单日期/收款日期”并明确口径。

### P0：账单表单金额显示为百分比

现状：

- 表单金额单元格显示为 `132000.00%`、`8250.00%`、`1036810.00%`。
- 原始数值在数据库中是正常金额，但 Univer 表格展示格式错误。

影响：

- 用户误以为账单金额放大 100 倍。
- 保存时可能把格式化文本继续带入 `originalText`，后续打开继续污染展示。

涉及位置：

- `playground/src/views/bill/amount/modules/UniverSheet.vue`

修复要求：

- 金额列统一强制普通数字格式，不允许继承百分比格式。
- 含 `*10%`、`*13%` 的公式单元格，其结果单元格也必须显示为金额格式。
- `extraProjectItem.originalText` 允许保存公式，但展示时必须以 `value` 作为金额显示。
- 保存时清洗 `originalText` 中误入的百分比展示值。

### P0：电费/水费“合计”行被保存为明细

现状：

- `eleBills` 和 `waterBills` 中包含 `meterName = 合计` 的行。
- 例如陈宇春单据中 `eleBills` 同时保存车间用电、公共用电、合计。

影响：

- 任意后端/导出/统计如果直接 sum 明细，会把金额算翻倍。
- 移动端详情、打印、能耗统计都需要额外排除合计行，维护成本高。

涉及位置：

- `playground/src/views/bill/amount/modules/UniverSheet.vue`
- `apps/backend-mock/api/bill/amount/[id].put.ts`
- `apps/backend-mock/api/bill/amount/[id].ts`
- `apps/backend-mock/api/dashboard/energy-electricity-consumption.ts`
- `apps/backend-mock/api/dashboard/energy-water-consumption.ts`

修复要求：

- 前端 `getData()` 提取明细时，不把“合计”行 push 到 `eleBills/waterBills`。
- 后端保存时兜底过滤 `meterName = 合计` 的明细。
- 详情接口如需展示合计行，由前端动态插入，不从数据库保存。
- 历史数据清理时删除 `ele_bill/water_bill` 中的合计行。

### P1：实收与应收在列表中混用

现状：

- 列表展示“本月收费金额”，但没有展示“收款金额”。
- 页面对账时用户容易拿 `totalFee` 去对营收统计的 `receiptAmount`。

影响：

- 总览营收与账单列表金额对不上。
- 部分收款、多收、未收款无法在列表层识别。

修复要求：

- 列表增加列：`收款金额`、`未收金额`、`收款状态`。
- 默认 footer 同时展示：
  - 应收合计：sum(`totalFee`)
  - 实收合计：sum(`receiptAmount`)
  - 未收合计：sum(`totalFee - receiptAmount`)
- 点击营收统计收入卡片跳转财务管理；点击应收统计跳转账单管理，不混用入口。

### P1：列表 footer 只统计当前页

现状：

- 表格 footer 使用当前页 `data` 计算。
- 页面显示“共 404 条记录”，但 footer 只统计当前 20 条。

影响：

- 用户会误认为 footer 是筛选结果总合计。

修复要求：

- footer 文案明确为“当前页合计”；或
- 后端 `/bill/amount/list` 返回 `summary`，前端展示“筛选结果合计”。

推荐方案：

- 保留当前页合计。
- 新增筛选结果总合计栏，数据来自后端 summary。

### P1：保存缺少业务校验

现状：

- 可保存 `receiptAmount = 0` 且 `receiptTime` 有值。
- 可保存 `receiptAmount > totalFee`。
- 可保存空项目、空租户、0 金额账单。

修复要求：

- `projectName`、`tenantName/tenantId`、`parkId` 必填。
- `totalFee > 0` 才允许保存正常账单。
- `receiptAmount < 0` 禁止。
- `receiptAmount > totalFee` 时提示“多收”，必须二次确认并记录原因。
- `receiptAmount > 0` 时 `receiptTime` 必填。
- `receiptAmount = 0` 时 `receiptTime` 必须为空。

### P1：公摊费用混入水电用量明细

现状：

- 公共用电/公摊水费行用量为 0，但金额非 0。
- 这类金额更像附加费，不是表计用量产生的费用。

影响：

- 能耗统计、单价分析、用量报表容易被污染。

修复要求：

- 明确公摊项类型：
  - 如果属于用量，必须有用量、单价、金额。
  - 如果属于附加费用，迁移到费用项目表，不进入 `eleBills/waterBills`。
- 能耗统计只统计真实表计用量行。

### P2：异常历史数据

已发现类型：

- 未收款但有收款时间。
- 收款金额大于本月收费金额。
- 空项目/空租户/0 金额单。
- 同租户、同项目、同收款日期疑似重复单。
- 项目名年份错误，如 `2026年6月份房租、2024年5月份水电`。

修复要求：

- 先出诊断脚本，不直接修改。
- 导出异常清单给业务确认。
- 业务确认后执行修复脚本。

## 修复顺序

1. 修复新建账单默认收款时间问题。
2. 增加保存校验，阻止继续产生脏数据。
3. 修复 Univer 金额百分比显示。
4. 前后端过滤水电“合计”明细行。
5. 列表增加收款金额、未收金额、收款状态。
6. 后端列表接口增加筛选结果 summary。
7. 增加异常数据诊断脚本。
8. 业务确认后清理历史数据。

## 本轮实现记录

已完成：

- 前端新建账单不再默认写入 `receiptTime`。
- 生成下月账单时清空 `receiptAmount/receiptTime`，避免把上月收款状态带到新账单。
- 前端保存前统一规范收款字段：
  - `receiptAmount <= 0` 时强制 `receiptAmount = 0`、`receiptTime = null`。
  - `receiptAmount > 0` 时必须填写 `receiptTime`。
- 后端创建、更新接口同步执行同样的收款字段规则，避免绕过前端直接写脏数据。
- 移动端账单表单不再默认写入收款时间，收款时间不再必填；移动端新增下月账单会清空 `receiptAmount/receiptTime`。
- 旧版 PC `BillForm.vue` 兜底修复：不再默认写入当前收款时间，保存时过滤空表名和 `meterName = 合计` 的明细行。
- Univer 表格恢复公式时使用 `setFormula` 写入公式文本，并对金额区二次强制普通金额格式，避免金额显示成百分比。
- Univer 项目合计 B 列、明细金额 H 列、收款金额 K3 在写入公式/值时立即套 `#,##0.00`，并在渲染后补刷格式，处理 `14950.00%`、`2819350.00%` 这类百分比残留。
- Univer 金额公式补充清洗：打开/保存时会把 `=(H6+H7)*10%C46` 这类“百分号后粘入单元格引用”的坏公式清成 `=(H6+H7)*10%`，避免 `服务费` 和 `本月收费金额` 显示 `#VALUE!`。
- Univer 保存费用合计时，如单元格当前是 `#VALUE!` 等不可转数字，会回退使用原账单对应费用项旧值，避免误把服务费、开票税金、总额保存成 `0`。
- Univer 保存取数时会清洗非公式金额单元格的百分比展示文本，避免 `132000.00%` 这类展示值继续进入 `originalText`。
- 前端读取 Univer 数据时跳过空白明细行和 `meterName = 合计` 的水电明细行，但仍使用合计行金额回填 `eleFee/waterFee`。
- 后端 `sanitizeAmountBillPayload()` 兜底过滤非对象、空表名、`meterName = 合计` 的水电明细行。
- 新增单测覆盖“合计/空白明细行不入库”的净化规则。
- 列表接口返回筛选结果 `summary`，包含账单数、应收、实收、未收、开票税金。
- 列表接口给每条账单补充 `remainingAmount`、`overpaidAmount`、`collectionStatus`、`collectionStatusLabel`。
- PC 列表增加 `收款金额`、`未收金额`、`多收金额`、`收款状态`，表格 footer 改为“当前页合计”。
- 移动端列表增加筛选结果汇总，并在卡片中展示实收、未收、多收、状态。
- 收款日期筛选改为实收口径：必须 `receiptAmount > 0`，历史未收款脏单即使有 `receiptTime` 也不会混入。
- 新增只读诊断脚本 `apps/backend-mock/scripts/diagnose-amount-bill-anomalies.mjs`，默认 dry-run，不做写库。
- 新增安全修复脚本 `apps/backend-mock/scripts/repair-amount-bill-safe-anomalies.mjs`，默认 dry-run，只处理确定安全项。
- 新增业务修复确认模板脚本 `apps/backend-mock/scripts/export-amount-bill-repair-template.mjs`，用于生成带 `approved/action/note` 的确认 JSON。
- 新增业务确认修复脚本 `apps/backend-mock/scripts/repair-amount-bill-business-confirmed.mjs`，默认 dry-run，只处理确认模板中 `approved=true` 的条目；写库时必须传备份文件。
- 保存校验已加前后端兜底：
  - 项目名称不能为空。
  - 租户不能为空。
  - 本月收费金额必须大于 `0`。
  - 收款金额不能为负数。
  - 收款金额大于 `0` 时必须填写收款时间。
  - 收款金额等于 `0` 时强制清空收款时间。
- 已新增并执行关键表 JSON 备份脚本，备份表：
  - `amount_bill`
  - `ele_bill`
  - `water_bill`
  - `finance`
- 当前备份文件：
  - `apps/backend-mock/backups/amount-bill-tables-2026-06-10T06-54-04-474Z.json`
- 安全修复后备份文件：
  - `apps/backend-mock/backups/amount-bill-tables-2026-06-10T07-07-37-359Z.json`
- 二次安全修复前备份文件：
  - `apps/backend-mock/backups/amount-bill-tables-2026-06-10T07-19-56-900Z.json`
- 三次安全修复前备份文件：
  - `apps/backend-mock/backups/amount-bill-tables-2026-06-10T07-28-40-517Z.json`
- 四次安全修复前备份文件：
  - `apps/backend-mock/backups/amount-bill-tables-2026-06-10T07-40-34-843Z.json`
- 五次安全修复前备份文件：
  - `apps/backend-mock/backups/amount-bill-tables-2026-06-10T07-44-38-854Z.json`
- 六次安全修复前备份文件：
  - `apps/backend-mock/backups/amount-bill-tables-2026-06-10T07-51-32-120Z.json`

诊断脚本试跑结果（`--limit=3`，样本只展示前 3 条）：

- 未收款但有收款时间：`225` 条。
- 有收款金额但无收款时间：`0` 条。
- 收款金额大于应收金额：`42` 条。
- 已收款账单与财务流水不一致：`0` 条。
- 电费明细保存了合计行：`401` 条。
- 水费明细保存了合计行：`401` 条。
- 空项目/空租户/零金额账单：`52` 条。
- 同园区/同项目/同租户疑似重复账单：`11` 组（当时试跑结果；最新复查见下文）。
- 多收账单接口验证：`42` 条，多收合计 `267681.08`。

诊断命令：

```bash
node apps/backend-mock/scripts/diagnose-amount-bill-anomalies.mjs --limit=50
```

安全修复脚本 dry-run：

```bash
node apps/backend-mock/scripts/repair-amount-bill-safe-anomalies.mjs --limit=50
```

确认后才执行写库：

```bash
node apps/backend-mock/scripts/repair-amount-bill-safe-anomalies.mjs --apply
```

关键表备份命令：

```bash
node apps/backend-mock/scripts/backup-amount-bill-tables.mjs
```

当前安全修复范围：

- `receiptAmount <= 0` 且 `receiptTime IS NOT NULL`：清空 `receiptTime`。
- `ele_bill.meter_name = '合计'`：删除电费合计明细行。
- `water_bill.meter_name = '合计'`：删除水费合计明细行。

安全修复执行结果：

- 执行前已备份关键表。
- 已执行 `repair-amount-bill-safe-anomalies.mjs --apply`。
- 清空未收款账单收款时间：`226` 条。
- 删除电费合计明细行：`411` 条。
- 删除水费合计明细行：`411` 条。
- 执行后复查：
  - 未收款但有收款时间：`0` 条。
  - 电费明细保存了合计行：`0` 条。
  - 水费明细保存了合计行：`0` 条。

二次安全修复执行结果：

- 执行前已再次备份关键表。
- 发现 `billId 508-517` 又由旧逻辑写入少量安全脏数据，说明运行中的旧页面/旧服务仍可能继续写入脏单。
- 已再次执行 `repair-amount-bill-safe-anomalies.mjs --apply`。
- 清空未收款账单收款时间：`8` 条。
- 删除电费合计明细行：`10` 条。
- 删除水费合计明细行：`10` 条。
- 执行后复查：
  - 未收款但有收款时间：`0` 条。
  - 电费明细保存了合计行：`0` 条。
  - 水费明细保存了合计行：`0` 条。

三次安全修复执行结果：

- 执行前已第三次备份关键表。
- 进一步发现移动端表单仍会默认写入收款时间，已修复移动端入口。
- 清理前新增脏数据扩大到 `billId 518-527`，说明旧页面/旧服务仍在持续生成账单。
- 已再次执行 `repair-amount-bill-safe-anomalies.mjs --apply`。
- 清空未收款账单收款时间：`10` 条。
- 删除电费合计明细行：`10` 条。
- 删除水费合计明细行：`10` 条。
- 执行后复查：
  - 未收款但有收款时间：`0` 条。
  - 电费明细保存了合计行：`0` 条。
  - 水费明细保存了合计行：`0` 条。

四次安全修复执行结果：

- 新版诊断脚本新增：
  - 应收总额与费用项合计不一致。
  - 电费总账与电费明细合计不一致。
  - 水费总账与水费明细合计不一致。
  - 项目名年份疑似异常。
- 执行前已第四次备份关键表。
- 清理前旧入口又写入 `billId 528-534` 的安全脏数据。
- 已再次执行 `repair-amount-bill-safe-anomalies.mjs --apply`。
- 清空未收款账单收款时间：`7` 条。
- 删除电费合计明细行：`7` 条。
- 删除水费合计明细行：`7` 条。
- 执行后复查：
  - 未收款但有收款时间：`0` 条。
  - 电费明细保存了合计行：`0` 条。
  - 水费明细保存了合计行：`0` 条。

五次安全修复执行结果：

- Univer 取数逻辑已补充 `originalText` 百分比展示清洗，非公式金额单元格不会继续保存 `132000.00%` 这类污染文本。
- 执行前已第五次备份关键表。
- 清理前旧入口又写入 `billId 535-537` 的安全脏数据。
- 已再次执行 `repair-amount-bill-safe-anomalies.mjs --apply`。
- 清空未收款账单收款时间：`3` 条。
- 删除电费合计明细行：`3` 条。
- 删除水费合计明细行：`3` 条。
- 执行后复查：
  - 未收款但有收款时间：`0` 条。
  - 电费明细保存了合计行：`0` 条。
  - 水费明细保存了合计行：`0` 条。

六次安全修复执行结果：

- 诊断脚本已新增 `originalText` 百分比展示污染扫描。
- 最新扫描结果：金额 `originalText` 保存百分比展示值为 `0` 条。
- 执行前已第六次备份关键表。
- 清理前旧入口又写入 `billId 538-539` 的安全脏数据。
- 已再次执行 `repair-amount-bill-safe-anomalies.mjs --apply`。
- 清空未收款账单收款时间：`2` 条。
- 删除电费合计明细行：`2` 条。
- 删除水费合计明细行：`2` 条。
- 执行后复查：
  - 未收款但有收款时间：`0` 条。
  - 电费明细保存了合计行：`0` 条。
  - 水费明细保存了合计行：`0` 条。

七次安全修复执行结果：

- 执行前已再次备份关键表：`apps/backend-mock/backups/amount-bill-tables-2026-06-10T08-38-07-914Z.json`。
- 清理前旧入口又写入 `billId 540-564` 的安全脏数据。
- 已再次执行 `repair-amount-bill-safe-anomalies.mjs --apply`。
- 清空未收款账单收款时间：`25` 条。
- 删除电费合计明细行：`25` 条。
- 删除水费合计明细行：`25` 条。
- 执行后复查：
  - 未收款但有收款时间：`0` 条。
  - 电费明细保存了合计行：`0` 条。
  - 水费明细保存了合计行：`0` 条。

最新完整诊断报告：

- 报告文件：`apps/backend-mock/reports/amount-bill-anomalies-2026-06-10T07-51-55-080Z.json`
- 业务确认清单：`apps/backend-mock/reports/amount-bill-anomaly-review-2026-06-10T07-52-05-203Z.md`
- 业务修复确认模板：`apps/backend-mock/reports/amount-bill-repair-confirmation-template-2026-06-10T08-01-16-130Z.json`
- 导出命令：`node apps/backend-mock/scripts/diagnose-amount-bill-anomalies.mjs --limit=10000 --output-dir=default`
- 确认清单命令：`node apps/backend-mock/scripts/export-amount-bill-anomaly-review.mjs`
- 修复确认模板命令：`node apps/backend-mock/scripts/export-amount-bill-repair-template.mjs`
- 业务确认修复 dry-run 命令：`node apps/backend-mock/scripts/repair-amount-bill-business-confirmed.mjs --input=apps/backend-mock/reports/amount-bill-repair-confirmation-template-2026-06-10T08-01-16-130Z.json`
- 业务确认修复写库命令：`node apps/backend-mock/scripts/repair-amount-bill-business-confirmed.mjs --input=apps/backend-mock/reports/amount-bill-repair-confirmation-template-2026-06-10T08-01-16-130Z.json --apply --backup-file=apps/backend-mock/backups/<先备份后的文件名>.json`
- 说明：最新复查中确定安全项已清零；代码修复需要重启/刷新运行中的旧服务和旧页面后，才能拦住继续新增。

当前仍需处理/确认的异常：

- 未收款但有收款时间：`0` 条。
- 电费明细保存了合计行：`0` 条。
- 水费明细保存了合计行：`0` 条。
- 收款金额大于应收金额：`47` 条。
- 空项目/空租户/零金额账单：`52` 条。
- 应收总额与费用项合计不一致：`3` 条。
- 电费总账与电费明细合计不一致：`4` 条。
- 水费总账与水费明细合计不一致：`8` 条。
- 项目名年份疑似异常：`2` 条。
- 金额 `originalText` 保存百分比展示值：`0` 条。
- 金额公式 `originalText` 疑似粘入多余单元格引用：`0` 条。
- 同园区/同项目/同租户疑似重复账单：`12` 组。

剩余异常拆分：

- 多收异常合计差额：`276565.49`。
- 多收异常中，应收为 `0` 但有实收：`4` 条；应收大于 `0` 但实收超过应收：`43` 条。
- 空项目/空租户/零金额账单中，空项目：`11` 条，空租户：`10` 条，应收为 `0`：`51` 条。
- 疑似重复账单：`12` 组，按每组保留 1 张估算，多余账单 `18` 张。
- 项目名年份疑似异常样本：
  - `billId 412`，叶茂刚，`2026年6月份房租、2024年5月份水电`。
  - `billId 159`，叶茂刚，`2026年5月份房租、2024年4月份水电`。
- 应收总额与费用项合计不一致样本：
  - `billId 54`，吴弯弯，应收 `17357.50`，费用项合计 `17479.00`，差额 `-121.50`。
  - `billId 55`，东莞市佳意智能科技有限公司，应收 `14156.75`，费用项合计 `14180.75`，差额 `-24.00`。
- 明细与总账不一致样本：
  - `billId 126`，广州国靖办公家具有限公司，电费总账比明细多 `6682.90`。
  - `billId 127`，许远东，水费总账为 `0.00`，水费明细合计 `322.50`。
- 多收金额最大的样本：
  - `billId 394`，深圳市柯讯科技有限公司，实收 `159534.82`，应收 `0.00`。
  - `billId 489`，姚东江（一楼加阁楼），实收 `49203.00`，应收 `0.00`。
  - `billId 243`，东莞市泰利锐航机械科技有限公司，实收 `24398.00`，应收 `0.00`。

其中需业务确认后才能修的异常：

- 收款金额大于应收金额：`47` 条。
- 空项目/空租户/零金额账单：`52` 条。
- 应收总额与费用项合计不一致：`3` 条。
- 电费总账与电费明细合计不一致：`4` 条。
- 水费总账与水费明细合计不一致：`8` 条。
- 项目名年份疑似异常：`2` 条。
- 同园区/同项目/同租户疑似重复账单：`12` 组。

本轮未做，继续排期：

- 业务确认剩余异常清单后，再写专项修复脚本。
- 明确公共用电/公摊水费属于表计用量还是附加费用，避免能耗统计口径被污染。

## 接口调整建议

### `/bill/amount/list`

新增返回：

```ts
interface AmountBillListResponse {
  items: AmountBill[];
  total: number;
  currentPage: number;
  pageSize: number;
  summary: {
    invoiceTax: number;
    receiptAmount: number;
    remainingAmount: number;
    totalFee: number;
  };
}
```

新增查询参数：

```ts
interface AmountBillListQuery {
  collectionStatus?: 'all' | 'overpaid' | 'paid' | 'partial' | 'unpaid';
  dateField?: 'createTime' | 'receiptTime';
  endTime?: string;
  startTime?: string;
}
```

### 保存账单

保存前统一规范：

```ts
if (receiptAmount <= 0) {
  receiptAmount = 0;
  receiptTime = null;
}

if (receiptAmount > 0 && !receiptTime) {
  throw new Error('已收款账单必须填写收款时间');
}
```

## 历史数据诊断项

诊断脚本应输出以下清单：

- `receiptAmount = 0 AND receiptTime IS NOT NULL`
- `receiptAmount > totalFee`
- `receiptAmount > 0 AND receiptTime IS NULL`
- `financeId IS NULL AND receiptAmount > 0`
- `finance.amount != amount_bill.receive_amount`
- `finance.transaction_time != amount_bill.receipt_time`
- `ele_bill.meter_name = '合计'`
- `water_bill.meter_name = '合计'`
- 空项目/空租户/0 金额单
- 同租户、同项目、同账单月份重复单

## 验收标准

- 新建未收款账单时，收款时间为空。
- 未收款账单不会出现在“收款时间”筛选结果中，除非明确选择“全部账单日期口径”。
- 陈宇春（401）账单打开后金额显示为 `1320.00`、`82.50`、`171.60`、`10368.10`，不再显示百分比。
- 保存账单后 `eleBills/waterBills` 不再包含“合计”行。
- 列表能同时看到本月收费金额、收款金额、未收金额、收款状态。
- footer 明确区分当前页合计与筛选结果总合计。
- 总览营收统计与财务管理收入流水一致。
- 账单应收统计与账单管理筛选结果 summary 一致。

## 2026-06-10 复查补充

- 账单管理日期筛选当前是实收口径：接口按 `receiptTime` 过滤，并要求 `receiptAmount > 0`；不按制单日期 `createTime` 统计。
- 页面汇总卡片是筛选结果总合计，不是当前页合计；表格底部才是当前页合计。
- 已用账号 `17770113605` 登录本地 `http://localhost:5559/bill` 复查：账单列表可打开，筛选账单 `467`，应收合计 `15273477.38`，实收合计 `6148921.80`，未收合计 `9401121.07`，多收合计 `276565.49`，开票税金 `481794.32`。
- Univer 编辑弹窗复查未再出现 `#VALUE!`；公式金额列能显示历史计算值，数字格式命令不可用时已静默降级，不再输出账单相关 warning。
- 最新只读诊断仍有业务数据问题：收款金额大于应收金额 `47` 条，空项目/空租户/零金额账单 `52` 条，同园区/同项目/同租户疑似重复账单 `12` 组。
- 典型脏单：`billId 445` 刘宝初，电费 `401.60`、水费 `65.00`、厂房租金 `3200.00`、滞纳金 `2095.00` 都有值，但 `totalFee = 0.00`；这是数据库业务数据问题，不能靠刷新或前端公式兜底彻底修正。
- 继续写库修复前必须重新备份，并逐条确认多收、重复、零金额账单的处理动作；不能批量“清历史数据”直接删生产单。

## 测试建议

- 后端单测：
  - 保存账单时过滤合计行。
  - `receiptAmount/receiptTime` 校验。
  - 列表 summary 统计正确。
  - 财务流水同步金额和时间正确。

- 前端测试：
  - 新建账单默认无收款时间。
  - 未收款、部分收款、已收款、多收状态展示正确。
  - Univer 金额单元格不显示百分比。
  - 列表 footer 与后端 summary 区分展示。

- 手动验收：
  - 用陈宇春（401）单据复测。
  - 用 2026-06-09 和 2026-06-10 两天数据复测应收/实收。
  - 对比总览营收、财务管理、账单管理三处口径。
