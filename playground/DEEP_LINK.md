# Deep Link 约定（iOS 当前实现）

## 当前状态

- Universal Link 域名：`https://link.yizuw.cn`
- Universal Link 路径：`/ul/*`
- App 侧接收：`appUrlOpen` + `getLaunchUrl`
- 兜底页：`/ul-fallback.html`
- 兜底策略：不使用自定义 URL Scheme，仅 Universal Link + App Store

## 已实现参数

### `target`

- 用途：指定 App 内跳转目标路由。
- 位置：`/ul/*` 的 query 参数。
- 当前白名单：仅允许 `/home`。
- 不在白名单内时：自动回退到 `/home`。

示例：

```text
https://link.yizuw.cn/ul/open?target=%2Fhome
```

### `store`

- 用途：仅兜底页使用，指定 App Store 地址。
- 场景：拉起失败时，跳商店下载。
- 不传时：使用兜底页默认值。

示例：

```text
https://link.yizuw.cn/ul/open?target=%2Fhome&store=https%3A%2F%2Fapps.apple.com%2Fcn%2Fapp%2Fid1234567890
```

## 暂未启用（预留）

- `tk`
- `ts`
- `nonce`
- `sig`

说明：这些参数用于短期令牌、防篡改、防重放。当前版本未启用，后续按安全需求补齐。

## 推荐发布口径

- 对外默认只发：`target=/home`
- 业务需要更多落地页时，再扩展白名单并同步更新此文档
