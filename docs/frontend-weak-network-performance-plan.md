# 前端弱网与首屏加载性能优化开发方案

## 1. 背景

后台系统在弱网、低端手机、微信内置浏览器、安卓 WebView 等环境下，可能出现首页长时间转圈、白屏、登录页迟迟不出现、进入后台后资源加载失败等问题。同一套系统在不同用户侧表现不一致，并不一定是业务接口问题，也可能是前端包体、缓存、运行环境和异常兜底共同导致。

本方案目标是让用户先尽快看到并操作登录页，登录成功后再渐进加载后台业务资源；同时补齐资源加载失败、旧缓存、JS 运行错误、低端设备解析慢等兜底机制，减少“页面一直转圈”的投诉。

## 2. 必须覆盖的问题

本次优化必须考虑以下场景：

| 场景 | 典型表现 | 核心处理方向 |
| --- | --- | --- |
| 浏览器缓存旧 JS，加载新 chunk 失败 | 发布后旧页面点击菜单白屏，控制台出现 chunk 404 或动态模块加载失败 | HTML 不强缓存，静态资源用 hash 长缓存，chunk 失败时提示刷新或自动恢复 |
| 手机性能低，解析大包慢 | 网络已下载完成，但页面仍卡在 loading | 降低首屏 JS 体积，拆分重型依赖，登录页独立加载 |
| 微信/安卓 WebView 版本差异 | Chrome 正常，微信或旧安卓 WebView 报兼容错误 | 明确兼容目标，检查构建 target、polyfill 和真机矩阵 |
| 某个资源下载失败后没有重试 | 单个 JS/CSS 请求失败后页面永远卡住 | 动态 import 增加 retry，路由加载错误统一兜底 |
| 首屏加载太多非登录必需资源 | 登录页还没显示就下载后台菜单、图表、表格、导出库 | 登录链路瘦身，业务页面和重依赖全部按需加载 |
| JS 运行时报错后页面卡在 loading | 控制台有异常，用户界面没有错误提示 | Vue errorHandler、window error、unhandledrejection、路由错误兜底 |

## 3. 优化目标

1. 登录页优先可交互：弱网下先显示登录框，不让后台业务资源阻塞登录页。
2. 后台页面按需加载：用户登录后再加载菜单、业务页面、图表、导出、打印、富文本等资源。
3. 资源失败可恢复：chunk 加载失败、网络闪断、旧缓存版本错配时，页面能提示刷新或自动重试。
4. 运行异常不空白：JS 报错后展示错误兜底页或可重试提示，不让页面一直卡在 loading。
5. 发布缓存策略稳定：避免新旧版本资源混用，降低发布后白屏概率。
6. 可观测可验收：能通过慢网、低端机、微信 WebView、旧缓存模拟测试证明效果。

## 4. 非目标

1. 不重构整体业务架构，不改变现有权限和菜单逻辑。
2. 不一次性改完所有业务页面，只优先治理首屏、登录链路、公共异常兜底和明显重依赖。
3. 不把所有接口都做离线缓存，避免引入数据一致性问题。
4. 不把弱网问题简单归因给用户网络，前端需要提供明确加载状态和恢复路径。

## 5. 当前项目判断

结合当前 Vben Admin 项目结构，优化重点不是从零实现路由懒加载，而是继续压缩登录链路和补齐异常兜底：

1. 路由层已有大量动态导入，业务页面具备按需加载基础。
2. 登录路由需要保持独立 chunk，不能在登录前提前引入后台 layout、复杂菜单、图表、导出、富文本等依赖。
3. 需要检查公共入口、全局 store、插件注册、权限初始化是否把后台资源提前打进首屏包。
4. 构建产物需要持续检查大 chunk，避免第三方库被主包提前引用。
5. 发布时必须保证 `index.html` 不强缓存，hash 静态资源长缓存，否则容易出现旧 HTML 加载新旧 chunk 混用问题。
6. 生产构建前需要确保内部共享包使用正式构建产物，避免把开发 stub 或 Node 侧依赖错误打进浏览器包。

## 6. 方案总览

整体采用“先登录、后后台、失败可恢复、异常可观测”的策略：

