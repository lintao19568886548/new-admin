# Vben Admin 项目入职学习文档

本文档面向刚接手本仓库的开发者，目标是帮助你快速理解项目结构、运行方式、前后端链路、权限机制、数据库结构和主要业务模块。建议先按本文档的阅读顺序走一遍，再按具体业务需求深入源码。

## 1. 项目定位

本项目是基于 Vue Vben Admin 改造的园区运营管理系统，主要覆盖租赁管理、账单财务、人事考勤、招商雷达、报销、门禁访客、系统权限、会员和组织开通等业务。

项目不是单一前端应用，而是一个 pnpm monorepo：

```text
D:\master\vben-admin
├─ playground              # 前端主应用，实际业务页面主要在这里
├─ apps
│  └─ backend-mock         # Nitro + Prisma 后端，本项目实际承载大量业务接口
├─ packages                # Vben 框架层、UI、状态、请求、权限等共享包
├─ internal                # Vite、Tailwind、ESLint、TSConfig 等内部配置包
├─ docs                    # 项目文档
├─ scripts                 # 仓库脚本
├─ package.json            # 根脚本
├─ pnpm-workspace.yaml     # monorepo 工作区
└─ turbo.json              # turbo 任务配置
```

你日常开发最常看的目录是：

```text
playground/src             # 前端源码
playground/src/views       # 页面
playground/src/api         # 前端请求封装
playground/src/router      # 路由、守卫、权限接入
apps/backend-mock/api      # 后端接口
apps/backend-mock/utils    # 后端业务工具、服务、数据库封装
apps/backend-mock/prisma   # Prisma schema
```

## 2. 环境和常用命令

根目录要求：

```text
Node >= 20
pnpm >= 9
```

仓库当前 `package.json` 指定：

```text
packageManager: pnpm@10.33.0
```

### 2.1 安装依赖

```bash
pnpm install
```

### 2.2 启动前端开发

推荐：

```bash
pnpm -F @vben/playground dev
```

也可以用根脚本：

```bash
pnpm dev:play
```

前端端口在 `playground/.env.development`：

```env
VITE_PORT=5556
VITE_GLOB_API_URL=/api
VITE_NITRO_MOCK=true
```

开发时访问：

```text
http://localhost:5556
```

### 2.3 后端 mock

开发时，前端 Vite 插件会尝试自动启动 `@vben/backend-mock`，默认端口是：

```text
http://localhost:5320/api
```

如果需要单独启动后端：

```bash
pnpm -F @vben/backend-mock start
```

### 2.4 构建

前端构建：

```bash
pnpm -F @vben/playground build
```

后端构建：

```bash
pnpm -F @vben/backend-mock build
```

### 2.5 类型检查

前端：

```bash
pnpm -F @vben/playground typecheck
```

后端：

```bash
pnpm -F @vben/backend-mock exec tsc --noEmit
```

### 2.6 Lint

修改 TS/Vue/JS 后，至少对改动文件跑一次 ESLint：

```bash
pnpm exec eslint --no-cache <changed-files>
```

大范围改动再跑：

```bash
pnpm lint
```

### 2.7 Prisma

本项目 Prisma 不走 migrate，而是走 db push，并且数据库结构由用户手动管理。

常用命令：

```bash
pnpm -F @vben/backend-mock run prisma:generate
pnpm -F @vben/backend-mock run push
```

注意：不要擅自执行 Android 构建，应由用户执行。

## 3. 前端整体架构

前端主应用位于：

```text
playground/src
```

主要目录：

```text
playground/src
├─ adapter       # Vben 组件适配，表单、表格、Ant Design 组件映射
├─ api           # 前端请求函数
├─ components    # 项目内通用组件
├─ hooks         # 项目内 hooks
├─ layouts       # 布局
├─ locales       # 国际化
├─ router        # 路由、权限、守卫
├─ store         # 项目 Pinia store
├─ utils         # 业务工具
└─ views         # 页面
```

### 3.1 前端启动链路

入口文件：

```text
playground/src/main.ts
```

启动顺序：

1. 初始化偏好设置 `initPreferences`
2. 动态导入 `bootstrap.ts`
3. 创建 Vue app
4. 注册组件适配器、i18n、Pinia、权限指令、Tippy、router、Ionic、Vue Query、Motion
5. 挂载到 `#app`

关键文件：

```text
playground/src/main.ts
playground/src/bootstrap.ts
playground/src/app.vue
playground/src/layouts/basic.vue
```

### 3.2 App 和布局

`app.vue` 负责：

- Ant Design `ConfigProvider`
- 深色/浅色主题 token
- Capacitor 原生端状态栏
- App 深链跳转
- 微信运行环境检测
- 全局隐私弹窗
- 投资招商相关样式修正

`layouts/basic.vue` 负责：

