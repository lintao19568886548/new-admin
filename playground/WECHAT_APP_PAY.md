# 微信 APP 支付接入说明

本项目当前只接入 `Android APP支付`，不包含 H5 支付和微信内 `JSAPI`。

## 运行依赖

前端不再直接读取微信开放平台移动应用 AppID/商户号。公开配置由后端接口返回：

- `GET /api/wechat/pay/app/config`

后端必须提供的服务端环境变量：

- `WECHAT_OPEN_APP_ID`
- `WECHAT_PAY_MERCHANT_ID`
- `WECHAT_PAY_API_V3_KEY`
- `WECHAT_PAY_CERT_SERIAL_NO`
- `WECHAT_PAY_PUBLIC_KEY_ID`
- `WECHAT_PAY_PUBLIC_KEY` 或 `WECHAT_PAY_PUBLIC_KEY_PATH`
- `WECHAT_PAY_NOTIFY_URL`
- `WECHAT_PAY_PRIVATE_KEY` 或 `WECHAT_PAY_PRIVATE_KEY_PATH`

`WECHAT_PAY_PUBLIC_KEY_ID` 是商户平台 API 安全里下载微信支付公钥时展示的公钥 ID，格式通常为 `PUB_KEY_ID_...`。`WECHAT_PAY_PUBLIC_KEY_PATH` 指向下载得到的微信支付公钥 PEM 文件。

生产环境建议额外配置：

- `VIP_CHECKOUT_FLOW_TOKEN_SECRET`
- `VIP_CHECKOUT_FLOW_TOKEN_EXPIRES_IN`

`VIP_CHECKOUT_FLOW_TOKEN_SECRET` 用于签发支付后短期轮询凭证，必须是服务端私密值。未配置时会回退到 `ACCESS_TOKEN_SECRET`，再回退到开发默认值；生产环境不要依赖默认值。`VIP_CHECKOUT_FLOW_TOKEN_EXPIRES_IN` 默认 `15m`。

## 数据库说明

会员和支付订单归属已改为中心库，不再写入租户库。

- 会员表、会员支付表、租户开通任务表位于 `apps/backend-mock/prisma/center`。
- 启用前需要执行 `pnpm -F @vben/backend-mock prisma:push:center`，并重新执行 `pnpm -F @vben/backend-mock prisma:generate`。
- 原租户库里的 `vip_membership`、`vip_membership_payment` 表已废弃；该功能尚未进入生产，因此当前不做兼容迁移。
- 微信支付成功后只会写中心库会员状态，并为 `public` 用户创建 `tenant_provisioning_job`，状态为 `pending`。
- 后端内置租户开通 worker 会异步消费 `tenant_provisioning_job`：基于 `lockOwner` / `heartbeatAt` 租约认领任务，先固化 `target_customer_id` + `target_db_name`，再重建目标租户库、从 `public` 复制表结构和基础权限、迁移可明确归属到当前用户的数据、校验通过后再写入中心库映射并把中心用户 `customerType` 切到新租户。
- `target_customer_id` 由支付前填写的城市和公司简称生成：先去掉城市常见后缀，再把城市和公司简称转拼音 slug，例如 `深圳市` + `腾讯` 会生成 `shenzhen_tengxun`；如冲突则追加序号。
- 用户处于 `pending` / `provisioning` 开通状态且仍在 `public` 库时，后端会拦截业务写入，避免继续在公开库产生需要迁移的新业务数据。
- App 支付成功后，前端使用 `prepay` 返回的 `checkoutFlowToken` 轮询 `GET /api/tenant/provisioning/status`，用于展示专属空间开通进度；异步建库任务完成并把状态改为 `active` 后，旧 access token 会失效，前端提示用户重新登录进入专属空间。
- worker 不会盲目迁移无法确认归属的 public 公共业务数据，避免把其他 public 用户的数据带入新租户；当前迁移范围包括账号权限、定位/考勤/请假/报销/反馈，以及手机号匹配的招商记录与相关图片。
- 为避免半残库重试，`pending` / `failed_retryable` / 失活的 `provisioning` 任务在重新执行时会直接 `DROP DATABASE IF EXISTS target_db_name` 后全量重建，再重新迁移和校验；当前不支持断点续传。
- `failed_manual` 表示自动重试次数已耗尽，worker 不会继续自动消费；需要先修复根因，再由人工把任务重排回可执行状态。
- 为保证外键完整性，worker 会额外复制当前用户数据引用到的 `park` 记录，再迁移请假/报销/招商数据。