1. 登录页独立加载：登录页面只保留认证必需代码、样式和接口。
2. 业务页面动态加载：菜单页面、图表、表格、导出、打印、编辑器等按页面和操作懒加载。
3. 动态 import 加重试：资源下载失败时自动重试，仍失败时提示刷新。
4. 路由错误统一处理：拦截 chunk 加载失败、模块加载失败、旧缓存错配。
5. 全局异常兜底：Vue、window、Promise 异常统一记录和展示恢复入口。
6. 发布缓存规范化：HTML 不缓存，带 hash 的 JS/CSS/图片长缓存。
7. 弱网体验兜底：骨架屏、超时提示、重试按钮、离线提示。
8. 构建体积监控：每次发布关注首屏主包、登录包、vendor 包大小。

## 7. 分阶段开发计划

### 阶段 1：首屏和登录链路瘦身

目标：用户打开系统后，优先加载登录页必需资源。

开发内容：

1. 确认登录路由保持动态导入。
2. 检查登录页是否引入后台 layout、菜单、统计、图表、复杂表格等模块。
3. 登录前不请求后台菜单、字典、统计面板、业务列表等非必要接口。
4. 第三方重依赖不要在应用入口静态 import。
5. 登录页样式尽量使用当前设计系统基础能力，避免额外引入大型组件。

验收标准：

1. 慢 3G 网络下，登录框能优先出现。
2. 未登录访问 `/workbench` 等后台地址时，应快速跳转登录页，不提前下载大量后台页面 chunk。
3. 构建产物中登录链路 chunk 不包含图表、导出、富文本、打印等重依赖。

### 阶段 2：业务页面和重依赖懒加载

目标：登录后按需加载后台页面，不让首屏承担所有业务包。

优先排查的重依赖类型：

1. 图表类：`echarts` 等。
2. 表格增强类：复杂表格、虚拟滚动、导入导出组件。
3. 文件处理类：Excel、PDF、图片压缩、截图、打印。
4. 富文本和编辑器类。
5. 地图、微信 JS SDK、支付 SDK 等特定场景依赖。

处理原则：

1. 页面组件使用 `() => import(...)`。
2. 页面内部重功能在用户点击后再 `import(...)`。
3. Tab 内非首个面板延后加载。
4. 弹窗内复杂组件打开弹窗时再加载。
5. 大图片、图标集合、示例资源不要进入登录首屏。

示例：

```ts
async function exportExcel() {
  const [{ Workbook }, { saveAs }] = await Promise.all([
    import('exceljs'),
    import('file-saver'),
  ]);

  const workbook = new Workbook();
  // 仅在用户点击导出时才加载并执行导出逻辑
}
```

### 阶段 3：动态资源加载失败重试

目标：网络抖动或某个 chunk 下载失败时，页面不要直接卡死。

建议新增工具方法：

```ts
// playground/src/utils/retry-import.ts
type ImportFactory<T> = () => Promise<T>;

interface RetryImportOptions {
  delay?: number;
  retries?: number;
}

export async function retryImport<T>(
  factory: ImportFactory<T>,
  options: RetryImportOptions = {},
): Promise<T> {
  const { delay = 800, retries = 2 } = options;
  let lastError: unknown;

  for (let index = 0; index <= retries; index += 1) {
    try {
      return await factory();
    } catch (error) {
      lastError = error;

      if (index < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, delay * (index + 1)),
        );
      }
    }
  }

  throw lastError;
}
```

路由中使用：

```ts
import { retryImport } from '#/utils/retry-import';

export const routes = [
  {
    component: () =>
      retryImport(() => import('#/views/rental/factory/index.vue')),
    name: 'Factory',
    path: '/rental/factory',
  },
];
```

说明：

1. 不是所有动态 import 都必须立刻改，可以先覆盖高频页面和核心后台入口。
2. 对旧缓存导致的 chunk 404，重试通常无法解决，需要配合刷新提示和缓存策略。
3. 对网络闪断导致的加载失败，重试可以明显减少白屏概率。

### 阶段 4：路由和 chunk 错误兜底

目标：识别 chunk 加载失败、动态模块加载失败、旧缓存错配，并给用户明确恢复动作。

建议在路由初始化处增加统一处理：