- 桌面端 Vben `BasicLayout`
- 移动端 Ionic 风格页面容器
- 移动端头部和底部 tab
- 登录过期弹窗
- 修改密码弹窗
- 水印
- 下拉刷新
- 原生返回按钮处理

移动端和桌面端不是两个项目，而是同一个 Vue 应用根据窗口宽度切换布局。

### 3.3 组件适配器

文件：

```text
playground/src/adapter/component/index.ts
playground/src/adapter/form.ts
playground/src/adapter/vxe-table.ts
```

`component/index.ts` 把 Ant Design Vue 组件注册给 Vben 表单系统使用，例如：

```text
Input
Select
ApiSelect
ApiCascader
DatePicker
RangePicker
Upload
TreeSelect
```

所以业务页面里经常看到这样的 schema：

```ts
{
  component: 'ApiSelect',
  fieldName: 'parkId',
  label: '园区',
}
```

这不是原生 Vue 组件写法，而是 Vben 表单 schema 驱动的写法。

## 4. 路由和菜单

关键文件：

```text
playground/src/router/index.ts
playground/src/router/routes/index.ts
playground/src/router/routes/core.ts
playground/src/router/routes/modules
playground/src/router/access.ts
playground/src/router/guard.ts
playground/src/preferences.ts
```

### 4.1 路由创建

`router/index.ts` 创建 `vue-router` 实例。

历史模式由环境变量控制：

```ts
import.meta.env.VITE_ROUTER_HISTORY === 'hash';
```

路由表来自：

```text
playground/src/router/routes/index.ts
```

### 4.2 基础路由

`routes/core.ts` 定义不依赖权限的基础路由：

- `/` 根路由，使用 `BasicLayout`
- `/auth/login` 登录
- `/auth/code-login` 验证码登录
- `/auth/qrcode-login` 二维码登录
- `/auth/forget-password` 忘记密码
- `/auth/register` 注册
- 404 fallback

这些路由是应用运行必须存在的路由。

### 4.3 业务路由

业务路由文件在：

```text
playground/src/router/routes/modules
```

常见模块：

```text
access.ts          # 门禁、车辆、访客
bill.ts            # 账单
dashboard.ts       # 仪表盘、首页、工作台
finance.ts         # 财务
hrm.ts             # 人事、考勤、请假
investment.ts      # 招商
maintenance.ts     # 维保
notices.ts         # 公告
profile.ts         # 我的、会员
Reimbursement.ts   # 报销
rental.ts          # 租赁
system.ts          # 系统管理
```

### 4.4 后端菜单模式

项目配置在 `playground/src/preferences.ts`：

```ts
app: {
  accessMode: 'backend',
}
```

这意味着权限和菜单主要由后端返回。

前端调用：

```text
GET /menu/all
```

前端文件：

```text
playground/src/api/core/menu.ts
playground/src/router/access.ts
```

后端文件：

```text
apps/backend-mock/api/menu/all.ts
```

后端返回的是带 `component` 字符串的菜单树，例如：

```ts
{
  path: '/bill',
  name: 'Bill',
  component: '/bill/amount/list',
  meta: {
    title: '账单管理',
    icon: 'mdi:file-document-multiple',
  },
}
```

前端 `router/access.ts` 中有：

```ts
const pageMap = import.meta.glob('../views/**/*.vue');
```

它会把后端返回的 `component` 字符串映射成真实 Vue 页面。

### 4.5 移动端路由跳转

`router/guard.ts` 里维护了移动端路由映射。

例如桌面端：

```text
/bill
```

手机宽度下会自动跳到：

```text
/bill/mobile-list
```

类似映射还包括：

```text
/rental/tenant -> /rental/tenant/mobile
/finance/manage -> /finance/mobile-manage
/hrm/information -> /hrm/mobile-information
/maintenance/elevator -> /maintenance/elevator/mobile
```

所以如果你新增业务模块并需要移动端页面，要同步考虑：

1. PC 页面路由
2. mobile 页面路由
3. `router/guard.ts` 移动端映射
4. 后端菜单是否需要补充 hidden/mobile route

## 5. 请求链路

核心文件：

```text
playground/src/api/request.ts
packages/effects/request
```

前端所有业务接口基本都使用：

```ts
requestClient.get(...)
requestClient.post(...)
requestClient.put(...)
requestClient.delete(...)
requestClient.upload(...)
requestClient.download(...)
```

### 5.1 baseURL

`request.ts` 通过：

```ts
useAppConfig(import.meta.env, import.meta.env.PROD);
```

读取 API 地址。

开发环境中：

```env
VITE_GLOB_API_URL=/api
```

所以前端请求一般是：

```text
/api/xxx
```

### 5.2 Vite 代理

文件：

```text
playground/vite.config.mts
```

代理规则：

