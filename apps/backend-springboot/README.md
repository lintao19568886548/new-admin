# backend-springboot

Spring Boot 后端重构工程。当前工程用于和 `apps/backend-mock` 并行运行，按 `/api` 协议逐接口迁移，不删除旧 Nitro 后端。

## 当前范围

已落地的基础能力：

- Maven + Spring Boot 4.1.0 基础工程。
- `/api/status`。
- `/api/system/version`。
- `/api/auth/login`。
- `POST /api/auth/code-login`。
- `/api/auth/refresh`。
- `/api/auth/logout`。
- `/api/auth/codes`。
- `POST /api/auth/password`。
- `/api/user/info`。
- `/api/user/feedback`。
- `/api/menu/all`。
- `/api/system/menu/list`。
- `PUT /api/system/menu/{id}`。
- `DELETE /api/system/menu/{id}`。
- `/api/menu/by-parent-role`。
- `/api/system/park/list`。
- `/api/system/park/{id}`。
- `PUT /api/system/park/{id}`。
- `DELETE /api/system/park/{id}`。
- `/api/rental/tenant/select`。
- `/api/rental/salary/tenant-options`。
- `/api/user/list`。
- `POST /api/user`。
- `PUT /api/user/{id}`。
- `DELETE /api/user/{id}`。
- `POST /api/user/cancel`。
- `/api/park/list`。
- `POST /api/park`。
- `/api/system/menu/name-exists`。
- `/api/system/menu/path-exists`。
- `POST /api/system/menu`。
- `/api/system/key`。
- `/api/system/dept/list`。
- `POST /api/system/dept`。
- `PUT /api/system/dept/{id}`。
- `DELETE /api/system/dept/{id}`。
- `/api/system/role/list`。
- `/api/system/role/{id}`。
- `PUT /api/system/role/{id}`。
- `DELETE /api/system/role/{id}`。
- `POST /api/system/role/{id}/add-permissions`。
- `POST /api/system/role/{id}/remove-permissions`。
- `POST /api/system/role/code`。
- `DELETE /api/system/role/code`。
- `/api/system/feedback/list`。
- `/api/system/menu-template-sync/jobs`。
- `/api/system/menu-template-sync/jobs/{id}`。
- `POST /api/system/menu-template-sync/dry-run`。
- `POST /api/system/menu-template-sync/execute`。
- `/api/factory/list`。
- `/api/factory/available-list`。
- `/api/factory/{id}`。
- `POST /api/factory`。
- `DELETE /api/factory/{id}`。
- `/api/factory/list-by-park`。
- `/api/rental/park/list`。
- `POST /api/dormitory`。
- `PUT /api/dormitory/{id}`。
- `DELETE /api/dormitory/{id}`。
- `/api/access/visitor/list`。
- `POST /api/access/visitor`。
- `POST /api/access/visitor/register`。
- `/api/access/visitor/{id}`。
- `PUT /api/access/visitor/{id}`。
- `DELETE /api/access/visitor/{id}`。
- `/api/access/car/list`。
- `POST /api/access/car`。
- `/api/access/car/{id}`。
- `PUT /api/access/car/{id}`。
- `DELETE /api/access/car/{id}`。
- `/api/access/door/list`。
- `POST /api/access/door`。
- `PUT /api/access/door/{id}`。
- `DELETE /api/access/door/{id}`。
- `/api/access/brand/list`。
- `/api/access/brand/options`。
- `/api/access/brand/{id}`。
- `POST /api/access/brand`。
- `PUT /api/access/brand/{id}`。
- `DELETE /api/access/brand/{id}`。
- `/api/smart-meter/brand/list`。
- `/api/smart-meter/brand/options`。
- `/api/smart-meter/brand/{id}`。
- `POST /api/smart-meter/brand`。
- `PUT /api/smart-meter/brand/{id}`。
- `DELETE /api/smart-meter/brand/{id}`。
- `/api/maintenance/repair-order/list`。
- `/api/maintenance/repair-order/{id}`。
- `POST /api/maintenance/repair-order`。
- `PUT /api/maintenance/repair-order/{id}`。
- `DELETE /api/maintenance/repair-order/{id}`。
- `/api/agent/skills`。
- `/api/agent/tasks`。
- `/api/agent/tasks/{id}`。
- `/api/maintenance/elevator/list`。
- `/api/maintenance/elevator/{id}`。
- `POST /api/maintenance/elevator`。
- `PUT /api/maintenance/elevator/{id}`。
- `DELETE /api/maintenance/elevator/{id}`。
- `/api/maintenance/firefighting/list`。
- `/api/maintenance/firefighting/{id}`。
- `POST /api/maintenance/firefighting`。
- `PUT /api/maintenance/firefighting/{id}`。
- `DELETE /api/maintenance/firefighting/{id}`。
- `/api/maintenance/transformer/list`。
- `/api/maintenance/transformer/{id}`。
- `POST /api/maintenance/transformer`。
- `PUT /api/maintenance/transformer/{id}`。
- `DELETE /api/maintenance/transformer/{id}`。
- `/api/maintenance/hygieneCheck/list`。
- `/api/maintenance/hygieneCheck/{id}`。
- `POST /api/maintenance/hygieneCheck`。
- `PUT /api/maintenance/hygieneCheck/{id}`。
- `DELETE /api/maintenance/hygieneCheck/{id}`。
- `/api/maintenance/factoryMaint/list`。
- `/api/maintenance/factoryMaint/{id}`。
- `POST /api/maintenance/factoryMaint`。
- `PUT /api/maintenance/factoryMaint/{id}`。
- `DELETE /api/maintenance/factoryMaint/{id}`。
- `/api/finance/list`。
- `/api/finance/{id}`。
- `POST /api/finance`。
- `DELETE /api/finance/{id}`。
- `/api/finance/bill-name-options`。
- `/api/rental/manage/list`。
- `/api/rental/manage/{id}`。
- `POST /api/rental/manage`。
- `PUT /api/rental/manage/{id}`。
- `DELETE /api/rental/manage/{id}`。
- `/api/rental/tenant/list`。
- `/api/rental/tenant/{id}`。
- `POST /api/rental/tenant`。
- `PUT /api/rental/tenant/{id}`。
- `DELETE /api/rental/tenant/{id}`。
- `/api/rental/salary/list`。
- `/api/rental/salary/{id}`。
- `POST /api/rental/salary`。
- `PUT /api/rental/salary/{id}`。
- `DELETE /api/rental/salary/{id}`。
- `/api/bill/amount/list`。
- `/api/bill/amount/{id}`。
- `DELETE /api/bill/amount/{id}`。
- `/api/bill/amount/project-options`。
- `POST /api/bill/amount/export`。
- `POST /api/bill/amount/collection-sms/preview`。
- `/api/reimbursement/list`。
- `/api/reimbursement/{id}`。
- `POST /api/reimbursement`。
- `/api/reimbursement/pending-count`。
- `/api/reimbursement/summary`。
- `/api/reimbursement/analysis`。
- `/api/park/visitor-list`。
- `/api/localization/list`。
- `/api/localization/{id}`。
- `POST /api/localization`。
- `PUT /api/localization/{id}`。
- `DELETE /api/localization/{id}`。
- `/api/dashboard/workspace/list`。
- `/api/table/list`。
- `/api/hezhong/waterinfo/data`。
- `/api/hezhong/waterinfo/tree`。
- `/api/hezhong/meterinfo/data`。
- `/api/hezhong/meterinfo/tree`。
- `/api/ymsino/waterinfo/data`。
- `/api/ymsino/waterinfo/tree`。
- `/api/ymsino/meterinfo/data`。
- `/api/ymsino/meterinfo/tree`。
- `/api/park/dashboard-stats`。
- `/api/dashboard/factory-rental-stats`。
- `/api/dashboard/contract-stats`。
- `/api/dashboard/customer-overview-stats`。
- `/api/dashboard/energy-electricity-consumption`。
- `/api/dashboard/energy-water-consumption`。
- `/api/dashboard/meter-statistics`。
- `/api/dashboard/revenue-stats`。
- `/api/hrm/employee/list`。
- `/api/hrm/employee/{id}`。
- `DELETE /api/hrm/employee/{id}`。
- `/api/hrm/employee/accounts`。
- `/api/hrm/attendance/config`。
- `/api/hrm/attendance/locations`。
- `/api/hrm/attendance/list`。
- `/api/hrm/attendance/device`。
- `/api/hrm/attendance/today`。
- `/api/hrm/attendance/stats`。
- `/api/hrm/leaveapplication/list`。
- `/api/hrm/leaveapplication/parks`。
- `POST /api/hrm/leaveapplication`。
- `PUT /api/hrm/leaveapplication/{id}`。
- `DELETE /api/hrm/leaveapplication/{id}`。
- `/api/hrm/trajectory/list`。
- `/api/hrm/trajectory/export`。
- `/api/crm/config/status`。
- `/api/crm/overview`。
- `/api/crm/binding/list`。
- `POST /api/crm/binding/status`。
- `/api/crm/external-contact/list`。
- `/api/crm/sales/channel/list`。
- `POST /api/crm/sales/channel`。
- `POST /api/crm/sales/channel/update`。
- `/api/crm/scan-log/list`。
- `/api/organization/invitation/list`。
- `POST /api/organization/create`。
- `POST /api/organization/invitation/create`。
- `POST /api/organization/invitation/join`。
- `POST /api/organization/invitation/revoke`。
- `/api/organization/provisioning/status`。
- `/api/organization/provisioning/failed-manual`。
- `POST /api/organization/provisioning/requeue-failed-manual`。
- `/api/image/upload`。
- `/api/notices/list`。
- `/api/rental/tenant/{id}/sms-info`。
- `/api/rental/park/{id}`。
- `/api/analytics/contract-overview`。
- `/api/analytics/park-dashboard-stats`。
- `/api/analytics/revenue-overview`。
- `/api/wechat/pay/app/config`。
- `POST /api/wechat/pay/app/prepay`。
- `/api/wechat/js-sdk-config`。
- `/api/wechat/pay/refund/orders`。
- `POST /api/wechat/pay/notify`。
- `POST /api/wechat/pay/refund`。
- `POST /api/wechat/pay/refund-notify`。
- `/api/wework/callback`。
- `POST /api/wework/callback`。
- `/api/test`。
- `POST /api/test`。
- `/api/investment/list`。
- `/api/investment/park-list`。
- `/api/investment/{id}`。
- `POST /api/investment`。
- `PUT /api/investment`。
- `PUT /api/investment/{id}`。
- `DELETE /api/investment/{id}`。
- `/api/investment/radar/score-rule/list`。
- `PUT /api/investment/radar/score-rule/{id}`。
- `/api/investment/radar/crawler-source/list`。
- `PUT /api/investment/radar/crawler-source/{id}`。
- `POST /api/investment/radar/crawler-source/{id}/enable`。
- `POST /api/investment/radar/crawler-source/{id}/disable`。
- `/api/investment/radar/sales-user/list`。
- `/api/investment/radar/crawler-task/list`。
- `/api/investment/radar/signal-event/list`。
- `/api/investment/radar/external-lead/list`。
- `/api/investment/radar/enterprise-profile/list`。
- `/api/investment/radar/crawler-task/{id}`。
- `/api/investment/radar/crawler-task/{id}/log`。
- `/api/investment/radar/crawler-task/{id}/item`。
- `POST /api/investment/radar/crawler-task/{id}/cancel`。
- `POST /api/investment/radar/collect/task`。
- `/api/investment/radar/collect/task/{taskId}`。
- `POST /api/investment/radar/crawler-task/scheduler/start`。
- `POST /api/investment/radar/crawler-task/scheduler/stop`。
- `POST /api/investment/radar/crawler-task/run-public-opportunity`。
- `POST /api/investment/radar/crawler-task/run-public-opportunity-batch`。
- `POST /api/investment/radar/crawler-task/run`。
- `POST /api/investment/radar/crawler-task/run-eia`。
- `POST /api/investment/radar/crawler-task/run-internal-contract-expiry`。
- `POST /api/investment/radar/crawler-task/run-recruitment`。
- `POST /api/investment/radar/crawler-task/run-tender`。
- `POST /api/investment/radar/crawler-task/sync-internal-contract-expiry`。
- `/api/investment/radar/signal-event/{id}`。
- `PUT /api/investment/radar/signal-event/{id}`。
- `POST /api/investment/radar/signal-event/{id}/convert`。
- `/api/investment/radar/signal-event/{id}/evidence`。
- `POST /api/investment/radar/signal-event/refresh`。
- `/api/investment/radar/external-lead/{id}`。
- `PUT /api/investment/radar/external-lead/{id}`。
- `POST /api/investment/radar/external-lead/{id}/convert`。
- `/api/investment/radar/external-lead/{id}/evidence`。
- `/api/investment/radar/enterprise-profile/{id}`。
- `/api/investment/radar/enterprise-profile/{id}/signals`。
- `/api/investment/radar/enterprise-profile/{id}/tags`。
- `POST /api/investment/radar/enterprise-profile/refresh`。
- `/api/investment/radar/public-opportunity/effective-list`。
- `/api/investment/radar/public-opportunity/effective-options`。
- `/api/investment/radar/public-opportunity/effective-stats`。
- `/api/investment/radar/public-opportunity/effective-progress`。
- `/api/investment/radar/public-opportunity/audit-summary`。
- `/api/investment/radar/public-opportunity/audit-preview`。
- `/api/investment/radar/public-opportunity/{id}`。
- `/api/investment/radar/outreach-template/list`。
- `/api/investment/radar/outreach-template/stats`。
- `/api/investment/radar/outreach-template/{id}/versions`。
- `/api/investment/radar/outreach-template/preview`。
- `POST /api/investment/radar/outreach-template/{id}/enable`。
- `POST /api/investment/radar/outreach-template/{id}/disable`。
- `/api/investment/radar/outreach-task/list`。
- `POST /api/investment/radar/outreach-task`。
- `/api/investment/radar/outreach-task/{id}`。
- `POST /api/investment/radar/outreach-task/{id}/reply`。
- `/api/investment/radar/analysis/summary`。
- `/api/investment/radar/analytics/acquisition`。
- `/api/investment/radar/analytics/channel`。
- `/api/investment/radar/analytics/template`。
- `/api/investment/radar/analytics/sales`。
- `POST /api/investment/radar/pipeline/rebuild`。
- `POST /api/investment/radar/lead/import`。
- `POST /api/investment/radar/lead/import-file`。
- `/api/investment/radar/lead/list`。
- `/api/investment/radar/lead/{id}`。
- `/api/investment/radar/lead/{id}/score-breakdown`。
- `POST /api/investment/radar/lead/{id}/recalculate-score`。
- `POST /api/investment/radar/lead/recalculate-scores`。
- `/api/investment/radar/lead/{id}/property-match`。
- `POST /api/investment/radar/lead/{id}/rebuild-property-match`。
- `POST /api/investment/radar/lead/rebuild-property-match-batch`。
- `POST /api/investment/radar/lead/{id}/follow`。
- `POST /api/investment/radar/lead/{id}/close`。
- `/api/investment/radar/sop-reminder/list`。
- `/api/investment/radar/lead/{id}/sop`。
- `/api/investment/radar/analytics/sales-funnel`。
- `/api/investment/radar/analytics/roi`。
- `/api/investment/radar/lead/{id}/outreach-suggestion`。
- `/api/investment/radar/contact-restriction/list`。
- `/api/investment/radar/contact-restriction/export`。
- `/api/investment/radar/contact-restriction/audit/list`。
- `POST /api/investment/radar/contact-restriction/{id}/release`。
- `POST /api/investment/radar/contact-restriction/{id}/approve-release`。
- `POST /api/investment/radar/contact-restriction/{id}/reject-release`。
- `PUT /api/investment/radar/property/{id}/tags`。
- `PUT /api/investment/radar/signal-event/{id}`。
- 统一响应结构：`{ code, data, error, message }`。
- 全局异常处理。
- CORS 配置。
- 中心库 `DataSource`。
- 租户库 `TenantDataSourceRegistry` 骨架。
- MyBatis-Plus Boot 4 starter、分页插件和 mapper 扫描。
- JWT 解析和 `TenantContext` 占位。
- Redis 配置入口和第二批高频读取缓存。
- Kafka 配置入口。
- Kafka outbox 基础结构。
- RabbitMQ 通知、轻任务、延迟重试、DLQ 基础拓扑。
- XXL-Job 执行器配置和首批迁移任务骨架。
- 手动 SQL：`src/main/resources/db/manual/001-event-outbox.sql`。

仍需专项联调/真实化的能力：

- 会员/组织开通资料拼接到 `/api/user/info`。
- 微信支付真实预下单、验签解密、权益同步、退款执行和对账；短信供应商直连、企微真实外呼/欢迎语、招商雷达 worker、真实抓取、重建和发送类高风险接口。
- 真实数据库、Redis、Kafka、RabbitMQ、XXL-Job 的联调压测和生产参数校准。

## 环境要求

- JDK 17 或 21。
- Maven 3.9+。
- MySQL/MariaDB。
- Redis。
- Kafka。
- RabbitMQ。
- XXL-Job Admin。

当前机器如果没有 JDK/Maven，无法直接编译运行。安装后在本目录执行：

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

2026-07-07 当前检查：`mvn` 未加入 PATH，仓库内 `apps/backend-springboot` 只有 `pom.xml`，没有 Maven wrapper；但临时目录已有 `codex-maven-3.9.11`，可通过 `$env:TEMP/codex-maven-3.9.11/apache-maven-3.9.11/bin/mvn.cmd` 运行，该 Maven 可识别 `C:\Program Files\Java\jdk-21.0.1`。

当前已用 JDK 21 和 Maven 3.9.11 执行过：

```powershell
& "$env:TEMP/codex-maven-3.9.11/apache-maven-3.9.11/bin/mvn.cmd" -s "$env:TEMP/codex-maven-settings.xml" test
```

结果：`Tests run: 796, Failures: 0, Errors: 0, Skipped: 0`。

当前 Maven Central 对 Surefire provider 出现过 403，本地测试使用临时 Maven settings 指向公共镜像，不把 mirror 配置提交到项目。接口验收仍需要配置真实数据库、Redis、Kafka、RabbitMQ 后启动服务验证。

## 必需环境变量

本地最小启动需要：

```bash
CENTER_DATABASE_URL=mysql://root:password@127.0.0.1:3306/magic_center?serverTimezone=Asia/Shanghai
DATABASE_URL=mysql://root:password@127.0.0.1:3306/magic?serverTimezone=Asia/Shanghai
PUBLIC_DATABASE_URL=mysql://root:password@127.0.0.1:3306/public_magic?serverTimezone=Asia/Shanghai
NOTICES_DATABASE_URL=mysql://root:password@127.0.0.1:3306/magic_notices?serverTimezone=Asia/Shanghai
INVESTMENT_RADAR_CUSTOMER_ID=default
INVESTMENT_RADAR_DB_NAME=
REDIS_URL=redis://localhost:6379
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_VIRTUAL_HOST=/
TP_BASE_URL=https://devhzeb.szhzzd.top
TP_LOGIN_USERNAME=替换为合众平台登录用户名
TP_LOGIN_KEY=替换为合众平台登录密钥
TP_TIMEOUT_MS=15000
```

生产还需要按旧后端补齐：

- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `DEFAULT_CUSTOMER_ID`
- `INVESTMENT_RADAR_CUSTOMER_ID`：招商雷达共享库客户空间，未配置时回落到 `DEFAULT_CUSTOMER_ID/default`
- `INVESTMENT_RADAR_DB_NAME`：招商雷达共享库独立数据库名，只有雷达数据单独分库时才需要
- `KAFKA_OUTBOX_EVENT_WRITE_ENABLED`：业务写接口是否写入 outbox 事件，默认 `false`
- `KAFKA_OUTBOX_DISPATCH_ENABLED`：是否开启 outbox dispatcher 派发 Kafka，默认 `false`
- `KAFKA_CONSUMER_ENABLED`：是否开启 Spring Boot Kafka 消费者，默认 `false`
- `RABBITMQ_CONSUMER_ENABLED`：是否开启 Spring Boot RabbitMQ 消费者，默认 `false`
- `RABBITMQ_NOTIFICATION_ROUTING_CONSUMER_ENABLED`：是否开启共享 notification 队列通用路由 consumer dry-run，默认 `false`；开启后仍会抛错避免 ack
- `RABBITMQ_NOTIFICATION_DISPATCH_ENABLED`：是否允许共享 notification 队列进入通用分发预检，默认 `false`；当前仍只生成 preflight 计划，不调用 handler
- `RABBITMQ_NOTIFICATION_CONSUMER_DELEGATION_ENABLED`：是否允许共享 notification listener 进入专用 consumer 委托灰度前置检查，默认 `false`；当前仍不执行委托
- `RABBITMQ_NOTIFICATION_CONSUMER_DELEGATION_ROUTE_GUARD`：共享 notification 专用 consumer 委托单 route 保护，默认只允许 `organization_provisioning_completed`
- `RABBITMQ_ORGANIZATION_PROVISIONING_NOTIFICATION_CONSUMER_ENABLED`：是否开启组织开通完成 notification 消费和中心库收件人预览，默认 `false`；该队列是共享通知队列，必须单独灰度
- `RABBITMQ_ORGANIZATION_PROVISIONING_PROVIDER_SEND_ENABLED`：是否允许组织开通完成 notification 进入 provider 发送灰度，默认 `false`；当前仍只生成发送前置计划，不调用 provider
- `RABBITMQ_ORGANIZATION_PROVISIONING_PROVIDER_CHANNEL_GUARD`：组织开通完成 notification provider 单渠道灰度 guard，默认 `in_app`；只有匹配该渠道的发送计划会被标记为下一批可执行候选
- `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_ENABLED`：是否允许共享 notification listener 委托结果进入 `in_app` provider 后置 adapter 安全门，默认 `false`；当前只生成安全门，不执行 adapter
- `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_LISTENER_NOOP_ENABLED`：是否允许后置 adapter listener no-op 接入预案显示 ready，默认 `false`；当前 listener 只在 ackable 专用 consumer 结果后生成 no-op dry-run 预案，不调用 validator 或手动执行 service
- `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_VALIDATOR_ENABLED`：是否允许 listener no-op 输入适配器的 validator 调用安全门显示 ready，默认 `false`；当前只生成 `validatorInvocationGatePlan`，不调用 `classify(...)`
- `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_ENABLED`：是否允许 listener no-op 的 classification bridge 安全门显示 ready，默认 `false`；开启后 listener 只会在 consumed 且 bridge gate ready 时调用 `classifyDryRun(...)`，不改变 RabbitMQ ack/nack 行为
- `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_DECISION_DRY_RUN_ENABLED`：是否允许未来 listener 只读调用 bridge return/throw 组合 dry-run 的独立安全门，默认 `false`；当前只让 `bridgeDecisionDryRunInvocationGatePlan` 显示 ready，不执行组合 dry-run，不改变当前 listener return/throw
- `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_DECISION_DRY_RUN_OBSERVATION_LOG_ENABLED`：是否允许未来 listener 记录 bridge return/throw 组合 dry-run 输出 observation log 的独立安全门，默认 `false`；当前只让 `decisionOutputObservationLoggingGatePlan` 显示 ready，不执行 observation logging、不写数据库、不改变当前 listener return/throw
- `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_RETURN_THROW_ENABLED`：是否允许未来根据 bridge dry-run 结果切换 listener return/throw 的独立安全门，默认 `false`；当前只让 `bridgeReturnThrowPolicyGatePlan` 显示 ready，不改变当前 listener return/throw，不执行 RabbitMQ ack/nack
- `RABBITMQ_NOTIFICATION_PUBLISH_ENABLED`：是否允许组织开通完成 followup 投递 RabbitMQ notification 队列，默认 `false`；关闭时只生成计划，开启后也不执行短信/企微/站内通知 provider
- `REDIS_ORGANIZATION_PROVISIONING_REFRESH_ENABLED`：是否允许组织开通完成 followup 清理限定 Redis 缓存前缀，默认 `false`
- `TP_YMSINO_BASE_URL`、`TP_YMSINO_USERNAME`、`TP_YMSINO_PASSWORD`、`TP_YMSINO_ORG_ID`、`TP_YMSINO_PT_ID`：亿玛表计平台只读接口配置
- `TP_YMSINO_ELECTRIC_TJ_TYPE`、`TP_YMSINO_WATER_TJ_TYPE`：亿玛电表/水表类型映射，默认 `0/1`
- `XXL_JOB_ENABLED`
- `XXL_JOB_ADMIN_ADDRESSES`
- `XXL_JOB_ACCESS_TOKEN`
- `XXL_JOB_EXECUTOR_APPNAME`
- 微信支付、短信、企微、LLM、招商雷达等第三方配置

## 手动建表

当前项目数据库变更不自动 migrate。Kafka outbox 和消费幂等日志表需要用户确认后手动执行：

```sql
-- src/main/resources/db/manual/001-event-outbox.sql
```

`event_consume_log.status` 当前使用 `processing/success/failed` 三种状态：`processing` 表示消费者已认领但后续任务未完成，`success` 表示 Kafka completed 消费已投递 RabbitMQ followup 或 RabbitMQ followup 已确认消费并生成通知/Redis 刷新计划，`failed` 表示可由上游消息重试重新认领。

## 本地验证

启动后验证：

```bash
curl http://localhost:8080/api/status?status=200
curl http://localhost:8080/api/system/version
curl http://localhost:8080/api/internal/health/infrastructure
```

`/api/internal/health/infrastructure` 会返回 Redis、Kafka、RabbitMQ 三项状态。本地开发 profile 可把 `KAFKA_REQUIRED=false`、`RABBITMQ_REQUIRED=false`、`XXL_JOB_ENABLED=false` 作为降级策略；生产 profile 默认 RabbitMQ 和 Kafka 都是必需基础设施。

`/api/system/version` 会访问中心库 `app_versions` 表。如果表为空，会插入默认版本。该接口已作为 MyBatis-Plus 样板改造，响应结构不变。

登录接口示例：

```bash
curl -i -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"123456\"}"
```

`/api/auth/refresh` 与旧后端保持一致：成功时直接返回新的 accessToken 字符串，不包 `{ code, data }`。

第二批接口说明：

- `/api/user/info`：从当前 token 定位租户用户，重新查询租户库用户、角色、权限码和园区，返回旧前端字段。
- `/api/auth/codes`：查询当前用户角色权限码，Redis 缓存 key 带租户和 tokenVersion。
- `/api/menu/all`：按当前角色查询可访问路由菜单，输出前端路由树。
- `/api/system/menu/list`：返回系统菜单树，保留 `menuId`、`pid`、模板字段，供系统菜单页编辑。
- `/api/menu/by-parent-role`：按父角色菜单范围返回权限树。

第三批接口说明：

- `/api/system/park/list`：园区分页列表，支持 `parkName`、`address`、`area` 筛选。
- `/api/system/park/{id}`：园区详情，包含图片、厂房、楼层、宿舍结构。
- `/api/rental/tenant/select`：租户下拉，默认按当前用户园区范围过滤；`scope=all` 返回全部未删除租户。
- `/api/rental/salary/tenant-options`：工资合同人选项，只返回合同期内租户，支持 `keyword`。
- `/api/user/list`：系统用户分页列表，拼接租户库角色/园区和中心库用户映射。

第四批接口说明：

- `/api/park/list`：当前用户可访问园区列表，复用用户园区范围计算。
- `/api/system/menu/name-exists`、`/api/system/menu/path-exists`：菜单编辑时的唯一性检查。
- `/api/system/key`：中心库系统配置读取；内部密钥拒绝返回。当前 `value` 返回数据库原值字符串，JSON 反序列化后续统一处理。
- `/api/system/dept/list`：旧后端本身是 faker mock，当前返回稳定 mock 数据。

第五批接口说明：

- `/api/system/role/list`：系统角色列表，支持树形和分页返回；当前先覆盖系统角色作用域。
- `/api/system/role/{id}`：角色详情，返回权限菜单和园区范围。
- `/api/system/feedback/list`：反馈分页列表，拼接图片信息。
- `/api/system/menu-template-sync/jobs`、`/api/system/menu-template-sync/jobs/{id}`：中心库菜单模板同步任务只读查询；summary/details 暂按数据库原始 JSON 字符串返回。
- `POST /api/system/menu-template-sync/dry-run`：只生成菜单模板同步计划，不创建 job、不写租户菜单。
- `POST /api/system/menu-template-sync/execute`：兼容旧执行入口，只在中心库登记 `accepted` 审计 job/log；真实跨租户菜单写入留给 `menuTemplateSyncJob` 专项执行。

第六批接口说明：

- `/api/factory/list`：当前用户可见厂房分页列表，按授权园区过滤，兼容 `isOwn`、`parkId`、`factoryName`、`address`。
- `/api/factory/available-list`：公开待租厂房分页列表，未登录读默认租户库，已登录读当前租户库；先在 SQL 聚合楼层面积后过滤可租面积。
- `/api/factory/{id}`：公开厂房详情，返回楼层、面积统计、主图和图片列表，字段保持旧接口兼容。
- `/api/factory/list-by-park`：维护模块级联下拉，按当前用户授权园区返回“园区-厂房”树。
- `/api/rental/park/list`：租赁端园区卡片分页列表，按当前用户授权园区过滤，返回主图和厂房/宿舍数量。

第七批接口说明：

- `/api/access/visitor/list`：访客分页列表，支持 `parkId/currentPark`、姓名、手机号、车牌、状态、登记时间范围筛选。
- `/api/access/visitor/{id}`：访客详情，按当前用户授权园区校验。
- `/api/access/car/list`：车辆出入分页列表，支持 `currentPark`、车牌、状态、登记时间范围筛选。
- `/api/access/car/{id}`：车辆详情，按当前用户授权园区校验。
- `/api/access/door/list`：门禁设备分页列表，支持园区、设备编码、设备名称、位置、状态筛选。
- 访客/车辆删除和更新、门禁设备启停状态在第三十五批迁移；其他门禁高风险写接口仍保留在旧 Nitro 后端。

第八批接口说明：

- `/api/maintenance/elevator/list`：升降机分页列表，支持 `currentPark/parkId`、厂房、电梯名称、状态、承重、尺寸、检查人、生产日期、检查时间范围筛选；兼容前端当前使用的 `limit` 和旧接口 `pageSize`。
- `/api/maintenance/elevator/{id}`：升降机详情，新增当前用户授权园区校验。
- `/api/maintenance/firefighting/list`：消防设施分页列表，支持园区、厂房、名称、地址、灭火器、消防栓、安全通道、检查人、检查时间范围筛选。
- `/api/maintenance/firefighting/{id}`：消防设施详情，新增当前用户授权园区校验。
- `/api/maintenance/transformer/list`：变压器分页列表，支持园区、厂房、名称、地址、检查人、状态、规格、检查时间范围筛选。
- 升降机更新/删除、消防设施更新/删除和变压器更新已在第三十六批迁移；变压器删除、卫生检查更新/删除、厂房维护更新/删除已在第三十七批迁移。
- `magic.sql` 快照和 Prisma schema 存在字段漂移：`transformer.checker`、`firefighting.img_url`、`elevator` 表结构按线上 schema 做兼容检测；字段不存在时跳过对应筛选或返回空页，避免灰度环境直接 500。

第九批接口说明：

- `/api/maintenance/transformer/{id}`：变压器详情，新增当前用户授权园区校验。
- `/api/maintenance/hygieneCheck/list`：卫生检查分页列表，支持园区、厂房、检查项目、检查人、检查结果、检查日期范围筛选。
- `/api/maintenance/hygieneCheck/{id}`：卫生检查详情，新增当前用户授权园区校验。
- `/api/maintenance/factoryMaint/list`：厂房维护分页列表，支持园区、厂房、维护项目、维护状态、负责人、维护时段筛选。
- `/api/maintenance/factoryMaint/{id}`：厂房维护详情，新增当前用户授权园区校验。
- 卫生检查、厂房维护和变压器删除低副作用主表写接口已在第三十七批迁移；图片关系、外部硬件同步等副作用仍不在本阶段处理。
- `factory_maintenance`、`hygiene_check` 表同样通过 `information_schema.columns` 做存在性检测；灰度库缺表时列表返回空页，详情返回旧接口风格的业务错误。

第十批接口说明：

- `/api/finance/list`：财务分页列表，支持账单名称、账单类别、交易类型、金额、交易时间、状态和园区筛选，按当前用户授权园区过滤。
- `/api/finance/{id}`：财务详情，按授权园区校验，兼容图片列表。
- `POST /api/finance`：第六十批补齐财务流水新增，只写 `finance` 主表白名单字段；`images` 入参保留兼容但不写 `finance_image`。
- `/api/finance/bill-name-options`：财务账单名称下拉，按账期月份倒序去重，最多返回 100 条。
- `/api/rental/manage/list`：租赁管理厂房分页列表，支持园区、厂房、地址、联系人、面积、可租面积、租金区间筛选。
- `/api/rental/manage/{id}`：租赁管理厂房详情，按当前用户授权园区校验。
- `POST /api/rental/manage`：第五十九批补齐租赁管理厂房新增，只写 `factory` 主表白名单字段；不写楼层、图片或账单联动。
- 本批保持只读边界：`/finance/list` 暂不迁移旧 GET 中 `syncRentalExpenseFinanceRecords` 写入同步副作用，财务同步后续放到账单/财务专项批次或 XXL-Job 补偿任务。

第十一批接口说明：

- `/api/rental/tenant/list`：租户分页列表，支持 `parkId/currentPark`、租户名、手机号、交易类型、合同状态、合同/递增日期、地址和递增率筛选，按当前用户授权园区过滤。
- `/api/rental/tenant/{id}`：租户详情，返回租户图片并补齐详情园区权限校验。
- `PUT /api/rental/tenant/{id}`：第四十四批补齐租户主表更新，只写白名单字段；不重建 `tenant_image`，不触发租户月度支出财务同步。
- `DELETE /api/rental/tenant/{id}`：第四十四批补齐租户删除，租户库事务内删除 `tenant_image`、软删关联工资并物理删除租户，返回删除前快照。
- `/api/rental/salary/list`：工资分页列表，支持园区、租户名、手机号、发放状态、发放日期和金额筛选，返回租户姓名/手机号和工资图片。
- `/api/rental/salary/{id}`：工资详情，返回关联租户信息和图片，并按租户园区校验权限。
- `POST /api/rental/salary`：第六十批补齐工资记录新增，只写 `salary` 主表白名单字段；创建前校验合同人存在且当前用户有其园区权限。
- `/api/bill/amount/project-options`：总账单项目名称自动完成选项，按授权园区过滤，复刻旧接口的项目名称去重和账期月份倒序排序。
- 本批仍不迁移租户新增、工资图片关系、账单写接口，不触发工资同步、账单导出、催缴短信或财务同步副作用。

第十二批接口说明：

- `/api/reimbursement/list`：报销分页列表，支持申请人、部门、收款人、用途、日期、状态、园区筛选；审核人员按授权园区过滤，普通人员只看本人申请。
- `/api/reimbursement/{id}`：报销详情，补齐本人/园区权限校验，兼容旧接口基础字段和图片数组。
- `/api/reimbursement/pending-count`：审核人员授权园区内待处理报销数量；普通人员固定返回 `count=0`。
- `/api/reimbursement/summary`：按状态聚合待审核、已通过、已驳回和总数，使用同列表一致的数据范围。
- `/api/reimbursement/analysis`：报销分析数据，只允许有 `reimbursementAuth` 的审核人员访问，返回园区统计、趋势和汇总。
- 登录 token payload 已补充 `reimbursementAuth`，用于报销接口判断审核权限；第十二批不迁移报销申请、审核、删除，也不触发通过报销后的财务同步副作用。
- `reimbursement` 旧 SQL 快照和 Prisma schema 存在字段漂移，例如 `username/userName`、`is_deleted`、`park_id`、`reimbursement_image`；Spring Boot 查询层通过 `information_schema.columns` 做兼容检测。

第十三批接口说明：

- `/api/park/visitor-list`：访客登记页园区下拉列表，只返回未删除园区的 `parkId/parkName`；旧接口未强制鉴权，Spring Boot 保持有 token 读当前租户库、无 token 读默认租户库。
- `/api/localization/list`：打卡定位分页列表，Super 可按用户名模糊查询全部记录，普通用户只看本人；普通用户传入其他用户名时返回旧接口文案“没有权限查看其他用户打卡记录”。
- `/api/localization/{id}`：打卡定位详情，保持旧接口的 `无效的ID`、`记录不存在` 文案；有 token 读当前租户库，无 token 读默认租户库。
- `/api/dashboard/workspace/list`：工作台访问日志分页列表，高级角色 `Super/董事长/总经理` 可看全局并排除 `vben/空用户名`，普通用户按本人角色及递归子角色人员过滤，并补充 `moduleName/moduleNameCN`。
- `/api/table/list`：前端示例表格分页和排序接口，保留登录要求，但改用固定内存数据替代 faker，保证自动化测试结果稳定。
- 本批仍保持只读边界，当时不迁移定位打卡创建/编辑/删除，不迁移工作台日志写入或 API 日志异步化；`localization` 和 `api_log/menu/menu_meta` 继续通过旧 schema 字段映射查询。第三十四批已补定位更新/删除。

第十四批接口说明：

- `/api/hezhong/waterinfo/data`、`/api/hezhong/meterinfo/data`：合众平台水表/电表冻结抄表数据读取接口，保留默认 `projCode=241`、`type=2`、近 7 天时间范围和多 `comAddress` 跨设备分页拼接逻辑。
- `/api/hezhong/waterinfo/tree`、`/api/hezhong/meterinfo/tree`：合众平台水表/电表设备树接口，保留按 `address/piplineName` 过滤和旧设备路径解析逻辑。
- `/api/park/dashboard-stats`：园区租赁统计接口，按当前用户授权园区过滤，返回出租率、出租面积、空置面积和楼层数量。
- 合众平台调用已迁移登录签名、token 缓存、401/403 刷新重试；真实联调需要配置 `TP_BASE_URL`、`TP_LOGIN_USERNAME`、`TP_LOGIN_KEY`。
- 本批当时不迁移合众阀控、单表实时读取、读表结果回调，也暂未迁移 `/dashboard/meter-statistics`、能源水电耗看板等更复杂统计接口；第十五批已补水电耗看板，第六十八批已补表计本地统计版。

第十五批接口说明：

- `/api/dashboard/factory-rental-stats`：厂房租赁统计接口，按当前用户授权园区过滤，支持 `parkId=all`、指定园区和日期截止口径，返回总面积、已租面积、空置面积、出租率和异常楼层计数。
- `/api/dashboard/contract-stats`：合同统计接口，按授权园区读取 `rental_tenant` 合同开始/结束日期，返回到期、新增、正常、退租汇总和按月趋势。
- `/api/dashboard/customer-overview-stats`：招商客户总览接口，按授权园区读取 `investment`，返回意向等级分布、谈判进度分布和客户数量汇总。
- `/api/dashboard/energy-electricity-consumption`：电耗看板接口，按总账单创建时间倒推数据月份，优先解析 `amount_bill.ele_item` JSON，缺失时回退 `ele_bill` 明细。
- `/api/dashboard/energy-water-consumption`：水耗看板接口，按总账单创建时间倒推数据月份，优先解析 `amount_bill.water_item` JSON，缺失时回退 `water_bill` 明细。
- 本批保持只读边界，当时未迁移 `/dashboard/revenue-stats`；第三十三批已补只读统计版，但财务同步写库逻辑仍不放在 GET 中执行。看板统计查询层通过 `information_schema.columns` 兼容灰度库缺表/缺字段场景。

第十六批接口说明：

- `/api/hrm/employee/list`：员工分页列表，支持姓名、电话、部门、身份证、性别、学历、是否删除、是否离职、入职日期范围筛选，并补充绑定账号摘要字段。
- `/api/hrm/employee/{id}`：员工详情，保持旧接口 `employeeId错误`、`员工不存在` 文案，并补充绑定账号摘要字段。
- `/api/hrm/employee/accounts`：员工可绑定账号选项，排除已被其他员工绑定的账号，并补回当前员工已绑定账号。
- `/api/hrm/attendance/config`：当前登录用户考勤时间配置，优先读取绑定员工 `check_in/check_out`，没有绑定员工时返回默认 `09:00:00` 到 `18:00:00`。
- `/api/hrm/attendance/locations`：固定办公打卡地点列表，按旧 `attendance-location.ts` 常量迁移。
- 本批保持只读边界，不迁移员工新增/编辑/删除、考勤打卡写入、请假审批和轨迹导出；员工查询层通过 `information_schema.columns` 兼容灰度库缺表/缺字段场景。

第十七批接口说明：

- `/api/hrm/attendance/list`：考勤记录分页列表，Super 可按 `username` 查询全部，普通用户只看本人；返回旧接口兼容的 `attendanceId/id/key/date/punchIn/punchOut/status/workHours/leaveScope/deviceStatus` 等字段。
- `/api/hrm/attendance/today`：今日最新打卡记录，没有记录时返回 `null`；保留今日记录的原始时间戳输出，并补充请假状态和设备异常摘要。
- `/api/hrm/attendance/stats`：当前月份考勤统计，返回 `attendanceDays/lateDays/earlyLeaveDays/overtimeHours/leaveDays`，其中加班时长继续按旧接口暂不计算。
- `/api/hrm/leaveapplication/list`：请假申请分页列表，`Super/董事长/人事部` 可看全部，普通用户只看本人；支持申请人、园区、请假类型筛选，并批量补申请人、园区和审核人名称。
- `/api/hrm/leaveapplication/parks`：请假申请园区下拉，兼容旧文件名 `/api/hrm/leaveapplication/park` 和前端实际调用 `/api/hrm/leaveapplication/parks`。
- `POST /api/hrm/leaveapplication`：第五十九批补齐请假申请新增，申请人、园区和审批人名称按旧接口规则回填关联 ID；不触发审批流、消息通知或考勤重算。
- 本批仍不迁移考勤打卡写入、设备更换/验证码、请假新增/审批/删除和轨迹导出。`attendances`、`leave_application`、`attendance_device_abnormal_log` 继续通过 `information_schema.columns` 兼容 `attendance_id/attendanceId`、`punch_in/punchIn` 等字段漂移。

第十八批接口说明：

- `/api/hrm/trajectory/list`：HR 考勤轨迹分页列表，支持员工姓名、园区、日期范围筛选，返回打卡时间、经纬度、设备异常摘要和工作时长；轨迹导出仍保留在旧 Nitro 后端。
- `/api/crm/config/status`：CRM/企微/小程序配置状态检查，只返回环境变量是否配置，不暴露真实密钥，并按请求来源或 `CRM_INVITE_H5_BASE_URL` 生成回调地址。
- `/api/crm/overview`：CRM 概览统计，读取中心库 `crm_*` 表；非 `Super` 自动限定当前中心用户作为销售，`Super` 可看全量。
- `/api/crm/binding/list`：客户归属绑定分页列表，支持关键字、手机号、openid、unionid、scene、salesUserId 筛选，并补充渠道名和销售姓名。
- `/api/crm/external-contact/list`：企微外部联系人回调日志分页列表，支持绑定、企微用户、外部联系人、状态、变更类型和关键字筛选，并补充客户归属信息。
- 本批保持只读边界，不迁移 CRM 绑定新增/转移/删除、销售渠道创建、二维码生成、企微回调、微信 OAuth 或导出。CRM 表属于中心库，未执行中心库 db push 时返回旧接口风格的“CRM数据表未初始化”错误。

第十九批接口说明：

- `/api/crm/sales/channel/list`：销售获客渠道分页列表，支持 `scene/status/salesUserId` 筛选，非 `Super` 自动限定当前中心用户；返回 `scanCount/bindingCount/externalContactCount` 统计字段。
- `/api/crm/scan-log/list`：CRM 扫码记录分页列表，支持关键字、手机号、openid、unionid、scene、salesUserId 筛选，并补充渠道名、请求销售和最终归属销售姓名。
- `/api/organization/invitation/list`：组织邀请码列表，只允许 `Super` 查看，读取中心库 `tenant_invitation` 并保留旧接口最多 100 条的边界。
- `/api/organization/provisioning/status`：当前账号组织空间开通状态，保留旧个人中心字段；当前 Spring Boot 先迁移登录态分支，支付结算 flow token 分支后续随支付闭环迁移。
- `/api/organization/provisioning/failed-manual`：平台 `Super` 查询 `failed_manual` 开通任务，补充组织、发起人和最近支付摘要。
- 本批保持只读边界，不迁移 `/crm/sales/contact-way`，因为旧实现会调用企业微信并写入 `crm_wework_contact_way`；也不迁移组织开通执行、重排任务、邀请创建/加入/撤销等写接口。

第二十批接口说明：

- `/api/notices/list`：公告分页列表，读取独立公告库 `NOTICES_DATABASE_URL`，支持 `keyword/regionCode/validOnly`；未配置公告库或公告库异常时返回空页，避免影响主业务启动。
- `/api/rental/tenant/{id}/sms-info`：租户短信发送前置查询，只返回 `tenantName/phoneNumber/increaseDate/contractEndDate`，日期保持旧接口 `yyyy-MM-dd` 或空字符串。
- `/api/rental/park/{id}`：旧租赁园区详情路径，保持无 token 时读默认租户库的兼容策略，并补齐园区、厂房、楼层、宿舍的 `imgUrl/imageUrls` 字段。
- `/api/analytics/contract-overview`：旧 analytics 合同总览路径，按授权园区统计成交租户合同，使用 90 天到期阈值和近 12 个月趋势，不混用 `/dashboard/contract-stats` 的 1 个月口径。
- `/api/analytics/park-dashboard-stats`：旧 analytics 园区统计路径，复用 `/park/dashboard-stats` 只读统计。
- 本批保持只读边界，当时未迁移 `/api/analytics/revenue-overview`，因为旧 GET 内部会触发 `syncRentalExpenseFinanceRecords` 写入同步副作用；第三十三批已补只读统计版，但财务同步写库逻辑仍应放到账单/财务专项或 XXL-Job 补偿任务。

第二十一批接口说明：

- `/api/investment/list`：招商项目分页列表，读取招商雷达共享库，支持园区、代理人、租户、意向等级、意向面积、进展和会谈时间筛选，并补齐旧接口的 `parkName/imageUrlList`。
- `/api/investment/park-list`：招商项目园区下拉，读取共享雷达库未删除园区。
- `/api/investment/{id}`：招商项目详情，保持旧 Prisma `findUnique` 的核心字段返回，不额外 include 图片和园区对象。
- `POST /api/investment`：第五十九批补齐招商项目新增，走招商雷达共享库；不处理图片关系、跟进记录或雷达线索联动。
- `/api/investment/radar/score-rule/list`：招商雷达评分规则列表，返回 `items/total`，解析 `keywordJson` 为数组。
- `/api/investment/radar/crawler-source/list`：招商雷达采集源列表，返回 `items/total`，过滤 `DEMO` 和已退休公开源，并补齐 `adapterStatus`、JSON 策略数组等字段。
- `POST /api/investment/radar/crawler-source/{id}/enable`、`POST /api/investment/radar/crawler-source/{id}/disable`：只写 `crawler_source.enabled` 和更新时间，不启动爬虫、不改调度器。
- 本批按旧 `runWithRadarSharedScope` 读取 `INVESTMENT_RADAR_CUSTOMER_ID/INVESTMENT_RADAR_DB_NAME` 指定的共享库；未配置时回落到默认客户空间。
- 本批保持只读边界：不迁移招商新增/编辑/删除，不迁移雷达评分规则更新、采集源启停/编辑、爬虫任务运行、导入、重建或发送类接口；旧评分规则和采集源列表 GET 中隐含的 seed/catalog 写入副作用也暂不迁移。

第二十二批接口说明：

- `/api/investment/radar/sales-user/list`：招商雷达销售负责人候选列表，支持 `parkId/keyword`，返回负责人名称、园区名称和有效线索数。
- `/api/investment/radar/crawler-task/list`：招商雷达采集任务分页列表，支持 `sourceId/status`，返回采集源名称、任务状态、重试信息、请求配置 JSON 和任务项状态统计。
- `/api/investment/radar/signal-event/list`：招商雷达信号事件分页列表，支持公司、事件类型、关键字、来源和状态筛选，解析 `rawPayloadJson` 为对象。
- `/api/investment/radar/external-lead/list`：招商雷达外部线索分页列表，支持置信等级、需求类型、行业、地区、来源、关键字和状态筛选，解析 `hitKeywords` 为数组。
- `/api/investment/radar/enterprise-profile/list`：招商雷达企业画像分页列表，支持行业、城市和关键字筛选，解析 `industryTags` 为数组。
- 本批继续读取招商雷达共享库，并通过 `information_schema.columns` 兼容缺表/缺字段场景；缺表时列表返回空页。
- 本批保持只读边界：不复刻旧列表 GET 中的采集源 catalog seed、信号事件自动刷新、外部线索 schema repair/ALTER/index 创建、企业画像重建等写库副作用；爬虫运行、导入、重建、发送等写接口仍留在旧 Nitro 后端。

第二十三批接口说明：

- `/api/investment/radar/crawler-task/{id}`：招商雷达采集任务详情，返回任务基础信息、采集源信息、请求配置 JSON 和任务项状态统计。
- `/api/investment/radar/crawler-task/{id}/log`：招商雷达采集任务日志列表，解析 `detailJson` 为对象。
- `/api/investment/radar/crawler-task/{id}/item`：招商雷达采集任务 URL 项分页列表，支持 `sourceId/status/currentPage/pageSize`。
- `POST /api/investment/radar/crawler-task/{id}/cancel`：仅允许取消 `PENDING` 采集任务，写 `crawler_task` 状态和本地 `crawler_task_log`，不执行 worker。
- `/api/investment/radar/signal-event/{id}`：招商雷达信号事件详情，返回事件基础字段并附带 `evidences` 数组。
- `/api/investment/radar/signal-event/{id}/evidence`：招商雷达信号事件证据列表，解析 `matchedKeywords/matchedSentences` 为数组。
- 本批继续保持只读边界：不迁移采集任务取消、重排、运行、信号事件更新/转换/刷新等写接口；旧详情读取中隐含的 catalog/seed 前置动作也不在 Spring Boot GET 中执行。

第二十四批接口说明：

- `/api/investment/radar/external-lead/{id}`：招商雷达外部公开线索详情，返回线索基础字段并附带 `evidences` 数组。
- `/api/investment/radar/external-lead/{id}/evidence`：招商雷达外部公开线索证据列表，解析 `matchedKeywords/matchedSentences` 为数组。
- `/api/investment/radar/enterprise-profile/{id}`：招商雷达企业画像详情，返回画像基础字段和 `industryTags` 数组。
- `/api/investment/radar/enterprise-profile/{id}/signals`：招商雷达企业画像关联信号列表，按公司名查询 `signal_event`。
- `/api/investment/radar/enterprise-profile/{id}/tags`：招商雷达企业画像标签列表，按公司名查询 `enterprise_tag`。
- 本批继续保持只读边界：不复刻旧外部线索 `ensureSeeded` 中的 schema repair/ALTER/索引创建，也不迁移外部线索更新/转换、画像刷新/重建等写接口。

第二十五批接口说明：

- `/api/investment/radar/public-opportunity/effective-list`：招商雷达公开机会有效列表，支持 `scope/city/sourceSite/opportunityType/keyword/publishedAgeLabel/currentPage/pageSize/includeMeta/includeTotal`。
- `/api/investment/radar/public-opportunity/effective-options`：公开机会筛选项，返回来源站点和发布时间标签。
- `/api/investment/radar/public-opportunity/effective-stats`：公开机会统计，返回 `total/strictTotal/scope`。
- `/api/investment/radar/public-opportunity/effective-progress`：公开采集过程进度，按采集源返回最新任务和任务项状态。
- `/api/investment/radar/public-opportunity/{id}`：公开机会详情，解析 `tagsJson/detailJson` 并输出旧前端字段。
- 本批继续保持只读边界：不复刻旧 `ensurePublicOpportunityStorage/ensureCrawlerSourceCatalog` 的建表、补字段、seed 或历史修复副作用；公开机会导入、手工录入、修复、爬虫运行和审计修复仍保留在旧 Nitro 后端或后续 XXL-Job 专项。

第二十六批接口说明：

- `/api/investment/radar/outreach-template/list`：招商雷达触达模板列表，支持审批状态、渠道、启用状态、关键字和任务类型筛选。
- `/api/investment/radar/outreach-template/stats`：触达模板任务统计，缺少任务表时模板统计返回 0。
- `/api/investment/radar/outreach-template/{id}/versions`：触达模板版本列表。
- `POST /api/investment/radar/outreach-template/{id}/enable`、`POST /api/investment/radar/outreach-template/{id}/disable`：只写模板 `enabled` 状态；启用时要求模板已审批通过，不创建触达任务、不发送消息。
- `/api/investment/radar/outreach-task/list`：触达任务分页列表，支持状态、回复状态、渠道、任务类型、线索阶段、优先级和关键字筛选，并返回 summary。
- `/api/investment/radar/outreach-task/{id}`：触达任务详情，返回任务字段和关联线索/企业快照。
- 本批继续保持只读边界：不复刻旧 `ensureOutreachTemplateTable/ensureOutreachTaskTable` 的建表、补字段、默认模板 seed，也不迁移触达任务创建、取消、发送、模拟发送、回复或模板审批/启停写接口。

第二十七批接口说明：

- `/api/investment/radar/analysis/summary`：招商雷达分析总览，聚合线索漏斗、来源、渠道、模板、销售负责人和 SOP 提醒统计。
- `/api/investment/radar/analytics/acquisition`：获客分析，返回公开线索转雷达、信号事件转化、来源转化和信号类型转化数据。
- `/api/investment/radar/analytics/channel`：渠道触达分析，按近 90 天触达任务统计发送率、回复率和正向回复率。
- `/api/investment/radar/analytics/template`：话术模板分析，按近 90 天触达任务统计回复率和正向回复率。
- `/api/investment/radar/analytics/sales`：销售绩效分析，按负责人聚合触达、跟进、到访和成交数据。
- 本批继续保持只读边界：当时未迁移带额外雷达权限检查的 `sales-funnel/roi/template-conversion`，不触发线索重算、画像重建、公开机会同步或触达发送；共享雷达库缺表/缺字段时返回空统计。第二十九批已补 `sales-funnel/roi`，第三十批已补 `template-conversion`。

第二十八批接口说明：

- `/api/investment/radar/lead/list`：招商雷达线索分页列表，支持关键字、优先级、阶段和园区筛选。
- `/api/investment/radar/lead/{id}`：招商雷达线索详情，返回企业、园区、负责人、上一条/下一条导航、触达任务摘要和采集任务快照。
- `/api/investment/radar/lead/{id}/score-breakdown`：线索评分拆解，读取已保存的评分命中明细。
- `/api/investment/radar/sop-reminder/list`：SOP 待办分页列表，支持状态、类型、阶段、优先级和关键字筛选，并返回 summary。
- `/api/investment/radar/lead/{id}/sop`：线索 SOP 明细，返回分配记录、跟进记录、带看记录和提醒列表。
- 本批继续保持只读边界：旧 `sop-reminder/list` GET 会更新逾期状态，旧 `lead/{id}/sop` GET 会同步生成/完成提醒；Spring Boot 本批不写库，只在返回结果中按当前时间计算逾期状态或内存生成提醒建议。

第二十九批接口说明：

- `/api/investment/radar/analytics/sales-funnel`：销售转化漏斗，按线索阶段统计分配、待联系、已联系、已回复、到访和成交数据。
- `/api/investment/radar/analytics/roi`：ROI 分析，按近 90 天触达渠道统计发送任务和成交线索，沿用旧端固定成本估算。
- `/api/investment/radar/lead/{id}/outreach-suggestion`：线索触达建议，组合线索状态、触达限制、未完成任务和已启用模板，返回可触达原因和建议话术。
- `/api/investment/radar/contact-restriction/list`：触达限制名单，支持状态、限制类型、关键字和分页筛选，并返回 summary。
- `/api/investment/radar/contact-restriction/audit/list`：触达限制审计日志，支持 action、restrictionId、keyword 和分页筛选。
- 本批继续保持只读边界：不复刻旧 `ensureContactRestrictionTable/ensureOutreachTemplateTable` 中的建表、补字段、默认模板 seed 或索引创建；不迁移限制导入、导出、解除申请、审批、触达任务创建/发送等写接口。旧端这些接口有额外雷达权限码校验，Spring Boot 当前仍先按登录态只读迁移，待雷达权限横切层迁移后统一补齐权限码拦截。

第三十批接口说明：

- `/api/investment/radar/analytics/template-conversion`：话术模板转化分析，按近 90 天触达任务统计发送、回复、正向回复、到访和成交转化。
- `/api/investment/radar/crawler-task/ops-summary`：公开机会爬虫运维摘要，支持 `sourceId/sourceCode`，返回采集源、最新任务、任务状态、任务项状态、失败项和调度策略。
- `/api/investment/radar/crawler-task/health`：公开机会爬虫健康度汇总，按公开机会采集源统计失败任务、零产出任务、任务项成功率和健康状态。
- `/api/investment/radar/crawler-task/audit/list`：招商雷达操作审计分页列表，支持 action、objectType、result、keyword 和分页筛选。
- `/api/investment/radar/crawler-task/scheduler/status`：公开机会采集调度状态，当前返回 Spring Boot 本地只读状态和旧端兼容字段。
- 本批继续保持只读边界：不复刻旧 `ensureCrawlerSourceCatalog/ensureRadarOperationAuditTable` 的采集源 seed、DDL 或索引创建；不启动爬虫、不重排任务、不刷新公开机会。旧端 `template-conversion/health/audit` 有额外雷达权限码校验，Spring Boot 当前仍按登录态只读迁移，后续随雷达权限横切层统一补齐。调度器真实运行态仍归旧 Nitro 进程或后续 XXL-Job 专项，Spring Boot 状态接口不冒充旧进程内存状态。

第三十一批接口说明：

- `/api/investment/radar/public-opportunity/audit-summary`：公开机会历史数据审计摘要，只读计算缺失城市、发布时间异常等问题统计，不刷新缓存或修复数据。
- `/api/investment/radar/public-opportunity/audit-preview`：公开机会历史数据问题预览，最多返回 50 条问题数据。
- `/api/investment/radar/collect/task/{taskId}`：公开机会采集任务详情，只读取已存在的 `investment_radar_collect_task` 快照。
- `/api/investment/radar/lead/{id}/property-match`：线索房源匹配快照，只读取已保存的 `property_match_result`，不触发匹配重建。
- `/api/investment/radar/contact-restriction/export`：触达限制名单导出，默认返回 JSON rows；`format=csv` 时返回 CSV 文本。
- 本批继续保持只读边界：不复刻旧端 GET 中的建表、补字段、审计刷新、缓存修复或房源匹配重建副作用；旧端相关雷达权限码拦截后续随权限横切层统一补齐。

第三十二批接口说明：

- `/api/bill/amount/list`：总账单分页列表，支持园区、项目名、租户名、收款时间、账期月份和收款状态筛选，并返回 summary。
- `/api/bill/amount/{id}`：总账单详情，附带电费明细、水费明细、租户名和园区管理人快照。
- `/api/hrm/attendance/device`：当前用户某天考勤设备异常日志，只迁移 GET 查询。
- `/api/hrm/trajectory/export`：HR 轨迹导出视角，按园区名称分组返回打卡轨迹数据，不生成文件。
- `/api/wechat/pay/app/config`：微信 APP 支付公开配置，只返回 `appId/mchId`。
- 本批继续保持只读边界：不迁移账单新增/编辑/删除/导出、财务同步、催缴短信；不迁移考勤设备更换和短信验证码 POST；不迁移微信支付下单、查单、退款或回调。

第三十三批接口说明：

- `/api/dashboard/revenue-stats`：营收看板应收/实收统计，按授权园区和项目账期月份统计总账单，不触发财务同步。
- `/api/analytics/revenue-overview`：旧 analytics 营收总览，只统计现有 `finance` 流水的近 12 个月趋势和年度汇总。
- `/api/wechat/pay/refund/orders`：会员退款订单只读列表，保留 `Super` 角色限制，只读取中心库订单/权益/退款/开通任务快照。
- `/api/wework/callback`：企业微信 GET 回调 URL 验证，支持 token 签名校验和可选 AES echostr 解密。
- `/api/test`：保留旧测试路由固定文本，便于代理连通性检查。
- 本批继续保持只读边界：不迁移 `analytics/revenue-overview` 旧端的 `syncRentalExpenseFinanceRecords` 写库同步，不发起微信退款、不查微信退款状态、不处理企业微信 POST 消息，也不迁移支付查单/退款回调。

第三十四批接口说明：

- `POST /api/test`：保留旧 POST 测试路由固定文本，便于验证写请求代理链路。
- `POST /api/user/feedback`：用户个人中心反馈提交，校验反馈类型、内容长度、联系方式和客户端标识；图片只绑定已上传的 `image` 记录，不处理文件上传。
- `POST /api/investment/radar/outreach-template/preview`：招商雷达触达模板预览，纯内存替换 `{companyName}` 等占位符，不查询模板表、不写库、不触发短信/企微发送。
- `PUT /api/localization/{id}`：打卡定位记录更新，只允许 `punchTime/status/longitude/latitude` 字段，继续通过 `information_schema.columns` 兼容 `localization` 表字段漂移。
- `DELETE /api/localization/{id}`：打卡定位记录物理删除，保持旧接口语义。
- 本批开始谨慎迁移低副作用写接口，但仍不迁移支付下单/查单/退款、短信发送、真实企微外呼、组织开通执行、招商雷达爬虫运行、导入、重建、发送、账单导出、催缴短信等高风险接口。真实数据库写入联调需在用户配置中心库/租户库后再做。

第三十五批接口说明：

- `PUT /api/access/visitor/{id}`：更新访客出入记录，白名单限制可写字段，并在更新前后按当前用户授权园区校验。
- `DELETE /api/access/visitor/{id}`：物理删除访客出入记录，保持旧接口语义。
- `PUT /api/access/car/{id}`：更新车辆出入记录，白名单限制可写字段，并按当前用户授权园区校验。
- `DELETE /api/access/car/{id}`：物理删除车辆出入记录，保持旧接口语义。
- `PUT /api/access/door/{id}`：只允许更新门禁设备 `status`，并限制取值为 `0/1`。
- 本批只迁移门禁模块低副作用写接口，不迁移门禁设备删除、外部硬件同步、支付、短信、企微、组织开通、雷达任务运行、导入、重建、发送、导出等高风险接口。

第三十六批接口说明：

- `PUT /api/maintenance/elevator/{id}`：更新升降机主表记录，白名单限制可写字段，按当前用户授权园区校验。
- `DELETE /api/maintenance/elevator/{id}`：物理删除升降机记录，并返回删除前快照，保持旧 Prisma delete 语义。
- `PUT /api/maintenance/firefighting/{id}`：更新消防设施主表记录，不处理图片关系表。
- `DELETE /api/maintenance/firefighting/{id}`：物理删除消防设施记录，并返回删除前快照。
- `PUT /api/maintenance/transformer/{id}`：更新变压器主表记录，不触发外部硬件同步。
- 本批只迁移维保模块低副作用主表写接口；消防/变压器图片关系、卫生检查/厂房维护写接口、变压器删除和其他高风险副作用仍留在后续批次。

第三十七批接口说明：

- `DELETE /api/maintenance/transformer/{id}`：物理删除变压器记录，并返回删除前快照。
- `PUT /api/maintenance/hygieneCheck/{id}`：更新卫生检查主表记录，白名单限制可写字段。
- `DELETE /api/maintenance/hygieneCheck/{id}`：物理删除卫生检查记录，并返回删除前快照。
- `PUT /api/maintenance/factoryMaint/{id}`：更新厂房维护主表记录，白名单限制可写字段。
- `DELETE /api/maintenance/factoryMaint/{id}`：物理删除厂房维护记录，并返回删除前快照。
- 本批补齐维保模块剩余低副作用主表写接口；图片关系、外部硬件同步、批量导入/导出和其他跨模块副作用仍不迁移。

第三十八批接口说明：

- `PUT /api/rental/manage/{id}`：更新租赁管理厂房主表字段，白名单限制 `factoryName/parkId/buildTime/address/contact/description/isOwn`，并按当前用户授权园区校验。
- `DELETE /api/rental/manage/{id}`：物理删除厂房记录，保持旧接口返回 `null` 的成功协议。
- `PUT /api/hrm/leaveapplication/{id}`：更新请假申请主表字段，按旧接口回填申请人、园区和审批人展示字段。
- `DELETE /api/hrm/leaveapplication/{id}`：物理删除请假申请，保持旧接口语义。
- `DELETE /api/access/door/{id}`：物理删除门禁设备，删除前校验设备存在和当前用户园区操作权限。
- 本批继续只迁移低副作用主表写接口；租户账单/工资同步、图片关系、考勤重算、外部硬件同步、支付、短信、企微、组织开通、雷达任务、导入、重建、发送、导出等高风险副作用仍不迁移。

第三十九批接口说明：

- `PUT /api/system/dept/{id}`：旧接口本身是 mock 写接口，Spring Boot 只做登录态校验并返回旧成功协议。
- `DELETE /api/system/dept/{id}`：旧接口本身是 mock 删除接口，不落库，只保持旧成功响应。
- `PUT /api/system/menu/{id}`：更新系统菜单和 `menu_meta` 白名单字段，并同步 `templateManaged/templateInternalOnly` 到 `code` 表。
- `DELETE /api/system/menu/{id}`：删除系统菜单；button 类型且存在 `authCode` 时同步删除对应权限码。
- `/api/wechat/js-sdk-config`：生成微信 JS-SDK 签名配置；缺少 `WECHAT_APP_ID/WECHAT_APP_SECRET` 时返回 `enabled=false`，不触发支付流程。
- 本批保持低副作用边界：部门接口不写库；菜单接口只写菜单、菜单 meta 和权限码模板字段，并清理菜单/权限缓存；微信 JS-SDK 只读取微信票据和本地内存缓存，不迁移支付下单、查单、退款或回调。

第四十批接口说明：

- `PUT /api/system/park/{id}`：更新系统园区主表字段，要求 `parkName/address/area` 有效，暂不处理园区图片、厂房或宿舍关系。
- `DELETE /api/system/park/{id}`：逻辑删除系统园区，只写 `park.is_deleted=true`，返回更新后园区快照。
- `DELETE /api/factory/{id}`：逻辑删除厂房，只写 `factory.is_deleted=true`，不删除楼层或图片关系。
- `DELETE /api/finance/{id}`：逻辑删除财务流水，按授权园区校验，不触发租赁财务同步或图片关系重建。
- `DELETE /api/hrm/employee/{id}`：软删除员工，设置 `isDeleted=true`，缺少离职日期时写入当前时间，不处理账号解绑或组织生命周期。
- 本批继续只迁移低副作用主表写接口；`PUT /api/factory/{id}`、`PUT /api/finance/{id}`、宿舍写接口、员工更新、系统角色写接口、报销审核/删除等涉及关系重建、组织生命周期或财务同步的接口仍保留后续专项迁移。

第四十一批接口说明：

- `POST /api/auth/password`：当前登录用户修改密码，校验旧密码后写入新密码哈希，同时递增 `tokenVersion` 并撤销该用户有效 refresh token。
- `POST /api/access/visitor/register`：公开访客登记接口；有 token 时写当前租户库，无 token 时写默认租户库，并校验访客姓名、手机号和进出状态。
- `DELETE /api/rental/salary/{id}`：租户库事务内删除工资图片关系和工资主表，返回删除前快照。
- `DELETE /api/investment/{id}`：删除招商主表记录并返回删除前快照，不处理图片、跟进或雷达关联数据。
- `PUT /api/investment/radar/score-rule/{id}`：只更新评分规则白名单字段 `enabled/scoreDelta/keywordJson/ruleDescription`，不触发 seed、线索重算或爬虫任务。
- 本批继续只迁移低副作用写接口；不迁移密码找回、批量工资同步、招商关系重建、雷达评分重算、任务运行、外部通知、导入、导出等高风险副作用。

第四十二批接口说明：

- `POST /api/access/visitor`：新增访客出入记录；保持旧公开访问边界，有 token 时写当前租户库，无 token 时写默认租户库，并要求有效 `parkId`。
- `POST /api/access/car`：新增车辆出入记录，只写 `access_car` 主表，按当前用户授权园区校验。
- `POST /api/access/door`：新增门禁设备，只写 `access_door` 主表，校验设备编号唯一、园区存在和操作权限。
- `PUT /api/investment/{id}`：更新招商项目主表白名单字段，不处理图片关系、跟进记录或雷达线索联动。
- `PUT /api/investment/radar/crawler-source/{id}`：更新采集源配置字段，不执行 catalog seed、启停任务、调度或爬虫运行。
- 本批继续保持低副作用边界；不迁移招商新增、采集源 enable/disable 快捷动作、爬虫任务运行、导入、重建、发送、支付、短信、企微或外部硬件同步。

第四十三批接口说明：

- `PUT /api/finance/{id}`：更新财务流水主表白名单字段，按授权园区校验；不重建 `finance_image`，不触发租赁财务同步。
- `PUT /api/rental/salary/{id}`：更新工资主表白名单字段，变更关联租户时校验新租户园区权限；不重建 `salary_image`，不触发批量工资同步。
- `PUT /api/hrm/employee/{id}`：更新员工主表白名单字段和 `userId` 软绑定，校验身份证重复和账号占用；不联动中心库账号生命周期或组织角色。
- `POST /api/hrm/attendance`：上班打卡，只写 `attendances` 主表，复用定位范围和考勤状态计算；不写设备异常日志。
- `PUT /api/hrm/attendance/{id}`：下班打卡更新，只写 `punchOut`、坐标和状态；普通用户只能更新本人记录，不写设备异常日志。
- 本批继续保持低副作用边界；不迁移财务/工资图片关系重建、租赁财务同步、考勤设备绑定/异常写入、中心库账号生命周期、组织角色同步、支付、短信、企微、爬虫、导入、重建、发送或导出。

第四十四批接口说明：

- `PUT /api/rental/tenant/{id}`：更新租户主表白名单字段，写入前校验原园区和目标园区权限；不重建租户图片关系，不触发 `syncRentalExpenseFinanceRecords`。
- `DELETE /api/rental/tenant/{id}`：删除租户图片关系、软删关联工资并物理删除租户，返回删除前快照；保留旧后端用于后续稳定观察。
- `PUT /api/dormitory/{id}`：更新宿舍主表白名单字段，校验原园区和目标园区权限；不重建 `dormitory_image`。
- `DELETE /api/dormitory/{id}`：删除宿舍图片关系并物理删除宿舍，返回删除前快照。
- 本批只迁移 4 个接口；同区域可选第 5 个候选涉及厂房楼层重建、账单联动、图片重建或财务同步，暂不混入本批。

第四十五批接口说明：

- `POST /api/system/role/code`：新增系统角色权限码绑定，校验系统角色和权限码存在；组织角色作用域和权限缓存刷新留后续专项统一处理。
- `DELETE /api/system/role/code`：删除系统角色权限码绑定，返回 `deletedCount`，未找到时保持旧接口业务错误。
- `POST /api/crm/sales/channel`：新增 CRM 销售渠道，只写中心库 `crm_sales_channel`；不生成二维码，不调用微信或企微。
- `POST /api/crm/sales/channel/update`：更新 CRM 销售渠道主表白名单字段；普通账号只能操作自己的销售渠道。
- `POST /api/crm/binding/status`：启停客户归属绑定，并写入本地 `crm_scan_log` 审计；不触发企微通知或外部同步。
- 本批继续保持低副作用边界；不迁移 CRM 二维码生成、微信 OAuth、小程序手机号解析、企微 contact-way 创建、客户归属新增/转移/删除、组织角色范围写入或外部服务调用。

第四十六批接口说明：

- `PUT /api/system/role/{id}`：更新系统角色主表白名单字段，并可同步 `role_menu`/`role_park` 关联；不覆盖组织角色作用域。
- `DELETE /api/system/role/{id}`：删除系统角色并清理 `role_code`、`role_menu`、`role_park`、`user_role` 本地关联。
- `POST /api/system/role/{id}/add-permissions`：增量添加角色菜单权限，恢复已软删关联或创建新关联。
- `POST /api/system/role/{id}/remove-permissions`：软删除角色菜单权限。
- `POST /api/system/menu-template-sync/dry-run`：校验默认库 Super 权限并返回 dry-run 计划；不写 `menu_template_sync_job`，不执行租户菜单模板同步。
- 本批继续保持低副作用边界；不迁移组织角色范围、权限缓存版本刷新、菜单模板同步 execute、XXL-Job 触发或跨租户菜单写入。

第四十七批接口说明：

- `POST /api/investment/radar/crawler-source/{id}/enable`：启用采集源，只写 `crawler_source.enabled`。
- `POST /api/investment/radar/crawler-source/{id}/disable`：停用采集源，只写 `crawler_source.enabled`。
- `POST /api/investment/radar/crawler-task/{id}/cancel`：取消 `PENDING` 采集任务，写任务状态、完成时间、跳过原因和本地任务日志。
- `POST /api/investment/radar/outreach-template/{id}/enable`：启用已审批触达模板，只写模板启用状态。
- `POST /api/investment/radar/outreach-template/{id}/disable`：停用触达模板，只写模板启用状态。
- 本批继续保持低副作用边界；不运行爬虫、不启动调度、不执行触达发送、不推进模板审批流、不重建线索或房源匹配。

第四十八批接口说明：

- `POST /api/investment/radar/outreach-template`：创建触达模板，只写 `investment_outreach_template` 和版本快照，默认进入待审批且禁用。
- `PUT /api/investment/radar/outreach-template/{id}`：更新触达模板，重置为待审批并禁用，同时写入版本快照。
- `POST /api/investment/radar/outreach-template/{id}/submit-approval`：提交触达模板审批，只切换本地审批状态并写版本快照。
- `POST /api/investment/radar/outreach-template/{id}/approve`：审批通过触达模板，本地启用模板。
- `POST /api/investment/radar/outreach-template/{id}/reject`：驳回触达模板，本地禁用模板。
- 本批继续保持低副作用边界；不复刻旧端 `ensureOutreachTemplateTable` 的 DDL/默认模板 seed，不创建触达任务，不发送短信/企微，不调用外部审批系统。

第四十九批接口说明：

- `POST /api/investment/radar/outreach-task/{id}/cancel`：取消 `PENDING/RUNNING` 触达任务，只写本地任务状态和结果码。
- `POST /api/investment/radar/lead/{id}/assign-owner`：手动分配线索负责人，写 `investment_lead.owner_user_id` 和 `investment_lead_assignment_log`。
- `POST /api/investment/radar/sop-reminder/{id}/complete`：完成 SOP 提醒，只写提醒状态和处理时间。
- `POST /api/investment/radar/lead/{id}/visit`：新增带看预约，只写 `investment_visit_record` 并推进线索阶段。
- `POST /api/investment/radar/visit-record/{id}/complete`：完成带看记录，只写带看反馈、实际时间和线索阶段。
- 本批继续保持低副作用边界；不发送短信/企微，不创建外部触达，不导入、不重建、不运行爬虫，不调用外部通知或审批系统。

第五十批接口说明：

- `POST /api/investment/radar/contact-restriction/{id}/release`：提交触达限制解除申请，只写 `contact_restriction` release 字段和本地审计日志。
- `POST /api/investment/radar/contact-restriction/{id}/approve-release`：审批通过解除限制，只写本地限制状态和审计日志。
- `POST /api/investment/radar/contact-restriction/{id}/reject-release`：驳回解除限制，只写本地 release 状态和审计日志。
- `PUT /api/investment/radar/property/{id}/tags`：更新房源标签，只写 `investment_property_tag`，并同步已有 `property_match_result.tag`。
- `PUT /api/investment/radar/signal-event/{id}`：更新企业信号状态，只写 `signal_event.status`。
- 本批继续保持低副作用边界；不复刻旧端 ensure/ALTER DDL，不写 `investment_radar_operation_audit_log`，不导入、不转线索、不重建房源匹配、不发送短信/企微、不运行爬虫。

第五十一批接口说明：

- `PUT /api/investment/radar/external-lead/{id}`：更新外部公开线索状态、负责人、备注和失效原因，只写 `company_lead` 本地字段，不转招商雷达线索。
- `POST /api/investment/radar/lead/{id}/follow`：新增线索跟进记录，按旧端规则推进线索阶段，必要时写 `contact_restriction` 和审计日志。
- `POST /api/investment/radar/lead/{id}/close`：关闭线索为成交或失效，写线索状态、跟进记录，完成本地 SOP 待办并取消未执行触达任务。
- `POST /api/investment/radar/outreach-task`：创建本地触达任务，校验触达限制和未完成任务后写入 `PENDING` 任务。
- `POST /api/investment/radar/outreach-task/{id}/reply`：记录触达回复，更新任务回复、线索阶段，并按回复内容维护触达限制。
- 本批继续保持低副作用边界；不复刻旧端 ensure/ALTER DDL，不执行触达发送、不调用短信/企微、不转线索、不导入、不重建评分或房源匹配、不运行爬虫、不写 `investment_radar_operation_audit_log`。

第五十二批接口说明：

- `POST /api/bill/amount/export`：总账单导出数据接口，按授权园区返回 `{ parkName, bills }` JSON 分组，不生成文件。
- `POST /api/bill/amount/collection-sms/preview`：催缴短信预览，只计算候选账单、模板参数、短信正文和 summary，不发送短信、不写发送日志。
- `POST /api/image/upload`：图片上传，支持 JPG/PNG，按 SHA-256 哈希去重，写入当前租户库 `image` 表和 `public/uploads`。
- `DELETE /api/bill/amount/{id}`：删除总账单及其水电明细，并软删关联财务流水，返回删除前账单快照。
- `POST /api/organization/invitation/revoke`：Super 撤销当前组织空间 active 邀请码，只写中心库 `tenant_invitation.status=revoked`。
- 本批仍保持低副作用边界；不迁移总账单编辑、催缴短信真实发送、报销审核、组织邀请码创建/加入、支付、企微、爬虫、导入、重建或外部通知。

第五十三批接口说明：

- `POST /api/crm/binding/create`：手工新增 CRM 客户归属，只写中心库 `crm_customer_owner_binding` 并写入本地 `crm_scan_log` 审计。
- `POST /api/crm/binding/update`：编辑客户归属身份字段，校验手机号/OpenID/UnionID 唯一性并写入本地审计。
- `POST /api/crm/binding/delete`：物理删除客户归属，删除前保留本地扫码日志审计和删除前快照返回。
- `POST /api/crm/binding/transfer`：转移客户归属到目标销售，只更新本地销售和企微用户快照，不调用企微外部接口。
- 本批继续保持低副作用边界；不生成二维码，不调用微信/企微，不创建外部联系方式，不迁移微信 OAuth、小程序手机号解析、企微 contact-way 创建或 CRM 邀请解析外呼分支。

第五十四批接口说明：

- `POST /api/investment/radar/crawler-task/item/requeue`：重新入队失败、等待重试或跳过的采集 URL，只重置 `crawler_task_item` 本地状态。
- `POST /api/investment/radar/crawler-task/item/reclaim-stale-running`：回收长时间 `RUNNING` 的采集 URL，按重试次数切为 `RETRY_WAITING` 或 `FAILED`。
- `POST /api/investment/radar/public-opportunity/manual`：手工录入公开机会，只写 `investment_public_opportunity`，使用轻量物化字段。
- `POST /api/investment/radar/public-opportunity/import-urls`：批量导入公开机会详情 URL，只做本地 URL 校验、去重和 `crawler_task_item` upsert。
- 本批继续保持低副作用边界；不启动调度器，不运行爬虫 worker，不调用公开采集 adapter 或外部网络，不转线索、不重建、不发送短信/企微，也不复刻旧端 ensure/ALTER/seed。

第五十五批接口说明：

- `PUT /api/park/{id}`：兼容旧园区更新路径，复用 `/api/system/park/{id}` 的白名单更新逻辑，只写 `park` 主表基础字段。
- `POST /api/investment/radar/contact-restriction/import`：批量导入触达限制名单，支持旧端直接数组 body 或 `{ items: [...] }`，逐行校验并写 `contact_restriction` 与本地审计日志。
- 本批继续保持低副作用边界；不迁移旧 `/api/park/{id}` 物理删除，不写园区图片/厂房/宿舍关系，不复刻触达限制 ensure/ALTER DDL，不发送短信/企微，不写 `investment_radar_operation_audit_log`。

第五十六批接口说明：

- `GET /api/crm/invite/h5-qrcode`：按 `scene` 查询启用的 CRM 销售渠道，并在 Spring Boot 本地用 ZXing 生成 H5 邀请二维码 PNG Data URL。
- 本批继续保持低副作用边界；不调用微信小程序码/URL Link，不创建企微 contact-way，不解析邀请归属，不写扫码记录，不触发微信 OAuth 或企微外部接口。

第五十七批接口说明：

- `POST /api/maintenance/elevator`：新增升降机主表记录，字段限定在已有白名单并按当前用户授权园区校验。
- `POST /api/maintenance/firefighting`：新增消防设施主表记录，不写消防图片关系表。
- `POST /api/maintenance/transformer`：新增变压器主表记录，不触发外部设备同步。
- `POST /api/maintenance/hygieneCheck`：新增卫生检查主表记录。
- `POST /api/maintenance/factoryMaint`：新增厂房维护主表记录。
- 本批继续保持低副作用边界；只写维保主表，不处理图片关系、外部硬件同步、批量导入/导出、支付、短信、企微、组织开通、雷达任务、重建、发送或导出。

第五十八批接口说明：

- `POST /api/localization`：新增当前登录用户打卡定位记录，`userId/username` 从 token 注入，不接受前端伪造。
- `POST /api/system/dept`：兼容旧 Nitro mock 部门新增接口，只校验登录态，不落库。
- `POST /api/system/menu`：新增系统菜单和 `menu_meta`；button 类型且存在 `authCode` 时同步创建 `code`。
- 本批只迁移 3 个接口，是为了不把宿舍图片关系、园区嵌套创建、账号/组织生命周期或外部调用混入低副作用批次。

第五十九批接口说明：

- `POST /api/rental/manage`：新增租赁管理厂房主表记录，按当前用户授权园区校验；不写楼层、图片或账单联动。
- `POST /api/hrm/leaveapplication`：新增请假申请主表记录，申请人、园区和审批人名称按旧接口规则回填关联 ID；不触发审批流、消息通知或考勤重算。
- `POST /api/investment`：新增招商项目主表记录，走招商雷达共享库；不处理图片关系、跟进记录或雷达线索联动。
- 本批只迁移 3 个接口，继续避开图片关系、园区/厂房嵌套创建、账号/组织生命周期、支付、短信、企微、爬虫、导入、重建、发送等高副作用候选。

第六十批接口说明：

- `POST /api/finance`：新增财务流水主表记录，按旧接口校验 `billName` 和园区权限；允许 `parkId` 为空以兼容旧财务记录。
- `POST /api/rental/salary`：新增工资记录主表，先校验 `rentalTenantId` 对应合同人存在且属于当前用户授权园区。
- 本批只迁移 2 个接口，继续保持低副作用边界：不写 `finance_image`、`salary_image`，不触发租赁费用同步、批量工资同步、催缴短信、账单联动或外部通知。

第六十一批接口说明：

- `POST /api/park`：新增园区主表记录，只写 `park` 白名单字段，不写园区图片、厂房或宿舍嵌套数据。
- `POST /api/dormitory`：新增宿舍主表记录，按当前用户授权园区校验目标 `parkId`；`images` 入参保留兼容但不写 `dormitory_image`。
- 本批只迁移 2 个接口，继续保持低副作用边界：不处理图片关系、园区嵌套创建、厂房/楼层创建、账单联动或外部通知。

第六十二批接口说明：

- `POST /api/factory`：新增旧厂房主表记录，按当前用户授权园区校验；`floors` 入参保留兼容但不写楼层和楼层图片关系。
- `POST /api/rental/tenant`：新增租户主表记录，按当前用户授权园区校验；`images` 入参保留兼容但不写 `tenant_image`，不触发租赁费用财务同步。
- `POST /api/reimbursement`：新增报销主表记录，`userId` 从当前登录用户注入；`images` 入参保留兼容但不写 `reimbursement_image`。
- `PUT /api/investment`：兼容旧招商项目更新路径，从请求体 `investmentId` 定位记录，复用主表白名单更新逻辑。
- 本批只迁移 4 个接口，继续保持低副作用边界：不处理图片关系、厂房楼层嵌套、租赁财务同步、报销审核财务同步、雷达线索联动或外部通知。

第六十三批接口说明：

- `PUT /api/factory/{id}`：更新旧厂房主表白名单字段，按当前用户授权园区校验；`floors` 入参保留兼容但不重建楼层和楼层图片关系。
- `POST /api/system/park`：兼容系统园区新增路径，复用旧园区新增主表逻辑；不写园区图片、厂房或宿舍嵌套数据。
- `DELETE /api/park/{id}`：兼容旧园区删除路径，迁移期先复用系统园区软删逻辑，避免切流期间物理删除园区及关联数据。
- 本批只迁移 3 个接口，继续保持低副作用边界：不写 `factory_floor`、`factory_floor_image`、`park_image`，不处理园区嵌套厂房/宿舍创建，不执行旧园区物理删除。

第六十四批接口说明：

- `POST /api/rental/salary/sync`：按当前用户授权园区补齐有效合同缺失的工资主表占位记录；不写工资图片关系，不改变已有工资记录。
- `DELETE /api/finance`：批量软删当前用户授权园区内的财务流水；不删除 `finance_image`，不触发租赁费用同步或外部通知。
- 本批只迁移 2 个接口，继续保持低副作用边界：不发送催缴短信，不触发支付/企微/审批/爬虫，不执行真实财务同步补偿。

第六十五批接口说明：

- `POST /api/hrm/employee`：新增员工主表记录，保留旧接口必填校验、年龄校验、身份证号唯一性和账号绑定占用校验；不创建中心库账号、不同步组织角色或考勤数据。
- `PUT /api/reimbursement/{id}`：审核报销申请，保留审核权限、园区权限和 `rates` 金额上限校验；只更新 `reimbursement` 主表状态和审核意见，不同步 `finance`。
- `DELETE /api/reimbursement/{id}`：软删除报销申请，保留本人或授权园区审核角色删除规则；不联动删除已同步的财务记录或图片关系。
- `POST /api/system/role`：新增系统角色并同步 `role_menu`、`role_park` 本地关联；不接入组织角色作用域，也不刷新 Redis 权限版本。
- 本批只迁移 4 个接口，继续保持每批不超过 5 个接口的节奏。

第六十六批接口说明：

- `POST /api/bill/amount`：新增总账单主表和显式传入的水电明细，按当前用户授权园区校验；不直接创建或更新 `finance`。
- `PUT /api/bill/amount/{id}`：更新总账单白名单字段，水电明细仅在请求显式传入时重建；不触发租赁费用财务同步。
- `POST /api/bill/amount/collection-sms/send`：催缴短信发送兼容入口，复用预览候选并投递 RabbitMQ 通知任务；不直连短信供应商，不写真实短信回执。
- `DELETE /api/bill/amount`：批量删除当前用户授权园区内的总账单和水电明细，避免旧端无范围全库删除；不做额外外部通知。
- 本批只迁移 4 个接口，继续保持每批不超过 5 个接口的节奏。`GET /api/bill/amount/utils` 和 `GET /api/bill/amount/delete-utils` 是旧端内部工具文件误计入路由差异，暂不迁移。

第六十七批接口说明：

- `POST /api/auth/send-login-code`：生成登录验证码，写入 Redis 并投递 RabbitMQ 通知任务；不直连短信供应商。
- `POST /api/auth/send-page-access-code`：为当前登录账号手机号生成页面访问验证码，手机号只读解析，不创建中心用户或租户映射。
- `POST /api/auth/verify-page-access-code`：校验当前登录账号页面访问验证码，成功后删除 Redis 验证码。
- `POST /api/sms/send`：单条租户合同提醒短信排队，校验登录态、必要参数和租户园区权限；不更新 `send_message`。
- `POST /api/sms/send-bulk`：批量扫描授权园区内合同即将到期的租户并逐条投递 RabbitMQ 通知任务；不真实发送短信，不写真实发送时间。
- 本批只迁移 5 个接口，继续保持每批不超过 5 个接口的节奏。`POST /api/auth/code-login` 会自动创建中心账号、租户用户和角色绑定，副作用较重，暂不并入本批。当前旧接口差异脚本实测 `old=365 java=314 missing=60`，文档早期“剩余约 42 个”的估算已偏低，后续以脚本实测为准。

第六十八批接口说明：

- `GET /api/dashboard/meter-statistics`：表计统计兼容接口。第六十八批先落本地账单统计版；第一百六十一批已升级为合众第三方设备/历史读数优先，本地 `amount_bill`、`ele_bill`、`water_bill` 兜底。
- `POST /api/wework/callback`：企业微信事件回调 POST 兼容入口，验签/解密后只记录本地 CRM 回调日志，并在能匹配客户归属时更新本地外部联系人快照；不调用企业微信外部接口，不发送欢迎语。
- 本批只迁移 2 个接口，是因为剩余接口多为支付、组织开通、爬虫运行、导入/重建、真实短信/企微外呼等高风险面。当前旧接口差异脚本实测 `old=365 java=316 missing=58`。

第六十九批接口说明：

- `POST /api/user`：新增租户账号，写租户库 `user/user_role/user_park`，同步中心库 `user/user_tenant_mapping`，密码使用 BCrypt；中心库同步失败时清理本批创建的租户账号。
- `PUT /api/user/{id}`：更新租户账号姓名、手机号、状态、密码、角色和园区范围，并同步中心库账号、递增 tokenVersion、撤销 refresh token。
- `DELETE /api/user/{id}`：软删除指定租户账号，解除角色、权限码、园区和员工绑定，删除中心库租户映射；不允许删除当前登录账号。
- `POST /api/user/cancel`：注销当前登录账号，复用软删除逻辑并清理 refresh token cookie。
- 本批只迁移 4 个账号生命周期接口，暂不复刻旧端组织成员自动开通/退出、组织 owner 保护等策略；这些仍留到组织生命周期专项。当前旧接口差异脚本实测 `old=365 java=320 missing=54`。

第七十批接口说明：

- `POST /api/system/menu-template-sync/execute`：保留旧端 execute 路由形态，复用默认库 Super 权限、`allTenants`/`targetCustomerId` 互斥校验和目标租户存在性校验。
- 本批只写中心库 `menu_template_sync_job`/`menu_template_sync_log` 审计记录，状态为 `accepted`，返回 `executed=false`；不直接写租户库 `menu/menu_meta/code`，不刷新 Redis 权限缓存，不在 HTTP 请求内触发 XXL-Job。
- 真正跨租户菜单模板同步仍由 `menuTemplateSyncJob` 专项承接，执行前需要重新 dry-run/preflight。当前旧接口差异脚本实测 `old=365 java=321 missing=53`。

第七十一批接口说明：

- `POST /api/organization/invitation/create`：Super 创建当前组织空间邀请码，校验中心库客户/组织映射、目标租户角色、角色数量、过期时间、最大使用次数和备注长度，只写中心库 `tenant_invitation`。
- `POST /api/organization/invitation/join`：当前登录账号通过邀请码加入已有组织空间，写目标租户 `user/user_role`、中心库 `user_tenant_mapping`、`organization_member`、`tenant_invitation_join_log`，并在真正消耗邀请码时做状态/过期/次数条件更新。
- 本批只迁移 2 个组织邀请码本地接口；不迁移 `POST /api/organization/create`、开通任务重排、会员支付或任何外部服务。当前旧接口差异脚本实测 `old=365 java=323 missing=51`。

第七十二批接口说明：

- `POST /api/investment/radar/external-lead/{id}/convert`：外部公开线索转招商雷达线索，必要时创建本地企业和雷达线索，并回写 `company_lead.converted_radar_lead_id/converted_at/status/owner_user_id/remark`。
- `POST /api/investment/radar/signal-event/{id}/convert`：企业信号转招商雷达线索，优先复用关联外部线索转换结果，否则创建本地企业和雷达线索，并回写 `signal_event.related_radar_lead_id/status`。
- `POST /api/investment/radar/lead/{id}/recalculate-score`：基于现有 `signal_event/signal_evidence/lead_score_rule` 重算线索评分，替换 `lead_score_breakdown` 并更新 `investment_lead.intent_score/total_score/priority_level`。
- 本批只迁移 3 个招商雷达本地数据库接口；不刷新信号事件、不 seed 默认评分规则、不重建房源匹配、不启动爬虫、不导入、不发送短信/企微、不调用外部网络。当前旧接口差异脚本实测 `old=365 java=326 missing=48`。

第七十三批接口说明：

- `POST /api/investment/radar/signal-event/refresh`：从现有 `company_lead/lead_evidence` 派生刷新 `signal_event/signal_evidence`，软删不再有效的派生信号。
- `POST /api/investment/radar/enterprise-profile/refresh`：从现有 `signal_event` 聚合刷新 `enterprise_profile/enterprise_tag`。
- `POST /api/investment/radar/lead/recalculate-scores`：批量查找公开来源/信号来源线索，并复用单条评分重算逻辑刷新评分拆解。
- 本批只迁移 3 个招商雷达本地派生数据接口；不执行旧端自动 DDL、默认评分规则 seed、公开爬虫、导入、房源匹配重建、触达发送或外部网络调用。当前旧接口差异脚本实测 `old=365 java=329 missing=45`。

第七十四批接口说明：

- `POST /api/investment/radar/outreach-task/{id}/send`：本地兼容触达发送，复用任务状态、触达限制和模板内容填充校验，只写 `investment_outreach_task` 发送状态和线索最近触达时间。
- `POST /api/investment/radar/outreach-task/{id}/mock-send`：兼容旧 mock-send 路径，旧端与 send 共用发送服务；Spring Boot 侧同样复用本地发送逻辑。
- `POST /api/investment/radar/public-opportunity/parse-demand-page`：解析请求体 HTML 并写入本地公开机会池，不访问 `sourceUrl`，不启动 crawler。
- `POST /api/investment/radar/public-opportunity/repair`：按公开机会审计规则预览/修复历史状态；`dryRun` 默认 true，显式 false 才会降级历史数据并写操作审计。
- `POST /api/investment/radar/external-lead/rebuild-from-public-opportunity`：从本地公开机会池重建 `company_lead/lead_evidence`，不执行外部抓取。
- 本批迁移 5 个招商雷达本地处理接口；不调用短信/企微供应商、不启动公开爬虫、不访问外部网络、不执行旧端自动 DDL/seed、不重建房源匹配。当前旧接口差异脚本实测 `old=365 java=334 missing=40`。

第七十五批接口说明：

- `POST /api/investment/radar/collect/task`：创建公开机会采集任务，当前只执行本地公开机会到外部线索的 DB 重建逻辑，并写 `investment_radar_collect_task` 状态。
- `POST /api/investment/radar/crawler-task/scheduler/start`：返回 Spring Boot 本地启动态并写操作审计，不创建线程定时器，不启动真实爬虫。
- `POST /api/investment/radar/crawler-task/scheduler/stop`：返回 Spring Boot 本地停止态并写操作审计，不取消历史任务。
- `POST /api/investment/radar/crawler-task/run-public-opportunity`：按请求参数创建单平台 `crawler_task` PENDING 队列记录，不联网抓取。
- `POST /api/investment/radar/crawler-task/run-public-opportunity-batch`：按 DEMAND/SUPPLY/ALL 平台拆分创建本地 PENDING 任务，不并发访问外部平台。
- 本批迁移 5 个招商雷达采集运维接口；不执行旧端自动 DDL/seed、不启动公开爬虫、不访问外部网络、不实际运行调度器。真实抓取后续由 XXL-Job/Kafka worker 专项承接。当前旧接口差异脚本实测 `old=365 java=339 missing=35`。

第七十六批接口说明：

- `POST /api/investment/radar/crawler-task/run`：兼容旧端公开机会 URL 批处理入口，按请求参数创建本地 `crawler_task` PENDING 队列记录。
- `POST /api/investment/radar/crawler-task/run-eia`：创建环保公示采集本地 PENDING 任务，任务源为 `PUBLIC_EIA_NOTICE_MEE_CANDIDATE`。
- `POST /api/investment/radar/crawler-task/run-internal-contract-expiry`：创建内部合同到期扫描本地 PENDING 任务，默认扫描未来 90 天合同。
- `POST /api/investment/radar/crawler-task/run-recruitment`：创建招聘信息采集本地 PENDING 任务，任务源为 `PUBLIC_RECRUITMENT_51JOB_CANDIDATE`。
- `POST /api/investment/radar/crawler-task/run-tender`：创建招投标信息采集本地 PENDING 任务，任务源为 `PUBLIC_TENDER_CCGP_CANDIDATE`。
- 本批迁移 5 个招商雷达爬虫任务手动触发接口；只写本地 `crawler_task`、`crawler_task_log` 和操作审计，不执行适配器、不扫描真实租户合同、不访问外部网站、不回写公开线索或雷达线索。真实抓取和消费仍由后续 XXL-Job/Kafka worker 专项承接。当前旧接口差异脚本实测 `old=365 java=344 missing=30`。

第七十七批接口说明：

- `POST /api/investment/radar/crawler-task/sync-internal-contract-expiry`：扫描本地 `rental_tenant` 未来 90 天合同到期数据，派生本地 `company_lead`、雷达线索和信号事件，不访问外部网络。
- `POST /api/investment/radar/lead/import`：支持 JSON 数组或 `{ items: [] }` 导入雷达线索；文件上传解析留给 `lead/import-file` 专项批次。
- `POST /api/investment/radar/lead/{id}/rebuild-property-match`：基于本地房源、楼层和标签重建单条线索 `property_match_result` 快照。
- `POST /api/investment/radar/lead/rebuild-property-match-batch`：按 `limit` 批量重建房源匹配快照，默认最多 200 条，防止 HTTP 请求内全量重建。
- `POST /api/investment/radar/pipeline/rebuild`：串联本地信号刷新、企业画像刷新、评分重算、SOP 提醒和触达任务派生；不启动爬虫，不调用短信或企微。
- 本批迁移 5 个招商雷达本地数据导入/重建接口；不解析上传文件、不执行旧端自动 DDL/seed、不访问外部网站、不调用短信/企微、不启动真实 worker。当前旧接口差异脚本实测 `old=365 java=345 missing=28`。

第七十八批接口说明：

- `GET /api/crm/invite/url-link`：读取中心库有效销售渠道，生成本地 H5 兼容 URL Link 结果，不调用微信小程序 `generate_urllink`。
- `GET /api/crm/invite/wxacode`：读取中心库有效销售渠道，使用本地二维码生成 PNG data URL，不调用微信小程序码接口。
- `GET /api/crm/invite/wechat-oauth/start`：只组装 302 跳转地址；微信配置缺失时回跳邀请 H5 并带 `oauth_error=not_configured`，不换取 token。
- `POST /api/crm/invite/resolve`：解析扫码归属，写中心库 `crm_customer_owner_binding`、`crm_scan_log`，并生成本地兼容 `crm_wework_contact_way` 记录，不调用企业微信。
- `GET /api/crm/sales/contact-way`：登录态下生成或复用销售联系二维码本地记录，普通账号限定当前销售，Super 可指定销售。
- 本批迁移 5 个 CRM 邀请/联系方式本地兼容接口；不访问微信/企微外部网络，不迁移 OAuth callback、小程序 session/phone、销售真实小程序码生成或支付接口。当前旧接口差异脚本实测 `old=365 java=350 missing=23`。

第七十九批接口说明：

- `POST /api/crm/sales/qrcode`：创建销售渠道，并在请求要求生成小程序码时返回本地 PNG data URL；不调用微信小程序码接口。
- `POST /api/crm/miniprogram/qrcode-test`：按 scene/page/envVersion 生成小程序测试码本地兼容结果；缺省 scene 使用本地测试值，不依赖微信配置。
- `GET /api/hrm/leaveapplication/park`：显式保留旧文件名 `park` 路由，读取请假申请可选园区；不写库。
- `GET /api/wework/callback`：显式保留企业微信 URL 验证路由，签名校验后返回 echostr；不调用企微外部接口。
- `POST /api/wework/callback`：显式保留企业微信事件回调路由，只记录本地 CRM 回调日志；不调用企微外部接口。
- 本批迁移 5 个 CRM/HRM/企微本地兼容接口；销售二维码和小程序测试码均使用本地 PNG data URL，企微回调只做本地验证/记录。当前旧接口差异脚本实测 `old=365 java=356 missing=18`。

第八十批接口说明：

- `GET /api/bill/amount/utils`：旧 Nitro 内部工具文件被路由脚本识别；Spring Boot 显式返回迁移兼容说明，不提供直接业务操作。
- `GET /api/bill/amount/delete-utils`：旧 Nitro 删除工具文件被路由脚本识别；Spring Boot 显式返回兼容说明，不暴露无权限边界的批量删除工具。
- `GET /api/crm/invite/wechat-oauth/callback`：本地 302 回跳邀请 H5；缺 code 返回 `oauth_error=denied`，配置存在时仍返回 `external_disabled`，不请求微信 token/userinfo。
- `POST /api/llm/amount-bill-analyze`：校验 `.xlsx` 文件大小和类型，返回旧字段空结构及 `_meta.mode=local_stub`；不上传百炼。
- `POST /api/llm/tenant-images`：校验最多 8 张 data URL，返回合同字段空结构及 `_meta.mode=local_stub`；不调用百炼多模态。
- 本批迁移 5 个低副作用兼容接口；不外呼微信、百炼或任何外部网络，不解析真实 Excel/图片内容，不触发账单写库。当前旧接口差异脚本实测 `old=365 java=361 missing=13`。

第八十一批接口说明：

- `GET /api/auth/password`：旧端文件名被识别为 GET；Spring Boot 显式返回兼容说明，真实改密仍只允许 `POST /api/auth/password`。
- `GET /api/wechat/pay/query`：按 `outTradeNo` 只读中心库 `vip_membership_payment` 本地快照；不请求微信查单，不同步会员状态。
- `POST /api/crm/miniprogram/session`：校验 code 并返回本地 session 占位结果；不调用微信 `jscode2session`。
- `POST /api/crm/miniprogram/phone`：校验手机号授权 code 并返回本地占位结果；不调用微信手机号接口。
- `POST /api/chat/zhipu`：校验 message 并返回智谱 chat 本地占位响应；不读取或透传 apikey，不请求 `open.bigmodel.cn`。
- 本批迁移 5 个认证/支付/小程序/LLM 低副作用兼容接口；不外呼微信、智谱或任何支付通道，不执行会员权益、组织开通或账号创建副作用。当前旧接口差异脚本实测 `old=365 java=366 missing=8`。

第八十二批接口说明：

- `POST /api/wechat/pay/app/prepay`：生成本地预支付兼容结果和会员支付快照，返回 `local_` prepayId；不请求微信 APP 预下单。
- `POST /api/wechat/pay/notify`：接收微信支付通知原文并返回原生 `SUCCESS`，最多补记本地订单通知状态；不验签解密，不发放会员权益，不开通组织空间。
- `POST /api/wechat/pay/refund`：Super 发起会员退款本地申请，只写 `vip_membership_refund` 的 `CREATE_PENDING` 快照；不请求微信退款接口。
- `POST /api/wechat/pay/refund-notify`：接收退款通知原文并返回原生 `SUCCESS`，只补记退款快照；不撤销权益，不修改组织开通状态。
- `POST /api/organization/provisioning/requeue-failed-manual`：平台 Super 可预览或确认重排 `failed_manual` 开通任务，确认后只重置中心库任务为 `pending`；不在 HTTP 请求内执行开通 worker。
- 本批迁移 5 个支付/组织高风险接口的本地兼容版；不执行微信真实资金动作、验签解密、会员权益同步、组织开通 worker 或跨租户建库。当前旧接口差异脚本实测 `old=365 java=371 missing=3`。

第八十三批接口说明：

- `POST /api/auth/code-login`：短信验证码登录，验证码校验走 Redis；手机号缺失账号时受控补齐中心用户、租户用户、默认角色和中心映射，不触发组织开通或外部短信。
- `POST /api/investment/radar/lead/import-file`：支持 JSON/CSV/TSV 文件导入招商雷达线索，复用现有 JSON 导入落库和操作审计；不引入 Excel 二进制解析，不启动爬虫或触达发送。
- `POST /api/organization/create`：公开试用空间账号创建或补齐 source organization 和 owner 成员，只写中心库 `organization/organization_member`；不创建目标客户空间、不开通租户库、不写开通任务。
- 本批迁移 3 个接口，仍遵守每批不超过 5 个接口。当时旧路由统计口径为 `old=365 java=374 missing=0`；2026-07-02 复核发现该口径漏掉一批真实 event handler，已在第八十四批修正为 `oldHandlers=386` 口径继续推进。

第八十四批接口说明：

- `GET /api/access/brand/list`：门禁品牌分页列表，支持 `brandName/brandCode/protocolType/enabled/isDefault` 过滤，按 `isDefault desc, accessBrandId desc` 排序。
- `GET /api/access/brand/{id}`：门禁品牌详情，兼容旧端不存在时 `data=null` 的返回语义。
- `POST /api/access/brand`：新增门禁品牌，归一化品牌编码和布尔值；`isDefault=true` 时同事务清理其它默认品牌。
- `PUT /api/access/brand/{id}`：更新门禁品牌白名单字段；只写当前租户库 `access_brand`，不触发外部门禁平台同步。
- `DELETE /api/access/brand/{id}`：物理删除门禁品牌，并返回删除前快照以兼容旧 Prisma delete 响应。
- 本批迁移 5 个低副作用门禁品牌接口，并修正旧接口覆盖统计 bug。最新差异脚本按真实 event handler 口径实测 `oldHandlers=386 java=379 missing=18`；剩余为 `GET /api/access/brand/options`、智能电表品牌、维修工单、Agent/Smart Service Chat 和微信 H5 预支付。

第八十五批接口说明：

- `GET /api/access/brand/options`：门禁品牌搜索候选，field 只允许 `brandName/brandCode/protocolType`，按旧端规则大小写去重并返回最多 100 个候选。
- `GET /api/smart-meter/brand/list`：智能水电表品牌分页列表，支持 `meterType/brandName/brandCode/protocolType/enabled/isDefault` 过滤。
- `GET /api/smart-meter/brand/{id}`：智能水电表品牌详情，兼容旧端不存在时 `data=null`。
- `POST /api/smart-meter/brand`：新增智能水电表品牌，要求 `meterType=electric|water`，并归一化品牌编码和布尔值。
- `PUT /api/smart-meter/brand/{id}`：更新智能水电表品牌白名单字段；`isDefault=true` 时只清理同一 `meterType` 的其它默认品牌。
- 本批迁移 5 个低副作用品牌配置接口，不连接合众或其它表计平台，不处理密钥明文，不删除旧后端。最新差异脚本按真实 event handler 口径实测 `oldHandlers=386 java=384 missing=13`；剩余为智能电表品牌删除/options、维修工单、Agent/Smart Service Chat 和微信 H5 预支付。

第八十六批接口说明：

- `GET /api/smart-meter/brand/options`：智能水电表品牌搜索候选，field 只允许 `brandName/brandCode/protocolType`，可按 `meterType` 缩小范围。
- `DELETE /api/smart-meter/brand/{id}`：物理删除智能水电表品牌，并返回删除前快照。
- `GET /api/maintenance/repair-order/list`：报修工单分页列表，按授权园区过滤，支持厂房、租户、类型、状态、优先级、维修人、工单号和提交时间范围筛选。
- `GET /api/maintenance/repair-order/{id}`：报修工单详情，补齐授权园区校验。
- `POST /api/maintenance/repair-order`：新增报修工单，只写 `repair_order` 主表，默认生成 `ROyyyyMMddNNNN` 工单号，不触发短信、企微、站内通知或派单 worker。
- 本批迁移 5 个低副作用接口，并兼容写入 `images/process_images` 主表字段。最新差异脚本按真实 event handler 口径实测 `oldHandlers=386 java=389 missing=8 extra=11`；剩余为维修工单更新/删除、Agent/Smart Service Chat 和微信 H5 预支付。

第八十七批接口说明：

- `PUT /api/maintenance/repair-order/{id}`：更新报修工单主表字段，写入前校验原工单园区和目标园区操作权限。
- `DELETE /api/maintenance/repair-order/{id}`：物理删除报修工单，并返回删除前快照。
- `GET /api/agent/skills`：返回本地内置 `llm_chat_response` Skill 定义，不访问模型供应商。
- `GET /api/agent/tasks`：查询当前登录用户的本地 `agent_task` 列表，支持 `currentPage/page/pageSize/status`。
- `GET /api/agent/tasks/{id}`：查询当前登录用户有权访问的任务详情和 `agent_task_step` 步骤。
- 本批迁移 5 个低副作用接口；Agent 只读本地任务表，不执行 `POST /api/agent/chat`，不调用 LLM，不写审计或步骤。最新差异脚本按真实 event handler 口径实测 `oldHandlers=386 java=394 missing=3 extra=11`；剩余为 Agent Chat、Smart Service Chat 和微信 H5 预支付。

第八十八批接口说明：

- `POST /api/agent/chat`：返回 Agent Chat 本地兼容结果，校验当前用户和消息内容，生成本地任务快照；不执行真实 Agent runner，不调用 LLM，不写 `agent_task_step`。
- `POST /api/smart-service/chat`：返回 UTF-8 SSE 兼容数据流，按常见问题给出本地预设答复；不调用百炼或其它外部 AI 服务。
- `POST /api/wechat/pay/h5/prepay`：创建微信 H5 预支付本地快照，返回本地 H5 URL 和订单号；不请求微信 `/v3/pay/transactions/h5`，不扣款，不开通会员权益。
- 本批迁移最后 3 个旧接口，仍遵守每批不超过 5 个接口。最新差异脚本按真实 event handler 口径实测 `oldHandlers=386 java=397 missing=0 extra=11`；旧 mock 的 event handler 路由已经全部有 Spring Boot 对应入口，后续重点转为真实 LLM、微信支付验签下单、会员权益开通和 Kafka/RabbitMQ/XXL-Job 联调。

第八十九批工作说明：

- Kafka outbox dispatcher 已增加派发前认领：扫描到 `pending/retry` 事件后，先通过数据库条件更新为 `dispatching`，多实例部署时只有认领成功的实例会发送 Kafka。
- 成功发送后标记 `sent`；发送失败后写入 `last_error`，并按当前 attempts 进入 `retry` 或 `dead`，`dead` 不再设置下一次重试时间。
- 新增 Kafka outbox worker 单元测试，覆盖发送成功、发送失败、认领冲突、批次上限和调度开关。
- 本批是 1 个 worker 场景，不把业务接口直接接入真实 Kafka，不自动 migrate，不默认开启 dispatcher；真实联调前需确认 `src/main/resources/db/manual/001-event-outbox.sql` 已手动执行，并配置可用 Kafka broker。

第九十批工作说明：

- 微信 APP/H5 会员预支付本地快照成功写入 `vip_membership_payment` 后，可按 `KAFKA_OUTBOX_EVENT_WRITE_ENABLED=true` 写入 `vip.membership.payment.created` outbox 事件。
- 事件 topic 为 `magic.vip-membership.payment`，幂等键为 `vip-membership-payment-created:{outTradeNo}`，payload 包含金额、中心用户、支付渠道、订单号、来源客户空间和用户名。
- 预支付响应会返回 `paymentSnapshotRecorded`、`outboxEventQueued` 和可选 `outboxEventId`，用于灰度环境核对业务快照和 outbox 写入状态。
- 默认不开启 outbox 业务事件写入，不影响未建表环境；一旦开启，outbox 写入失败会让当前事务失败，避免支付快照和事件流不一致。本批仍不请求微信、不发放会员权益、不执行组织开通 worker，也不默认开启 Kafka dispatcher。

第九十一批工作说明：

- 微信支付通知本地更新 `vip_membership_payment` 成功后，可按 `KAFKA_OUTBOX_EVENT_WRITE_ENABLED=true` 写入 `vip.membership.payment.notified` outbox 事件。
- 事件 topic 仍为 `magic.vip-membership.payment`，幂等键为 `vip-membership-payment-notified:{outTradeNo}`，payload 包含金额、中心用户、订单号、来源客户空间、交易状态和微信交易号。
- 通知响应会返回 `paymentSnapshotUpdated`、`outboxEventQueued` 和可选 `outboxEventId`，用于灰度核对支付回调落库与 outbox 写入状态。
- 本批仍不验签、不解密、不请求微信查单、不发放会员权益、不执行组织开通 worker；只有本地支付快照更新命中且能读取到订单归属客户空间时才写事件。

第九十二批工作说明：

- 微信会员退款本地申请写入 `vip_membership_refund` 并回读成功后，可按 `KAFKA_OUTBOX_EVENT_WRITE_ENABLED=true` 写入 `vip.membership.refund.requested` outbox 事件。
- 事件 topic 为 `magic.vip-membership.refund`，幂等键为 `vip-membership-refund-requested:{outRefundNo}`，payload 包含金额、中心用户、客户空间、支付订单号、退款单号、退款原因、退款金额和微信交易号。
- 退款申请响应会返回 `outboxEventQueued` 和可选 `outboxEventId`，用于灰度核对退款申请落库与 outbox 写入状态。
- 本批仍不请求微信退款、不验签、不解密、不撤销会员权益、不修改组织开通状态、不执行退款对账或权益回滚 worker；默认不开启 outbox 业务事件写入。

第九十三批工作说明：

- 微信退款通知本地更新 `vip_membership_refund` 成功后，可按 `KAFKA_OUTBOX_EVENT_WRITE_ENABLED=true` 写入 `vip.membership.refund.notified` outbox 事件。
- 事件 topic 仍为 `magic.vip-membership.refund`，幂等键为 `vip-membership-refund-notified:{outRefundNo}`，payload 包含金额、中心用户、客户空间、支付订单号、退款单号、退款金额、微信退款单号和退款状态。
- 服务层结果会返回 `refundSnapshotUpdated`、`outboxEventQueued` 和可选 `outboxEventId`，用于灰度核对退款回调落库与 outbox 写入状态；Controller 仍按微信要求返回原生 `SUCCESS`。
- 本批仍不验签、不解密、不撤销会员权益、不修改组织开通状态、不执行退款对账或权益回滚 worker；默认不开启 outbox 业务事件写入。

第九十四批工作说明：

- 组织空间开通 `failed_manual` 任务在 `execute=true` 且确认串匹配、状态成功重置为 `pending` 后，可按 `KAFKA_OUTBOX_EVENT_WRITE_ENABLED=true` 写入 `organization.provisioning.requeued` outbox 事件。
- 事件 topic 为 `magic.organization.provisioning`，幂等键为 `organization-provisioning-requeued:{jobId}:{requeuedAt}`，payload 包含任务 id、发起人、支付订单号、操作人、原状态、重排时间、源客户空间、组织 id、目标客户空间、目标库名、状态和步骤。
- 重排响应会返回 `outboxEventQueued` 和可选 `outboxEventId`，用于灰度核对人工重排和 outbox 写入状态；预览模式不写 outbox。
- 本批仍不执行跨租户建库、不初始化目标库菜单/角色/成员、不创建 customer、不消费事件、不启动 XXL-Job worker；默认不开启 outbox 业务事件写入。

第九十五批工作说明：

- Kafka outbox 入库已加固幂等：`event_outbox.idempotency_key` 唯一键冲突时，会按幂等键查询并返回已有 `event_id`。
- 这能避免支付通知、退款通知、退款申请或组织开通重排等业务事件重复提交时，让已开启 outbox 的接口因为重复键失败。
- 本批只处理重复事件的幂等返回，不修改 dispatcher 派发状态机、不新增数据库迁移；如果唯一键冲突后查不回原事件，仍抛出 `DuplicateKeyException` 以暴露异常状态。

第九十六批工作说明：

- `organizationProvisioningJob` 已从占位升级为只读扫描中心库 `tenant_provisioning_job` 候选任务。
- 扫描范围为 `pending/failed_retryable` 且 `source_customer_id='public'` 的任务，返回 `items/total/readyCount/tableReady/requestedLimit`。
- 缺少 `targetCustomerId/targetDbName/sourceOrgId/initiatorCenterUserId` 的任务会标记 `ready=false` 和 `blockedReason`，便于执行前先修数据。
- 本批不加锁、不更新任务状态、不建目标库、不初始化菜单/角色/成员、不消费 Kafka 事件；即使传 `execute=true`，返回状态也只是 `scan-only` 且 `executionSupported=false`。

第九十七批工作说明：

- `vipMembershipRefundReconcileJob` 已从占位升级为只读扫描中心库 `vip_membership_refund` 候选退款单。
- 扫描范围为 `next_check_at IS NULL OR next_check_at <= NOW()` 且状态非 `ABNORMAL/CLOSED/SUCCESS` 的退款，返回 `items/total/readyCount/tableReady/requestedLimit`。
- 缺少 `outRefundNo/outTradeNo/customerId/centerUserId/amountTotal/refundAmount/status` 的退款单会标记 `ready=false` 和 `blockedReason`，便于真实对账前先修数据。
- 本批不请求微信退款查询或创建接口、不更新 `vip_membership_refund`、不撤销会员权益、不修改组织开通任务、不消费 Kafka/RabbitMQ；即使传 `execute=true`，返回状态也只是 `scan-only` 且 `executionSupported=false`。

第九十八批工作说明：

- `GET /api/wechat/pay/app/config` 已对齐旧接口语义，返回 `appId/mchId/configured/missing`，缺微信支付配置时不再直接 500。
- `vipMembershipRefundReconcileJob` 返回值增加 `wechatPayConfigured/wechatPayMissing`，真实退款对账执行前可先确认微信支付环境变量和密钥文件路径是否齐全。
- 本批只读取环境变量和本地密钥文件是否存在，不读取或返回密钥内容，不发起微信签名请求，不创建微信退款，不更新 `vip_membership_refund`，不消费 Kafka/RabbitMQ。

第九十九批工作说明：

- `vipMembershipRefundReconcileJob` 每个候选退款单会输出 `plannedAction`，用于说明真实执行时应走 `query_wechat_refund` 还是 `query_then_create_wechat_refund`。
- `PENDING/PROCESSING` 退款计划为只查微信退款状态；其它非终态退款计划为先查单、查不到再创建微信退款。
- 微信支付配置不完整时，候选项会标记 `ready=false`、`executionBlockedReason=微信支付配置不完整` 并附带 `wechatPayMissing`。
- 本批仍不请求微信、不更新退款状态、不撤销会员权益、不写 outbox、不消费 Kafka/RabbitMQ；只是把下一步真实执行的动作计划和阻塞原因显式化。

第一百批工作说明：

- `GET /api/wechat/pay/app/config` 返回新增 `signingReady/signingMissing`，用于离线检查微信支付签名材料是否可解析。
- 私钥检查覆盖 `WECHAT_PAY_PRIVATE_KEY` 和 `WECHAT_PAY_PRIVATE_KEY_PATH`，要求是可解析的 PKCS#8 RSA 私钥。
- 配置微信支付公钥时，会检查 `WECHAT_PAY_PUBLIC_KEY` 或 `WECHAT_PAY_PUBLIC_KEY_PATH` 是否为可解析的 X.509 RSA 公钥。
- 本批不生成 Authorization、不签名真实请求、不请求微信、不返回密钥内容、不创建退款、不更新退款状态；只返回安全的缺失项名称。

第一百零一批工作说明：

- 新增 `WechatPaySigningService`，按微信支付 v3 规则构造签名串并生成 Authorization 头。
- 新增 `WechatPayPemSupport`，配置体检和签名生成复用同一套 PEM 解析逻辑。
- 本批不新增 HTTP 路由、不发起微信请求、不提交预下单或退款、不处理响应验签、不写数据库。
- 单元测试只用本地 RSA key 验证签名可被公钥校验，并确认 Authorization 不包含私钥内容。

第一百零二批工作说明：

- 新增 `WechatPaySignatureVerificationService`，按微信支付回包/回调规则构造 `timestamp\nnonce\nbody\n` 验签消息。
- 验签使用 `WECHAT_PAY_PUBLIC_KEY` 或 `WECHAT_PAY_PUBLIC_KEY_PATH` 配置的本地公钥，并要求请求头序列号匹配 `WECHAT_PAY_PUBLIC_KEY_ID`。
- 本批不拉取微信平台证书、不发起网络请求、不接入 Controller、不验签真实生产回调、不解密 `resource`、不写数据库。
- 单元测试覆盖合法签名、错误签名和公钥序列号不匹配。

第一百零三批工作说明：

- `POST /api/wechat/pay/notify` 和 `POST /api/wechat/pay/refund-notify` 增加微信支付通知验签灰度开关。
- 默认 `WECHAT_PAY_NOTIFY_SIGNATURE_VERIFY_ENABLED=false`，现有本地 ACK 兼容逻辑不变。
- 开启后读取 `Wechatpay-Serial/Timestamp/Nonce/Signature` 头，先调用 `WechatPaySignatureVerificationService` 离线验签，验签通过后才继续本地快照更新和 outbox 写入。
- 无效签名会在写库前中断，并返回微信回调原生 `FAIL` 结构；本批不拉平台证书、不解密 `resource`、不请求微信查单或退款。

第一百零四批工作说明：

- 新增 `WechatPayNotificationDecryptService`，按微信支付 `AEAD_AES_256_GCM` 规则离线解密回调 `resource`。
- 解密只使用本地 `WECHAT_PAY_API_V3_KEY`，要求 API v3 key 为 32 字节，并返回明文 JSON 和解析后的业务字段。
- 本批不接入 Controller、不改变支付/退款通知写库路径、不请求微信、不拉平台证书、不发放或撤销会员权益。
- 单元测试覆盖本地 AES-GCM 解密、算法拒绝和 API v3 key 长度校验。

第一百零五批工作说明：

- `POST /api/wechat/pay/notify` 和 `POST /api/wechat/pay/refund-notify` 增加 `resource` 解密灰度开关。
- 默认 `WECHAT_PAY_NOTIFY_RESOURCE_DECRYPT_ENABLED=false`，现有明文 mock/body 兼容逻辑不变。
- 开启后先调用 `WechatPayNotificationDecryptService` 解密 `resource`，再按现有本地快照和 outbox 逻辑处理解密后的业务字段。
- 响应结果增加 `resourceDecrypted`，用于灰度核对是否走了真实微信加密回包路径；本批不请求微信、不执行查单/退款外呼、不发放或撤销会员权益。

第一百零六批工作说明：

- `GET /api/wechat/pay/app/config` 新增 `notifyReady`、`notifyMissing`、`notifySignatureVerifyEnabled` 和 `notifyResourceDecryptEnabled`。
- 体检覆盖回调验签开关、回调解密开关、公钥 ID、公钥可解析性和 32 字节 `WECHAT_PAY_API_V3_KEY`。
- 本批只读取环境变量和本地密钥文件解析状态，不返回密钥内容。
- 本批不改变支付/退款通知处理逻辑、不请求微信、不执行查单/退款外呼、不发放或撤销会员权益。

第一百零七批工作说明：

- 新增 `WechatPayRefundQueryRequestFactory`，离线构造微信支付退款查询请求材料。
- 请求 path 为 `GET /v3/refund/domestic/refunds/{out_refund_no}`，会对 `outRefundNo` 做 path segment 编码。
- 请求材料包含 headers、空 body、签名串和 Authorization，复用 `WechatPaySigningService`。
- 本批不发起 HTTP 请求、不验签响应、不更新 `vip_membership_refund`、不创建退款、不撤销会员权益。

第一百零八批工作说明：

- 新增 `WechatPayRefundCreateRequestFactory`，离线构造微信支付退款创建请求材料。
- 请求 path 为 `POST /v3/refund/domestic/refunds`，请求体包含微信要求的退款单号、订单号或微信支付单号、退款金额、订单总金额和币种。
- `transactionId` 存在时生成 `transaction_id`，否则使用 `out_trade_no`；可选写入 `reason` 和 `notify_url`，默认币种为 `CNY`。
- 请求材料包含 headers、JSON body、签名串和 Authorization，复用 `WechatPaySigningService`。
- 本批不发起 HTTP 请求、不验签响应、不更新 `vip_membership_refund`、不写 outbox、不创建真实退款、不撤销会员权益。

第一百零九批工作说明：

- 新增 `WechatPayRefundResponseMapper`，离线解析微信支付退款查询或创建响应。
- 支持原始 JSON body 和已反序列化 Map，提取 `out_refund_no`、`refund_id`、`out_trade_no`、`transaction_id`、`status`、`success_time` 和 `amount`。
- 保留微信原始状态 `providerStatus`，同时输出本地可写回状态 `localStatus`；未知状态会显式归为 `UNKNOWN`，避免静默写入错误状态。
- 金额字段支持数字或数字字符串，非法金额会直接抛出业务异常。
- 本批不发起 HTTP 请求、不验签响应、不更新 `vip_membership_refund`、不写 outbox、不撤销会员权益。

第一百一十批工作说明：

- `vipMembershipRefundReconcileJob` 增加退款请求 dry-run 预览。
- 微信支付配置完整且候选退款单预检通过时，`query_wechat_refund` 会输出退款查询请求预览；`query_then_create_wechat_refund` 会输出退款查询和退款创建两步请求预览。
- 预览字段包括 method、path、body、脱敏 headers 和 `authorizationRedacted=true`。
- Authorization 原文和签名不会出现在 job 返回值中，统一显示为 `[redacted]`。
- 本批不发起 HTTP 请求、不验签响应、不更新 `vip_membership_refund`、不写 outbox、不撤销会员权益；候选项 `ready=false` 时不会生成请求预览。

第一百一十一批工作说明：

- 新增 `WechatPayHttpClient`，作为微信支付外部 HTTP 调用的安全门。
- 默认 `WECHAT_PAY_EXTERNAL_HTTP_ENABLED=false`，调用会直接返回业务异常，不触发底层 transport。
- 开启后使用 `WECHAT_PAY_API_BASE_URL`，未配置则默认 `https://api.mch.weixin.qq.com`，且只接受 `/v3/` 路径和 `GET/POST` 方法。
- 当前支持退款查询请求材料和退款创建请求材料，返回 HTTP status、原始 body 和响应 headers。
- 本批不接入退款对账 worker 真实执行、不验签响应、不解析业务响应、不更新 `vip_membership_refund`、不写 outbox、不撤销会员权益。

第一百一十二批工作说明：

- 新增 `WechatPayHttpResponseVerificationService`，作为微信支付 HTTP 回包验签门面。
- 从响应 headers 中读取 `Wechatpay-Serial`、`Wechatpay-Timestamp`、`Wechatpay-Nonce` 和 `Wechatpay-Signature`，响应头匹配忽略大小写。
- 复用 `WechatPaySignatureVerificationService`，按微信支付规则校验 `timestamp\nnonce\nbody\n`。
- 验签失败或缺少签名头会直接抛出业务异常，避免后续 worker 静默解析不可信响应。
- 本批不接入 HTTP client 自动验签、不接入退款对账 worker 真实执行、不请求微信、不解析业务响应、不更新 `vip_membership_refund`、不写 outbox、不撤销会员权益。

第一百一十三批工作说明：

- 新增 `WechatPayRefundRemoteService`，串联退款查询/创建请求构造、`WechatPayHttpClient`、HTTP 回包验签和退款响应解析。
- `queryRefund(outRefundNo)` 返回请求方法、路径、HTTP 状态、验签摘要和解析后的退款响应；`createRefund(command)` 使用同一条可信响应处理链路。
- 微信响应签名校验通过后才检查 HTTP 状态并解析业务字段；非 2xx 会抛出 `BAD_GATEWAY`，避免把微信错误响应误当退款结果写入。
- 本批仍不接入 `vipMembershipRefundReconcileJob`，不更新 `vip_membership_refund`，不写 outbox，不撤销会员权益，不默认开启真实外呼。

第一百一十四批工作说明：

- `vipMembershipRefundReconcileJob` 增加显式远程查单开关：只有 XXL-Job 参数同时满足 `execute=true` 和 `remoteQuery=true` 时，才会对预检通过且微信配置完整的候选退款单调用 `WechatPayRefundRemoteService.queryRefund(outRefundNo)`。
- Job 返回值新增 `remoteQuerySupported`、`remoteQueryRequested`、`remoteQueryEnabled` 和 `remoteQueryAttempted/remoteQueryStatus/remoteQueryResult`，用于灰度核对远程查单是否执行以及微信返回的可信退款状态。
- `remoteQueryResult` 只返回 method、path、HTTP 状态、验签摘要和退款业务字段，不返回 Authorization、签名原文或验签 message。
- 本批只执行远程查询，不调用 `createRefund`，不更新 `vip_membership_refund`，不写 outbox，不撤销会员权益；远程查询失败只记录到单条候选项，不中断整批扫描。

第一百一十五批工作说明：

- `vipMembershipRefundReconcileJob` 在远程查单成功后新增 `localWriteBackPreview`，用于预览下一批可能写入 `vip_membership_refund` 的字段。
- 预览内容包括目标表、where 条件、微信状态、本地状态、是否终态、是否需要后续权益撤销，以及 `refund_id/status/success_at/last_checked_at/next_check_at/provider_raw/update_time` 的写回决策。
- 对齐旧端规则：`SUCCESS/CLOSED/ABNORMAL` 为终态并清空 `next_check_at`；`PROCESSING/PENDING/UNKNOWN` 等非终态保留 60 秒后复查；只有 `SUCCESS` 才标记后续权益撤销。
- 本批仍然 `writeEnabled=false`，不执行 SQL，不更新退款表，不撤销权益，不写 outbox，不创建退款。

第一百一十六批工作说明：

- 新增 `VipMembershipRefundWriteBackService`，用于把已验签、已解析的微信退款查询结果写回 `vip_membership_refund` 快照。
- `vipMembershipRefundReconcileJob` 增加第三道显式开关：只有同时满足 `execute=true`、`remoteQuery=true`、`writeBack=true` 且微信配置完整时，才会在远程查单成功后调用本地写回。
- 写回字段限制为 `refund_id/status/success_at/last_checked_at/next_check_at/provider_raw/update_time`，并对齐旧端 60 秒复查和终态清空 `next_check_at` 规则。
- 本批不调用 `createRefund`，不撤销会员权益，不写 outbox，不修改组织开通任务；`SUCCESS` 只返回 `entitlementRevokeRequired=true` 和 `entitlementRevokeExecuted=false`，后续权益回滚单独批次处理。

第一百一十七批工作说明：

- 新增 `VipMembershipEntitlementRollbackPreviewService`，用于预览退款 `SUCCESS` 后旧端 `revokeVipMembershipForRefundWithClient` 会处理的权益回滚动作。
- `vipMembershipRefundReconcileJob` 增加 `entitlementRollbackPreview=true` 显式开关；只有同时满足 `execute=true`、`remoteQuery=true`、微信配置完整且远程退款状态为 `SUCCESS` 时，才会读取支付单、权益流水和会员汇总并返回预览。
- 预览内容包括客户锁定目标、`vip_membership_payment.trade_state=REFUND`、`vip_membership_entitlement.status=refunded/refunded_at/refunded_out_refund_no`、以及 `vip_membership` 汇总将如何按剩余有效权益重算。
- 本批仍然 `writeEnabled=false`，不更新 `vip_membership_payment`、不更新 `vip_membership_entitlement`、不同步 `vip_membership`、不写 outbox、不修改组织开通任务；真实权益回滚执行继续单独批次处理。

第一百一十八批工作说明：

- `VipMembershipEntitlementRollbackPreviewService` 新增 `rollback(...)` 真实执行方法，按旧端顺序锁定 `customer` 行、更新 `vip_membership_payment.trade_state=REFUND`、把目标 `vip_membership_entitlement` 标记为 `refunded`，并按剩余 active 权益重算 `vip_membership` 汇总。
- `vipMembershipRefundReconcileJob` 增加第四道显式开关：只有同时满足 `execute=true`、`remoteQuery=true`、`writeBack=true`、`entitlementRollback=true`，且本地退款写回成功后，才会执行会员权益回滚。
- 本批增加幂等保护：权益已是 `refunded` 时返回 `alreadyRevoked=true` 并跳过重复写；权益状态不是 `active` 或客户空间不一致时直接失败，要求重新对账或人工核对。
- 本批仍不调用 `createRefund`，不写 outbox，不修改组织开通任务，不触发 Kafka/RabbitMQ；真实库联调前必须先用小 limit 和单条退款单灰度验证。

第一百一十九批工作说明：

- 新增 `OrganizationProvisioningJobClaimService`，用于复刻旧 `claimNextProvisioningJob()` 的认领阶段。
- `organizationProvisioningJob` 增加 `claim=true` 显式开关；只有同时满足 `execute=true`、`claim=true` 时，才会抢占 `tenant_provisioning_job` 候选任务。
- 候选范围为 `pending/failed_retryable`，或 heartbeat 已超过 `staleAfterMs` 的 `provisioning` 任务；每次最多认领 10 条，默认 `staleAfterMs=600000`、`maxRetry=5`。
- 认领只把任务更新为 `status='provisioning'`、`step='claimed'`，写入 `lock_owner/locked_at/heartbeat_at/started_at/update_time` 并清空 `error_message`。
- 本批不创建目标租户库、不复制 schema/data、不初始化菜单/角色/成员、不切换组织成员、不标记 complete/failed、不写 outbox、不消费 Kafka/RabbitMQ。

第一百二十批工作说明：

- 新增 `OrganizationProvisioningJobPreflightService`，用于复刻旧组织开通 worker 进入真实执行前的安全检查。
- `organizationProvisioningJob` 增加 `preflight=true` 显式开关；只有同时满足 `execute=true`、`preflight=true` 时，才会读取 `status='provisioning'`、`step='claimed'` 的已认领任务并输出预检结果。
- 预检输出中心库表状态、发起人状态、source organization、owner 身份、active 成员切换风险、目标库名安全性和后续 plannedSteps。
- 预检支持 `jobId` 和 `workerId` 过滤，便于灰度时只检查刚认领的单条任务。
- 本批只读中心库和配置，不更新任务心跳或 step，不建库、不复制 schema/data、不初始化菜单/角色/成员、不切换中心用户或 refresh token、不标记 complete/failed、不写 outbox、不消费 Kafka/RabbitMQ。

第一百二十一批工作说明：

- 新增 `OrganizationProvisioningJobHeartbeatService`，用于复刻旧 `updateJobHeartbeat(job)` 的租约续租阶段。
- `organizationProvisioningJob` 增加 `heartbeat=true` 显式开关；只有同时满足 `execute=true`、`heartbeat=true` 时，才会按 `jobId + workerId` 刷新 `tenant_provisioning_job.heartbeat_at`。
- 心跳续租对齐旧 worker 的乐观条件：`id = ?`、`lock_owner = ?`、`status = 'provisioning'`；更新字段仅限 `heartbeat_at` 和 `update_time`。
- 返回 `heartbeatStatus=success|lease_lost|table_not_ready`、`leaseValid`、`updatedRows`、`tableReady`，便于灰度时判断租约是否还属于当前 worker。
- 本批不更新 `step`，不建库、不复制 schema/data、不初始化菜单/角色/成员、不切换中心用户或 refresh token、不标记 complete/failed、不写 outbox、不消费 Kafka/RabbitMQ。

第一百二十二批工作说明：

- 新增 `OrganizationProvisioningJobStepService`，用于复刻旧 `updateJobStep(job, 'rebuilding_database')` 的步骤推进。
- `organizationProvisioningJob` 增加 `markRebuildingDatabase=true` 显式开关；只有同时满足 `execute=true`、`markRebuildingDatabase=true`、有效 `jobId` 和 `workerId` 时，才会把任务从 `claimed` 推进到 `rebuilding_database`。
- 步骤推进 SQL 只更新 `error_message=NULL`、`heartbeat_at`、`step='rebuilding_database'`、`update_time`，乐观条件为 `id + lock_owner + status='provisioning' + step='claimed'`。
- 返回 `stepStatus=success|lease_lost|table_not_ready`、`fromStep=claimed`、`targetStep=rebuilding_database`、`leaseValid`、`updatedRows`、`tableReady`，用于灰度观察是否具备进入下一批建库动作的租约。
- 本批不执行 `DROP DATABASE`、`CREATE DATABASE`、schema clone、基础数据复制、组织角色/成员迁移、中心用户切换、complete/failed 状态流转、outbox 写入或 Kafka/RabbitMQ 消费。

第一百二十三批工作说明：

- 新增 `OrganizationProvisioningDatabaseRebuildPlanService`，用于复刻旧 worker `rebuildTargetDatabase(...)` 前的目标库安全校验和 DDL 计划生成。
- `organizationProvisioningJob` 增加 `previewRebuildDatabase=true` 显式开关；只有同时满足 `execute=true`、`previewRebuildDatabase=true`、有效 `jobId` 和 `workerId` 时，才会读取 `status='provisioning'`、`step='rebuilding_database'` 且租约仍属于当前 worker 的任务。
- 预览会校验 `sourceCustomerId=public`、目标租户不是 `public`、`targetDbName` 只包含 `\w` 且长度不超过 100、目标库不在中心库/默认租户库/public 库/系统库/默认客户库保护名单内，并确认目标租户 JDBC 配置可解析。
- 返回 `planStatus=ready|blocked|lease_lost|table_not_ready`、`blockedReasons`、脱敏后的目标/admin JDBC 预览、`executeDdl=false`、`nextExplicitSwitch=executeRebuildDatabase` 和两条 `ddlPreview`：`DROP DATABASE IF EXISTS`、`CREATE DATABASE ... CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`。
- 本批只读中心库任务和配置，不打开目标库连接，不执行 `DROP DATABASE`、`CREATE DATABASE`、schema clone、基础数据复制、组织角色/成员迁移、中心用户切换、任务完成/失败流转、outbox 写入或 Kafka/RabbitMQ 消费。

第一百二十四批工作说明：

- 新增 `OrganizationProvisioningDatabaseAdminClient` 和 JDBC 实现，用不指定 database 的 admin 连接执行旧 worker 的目标库重建 DDL。
- `organizationProvisioningJob` 增加 `executeRebuildDatabase=true` 强显式开关；只有同时满足 `execute=true`、`executeRebuildDatabase=true`、有效 `jobId`、`workerId`，且 `confirmTargetDbName` 与任务 `targetDbName` 完全一致时才会执行。
- 执行前会复用第一百二十三批的租约和安全预检：任务必须仍是当前 worker 持有的 `status='provisioning'`、`step='rebuilding_database'`，目标库名必须通过保护名单校验。
- 执行内容仅限两条 DDL：`DROP DATABASE IF EXISTS \`targetDbName\``和`CREATE DATABASE \`targetDbName\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`；执行后只刷新当前任务的 `heartbeat_at/update_time`。
- 返回 `rebuildStatus=success|blocked|lease_lost|table_not_ready`、`ddlExecuted`、`heartbeatUpdatedRows`、`schemaCloneStarted=false` 和 `nextExplicitSwitch=markCloningSchema`。
- 本批不推进 `step=cloning_schema`，不 clone schema，不复制基础数据，不迁移组织角色/成员，不切换中心用户，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ。

第一百二十五批工作说明：

- `OrganizationProvisioningJobStepService` 扩展 `markCloningSchema(...)`，用于复刻旧 worker 在目标库重建完成后调用 `updateJobStep(job, 'cloning_schema')` 的步骤推进。
- `organizationProvisioningJob` 增加 `markCloningSchema=true` 显式开关；只有同时满足 `execute=true`、`markCloningSchema=true`、有效 `jobId` 和 `workerId` 时，才会把任务从 `rebuilding_database` 推进到 `cloning_schema`。
- 步骤推进 SQL 只更新 `error_message=NULL`、`heartbeat_at`、`step='cloning_schema'`、`update_time`，乐观条件为 `id + lock_owner + status='provisioning' + step='rebuilding_database'`。
- 返回 `stepStatus=success|lease_lost|table_not_ready`、`fromStep=rebuilding_database`、`targetStep=cloning_schema`、`leaseValid`、`updatedRows`、`tableReady`，用于灰度观察目标库重建后的租约是否仍可进入 schema clone。
- 本批不执行 `SHOW CREATE TABLE`、不建表、不复制索引、不复制基础数据、不迁移组织角色/成员、不切换中心用户、不标记 complete/failed、不写 outbox、不消费 Kafka/RabbitMQ。

第一百二十六批工作说明：

- 新增 `OrganizationProvisioningSchemaMetadataClient`、JDBC 实现和 `OrganizationProvisioningSchemaClonePlanService`，用于预览旧 worker `cloneSchemaFromTemplate(...)` 的 schema clone 建表计划。
- `organizationProvisioningJob` 增加 `previewSchemaClone=true` 显式开关；只有同时满足 `execute=true`、`previewSchemaClone=true`、有效 `jobId` 和 `workerId` 时，才会读取当前 worker 持有的 `status='provisioning'`、`step='cloning_schema'` 任务。
- 预览会连接 public 模板库读取基础表列表和 `SHOW CREATE TABLE`，将源 SQL 改写为 `CREATE TABLE IF NOT EXISTS \`tableName\``，并移除表级 `AUTO_INCREMENT=数字`；`schemaTableLimit` 用于限制本次返回的表数量，默认 20，最大 200。
- 返回 `schemaCloneStatus=ready|blocked|lease_lost|table_not_ready`、`tablePlans`、`previewedTableCount`、`totalBaseTableCount`、`limited`、脱敏后的模板/目标 JDBC 预览、`executeDdl=false`、`targetDdlExecuted=false` 和 `nextExplicitSwitch=executeSchemaClone`。
- 本批不连接目标库、不执行 `SET FOREIGN_KEY_CHECKS`、不执行 `CREATE TABLE`、不刷新 heartbeat、不推进 `step=seeding_base_data`、不复制基础数据、不迁移组织角色/成员、不切换中心用户、不写 outbox、不消费 Kafka/RabbitMQ。

第一百二十七批工作说明：

- 新增 `OrganizationProvisioningSchemaDdlClient` 和 JDBC 实现，用于在目标租户库执行 schema clone 建表 DDL。
- `organizationProvisioningJob` 增加 `executeSchemaClone=true` 强显式开关；只有同时满足 `execute=true`、`executeSchemaClone=true`、有效 `jobId`、`workerId`，且 `confirmTargetDbName` 与任务 `targetDbName` 完全一致时才会执行。
- 执行前复用第一百二十六批的预览计划：任务必须仍由当前 worker 持有，且处于 `status='provisioning'`、`step='cloning_schema'`；如果 `schemaTableLimit` 小于基础表总数，会拒绝执行部分建表，避免目标库 schema 不完整。
- 执行内容仅限目标库 `SET FOREIGN_KEY_CHECKS = 0`、所有 `CREATE TABLE IF NOT EXISTS ...`、`SET FOREIGN_KEY_CHECKS = 1`；每张表建完后刷新 `tenant_provisioning_job.heartbeat_at/update_time`，租约丢失会立即中断。
- 返回 `schemaCloneStatus=success|blocked|lease_lost|table_not_ready`、`schemaCloneExecuted`、`targetDdlExecuted`、`targetDdlExecutedCount`、`heartbeatUpdatedRows` 和 `nextExplicitSwitch=markSeedingBaseData`。
- 本批不推进 `step=seeding_base_data`，不复制基础数据，不迁移组织角色/成员，不切换中心用户，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ。

第一百二十八批工作说明：

- `OrganizationProvisioningJobStepService` 扩展 `markSeedingBaseData(...)`，用于复刻旧 worker 在 schema clone 完成后调用 `updateJobStep(job, 'seeding_base_data')` 的步骤推进。
- `organizationProvisioningJob` 增加 `markSeedingBaseData=true` 显式开关；只有同时满足 `execute=true`、`markSeedingBaseData=true`、有效 `jobId` 和 `workerId` 时，才会把任务从 `cloning_schema` 推进到 `seeding_base_data`。
- 步骤推进 SQL 只更新 `error_message=NULL`、`heartbeat_at`、`step='seeding_base_data'`、`update_time`，乐观条件为 `id + lock_owner + status='provisioning' + step='cloning_schema'`。
- 返回 `stepStatus=success|lease_lost|table_not_ready`、`fromStep=cloning_schema`、`targetStep=seeding_base_data`、`leaseValid`、`updatedRows`、`tableReady`，用于灰度观察 schema clone 后的租约是否仍可进入基础数据复制。
- 本批不复制 Super 权限闭包，不复制 `app_versions` 等基础表，不复制菜单/角色/成员，不开启事务迁移，不切换中心用户，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ。

第一百二十九批工作说明：

- 新增 `OrganizationProvisioningSuperPermissionClosurePreviewClient`、JDBC 实现和 `OrganizationProvisioningSuperPermissionClosurePlanService`，用于预览旧 worker `copySuperPermissionClosure(...)` 会复制的 Super 权限闭包。
- `organizationProvisioningJob` 增加 `previewSuperPermissionClosure=true` 显式开关；只有同时满足 `execute=true`、`previewSuperPermissionClosure=true`、有效 `jobId` 和 `workerId` 时，才会读取当前 worker 持有的 `status='provisioning'`、`step='seeding_base_data'` 任务。
- 预览只读中心库任务、public 模板库和目标租户库，检查 `role/menu/menu_meta/code/role_menu/role_code` 是否存在，并统计源库 Super 角色、菜单、菜单元数据、权限码、`role_menu`、`role_code` 行数以及目标库现有 Super 权限闭包。
- 返回 `superPermissionClosureStatus=ready|blocked|lease_lost|table_not_ready`、`executeCopy=false`、`targetWriteExecuted=false`、脱敏源/目标 JDBC 信息、`missingSourceTables`、`missingTargetTables`、`sourceSuperClosure`、`targetSuperClosure`、`targetAlreadyHasSuper`、`plannedCopyTables` 和 `nextExplicitSwitch=executeSuperPermissionClosure`。
- 本批不复制 `menu/menu_meta/role/code/role_menu/role_code`，不刷新 heartbeat，不推进 step，不复制 `app_versions` 等基础表，不迁移组织角色/成员，不切换中心用户，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ。

第一百三十批工作说明：

- 新增 `OrganizationProvisioningSuperPermissionClosureCopyClient` 和 JDBC 实现，用于执行旧 worker `copySuperPermissionClosure(...)` 的 Super 权限闭包复制。
- `organizationProvisioningJob` 增加 `executeSuperPermissionClosure=true` 强显式开关；只有同时满足 `execute=true`、`executeSuperPermissionClosure=true`、有效 `jobId`、`workerId`，且 `confirmTargetDbName` 与任务 `targetDbName` 完全一致时才会执行。
- 执行前复用第一百二十九批预览安全门：任务必须仍由当前 worker 持有，且处于 `status='provisioning'`、`step='seeding_base_data'`；public 模板库和目标租户库必须具备 `role/menu/menu_meta/code/role_menu/role_code` 表，源库必须存在 `Super` 角色。
- 复制顺序对齐旧 worker：`menu -> menu_meta -> role(Super,parent_id=null) -> code(按 Super role_code 的 code_id) -> role_menu -> role_code`；目标库期间执行 `SET FOREIGN_KEY_CHECKS = 0/1`，每个复制阶段后刷新 `tenant_provisioning_job.heartbeat_at/update_time`，租约丢失会立即中断。
- 返回 `superPermissionClosureStatus=success|blocked|lease_lost|table_not_ready`、`executeCopy`、`superPermissionClosureCopied`、`targetWriteExecuted`、`heartbeatUpdatedRows`、`copiedTables`、`copyResult` 和 `nextExplicitSwitch=executeBaseDataTables`。
- 本批不推进 step，不复制 `app_versions` 等基础表，不迁移组织角色/成员，不切换中心用户，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ。

第一百三十一批工作说明：

- 新增 `OrganizationProvisioningBaseDataCopyPreviewClient`、JDBC 实现和 `OrganizationProvisioningBaseDataCopyPlanService`，用于预览旧 worker `copyBaseDataTables(...)` 的基础数据复制计划。
- `organizationProvisioningJob` 增加 `previewBaseDataTables=true` 显式开关；只有同时满足 `execute=true`、`previewBaseDataTables=true`、有效 `jobId` 和 `workerId` 时，才会读取当前 worker 持有的 `status='provisioning'`、`step='seeding_base_data'` 任务。
- 当前基础数据复制范围只包含 `app_versions`；预览只读中心库任务、public 模板库和目标租户库，检查源/目标 `app_versions` 表是否存在，并统计源库待复制行数和目标库现有行数。
- 返回 `baseDataCopyStatus=ready|blocked|lease_lost|table_not_ready`、`executeCopy=false`、`targetWriteExecuted=false`、`plannedCopyTables=["app_versions"]`、`missingSourceTables`、`missingTargetTables`、`tablePlans`、脱敏源/目标 JDBC 信息和 `nextExplicitSwitch=executeBaseDataTables`。
- 本批不复制 `app_versions`，不刷新 heartbeat，不推进 step，不迁移组织角色/成员，不切换中心用户，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ。

第一百三十二批工作说明：

- 新增 `OrganizationProvisioningBaseDataCopyClient` 和 JDBC 实现，用于执行旧 worker `copyBaseDataTables(...)` 的基础数据复制。
- `organizationProvisioningJob` 增加 `executeBaseDataTables=true` 强显式开关；只有同时满足 `execute=true`、`executeBaseDataTables=true`、有效 `jobId`、`workerId`，且 `confirmTargetDbName` 与任务 `targetDbName` 完全一致时才会执行。
- 执行前复用第一百三十一批预览安全门：任务必须仍由当前 worker 持有，且处于 `status='provisioning'`、`step='seeding_base_data'`；public 模板库和目标租户库必须具备 `app_versions` 表。
- 复制语义对齐旧 worker：按源/目标交集列读取 `app_versions`，目标库使用 `INSERT ... ON DUPLICATE KEY UPDATE` 或 `INSERT IGNORE`，每个 chunk 写入后刷新 `tenant_provisioning_job.heartbeat_at/update_time`，租约丢失会立即中断。
- 返回 `baseDataCopyStatus=success|blocked|lease_lost|table_not_ready`、`executeCopy`、`baseDataTablesCopied`、`targetWriteExecuted`、`heartbeatUpdatedRows`、`copiedTables`、`copyResult` 和 `nextExplicitSwitch=migrateOrganizationRolesAndMembers`。
- 本批不推进 step，不迁移组织角色/成员，不切换中心用户，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ。

第一百三十三批工作说明：

- 新增 `OrganizationProvisioningRoleMemberMigrationPreviewClient`、JDBC 实现和 `OrganizationProvisioningRoleMemberMigrationPlanService`，用于预览旧 worker `copyOrganizationRoleSnapshot(...)`、`resolveOrganizationMembers(...)` 和成员角色迁移的前置条件。
- `organizationProvisioningJob` 增加 `migrateOrganizationRolesAndMembers=true` 显式开关；当前批次只执行 preview-only，必须同时满足 `execute=true`、有效 `jobId` 和 `workerId`，才会读取当前 worker 持有的 `status='provisioning'`、`step='seeding_base_data'` 任务。
- 预览只读中心库、源租户库和目标租户库：检查中心表、源库 `role/role_code/role_park/user/user_role`、目标库 `role/code/park/role_menu/role_park/role_code/user/user_role/user_code`，并校验组织角色树、active 成员、中心用户状态、source 用户解析和普通成员组织角色绑定。
- 返回 `roleMemberMigrationStatus=ready|blocked|lease_lost|table_not_ready`、`executeMigration=false`、`migrationPreviewOnly=true`、`targetWriteExecuted=false`、`roleSnapshotPlan`、`sourceUserPlans`、`centerMemberPlans`、脱敏源/目标 JDBC 信息和 `nextExplicitSwitch=executeOrganizationRolesAndMembers`。
- 本批不执行目标库事务，不复制 `role/code/park/role_menu/role_park/role_code`，不创建目标用户，不删除或插入 `user_role/user_code`，不迁移用户范围数据，不写 `tenant_provisioning_role_snapshot`，不刷新 heartbeat，不推进 step，不切换中心用户，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ。

第一百三十四批工作说明：

- 新增 `OrganizationProvisioningRoleSnapshotCopyClient` 和 JDBC 实现，用于执行旧 worker `copyOrganizationRoleSnapshot(...)` 覆盖的组织角色快照复制。
- `organizationProvisioningJob` 增加 `executeOrganizationRolesAndMembers=true` 强显式开关；只有同时满足 `execute=true`、有效 `jobId`、`workerId`，且 `confirmTargetDbName` 与任务 `targetDbName` 完全一致时才会执行。
- 执行前复用第一百三十三批预览安全门：任务必须仍由当前 worker 持有，且处于 `status='provisioning'`、`step='seeding_base_data'`；中心库、源租户库和目标租户库的组织角色/成员迁移前置条件必须为 `ready`。
- 当前仅在目标租户库事务内复制角色快照相关表，顺序为 `role -> code -> park -> role_menu -> role_park -> role_code`；复制 `role` 时把 `organization_id` 置空、`scope` 改为 `system`，使用源/目标表交集列和 `ON DUPLICATE KEY UPDATE` 保持幂等，每个 chunk 写入后刷新 `tenant_provisioning_job.heartbeat_at/update_time`，租约丢失会立即中断。
- 返回 `roleMemberMigrationStatus=success|blocked|lease_lost|table_not_ready`、`executeMigration=true`、`migrationPreviewOnly=false`、`roleSnapshotCopied=true`、`organizationMembersMigrated=false`、`targetWriteExecuted=true`、`heartbeatUpdatedRows`、`copiedTables`、`copyResult` 和 `nextExplicitSwitch=executeOrganizationMembers`。
- 尽管开关名沿用 `executeOrganizationRolesAndMembers`，本批不创建目标用户，不删除或插入 `user_role/user_code`，不迁移用户范围数据，不写 `tenant_provisioning_role_snapshot`，不推进 step，不切换中心用户，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ；成员迁移必须继续单独批次灰度。

第一百三十五批工作说明：

- 新增 `OrganizationProvisioningMemberMigrationClient` 和 JDBC 实现，用于执行旧 worker `ensureTargetTenantUser(...)`、`assignOrganizationMemberRoles(...)` 覆盖的组织成员迁移。
- `OrganizationProvisioningRoleMemberMigrationPlanService` 增加 `executeOrganizationMembers(...)`，`organizationProvisioningJob` 增加 `executeOrganizationMembers=true` 强显式开关；只有同时满足 `execute=true`、有效 `jobId`、`workerId`，且 `confirmTargetDbName` 与任务 `targetDbName` 完全一致时才会执行。
- 执行前复用第一百三十三批预览安全门：任务必须仍由当前 worker 持有，且处于 `status='provisioning'`、`step='seeding_base_data'`；中心库、源租户库和目标租户库的组织角色/成员迁移前置条件必须为 `ready`。
- 当前仅在目标租户库事务内创建/更新目标 `user`，按成员角色重建 `user_role`，并从目标库 `role_code -> code` 反查权限编码后重建 `user_code`；每处理一个成员后刷新 `tenant_provisioning_job.heartbeat_at/update_time`，租约丢失会立即中断。
- 返回 `roleMemberMigrationStatus=success|blocked|lease_lost|table_not_ready`、`executeMigration=true`、`migrationPreviewOnly=false`、`memberMigrationExecuted=true`、`organizationMembersMigrated=true`、`targetUsersUpserted`、`userRoleRowsInserted`、`userCodeRowsInserted`、`targetWriteExecuted=true` 和 `nextExplicitSwitch=executeOrganizationUserScopedData`。
- 本批不迁移 `localization/attendances/feedback/leave_application/reimbursement/investment` 等用户范围业务表，不写 `tenant_provisioning_role_snapshot`，不推进 step，不切换中心用户 `customer_type`，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ；用户范围数据复制必须继续单独批次灰度。

第一百三十六批工作说明：

- 新增 `OrganizationProvisioningUserScopedDataMigrationClient` 和 JDBC 实现，用于执行旧 worker `migrateUserScopedData(...)` 覆盖的组织成员用户范围业务数据复制。
- `OrganizationProvisioningRoleMemberMigrationPlanService` 增加 `executeOrganizationUserScopedData(...)`，`organizationProvisioningJob` 增加 `executeOrganizationUserScopedData=true` 强显式开关；只有同时满足 `execute=true`、有效 `jobId`、`workerId`，且 `confirmTargetDbName` 与任务 `targetDbName` 完全一致时才会执行。
- 执行前复用第一百三十三批预览安全门：任务必须仍由当前 worker 持有，且处于 `status='provisioning'`、`step='seeding_base_data'`；中心库、源租户库和目标租户库的组织角色/成员迁移前置条件必须为 `ready`。
- 当前在目标租户库事务内按旧 worker 语义分页复制 `localization/attendances/feedback/leave_application/reimbursement/investment`，并按页补复制依赖 `park/image/reimbursement_image/investment_image`；复制使用源/目标表交集列和 `ON DUPLICATE KEY UPDATE` 保持幂等，每个写入 chunk 后刷新 `tenant_provisioning_job.heartbeat_at/update_time`，租约丢失会立即中断。
- 字段替换对齐旧 worker：`user_id` 改为目标租户用户 id，`customer_id` 改为目标租户 id，`center_user_id` 改为中心用户 id，`audit_user_id` 仅在等于源用户 id 时改为目标用户 id，否则置空；`investment` 仍按用户名/手机号筛选并原样复制。
- 返回 `roleMemberMigrationStatus=success|blocked|lease_lost|table_not_ready`、`executeMigration=true`、`migrationPreviewOnly=false`、`userScopedDataMigrationExecuted=true`、`userScopedDataMigrated=true`、`userScopedRowsCopied`、`userScopedCopiedChunks`、`targetWriteExecuted=true` 和 `nextExplicitSwitch=writeTenantProvisioningRoleSnapshot`。
- 本批不创建目标用户，不重建 `user_role/user_code`，不写 `tenant_provisioning_role_snapshot`，不推进 step，不切换中心用户 `customer_type`，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ；角色快照中心表写入必须继续单独批次灰度。

第一百三十七批工作说明：

- 新增 `OrganizationProvisioningRoleSnapshotCenterWriteClient` 和 JDBC 实现，用于执行旧 worker `saveOrganizationProvisioningRoleSnapshots(...)` 覆盖的中心库角色快照写入。
- `OrganizationProvisioningRoleMemberMigrationPlanService` 增加 `writeTenantProvisioningRoleSnapshot(...)`，`organizationProvisioningJob` 增加 `writeTenantProvisioningRoleSnapshot=true` 强显式开关；只有同时满足 `execute=true`、有效 `jobId`、`workerId`，且 `confirmTargetDbName` 与任务 `targetDbName` 完全一致时才会执行。
- 执行前复用第一百三十三批预览安全门：任务必须仍由当前 worker 持有，且处于 `status='provisioning'`、`step='seeding_base_data'`；中心库、源租户库和目标租户库的组织角色/成员迁移前置条件必须为 `ready`，并单独检查中心库 `tenant_provisioning_role_snapshot` 表存在。
- 当前只在中心库事务内按旧 worker 语义执行 `DELETE FROM tenant_provisioning_role_snapshot WHERE job_id = ?`，再插入当前组织角色快照，字段包括 `job_id/source_org_id/source_role_id/target_role_id/role_name/create_time/update_time`；写入后在同一事务内刷新 `tenant_provisioning_job.heartbeat_at/update_time`，租约丢失会回滚并中断。
- 返回 `roleMemberMigrationStatus=success|blocked|lease_lost|table_not_ready`、`executeMigration=true`、`migrationPreviewOnly=false`、`centerWriteExecuted=true`、`roleSnapshotCenterWriteExecuted=true`、`tenantProvisioningRoleSnapshotWritten=true`、`roleSnapshotRowsDeleted`、`roleSnapshotRowsInserted`、`targetWriteExecuted=false` 和 `nextExplicitSwitch=switchCenterUserToTarget`。
- 本批不写目标租户库，不创建目标用户，不重建 `user_role/user_code`，不迁移用户范围业务表，不推进 step，不切换中心用户 `customer_type`，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ；中心用户租户切换必须继续单独批次灰度。

第一百三十八批工作说明：

- 新增 `OrganizationProvisioningCenterUserSwitchClient` 和 JDBC 实现，用于执行旧 worker `switchCenterUserToTarget(...)` 中任务完成前的中心库租户归属切换。
- `OrganizationProvisioningRoleMemberMigrationPlanService` 增加 `switchCenterUserToTarget(...)`，`organizationProvisioningJob` 增加 `switchCenterUserToTarget=true` 强显式开关；只有同时满足 `execute=true`、有效 `jobId`、`workerId`，且 `confirmTargetDbName` 与任务 `targetDbName` 完全一致时才会执行。
- 执行前复用第一百三十三批预览安全门：任务必须仍由当前 worker 持有，且处于 `status='provisioning'`、`step='seeding_base_data'`；中心库、源租户库和目标租户库的组织角色/成员迁移前置条件必须为 `ready`，并额外要求第一百三十七批已写入当前 job 的 `tenant_provisioning_role_snapshot`。
- 当前只在中心库事务内写 `customer`、`user_tenant_mapping`、`user.customer_type/token_version`、`refresh_token.revoked_at` 和 `organization_tenant_mapping`；目标租户库只用于按中心用户名确认目标 `user.id`，不执行目标库写入。写入后在同一事务内刷新 `tenant_provisioning_job.heartbeat_at/update_time`，租约丢失会回滚并中断。
- 返回 `roleMemberMigrationStatus=success|blocked|lease_lost|table_not_ready`、`executeMigration=true`、`migrationPreviewOnly=false`、`centerSwitchExecuted=true`、`centerUsersSwitched`、`customerRowsAffected`、`userTenantMappingRowsAffected`、`refreshTokenRowsRevoked`、`organizationTenantMappingRowsAffected`、`targetWriteExecuted=false`、`tenantProvisioningCompleted=false` 和 `nextExplicitSwitch=completeTenantProvisioningJob`。
- 本批不写目标租户库，不创建目标用户，不重建 `user_role/user_code`，不迁移用户范围业务表，不推进 step，不标记 complete/failed，不写 outbox，不发布或消费 Kafka/RabbitMQ；任务完成和事件投递必须继续单独批次灰度。

第一百三十九批工作说明：

- 新增 `OrganizationProvisioningJobCompletionService`，用于执行旧 worker `switchCenterUserToTarget(...)` 末尾的 `tenant_provisioning_job` 完成状态收口。
- `organizationProvisioningJob` 增加 `completeTenantProvisioningJob=true` 强显式开关；只有同时满足 `execute=true`、有效 `jobId`、`workerId`，且 `confirmTargetDbName` 与任务 `targetDbName` 完全一致时才会执行。
- 执行前检查中心库 `tenant_provisioning_job/organization_member/organization_tenant_mapping/user_tenant_mapping` 表存在，任务仍由当前 worker 持有且处于 `status='provisioning'`、`step='seeding_base_data'`，并确认 `organization_tenant_mapping` 指向当前 job、所有 active 成员已有目标 `user_tenant_mapping.customer_user_id`。
- 当前只更新中心库 `tenant_provisioning_job`：设置 `completed_at`、清空 `error_message/heartbeat_at/locked_at/lock_owner`、置 `status='active'`、`step='completed'` 和 `update_time`；更新使用 `id + lock_owner + status='provisioning' + step='seeding_base_data'` 乐观条件，租约丢失不会误完成。
- 开启 `KAFKA_OUTBOX_EVENT_WRITE_ENABLED=true` 后，会写入 `organization.provisioning.completed` outbox 事件，topic 为 `magic.organization.provisioning`，幂等键为 `organization-provisioning-completed:{jobId}`；默认关闭时仅返回 `outboxEventQueued=false`。
- 返回 `completionStatus=success|blocked|lease_lost|table_not_ready`、`tenantProvisioningCompleted=true|false`、`updatedRows`、`outboxEventQueued`、可选 `outboxEventId`、完成后的 `status=active` 和 `step=completed`。
- 本批不执行失败标记，不写目标租户库，不创建或切换中心用户，不发布 Kafka、不消费 Kafka/RabbitMQ、不发送通知；失败分支和完成事件消费者继续单独批次灰度。

第一百四十批工作说明：

- 新增 `OrganizationProvisioningJobFailureService`，用于执行旧 worker `markJobFailed(...)` 的失败状态收口。
- `organizationProvisioningJob` 增加 `markTenantProvisioningJobFailed=true` 强显式开关；只有同时满足 `execute=true`、有效 `jobId`、`workerId` 和非空 `failureReason` 时才会执行，`maxRetry` 可选，默认沿用 5。
- 执行前只检查中心库 `tenant_provisioning_job` 表存在，任务仍由当前 worker 持有且处于 `status='provisioning'`；不要求具体 step，保持旧 worker 任意阶段失败均可释放租约的语义。
- 当前只更新中心库 `tenant_provisioning_job`：`retry_count = retry_count + 1`、写入 `error_message`、清空 `heartbeat_at/locked_at/lock_owner`、刷新 `update_time`；当新 retryCount 小于 `maxRetry` 时置 `status='failed_retryable'`、`step='retry_waiting'`，达到或超过时置 `status='failed_manual'`、`step='failed'`。
- 返回 `failureStatus=success|lease_lost|table_not_ready`、`tenantProvisioningFailed`、`failedManual`、`retryable`、`retryCount`、`targetStatus`、`targetStep` 和 `updatedRows`。
- 本批不写 outbox，不发布或消费 Kafka/RabbitMQ，不执行目标库补偿，不删除已创建的目标库、schema 或中心映射；失败后的人工重排仍走已有 `requeue-failed-manual` 入口。

第一百四十一批工作说明：

- 新增 `EventConsumeLogRepository`、`OrganizationProvisioningCompletedConsumerService` 和 `OrganizationProvisioningCompletedKafkaListener`，开始接入 `organization.provisioning.completed` 的消费入口。
- Kafka listener 受 `KAFKA_CONSUMER_ENABLED=false` 默认关闭保护；开启后只监听 `magic.organization.provisioning`，且只把 `organization.provisioning.completed` 交给消费服务，其它组织事件直接跳过。
- 消费服务从 outbox dispatcher 发送的 headers 读取 `eventId/eventType/customerId/idempotencyKey`，从 payload 解析 `jobId/targetCustomerId/targetDbName`，并写中心库 `event_consume_log`；同一 `eventId + consumerGroup` 重复消费会按唯一键幂等跳过。
- 缺少关键 header 时返回 invalid 且不写库；合法 completed 事件 payload 解析失败或缺少 `jobId/targetCustomerId/targetDbName` 时写入 `status=failed` 的消费日志，避免坏消息没有审计。
- 本批只做 Kafka 消费入口、payload 解析和幂等日志，不发送通知，不刷新 Redis 缓存，不发布 RabbitMQ，不修改组织开通任务状态，不写目标租户库；通知、缓存刷新和 RabbitMQ 轻任务继续后续单独批次。

第一百四十二批工作说明：

- 新增 `OrganizationProvisioningCompletedFollowupPublisher`，把 `organization.provisioning.completed` 消费成功后的后续处理转成 RabbitMQ light-task。
- 消费服务从“直接 success 落表”升级为 `event_consume_log.status=processing` 认领；首次认领成功后才投递 RabbitMQ，投递成功再 `markSuccess`，重复成功事件返回 `already_consumed`，正在处理中的重复事件返回 `already_processing`。
- RabbitMQ 轻任务使用 `magic.light-task.queue` 现有拓扑，任务类型为 `organization.provisioning.completed.followup`，幂等键为 `organization-provisioning-completed-followup:{jobId}`，payload 保留原 completed 事件和 `jobId/targetCustomerId/targetDbName`；投递前要求 header `customerId` 与 payload `targetCustomerId` 一致。
- RabbitMQ 投递失败时会把消费日志标记为 `failed` 并抛出异常，交给 Kafka 重试；历史 `failed` 消费日志允许重新认领为 `processing` 后再次投递。
- 本批只投递后续轻任务，不直接发送短信/企微/站内通知，不刷新 Redis 缓存，不修改组织开通任务状态，不写目标租户库；轻任务消费者、通知发送和缓存刷新继续后续单独批次。

第一百四十三批工作说明：

- 新增 `OrganizationProvisioningCompletedFollowupConsumerService` 和 `OrganizationProvisioningCompletedFollowupRabbitListener`，开始接入 RabbitMQ light-task 的 followup 消费骨架。
- RabbitMQ listener 受 `RABBITMQ_CONSUMER_ENABLED=false` 默认关闭保护；开启后只监听 `magic.light-task.queue`，且只处理 `taskType=organization.provisioning.completed.followup`，其它轻任务直接跳过。
- 当前 followup 消费只解析 `jobId/targetCustomerId/targetDbName` 并写 `event_consume_log` 幂等日志，consumerGroup 为 `rabbit-light-task-organization-provisioning-followup`，eventType 为 `rabbit.organization.provisioning.completed.followup`。
- 消费幂等 eventId 优先取 RabbitMQ header `eventId`，缺失时用 messageId 兜底；缺少 eventId/messageId 或 idempotencyKey 时返回 invalid 且不写库，payload 解析失败或缺少关键字段时写 `failed`。
- 本批不发送短信/企微/站内通知，不刷新 Redis 缓存，不修改组织开通任务状态，不写目标租户库；真正通知、缓存刷新和补偿动作继续后续单独批次。

第一百四十四批工作说明：

- 新增 `OrganizationProvisioningCompletedNotificationPlanService`，用于在 RabbitMQ followup 首次消费成功后生成组织开通完成通知计划。
- followup 消费结果新增 `notificationPlan` 和 `notificationPlanGenerated`；首次写入 `event_consume_log.status=success` 后返回 `planStatus=preview_only` 的结构化计划，重复消费直接返回 duplicate 且不重复生成计划。
- 通知计划包含 `in_app/wechat_work/sms` 三类渠道预案、`magic.notification.queue` 目标队列、通知幂等键 `organization-provisioning-completed-notification:{jobId}` 和下一步显式开关 `publishOrganizationProvisioningCompletedNotification`。
- 当前计划中 `sendEnabled=false`、`rabbitNotificationPublishEnabled=false`、`redisRefreshEnabled=false`，只作为后续真实通知投递和 Redis 刷新前的可验收计划。
- 本批不调用 `RabbitMessagePublisher.publishNotification(...)`，不发送短信/企微/站内通知，不解析真实收件人，不刷新 Redis 缓存，不修改组织开通任务状态，不写目标租户库。

第一百四十五批工作说明：

- 新增 `OrganizationProvisioningCompletedRedisRefreshPlanService`，用于在 RabbitMQ followup 首次消费成功后生成组织开通完成 Redis 刷新计划。
- followup 消费结果新增 `redisRefreshPlan` 和 `redisRefreshPlanGenerated`；首次写入 `event_consume_log.status=success` 后同时返回通知计划和 Redis 刷新计划，重复消费直接返回 duplicate 且不重复生成计划。
- Redis 计划只列出当前 Spring Boot 已使用的缓存前缀：`tenant:{targetCustomerId}:route-menus:`、`system-menu-list:`、`parent-role-menus:`、`permission-codes:` 和 `user-info:`。
- 当前计划中 `refreshEnabled=false`、`redisWriteEnabled=false`、`cacheEvictEnabled=false`，下一步显式开关为 `refreshOrganizationProvisioningCompletedCaches`。
- 本批不注入 `CacheService`，不调用 `CacheService.evictByPrefix(...)`，不执行 Redis `keys/delete`，不发送通知，不修改组织开通任务状态，不写目标租户库。

第一百四十六批工作说明：

- `AppProperties.RabbitMq` 新增 `notificationPublishEnabled`，配置项为 `RABBITMQ_NOTIFICATION_PUBLISH_ENABLED`，默认 `false`。
- `OrganizationProvisioningCompletedNotificationPlanService` 会把该安全门写入通知计划：`rabbitNotificationPublishEnabled` 表示环境是否允许进入真实投递批次。
- 即使安全门开启，本批仍固定返回 `rabbitNotificationPublishRequested=false`、`rabbitNotificationPublishExecuted=false`、`sendEnabled=false` 和 `providerCallEnabled=false`。
- 安全门关闭时 `blockedReasons=RABBITMQ_NOTIFICATION_PUBLISH_ENABLED 未开启`；安全门开启时仍提示真实收件人解析和 provider 发送未接入。
- 本批不注入 `RabbitMessagePublisher`，不调用 `publishNotification(...)`，不投递 `magic.notification.queue`，不发送短信/企微/站内通知，不刷新 Redis，不修改组织开通任务状态。

第一百四十七批工作说明：

- `OrganizationProvisioningCompletedNotificationPlanService` 新增 `rabbitMessagePreview`，按 `RabbitMessageRequest` 关键字段生成 RabbitMQ 通知消息 dry-run 预览。
- 预览内容包含 `aggregateId/aggregateType/customerId/headers/idempotencyKey/messageId/payload/routingKey/targetExchange/targetQueue`。
- 通知计划新增 `rabbitNotificationDryRun=true` 和 `rabbitMessagePreviewGenerated=true`；消息预览固定 `publishExecuted=false`。
- 预览 payload 只包含 `jobId/targetCustomerId/targetDbName/templateKey/channels/recipientResolution/providerCallEnabled=false`，真实收件人继续延后到发送批次解析。
- 本批不创建 `RabbitMessageRequest` 实例，不注入 `RabbitMessagePublisher`，不调用 `publishNotification(...)`，不投递 RabbitMQ，不发送短信/企微/站内通知，不刷新 Redis，不修改组织开通任务状态。

第一百四十八批工作说明：

- 新增 `OrganizationProvisioningCompletedNotificationPublisher`，把通知计划中的 `rabbitMessagePreview` 转成 `RabbitMessageRequest` 并调用 `RabbitMessagePublisher.publishNotification(...)`。
- RabbitMQ followup 消费从直接成功落表收紧为 `claimProcessing -> buildPlan -> publish/skip -> markSuccess`；计划生成、Redis 计划生成、通知投递或成功落表任一阶段异常，都会先 `markFailure` 再抛出，交给 RabbitMQ/Kafka 重试链路。
- 只有 `RABBITMQ_NOTIFICATION_PUBLISH_ENABLED=true` 且首次认领成功时才投递 `magic.notification.queue`；成功后结果返回 `notificationMessagePublished=true`、`notificationMessageId`、`rabbitNotificationPublishRequested=true`、`rabbitNotificationPublishExecuted=true`，并把 `rabbitMessagePreview.publishExecuted` 标记为 `true`。
- 安全门关闭时仍只生成通知计划和 Redis 刷新计划，并按 `event_consume_log.status=success` 收口；重复成功或正在处理中的 followup 直接返回 duplicate，不重复生成计划或投递通知消息。
- 本批只投递 RabbitMQ notification 队列，不解析真实收件人，不调用短信/企微/站内通知 provider，不刷新 Redis，不修改组织开通任务状态，不写目标租户库。

第一百四十九批工作说明：

- `AppProperties.Redis` 新增 `organizationProvisioningRefreshEnabled`，配置项为 `REDIS_ORGANIZATION_PROVISIONING_REFRESH_ENABLED`，默认 `false`。
- 新增 `OrganizationProvisioningCompletedRedisRefreshExecutor`，只读取 Redis 刷新计划中的 `targetCachePrefixes`，并通过 `CacheService.evictByPrefix(...)` 清理前缀，不直接调用 `RedisTemplate`。
- `OrganizationProvisioningCompletedRedisRefreshPlanService` 会把安全门写入计划：关闭时 `refreshEnabled=false/cacheEvictEnabled=false`，开启时只允许清理 5 个限定前缀：`route-menus`、`system-menu-list`、`parent-role-menus`、`permission-codes`、`user-info`。
- RabbitMQ followup 首次认领成功后，如果 `cacheEvictEnabled=true`，会先执行 Redis 缓存清理，再进入 RabbitMQ notification 投递；成功后 `redisRefreshPlan` 返回 `planStatus=cache_evicted`、`cacheEvictRequested=true`、`cacheEvictExecuted=true` 和 `cacheEvictPrefixCount`。
- 本批只清理组织开通完成相关的限定 Redis 缓存前缀，不执行 Redis 写缓存，不调用短信/企微/站内通知 provider，不修改组织开通任务状态，不写目标租户库。

第一百五十批工作说明：

- 新增 `OrganizationProvisioningCompletedNotificationConsumerService`、`OrganizationProvisioningCompletedNotificationRabbitListener`、notification 消费 request/result，开始接入组织开通完成通知消费骨架。
- 新增独立开关 `RABBITMQ_ORGANIZATION_PROVISIONING_NOTIFICATION_CONSUMER_ENABLED`，默认 `false`；不复用 `RABBITMQ_CONSUMER_ENABLED`，避免误消费登录验证码、合同提醒、催缴短信等共享通知队列消息。
- 消费服务只校验 `eventType=organization.provisioning.completed.notification`、`templateKey=organization_provisioning_completed`、header 幂等键和 payload 中的 `jobId/targetCustomerId/targetDbName`，并写 `event_consume_log` 幂等日志。
- listener 绑定 `magic.notification.queue`，但只允许组织开通完成通知；收到其它通知类型会抛错，让消息进入 RabbitMQ 重试/DLQ 路径，不静默确认。
- 本批不解析真实收件人，不调用短信/企微/站内通知 provider，不投递 retry，不修改组织开通任务状态，不写目标租户库。

第一百五十一批工作说明：

- 新增 `OrganizationProvisioningCompletedNotificationRecipientPlanService`，开始为组织开通完成 notification 消费生成真实收件人解析预览。
- 消费服务在 payload 校验通过、providerCallEnabled=false 后，读取中心库 `tenant_provisioning_job`、`organization_member`、`user`，把解析结果写入 `sendPlan.recipientPlan`；重复消息仍直接 duplicate，不重复解析。
- 收件人预览只保留 `centerUserId/username/realName/memberRole/recipientScope/channels` 和脱敏手机号 `phoneMasked`，并固定 `sendEnabled=false`、`providerCallEnabled=false`。
- 缺少中心库表、找不到开通任务、消息 `targetCustomerId/targetDbName` 与任务不一致、组织没有可发送 active 中心账号时，返回 `recipientResolutionStatus=blocked` 和 `blockedReasons`，但不调用 provider，也不让共享通知队列因预览受阻反复重试。
- 本批只读中心库，不连接目标租户库，不写中心库或租户库，不调用短信/企微/站内通知 provider，不投递 retry，不修改组织开通任务状态。

第一百五十二批工作说明：

- 新增 `OrganizationProvisioningCompletedNotificationProviderPlanService`，基于 `sendPlan.recipientPlan` 生成组织开通完成通知 provider 发送 dry-run 计划。
- 新增独立开关 `RABBITMQ_ORGANIZATION_PROVISIONING_PROVIDER_SEND_ENABLED`，默认 `false`；该开关只表示后续允许进入 provider 发送灰度，本批仍固定 `providerCallRequested=false`、`providerCallExecuted=false`、`sendEnabled=false`。
- notification 消费成功结果新增 `sendPlan.providerPlan` 和 `providerPlanGenerated=true`；计划包含 `in_app/wechat_work/sms` 渠道、每个渠道的幂等键、provider 名称、脱敏收件人预览和阻断原因。
- 当收件人解析 blocked 或没有渠道收件人时，provider 计划返回 `blockedReasons`，但仍保持消费成功和 dry-run，不调用真实 provider，也不让共享通知队列进入重复重试。
- 本批不注入 `SmsService`、企微客户端、站内信写入器或 RabbitMQ publisher，不读写数据库，不投递 retry，不修改组织开通任务状态，不写目标租户库。

第一百五十三批工作说明：

- 新增 `NotificationRoutingPlanService`，先为共享 `magic.notification.queue` 建立通用 notification consumer 的路由 dry-run。
- 当前可识别 `organization_provisioning_completed`、`contract_reminder_sms`、`bill_collection_sms`、`login_sms_code`、`page_access_sms_code` 和 `unknown`；路由只依赖 RabbitMQ headers 与 payload，不读写数据库。
- 路由计划返回 `route`、`routeSupported`、`consumerGroup`、`handlerBean`、`ackStrategy=defer_to_dedicated_consumer`、脱敏 `payloadPreview` 和 `blockedReasons`，便于后续接入通用 listener 前验收消息分类。
- 未知消息固定 `routeSupported=false`，并提示不能由通用 consumer 静默 ack；组织开通完成通知仍返回专用 consumer 单独灰度。
- 本批不新增通用 `@RabbitListener`，不接管共享通知队列，不 ack/nack 消息，不写 `event_consume_log`，不调用短信/企微/站内信 provider，不投递 retry/DLQ。

第一百五十四批工作说明：

- 新增 `NotificationRoutingRabbitListener`，为共享 `magic.notification.queue` 增加通用 notification listener 安全门骨架。
- 新增独立开关 `RABBITMQ_NOTIFICATION_ROUTING_CONSUMER_ENABLED`，默认 `false`；不复用 `RABBITMQ_CONSUMER_ENABLED`，也不复用组织开通专用 consumer 开关。
- listener 开启后只调用 `NotificationRoutingPlanService` 生成路由 dry-run，然后主动抛出 `IllegalStateException`，让 RabbitMQ 不会把消息当作已消费确认。
- 本批不委托任何专用 consumer，不写 `event_consume_log`，不调用短信/企微/站内信 provider，不投递 retry/DLQ，不读写数据库；只是验证通用 listener 的安全门和 no-ack 边界。

第一百五十五批工作说明：

- 新增 `NotificationDispatchPreflightService`，在通用 notification listener 内追加“路由结果 -> 分发预检”dry-run。
- 新增独立开关 `RABBITMQ_NOTIFICATION_DISPATCH_ENABLED`，默认 `false`；只表示允许进入通用分发预检判断，不代表真实 handler 已执行。
- 预检计划返回 `route`、`handlerBean`、`routeSupported`、`handlerReady`、`dispatchEnabled`、`dispatchAllowed`、`dispatchExecuted=false`、`ackStrategy=throw_to_avoid_ack` 和 `blockedReasons`。
- 当前只有 `organization_provisioning_completed` 被标记为已有专用 handler，其它 notification 路由即使识别成功，也会因为 handler 未登记而 `dispatchAllowed=false`。
- listener 即使算出 `dispatchAllowed=true`，本批仍主动抛出异常阻止 ack；不调用任何 handler，不写 `event_consume_log`，不调用短信/企微/站内信 provider，不投递 retry/DLQ，不读写数据库。

第一百五十六批工作说明：

- 新增 `NotificationHandlerAdapterPlanService`，在通用 notification listener 内追加“分发预检 -> 专用 handler adapter 选择与调用计划”dry-run。
- 当前只把 `organization_provisioning_completed` 标记为已有 adapter dry-run 支持，目标 handler 仍是 `organizationProvisioningCompletedNotificationConsumerService`。
- adapter 计划返回 `adapterBean`、`targetHandlerBean`、`adapterSupported`、`adapterSelected`、`adapterInvocationAllowed`、`adapterInvocationRequested=false`、`adapterInvocationExecuted=false`、`requestType` 和 `requestPreview`。
- `requestPreview` 只展示 header 映射、messageId、payload 转发方式和 payload 字节长度，不输出原始 payload，也不构造真实消费结果。
- listener 即使算出 `adapterInvocationAllowed=true`，本批仍主动抛出异常阻止 ack；不调用专用 consumer，不写 `event_consume_log`，不读写数据库，不调用短信/企微/站内信 provider，不投递 retry/DLQ。

第一百五十七批工作说明：

- 新增 `NotificationAdapterRequestValidationPlanService`，在通用 notification listener 内追加“专用 handler adapter -> 请求校验”dry-run。
- 当前只校验 `organization_provisioning_completed`：headers 中的 `eventId/messageId`、`idempotencyKey`、`eventType`、`templateKey`，payload 中的 `jobId`、`targetCustomerId`、`targetDbName`，以及 `providerCallEnabled` 是否被错误打开。
- 校验计划返回 `validationSupported`、`requestValidationPassed`、`requestValidationStatus`、`missingHeaders`、`eventTypeMatched`、`templateKeyMatched`、`payloadParseStatus`、`missingPayloadFields`、`providerCallBlocked` 和脱敏 `payloadPreview`。
- 非组织开通通知 route、缺少必填 headers、payload 不是合法 JSON、缺少必填 payload 字段、`providerCallEnabled=true` 都会被标记为 blocked。
- listener 即使算出 `requestValidationPassed=true`，本批仍主动抛出异常阻止 ack；不构造真实消费结果，不调用专用 consumer，不写 `event_consume_log`，不读写中心库或租户库，不调用短信/企微/站内信 provider，不投递 retry/DLQ。

第一百五十八批工作说明：

- 新增 `NotificationConsumerDelegationPlanService`，在通用 notification listener 内追加“请求校验 -> 专用 consumer 委托前置计划”dry-run。
- 当前只支持 `organization_provisioning_completed`，预览将要构造的 `OrganizationProvisioningCompletedNotificationConsumeRequest` 字段：`eventId`、`idempotencyKey`、`messageId`、`eventType`、`templateKey`、payload 转发方式、payload 字节长度和已校验 payload 摘要。
- 委托计划返回 `consumerBean`、`consumerMethod`、`delegationSupported`、`requestValidationPassed`、`requestTypeMatched`、`delegationAllowed`、`delegationRequested=false`、`delegationExecuted=false`、`requestPreview` 和 `resultPreview`。
- `resultPreview` 只列出 `OrganizationProvisioningCompletedNotificationConsumeResult` 的预期字段、可能状态和仍被延后的副作用，不伪造真实消费结果。
- listener 即使算出 `delegationAllowed=true`，本批仍主动抛出异常阻止 ack；不注入或调用专用 consumer，不写 `event_consume_log`，不读写中心库或租户库，不调用短信/企微/站内信 provider，不投递 retry/DLQ。

第一百五十九批工作说明：

- `AppProperties.RabbitMq` 新增 `notificationConsumerDelegationEnabled` 和 `notificationConsumerDelegationRouteGuard`。
- 新增配置项 `RABBITMQ_NOTIFICATION_CONSUMER_DELEGATION_ENABLED`，默认 `false`；安全门未开启时，委托计划即使前置校验全部通过，也固定 `delegationAllowed=false`。
- 新增配置项 `RABBITMQ_NOTIFICATION_CONSUMER_DELEGATION_ROUTE_GUARD`，默认 `organization_provisioning_completed`；只有 route 与该 guard 完全匹配时才允许进入后续真实委托批次。
- `NotificationConsumerDelegationPlanService` 计划新增 `delegationEnabled`、`routeGuard`、`routeGuardMatched`，并把这些条件纳入 `delegationAllowed`。
- 本批仍不执行真实委托；不注入或调用专用 consumer，不写 `event_consume_log`，不读写中心库或租户库，不调用短信/企微/站内信 provider，不投递 retry/DLQ。

第一百六十批工作说明：

- 新增亿玛表计平台只读兼容模块 `integration/ymsino`，迁移新增的 4 个旧接口：`GET /api/ymsino/waterinfo/data`、`GET /api/ymsino/waterinfo/tree`、`GET /api/ymsino/meterinfo/data`、`GET /api/ymsino/meterinfo/tree`。
- 新增 `YmsinoClient`、`YmsinoService`、`YmsinoController` 和 `YmsinoMeterKind`，保留 token 缓存、401/403 或鉴权失败后刷新重试、`ptId=YZWL` 默认值、`tyDate=今天` 默认值、`TjType` 水电类型过滤、设备树构建、分页、diagnostics/source 响应结构。
- 新增配置 `app.ymsino.*`，通过 `TP_YMSINO_BASE_URL/USERNAME/PASSWORD/ORG_ID/PT_ID/ELECTRIC_TJ_TYPE/WATER_TJ_TYPE/TIMEOUT_MS/REFRESH_LEEWAY_MS` 管理。
- 本批只迁移亿玛只读设备和日冻结数据查询，不迁移余额、充值、实时通断等写操作，不写数据库，不发 Kafka/RabbitMQ，不改旧后端。
- 后续修补：`includeDiagnostics=1` 已按旧端兼容，token 失效重试继续带 `Content-Type: application/json`，`TP_YMSINO_BASE_URL` 末尾带 `/` 时也能安全拼接。

第一百六十一批工作说明：

- 升级 `GET /api/dashboard/meter-statistics` 为合众第三方表计优先、本地账单兜底：读取 `getDevice/getHDMData`，按授权园区名称过滤设备，按日期范围过滤读数，生成 `dayNight/peakValley/waterTrend/summary/source`。
- 新增 `projCode` 查询参数兼容，默认仍为 `241`；补齐 `date=YYYY-MM` 月统计参数解析，避免月统计误落到当前月。
- 合众平台 `BAD_GATEWAY` 类失败时返回本地 `amount_bill/ele_bill/water_bill` 统计并设置 `source=amount_bill_local_fallback`、`message=表计平台响应超时，已返回本地可用统计数据`；非三方网关错误继续抛出，避免吞掉真实代码 bug。
- 本批仍只读，不写数据库，不发 Kafka/RabbitMQ，不新增缓存，不调用合众阀控、实时抄表或回调写入，不改旧后端。

第一百六十二批工作说明：

- 补齐共享 notification 队列到组织开通完成专用 consumer 的真实委托前 dry-run 验收矩阵，仍不执行真实委托。
- `NotificationConsumerDelegationPlanService` 新增 `delegationReadinessMatrix`、`delegationReadinessFailedChecks`、`consumerInvocationMode`、`ackStrategy` 和 `nextAction`，用于灰度时逐项确认 route、请求校验、requestType、安全门、route guard、provider 开关和委托边界。
- 即使 `RABBITMQ_NOTIFICATION_CONSUMER_DELEGATION_ENABLED=true` 且 route guard 匹配，只要 `providerCallEnabled/providerCallBlocked` 出现在上游校验计划里，委托计划仍固定阻断，避免通用 listener 误放开短信/企微/站内信 provider。
- `NotificationRoutingRabbitListener` 抛错信息补充 `failedChecks` 和 `nextAction`，方便 RabbitMQ listener 验收时定位阻断原因。
- 本批不注入或调用专用 consumer，不写 `event_consume_log`，不读写中心库或租户库，不 ack/nack RabbitMQ 消息，不调用短信/企微/站内信 provider，不投递 retry/DLQ。

第一百六十三批工作说明：

- 共享 notification 通用 listener 已接入组织开通完成 notification 的受控真实委托：只有 `delegationAllowed=true`、route guard 匹配、provider 调用关闭且请求校验通过时，才调用 `OrganizationProvisioningCompletedNotificationConsumerService.consume(...)`。
- 委托请求从 RabbitMQ `eventId/idempotencyKey/eventType/templateKey/messageId/body` 构造，复用专用 consumer 现有幂等日志、中心库收件人预览和 provider dry-run 逻辑。
- 专用 consumer 返回 `success` 或 `duplicate` 时 listener 正常返回；返回 `invalid/failed/skipped` 等非可确认结果时继续抛错，避免共享队列消息被错误 ack。
- 非组织开通完成 route、安全门未开启、route guard 不匹配、payload/header 校验失败、`providerCallEnabled/providerCallBlocked` 出现时仍固定抛错保留消息。
- 为避免两个 listener 竞争同一个 `magic.notification.queue`，当 `RABBITMQ_NOTIFICATION_ROUTING_CONSUMER_ENABLED=true` 时，旧的 `OrganizationProvisioningCompletedNotificationRabbitListener` 不再启动；组织开通完成通知统一走通用 listener 委托。
- 本批会通过专用 consumer 写 `event_consume_log` 幂等记录并生成收件人/provider 计划；仍不调用短信/企微/站内信 provider，不写租户库，不投递 retry/DLQ，不放开其它 notification route。

第一百六十四批工作说明：

- 组织开通完成 notification provider 计划新增真实发送前置验收矩阵和单渠道灰度 guard。
- 新增配置项 `RABBITMQ_ORGANIZATION_PROVISIONING_PROVIDER_CHANNEL_GUARD`，默认 `in_app`；只有同时满足 `RABBITMQ_ORGANIZATION_PROVISIONING_PROVIDER_SEND_ENABLED=true`、收件人解析 ready、渠道已登记 provider、渠道匹配 guard、渠道有收件人的计划，才会进入 `providerReadyChannels`。
- `OrganizationProvisioningCompletedNotificationProviderPlanService` 新增 `providerReadinessMatrix`、`providerReadinessFailedChecks`、`providerReadyChannels`、`providerBlockedChannels`、`channelReadyForProviderDryRun` 和 `nextAction`，每个渠道也会输出 `readinessChecks`。
- 本批仍固定 `providerCallRequested=false`、`providerCallExecuted=false`、`sendEnabled=false`、`dryRun=true`，不调用短信/企微/站内信 provider，不写租户库，不投递 retry/DLQ。

第一百六十五批工作说明：

- 新增 `OrganizationProvisioningCompletedInAppProviderExecutionPlanService`，为组织开通完成 notification 的 `in_app` 单渠道生成 provider 执行器写库/幂等预案。
- `OrganizationProvisioningCompletedNotificationProviderPlanService` 会把该预案挂到 `inAppExecutionPlan`，只有 `in_app` 进入 `providerReadyChannels`、有收件人、存在 eventId 和幂等键时，预案才显示 `planStatus=ready_for_write_plan`。
- 预案明确将来应先认领 `event_consume_log`，再按收件人写入 `in_app_notification`，最后标记消费成功；每个收件人都有独立 `idempotencyKey=organization-provisioning-completed-provider:{jobId}:in_app:{centerUserId}`。
- 当前项目尚未固定站内通知业务表结构，因此本批只输出 `notificationTable=in_app_notification`、`manualDdlRequired=true`、`recipientWritePreviews` 和 `deferredSideEffects`。
- 本批仍不执行 SQL，不写 `event_consume_log`，不创建或写入 `in_app_notification`，不调用短信/企微 provider，不投递 RabbitMQ/Kafka，不写租户库。

第一百六十六批工作说明：

- 新增手工 DDL 草案 `src/main/resources/db/manual/002-in-app-notification.sql`，定义中心库 `in_app_notification` 表、逐收件人唯一幂等键、收件人状态索引和事件索引。
- 新增配置项 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_NOTIFICATION_DDL_APPLIED`，默认 `false`；只有人工确认中心库已应用 DDL 后，`inAppExecutionPlan.writePreview.manualDdlApplied` 才会变为 `true`。
- 新增 `OrganizationProvisioningCompletedInAppProviderExecutorPreflightService`，在 `inAppExecutionPlan.executorPreflightPlan` 中输出 `EventConsumeLogEntry` 预览、claim 策略、`CLAIMED/DUPLICATE_SUCCESS/IN_PROGRESS` 处理策略和事务边界。
- 本批仍固定 `claimRequested=false`、`claimExecuted=false`、`dbWriteExecuted=false`、`markSuccessExecuted=false`、`markFailureExecuted=false`；不调用 `EventConsumeLogRepository.claimProcessing(...)`，不写 `event_consume_log`，不插入 `in_app_notification`，不触发 websocket/push，不接短信/企微 provider。

第一百六十七批工作说明：

- 新增 `OrganizationProvisioningCompletedInAppProviderExecutor` 和 `OrganizationProvisioningCompletedInAppProviderClaimResult`，为 `in_app` provider 执行器接入真实 `event_consume_log.claimProcessing(...)`。
- 新增配置项 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_CLAIM_ENABLED`，默认 `false`；关闭时 executor 只返回 `claim_gate_disabled`，不会调用仓储。
- 打开 claim 开关且 `executorPreflightPlan.claimReady=true` 时，executor 只认领 provider 级消费日志：`consumerGroup=provider-in-app-organization-provisioning-completed`、`eventType=provider.organization.provisioning.completed.in_app_notification`、`topic=magic.notification.queue`。
- `CLAIMED` 返回 `claimed_write_deferred/processing`，`DUPLICATE_SUCCESS` 返回 `already_consumed/duplicate`，`IN_PROGRESS` 返回 `already_processing/duplicate`。
- 本批仍固定 `dbWriteExecuted=false`、`markSuccessExecuted=false`、`markFailureExecuted=false`；不插入 `in_app_notification`，不调用 `markSuccess/markFailure`，不触发 websocket/push，不接短信/企微 provider。

第一百六十八批工作说明：

- 新增 `OrganizationProvisioningCompletedInAppNotificationInsertPlanService`，为 `in_app_notification` 单表逐收件人 insert 生成字段和参数预检。
- `inAppExecutionPlan.writePreview.notificationInsertPlan` 会输出 `insertColumns`、`insertRows`、`insertRowCount`、`manualDdlApplied`、`insertRequested=false`、`insertExecuted=false` 和 `dbWriteExecuted=false`。
- insert 参数覆盖 `event_id/idempotency_key/recipient_center_user_id/target_customer_id/target_db_name/template_key/title/content/status/payload_json`，每个收件人行继续使用独立 `idempotencyKey`。
- 只有 `inAppExecutionPlan.planStatus=ready_for_write_plan`、手工 DDL 已确认、且每行必要字段齐全时，`notificationInsertPlan.planStatus` 才会进入 `ready_for_insert_dry_run`。
- 本批仍不持有 `JdbcTemplate`，不执行 `INSERT INTO in_app_notification`，不调用 `event_consume_log.markSuccess/markFailure`，不触发 websocket/push，不接短信/企微 provider。

第一百六十九批工作说明：

- 新增 `OrganizationProvisioningCompletedInAppNotificationRepository`、`OrganizationProvisioningCompletedInAppNotificationInsertRow`、`OrganizationProvisioningCompletedInAppNotificationRepositoryResult` 和 `OrganizationProvisioningCompletedInAppNotificationInsertResult`。
- 新增配置项 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_NOTIFICATION_INSERT_ENABLED`，默认 `false`；关闭时 executor 只返回 `insert_gate_disabled`，不会写 `in_app_notification`。
- `OrganizationProvisioningCompletedInAppProviderExecutor.insertNotifications(...)` 只有在 provider claim 已 accepted、`notificationInsertPlan.planStatus=ready_for_insert_dry_run`、且 insert 开关开启时，才逐行调用 repository 写入中心库 `in_app_notification`。
- repository 按 `idempotency_key` 唯一键处理重复写入，`DuplicateKeyException` 会计入 `duplicateRows`，不会中断整批其它收件人写入。
- 本批仍不调用 `event_consume_log.markSuccess/markFailure`，不新增 listener 自动调用 insert，不触发 websocket/push，不接短信/企微 provider，不写租户库。

第一百七十批工作说明：

- 新增 `OrganizationProvisioningCompletedInAppProviderMarkSuccessResult`，并为 `OrganizationProvisioningCompletedInAppProviderExecutor` 增加 `markSuccess(...)` 收口方法。
- 新增配置项 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_MARK_SUCCESS_ENABLED`，默认 `false`；关闭时 executor 只返回 `mark_success_gate_disabled`，不会调用 `EventConsumeLogRepository.markSuccess(...)`。
- `markSuccess(...)` 只有在 provider claim 已 accepted、`in_app_notification` insert 已 accepted、且 mark success 开关开启时，才把 provider 级 `event_consume_log` 标记为 `success`。
- 本批仍不新增 listener 自动串联 `claim -> insert -> markSuccess`，不触发 websocket/push，不接短信/企微 provider，不写租户库。

第一百七十一批工作说明：

- 新增 `OrganizationProvisioningCompletedInAppProviderManualExecutionService` 和 `OrganizationProvisioningCompletedInAppProviderManualExecutionResult`，提供显式手动串联入口。
- 手动入口只按顺序调用 `claim -> insertNotifications -> markSuccess`；claim 未 accepted 时停止在 claim，insert 未 accepted 时停止在 insert，只有 insert accepted 后才调用 mark success。
- `inAppExecutionPlan` 新增 `manualExecutionBean`、`manualExecutionRequested=false`、`manualExecutionExecuted=false`、`listenerAutoExecution=false`、`websocketExecuted=false` 和 `pushExecuted=false`，方便灰度时核对执行边界。
- 本批不新增 Controller，不接 `@RabbitListener`，不自动消费 RabbitMQ notification 队列，不触发 websocket/push，不接短信/企微 provider，不写租户库。

第一百七十二批工作说明：

- 新增 `OrganizationProvisioningCompletedInAppProviderMarkFailureResult`，并为 `OrganizationProvisioningCompletedInAppProviderExecutor` 增加 `markFailure(...)` 失败收口方法。
- 新增配置项 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_MARK_FAILURE_ENABLED`，默认 `false`；关闭时 executor 只返回 `mark_failure_gate_disabled`，不会调用 `EventConsumeLogRepository.markFailure(...)`。
- `markFailure(...)` 只有在 provider claim 已 accepted、失败原因非空、且 mark failure 开关开启时，才把 provider 级 `event_consume_log` 标记为 `failed`。
- 本批不把 `markFailure(...)` 接入手动串联 service 的异常捕获，不新增 Controller，不接 `@RabbitListener`，不投递 retry/DLQ，不触发 websocket/push，不接短信/企微 provider，不写租户库。

第一百七十三批工作说明：

- `OrganizationProvisioningCompletedInAppProviderManualExecutionService` 增加 insert/markSuccess 异常失败收口：`insertNotifications(...)` 或 `markSuccess(...)` 抛出 `RuntimeException` 后，会调用 executor 的 `markFailure(...)`。
- `OrganizationProvisioningCompletedInAppProviderManualExecutionResult` 新增 `markFailureResult` 字段，灰度时可直接看到失败收口是否 accepted、是否真实写库。
- `inAppExecutionPlan` 新增 `manualFailureClosureSupported=true`、`manualFailureClosureExecuted=false`，并更新 `executionBoundary`，明确手动入口支持异常失败收口但不接 listener。
- 本批只处理手动入口内的 insert/markSuccess 异常，不捕获 claim 异常，不新增 Controller，不接 `@RabbitListener`，不投递 retry/DLQ，不触发 websocket/push，不接短信/企微 provider，不写租户库。

第一百七十四批工作说明：

- 新增 `OrganizationProvisioningCompletedInAppDeliveryPlanService`，为 `in_app_notification` 写入后的 websocket/push 投递生成 dry-run 计划。
- `inAppExecutionPlan.writePreview.websocketPushDeliveryPlan` 会输出 `deliveryChannels=["websocket","push"]`、`deliveryRows`、`websocketTopic`、`websocketEvent`、`pushTemplateKey`、`websocketExecuted=false` 和 `pushExecuted=false`。
- `inAppExecutionPlan` 新增 `websocketPushDeliveryPlanned=true`、`websocketPushDeliveryExecuted=false`，用于灰度时确认推送仍停留在预案层。
- 本批不新增 WebSocket 配置，不接入移动推送 SDK，不创建推送 outbox，不投递 RabbitMQ retry/DLQ，不修改手动串联执行顺序，不新增 Controller，不接 `@RabbitListener`，不执行真实 websocket/push。

第一百七十五批工作说明：

- 新增 `OrganizationProvisioningCompletedInAppListenerAutoExecutionGatePlanService`，生成 RabbitMQ listener 自动串联 `in_app` provider 前的最终综合安全门。
- 新增配置项 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_LISTENER_AUTO_EXECUTION_ENABLED`，默认 `false`；它只参与安全门判定，不会触发 listener 自动执行。
- `inAppExecutionPlan.listenerAutoExecutionGatePlan` 会输出 `listenerAutoExecutionAllowed`、`readinessMatrix`、`failedChecks`、`blockedReasons`、`listenerIntegrationExecuted=false`、`websocketExecuted=false` 和 `pushExecuted=false`。
- 安全门同时检查自动执行总开关、provider send 开关、channel guard、手工 DDL、claim/insert/markSuccess/markFailure 开关、claim 预检、insert 预案和 websocket/push dry-run 预案。
- 本批不修改 `NotificationRoutingRabbitListener` 或专用 notification listener，不调用手动执行 service，不确认 RabbitMQ 消息，不执行 provider，不触发 websocket/push。

第一百七十六批工作说明：

- 新增 `OrganizationProvisioningCompletedInAppListenerAutoExecutionInvocationPlanService`，生成未来 RabbitMQ listener 调用 `OrganizationProvisioningCompletedInAppProviderManualExecutionService.execute(...)` 前的显式 dry-run 调用预案。
- `inAppExecutionPlan.listenerAutoExecutionGatePlan.invocationPlan` 会输出调用参数来源、调用顺序、ack/nack 策略、预期结果字段和 `manualExecutionExecuted=false`、`listenerInvocationExecuted=false`、`rabbitAckExecuted=false`、`rabbitNackExecuted=false`、`websocketExecuted=false`、`pushExecuted=false`。
- 调用预案会阻断综合安全门失败、`inAppExecutionPlan` 未 ready、缺少 `executorPreflightPlan/writePreview/notificationInsertPlan/websocketPushDeliveryPlan` 的情况，避免 listener 自动执行时参数不完整。
- 本批不修改 `NotificationRoutingRabbitListener` 或专用 notification listener，不调用手动执行 service，不确认或拒绝 RabbitMQ 消息，不执行 provider，不触发 websocket/push。

第一百七十七批工作说明：

- 新增 `NotificationInAppProviderAutoExecutionAdapterPlanService`，生成共享 notification listener 委托专用 consumer 后，如何从 `OrganizationProvisioningCompletedNotificationConsumeResult.sendPlan.providerPlan.inAppExecutionPlan` 串联到 `in_app` 手动 provider 的 adapter dry-run 预案。
- `NotificationConsumerDelegationPlanService` 新增 `inAppProviderAutoExecutionAdapterPlan`，输出 source consumer、source result path、manual execution bean/method、执行顺序、ack/nack 保持策略和全部执行态布尔值。
- adapter 预案会阻断非组织开通 route、requestType 不匹配、专用 consumer 委托未允许、委托安全门失败和上游 providerCall 开关未关闭的情况。
- 本批不修改 `NotificationRoutingRabbitListener` 的真实委托分支，不读取专用 consumer 真实结果，不调用 `OrganizationProvisioningCompletedInAppProviderManualExecutionService`，不改变 RabbitMQ ack/nack 行为，不触发 websocket/push。

第一百七十八批工作说明：

- 新增配置项 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_ENABLED`，默认 `false`；它只参与共享 notification listener 后置 adapter 安全门，不触发真实执行。
- `NotificationInAppProviderAutoExecutionAdapterPlanService` 新增 `readinessMatrix/readinessFailedChecks`，检查 route、requestType、专用 consumer 委托、委托失败项、result adapter 开关和 providerCall 关闭状态。
- 开关关闭时，即使专用 consumer 委托已经 allowed，`inAppProviderAutoExecutionAdapterPlan` 仍返回 `blocked` 和 `result_adapter_gate_enabled` 失败项；开关开启且其它条件通过时才返回 `ready_for_result_adapter_dry_run`。
- 本批不修改 `NotificationRoutingRabbitListener`，不读取真实 consumer result，不调用手动执行 service，不改变 RabbitMQ ack/nack 行为，不执行 websocket/push。

第一百七十九批工作说明：

- `NotificationInAppProviderAutoExecutionAdapterPlanService` 新增 `consumerResultValidationPlan`，只用于预览未来真实 consumer result 的路径校验和错误分类。
- 分类覆盖 `missing_send_plan`、`missing_provider_plan`、`missing_in_app_execution_plan`、`in_app_execution_plan_blocked` 和 `missing_listener_auto_execution_invocation_plan`。
- 预案明确 `consumerResultProvided=false`、`consumerResultInspected=false`、`validationExecuted=false`，并要求真实执行前先检查 `sendPlan.providerPlan.inAppExecutionPlan.listenerAutoExecutionGatePlan.invocationPlan`。
- 本批不修改 `NotificationRoutingRabbitListener`，不读取真实 consumer result，不调用手动执行 service，不改变 RabbitMQ ack/nack 行为，不执行 websocket/push。

第一百八十批工作说明：

- 新增 `NotificationInAppProviderConsumerResultValidationPlanService`，把第 179 批的 consumer result 路径校验和错误分类预案提炼成可复用 validator service。
- `NotificationInAppProviderAutoExecutionAdapterPlanService` 改为注入该 validator，并复用 `sourceResultPath()` 与 `buildPlan()` 结果，后续真实 result adapter 或 no-op 分支可以共用同一分类定义。
- validator 仍固定 `consumerResultProvided=false`、`consumerResultInspected=false`、`validationExecuted=false`，不读取真实 consumer result。
- 本批不修改 `NotificationRoutingRabbitListener`，不接 listener，不调用手动执行 service，不改变 RabbitMQ ack/nack 行为，不执行 websocket/push。

第一百八十一批工作说明：

- `NotificationInAppProviderConsumerResultValidationPlanService` 新增 `classify(Map<String,Object> consumerResult)` 纯内存分类方法，用于单元测试真实 result 形态样例。
- 分类方法只检查 Map 路径，覆盖缺 `sendPlan`、缺 `providerPlan`、缺 `inAppExecutionPlan`、`planStatus` 非 `ready_for_write_plan`、缺 `listenerAutoExecutionGatePlan.invocationPlan` 和结构 ready 六类结果。
- 即使分类返回 `ready_for_result_adapter_validation`，也固定 `adapterInvocationAllowed=false`、`manualExecutionAllowed=false`，只表示结构具备后续 dry-run 验收条件。
- 本批不修改 `NotificationRoutingRabbitListener`，不接 listener，不读取 RabbitMQ 消息，不写数据库，不调用手动执行 service，不改变 RabbitMQ ack/nack 行为。

第一百八十二批工作说明：

- 新增配置项 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_LISTENER_NOOP_ENABLED`，默认 `false`；它只参与后置 adapter listener no-op 接入预案。
- `NotificationInAppProviderAutoExecutionAdapterPlanService` 新增 `listenerNoopIntegrationPlan`，输出 listener bean/method、no-op 分支开关、adapter plan ready 状态和全部执行态布尔值。
- 只有 result adapter dry-run 已 ready 且 no-op 开关开启时，`listenerNoopIntegrationPlan` 才返回 `ready_for_listener_noop_dry_run`；即使 ready，也固定 `noopBranchExecuted=false`、`consumerResultForwardedToValidator=false`、`manualExecutionExecuted=false`。
- 本批不修改 `NotificationRoutingRabbitListener`，不接 listener，不把真实 consumer result 传入 validator，不调用手动执行 service，不改变 RabbitMQ ack/nack 行为。

第一百八十三批工作说明：

- `NotificationInAppProviderAutoExecutionAdapterPlanService.listenerNoopIntegrationPlan` 新增 `ackNackDecisionMatrix`，覆盖 adapter 阻断、no-op 开关关闭、no-op 分支允许、未来 result 校验失败和未来 result 校验通过 5 类场景。
- no-op 预案新增 `ackDecision=keep_current_listener_policy`、`nackDecision=keep_current_listener_throw_policy`、`ackNackDecisionExecuted=false` 和 `ackNackPolicyChanged=false`。
- 每个 ack/nack 决策项都固定 `decisionExecuted=false`、`rabbitAckExecuted=false`、`rabbitNackExecuted=false`，只作为后续 listener 接入前的验收矩阵。
- 本批不修改 `NotificationRoutingRabbitListener`，不读取或转发真实 consumer result，不调用手动执行 service，不改变 RabbitMQ ack/nack 行为，不执行 websocket/push。

第一百八十四批工作说明：

- 新增 `NotificationInAppProviderListenerNoopPlanService`，把 `listenerNoopIntegrationPlan`、阻断原因和 ack/nack 决策矩阵从 adapter 预案中拆成独立 service。
- `NotificationInAppProviderAutoExecutionAdapterPlanService` 仅保留后置 adapter 安全门和 validator 编排，通过注入的新 no-op plan service 输出 `listenerNoopIntegrationPlan`。
- 新增 `NotificationInAppProviderListenerNoopPlanServiceTest`，单独覆盖 adapter 未 ready、adapter ready 但 no-op 开关关闭、双条件 ready 的 dry-run 结构。
- 本批不修改 `NotificationRoutingRabbitListener`，不新增 listener 分支，不读取或转发真实 consumer result，不调用手动执行 service，不改变 RabbitMQ ack/nack 行为。

第一百八十五批工作说明：

- `NotificationInAppProviderListenerNoopPlanService` 新增 `validatorContractPlan`，描述未来 no-op 分支调用 `NotificationInAppProviderConsumerResultValidationPlanService.classify(...)` 前的参数契约。
- 契约预案输出 `argumentName=consumerResult`、`argumentSource=dedicatedConsumerResult`、`sourceResultPath`、`requiredNestedPaths`、ready 分类和阻断分类清单。
- 契约预案固定 `argumentSourceAvailable=false`、`contractCheckExecuted=false`、`consumerResultForwardedToValidator=false`、`adapterInvocationAllowed=false` 和 `manualExecutionAllowed=false`。
- 本批不修改 `NotificationRoutingRabbitListener`，不传入真实 consumer result，不调用 `classify(...)`，不调用手动执行 service，不改变 RabbitMQ ack/nack 行为。

第一百八十六批工作说明：

- `validatorContractPlan` 新增 `inputSampleMatrix`，只描述未来 `classify(...)` 的输入形态和预期分类。
- 样例矩阵覆盖缺 `sendPlan`、缺 `providerPlan`、缺 `inAppExecutionPlan`、`inAppExecutionPlan.planStatus` 阻断、缺 `listenerAutoExecutionGatePlan.invocationPlan` 和 ready 结构 6 类。
- 每个样例都固定 `samplePayloadProvided=false`、`classificationExecuted=false`、`consumerResultForwardedToValidator=false`、`adapterInvocationAllowed=false` 和 `manualExecutionAllowed=false`。
- 本批不修改 `NotificationRoutingRabbitListener`，不构造真实 consumer result，不调用 `classify(...)`，不调用手动执行 service，不改变 RabbitMQ ack/nack 行为。

第一百八十七批工作说明：

- `NotificationInAppProviderAutoExecutionAdapterPlanServiceTest` 新增 adapter/no-op/validator contract 嵌套计划只读验收用例。
- 验收从 `inAppProviderAutoExecutionAdapterPlan` 逐层检查 `listenerNoopIntegrationPlan`、`validatorContractPlan` 和 `inputSampleMatrix`。
- 该测试固定 adapter、no-op、validator contract、样例矩阵的执行态都为 false，确保 ready dry-run 不会被误改成真实执行。
- 本批只补测试和文档，不修改生产代码，不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不改变 RabbitMQ ack/nack 行为。

第一百八十八批工作说明：

- `validatorContractPlan` 新增 `ackNackAlignmentMatrix`，静态对齐 validator 分类结果与未来 ack/nack 决策场景。
- 5 个 blocked 分类统一映射到 `future_validation_blocked`、`no_ack_until_real_adapter_policy_batch` 和 `throw_for_retry_or_dlq_until_real_policy_batch`。
- ready 分类映射到 `future_validation_ready`、`defer_ack_until_manual_execution_result_is_verified` 和 `not_applicable_until_real_adapter_policy_batch`。
- 本批固定 `ackNackAlignmentExecuted=false`、`classificationExecuted=false`、`rabbitAckExecuted=false`、`rabbitNackExecuted=false`；不调用 validator，不修改 listener，不改变 RabbitMQ ack/nack 行为。

第一百八十九批工作说明：

- `NotificationInAppProviderAutoExecutionAdapterPlanServiceTest` 扩展 adapter/no-op 嵌套只读验收，固定 `ackNackAlignmentMatrix` 必须包含 6 条分类对齐记录。
- 验收覆盖 5 个 blocked 分类全部映射到 `future_validation_blocked`，ready 分类映射到 `future_validation_ready`。
- 每条对齐记录继续固定 `alignmentExecuted=false`、`classificationExecuted=false`、`rabbitAckExecuted=false`、`rabbitNackExecuted=false`。
- 本批只补测试和文档，不修改生产代码，不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不改变 RabbitMQ ack/nack 行为。

第一百九十批工作说明：

- `NotificationInAppProviderListenerNoopPlanService` 抽取 ack/nack 策略和 future validation 场景常量，减少 `ackNackDecisionMatrix` 与 `ackNackAlignmentMatrix` 的重复字符串。
- 常量覆盖 keep-current listener 策略、future validation blocked/ready 场景、真实策略批次前 no-ack/nack 和手动执行验证后 ack 的描述。
- 输出 Map 的 `ackDecision`、`nackDecision`、`ackNackScenario` 等字段值保持不变，现有测试继续按字面值验收。
- 本批只做内部常量整理，不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不调用 validator，不改变 RabbitMQ ack/nack 行为。

第一百九十一批工作说明：

- `NotificationInAppProviderListenerNoopPlanServiceTest` 新增常量整理后的只读回归测试，集中验收顶层 no-op 预案、`ackNackDecisionMatrix` 和 `ackNackAlignmentMatrix` 的策略字符串输出。
- 回归测试固定 `keep_current_listener_policy`、`keep_current_listener_throw_policy`、`future_validation_blocked`、`future_validation_ready`、`no_ack_until_real_adapter_policy_batch`、`defer_ack_until_manual_execution_result_is_verified` 等字段值。
- 回归测试继续断言 `ackNackDecisionExecuted=false`、`rabbitAckExecuted=false`、`rabbitNackExecuted=false`，确保常量整理不会改变执行边界。
- 本批只补测试和文档，不修改生产代码，不修改 `NotificationRoutingRabbitListener`，不调用 validator，不改变 RabbitMQ ack/nack 行为。

第一百九十二批工作说明：

- `NotificationInAppProviderConsumerResultValidationPlanService` 抽取 consumer result 分类码、ready 状态和 blocked/ready 分类状态常量。
- `NotificationInAppProviderListenerNoopPlanService` 抽取 no-op validator contract、输入样例矩阵和 ack/nack alignment 使用的分类码常量。
- 分类码输出仍保持 `missing_send_plan`、`missing_provider_plan`、`missing_in_app_execution_plan`、`in_app_execution_plan_blocked`、`missing_listener_auto_execution_invocation_plan` 和 `ready_for_result_adapter_validation` 不变。
- 本批只做内部常量整理，不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不调用 validator，不改变 RabbitMQ ack/nack 行为。

第一百九十三批工作说明：

- `NotificationInAppProviderConsumerResultValidationPlanServiceTest` 新增分类常量整理后的只读回归测试，锁定 `errorClassifications` 的 5 个错误分类码、blocked 状态和 retry/DLQ ack 决策字符串。
- `NotificationInAppProviderConsumerResultValidationPlanServiceTest` 额外锁定 `classify(...)` 6 类输出的 `classificationCode`、`classificationStatus`、执行态和手动执行禁用状态。
- `NotificationInAppProviderListenerNoopPlanServiceTest` 新增 validator contract 分类字符串回归测试，锁定 `blockedClassifications`、`inputSampleMatrix` 和 `ackNackAlignmentMatrix` 的完整顺序。
- 本批只补测试和文档，不修改生产代码，不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不调用手动执行 service，不改变 RabbitMQ ack/nack 行为。

第一百九十四批工作说明：

- `NotificationInAppProviderListenerNoopPlanService` 抽取 no-op 顶层 `planStatus`、validator contract `planStatus` 和 input sample `sampleName` 常量。
- 常量覆盖 `blocked`、`ready_for_listener_noop_dry_run`、`ready_for_validator_contract_dry_run` 以及 6 个 validator 输入样例名称。
- 现有第 193 批测试继续按字面值锁定输出，确保常量整理后 `planStatus`、`sampleName`、分类码和 ack/nack alignment 对外不变。
- 本批只做内部常量整理，不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不调用 validator，不调用手动执行 service，不改变 RabbitMQ ack/nack 行为。

第一百九十五批工作说明：

- `NotificationInAppProviderListenerNoopPlanServiceTest` 新增 no-op `planStatus/sampleName` 常量整理后的字段级只读回归测试。
- 回归测试同时覆盖 adapter 未 ready、no-op 开关关闭和 no-op ready 三种计划状态，锁定顶层 `planStatus` 和 `validatorContractPlan.planStatus` 输出。
- 回归测试锁定 6 个 `inputSampleMatrix.sampleName` 的完整顺序，并继续固定 `samplePayloadProvided=false`、`classificationExecuted=false`、`consumerResultForwardedToValidator=false`。
- 本批只补测试和文档，不修改生产代码，不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。

第一百九十六批工作说明：

- `NotificationInAppProviderListenerNoopPlanService` 抽取 no-op `ackNackDecisionMatrix.scenario` 和顶层/validator contract `nextAction` 常量。
- 常量覆盖 `adapter_plan_blocked`、`noop_gate_disabled`、`noop_branch_allowed` 以及 no-op ready/blocked、validator contract ready/blocked 的 4 个 nextAction 输出。
- 现有测试继续按字面值验收场景名和执行边界，确保常量整理后 `scenario`、`nextAction`、ack/nack 字段值对外不变。
- 本批只做内部常量整理，不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。

第一百九十七批工作说明：

- `NotificationInAppProviderListenerNoopPlanServiceTest` 新增 no-op `nextAction/scenario` 常量整理后的字段级只读回归测试。
- 回归测试锁定顶层 no-op blocked/ready 两个 `nextAction` 输出，以及 `validatorContractPlan.nextAction` 的 blocked/ready 两个输出。
- 回归测试锁定 `ackNackDecisionMatrix.scenario` 的 5 条顺序：`adapter_plan_blocked`、`noop_gate_disabled`、`noop_branch_allowed`、`future_validation_blocked`、`future_validation_ready`。
- 本批只补测试和文档，不修改生产代码，不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。

第一百九十八批工作说明：

- `NotificationInAppProviderListenerNoopPlanService` 抽取 no-op `blockedReasons` 两个阻断原因文本常量。
- 常量覆盖 result adapter dry-run 未 ready 和 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_LISTENER_NOOP_ENABLED` 未开启两类阻断。
- 现有测试继续按字面值验收 `blockedReasons` 输出，确保常量整理后阻断原因数组内容不变。
- 本批只做内部常量整理，不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。

第一百九十九批工作说明：

- `NotificationInAppProviderListenerNoopPlanServiceTest` 新增 no-op `blockedReasons` 常量整理后的字段级只读回归测试。
- 回归测试集中锁定 adapter 未 ready、no-op 开关关闭和 no-op ready 三种状态下的 `blockedReasons` 完整数组顺序。
- 回归测试继续固定 `noopBranchExecuted=false`、`consumerResultForwardedToValidator=false`、`manualExecutionExecuted=false`、`rabbitAckExecuted=false` 和 `rabbitNackExecuted=false`。
- 本批只补测试和文档，不修改生产代码，不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。

第二百批工作说明：

- `NotificationInAppProviderListenerNoopPlanService` 抽取 no-op 顶层和 validator contract 的 `executionBoundary` 文本常量。
- `NotificationInAppProviderListenerNoopPlanService` 同时抽取 `ackNackDecisionMatrix.note` 五条说明文本常量，覆盖 adapter 阻断、no-op 开关关闭、no-op 分支允许、未来校验失败和未来校验通过。
- 对外 `executionBoundary`、`note`、scenario、ack/nack 字段值保持不变，后续测试继续按字面值验收。
- 本批只做内部常量整理，不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。

第二百零一批工作说明：

- `NotificationInAppProviderListenerNoopPlanServiceTest` 新增 no-op `executionBoundary/note` 常量整理后的字段级只读回归测试。
- 回归测试锁定顶层 no-op `executionBoundary`、`validatorContractPlan.executionBoundary` 和 `ackNackDecisionMatrix.note` 五条说明文本顺序。
- 回归测试继续固定 `contractCheckExecuted=false`、`consumerResultForwardedToValidator=false`、`decisionExecuted=false`、`rabbitAckExecuted=false` 和 `rabbitNackExecuted=false`。
- 本批只补测试和文档，不修改生产代码，不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。

第二百零二批工作说明：

- `NotificationInAppProviderListenerNoopPlanServiceTest` 抽取 `assertNoopPlanDoesNotExecute(...)` 测试 helper，集中断言顶层 no-op 不执行状态。
- helper 覆盖 `noopBranchExecuted=false`、`consumerResultForwardedToValidator=false`、`manualExecutionExecuted=false`、`rabbitAckExecuted=false` 和 `rabbitNackExecuted=false`。
- 本批只整理测试重复断言，不修改生产代码，不修改 dry-run 输出字段值，不修改 `NotificationRoutingRabbitListener`，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。

第二百零三批工作说明：

- `NotificationInAppProviderListenerNoopPlanServiceTest` 抽取 `assertAckNackDecisionDoesNotExecute(...)` 和 `assertAckNackDecisionMatrixDoesNotExecute(...)` 测试 helper。
- helper 集中断言 `decisionExecuted=false`、`rabbitAckExecuted=false` 和 `rabbitNackExecuted=false`，复用到单条 decision 与完整 decision matrix 验收。
- 本批只整理测试重复断言，不修改生产代码，不修改 dry-run 输出字段值，不修改 `NotificationRoutingRabbitListener`，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。

第二百零四批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceDoesNotWireInAppProviderNoopValidatorOrManualExecution()` 源码静态边界测试。
- 测试锁定共享 notification listener 目前只调用 `organizationProvisioningCompletedNotificationConsumerService.consume(...)`，不注入 no-op 计划 service、consumer result validator 或站内信 provider 手动执行 service。
- 测试同时确认 listener 未调用 `classify(...)` 或 `execute(...)`，避免在正式接入前绕过 dry-run 预案直接执行 provider 自动分支。
- 本批只补 listener 接入前只读验收测试和文档，不修改生产代码，不传真实 consumer result 到 validator，不调用手动执行 service，不改变 RabbitMQ ack/nack 行为。

第二百零五批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsDedicatedConsumerDelegationPipelineOrder()` 源码顺序保护测试。
- 测试锁定通用 notification listener 的字段依赖、构造器参数和 `onMessage(...)` 调用顺序仍是 `routing -> dispatch -> adapter -> request validation -> delegation -> dedicated consumer -> ackable`。
- 新增 `assertAppearsInOrder(...)` 测试 helper，后续新增 listener no-op 分支前必须先显式调整并评审顺序边界。
- 本批只补 listener 接入前只读验收测试和文档，不修改生产代码，不新增依赖，不传真实 consumer result 到 validator，不调用手动执行 service，不改变 RabbitMQ ack/nack 行为。

第二百零六批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceDoesNotInspectProviderExecutionPlansAfterDedicatedConsumerReturns()` 源码边界测试。
- 测试锁定通用 notification listener 在专用 consumer 返回后只用 `consumed/duplicate` 做 `ackable` 判断，不读取 `sendPlan`、`providerPlan`、`inAppExecutionPlan`、`providerReadyChannels` 或 `listenerAutoExecutionGatePlan`。
- 该测试避免后续有人在共享 listener 中绕过 no-op/validator 预案直接读取 provider 执行计划并触发自动执行。
- 本批只补 listener 接入前只读验收测试和文档，不修改生产代码，不新增 provider 自动执行，不改变 RabbitMQ ack/nack 行为。

第二百零七批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsRabbitAckNackBoundaryOwnedByContainerOnly()` 源码边界测试。
- 测试锁定当前共享 notification listener 的 ack/nack 边界仍由 Spring AMQP 容器负责：`ackable` 时只 `return`，非 ackable 或委托阻断时继续抛 `IllegalStateException` 保留消息。
- 测试同时确认 listener 未引入 `Channel`、`Acknowledgment`、`basicAck/basicNack/basicReject` 或 AMQP 手动确认异常类型，避免提前改变 RabbitMQ 确认策略。
- 本批只补 listener ack/nack 边界只读验收测试和文档，不修改生产代码，不新增手动 ack/nack，不接 no-op/validator/manual execution，不改变 RabbitMQ 消费行为。

第二百零八批工作说明：

- `NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `buildPlanDocumentsFutureValidatorClassificationToReturnThrowBoundary()`。
- 测试锁定 `validatorContractPlan.ackNackAlignmentMatrix` 中 5 类 blocked 分类继续映射为 `future_validation_blocked + no_ack_until_real_adapter_policy_batch + throw_for_retry_or_dlq_until_real_policy_batch`。
- 测试同时锁定 ready 分类继续映射为 `future_validation_ready + defer_ack_until_manual_execution_result_is_verified + not_applicable_until_real_adapter_policy_batch`。
- 本批只补 no-op 分支正式接入前的 return/throw 边界只读验收测试和文档，不调用 validator，不传真实 consumer result，不改 listener，不改变 RabbitMQ ack/nack 行为。

第二百零九批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsConstructorDependencySurfaceBeforeNoopIntegration()`。
- 测试锁定 `NotificationRoutingRabbitListener` 当前仍只有 6 个 `private final` 依赖字段，构造器参数和赋值仍只包含 routing、dispatch、adapter、request validation、delegation 和组织开通完成专用 consumer。
- 测试继续排除 no-op plan service、consumer result validator 和站内信 provider 手动执行 service，避免正式接入前误把 provider 自动执行链路注入 listener。
- 本批只补 listener 构造器依赖面只读验收测试和文档，不修改生产代码，不新增 listener 依赖，不调用 validator/manual execution，不改变 RabbitMQ ack/nack 行为。

第二百一十批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceDoesNotReadConsumerResultMapOrBuildValidatorInputBeforeNoopIntegration()`。
- 测试锁定 `NotificationRoutingRabbitListener` 在 no-op 分支正式接入前，专用 consumer 返回后仍只进入 `ackable(result)` 判断，不读取 `consumerResult/dedicatedConsumerResult/resultMap`，也不构造 `validatorInput/validationInput/classificationInput`。
- 测试继续确认 listener 未调用 `classify(...)`，未出现 `validatorContractPlan`，避免提前把真实 consumer result 传给 validator。
- 本批只补 listener consumer result Map 和 validator 输入边界只读验收测试和文档，不修改生产代码，不调用 validator/manual execution，不改变 RabbitMQ ack/nack 行为。

第二百一十一批工作说明：

- `NotificationInAppProviderAutoExecutionAdapterPlanServiceTest` 新增 `buildPlanDocumentsListenerNoopContractWithoutManualExecutionOrAckNack()`。
- 测试锁定 result adapter 和 listener no-op 两个安全门都开启时，顶层 adapter 仍只返回 `ready_for_result_adapter_dry_run`，`adapterInvocationRequested/executed`、`resultAdapterInvocationRequested/executed`、`consumerResultInspected`、`manualExecutionRequested/executed` 均保持 `false`。
- 测试同时锁定嵌套 `listenerNoopIntegrationPlan` 只允许 `ready_for_listener_noop_dry_run` 预案，`validatorContractPlan` 只描述 `classify` 契约，仍不转发真实 consumer result、不允许 manual execution、不执行 ack/nack/websocket/push。
- 本批只补 listener no-op 接入契约只读验收测试和文档，不修改生产代码，不接 `NotificationRoutingRabbitListener`，不调用 validator/manual execution，不改变 RabbitMQ ack/nack 行为。

第二百一十二批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsFinalNoopPreIntegrationBoundaryBeforeRealListenerChange()`。
- 测试把 listener no-op 正式接入前的最终源码边界集中锁定：`private final` 依赖仍为 6 个，`onMessage(...)` 调用顺序仍是 routing、dispatch、adapter、request validation、delegation、专用 consumer、`ackable(result)`。
- 测试同时锁定当前 return/throw 策略仍只有 1 个 `return;` 和 2 个 `throw new IllegalStateException(...)`，且 listener 未注入 no-op service、validator、manual execution service，未调用 `classify/execute/basicAck/basicNack/basicReject`。
- 本批只补 listener 正式接入前最终源码保护测试和文档，不修改生产代码，不新增 listener 依赖，不调用 validator/manual execution，不改变 RabbitMQ ack/nack 行为。

第二百一十三批工作说明：

- `NotificationRoutingRabbitListener` 受控接入 `NotificationInAppProviderListenerNoopPlanService`，只在组织开通完成专用 consumer 返回 `ackable(result)` 后调用 `buildPlan(resultAdapterPlanReady(delegationPlan))` 生成 no-op dry-run 预案，然后仍按原逻辑 `return`。
- 新增 `resultAdapterPlanReady(...)` 只读取 delegation dry-run 计划里的 `inAppProviderAutoExecutionAdapterPlan.planStatus`，不读取专用 consumer 的 `sendPlan/providerPlan/inAppExecutionPlan`，不传真实 consumer result 到 validator。
- `NotificationRoutingRabbitListenerTest` 更新构造器依赖、调用顺序和行为断言，并新增 `onMessageBuildsListenerNoopPlanWhenAckableAndAdapterPlanIsReady()`，锁定 adapter 预案 ready 时才向 no-op plan service 传 `true`。
- 本批只接入 listener no-op dry-run 预案生成，不调用 `classify(...)`，不调用 `OrganizationProvisioningCompletedInAppProviderManualExecutionService`，不执行 websocket/push，不新增手动 ack/nack，不改变原有 return/throw 策略。

第二百一十四批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsNoopPlanGenerationInsideAckableBranchOnly()`。
- 测试锁定 `listenerNoopPlanService.buildPlan(...)` 在源码中只出现一次，并且只位于 `if (ackable(result))` 分支内、`return;` 之前。
- 测试同时确认 no-op plan 仍只接收 `resultAdapterPlanReady(delegationPlan)`，不接收真实 `result/consumerResult/dedicatedConsumerResult`，blocked 和 non-ackable 路径继续走原 `IllegalStateException` 抛错策略。
- 本批只补 no-op 接入后的源码级回归测试和文档，不修改生产代码，不调用 validator/manual execution，不新增手动 ack/nack，不改变 RabbitMQ return/throw 行为。

第二百一十五批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `onMessageBuildsListenerNoopPlanWithFalseWhenAdapterPlanIsBlocked()`。
- 测试锁定 `delegationPlan.inAppProviderAutoExecutionAdapterPlan.planStatus=blocked` 时，即使专用 consumer 返回 ackable，listener 也只调用 `listenerNoopPlanService.buildPlan(false)`。
- 结合既有 ackable 缺失 nested adapter 计划和 adapter ready 场景，`resultAdapterPlanReady(...)` 的缺失、blocked、ready 三种输入都已覆盖；该 boolean 只影响 no-op dry-run 预案，不触发 validator/manual execution/websocket/push。
- 本批只补 result adapter ready 判定行为测试和文档，不修改生产代码，不改变 RabbitMQ return/throw/ack/nack 行为。

第二百一十六批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceDocumentsListenerNoopSafetyMatrixAfterDryRunIntegration()`。
- 测试用矩阵集中锁定 5 条路径：`delegation_blocked`、`dedicated_consumer_non_ackable`、`ackable_missing_adapter_plan`、`ackable_blocked_adapter_plan`、`ackable_ready_adapter_plan`。
- 矩阵确认 blocked 和 non-ackable 路径不会生成 no-op 预案；ackable 三类路径只生成 no-op dry-run，且 adapter ready 只影响 `noopAdapterPlanReady` boolean。
- 所有矩阵行继续固定 `validatorInvoked=false`、`manualExecutionInvoked=false`、`rabbitAckExecuted=false`、`rabbitNackExecuted=false`、`websocketExecuted=false`、`pushExecuted=false`。
- 本批只补 listener no-op 安全矩阵测试和文档，不修改生产代码，不调用 validator/manual execution，不改变 RabbitMQ return/throw/ack/nack 行为。

第二百一十七批工作说明：

- `NotificationInAppProviderListenerNoopPlanService` 在 `validatorContractPlan` 下新增 `inputAdapterPlan` dry-run 字段。
- `inputAdapterPlan` 只描述未来从 `dedicatedConsumerResult` 提取 `consumerResult` 并传入 `NotificationInAppProviderConsumerResultValidationPlanService.classify(...)` 的参数契约，包含 `sourceResultPath`、`requiredNestedPaths`、目标 validator bean/method/argument。
- `NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `buildPlanDocumentsValidatorInputAdapterContractWithoutForwardingResult()`，锁定 `sourceObjectAvailable=false`、`adapterExecuted=false`、`consumerResultForwardedToValidator=false`、`classificationExecuted=false`、`manualExecutionAllowed=false`、`rabbitAckExecuted=false`、`rabbitNackExecuted=false`。
- 本批只新增 validator 输入适配器预案，不接 `NotificationRoutingRabbitListener` 的真实 result，不调用 `classify(...)`，不调用 manual execution，不改变 RabbitMQ ack/nack 行为。

第二百一十八批工作说明：

- `NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `buildPlanKeepsInputAdapterBlockedUntilListenerNoopIsReady()`。
- 测试覆盖 adapter plan 未 ready、no-op gate 关闭、no-op ready 三种状态，锁定 `inputAdapterPlan.planStatus` 只有在 listener no-op ready 时才是 `ready_for_validator_input_adapter_dry_run`，其它状态均为 `blocked`。
- 测试同时固定三种状态下 `adapterRequested=false`、`adapterExecuted=false`、`consumerResultForwardedToValidator=false`、`classificationExecuted=false`、`manualExecutionAllowed=false`、`rabbitAckExecuted=false`、`rabbitNackExecuted=false`。
- 本批只补 input adapter 状态回归测试和文档，不修改生产代码，不调用 validator/manual execution，不改变 RabbitMQ ack/nack 行为。

第二百一十九批工作说明：

- `NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `buildPlanKeepsInputAdapterRequiredPathOrderStable()`。
- 测试锁定 `inputAdapterPlan.sourceResultPath` 顺序为 `sendPlan -> providerPlan -> inAppExecutionPlan`。
- 测试锁定 `inputAdapterPlan.requiredNestedPaths` 顺序为 `sendPlan`、`sendPlan.providerPlan`、`sendPlan.providerPlan.inAppExecutionPlan`、`sendPlan.providerPlan.inAppExecutionPlan.listenerAutoExecutionGatePlan`、`sendPlan.providerPlan.inAppExecutionPlan.listenerAutoExecutionGatePlan.invocationPlan`。
- 测试继续固定 `sourceObjectAvailable=false`、`adapterExecuted=false`、`classificationExecuted=false`、`consumerResultForwardedToValidator=false`。
- 本批只补 input adapter 路径顺序回归测试和文档，不修改生产代码，不提供 sample payload，不调用 validator/manual execution，不改变 RabbitMQ ack/nack 行为。

第二百二十批工作说明：

- `NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `buildPlanKeepsInputAdapterNextActionAndExecutionFlagsStable()`。
- 测试锁定 adapter plan 未 ready 和 no-op gate 关闭时，`inputAdapterPlan.nextAction` 均为 `fix_listener_noop_blockers_before_validator_input_adapter`。
- 测试锁定 no-op ready 时，`inputAdapterPlan.nextAction` 为 `ready_for_future_validator_input_adapter_contract_verification`。
- 三种状态继续固定 `adapterRequested=false`、`adapterExecuted=false`、`consumerResultForwardedToValidator=false`、`classificationExecuted=false`、`manualExecutionAllowed=false`、`rabbitAckExecuted=false`、`rabbitNackExecuted=false`。
- 本批只补 input adapter nextAction 和执行态字符串稳定性测试，不修改生产代码，不调用 validator/manual execution，不改变 RabbitMQ ack/nack 行为。

第二百二十一批工作说明：

- `NotificationInAppProviderAutoExecutionAdapterPlanServiceTest` 新增 `buildPlanExposesNestedNoopValidatorInputAdapterAndAckNackContractsTogether()`。
- 测试锁定 result adapter ready 时，顶层 adapter plan、`listenerNoopIntegrationPlan`、`validatorContractPlan`、`inputAdapterPlan` 和 `ackNackAlignmentMatrix` 四层契约可以同时读取。
- 测试同时固定四层均不执行：`adapterInvocationExecuted=false`、`noopBranchExecuted=false`、`contractCheckExecuted=false`、`inputAdapterPlan.adapterExecuted=false`、`classificationExecuted=false`、`manualExecutionAllowed=false`、`rabbitAckExecuted=false`、`rabbitNackExecuted=false`、`websocketExecuted=false`、`pushExecuted=false`。
- 本批只补嵌套契约完整性测试和文档，不修改生产代码，不传真实 consumer result，不调用 validator/manual execution，不改变 RabbitMQ ack/nack 行为。

第二百二十二批工作说明：

- 更新 README 环境变量说明和 RabbitMQ 队列边界说明，修正 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_LISTENER_NOOP_ENABLED` 的当前含义。
- 文档明确第二百一十三批后 `NotificationRoutingRabbitListener` 已在 ackable 专用 consumer 结果后生成 no-op dry-run 预案。
- 文档同时明确该 no-op 预案只读取 delegation dry-run 的后置 adapter 状态，不读取真实 `sendPlan/providerPlan/inAppExecutionPlan`，不调用 `classify(...)`，不调用 `OrganizationProvisioningCompletedInAppProviderManualExecutionService`，不执行 websocket/push，不新增手动 ack/nack。
- 本批只修正文档，不修改生产代码，不改变 RabbitMQ 行为。

第二百二十三批工作说明：

- 复查 README 中 listener no-op 相关当前态说明，保留历史批次记录中的旧边界描述，只修正当前状态段落。
- 将后置 adapter 安全门说明调整为：第二百一十三批后 listener 只基于 dry-run 状态生成 no-op 预案，仍不读取真实 consumer result，不调用 manual execution。
- 将 validator 说明调整为：`NotificationInAppProviderConsumerResultValidationPlanService` 当前由 adapter/no-op dry-run 计划复用；listener 已生成 no-op 预案，但仍不调用 `classify(...)`。
- 本批只做 README 术语对齐，不修改生产代码，不改变 RabbitMQ 行为。

第二百二十四批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsValidatorInvocationBlockedAfterNoopDryRunIntegration()`。
- 测试锁定 listener 当前只调用 `listenerNoopPlanService.buildPlan(resultAdapterPlanReady(delegationPlan))`。
- 测试继续排除 `inputAdapterPlan`、`validatorContractPlan`、`consumerResultValidation`、`classify(...)`、真实 `sendPlan/providerPlan/inAppExecutionPlan` 读取和 manual execution service。
- 本批只补 validator 真接入前的 listener 源码保护测试和文档，不修改生产代码，不调用 validator/manual execution，不改变 RabbitMQ ack/nack 行为。

第二百二十五批工作说明：

- 新增配置项 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_VALIDATOR_ENABLED`，默认 `false`。
- `NotificationInAppProviderListenerNoopPlanService.inputAdapterPlan` 新增 `validatorInvocationGatePlan`，只描述未来 validator 真调用的开关、输入来源和阻断原因。
- `NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `buildPlanDocumentsValidatorInvocationGateWithoutCallingClassify()`，覆盖默认 blocked 和开关开启后的 `ready_for_validator_invocation_dry_run`。
- 本批只新增 validator 调用安全门 dry-run 预案，不传真实 consumer result，不调用 `classify(...)`，不调用 manual execution，不改变 RabbitMQ ack/nack 行为。

第二百二十六批工作说明：

- `NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `buildPlanKeepsValidatorInvocationGateBlockedReasonsStable()`。
- 测试覆盖 validator gate 关闭且 no-op 未 ready、validator gate 开启但 no-op 未 ready、两者同时 ready 三种状态。
- 测试锁定 `blockedReasons` 顺序：先阻断 listener no-op 未 ready，再阻断 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_VALIDATOR_ENABLED` 未开启；ready 时为空数组。
- 三种状态继续固定 `validatorInvocationRequested=false`、`validatorInvocationExecuted=false`、`consumerResultForwardedToValidator=false`、`classificationExecuted=false`、`manualExecutionAllowed=false`。
- 本批只补 validator invocation gate 阻断原因和配置开关回归测试，不修改生产代码，不调用 validator/manual execution，不改变 RabbitMQ ack/nack 行为。

第二百二十七批工作说明：

- `NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `configAndReadmeKeepValidatorGatePropertyNameAligned()`。
- 测试静态检查 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_VALIDATOR_ENABLED` 在 `application.yml`、`application-local.yml`、`application-prod.yml`、`AppProperties` 和 README 环境变量清单中的命名一致。
- 测试同时确认 README 提到 `validatorInvocationGatePlan` 且明确当前不调用 `classify(...)`。
- 本批只补配置/文档命名对齐测试和文档，不修改生产行为。

第二百二十八批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsValidatorGatePlanOutOfListenerBeforeRealValidationIntegration()`。
- 测试锁定 `NotificationRoutingRabbitListener` 当前只注入 no-op plan service，不注入 `NotificationInAppProviderConsumerResultValidationPlanService`。
- 测试继续排除 listener 读取 `validatorInvocationGatePlan`、validator gate 配置、`inputAdapterPlan`，以及调用 `classify(...)`、转发 consumer result 或执行 classification。
- 本批只补 validator gate ready 前的 listener 源码回归测试和文档，不修改生产代码，不调用 validator/manual execution，不改变 RabbitMQ ack/nack 行为。

第二百二十九批工作说明：

- `NotificationInAppProviderListenerNoopPlanService.validatorInvocationGatePlan` 新增 `classificationAckNackPlan` dry-run 字段。
- `classificationAckNackPlan` 只描述未来 validator 分类结果到 ack/nack 策略的映射：blocked 分类对应 `no_ack_until_real_adapter_policy_batch + throw_for_retry_or_dlq_until_real_policy_batch`，ready 分类对应 `defer_ack_until_manual_execution_result_is_verified + not_applicable_until_real_adapter_policy_batch`。
- `NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `buildPlanDocumentsClassificationAckNackPlanWithoutExecutingDecision()`，锁定 blocked/ready 两种 gate 状态下均不执行 classification、decision、ack、nack 或 manual execution。
- 本批只新增 classification 到 ack/nack 的预案矩阵，不调用 validator，不执行 ack/nack，不改变 RabbitMQ 行为。

第二百三十批工作说明：

- `NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `buildPlanKeepsClassificationAckNackPlanClassificationsAndNextActionStable()`。
- 测试锁定 `classificationAckNackPlan.nextAction` 在 blocked 状态下为 `keep_classification_ack_nack_blocked_until_validator_gate_ready`，ready 状态下为 `ready_for_future_classification_to_ack_nack_policy_batch`。
- 测试锁定 `decisionMatrix` 顺序为 `future_validation_blocked`、`future_validation_ready`，并固定 blocked 分类集合和 ready 分类集合顺序。
- 本批只补 classification ack/nack 预案字符串和分类顺序稳定性测试，不修改生产行为，不调用 validator，不执行 ack/nack。

第二百三十一批工作说明：

- README RabbitMQ 队列边界新增当前 validator dry-run 边界摘要，集中说明 validator gate、input adapter、classification ack/nack plan 和 listener 未注入 validator 的当前状态。
- 文档明确 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_VALIDATOR_ENABLED=true` 只会让 `validatorInvocationGatePlan` 进入 ready 预案，不会触发真实 `classify(...)`、manual execution、websocket/push 或 ack/nack。
- 本批只补公开摘要文档，不修改生产代码，不改变 RabbitMQ 行为。

第二百三十二批工作说明：

- README 环境要求补充 2026-07-07 工具链路径澄清：`mvn` 未加入 PATH，仓库内没有 Maven wrapper，但临时目录已有 `codex-maven-3.9.11`，且该 Maven 可识别 `C:\Program Files\Java\jdk-21.0.1`。
- 文档更新本轮验证命令为临时 Maven + 临时 mirror settings，并记录完整 `mvn test` 结果为 `Tests run: 795, Failures: 0, Errors: 0, Skipped: 0`。
- 本批只修正文档中的工具链和验证状态，不改变 RabbitMQ 行为。

第二百三十三批工作说明：

- 修复 `NotificationInAppProviderListenerNoopPlanService` 编译错误：`classificationAckNackPlan` 从 input adapter 方法移回 `validatorInvocationGatePlan`，使用 validator gate 的 `ready` 状态生成预案。
- 修复测试编译基线：`MigrationJobServiceTest` 补齐 completion/failure helper 依赖链，messaging plan 测试将 `List<?>` / `Map<?, ?>` 断言机械收窄为明确类型，避免 AssertJ 通配符捕获。
- 修复 4 个全量测试失败：组织开通完成测试 SQL stub 区分 `user_tenant_mapping`，事件消费日志 failed 重认领 stub 区分 reclaim update，站内信 provider/gate fixture 与当前 dry-run plan 对齐。
- 已执行完整 `mvn test`，结果 `Tests run: 795, Failures: 0, Errors: 0, Skipped: 0`。

第二百三十四批工作说明：

- `NotificationInAppProviderListenerNoopPlanService.inputAdapterPlan` 新增 `consumerResultExtractionPlan`，明确未来真实 result adapter 从 `OrganizationProvisioningCompletedNotificationConsumeResult` 到 `consumerResult` 参数的提取 dry-run 契约。
- `consumerResultExtractionPlan` 只记录 source/target、`targetResultPath`、failure strategy 和 next action；当前不读取专用 consumer 返回值，不构造 `consumerResult`，不转发 validator，不执行 classification 或 ack/nack。
- `NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `buildPlanDocumentsConsumerResultExtractionDryRunWithoutReadingResult()`；`NotificationInAppProviderAutoExecutionAdapterPlanServiceTest` 补充嵌套 extraction plan 断言。
- 已执行完整 `mvn test`，结果 `Tests run: 796, Failures: 0, Errors: 0, Skipped: 0`。

第二百三十五批工作说明：

- 新增 `NotificationInAppProviderConsumerResultAdapterService` 纯 adapter 骨架，用于把 ackable 且带 `sendPlan` 的 `OrganizationProvisioningCompletedNotificationConsumeResult` 包装成 validator 所需 `consumerResult` dry-run 结果。
- 新增 `NotificationInAppProviderConsumerResultAdapterServiceTest`，覆盖成功 result 带 `sendPlan`、result 缺失、duplicate 无 `sendPlan`、非 ackable result 四种边界；确认不调用 validator/manual execution，不执行 RabbitMQ ack/nack。
- 本批不接入 `NotificationRoutingRabbitListener`，不调用 `classify(...)`，不改变 RabbitMQ 行为。
- 已执行目标测试 `NotificationInAppProviderConsumerResultAdapterServiceTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderAutoExecutionAdapterPlanServiceTest`，结果 `Tests run: 33, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 800, Failures: 0, Errors: 0, Skipped: 0`。

第二百三十六批工作说明：

- 新增 `NotificationInAppProviderConsumerResultClassificationBridgeService`，在独立 service 中串联 `NotificationInAppProviderConsumerResultAdapterService.adapt(...)` 与 `NotificationInAppProviderConsumerResultValidationPlanService.classify(...)`。
- bridge 只输出 dry-run Map 和未来 return/throw、ack/nack 决策预案；adapter blocked 时不调用 validator，validator blocked/ready 时分别映射到 future validation blocked/ready 场景。
- 新增 `NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，覆盖 adapter blocked、validator blocked、validator ready 和全场景 side-effect false；`NotificationRoutingRabbitListenerTest` 仍确认 listener 未调用 `classify(...)`。
- 本批不接入 `NotificationRoutingRabbitListener`，不执行 manual execution，不执行 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderConsumerResultClassificationBridgeServiceTest,NotificationInAppProviderConsumerResultAdapterServiceTest,NotificationInAppProviderConsumerResultValidationPlanServiceTest,NotificationRoutingRabbitListenerTest`，结果 `Tests run: 35, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 804, Failures: 0, Errors: 0, Skipped: 0`。

第二百三十七批工作说明：

- `NotificationInAppProviderListenerNoopPlanService.validatorInvocationGatePlan` 新增 `classificationBridgeGatePlan`，用于描述未来 listener 调用 `NotificationInAppProviderConsumerResultClassificationBridgeService.classifyDryRun(...)` 的安全门。
- `classificationBridgeGatePlan` 只展示 bridge bean/method、allowed 状态、next action 和 side-effect flags；当前不调用 bridge，不转发 consumer result，不执行 adapter/classify/manual execution/ack/nack。
- `NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `buildPlanDocumentsClassificationBridgeGateWithoutInvokingBridge()`，覆盖 blocked 与 ready 两个安全门状态。
- 已执行目标测试 `NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderAutoExecutionAdapterPlanServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 34, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 805, Failures: 0, Errors: 0, Skipped: 0`。

第二百三十八批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsClassificationBridgeOutOfListenerBeforeBridgeIntegration()`，作为 listener 正式接入 bridge 前的源码保护。
- 测试锁定当前 `NotificationRoutingRabbitListener` 仍未注入 `NotificationInAppProviderConsumerResultClassificationBridgeService`，未调用 `classifyDryRun(...)`，未读取真实 `sendPlan/providerPlan/inAppExecutionPlan`，也未执行手动 ack/nack/reject。
- 本批只补源码保护测试，不修改生产代码。
- 已执行目标测试 `NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest`，结果 `Tests run: 39, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 806, Failures: 0, Errors: 0, Skipped: 0`。

第二百三十九批工作说明：

- `classificationBridgeGatePlan` 新增 `bridgeOutcomeDecisionMatrix`，固定 adapter blocked、future validation blocked、future validation ready 三类 bridge 结果到未来 listener return/throw 和 ack/nack 的映射。
- `NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `buildPlanDocumentsClassificationBridgeOutcomeDecisionMatrixWithoutExecutingBridge()`，确认矩阵顺序和 side-effect flags。
- 本批只扩展 no-op dry-run 预案，不调用 bridge，不修改 `NotificationRoutingRabbitListener`，不改变 RabbitMQ 行为。
- 已执行目标测试 `NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest,NotificationRoutingRabbitListenerTest`，结果 `Tests run: 44, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 807, Failures: 0, Errors: 0, Skipped: 0`。

第二百四十批工作说明：

- 新增配置 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_ENABLED`，默认 `false`，用于单独控制 `classificationBridgeGatePlan` 是否显示 ready。
- `classificationBridgeGatePlan` 现在必须同时满足 validator invocation ready 与 bridge gate enabled，才允许 future bridge invocation dry-run；blocked reasons 区分 validator 未 ready 与 bridge gate 未开启。
- `NotificationInAppProviderListenerNoopPlanServiceTest` 新增 bridge gate blocked reasons 和配置命名一致性测试，覆盖 `application.yml`、`application-local.yml`、`application-prod.yml`、`AppProperties` 和 README。
- 本批不接入 `NotificationRoutingRabbitListener`，不调用 bridge，不改变 RabbitMQ 行为。
- 已执行目标测试 `NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderAutoExecutionAdapterPlanServiceTest,NotificationRoutingRabbitListenerTest`，结果 `Tests run: 51, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 809, Failures: 0, Errors: 0, Skipped: 0`。

第二百四十一批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceDocumentsFutureBridgeInvocationPolicyBeforeListenerIntegration()`，在正式接入 bridge 前固定 future listener bridge invocation policy。
- 矩阵明确 `duplicate_without_send_plan` 不调用 bridge，保持 `return_to_container_policy`；`consumed_adapter_blocked` 与 `consumed_validation_blocked` 才进入未来 throw/retry/DLQ 路径；`consumed_validation_ready` 保持 return，等待后续 manual execution 结果批次。
- 测试同时确认当前 listener 仍未注入 bridge、未调用 `classifyDryRun(...)`，且 duplicate 仍属于 `ackable`。
- 本批只补源码策略测试，不修改生产代码，不改变 RabbitMQ 行为。
- 已执行目标测试 `NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest`，结果 `Tests run: 43, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 810, Failures: 0, Errors: 0, Skipped: 0`。

第二百四十二批工作说明：

- `NotificationRoutingRabbitListener` 新增最小 bridge dry-run 调用路径：在专用 consumer 返回 ackable 且 `result.consumed()`、`classificationBridgeGatePlan.bridgeInvocationAllowed=true` 时调用 `NotificationInAppProviderConsumerResultClassificationBridgeService.classifyDryRun(result)`。
- duplicate 结果即使 ackable 也继续 bypass bridge 并 return，避免已消费消息因为缺少 `sendPlan` 被误判为 adapter blocked 后反复重试。
- listener 只读取 no-op plan 中的 bridge gate，不读取真实 `sendPlan/providerPlan/inAppExecutionPlan`，不执行 manual execution，不新增手动 ack/nack/reject；bridge dry-run 结果当前不改变 listener return/throw。
- `NotificationRoutingRabbitListenerTest` 新增 consumed+bridge ready 调用和 duplicate+bridge ready bypass 两个行为测试，并更新源码边界测试到 bridge dry-run 后状态。
- 已执行目标测试 `NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 49, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 812, Failures: 0, Errors: 0, Skipped: 0`。

第二百四十三批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `onMessageKeepsReturnPolicyWhenBridgeDryRunReportsFutureThrowDecision()`，模拟 bridge dry-run 返回 `futureReturnThrowDecision=throw_for_retry_or_dlq_until_real_policy_batch`。
- 测试确认当前 listener 仍只把 bridge 结果作为只读 dry-run 观测，不根据 bridge blocked/throw 预案改变当前 return/throw，也不执行 RabbitMQ ack/nack。
- 本批只补安全边界测试，不修改生产代码。
- 已执行目标测试 `NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 50, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 813, Failures: 0, Errors: 0, Skipped: 0`。

第二百四十四批工作说明：

- `classificationBridgeGatePlan` 新增 `bridgeResultObservationPlan`，只描述未来从 `classifyDryRun(...)` 返回值观测 `classificationStatus/futureReturnThrowDecision/ackDecision/nackDecision` 等字段。
- 预案固定 `logMessageKey=notification.in_app_provider.bridge_result_dry_run`，但当前仍保持 `observationExecuted=false`、`logExecuted=false`、`databaseWriteExecuted=false`。
- 测试确认 bridge result 观测不会改变 listener return/throw，不改变 ack/nack policy，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderListenerNoopPlanServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 51, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 814, Failures: 0, Errors: 0, Skipped: 0`。

第二百四十五批工作说明：

- 新增配置 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_RETURN_THROW_ENABLED`，默认 `false`，用于单独控制未来 listener 是否允许根据 bridge dry-run 结果切换 return/throw。
- `classificationBridgeGatePlan` 新增 `bridgeReturnThrowPolicyGatePlan`，只有 bridge gate ready 且该新开关显式开启时才显示 `returnThrowPolicyChangeAllowed=true`。
- 测试确认该 gate 仍不改变当前 listener return/throw、不执行 manual execution、不执行 RabbitMQ ack/nack，并补齐 yml、`AppProperties`、README 的配置名对齐测试。
- 已执行目标测试 `NotificationInAppProviderListenerNoopPlanServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 53, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 816, Failures: 0, Errors: 0, Skipped: 0`。

第二百四十六批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceDoesNotReadBridgeReturnThrowPolicyGateBeforePolicySwitchIntegration()`，锁定当前 listener 只读取 `classificationBridgeGatePlan.bridgeInvocationAllowed`。
- 测试确认 listener 当前不读取 `bridgeReturnThrowPolicyGatePlan`、`returnThrowPolicyChangeAllowed`、`futureReturnThrowDecision` 或 `bridgeResultObservationPlan`，不根据新 gate 改变 return/throw。
- 本批只补源码保护测试，不修改生产代码，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 54, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 817, Failures: 0, Errors: 0, Skipped: 0`。

第二百四十七批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `onMessageKeepsReturnPolicyWhenReturnThrowPolicyGateIsReadyButSwitchNotIntegrated()`，模拟 no-op plan 中 `bridgeReturnThrowPolicyGatePlan.returnThrowPolicyChangeAllowed=true`。
- bridge dry-run 同时返回 `futureReturnThrowDecision=throw_for_retry_or_dlq_until_real_policy_batch`，测试确认当前 listener 仍只执行 dry-run 调用并 return，不根据 policy gate 或 bridge 返回值抛错。
- 本批只补行为安全边界测试，不修改生产代码，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 55, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 818, Failures: 0, Errors: 0, Skipped: 0`。

第二百四十八批工作说明：

- 新增 `NotificationInAppProviderBridgeReturnThrowPolicyDecisionService`，作为 bridge result 到 listener return/throw 策略的独立 dry-run 决策适配器。
- `decideDryRun(bridgeResult, policyGatePlan)` 会读取 `futureReturnThrowDecision` 与 `returnThrowPolicyChangeAllowed`，输出 future listener decision 预案，但固定 `decisionApplied=false`、`throwRequested=false`、`listenerPolicyChanged=false`。
- 新增 `NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest` 覆盖 policy gate blocked、policy gate ready + future throw、bridge result missing 三类场景。
- 本批不接入 `NotificationRoutingRabbitListener`，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationRoutingRabbitListenerTest`，结果 `Tests run: 58, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 821, Failures: 0, Errors: 0, Skipped: 0`。

第二百四十九批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsReturnThrowPolicyDecisionServiceOutOfListenerBeforeIntegration()`，锁定 `NotificationInAppProviderBridgeReturnThrowPolicyDecisionService` 尚未注入 listener。
- 测试确认 listener 当前仍只调用 `consumerResultClassificationBridgeService.classifyDryRun(result)`，不调用 `decideDryRun(...)`，不读取 `futureListenerDecision/decisionApplied/throwRequested`。
- 本批只补源码保护测试，不修改生产代码，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationRoutingRabbitListenerTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest,NotificationInAppProviderListenerNoopPlanServiceTest`，结果 `Tests run: 59, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 822, Failures: 0, Errors: 0, Skipped: 0`。

第二百五十批工作说明：

- `NotificationInAppProviderBridgeReturnThrowPolicyDecisionService` 新增 `decisionObservationPlan`，只描述未来观测 `classificationStatus/futureReturnThrowDecision/futureListenerDecision/decisionRequested/blockedReasons` 等字段。
- 预案固定 `logMessageKey=notification.in_app_provider.bridge_return_throw_decision_dry_run`，但当前仍保持 `observationExecuted=false`、`logExecuted=false`、`databaseWriteExecuted=false`。
- 测试确认 ready 与 blocked 场景都不会应用决策，不抛错，不改变 listener policy，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationRoutingRabbitListenerTest`，结果 `Tests run: 59, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 822, Failures: 0, Errors: 0, Skipped: 0`。

第二百五十一批工作说明：

- 新增 `NotificationInAppProviderBridgeReturnThrowDecisionDryRunService`，独立串联 `NotificationInAppProviderConsumerResultClassificationBridgeService.classifyDryRun(...)` 与 `NotificationInAppProviderBridgeReturnThrowPolicyDecisionService.decideDryRun(...)`。
- 组合 service 输出 `bridgeResult` 与 `policyDecisionPlan`，并固定 `listenerInvoked=false`、`decisionApplied=false`、`throwRequested=false`、`rabbitAckExecuted=false`、`rabbitNackExecuted=false`。
- 新增 `NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest` 覆盖 policy gate blocked、policy gate ready + future throw、所有结果无 side effects 三类场景。
- 本批不接入 `NotificationRoutingRabbitListener`，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationRoutingRabbitListenerTest`，结果 `Tests run: 62, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 825, Failures: 0, Errors: 0, Skipped: 0`。

第二百五十二批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsReturnThrowDecisionDryRunCompositionOutOfListenerBeforeIntegration()`，锁定 `NotificationInAppProviderBridgeReturnThrowDecisionDryRunService` 尚未注入 listener。
- 测试确认 listener 当前不读取 `policyDecisionPlan`、`bridgeDryRunExecuted`、`policyDecisionDryRunExecuted` 或 `ready_for_listener_return_throw_decision_dry_run`，不执行组合 return/throw 决策。
- 本批只补源码保护测试，不修改生产代码，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationRoutingRabbitListenerTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest,NotificationInAppProviderListenerNoopPlanServiceTest`，结果 `Tests run: 63, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 826, Failures: 0, Errors: 0, Skipped: 0`。

第二百五十三批工作说明：

- 新增配置 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_DECISION_DRY_RUN_ENABLED`，默认 `false`，用于单独控制未来 listener 是否允许只读调用组合 dry-run。
- `classificationBridgeGatePlan` 新增 `bridgeDecisionDryRunInvocationGatePlan`，只有 bridge gate ready 且该新开关显式开启时才显示 `decisionDryRunInvocationAllowed=true`。
- 测试确认该 gate 仍不执行组合 dry-run、不应用 return/throw 决策、不改变 listener policy、不执行 manual execution 或 RabbitMQ ack/nack，并补齐 yml、`AppProperties`、README 的配置名对齐测试。
- 已执行目标测试 `NotificationInAppProviderListenerNoopPlanServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 65, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 828, Failures: 0, Errors: 0, Skipped: 0`。

第二百五十四批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 listener 读取组合 dry-run gate 前的源码保护；第二百五十五批 read-only 接入后，该保护演进为 `sourceReadsBridgeDecisionDryRunInvocationGateOnlyForReadOnlyComposition()`。
- 该源码保护锁定 listener 在正式 read-only 接入前不读取 `bridgeDecisionDryRunInvocationGatePlan` / `decisionDryRunInvocationAllowed`，不注入 `NotificationInAppProviderBridgeReturnThrowDecisionDryRunService`，也不调用 `decideDryRun(...)`。
- 本批不修改生产 listener，不执行组合 dry-run，不应用 return/throw 决策，不改变当前容器 ack 策略，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderListenerNoopPlanServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 66, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 829, Failures: 0, Errors: 0, Skipped: 0`。

第二百五十五批工作说明：

- `NotificationRoutingRabbitListener` 新增 `NotificationInAppProviderBridgeReturnThrowDecisionDryRunService` 依赖。
- listener 在 consumed、classification bridge gate ready 且 `bridgeDecisionDryRunInvocationGatePlan.decisionDryRunInvocationAllowed=true` 时，只读调用 `bridgeReturnThrowDecisionDryRunService.decideDryRun(result, bridgeReturnThrowPolicyGatePlan(listenerNoopPlan))`。
- decision dry-run gate 未 ready 时仍保持原来的 `consumerResultClassificationBridgeService.classifyDryRun(result)` 路径，避免在默认配置下改变现有行为。
- 本批不读取 `policyDecisionPlan`，不应用 `futureListenerDecision`，不改变 listener return/throw 策略，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationRoutingRabbitListenerTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 67, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 830, Failures: 0, Errors: 0, Skipped: 0`。

第二百五十六批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `onMessageIgnoresDecisionDryRunOutputAndKeepsReturnPolicy()`。
- 该场景让组合 dry-run 返回 `policyDecisionPlan.futureListenerDecision=throw_for_retry_or_dlq_until_real_policy_batch`，确认当前 listener 仍只读调用，不读取该输出、不抛错、不改变 return 策略。
- 本批只补行为边界测试，不修改生产代码，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationRoutingRabbitListenerTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 68, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 831, Failures: 0, Errors: 0, Skipped: 0`。

第二百五十七批工作说明：

- `NotificationInAppProviderBridgeReturnThrowDecisionDryRunService` 输出新增 `decisionOutputObservationPlan`。
- 该 observation plan 描述未来可观测字段：`bridgeResult.classificationStatus`、`bridgeResult.futureReturnThrowDecision`、`policyDecisionPlan.planStatus`、`policyDecisionPlan.futureListenerDecision`、`policyDecisionPlan.decisionApplied`、`blockedReasons`。
- 预案固定 `logMessageKey=notification.in_app_provider.bridge_return_throw_decision_dry_run`，但当前 `observationRequested=false`、`logExecuted=false`、`databaseWriteExecuted=false`。
- 本批不修改 listener，不写日志/数据库，不应用 return/throw 决策，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 69, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 832, Failures: 0, Errors: 0, Skipped: 0`。

第二百五十八批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceDoesNotReadDecisionOutputObservationPlanBeforeLoggingIntegration()`。
- 该源码保护锁定 listener 当前只调用组合 dry-run，不读取 `decisionOutputObservationPlan` / `logMessageKey`，不执行 observation/log/database write。
- 本批只补测试，不修改生产代码，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationRoutingRabbitListenerTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 70, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 833, Failures: 0, Errors: 0, Skipped: 0`。

第二百五十九批工作说明：

- 新增配置 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_DECISION_DRY_RUN_OBSERVATION_LOG_ENABLED`，默认 `false`，用于未来组合 dry-run 输出 observation logging 的独立安全门。
- `bridgeDecisionDryRunInvocationGatePlan` 新增 `decisionOutputObservationLoggingGatePlan`，只有 decision dry-run listener 调用 ready 且该新开关显式开启时才显示 `observationLoggingAllowed=true`。
- 本批只生成 logging gate 预案，不读取 listener 中的 `decisionOutputObservationPlan`，不执行 observation logging，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 新增配置名对齐测试，覆盖 yml、`AppProperties`、README 与 no-op plan 字段一致。
- 已执行目标测试 `NotificationInAppProviderListenerNoopPlanServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 72, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 835, Failures: 0, Errors: 0, Skipped: 0`。

第二百六十批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceDoesNotReadDecisionOutputObservationLoggingGateBeforeIntegration()`。
- 该源码保护锁定 listener 当前不读取 `decisionOutputObservationLoggingGatePlan` / `observationLoggingAllowed`，不执行日志调用、不写数据库。
- 本批只补测试，不修改生产代码，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 73, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 836, Failures: 0, Errors: 0, Skipped: 0`。

第二百六十一批工作说明：

- `decisionOutputObservationLoggingGatePlan` 新增 `observationLoggingPayloadPlan`。
- 该 payload 预案固定未来日志字段：`eventId`、`idempotencyKey`、`bridgeResult.classificationStatus`、`bridgeResult.futureReturnThrowDecision`、`policyDecisionPlan.planStatus`、`policyDecisionPlan.futureListenerDecision`、`policyDecisionPlan.decisionApplied`、`blockedReasons`、`logMessageKey`。
- 本批只描述 payload 字段，不构造 payload、不写日志、不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderListenerNoopPlanServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 74, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 837, Failures: 0, Errors: 0, Skipped: 0`。

第二百六十二批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceDoesNotReadObservationLoggingPayloadPlanBeforeIntegration()`。
- 该源码保护锁定 listener 当前不读取 `observationLoggingPayloadPlan` / `payloadFields`，不构造日志 payload，不执行日志调用或数据库写入。
- 本批只补测试，不修改生产代码，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 75, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 838, Failures: 0, Errors: 0, Skipped: 0`。

第二百六十三批工作说明：

- 新增 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunService`，独立构造组合 dry-run observation log payload 的 read-only dry-run 预览。
- 该 service 只有在 `observationLoggingAllowed=true`、source result 存在且 `decisionOutputObservationPlan` 存在时才返回 `payloadBuildExecuted=true`；blocked 时只给 blockedReasons，不构造 payload。
- payload 预览包含 `eventId`、`idempotencyKey`、`bridgeResult.classificationStatus`、`bridgeResult.futureReturnThrowDecision`、`policyDecisionPlan.planStatus`、`policyDecisionPlan.futureListenerDecision`、`policyDecisionPlan.decisionApplied`、`blockedReasons`、`logMessageKey`。
- 本批不接入 listener，不执行 log/database write，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 77, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 840, Failures: 0, Errors: 0, Skipped: 0`。

第二百六十四批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceDoesNotInjectObservationLogPayloadDryRunServiceBeforeIntegration()`。
- 该源码保护锁定 listener 当前构造器依赖面仍为 9 个，不注入或调用 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunService`，不调用 `buildDryRun(...)`，不读取 `payloadPreview` / `payloadBuildExecuted`。
- 本批只补测试，不修改生产代码，不接入 listener payload 构造，不执行 log/database write，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 78, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 841, Failures: 0, Errors: 0, Skipped: 0`。

第二百六十五批工作说明：

- `NotificationRoutingRabbitListener` 在 decision dry-run gate ready 的路径中注入并只读调用 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunService`。
- listener 现在会保存 `decisionDryRunPlan`，并把 `result`、`decisionDryRunPlan`、`decisionOutputObservationLoggingGatePlan(listenerNoopPlan)` 传给 `buildDryRun(...)`；返回值仍不参与 return/throw、ack/nack 或日志写入。
- `NotificationRoutingRabbitListenerTest` 更新行为断言和源码保护，确认构造器依赖面为 10 个、payload dry-run 只在 decision dry-run ready 路径调用、listener 不读取 `payloadPreview` / `payloadBuildExecuted`，不执行 log/database write。
- 本批不执行 observation logging，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 78, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 841, Failures: 0, Errors: 0, Skipped: 0`。

第二百六十六批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `onMessageInvokesPayloadDryRunWithBlockedLoggingGateAndKeepsReturnPolicy()`。
- 该测试覆盖 decision dry-run gate ready 但 observation logging gate 仍 blocked 的路径，确认 listener 仍会把 blocked logging gate 传给 payload dry-run service。
- 测试锁定 `observationLoggingAllowed=false` 时 `logExecuted=false`、`databaseWriteExecuted=false`、`rabbitAckExecuted=false`、`rabbitNackExecuted=false`，listener 仍保持 return-to-container 行为。
- 本批只补行为测试，不修改生产代码，不执行 log/database write，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 79, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 842, Failures: 0, Errors: 0, Skipped: 0`。

第二百六十七批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `onMessageIgnoresPayloadDryRunOutputAndKeepsReturnPolicy()`。
- 该测试让 payload dry-run service 返回包含 `payloadPreview`、`throwRequested=true`、`rabbitNackExecuted=true` 的结果，确认 listener 不读取这些输出字段，仍按当前 return-to-container 策略返回。
- 本批只补行为测试，不修改生产代码，不执行 log/database write，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 80, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 843, Failures: 0, Errors: 0, Skipped: 0`。

第二百六十八批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceDoesNotPerformObservationLoggingAfterPayloadDryRunIntegration()`。
- 该源码保护确认 listener 已允许 `observationLogPayloadDryRunService.buildDryRun(...)` 和 `decisionOutputObservationLoggingGatePlan(listenerNoopPlan)`，但仍不引入 `LoggerFactory`、`.info(...)` / `.warn(...)`、`payloadDryRunPlan`、`payloadPreview`、`payloadBuildExecuted`、`eventConsumeLog` 或 `databaseWriteExecuted`。
- 本批只补源码保护测试，不修改生产代码，不执行 log/database write，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 81, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 844, Failures: 0, Errors: 0, Skipped: 0`。

第二百六十九批工作说明：

- 新增 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunService`，用于根据 payload dry-run plan 与 logging gate 生成只读 observation logging 预案。
- 该 service 仅在 `observationLoggingAllowed=true`、`payloadBuildExecuted=true` 且 `payloadPreview` 存在时返回 `ready_for_bridge_return_throw_decision_observation_log_dry_run`；blocked 时只返回 blockedReasons。
- 输出包含 `logMessageKey`、`logPayloadPreview`、`observationLoggingRequested=true`、`logPlanned` 和完整副作用保护字段，但固定 `observationLoggingExecuted=false`、`logExecuted=false`、`databaseWriteExecuted=false`。
- 本批不接入 listener，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 83, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 846, Failures: 0, Errors: 0, Skipped: 0`。

第二百七十批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceDoesNotInjectObservationLogDryRunServiceBeforeIntegration()`。
- 该源码保护确认 listener 当前只注入并调用 payload dry-run service，尚未注入或调用 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunService`。
- 测试同时锁定 listener 不读取 `logPayloadPreview`、不出现 `observationLoggingExecuted` / `logPlanned` / `logExecuted`，不引入 Logger 或数据库写入痕迹。
- 本批只补源码保护测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 84, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 847, Failures: 0, Errors: 0, Skipped: 0`。

第二百七十一批工作说明：

- `NotificationRoutingRabbitListener` 在 payload dry-run 之后只读调用 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunService`。
- listener 现在会保存 `loggingGatePlan` 和 `payloadDryRunPlan`，调用 `observationLogDryRunService.buildDryRun(payloadDryRunPlan, loggingGatePlan)`；返回值仍不参与当前 listener 策略。
- `NotificationRoutingRabbitListenerTest` 更新构造器依赖面为 11 个，并覆盖 payload dry-run plan 被传入 observation log dry-run service 的行为。
- 本批不调用 Logger，不读取 observation log dry-run 返回值，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 84, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 847, Failures: 0, Errors: 0, Skipped: 0`。

第二百七十二批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `onMessageIgnoresObservationLogDryRunOutputAndKeepsReturnPolicy()`。
- 该测试让 observation log dry-run service 返回包含 `logPayloadPreview`、`logExecuted=true`、`databaseWriteExecuted=true`、`rabbitNackExecuted=true` 的结果，确认 listener 不读取这些输出字段，仍按当前 return-to-container 策略返回。
- 本批只补行为测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 85, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 848, Failures: 0, Errors: 0, Skipped: 0`。

第二百七十三批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsLoggerAndDatabaseWritesOutBeforeObservationLoggingExecutionIntegration()`。
- 该源码保护确认 listener 已调用 observation log dry-run service，但正式 observation logging 执行接入前仍不引入 `Logger`/`LoggerFactory`、`.info/.warn/.error`、`eventConsumeLog`、`in_app_notification` 或 `databaseWrite` 痕迹。
- 本批只补源码保护测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 86, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 849, Failures: 0, Errors: 0, Skipped: 0`。

第二百七十四批工作说明：

- 新增 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunService`，用于把 observation log dry-run plan 格式化为日志消息预览。
- 该 service 仅在 `logPlanned=true`、`logPayloadPreview` 存在且 `logMessageKey` 非空时返回 `ready_for_bridge_return_throw_decision_observation_log_message_dry_run`；blocked 时返回具体原因。
- 输出 `formattedMessagePreview`、`messageFormattingPreviewGenerated`、`loggerInvocationExecuted=false` 等字段；只生成纯内存预览，不调用 Logger，不写数据库。
- 新增 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunServiceTest`，覆盖 ready 格式化和 blocked 输入场景。
- 本批不接 listener，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 88, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 851, Failures: 0, Errors: 0, Skipped: 0`。

第二百七十五批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceDoesNotInjectObservationLogMessageDryRunServiceBeforeIntegration()`。
- 该源码保护确认 listener 当前已调用 observation log dry-run service，但尚未注入或调用 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunService`。
- 测试同时锁定 listener 不读取 `formattedMessagePreview`、不使用 `messageFormattingPreviewGenerated` 或 `loggerInvocationExecuted`，不引入 Logger、数据库写入或 RabbitMQ ack/nack 痕迹。
- 本批只补源码保护测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 89, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 852, Failures: 0, Errors: 0, Skipped: 0`。

第二百七十六批工作说明：

- `NotificationRoutingRabbitListener` 新增只读依赖 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunService`。
- listener 在 `observationLogDryRunService.buildDryRun(...)` 后保存 observation log dry-run plan，并调用 `observationLogMessageDryRunService.buildDryRun(observationLogDryRunPlan)`。
- `NotificationRoutingRabbitListenerTest` 更新构造器依赖面为 12 个，并覆盖 observation log dry-run plan 被传入 message dry-run service 的行为。
- 本批不读取 message dry-run 返回值，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 89, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 852, Failures: 0, Errors: 0, Skipped: 0`。

第二百七十七批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `onMessageIgnoresObservationLogMessageDryRunOutputAndKeepsReturnPolicy()`。
- 该测试让 message dry-run service 返回包含 `formattedMessagePreview`、`messageFormattingPreviewGenerated=true`、`loggerInvocationExecuted=true`、`logExecuted=true`、`databaseWriteExecuted=true`、`rabbitNackExecuted=true` 的结果，确认 listener 不读取这些输出字段，仍按当前 return-to-container 策略返回。
- 本批只补行为测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 90, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 853, Failures: 0, Errors: 0, Skipped: 0`。

第二百七十八批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsLoggerOutAfterObservationLogMessageDryRunIntegration()`。
- 该源码保护确认 listener 已调用 message dry-run service 后，仍不读取 `formattedMessagePreview` 或 `loggerInvocationExecuted`，不引入 `Logger`/`LoggerFactory`、`.info/.warn/.error`、`eventConsumeLog`、`in_app_notification` 或 `databaseWrite` 痕迹。
- 本批只补源码保护测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 91, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 854, Failures: 0, Errors: 0, Skipped: 0`。

第二百七十九批工作说明：

- 新增 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunService`，用于根据 message dry-run plan 和 logger invocation gate 生成 Logger 调用安全门 dry-run 预案。
- 该 service 仅在 `loggerInvocationAllowed=true`、`messageFormattingPreviewGenerated=true` 且 `formattedMessagePreview` 非空时返回 `ready_for_bridge_return_throw_decision_observation_logger_invocation_dry_run`。
- 输出 `loggerNamePreview`、`logLevelPreview`、`formattedMessagePreview`、`loggerInvocationPlanned`，但固定 `loggerInvocationExecuted=false`、`logExecuted=false`、`databaseWriteExecuted=false`。
- 新增 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunServiceTest`，覆盖 ready 预案和 blocked 输入/安全门场景。
- 本批不接 listener，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 93, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 856, Failures: 0, Errors: 0, Skipped: 0`。

第二百八十批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceDoesNotInjectObservationLoggerInvocationDryRunServiceBeforeIntegration()`。
- 该源码保护确认 listener 当前已调用 message dry-run service，但尚未注入或调用 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunService`。
- 测试同时锁定 listener 不读取 `loggerInvocationPlanned`、`loggerNamePreview`、`logLevelPreview`，不引入 Logger、数据库写入或 RabbitMQ ack/nack 痕迹。
- 本批只补源码保护测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 94, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 857, Failures: 0, Errors: 0, Skipped: 0`。

第二百八十一批工作说明：

- `NotificationRoutingRabbitListener` 新增只读依赖 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunService`。
- listener 在 message dry-run 后保存 `messageDryRunPlan`，调用 `observationLoggerInvocationDryRunService.buildDryRun(messageDryRunPlan, loggerInvocationGatePlan(loggingGatePlan))`。
- `loggerInvocationGatePlan(...)` 仅把 observation logging gate 中的 `observationLoggingAllowed` 转成 `loggerInvocationAllowed`，不读取 message dry-run 返回值，不调用真实 Logger。
- `NotificationRoutingRabbitListenerTest` 更新构造器依赖面为 13 个，并覆盖 message dry-run plan 被传入 logger invocation dry-run service 的行为。
- 本批不读取 logger invocation dry-run 返回值，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 94, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 857, Failures: 0, Errors: 0, Skipped: 0`。

第二百八十二批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `onMessageIgnoresObservationLoggerInvocationDryRunOutputAndKeepsReturnPolicy()`。
- 该测试让 logger invocation dry-run service 返回包含 `loggerInvocationPlanned=true`、`loggerNamePreview`、`logLevelPreview`、`loggerInvocationExecuted=true`、`logExecuted=true`、`databaseWriteExecuted=true`、`rabbitNackExecuted=true` 的结果，确认 listener 不读取这些输出字段，仍按当前 return-to-container 策略返回。
- 本批只补行为测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 95, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 858, Failures: 0, Errors: 0, Skipped: 0`。

第二百八十三批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsRealLoggerOutAfterLoggerInvocationDryRunIntegration()`。
- 该源码保护确认 listener 已调用 logger invocation dry-run service 后，仍不读取 `loggerInvocationPlanned` 或 `loggerInvocationExecuted`，不引入 `Logger`/`LoggerFactory`、`.info/.warn/.error`、`eventConsumeLog`、`in_app_notification` 或 `databaseWrite` 痕迹。
- 本批只补源码保护测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 96, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 859, Failures: 0, Errors: 0, Skipped: 0`。

第二百八十四批工作说明：

- 新增 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanService`，用于定义未来真实 Logger 调用前的最小灰度执行合同。
- 该 service 只有在 `loggerInvocationPlanned=true`、`formattedMessagePreview` 非空且 `loggerExecutionAllowed=true` 时，才返回 `ready_for_guarded_observation_logger_execution`。
- 输出 `loggerExecutionRequiresExplicitGate=true`、`allowedLoggerName=NotificationRoutingRabbitListener`、`allowedLogLevel=INFO` 和 `allowedMessageSource=formattedMessagePreview`，但固定 `loggerInvocationExecuted=false`、`logExecuted=false`、`databaseWriteExecuted=false`、`rabbitAckExecuted=false`、`rabbitNackExecuted=false`。
- 新增 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanServiceTest`，覆盖 ready、blocked 和源码红线：该 service 不持有 `Logger`/`LoggerFactory`，不调用 `.info/.warn/.error`，不写库，不手动 ack/nack/reject。
- 本批不接 listener，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 99, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 862, Failures: 0, Errors: 0, Skipped: 0`。

第二百八十五批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceDoesNotInjectLoggerExecutionPlanServiceBeforeIntegration()`。
- 该源码保护确认 listener 当前仍只有 13 个依赖，已调用 logger invocation dry-run service，但尚未注入或调用 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanService`。
- 测试同时锁定 listener 不读取 `loggerExecutionAllowed`、`loggerExecutionPlanned`、`loggerExecutionRequiresExplicitGate`、`allowedLogLevel` 或 `allowedMessageSource`，不引入 `Logger`/`LoggerFactory`、`.info/.warn/.error`、数据库写入或 RabbitMQ 手动 ack/nack/reject。
- 本批只补源码保护测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 100, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 863, Failures: 0, Errors: 0, Skipped: 0`。

第二百八十六批工作说明：

- `NotificationRoutingRabbitListener` 注入 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanService`，依赖面从 13 个扩展为 14 个。
- listener 在 logger invocation dry-run 后保存 `loggerInvocationDryRunPlan`，并只读调用 `observationLoggerExecutionPlanService.buildPlan(loggerInvocationDryRunPlan, loggerExecutionGatePlan(loggingGatePlan))`。
- `loggerExecutionGatePlan(...)` 仅把 observation logging gate 中的 `observationLoggingAllowed` 转成 `loggerExecutionAllowed`，不读取 execution plan 返回值，不调用真实 Logger。
- `NotificationRoutingRabbitListenerTest` 将 `onMessageIgnoresLoggerInvocationAndExecutionPlanOutputsAndKeepsReturnPolicy()` 扩展为覆盖 execution plan 输出隔离；即使返回 `loggerExecutionPlanned/logExecuted/databaseWriteExecuted/rabbitNackExecuted=true`，listener 仍保持当前 return 策略。
- 本批不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 100, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 863, Failures: 0, Errors: 0, Skipped: 0`。

第二百八十七批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsRealLoggerOutAfterLoggerExecutionPlanIntegration()`。
- 该源码保护确认 listener 已只读调用 logger execution plan service 后，仍不读取 `loggerExecutionPlanned`、`allowedLogLevel` 或 `allowedMessageSource`，不引入 `Logger`/`LoggerFactory`、`.info/.warn/.error`、`eventConsumeLog`、`in_app_notification` 或 `databaseWrite` 痕迹。
- 本批只补源码保护测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 101, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 864, Failures: 0, Errors: 0, Skipped: 0`。

第二百八十八批工作说明：

- `NotificationRoutingRabbitListener` 引入真实 `Logger`，新增 `invokeLoggerIfPlanned(...)`，只在 logger execution plan 返回 `loggerExecutionPlanned=true`、`allowedLogLevel=INFO`、`allowedMessageSource=formattedMessagePreview` 且 `formattedMessagePreview` 非空时调用 `LOGGER.info(...)`。
- listener 仍通过 `observationLoggerExecutionPlanService.buildPlan(...)` 获取灰度执行计划；除上述日志字段外，不读取数据库写入、return/throw、manual execution 或 RabbitMQ ack/nack 类字段。
- `NotificationRoutingRabbitListenerTest` 将历史“完全禁止 Logger”的源码红线演进为“只允许 gated INFO Logger”，并保留 `.warn/.error`、`eventConsumeLog`、`in_app_notification`、`databaseWrite`、`basicAck/basicNack/basicReject` 禁止断言。
- 行为测试 `onMessageKeepsReturnPolicyAfterGatedLoggerExecutionPlan()` 覆盖 execution plan ready 后会进入 gated INFO 路径，但 listener 仍保持当前 return-to-container 策略。
- 本批只接入受控 INFO 观测日志，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 101, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 864, Failures: 0, Errors: 0, Skipped: 0`。

第二百八十九批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `onMessageSkipsLoggerWhenExecutionPlanIsNotGatedForInfoFormattedMessage()`，通过 logback `ListAppender` 捕获 listener 日志。
- 该测试覆盖 `loggerExecutionPlanned=false`、`allowedLogLevel!=INFO`、`allowedMessageSource!=formattedMessagePreview`、`formattedMessagePreview` 为空四类负向 execution plan，确认 listener 不输出 INFO 日志。
- 新增测试 helper 只构造完整 listener 成功路径并捕获日志；不修改生产代码。
- 本批只补 gated Logger 负向行为测试，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 102, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 865, Failures: 0, Errors: 0, Skipped: 0`。

第二百九十批工作说明：

- 新增 `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogWritePlanService`，用于描述未来 `event_consume_log` 数据库写入前的 dry-run 合同。
- 该 service 只有在 `loggerExecutionPlanned=true`、`formattedMessagePreview` 非空且 `eventConsumeLogWriteAllowed=true` 时，才返回 `ready_for_observation_event_consume_log_write_dry_run`。
- 输出 `targetTable=event_consume_log`、`writeMode=future_observation_log_insert_or_update`、`messageSource=formattedMessagePreview` 和 `databaseWritePlanned=true`，但固定 `databaseWriteExecuted=false`、`sqlExecuted=false`、`rabbitAckExecuted=false`、`rabbitNackExecuted=false`。
- 新增 `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogWritePlanServiceTest`，覆盖 ready、blocked 和源码红线：该 service 不持有 repository/mapper/JdbcTemplate，不调用 insert/save/update/execute，不手动 ack/nack/reject。
- 本批不接 listener，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogWritePlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 105, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 868, Failures: 0, Errors: 0, Skipped: 0`。

第二百九十一批工作说明：

- `NotificationRoutingRabbitListenerTest` 新增 `sourceDoesNotInjectEventConsumeLogWritePlanServiceBeforeIntegration()`。
- 该源码保护确认 listener 在 gated INFO Logger 接入后，仍未注入或调用 `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogWritePlanService`。
- 测试同时锁定 listener 不读取 `eventConsumeLogWriteAllowed`、`databaseWritePlanned` 或 `sqlExecuted`，不引入 JdbcTemplate/repository/mapper，不调用 insert/save/update，也不手动 ack/nack/reject。
- 本批只补源码保护测试，不修改生产代码，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution 或 RabbitMQ ack/nack。
- 已执行目标测试 `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogWritePlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest,NotificationRoutingRabbitListenerTest,NotificationInAppProviderListenerNoopPlanServiceTest,NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest,NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest,NotificationInAppProviderConsumerResultClassificationBridgeServiceTest`，结果 `Tests run: 106, Failures: 0, Errors: 0, Skipped: 0`。
- 已执行完整 `mvn test`，结果 `Tests run: 869, Failures: 0, Errors: 0, Skipped: 0`。

当前剩余流程评估（2026-07-06）：

- 旧 mock event handler 路由覆盖已补齐，当前重点不是继续补旧接口数量，而是补齐生产化链路。
- 剩余主要流程约 8 条：RabbitMQ notification no-op/validator/manual execution 灰度接入、站内信 websocket/push 投递、Kafka outbox 生产与消费闭环、Redis 缓存刷新策略联调、XXL-Job 真实调度与补偿、微信支付/退款/会员权益真实链路、LLM/Agent/招商爬虫真实外部集成、真实数据库/消息中间件/部署观测联调。
- 按当前“小批次、一个高风险场景一批”的节奏，核心灰度可用还需要约 25 到 40 个小批次；如果 JDK/Maven/Docker/真实数据库和消息中间件环境齐全，预计 3 到 6 周可以完成主要闭环和联调。
- 要完全替代旧后端并删除 `apps/backend-mock`，还需要至少 2 个完整发布周期稳定观察；现实估算约 6 到 10 周，不建议提前删除旧后端。

## 迁移边界

- 不删除 `apps/backend-mock`。
- 新后端仍使用 `/api` 前缀。
- 每批最多迁移 5 个接口。
- 简单 CRUD、单表分页、按 id 查询优先使用 MyBatis-Plus，减少手写 SQL。
- 复杂聚合、跨表统计、多租户动态库特殊逻辑可以使用 XML mapper 或少量 `JdbcTemplate`。
- Redis、Kafka、RabbitMQ、XXL-Job 是目标架构必选项。
- Kafka 业务接入必须走 outbox、幂等、重试、死信和监控。
- RabbitMQ 用于短信/企微/站内通知、轻量异步任务、延迟重试和 DLQ，不替代 Kafka 核心事件流。
- XXL-Job 用于组织开通、退款对账、财务同步补偿、催缴短信扫描、招商雷达爬虫、菜单同步和巡检任务。
- 旧后端稳定保留至少 2 个完整发布周期后，再评估下线。

## RabbitMQ 队列边界

当前只落基础拓扑、内部发送入口和组织开通完成 followup 的受控通知入队能力；不直接触发真实短信、企微、支付或爬虫副作用。

- `magic.notification.queue`：通知主队列。
- `magic.notification.retry.queue`：通知失败重试队列。
- `magic.notification.dlq`：通知死信队列。
- `magic.delay.retry.queue`：通用延迟重试队列。
- `magic.light-task.queue`：轻量任务队列。
- `magic.light-task.dlq`：轻量任务死信队列。

`magic.notification.queue` 当前同时承载登录验证码、合同提醒、催缴短信和组织开通完成通知。组织开通 notification consumer 必须通过 `RABBITMQ_ORGANIZATION_PROVISIONING_NOTIFICATION_CONSUMER_ENABLED=true` 单独灰度开启；未完成通用 notification consumer 前，不要把它作为全量通知消费者使用。当前 `NotificationRoutingPlanService` 只提供共享队列消息分类 dry-run，不会监听或确认 RabbitMQ 消息。 `RABBITMQ_NOTIFICATION_ROUTING_CONSUMER_ENABLED=true` 目前只用于通用路由 listener 骨架验收；开启后仍会抛错阻止 ack，不能作为生产通知消费者使用。 `RABBITMQ_NOTIFICATION_DISPATCH_ENABLED=true` 当前只让通用 listener 生成分发预检结果；即使 `dispatchAllowed=true`，也不会调用 handler 或确认消息。当前 `NotificationHandlerAdapterPlanService` 只生成组织开通完成通知的 adapter 选择和调用计划；即使 `adapterInvocationAllowed=true`，也不会调用专用 consumer 或确认消息。当前 `NotificationAdapterRequestValidationPlanService` 只生成组织开通完成通知的请求校验计划；即使 `requestValidationPassed=true`，也不会调用专用 consumer、写消费日志或确认消息。当前 `NotificationConsumerDelegationPlanService` 只生成组织开通完成通知的专用 consumer 委托计划；只有 `RABBITMQ_NOTIFICATION_CONSUMER_DELEGATION_ENABLED=true` 且 route guard 匹配时才会显示 `delegationAllowed=true`；第一百六十三批后，`delegationAllowed=true` 时通用 listener 会委托组织开通完成专用 consumer；只有专用 consumer 返回 `success/duplicate` 才会正常返回并由 RabbitMQ 容器确认消息。非目标 route 或非可确认结果仍抛错，不会静默 ack。第二百一十三批后，通用 listener 会在 ackable 专用 consumer 结果后调用 `NotificationInAppProviderListenerNoopPlanService.buildPlan(...)` 生成 no-op dry-run 预案；该预案只读取 delegation dry-run 里的后置 adapter 状态，不读取真实 `sendPlan/providerPlan/inAppExecutionPlan`，不调用 `NotificationInAppProviderConsumerResultValidationPlanService.classify(...)`，不调用 `OrganizationProvisioningCompletedInAppProviderManualExecutionService`，不执行 websocket/push，也不新增手动 `basicAck/basicNack/basicReject`。当前 validator dry-run 边界如下：

- `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_VALIDATOR_ENABLED=true` 只会让 `validatorInvocationGatePlan` 显示 ready 预案，不会执行真实 validator。
- `inputAdapterPlan` 只描述未来从 `dedicatedConsumerResult` 提取 `consumerResult` 的路径和前置条件，当前不构造或传递真实 consumer result 对象。
- `consumerResultExtractionPlan` 只描述未来从 `OrganizationProvisioningCompletedNotificationConsumeResult` 到 `consumerResult` 参数的提取契约，当前不读取专用 consumer 返回值，不构造真实入参。
- `NotificationInAppProviderConsumerResultAdapterService` 当前只在独立 service/test 中把 ackable 且带 `sendPlan` 的专用 consumer result 包装成 `consumerResult` dry-run Map；listener 仍不注入或调用该 service。
- `NotificationInAppProviderConsumerResultClassificationBridgeService` 当前在独立 service/test 中串联 adapter 和 validator `classify(...)`，用于锁定分类到 return/throw、ack/nack 的未来边界；listener 只在 consumed 且 bridge gate ready 时调用 `classifyDryRun(...)`。
- `classificationBridgeGatePlan` 当前把 bridge 调用安全门挂到 no-op dry-run 预案中，其 `bridgeOutcomeDecisionMatrix` 只描述未来 return/throw 与 ack/nack 映射。第二百四十批后还必须显式设置 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_ENABLED=true`，才会显示 ready。第二百四十二批后，listener 已在 consumed 且 bridge gate ready 时调用 `classifyDryRun(...)`；第二百四十三批后，即使 bridge 返回 future throw/retry 决策，当前仍不根据 bridge 结果改变 return/throw，不执行 ack/nack。第二百四十四批后，`bridgeResultObservationPlan` 只描述 future observation fields/log key，当前不执行 observation/log/database write。第二百四十五批后， `bridgeReturnThrowPolicyGatePlan` 需要额外开启 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_RETURN_THROW_ENABLED=true` 才允许未来 return/throw policy switch 进入 ready 预案。第二百五十三批后， `bridgeDecisionDryRunInvocationGatePlan` 还需要额外开启 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_DECISION_DRY_RUN_ENABLED=true` 才允许未来 listener 只读组合 dry-run 调用进入 ready 预案。第二百五十四批后，listener 源码保护已锁定正式接入前不读取该 gate，不调用组合 dry-run service。第二百五十五批后，listener 仅在 classification bridge gate 与 decision dry-run gate 均 ready 时只读调用组合 dry-run；当前仍不读取 `policyDecisionPlan`，不切换 return/throw。第二百五十六批后，即使组合 dry-run 输出 future throw，listener 仍保持 return-to-container 策略。第二百五十七批后，组合 dry-run 输出包含只读 observation plan，但当前不写日志、不写数据库。第二百五十八批后，listener 源码保护已锁定 logging 集成前不读取该 observation plan。第二百五十九批后， `decisionOutputObservationLoggingGatePlan` 还需要额外开启 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_DECISION_DRY_RUN_OBSERVATION_LOG_ENABLED=true` 才允许未来 observation logging 进入 ready 预案。第二百六十批后，listener 源码保护已锁定正式 logging 集成前不读取该 gate。第二百六十一批后， `observationLoggingPayloadPlan` 描述未来日志 payload 字段，但当前不构造 payload。第二百六十二批后，listener 源码保护已锁定正式 payload 构造前不读取该预案。第二百六十三批后，payload 构造 dry-run service 可以独立生成 read-only payload preview，但 listener 仍未注入/调用该 service。第二百六十四批后，listener 源码保护已锁定正式接入前不注入/调用 payload dry-run service，不读取 payload preview。第二百六十五批后，listener 只在 decision dry-run gate ready 路径只读调用 payload dry-run service，但仍不读取 payload preview、不执行 observation logging、不写数据库、不改变 return/throw。第二百六十六批后，logging gate blocked 路径也已固定为只把 blocked gate 传入 payload dry-run service，listener 仍正常 return，不执行日志或数据库写入。第二百六十七批后，即使 payload dry-run 返回 payload preview、throw/nack 类字段，listener 也会隔离忽略，不把该返回值用于当前 RabbitMQ 策略。第二百六十八批后，源码保护已锁定正式 observation logging 前 listener 不引入 Logger 或数据库写入痕迹。第二百六十九批后，独立 observation logging dry-run service 已能生成只读 log 预案，但 listener 仍未注入或调用该 service。第二百七十批后，listener 源码保护已锁定正式接入前不注入/调用 observation logging dry-run service。第二百七十一批后，listener 已只读调用 observation logging dry-run service，但仍不读取返回值、不调用 Logger、不写数据库。第二百七十二批后，即使 observation log dry-run 返回 logExecuted/databaseWrite/rabbitNack 类字段，listener 也会隔离忽略，不用于当前 RabbitMQ 策略。第二百七十三批后，源码保护已锁定正式 observation logging 执行前 listener 不引入 Logger 或数据库写入痕迹。第二百七十四批后，独立 message dry-run service 已能生成只读 `formattedMessagePreview`，但仍不接 listener、不调用 Logger、不写数据库。第二百七十五批后，listener 源码保护已锁定正式接入前不注入/调用 message dry-run service。第二百七十六批后，listener 已只读调用 message dry-run service，但仍不读取返回值、不调用 Logger、不写数据库。第二百七十七批后，即使 message dry-run 返回 logger/database/rabbitNack 类字段，listener 也会隔离忽略，不用于当前 RabbitMQ 策略。第二百七十八批后，源码保护已锁定正式 Logger 接入前 listener 不读取 message dry-run 输出、不引入日志或数据库写入痕迹。第二百七十九批后，独立 logger invocation dry-run service 已能生成只读 Logger 调用安全门预案，但仍不接 listener、不调用 Logger、不写数据库。第二百八十批后，listener 源码保护已锁定正式接入前不注入/调用 logger invocation dry-run service。第二百八十一批后，listener 已只读调用 logger invocation dry-run service，但仍不读取返回值、不调用 Logger、不写数据库。第二百八十二批后，即使 logger invocation dry-run 返回 logger/database/rabbitNack 类字段，listener 也会隔离忽略，不用于当前 RabbitMQ 策略。第二百八十三批后，源码保护已锁定正式 Logger 接入前 listener 不读取 logger invocation 输出、不引入日志或数据库写入痕迹。第二百八十四批后，独立 logger execution plan service 已固定真实 Logger 前的显式灰度 gate、允许 logger/level/message source 和源码红线；当前仍未接入 listener，也不会调用 Logger、写数据库或改变 RabbitMQ 策略。第二百八十五批后，listener 源码保护已锁定正式接入前不注入/调用 logger execution plan service，不读取 execution plan 输出，也不改变日志、数据库或 RabbitMQ 策略。第二百八十六批后，listener 已只读调用 logger execution plan service，但仍隔离忽略返回值，不调用真实 Logger、不写数据库、不改变 return/throw 或 RabbitMQ ack/nack 策略。第二百八十七批后，源码保护已锁定真实 Logger 接入前 listener 不读取 execution plan 输出、不引入日志或数据库写入痕迹。第二百八十八批后，listener 已接入受控真实 `INFO` Logger；日志调用必须经过 execution plan 的 `loggerExecutionPlanned/allowedLogLevel/allowedMessageSource/formattedMessagePreview` 检查，当前仍不写数据库、不切换 return/throw、不手动 ack/nack。第二百八十九批后，gated Logger 负向行为已有测试覆盖：blocked、非 INFO、非 formatted source 或空消息均不会输出 INFO 日志。第二百九十批后，`event_consume_log` 写库前 dry-run 预案已独立成 service；当前仍不接 listener、不执行 SQL、不写数据库。第二百九十一批后，listener 注入/调用 `event_consume_log` 写库预案 service 前的源码保护已补齐；当前 listener 仍不读取写库预案字段、不执行 SQL。第二百九十二批后，listener 已只读调用 `event_consume_log` 写库预案 service；该调用只把 `observationLoggingAllowed` 映射为 `eventConsumeLogWriteAllowed`，仍隔离忽略返回值、不执行 SQL、不写数据库。第二百九十三批后，写库预案返回值隔离源码测试已补齐；即使后续预案出现 `databaseWriteExecuted/sqlExecuted/rabbitNackExecuted` 字段，listener 也仍不得读取或改变当前 RabbitMQ 策略。第二百九十四批后，真实 `event_consume_log` repository/SQL 集成前最终源码保护已补齐；listener 仍不得出现 repository/mapper/JdbcTemplate/事务或 insert/save/update/execute 调用。第二百九十五批后，真实 repository 集成预案 service 已独立成纯内存 dry-run；只预览 `EventConsumeLogEntry` 和 `EventConsumeLogRepository.recordSuccess(...)` 合同，不注入 repository、不执行 SQL。第二百九十六批后，listener 注入/调用 repository integration plan service 前的源码保护已补齐；当前 listener 仍不读取 `repositoryIntegrationPlanned/eventConsumeLogEntryPreview/repositoryInvoked`。第二百九十七批后，listener 已只读接入 repository integration plan service；只把写库 dry-run 预案和 RabbitMQ header 元数据传给下一层预案，仍不读取 repository 预案返回值、不调用真实 repository。第二百九十八批后，repository integration plan 返回值隔离源码测试已补齐；即使后续预案出现 `repositoryInvoked/databaseWriteExecuted/sqlExecuted`，listener 也仍不得读取或改变当前 RabbitMQ 策略。第二百九十九批后，真实 `EventConsumeLogRepository` 调用前最终源码保护已补齐；当前 listener 仍不持有真实 repository/JdbcTemplate/事务，也不调用 record/claim/mark 方法。
- `classificationAckNackPlan` 只描述未来 validator 分类结果到 ack/nack 策略的映射，当前不执行 classification、ack、nack、reject 或 manual execution。
- `NotificationRoutingRabbitListener` 当前仍不注入 `NotificationInAppProviderConsumerResultValidationPlanService`，也不读取 `validatorInvocationGatePlan`。
- 在 listener 中根据 bridge/classify 结果真实切换 return/throw 前，必须先补观测、配置安全门和返回/抛错策略测试。

第一百六十二批后，委托计划会额外返回 `delegationReadinessMatrix` 和 `delegationReadinessFailedChecks`；真实委托前必须确认失败项为空，且 `provider_call_disabled`、`plan_side_effect_free` 均为通过状态。

内部验证接口：

```bash
curl -X POST http://localhost:8080/api/internal/rabbit/notifications \
  -H "Content-Type: application/json" \
  -d "{\"customerId\":\"default\",\"payload\":\"{\\\"type\\\":\\\"test\\\"}\"}"
```

## XXL-Job 任务骨架

当前已注册这些 JobHandler，默认 dry-run。危险任务必须传 `execute=true` 才进入执行态标记。

- `organizationProvisioningJob`
- `vipMembershipRefundReconcileJob`
- `rentalExpenseFinanceSyncJob`
- `amountBillCollectionSmsScanJob`
- `investmentRadarCrawlerJob`
- `menuTemplateSyncJob`
- `publicCrawlerHealthCheckJob`

参数示例：

```text
customerId=default;execute=false;limit=20
customerId=default;execute=true;claim=true;limit=1;workerId=springboot-gray-1
customerId=default;execute=true;heartbeat=true;jobId=31;workerId=springboot-gray-1
customerId=default;execute=true;markRebuildingDatabase=true;jobId=31;workerId=springboot-gray-1
customerId=default;execute=true;previewRebuildDatabase=true;jobId=31;workerId=springboot-gray-1
customerId=default;execute=true;executeRebuildDatabase=true;jobId=31;workerId=springboot-gray-1;confirmTargetDbName=tenant_org001
customerId=default;execute=true;markCloningSchema=true;jobId=31;workerId=springboot-gray-1
customerId=default;execute=true;previewSchemaClone=true;jobId=31;workerId=springboot-gray-1;schemaTableLimit=20
customerId=default;execute=true;executeSchemaClone=true;jobId=31;workerId=springboot-gray-1;confirmTargetDbName=tenant_org001;schemaTableLimit=200
customerId=default;execute=true;markSeedingBaseData=true;jobId=31;workerId=springboot-gray-1
customerId=default;execute=true;previewSuperPermissionClosure=true;jobId=31;workerId=springboot-gray-1
customerId=default;execute=true;executeSuperPermissionClosure=true;jobId=31;workerId=springboot-gray-1;confirmTargetDbName=tenant_org001
customerId=default;execute=true;previewBaseDataTables=true;jobId=31;workerId=springboot-gray-1
customerId=default;execute=true;executeBaseDataTables=true;jobId=31;workerId=springboot-gray-1;confirmTargetDbName=tenant_org001
customerId=default;execute=true;migrateOrganizationRolesAndMembers=true;jobId=31;workerId=springboot-gray-1
customerId=default;execute=true;executeOrganizationRolesAndMembers=true;jobId=31;workerId=springboot-gray-1;confirmTargetDbName=tenant_org001
customerId=default;execute=true;executeOrganizationMembers=true;jobId=31;workerId=springboot-gray-1;confirmTargetDbName=tenant_org001
customerId=default;execute=true;executeOrganizationUserScopedData=true;jobId=31;workerId=springboot-gray-1;confirmTargetDbName=tenant_org001
customerId=default;execute=true;writeTenantProvisioningRoleSnapshot=true;jobId=31;workerId=springboot-gray-1;confirmTargetDbName=tenant_org001
customerId=default;execute=true;switchCenterUserToTarget=true;jobId=31;workerId=springboot-gray-1;confirmTargetDbName=tenant_org001
customerId=default;execute=true;completeTenantProvisioningJob=true;jobId=31;workerId=springboot-gray-1;confirmTargetDbName=tenant_org001
customerId=default;execute=true;markTenantProvisioningJobFailed=true;jobId=31;workerId=springboot-gray-1;failureReason=copy failed;maxRetry=5
customerId=default;execute=true;preflight=true;limit=1;workerId=springboot-gray-1
customerId=default;execute=true;remoteQuery=true;limit=5
customerId=default;execute=true;remoteQuery=true;writeBack=true;limit=5
```

`claim=true` 仅用于 `organizationProvisioningJob` 的任务租约认领灰度，不执行建库、复制数据、成员切换或完成状态流转。 `heartbeat=true` 仅用于 `organizationProvisioningJob` 的已认领任务心跳续租，只刷新 `heartbeat_at/update_time`，不更新 step，也不执行建库或数据复制。 `markRebuildingDatabase=true` 仅用于 `organizationProvisioningJob` 的步骤推进灰度，只把 `step=claimed` 更新为 `rebuilding_database`，不执行真实建库。 `previewRebuildDatabase=true` 仅用于 `organizationProvisioningJob` 的目标库重建 DDL 计划预检，只输出脱敏连接信息和 DDL 预览，不执行真实建库。 `executeRebuildDatabase=true` 仅用于 `organizationProvisioningJob` 的目标库 DROP/CREATE 灰度，必须额外传 `confirmTargetDbName`，不推进 schema clone。 `markCloningSchema=true` 仅用于 `organizationProvisioningJob` 的步骤推进灰度，只把 `step=rebuilding_database` 更新为 `cloning_schema`，不执行 schema clone。 `previewSchemaClone=true` 仅用于 `organizationProvisioningJob` 的 schema clone 建表计划预览，只读取 public 模板库表结构并返回目标建表 SQL，不写目标库。 `executeSchemaClone=true` 仅用于 `organizationProvisioningJob` 的目标库 schema clone 建表灰度，必须额外传 `confirmTargetDbName`，只执行建表并刷新 heartbeat，不推进 `seeding_base_data`。 `markSeedingBaseData=true` 仅用于 `organizationProvisioningJob` 的步骤推进灰度，只把 `step=cloning_schema` 更新为 `seeding_base_data`，不复制任何基础数据。 `previewSuperPermissionClosure=true` 仅用于 `organizationProvisioningJob` 的 Super 权限闭包复制预览，只检查 public 和目标租户库的相关表及行数，不复制菜单、角色或权限码。 `executeSuperPermissionClosure=true` 仅用于 `organizationProvisioningJob` 的 Super 权限闭包复制灰度，必须额外传 `confirmTargetDbName`，只复制 `menu/menu_meta/role/code/role_menu/role_code` 并刷新 heartbeat，不复制其它基础数据。 `previewBaseDataTables=true` 仅用于 `organizationProvisioningJob` 的基础数据复制预览，只检查 public 和目标租户库的 `app_versions` 表及行数，不复制基础数据。 `executeBaseDataTables=true` 仅用于 `organizationProvisioningJob` 的基础数据复制灰度，必须额外传 `confirmTargetDbName`，只复制 `app_versions` 并刷新 heartbeat，不迁移组织角色/成员。 `migrateOrganizationRolesAndMembers=true` 当前仅用于 `organizationProvisioningJob` 的组织角色/成员迁移 preview-only，检查角色树、成员、中心用户和 source 用户绑定，不写目标库、不写角色快照、不刷新 heartbeat。 `executeOrganizationRolesAndMembers=true` 当前仅用于 `organizationProvisioningJob` 的组织角色快照复制灰度，必须额外传 `confirmTargetDbName`；本批只复制 `role/code/park/role_menu/role_park/role_code` 并刷新 heartbeat，不创建成员用户、不写中心库角色快照、不切换中心用户。 `executeOrganizationMembers=true` 当前仅用于 `organizationProvisioningJob` 的组织成员迁移灰度，必须额外传 `confirmTargetDbName`；本批只写目标租户库 `user/user_role/user_code` 并按成员刷新 heartbeat，不迁移用户范围业务表、不写角色快照、不切换中心用户。 `executeOrganizationUserScopedData=true` 当前仅用于 `organizationProvisioningJob` 的组织成员用户范围业务数据复制灰度，必须额外传 `confirmTargetDbName`；本批只复制 `localization/attendances/feedback/leave_application/reimbursement/investment` 及依赖 `park/image/*_image`，不写中心库角色快照、不切换中心用户。 `writeTenantProvisioningRoleSnapshot=true` 当前仅用于 `organizationProvisioningJob` 的中心库角色快照写入灰度，必须额外传 `confirmTargetDbName`；本批只删除并重建当前 job 的 `tenant_provisioning_role_snapshot`，不写目标租户库、不切换中心用户。 `switchCenterUserToTarget=true` 当前仅用于 `organizationProvisioningJob` 的中心用户租户切换灰度，必须额外传 `confirmTargetDbName`，且要求当前 job 已写入 `tenant_provisioning_role_snapshot`；本批只写中心库 `customer/user_tenant_mapping/user/refresh_token/organization_tenant_mapping`，不标记任务完成、不写 outbox、不发布 Kafka/RabbitMQ。 `completeTenantProvisioningJob=true` 当前仅用于 `organizationProvisioningJob` 的完成状态收口灰度，必须额外传 `confirmTargetDbName`；本批只把当前 worker 持有的任务标记为 `status=active, step=completed`，并按 outbox 开关可选写 `organization.provisioning.completed` 事件，不直接发布 Kafka/RabbitMQ。 `markTenantProvisioningJobFailed=true` 当前仅用于 `organizationProvisioningJob` 的失败状态收口灰度，必须额外传 `failureReason`；本批只按 retry 计数写 `failed_retryable/retry_waiting` 或 `failed_manual/failed` 并释放租约，不写 outbox、不执行补偿。

`KAFKA_CONSUMER_ENABLED=true` 当前会开启 `organization.provisioning.completed` 消费入口，并在消费成功后投递 1 条 RabbitMQ light-task；仍不直接发送通知、不刷新缓存。 `RABBITMQ_CONSUMER_ENABLED=true` 当前开启 `organization.provisioning.completed.followup` 轻任务消费、通知计划和 Redis 刷新计划；只有同时开启 `RABBITMQ_NOTIFICATION_PUBLISH_ENABLED=true` 时才投递 RabbitMQ notification 队列，只有同时开启 `REDIS_ORGANIZATION_PROVISIONING_REFRESH_ENABLED=true` 时才清理限定 Redis 缓存前缀，不执行短信/企微/站内通知 provider。 `RABBITMQ_ORGANIZATION_PROVISIONING_NOTIFICATION_CONSUMER_ENABLED=true` 当前开启组织开通完成 notification 消费、中心库收件人预览和 provider dry-run；因 `magic.notification.queue` 是共享通知队列，该开关必须单独灰度，不代表通用短信/企微/站内通知消费者或 provider 发送已可用。若同时开启 `RABBITMQ_NOTIFICATION_ROUTING_CONSUMER_ENABLED=true`，旧的组织开通完成专用 listener 会被条件禁用，避免两个 RabbitMQ listener 竞争同一队列。 `RABBITMQ_ORGANIZATION_PROVISIONING_PROVIDER_SEND_ENABLED=true` 当前只让 provider 计划显示安全门已打开。第一百六十四批后还必须配置 `RABBITMQ_ORGANIZATION_PROVISIONING_PROVIDER_CHANNEL_GUARD` 控制单渠道候选，默认只允许 `in_app` 进入 `providerReadyChannels`。即使安全门和 channel guard 都满足，当前仍固定 dry-run，不真实调用短信/企微/站内信 provider。第一百六十五批后，`in_app` 会额外输出 `inAppExecutionPlan`，用于核对后续写 `event_consume_log + in_app_notification` 的幂等和收件人明细；该计划仍不执行 SQL。第一百六十六批后，需先手工执行 `src/main/resources/db/manual/002-in-app-notification.sql`，再显式设置 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_NOTIFICATION_DDL_APPLIED=true`，claim 预检才会显示 ready；即使 ready，本批仍不执行 claim 或业务表写入。第一百六十七批后，还需显式设置 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_CLAIM_ENABLED=true`，executor 才会真实写 `event_consume_log.status=processing`；即使 claim 成功，当前仍不写 `in_app_notification`，也不 mark success/failure。第一百六十八批后，`inAppExecutionPlan.writePreview.notificationInsertPlan` 只用于验收逐收件人 insert 字段和参数；当前仍没有 repository 执行 SQL，也不会把 provider 消费日志标记为 success。第一百六十九批后，还需显式设置 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_NOTIFICATION_INSERT_ENABLED=true`，executor 才会真实插入 `in_app_notification`；即使插入成功，当前仍不会把 provider 消费日志标记为 success，也不会推送 websocket。第一百七十批后，还需显式设置 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_MARK_SUCCESS_ENABLED=true`，executor 才会把 provider 级 `event_consume_log` 标记为 success；当前仍不会推送 websocket，也不会自动从 RabbitMQ listener 串联完整 provider 流程。第一百七十一批后，`OrganizationProvisioningCompletedInAppProviderManualExecutionService` 可在内部灰度中显式串联 `claim -> insertNotifications -> markSuccess`；这不是 HTTP 公开接口，也没有接入 RabbitMQ listener。真实使用前仍需逐个确认 DDL、claim、insert、mark success 四个安全门，且当前仍不会推送 websocket/push。第一百七十二批后，还需显式设置 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_MARK_FAILURE_ENABLED=true`，executor 才会把 provider 级 `event_consume_log` 标记为 failed。第一百七十三批后，手动串联入口会在 `insertNotifications(...)` 或 `markSuccess(...)` 抛异常时调用 `markFailure(...)`；是否真实写 `failed` 仍由 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_MARK_FAILURE_ENABLED` 控制。当前仍不会捕获 claim 异常，不会投递 retry/DLQ，也不会自动接 RabbitMQ listener。第一百七十四批后，`inAppExecutionPlan.writePreview.websocketPushDeliveryPlan` 只用于检查 websocket/push 投递字段、收件人和模板；当前仍不会打开 websocket 连接，不会调用移动推送 SDK，不会创建推送 outbox，也不会自动接 RabbitMQ listener。第一百七十五批后，`inAppExecutionPlan.listenerAutoExecutionGatePlan` 只用于检查 listener 自动执行前的全部安全门；即使 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_LISTENER_AUTO_EXECUTION_ENABLED=true` 且所有检查通过，当前仍不会修改 listener，也不会自动调用 `OrganizationProvisioningCompletedInAppProviderManualExecutionService`。第一百七十六批后，`inAppExecutionPlan.listenerAutoExecutionGatePlan.invocationPlan` 只描述未来 listener 调用手动执行 service 的参数、顺序、ack/nack 策略和结果字段；当前仍不会调用 `execute(...)`，不会 ack/nack RabbitMQ 消息，也不会执行 websocket/push。第一百七十七批后，`NotificationConsumerDelegationPlanService` 会输出 `inAppProviderAutoExecutionAdapterPlan`，用于预览专用 consumer 成功结果到 `inAppExecutionPlan` 的后置 adapter 路径；当前仍不读取真实 consumer result，不调用手动执行 service，也不改变共享 notification listener 的 ack/nack 行为。第一百七十八批后，`RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_ENABLED=true` 只会让后置 adapter 预案的安全门显示 ready；第二百一十三批后，listener 只基于该 dry-run 状态生成 no-op 预案，仍不读取真实 consumer result，不调用 `OrganizationProvisioningCompletedInAppProviderManualExecutionService`。第一百七十九批后，后置 adapter 预案会额外输出 `consumerResultValidationPlan`，用于分类真实 consumer result 缺少 `sendPlan/providerPlan/inAppExecutionPlan`、 `inAppExecutionPlan.planStatus` 非 ready 或缺少 `listenerAutoExecutionGatePlan.invocationPlan` 的情况；当前仍不读取真实 consumer result，也不改变 ack/nack。第一百八十批后，上述分类预案已提炼到 `NotificationInAppProviderConsumerResultValidationPlanService`，当前仍只由 adapter/no-op dry-run 计划复用；listener 已生成 no-op 预案，但仍不调用 `classify(...)`。第一百八十一批后，validator 增加纯内存 `classify(...)` 方法，只供测试和后续 no-op 分支复用；当前仍不从 RabbitMQ listener 传入真实 consumer result，不调用 provider。第一百八十二批后，`listenerNoopIntegrationPlan` 用于预览 listener no-op 分支接入条件； `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_LISTENER_NOOP_ENABLED=true` 只会让预案显示 ready。第二百一十三批后，`NotificationRoutingRabbitListener` 已接入 no-op dry-run 预案生成，但仍不会转发真实 consumer result。第一百八十三批后，`listenerNoopIntegrationPlan.ackNackDecisionMatrix` 只用于预览 listener no-op 分支的 ack/nack 判定；当前仍固定不手动 ack、不手动 nack。第一百八十四批后，no-op 预案由 `NotificationInAppProviderListenerNoopPlanService` 独立维护，仍只返回 dry-run Map。第一百八十五批后，`listenerNoopIntegrationPlan.validatorContractPlan` 只描述未来 no-op 分支调用 `classify(...)` 的参数契约；当前仍不传真实 result，不执行分类。第一百八十六批后，`validatorContractPlan.inputSampleMatrix` 只提供输入形态和预期分类样例，不提供真实 payload，也不会调用 `classify(...)`。第一百八十七批后，adapter/no-op/validator contract 嵌套计划已有只读验收测试；ready dry-run 仍只表示预案可读，不代表 listener 自动执行已开启。第一百八十八批后，`validatorContractPlan.ackNackAlignmentMatrix` 只对齐分类结果和未来 ack/nack 场景，不执行分类、不 ack、不 nack。第一百八十九批后，adapter/no-op 嵌套只读验收已覆盖完整 `ackNackAlignmentMatrix` 分类集合，仍不代表 listener 自动执行已开启。第一百九十批后，no-op 预案内部 ack/nack 策略字符串已抽常量；对外 dry-run Map 字段值保持不变，仍不执行 ack/nack。第一百九十一批后，常量整理后的 ack/nack 字符串输出已有只读回归测试；后续整理分类字符串时仍必须保持 dry-run 输出兼容。第一百九十二批后，validator/no-op 分类码字符串已抽常量；对外 dry-run 分类码和状态输出保持不变。第二百零四批后，共享 notification listener 已有源码静态边界测试，确认当前未接入 no-op/validator/manual execution，也未调用 `classify(...)` 或 `execute(...)`。第二百零五批后，共享 notification listener 的依赖声明、构造器参数和 `onMessage(...)` 调用链顺序已有源码顺序保护测试；后续接入 no-op 分支前必须显式修改测试。第二百零六批后，共享 notification listener 已有源码边界测试，确认专用 consumer 返回后当前只做 `ackable` 判断，不读取 provider 执行计划。第二百零七批后，共享 notification listener 已有源码边界测试，确认当前仍不手动调用 RabbitMQ ack/nack/reject，消息确认仍由 Spring AMQP 容器基于 return/throw 处理。第二百零八批后，no-op validator 分类到未来 return/throw 边界的只读测试已补齐；blocked 分类仍映射为不 ack 并抛错进入后续 retry/DLQ 策略批次，ready 分类仍延后 ack 到手动执行结果验证后。第二百零九批后，共享 notification listener 构造器依赖面已有源码测试锁定；正式接入 no-op/validator/manual execution 前，必须显式调整字段数量、构造器参数和对应边界测试。第二百八十四批后，真实 Logger 调用前的 execution plan 已有独立 service 和源码红线；正式接入 listener 前仍必须先增加 listener 注入/调用前保护测试，并保持不写库、不切换 return/throw。第二百八十五批后，listener 注入/调用 logger execution plan service 前的源码保护已补齐；后续只读接入时仍不得调用真实 Logger、写库或切换 return/throw。第二百八十六批后，listener 已只读接入 logger execution plan service；正式 Logger 接入前仍必须补返回值隔离后的最终源码保护，继续禁止 Logger、写库和 return/throw 切换。第二百八十七批后，真实 Logger 接入前最终源码保护已补齐；后续如接入 Logger，必须只允许 gated `INFO` 日志，不写数据库、不切换 return/throw、不手动 ack/nack。第二百八十八批后，gated `INFO` Logger 已接入；后续应补日志返回值/blocked gate 隔离测试，确保 blocked 或非 INFO/source 不会被当成执行成功。第二百八十九批后，gated Logger 负向隔离测试已补齐；下一步可进入 `event_consume_log` 数据库写入前的 dry-run 预案，仍不执行 SQL。第二百九十批后，`event_consume_log` 写库 dry-run 预案已补齐；下一步先补 listener 正式注入/调用该写库预案 service 前的源码保护，仍不执行 SQL。第二百九十一批后，listener 接入写库预案前源码保护已补齐；下一步可只读接入 event consume log write plan service，但仍不得执行 SQL。第二百九十二批后，listener 已只读接入 event consume log write plan service；下一步应补写库预案返回值隔离测试，确保任何 `databaseWriteExecuted/sqlExecuted/rabbitNack` 类字段都不会影响当前 return/throw 或 RabbitMQ ack/nack。第二百九十三批后，写库预案返回值隔离测试已补齐；下一步可补真实 event consume log repository 集成前的最终源码保护，仍不执行 SQL、不写数据库、不手动 ack/nack。第二百九十四批后，真实 event consume log repository 集成前最终源码保护已补齐；下一步如继续推进，应先设计 repository 集成预案测试，仍保持 dry-run，不直接执行 SQL。第二百九十五批后，repository 集成预案测试已补齐；下一步先补 listener 正式注入/调用 repository integration plan service 前的源码保护，仍不执行 SQL。第二百九十六批后，listener 接入 repository integration plan service 前源码保护已补齐；下一步可只读接入 repository integration plan service，但仍不得执行 SQL 或真实 repository 调用。第二百九十七批后，listener 已只读接入 repository integration plan service；下一步应补 repository integration plan 返回值隔离测试，确保 `repositoryInvoked/databaseWriteExecuted/sqlExecuted` 不影响当前 return/throw 或 RabbitMQ ack/nack。第二百九十八批后，repository integration plan 返回值隔离测试已补齐；下一步可补真实 `EventConsumeLogRepository` 调用前最终源码保护，仍不执行 SQL、不手动 ack/nack。第二百九十九批后，真实 `EventConsumeLogRepository` 调用前最终源码保护已补齐；下一步如继续推进，应先设计真实 repository 调用预案测试，仍保持 dry-run，不直接写库。第三百批后，真实 repository 调用预案测试已补齐； `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryCallPlanService` 只从 repository integration plan 生成 `EventConsumeLogRepository.recordSuccess` 调用参数和顺序预览，仍不持有仓储、不执行 SQL、不读取插入结果、不切换 return/throw、不手动 ack/nack。下一步可补 listener 接入 repository call plan service 前的源码保护，仍不直接写库。第三百零一批后，listener 接入 repository call plan service 前源码保护已补齐；当前 `NotificationRoutingRabbitListener` 仍只调用 repository integration plan service，不注入/调用 repository call plan service，不读取 `repositoryCallPlanned/repositoryArgumentPreview/insertedResultObserved`，也不执行 SQL 或手动 ack/nack。下一步可只读接入 repository call plan service，但仍不得调用真实 repository。第三百零二批后，listener 已只读接入 repository call plan service；当前调用链为 logger execution plan -> event_consume_log write plan -> repository integration plan -> repository call plan，listener 仍不保存或读取 repository call plan 返回值，也不持有真实 `EventConsumeLogRepository/JdbcTemplate`、不执行 SQL、不切换 return/throw、不手动 ack/nack。下一步应补 repository call plan 返回值隔离测试，确保 `repositoryInvoked/databaseWriteExecuted/sqlExecuted` 不影响当前 listener 行为。第三百零三批后，repository call plan 返回值隔离测试已补齐；当前 listener 只调用 `observationEventConsumeLogRepositoryCallPlanService.buildPlan(...)`，不赋值 `repositoryCallPlan`、不读取 `repositoryCallPlanned/repositoryArgumentPreview/repositoryInvocationOrderPreview/insertedResultObserved/repositoryInvoked`，恶意返回字段不会影响 return/throw 或 RabbitMQ ack/nack。下一步可补真实 `EventConsumeLogRepository.recordSuccess` 执行前最终源码保护，仍不直接写库。第三百零四批后，真实 `EventConsumeLogRepository.recordSuccess` 执行前最终源码保护已补齐；当前 listener 即使已接入 repository call plan service，仍不持有 `EventConsumeLogRepository`、不构造 `EventConsumeLogEntry`、不调用 `recordSuccess(...)`、不读取 inserted 结果、不引入 `JdbcTemplate/@Transactional`、不执行 SQL、不手动 ack/nack。下一步如继续推进，应先设计 recordSuccess 执行门控预案，仍保持 dry-run。第三百零五批后，recordSuccess 执行门控预案已补齐； `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionGatePlanService` 只在 repository call plan 完整且显式 `recordSuccessExecutionAllowed=true` 时生成未来执行预览，仍不持有仓储、不调用 `recordSuccess(...)`、不执行 SQL、不读取 inserted 结果、不切换 return/throw、不手动 ack/nack。下一步可补 listener 接入 recordSuccess execution gate plan service 前的源码保护，仍不直接写库。第三百零六批后，listener 接入 recordSuccess execution gate plan service 前源码保护已补齐；当前 listener 仍只调用 repository call plan service，不注入/调用 recordSuccess execution gate plan service，不读取 `recordSuccessExecutionPlanned/recordSuccessExecutionAllowed/repositoryInvoked/insertedResultObserved`，也不执行 SQL 或手动 ack/nack。下一步可只读接入 recordSuccess execution gate plan service，但仍不得调用真实 repository。第三百零七批后，listener 已只读接入 recordSuccess execution gate plan service；当前调用链末尾增加 `recordSuccessExecutionGatePlan()`，固定传入 `recordSuccessExecutionAllowed=false`，listener 仍不保存或读取 execution gate plan 返回值，不执行 `recordSuccess(...)`、不读取 inserted 结果、不切换 return/throw、不手动 ack/nack。下一步应补 recordSuccess execution gate plan 返回值隔离测试，继续保持不直接写库。第三百零八批后，recordSuccess execution gate plan 返回值隔离测试已补齐；当前 listener 只调用 `observationEventConsumeLogRecordSuccessExecutionGatePlanService.buildPlan(...)`，不赋值 `recordSuccessExecutionGatePlan`、不读取 `recordSuccessExecutionPlanned/repositoryInvoked/insertedResultObserved/databaseWriteExecuted/sqlExecuted/listenerPolicyChanged/decisionApplied/throwRequested`，恶意返回字段不会影响当前 return/throw 或 RabbitMQ ack/nack。下一步可补真实 `recordSuccess` 执行前最终源码保护，仍不直接写库。第三百零九批后，真实 `recordSuccess` 执行前最终源码保护已补齐；当前 listener 即使已接入 recordSuccess execution gate plan service，仍不持有 `EventConsumeLogRepository`、不构造 `EventConsumeLogEntry`、不调用 `recordSuccess(...)`、不读取 inserted 结果、不引入 `JdbcTemplate/@Transactional`、不执行 SQL、不手动 ack/nack。下一步如继续推进，应先设计真实 recordSuccess 执行前的显式属性/开关保护或执行适配预案，仍保持 dry-run。第三百一十批后，真实 recordSuccess 执行前显式开关预案已补齐；新增 `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionSwitchPlanService`，只有上游 execution gate plan ready、`recordSuccessExecutionPlanned=true`，且显式开关属性 `RABBITMQ_NOTIFICATION_EVENT_CONSUME_LOG_RECORD_SUCCESS_ENABLED` 匹配并开启时，才输出未来 execution adapter dry-run 预案；该 service 不读取环境变量、不注入仓储、不调用 `recordSuccess(...)`、不写库、不切换 return/throw、不手动 ack/nack。下一步可补 listener 接入 recordSuccess execution switch plan service 前的源码保护，仍不直接写库。第三百一十一批后，listener 接入 recordSuccess execution switch plan service 前源码保护已补齐；当前 listener 仍只调用 recordSuccess execution gate plan service，不注入/调用 switch plan service，不读取 `recordSuccessExecutionSwitchProperty/recordSuccessExecutionSwitchAllowed/recordSuccessExecutionAdapterPlanned`，不读取 `RABBITMQ_NOTIFICATION_EVENT_CONSUME_LOG_RECORD_SUCCESS_ENABLED`，构造器依赖面仍为 18。下一步可只读接入 recordSuccess execution switch plan service，但仍不得调用真实 repository。第三百一十二批后，listener 已只读接入 recordSuccess execution switch plan service；当前调用链末尾增加 `recordSuccessExecutionSwitchPlan()`，固定传入 `RABBITMQ_NOTIFICATION_EVENT_CONSUME_LOG_RECORD_SUCCESS_ENABLED` 且 `recordSuccessExecutionSwitchAllowed=false`，listener 仍不保存或读取 switch plan 返回值，不执行 `recordSuccess(...)`、不读取 inserted 结果、不切换 return/throw、不手动 ack/nack，构造器依赖面更新为 19。下一步应补 recordSuccess execution switch plan 返回值隔离测试，继续保持不直接写库。第三百一十三批后，recordSuccess execution switch plan 返回值隔离测试已补齐；当前 listener 只调用 `observationEventConsumeLogRecordSuccessExecutionSwitchPlanService.buildPlan(...)`，不赋值 `recordSuccessExecutionSwitchPlan`、不读取 `recordSuccessExecutionAdapterPlanned/repositoryInvoked/insertedResultObserved/databaseWriteExecuted/sqlExecuted/listenerPolicyChanged/decisionApplied/throwRequested`，恶意返回字段不会影响当前 return/throw 或 RabbitMQ ack/nack。下一步可补真实 `recordSuccess` execution adapter 执行前最终源码保护，仍不直接写库。第三百一十四批后，真实 `recordSuccess` execution adapter 执行前最终源码保护已补齐；当前 listener 即使已接入 recordSuccess execution switch plan service，仍不持有 `EventConsumeLogRepository`、不构造 `EventConsumeLogEntry`、不调用 `recordSuccess(...)`、不读取 inserted 结果、不引入 `JdbcTemplate/@Transactional`、不执行 SQL、不手动 ack/nack。下一步如继续推进，应先设计 recordSuccess execution adapter dry-run 预案，仍保持不直接写库。 `RABBITMQ_NOTIFICATION_DISPATCH_ENABLED=true` 当前只让共享 notification listener 生成分发预检结果，仍不调用 handler、不 ack、不写消费日志。 `NotificationHandlerAdapterPlanService` 当前只让共享 notification listener 生成 adapter 调用计划，仍不调用专用 consumer、不写消费日志。 `NotificationAdapterRequestValidationPlanService` 当前只让共享 notification listener 校验组织开通 notification 请求形态，仍不构造真实消费结果、不写库。 `NotificationConsumerDelegationPlanService` 当前让共享 notification listener 判断是否可委托组织开通完成专用 consumer；`RABBITMQ_NOTIFICATION_CONSUMER_DELEGATION_ENABLED=true` 只对该单 route 生效。第一百六十二批后，`NotificationConsumerDelegationPlanService` 会输出 `delegationReadinessMatrix/delegationReadinessFailedChecks`；只有失败项为空时才允许进入下一批真实委托开发。如果上游 request validation 计划出现 `providerCallEnabled=true` 或 `providerCallBlocked=true`，委托计划仍会阻断，避免共享队列 listener 越过 provider 安全门。 `preflight=true` 仅用于 `organizationProvisioningJob` 的已认领任务执行前预检，不更新任务状态，也不执行建库或数据复制。 `remoteQuery=true` 仅用于 `vipMembershipRefundReconcileJob` 的显式远程查单灰度，不代表可以写回退款状态。 `writeBack=true` 也仅写回退款状态快照，不执行会员权益撤销。