```ts
function isChunkLoadError(error: unknown) {
  const message = String((error as Error)?.message || error || '');

  return [
    'Failed to fetch dynamically imported module',
    'Importing a module script failed',
    'Loading chunk',
    'ChunkLoadError',
  ].some((keyword) => message.includes(keyword));
}

router.onError((error) => {
  if (!isChunkLoadError(error)) {
    return;
  }

  const storageKey = 'app:chunk-error-reloaded';
  const alreadyReloaded = sessionStorage.getItem(storageKey);

  if (!alreadyReloaded) {
    sessionStorage.setItem(storageKey, '1');
    window.location.reload();
    return;
  }

  sessionStorage.removeItem(storageKey);
  // 这里接入项目现有 message/modal 组件，提示用户刷新页面
  window.alert('系统资源已更新或网络异常，请刷新页面后重试。');
});
```

处理策略：

1. 第一次 chunk 失败可以自动刷新一次，解决发布后旧缓存问题。
2. 自动刷新后仍失败，不要无限刷新，展示可操作提示。
3. 错误信息需要上报，便于定位是资源 404、网络失败还是兼容性错误。

### 阶段 5：JS 运行异常兜底

目标：JS 报错后不让用户永远停留在 loading。

建议接入：

```ts
app.config.errorHandler = (error, instance, info) => {
  console.error('[vue-error]', error, info, instance);
  // 上报错误，并按项目现有方式展示错误兜底 UI
};

window.addEventListener('error', (event) => {
  console.error('[window-error]', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandled-rejection]', event.reason);
});
```

要求：

1. 全局 loading 必须有超时机制。
2. 关键初始化失败时展示错误页或重试按钮。
3. 不允许只在控制台报错，用户界面没有反馈。
4. 错误上报至少包含：页面地址、用户代理、资源地址、错误 message、版本号、网络状态。

### 阶段 6：缓存和发布策略

目标：避免新旧资源混用，降低发布后 chunk 404 和白屏概率。

Nginx 建议配置：

```nginx
location = /index.html {
  add_header Cache-Control "no-cache, no-store, must-revalidate";
  try_files $uri =404;
}

location / {
  try_files $uri $uri/ /index.html;
}

location ~* \.(js|css|png|jpg|jpeg|gif|svg|webp|ico|woff|woff2)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
  try_files $uri =404;
}
```

发布要求：

1. `index.html` 不强缓存，每次访问都能拿到最新资源索引。
2. JS/CSS/图片文件名必须带 hash，可以长期缓存。
3. 发布新版本时不要删除旧版本资源过快，避免用户旧页面还在引用旧 chunk。
4. 如果使用 CDN，需要同步设置 HTML 和静态资源的不同缓存策略。
5. 如果未来启用 PWA 或 Service Worker，必须专门处理更新策略，否则可能加重旧缓存问题。

### 阶段 7：兼容性和低端设备优化

目标：兼容微信内置浏览器、安卓 WebView 和低性能手机。

处理方向：

1. 明确最低兼容版本，例如 Android 8+、微信内置浏览器当前主流版本。
2. 构建 target 和 polyfill 要与兼容目标一致。
3. 避免在首屏执行大量同步计算。
4. 大列表默认分页或虚拟滚动，不在首屏渲染大量 DOM。
5. 登录页不要初始化复杂全局插件。
6. 真机测试必须包含微信内置浏览器和至少一台低端安卓机。

验收方式：

1. Chrome DevTools 开启 Slow 3G 和 4x CPU slowdown。
2. 微信内置浏览器打开登录页、登录、进入首页、切换菜单。
3. 安卓 WebView 环境重复上述流程。
4. 控制台无语法兼容错误和致命运行时错误。

## 8. 加载状态与用户体验

弱网下不能只显示无限 loading。

需要补齐：

1. 首屏 loading 超过 5 秒，显示“网络较慢，请稍候”。
2. 关键资源加载失败，显示“重新加载”按钮。
3. 接口超时，显示可重试提示，不覆盖已加载内容。
4. 进入后台首页时使用骨架屏，不出现长时间空白。
5. `navigator.onLine === false` 时展示离线提示。
6. 菜单切换时局部 loading，避免整页白屏。