```ts
'/api' -> http://localhost:5320/api
```

并 rewrite 去掉前端路径开头的 `/api`。实际效果：

```text
前端请求: /api/auth/login
代理后端: http://localhost:5320/api/auth/login
```

### 5.3 请求拦截器

`request.ts` 会自动加：

```http
Authorization: Bearer <accessToken>
Accept-Language: <locale>
```

### 5.4 响应解包

后端统一响应格式通常是：

```ts
{
  code: 0,
  data: ...,
  error: null,
  message: 'ok',
}
```

`requestClient` 配置：

```ts
responseReturn: 'data';
```

所以业务页面拿到的一般直接是 `data`，而不是完整响应对象。

### 5.5 Token 刷新

`request.ts` 中配置了：

```ts
authenticateResponseInterceptor;
refreshTokenApi;
```

当 access token 过期时，会尝试调用：

```text
POST /auth/refresh
```

刷新成功后重试原请求。刷新失败则进入重新登录流程。

## 6. 后端整体架构

后端位于：

```text
apps/backend-mock
```

主要目录：

```text
apps/backend-mock
├─ api          # Nitro 文件路由接口
├─ middleware   # 全局中间件
├─ plugins      # 后台 worker、定时任务、启动插件
├─ prisma       # Prisma schema
├─ scripts      # 数据修复、同步、诊断脚本
├─ utils        # 后端业务服务和工具
└─ nitro.config.ts
```

虽然目录名叫 `backend-mock`，但这个后端已经承载了大量真实业务逻辑，不只是简单 mock。

### 6.1 Nitro 文件路由

Nitro 根据文件路径生成接口。

示例：

```text
apps/backend-mock/api/auth/login.post.ts
```

对应：

```http
POST /api/auth/login
```

示例：

```text
apps/backend-mock/api/maintenance/elevator/list.ts
```

对应：

```http
GET /api/maintenance/elevator/list
```

示例：

```text
apps/backend-mock/api/maintenance/elevator/[id].put.ts
```

对应：

```http
PUT /api/maintenance/elevator/:id
```

### 6.2 全局中间件

核心文件：

```text
apps/backend-mock/middleware/1.api.ts
```

它负责：

- CORS
- OPTIONS 请求
- 判断是否公开 API
- 解析和验证 access token
- 校验中心库用户状态
- 校验 tokenVersion
- 校验用户当前 customerId
- 查询 customer 对应租户数据库
- 设置当前请求的 `customerId/dbName`
- 会员访问限制
- 组织开通过程中的写入限制
- API 写操作日志

理解这个文件非常重要。很多接口里看起来直接用了 `prismaClient`，但实际数据库连接是这里根据 token 设定的上下文决定的。

### 6.3 响应工具

文件：

```text
apps/backend-mock/utils/response.ts
```

常用方法：

```ts
useResponseSuccess(data);
usePageResponseSuccess(page, pageSize, list);
useResponseError(message);
serverErrorResponse(message, event);
forbiddenResponse(event, message);
unAuthorizedResponse(event, message);
badRequestResponse(message, event);
```

接口应尽量统一使用这些方法返回。

## 7. 数据库和 Prisma

关键文件：

```text
apps/backend-mock/utils/db.ts
apps/backend-mock/prisma.config.ts
apps/backend-mock/prisma/center
apps/backend-mock/prisma/schema
apps/backend-mock/prisma/notices
```

### 7.1 三类 Prisma schema

`prisma.config.ts` 根据 `PRISMA_TARGET` 选择 schema：

```text
默认              -> prisma/schema
PRISMA_TARGET=center  -> prisma/center
PRISMA_TARGET=notices -> prisma/notices/schema.prisma
```

### 7.2 中心库

目录：

```text
apps/backend-mock/prisma/center
```

中心库管理：

- 中心用户
- 客户 customer
- 组织开通
- 会员
- 租户邀请
- CRM 配置
- 菜单模板同步
- API 日志
- 版本信息

后端代码中使用：

```ts
systemDbClient;
```

### 7.3 租户业务库

目录：

```text
apps/backend-mock/prisma/schema
```

租户业务库管理：

- 用户和角色
- 菜单
- 园区
- 租户
- 厂房
- 账单
- 财务
- 报销
- 人事
- 维保
- 门禁访客
- 招商雷达
- 图片
- 反馈

后端代码中使用：

```ts
prismaClient;
```

### 7.4 `systemDbClient` 和 `prismaClient` 的区别

`systemDbClient`：

- 固定连接中心库
- 用于登录、会员、组织、中心用户、customer 等

`prismaClient`：

- 是一个 Proxy
- 根据当前请求上下文切换租户库
- 上下文来自 `middleware/1.api.ts`
- 业务接口大多用它

简单判断：