这是一次破坏性变更：会员支付状态从租户库迁移到中心库，历史租户库会员表数据不会再被读取。租户开通任务也采用新的租约字段 `lock_owner` / `locked_at` / `heartbeat_at` / `target_db_name`；旧结构或旧任务数据不做兼容，功能上线前需清理旧的 `tenant_provisioning_job` 测试数据、同步中心库结构，并删除旧的测试目标库。

同时，旧 access token 的切库宽限已移除。服务端会严格校验 token 中的 `customerId` / `tokenVersion` 是否仍匹配中心用户当前状态；切库完成后旧 token 会立即按过期处理。支付完成页的订单查询和租户开通状态轮询不再依赖旧 access token，而是依赖短期 `checkoutFlowToken`。

## 租户开通 Worker

默认随 backend-mock 启动，可通过环境变量关闭或调节：

- `TENANT_PROVISIONING_WORKER_ENABLED=false` 可关闭自动消费。
- `TENANT_PROVISIONING_WORKER_INTERVAL_MS` 控制轮询间隔，默认 `5000`。
- `TENANT_PROVISIONING_BATCH_SIZE` 控制单轮最多处理任务数，默认 `1`。
- `TENANT_PROVISIONING_MAX_RETRY` 控制自动重试次数，默认 `5`。
- `TENANT_PROVISIONING_STALE_AFTER_MS` 控制 worker 租约 heartbeat 超时时间，默认 `600000`。
- 租户开通 worker 当前只支持 `public -> 专属租户`，新租户库表结构、基础权限、用户权限关系都统一从 `public` 复制。
- worker 不会自动创建邀请码；支付和建库只负责创建租户、迁移付款用户并切换其 `customerType`。

## 邀请码加入已有租户

邀请码是已有租户邀请其他用户加入的独立能力，不属于支付成功后的自动步骤。

- 购买会员并完成专属租户建库后，系统不会自动后台生成邀请码，也不会把邀请码展示给付款用户。
- 邀请码由租户内已登录用户通过后端接口创建，创建时必须指定目标租户角色；`maxUses` 为空表示不限次数。
- 其他 `public` 用户可以在会员页填写邀请码加入已有租户。加入成功后，中心库会写入 `user_customer_mapping`，目标租户库会创建或复用同名租户用户，并按邀请码配置写入角色。
- 加入成功后中心用户 `customerType` 会切到目标租户，同时递增 `tokenVersion` 并吊销旧 refresh token，前端需要重新登录进入新租户。
- 已属于其他专属租户的用户不能直接通过邀请码加入新租户；`default` 库账号也不能通过邀请码加入租户。
- 当前前端已有“填写邀请码加入”入口；创建、列表、吊销邀请码目前有后端接口和前端 API client，但尚未做租户管理员管理页面。

## 会员访问控制

会员访问控制同时在前端路由和后端 API 中生效：

