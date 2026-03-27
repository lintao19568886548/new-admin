# Deep Link 约定（iOS / Android）

## 当前状态

- Deep Link 域名：`https://link.yizuw.cn`
- Universal Link / App Links 路径：`/ul/link/*`
- App 侧接收：`appUrlOpen` + `getLaunchUrl`
- 过渡页：`/ul/open/index.html`
- App Link 落点：`/ul/link/index.html`
- Android 浏览器兜底：过渡页优先发 `intent://`，失败后回退到 `https://link.yizuw.cn/ul/link/*`
- 兜底策略：不使用自定义 URL Scheme，仅 Universal Link / App Links + Android `intent://` + 下载页

## 已知限制

- 当前 deep-link 兜底链路以 Android 为主，iOS Universal Link 的完整上架后链路暂未验收。
- 下载页当前仍沿用 Android 优先逻辑；iOS 上架前需要补齐 `iosUrl` 优先与 App Store 跳转策略。

## 已实现参数

### `target`

- 用途：指定 App 内跳转目标路由。
- 位置：`/ul/*` 的 query 参数。
- 当前白名单：
  - `/home`
  - `/rental/factory`
  - `/rental/factory/detail/:id`
- 不在白名单内时：自动回退到 `/home`。

示例：

```text
https://link.yizuw.cn/ul/link/index.html?target=%2Fhome
```

### `webOrigin`

- 用途：指定“继续浏览网页”和“前往下载页”使用的 H5 主站域名。
- 位置：`/ul/*` 的 query 参数。
- 安全约束：仅接受 `https://yizuw.cn` 及其子域名；本地调试接受 `http://localhost` / `http://127.0.0.1`。
- 未传或非法时：回退到 `https://yizuw.cn`。

示例：

```text
https://link.yizuw.cn/ul/open/index.html?target=%2Frental%2Ffactory%2Fdetail%2F168&webOrigin=https%3A%2F%2Fyizuw.cn
```

### `store`

- 用途：预留。当前统一跳下载页，不再单独透传商店地址。
- 场景：如后续需要区分 iOS App Store / Android 下载地址时再启用。

示例：

```text
https://link.yizuw.cn/ul/link/index.html?target=%2Fhome&store=https%3A%2F%2Fapps.apple.com%2Fcn%2Fapp%2Fid1234567890
```

## 暂未启用（预留）

- `tk`
- `ts`
- `nonce`
- `sig`

说明：这些参数用于短期令牌、防篡改、防重放。当前版本未启用，后续按安全需求补齐。

## 推荐发布口径

- 对外默认只发：`target=/home&webOrigin=https://yizuw.cn`
- 招商分享场景可发：`target=/rental/factory/detail/:id&webOrigin=https://yizuw.cn`
- 业务需要更多落地页时，再扩展白名单并同步更新此文档