```text
管账号归属、客户、会员、组织 -> systemDbClient
管某个租户下的业务数据       -> prismaClient
```

## 8. 登录、鉴权和权限

### 8.1 前端登录入口

前端 API：

```text
playground/src/api/core/auth.ts
```

Pinia store：

```text
playground/src/store/auth.ts
```

主要方法：

```ts
authLogin;
authLoginBySmsCode;
handleAfterLogin;
ensureSessionReady;
fetchUserInfo;
logout;
requireReauthentication;
```

### 8.2 后端登录接口

文件：

```text
apps/backend-mock/api/auth/login.post.ts
```

流程：

1. 读取 username/password
2. 在中心库查用户
3. 校验用户状态和 customer
4. 校验密码，兼容明文并自动升级为 bcrypt
5. 根据 center user 切到租户库解析用户、角色、权限码、园区
6. 生成 access token
7. 生成 refresh token
8. refresh token 写入数据库并写入 Cookie
9. 返回 accessToken 和用户信息

### 8.3 用户信息组装

文件：

```text
apps/backend-mock/utils/user-service.ts
```

它会组装 token 中需要的信息：

```ts
{
  centerUserId,
  id,
  username,
  realName,
  customerId,
  roles,
  codes,
  parks,
  tokenVersion,
  homePath,
}
```

这些信息会影响：

- 菜单权限
- 按钮权限
- 园区数据范围
- token 是否失效
- 多租户数据库切换

### 8.4 权限码

前端获取权限码：

```text
GET /auth/codes
```

按钮级权限一般通过：

```vue
v-access:code
```

或使用 `@vben/access` 里的权限工具。

### 8.5 菜单权限

后端 `/menu/all`：

- Super 角色可查全部菜单
- 非 Super 根据用户角色查 `roleMenu`
- 排除 `button` 类型
- 追加会员页、移动端兼容路由、招商雷达辅助路由等
- 返回给前端生成动态路由

相关文件：

```text
apps/backend-mock/api/menu/all.ts
apps/backend-mock/utils/profile-route-menus.ts
apps/backend-mock/utils/park-menu-placement.ts
apps/backend-mock/utils/permission-cache.ts
```

## 9. 标准 CRUD 功能实现方式

本项目很多业务模块遵循同一套模式：

```text
router/routes/modules/<module>.ts
        ↓
views/<module>/<feature>/list.vue
        ↓
views/<module>/<feature>/data.ts
        ↓
views/<module>/<feature>/modules/form.vue
        ↓
api/<module>/<feature>.ts
        ↓
apps/backend-mock/api/<module>/<feature>/list.ts
apps/backend-mock/api/<module>/<feature>/[id].ts
apps/backend-mock/api/<module>/<feature>/[id].put.ts
apps/backend-mock/api/<module>/<feature>/[id].delete.ts
        ↓
apps/backend-mock/prisma/schema/<module>.prisma
```

### 9.1 以电梯管理为例

路由：

```text
playground/src/router/routes/modules/maintenance.ts
```

页面：

```text
playground/src/views/maintenance/elevator/list.vue
```

表格列和查询表单：

```text
playground/src/views/maintenance/elevator/data.ts
```

新增/编辑弹窗：

```text
playground/src/views/maintenance/elevator/modules/form.vue
```

前端 API：

```text
playground/src/api/maintenance/elevator.ts
```

后端 API：

```text
apps/backend-mock/api/maintenance/elevator/list.ts
apps/backend-mock/api/maintenance/elevator/[id].ts
apps/backend-mock/api/maintenance/elevator/[id].put.ts
apps/backend-mock/api/maintenance/elevator/[id].delete.ts
```

Prisma 模型：

```text
apps/backend-mock/prisma/schema/maintenance.prisma
```

### 9.2 列表页常见结构

`list.vue` 通常做这些事：

- 引入 `Page`
- 引入 `useVbenVxeGrid`
- 引入 API
- 引入 `data.ts` 的列配置和查询表单 schema
- 配置 `proxyConfig.ajax.query`
- 处理新增、编辑、删除
- 挂载 `FormModal`

### 9.3 `data.ts` 常见职责

`data.ts` 通常做：

- 定义查询表单 schema
- 定义新增/编辑表单 schema
- 定义 VxeTable columns
- 定义枚举 options
- 定义字段格式化
- 定义操作列按钮

### 9.4 `form.vue` 常见职责

`modules/form.vue` 通常做：

- 使用 `useVbenForm`
- 使用 `useVbenModal`
- 打开时回填数据
- 点击确认时校验表单
- 区分新增还是编辑
- 调用 `createXxx` 或 `updateXxx`
- 成功后 emit `success`

### 9.5 后端列表接口常见职责

后端 `list.ts` 通常做：

