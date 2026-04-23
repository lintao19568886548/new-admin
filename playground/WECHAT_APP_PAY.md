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

## 数据库说明

会员和支付订单归属已改为中心库，不再写入租户库。

- 会员表、会员支付表、租户开通任务表位于 `apps/backend-mock/prisma/center`。
- 启用前需要执行 `pnpm -F @vben/backend-mock prisma:push:center`，并重新执行 `pnpm -F @vben/backend-mock prisma:generate`。
- 原租户库里的 `vip_membership`、`vip_membership_payment` 表已废弃；该功能尚未进入生产，因此当前不做兼容迁移。
- 微信支付成功后只会写中心库会员状态，并为 `public` 用户创建 `tenant_provisioning_job`，状态为 `pending`。
- 当前不会自动创建租户库，也不会自动更新用户 `customerId`；这部分后续由租户开通任务消费逻辑完成。
- 用户处于 `pending` / `provisioning` 开通状态且仍在 `public` 库时，后端会拦截业务写入，避免继续在公开库产生需要迁移的新业务数据。
- App 支付成功后，前端会轮询 `GET /api/tenant/provisioning/status`，用于展示专属空间开通进度；后续异步建库任务完成并把状态改为 `active` 后，前端会刷新用户信息。

这是一次破坏性变更：会员支付状态从租户库迁移到中心库，历史租户库会员表数据不会再被读取。

## 后端接口

- `GET /api/wechat/pay/app/config`
- `POST /api/wechat/pay/app/prepay`
- `GET /api/wechat/pay/query?outTradeNo=...`
- `POST /api/wechat/pay/notify`
- `GET /api/tenant/provisioning/status`

`prepay` 请求体示例：

```json
{
  "amount": 1,
  "description": "测试支付"
}
```

金额单位为 `分`。`outTradeNo` 由后端生成，前端传入会被忽略。

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

## Android 原生接入点

- `MainActivity.java`
- `WechatPayBridge.java`
- `wxapi/WXPayEntryActivity.java`

微信支付完成后，原生层会向 WebView 派发：

- `native-wechat-pay-result`

前端无需自己轮询原生活动返回值，只需要监听统一封装的 Promise 结果即可。