## 9. 构建体积和产物检查

每次上线前建议检查：

1. 登录相关 chunk 体积。
2. 主入口 chunk 体积。
3. vendor chunk 是否过大。
4. 图表、导出、富文本等依赖是否进入首屏。
5. 生产包里是否混入 Node 侧依赖或开发 stub。

建议命令：

```bash
pnpm -F @vben-core/shared build
pnpm -F @vben/playground build
rg "createJiti|node:os|jiti.import" playground/dist
```

要求：

1. `rg` 不应在浏览器构建产物中搜到 Node 侧开发加载逻辑。
2. 如果发现大 chunk，需要回溯是哪一个静态 import 把重依赖提前带入。
3. 大型依赖拆分后，需要检查请求数量，避免过度拆包导致弱网请求太多。

## 10. 测试方案

### 10.1 慢网测试

环境：

1. Chrome DevTools Network: Slow 3G。
2. CPU throttling: 4x slowdown。
3. Disable cache 开关分别测试开启和关闭。

测试项：

1. 未登录打开系统首页。
2. 未登录访问后台深层链接。
3. 登录成功进入工作台。
4. 首次打开高频业务页面。
5. 刷新页面后重复进入。

通过标准：

1. 登录页可见且可操作。
2. 页面不长时间空白。
3. 加载慢时有明确 loading、骨架屏或提示。
4. 控制台无致命错误。

### 10.2 旧缓存测试

步骤：

1. 打开旧版本系统并保持页面不关闭。
2. 发布新版本。
3. 在旧页面点击菜单或触发动态页面加载。
4. 观察是否出现 chunk 加载失败。

通过标准：

1. 失败时最多自动刷新一次。
2. 仍失败时展示刷新提示。
3. 不出现无限刷新。
4. 不出现永久白屏或永久 loading。

### 10.3 资源失败测试

步骤：

1. 构建后临时移走某个业务页面 chunk。
2. 打开对应页面。
3. 模拟网络中断后恢复。

通过标准：

1. 动态 import 有重试。
2. 重试失败后有明确错误提示。
3. 用户能点击重新加载或刷新恢复。

### 10.4 WebView 测试

设备矩阵：

1. 微信内置浏览器。
2. 安卓系统 WebView。
3. 低端安卓机。
4. iOS Safari 或微信 iOS 内置浏览器。

测试项：

1. 登录页渲染。
2. 登录接口调用。
3. 首页加载。
4. 菜单切换。
5. 支付、上传、定位等特殊能力页面按需测试。

## 11. 上线验收标准

1. 弱网下登录页优先出现，不能被后台业务资源阻塞。
2. 发布新版本后，旧页面触发 chunk 错误时能自动恢复或提示刷新。
3. JS 运行错误不会让页面永久卡在 loading。
4. 微信内置浏览器和安卓 WebView 基础流程可用。
5. 首屏不加载图表、导出、富文本、打印等非登录必需资源。
6. Nginx 或 CDN 缓存策略满足 HTML 不强缓存、hash 静态资源长缓存。
7. 构建产物中没有错误混入 Node 侧依赖。
8. 慢 3G + 4x CPU slowdown 下完成登录链路验收。

## 12. 推荐落地顺序

1. 先加路由 chunk 错误处理和全局 JS 异常兜底，解决“卡死无反馈”。
2. 调整 Nginx 或 CDN 缓存策略，解决发布后旧缓存资源错配。
3. 检查登录链路依赖，剥离非登录必需资源。
4. 对高频业务路由接入动态 import 重试。
5. 拆分图表、导出、富文本、打印等重依赖。
6. 建立慢网、旧缓存、WebView、低端机验收流程。
7. 上线后持续记录 chunk 加载失败和运行时错误，按真实数据继续优化。

## 13. 结论

该方案可行，并且是后台管理系统处理弱网和低端设备体验问题的常规优化路径。核心不是让所有资源一次性更快加载，而是改变加载顺序和失败处理方式：登录页先可用，后台资源后加载，加载失败能重试，旧缓存能恢复，运行错误能提示。这样网络好的用户基本无感，网络差或设备差的用户也不会长时间面对空白页面或无限转圈。