- 校验 token
- 读取 query
- 根据 query 构造 Prisma `where`
- 根据用户园区权限限制数据范围
- 查询 total
- 查询分页 items
- include 关联表展示字段
- 格式化返回

### 9.6 后端新增/编辑/删除常见职责

新增：

```text
index.post.ts 或同目录 index.ts
```

编辑：

```text
[id].put.ts
```

删除：

```text
[id].delete.ts
```

通常使用：

```ts
readBody(event)
event.context.params.id
prismaClient.xxx.create/update/delete
useResponseSuccess(...)
```

## 10. 主要业务模块

下面是按业务域整理的功能清单。实际菜单以 `/menu/all` 返回和数据库菜单表为准。

### 10.1 仪表盘

前端：

```text
playground/src/views/dashboard
playground/src/api/dashboard
```

后端：

```text
apps/backend-mock/api/dashboard
apps/backend-mock/api/analytics
```

主要页面：

- 首页 `/home`
- 工作台 `/workbench`
- 数据分析 `/analytics`
- 工作空间 `/workspace`

功能包括：

- 合同统计
- 客户概览
- 能耗统计
- 厂房出租统计
- 收入统计
- 表计统计
- 工作台列表

### 10.2 租赁管理

前端：

```text
playground/src/views/rental
playground/src/api/rental
playground/src/api/factory
playground/src/api/dormitory
```

后端：

```text
apps/backend-mock/api/rental
apps/backend-mock/api/factory
apps/backend-mock/api/dormitory
```

Prisma：

```text
apps/backend-mock/prisma/schema/rental.prisma
apps/backend-mock/prisma/schema/park.prisma
```

主要功能：

- 租户管理
- 租赁项目管理
- 厂房列表和详情
- 入驻厂房
- 水表抄表数据
- 电表抄表数据
- 移动端抄表
- 工资发放
- 厂房/宿舍/楼层管理

典型页面：

```text
views/rental/tenant/list.vue
views/rental/tenant/mobile-list.vue
views/rental/manage/list.vue
views/rental/manage/mobile.vue
views/rental/settled/list.vue
views/rental/meter/list.vue
views/rental/water/list.vue
views/rental/reading/mobile.vue
```

### 10.3 账单管理

前端：

```text
playground/src/views/bill/amount
playground/src/api/bill/amount.ts
```

后端：

```text
apps/backend-mock/api/bill/amount
apps/backend-mock/utils/amount-bill-*.ts
```

Prisma：

```text
apps/backend-mock/prisma/schema/bill.prisma
```

主要功能：

- 账单列表
- 账单新增/编辑
- 移动端账单
- 账单打印
- 多页账单表单
- 催缴短信预览和发送
- 账单导出
- 项目期间计算
- 与财务流水联动
- LLM 识别账单材料

重要文件：

```text
views/bill/amount/list.vue
views/bill/amount/mobile-list.vue
views/bill/amount/modules/BillForm.vue
views/bill/amount/modules/MobileAmountBillForm.vue
views/bill/amount/modules/BillPrintPage.vue
views/bill/amount/modules/CollectionSmsModal.vue
views/bill/amount/llm.ts
```

这是项目里的复杂核心模块，建议在熟悉普通 CRUD 后再深入。

### 10.4 财务管理

前端：

```text
playground/src/views/finance/manage
playground/src/api/finance/finance.ts
```

后端：

```text
apps/backend-mock/api/finance
apps/backend-mock/utils/finance-*.ts
```

Prisma：

```text
apps/backend-mock/prisma/schema/finance.prisma
```

主要功能：

- 财务流水列表
- 财务新增/编辑/删除
- 账单名称选项
- 收入确认规则
- 与账单、报销联动

### 10.5 人事管理

前端：

```text
playground/src/views/hrm
playground/src/api/hrm
```

后端：

```text
apps/backend-mock/api/hrm
apps/backend-mock/utils/attendance*.ts
apps/backend-mock/utils/employee-user-binding.ts
```

Prisma：

```text
apps/backend-mock/prisma/schema/employee.prisma
apps/backend-mock/prisma/schema/attendance.prisma
apps/backend-mock/prisma/schema/attendance-device.prisma
apps/backend-mock/prisma/schema/leaveapplication.prisma
```

主要功能：

- 员工信息
- 移动端员工信息
- 考勤打卡
- 考勤记录
- 考勤设备判断
- 考勤地点
- 考勤轨迹
- 请假申请
- 请假审核

### 10.6 维保管理

前端：

```text
playground/src/views/maintenance
playground/src/api/maintenance
```

后端：

```text
apps/backend-mock/api/maintenance
```

Prisma：

```text
apps/backend-mock/prisma/schema/maintenance.prisma
```

主要功能：

- 消防管理
- 电梯管理
- 厂房维护
- 变压器维保
- 卫生检查
- 对应移动端页面

这是最适合作为入门 CRUD 阅读的模块。

