# CRM锁客小程序壳

这是 `playground` 前端附属的微信小程序 WebView 壳，不是独立后端服务，也不承载 CRM 业务逻辑。正式业务页面在 PC/H5 的 `/invite/crm`，小程序只负责读取二维码参数、换取微信身份信息，并打开同一套 H5 入口。

工程目录：

```text
playground/miniprogram
```

微信开发者工具打开这个目录即可。

## 正式入口

小程序只注册一个页面：`pages/home/index`。

扫码进入后，`pages/home/index` 会读取 `options.scene`、`options.s` 或 `options.q` URL 中的 `scene/s` 参数，随后调用 `wx.login`，请求 `API_BASE_URL + /crm/miniprogram/session` 换取 `openid/unionid`。如果 `REQUIRE_PHONE_BEFORE_WEBVIEW=true`，会先通过 `getPhoneNumber` 获取手机号，再打开 H5。

最终 WebView 地址：

```text
H5_BASE_URL + /invite/crm?scene=xxx&openid=xxx&unionid=xxx&phone=xxx&source=miniprogram
```

`phone` 仅在手机号授权并由后端换取成功后有值；未开启手机号前置授权时为空。小程序不参与锁客绑定，绑定逻辑由 H5/后端处理。

## 开发配置

1. 复制或直接修改 `config.js`。
2. 设置 `API_BASE_URL` 为后端接口域名，通常是 `https://你的域名/api`。
3. 设置 `H5_BASE_URL` 为前端域名，通常是 `https://你的域名`。
4. 设置 `REQUIRE_PHONE_BEFORE_WEBVIEW` 控制是否在打开 H5 前先获取手机号。
5. 微信后台需要配置 request 合法域名和 web-view 业务域名。
6. 微信后台需要开通并配置手机号快速验证能力，才能使用 `getPhoneNumber`。
7. 后端的小程序码页面变量保持为 `CRM_MINIPROGRAM_QRCODE_PAGE=pages/home/index`。

小程序内不要放 AppSecret、企微 Secret 或回调 AES Key，这些只放后端环境变量。