- `default` 库用户不受会员限制。
- `public` 和租户库用户会读取中心库会员状态。
- 新用户按中心用户 `createTime` 计算 1 个月试用期。
- 试用过期且无有效会员，或会员过期后，只允许访问 `/rental/manage`、`/rental/manage/mobile`、`/hrm/information`、`/hrm/information/mobile`，以及 `/workbench`、`/profile`、`/home` 及其子页。
- 被限制页面会重定向到 `/profile/vip-membership`，并携带来源路径和限制原因。
- 后端 API 会返回 `403`、`errorCode: "MEMBERSHIP_REQUIRED"` 和 `redirectTo: "/profile/vip-membership"`；前端请求层会据此跳转会员页。
- 开通任务处于 `pending` / `provisioning` / `failed_retryable` / `failed_manual` 且用户仍在 `public` 库时，后端会拒绝业务写入，避免迁移过程中继续产生 public 业务数据。

## 后端接口

- `GET /api/wechat/pay/app/config`
- `POST /api/wechat/pay/app/prepay`
- `GET /api/wechat/pay/query?outTradeNo=...`
- `POST /api/wechat/pay/notify`
- `GET /api/tenant/provisioning/status`
- `POST /api/tenant/invitation/create`
- `GET /api/tenant/invitation/list`
- `POST /api/tenant/invitation/revoke`
- `POST /api/tenant/invitation/join`

`prepay` 请求体示例：

```json
{
  "amount": 1,
  "description": "测试支付"
}
```

金额单位为 `分`。`outTradeNo` 由后端生成，前端传入会被忽略。

会员订单 `prepay` 成功时会返回 `checkoutFlowToken`。该 token 只用于本次支付后的订单查询和租户开通状态轮询，前端需要通过请求头传递：

- `x-vip-checkout-flow-token: <checkoutFlowToken>`

当前支持该短期凭证的接口：

- `GET /api/wechat/pay/query?outTradeNo=...`
- `GET /api/tenant/provisioning/status`

如果没有 `checkoutFlowToken`，上述接口仍要求传入有效 access token。`checkoutFlowToken` 会绑定 `centerUserId`、`outTradeNo` 和支付发起时的 `sourceCustomerId`，不能跨订单或跨用户复用。

## 前端调用

统一调用入口：

- `playground/src/utils/native-wechat-pay.ts`

示例：

```ts
import { payWithWechatApp } from '#/utils/native-wechat-pay';

const result = await payWithWechatApp({
  amount: 1,
  description: '测试支付',
});

if (result.payResult.ok) {
  const orderStatus = await result.queryOrderStatus();
  console.log(orderStatus.tradeState);
}
```

`payWithWechatApp` 会保存本次 `prepay` 返回的 `checkoutFlowToken`，并在 `queryOrderStatus()` 中自动带上。会员页在支付成功后也会使用同一个 token 轮询租户开通状态。该 token 不持久化到本地；如果支付完成页被刷新，需要依赖重新登录后的会员状态或用户手动返回会员页查看状态。

## 前端会话状态

前端登录态统一由 `playground/src/store/auth.ts` 管理，不再由路由守卫、请求拦截器和页面各自重建状态。

- `sessionStatus` 描述当前会话阶段：`anonymous`、`authenticating`、`hydrating`、`ready`、`reauth_required`、`logging_out`。
- `authSessionVersion` 用于丢弃过期异步结果，避免旧的 `fetchUserInfo` / 权限生成结果覆盖新会话。
- `sessionResumePath` / `sessionReauthReason` 用于 token 过期弹窗登录后回到原页面。
- `ensureSessionReady()` 是恢复登录态、刷新用户信息、拉取权限码、重建动态路由的统一入口。
- `requireReauthentication()` 会清空 access token、用户信息、菜单、权限码、动态路由和会员监听器，并进入 `reauth_required`。
- 路由守卫只负责调用 `ensureSessionReady()` 和会员页跳转，不再直接生成动态路由。

## Android 原生接入点

- `MainActivity.java`
- `WechatPayBridge.java`
- `wxapi/WXPayEntryActivity.java`

微信支付完成后，原生层会向 WebView 派发：

- `native-wechat-pay-result`

前端无需自己轮询原生活动返回值，只需要监听统一封装的 Promise 结果即可。