### 10.7 门禁访客

前端：

```text
playground/src/views/access
playground/src/api/access
```

后端：

```text
apps/backend-mock/api/access
```

Prisma：

```text
apps/backend-mock/prisma/schema/access.prisma
```

主要功能：

- 门禁管理
- 车辆出入管理
- 访客管理
- 访客登记
- 移动端访客列表
- 公开访客登记接口

### 10.8 招商管理和智能招商雷达

前端：

```text
playground/src/views/investment
playground/src/api/investment
```

后端：

```text
apps/backend-mock/api/investment
apps/backend-mock/utils/investment-radar
```

Prisma：

```text
apps/backend-mock/prisma/schema/investment.prisma
```

主要功能分两层。

基础招商：

- 招商记录
- 招商代理/客户跟进
- 图片上传
- 移动端招商列表

智能招商雷达：

- 雷达线索列表
- 线索详情
- 招商看板
- 外部公开线索
- 企业信号
- 企业画像
- 公开需求采集
- 公开房源采集
- 爬虫数据源
- 爬虫任务
- 评分规则
- 触达任务
- 触达模板
- SOP 跟进
- 物业匹配
- 联系限制和审核
- 公开数据质量审计

注意：`router/routes/modules/investment.ts` 只显式注册了部分招商路由，很多雷达页面是后端 `/menu/all` 通过 `profile-route-menus.ts` 动态追加的。

### 10.9 报销

前端：

```text
playground/src/views/reimbursement
playground/src/api/reimbursement
```

后端：

```text
apps/backend-mock/api/reimbursement
apps/backend-mock/utils/reimbursement-finance.ts
```

Prisma：

```text
apps/backend-mock/prisma/schema/reimbursement.prisma
```

主要功能：

- 报销申请
- 报销审核
- 移动端申请
- 移动端审核
- 报销汇总
- 待审核数量
- 与财务流水同步

### 10.10 公告

前端：

```text
playground/src/views/notices
playground/src/api/notices
```

后端：

```text
apps/backend-mock/api/notices
apps/backend-mock/utils/notices-db.ts
```

主要功能：

- 公告列表
- 移动端公告
- 公告链接校验

### 10.11 系统管理

前端：

```text
playground/src/views/system
playground/src/api/system
```

后端：

```text
apps/backend-mock/api/system
```

主要功能：

- 用户管理
- 角色管理
- 菜单管理
- 菜单模板同步
- 部门管理
- 园区管理
- 反馈管理
- 组织开通记录
- 系统版本

系统管理同时涉及：

- 用户角色关系
- 角色菜单权限
- 菜单元数据
- 按钮权限码
- 园区权限
- 菜单模板同步

### 10.12 个人中心、会员和组织

前端：

```text
playground/src/views/profile
playground/src/api/organization.ts
playground/src/api/organization-invitation.ts
playground/src/api/wechat-pay.ts
```

后端：

```text
apps/backend-mock/api/organization
apps/backend-mock/api/wechat/pay
apps/backend-mock/utils/vip-membership.ts
apps/backend-mock/utils/organization*.ts
apps/backend-mock/utils/wechat-pay.ts
```

主要功能：

- 我的页面
- 会员服务
- 会员支付
- 退款订单
- 企业邀请码
- 加入组织
- 创建组织
- 专属空间开通状态
- 会员访问限制

这部分跨中心库、租户库、微信支付和会员权限，是复杂模块。

### 10.13 CRM 和获客

前端：

```text
playground/src/views/crm
playground/src/api/crm.ts
```

后端：

```text
apps/backend-mock/api/crm
apps/backend-mock/api/wework
apps/backend-mock/utils/crm-*.ts
apps/backend-mock/utils/wework-client.ts
apps/backend-mock/utils/wechat-miniprogram.ts
```

主要功能：

- 获客二维码
- 企业微信回调
- 外部联系人
- 微信小程序手机号
- 邀请链接
- 渠道绑定
- 扫码日志

## 11. 图片上传

前端：

```text
playground/src/api/image/image.ts
```

后端：

```text
apps/backend-mock/api/image/upload.post.ts
```

多个业务模块会用图片：

- 租户
- 厂房
- 账单
- 维保
- 招商
- 报销

如果你处理图片字段，要同时看：

1. 对应业务 Prisma 模型
2. 对应 Image 模型
3. 上传接口
4. 前端表单里的 Upload 配置
5. 保存业务数据时如何关联图片

## 12. 后台 Worker 和插件

Nitro 配置：

```text
apps/backend-mock/nitro.config.ts
```

启动插件：

```text
apps/backend-mock/plugins
```

当前包括：

- 组织开通 worker
- 租赁费用财务同步 worker
- 会员退款 worker
- 招商雷达公开数据采集 worker
- 考勤自动化测试 worker
- 账单催缴短信 worker

相关 utils：

```text
apps/backend-mock/utils/organization-provisioning-worker.ts
apps/backend-mock/utils/rental-expense-finance.ts
apps/backend-mock/utils/vip-membership-refund-worker.ts
apps/backend-mock/utils/investment-radar
apps/backend-mock/utils/attendance-automation-test-worker.ts
apps/backend-mock/utils/amount-bill-collection-sms-worker.ts
```

遇到“为什么我没有点按钮但数据变化了”的情况，要检查这些后台 worker。

## 13. 新人推荐阅读路线

### 第 1 天：跑起来并理解入口

目标：知道项目怎么启动、页面从哪里来。

阅读：

```text
package.json
pnpm-workspace.yaml
playground/package.json
playground/.env.development
playground/src/main.ts
playground/src/bootstrap.ts
playground/src/app.vue
playground/src/layouts/basic.vue
```

操作：

```bash
pnpm install
pnpm -F @vben/playground dev
```

打开浏览器 Network，看登录接口和 `/menu/all`。

### 第 2 天：走通一个标准 CRUD

建议选电梯管理。

阅读：

```text
playground/src/router/routes/modules/maintenance.ts
playground/src/views/maintenance/elevator/list.vue
playground/src/views/maintenance/elevator/data.ts
playground/src/views/maintenance/elevator/modules/form.vue
playground/src/api/maintenance/elevator.ts
apps/backend-mock/api/maintenance/elevator/list.ts
apps/backend-mock/api/maintenance/elevator/[id].put.ts
apps/backend-mock/api/maintenance/elevator/[id].delete.ts
apps/backend-mock/prisma/schema/maintenance.prisma
```

目标：

- 看懂列表怎么请求
- 看懂查询条件怎么转成后端参数
- 看懂弹窗怎么新增/编辑
- 看懂后端怎么分页
- 看懂 Prisma 模型和页面字段怎么对应

### 第 3 天：理解登录、菜单和权限

阅读：

```text
playground/src/store/auth.ts
playground/src/router/access.ts
playground/src/router/guard.ts
playground/src/api/core/auth.ts
apps/backend-mock/api/auth/login.post.ts
apps/backend-mock/api/auth/codes.ts
apps/backend-mock/api/menu/all.ts
apps/backend-mock/utils/user-service.ts
apps/backend-mock/utils/jwt-utils.ts
```

目标：

- 知道登录后为什么会动态出现菜单
- 知道 token 里有哪些用户信息
- 知道权限码从哪里来
- 知道前端路由是怎么注入的

### 第 4 天：理解多租户和数据库

阅读：

```text
apps/backend-mock/middleware/1.api.ts
apps/backend-mock/utils/db.ts
apps/backend-mock/prisma.config.ts
apps/backend-mock/prisma/center
apps/backend-mock/prisma/schema
```

目标：

- 分清中心库和租户库
- 分清 `systemDbClient` 和 `prismaClient`
- 知道 customerId/dbName 从哪里来
- 知道接口为什么能按租户隔离数据

### 第 5 天：深入一个复杂模块

建议顺序：

1. 账单管理
2. 财务管理
3. 报销
4. 招商雷达
5. 会员和组织

账单推荐阅读：

```text
playground/src/views/bill/amount
playground/src/api/bill/amount.ts
apps/backend-mock/api/bill/amount
apps/backend-mock/utils/amount-bill-*.ts
apps/backend-mock/prisma/schema/bill.prisma
```

招商雷达推荐阅读：

```text
playground/src/views/investment/radar
playground/src/api/investment
apps/backend-mock/api/investment/radar
apps/backend-mock/utils/investment-radar
apps/backend-mock/prisma/schema/investment.prisma
```

## 14. 新增一个业务页面的标准步骤

假设新增一个 `设备巡检` 模块。

### 14.1 后端 Prisma

在合适 schema 中增加模型，例如：

```text
apps/backend-mock/prisma/schema/maintenance.prisma
```

然后由用户确认数据库结构后执行 db push。

### 14.2 后端 API

创建目录：

```text
apps/backend-mock/api/maintenance/device-inspection
```

常见文件：

```text
list.ts
index.post.ts
[id].ts
[id].put.ts
[id].delete.ts
```

### 14.3 前端 API

创建：

```text
playground/src/api/maintenance/device-inspection.ts
```

封装：

```ts
getDeviceInspectionList;
createDeviceInspection;
updateDeviceInspection;
deleteDeviceInspection;
```

### 14.4 前端页面

创建：

```text
playground/src/views/maintenance/device-inspection/list.vue
playground/src/views/maintenance/device-inspection/data.ts
playground/src/views/maintenance/device-inspection/modules/form.vue
```

如果需要移动端：

```text
playground/src/views/maintenance/device-inspection/mobile-list.vue
```

### 14.5 路由或后端菜单

如果走静态路由，改：

```text
playground/src/router/routes/modules/maintenance.ts
```

如果走后端菜单，需要在菜单表中添加：

```text
path
name
component
meta.title
meta.icon
authCode
type
```

### 14.6 权限

如果需要按钮权限：

- 增加权限码
- 绑定角色权限
- 页面按钮使用权限码控制

### 14.7 验证

修改 TS/Vue/JS 后：

```bash
pnpm exec eslint --no-cache <changed-files>
pnpm -F @vben/playground typecheck
```

如果改了后端：

```bash
pnpm -F @vben/backend-mock exec tsc --noEmit
```

## 15. 调试建议

### 15.1 看一个页面为什么没有出现

按顺序查：

1. 后端 `/menu/all` 是否返回该菜单
2. `component` 字符串是否能对应 `playground/src/views/**/*.vue`
3. `name` 是否重复
4. 用户角色是否有菜单权限
5. 是否被 `hideInMenu`、`hideMenu`、会员限制影响
6. 移动端是否被守卫跳转到另一个路径

### 15.2 看一个接口为什么 401

按顺序查：

1. 前端请求是否带 `Authorization`
2. token 是否过期
3. refresh token 是否有效
4. 后端 `middleware/1.api.ts` 是否把该接口视为公开接口
5. 中心库用户状态是否正常
6. tokenVersion 是否匹配
7. customerId 是否匹配

### 15.3 看一个接口为什么查不到数据

按顺序查：

1. 当前用户 token 里的 `customerId`
2. 当前 customer 对应的 `dbName`
3. 是否查了正确租户库
4. 用户 `parks` 是否限制了园区范围
5. 前端查询参数是否转换正确
6. 后端 Prisma `where` 是否过严
7. 是否有 `isDeleted` 软删除过滤

### 15.4 看按钮为什么不可见

按顺序查：

1. 用户角色
2. 角色权限码
3. `/auth/codes` 返回值
4. 页面按钮是否用了 `v-access`
5. 权限缓存是否未刷新
6. 是否需要 bump permission cache version

### 15.5 看移动端为什么跳到了另一个页面

查：

```text
playground/src/router/guard.ts
```

重点看：

```ts
MOBILE_ROUTE_TARGETS_BY_NAME;
MOBILE_ROUTE_TARGETS_BY_PATH;
```

## 16. 重要约定

### 16.1 命名

项目约定：

- 组件：PascalCase
- 文件：kebab-case
- 类型/interface：大写开头
- API 方法：动词开头，例如 `getTenantList`

### 16.2 技术栈

前端：

```text
Vue 3
TypeScript
Vite
Vue Router
Pinia
Ant Design Vue
Vben UI
Vxe Table
Ionic Vue
Capacitor
TanStack Vue Query
```

后端：

```text
Nitro
h3
Prisma
MariaDB/MySQL
JWT
Redis 可选
```

### 16.3 数据返回格式

成功：

```ts
{
  code: 0,
  data: ...,
  error: null,
  message: 'ok',
}
```

分页：

```ts
{
  code: 0,
  data: {
    items: [],
    total: 0,
  },
  message: 'ok',
}
```

错误：

```ts
{
  code: 401,
  data: null,
  error: '验证失败',
  message: '验证失败',
}
```

## 17. 你应该形成的源码阅读习惯

看任何功能，都按这条路径追：

```text
菜单/路由
  ↓
页面 list.vue / index.vue
  ↓
data.ts 表格列和表单 schema
  ↓
modules/form.vue 或 components
  ↓
前端 api 文件
  ↓
后端 api 文件
  ↓
utils 服务函数
  ↓
Prisma schema
  ↓
数据库表
```

不要一开始就从 `views` 目录随机点文件。这个项目业务很多，随机读会很容易迷路。

## 18. 优先掌握的 10 个文件

建议你最先熟悉这些文件：

```text
package.json
playground/package.json
playground/src/main.ts
playground/src/bootstrap.ts
playground/src/api/request.ts
playground/src/store/auth.ts
playground/src/router/access.ts
playground/src/router/guard.ts
apps/backend-mock/middleware/1.api.ts
apps/backend-mock/utils/db.ts
```

掌握这些后，你再看具体业务模块会快很多。

## 19. 一句话总结

这个项目可以理解为：

```text
Vben Admin 前端壳
  + 后端动态菜单和权限
  + Nitro 文件路由后端
  + Prisma 多租户数据库
  + 园区租赁、账单财务、人事考勤、招商雷达等业务模块
```

新人最有效的学习方式不是逐个文件硬读，而是先掌握通用链路，再用一个简单 CRUD 模块练手，最后深入账单、招商雷达、会员组织这类复杂模块。
