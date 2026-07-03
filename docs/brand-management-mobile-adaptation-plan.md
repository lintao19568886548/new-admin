# 品牌管理移动端适配开发方案

## 1. 背景

当前智能抄表菜单下的“电表抄表数据 / 水表抄表数据”已经具备移动端页面，并且手机端会自动跳转到移动端抄表数据页。

但以下页面仍然是 PC 表格页面：

1. 智能抄表 - 电表品牌管理
2. 智能抄表 - 水表品牌管理
3. 门禁管理 - 门禁品牌管理

这些页面在手机端会出现横向表格、筛选区拥挤、操作按钮不易点击等问题，不能算真正完成移动端适配。

## 2. 目标

1. 手机端打开品牌管理菜单时，自动进入移动端卡片列表页。
2. PC 端继续保留现有 VxeGrid 表格页面，不影响原后台操作习惯。
3. 移动端复用现有接口、表单、字段配置和业务逻辑，避免重复维护。
4. 手机端支持搜索、重置、分页、新增、编辑、删除等完整管理能力。
5. 页面适配弱网和低性能手机，避免一次性加载大量数据。

## 3. 非目标

1. 不改后端数据结构。
2. 不重写品牌新增/编辑表单。
3. 不改变 PC 端品牌管理页面样式和交互。
4. 不把 PC 表格强行压缩成移动端表格。
5. 不做 Android 原生构建。

## 4. 复用策略

本次适配遵循“复用业务逻辑，不复用 PC 表格”的原则。

### 4.1 继续复用的内容

1. 接口：
   - `getMeterBrandList`
   - `deleteMeterBrand`
   - `getAccessBrandList`
   - `deleteAccessBrand`
2. 新增/编辑表单：
   - `playground/src/views/smart-meter/brand/modules/form.vue`
   - `playground/src/views/access/brand/modules/form.vue`
3. 筛选和状态配置：
   - `BRAND_ENABLED_OPTIONS`
   - `BRAND_DEFAULT_OPTIONS`
   - `ACCESS_BRAND_ENABLED_OPTIONS`
   - `ACCESS_BRAND_DEFAULT_OPTIONS`
4. 现有后端分页能力：
   - `currentPage`
   - `pageSize`
   - `total`
   - `items`

### 4.2 不复用的内容

1. 不复用 PC 端 `VxeGrid` 表格作为手机端主体。
2. 不复用 PC 端 toolbar 布局。
3. 不复用 PC 端表格列宽、固定列、横向滚动。

原因：PC 表格在手机上操作成本高，尤其是品牌名称、接口地址、操作按钮同时存在时，很容易出现横向滚动和误触。

## 5. 页面设计

### 5.1 移动端列表结构

移动端使用卡片列表展示，每条品牌记录包含：

1. 品牌名称
2. 品牌编码
3. 协议类型
4. 接口地址
5. 启用状态标签
6. 当前选用/备选标签
7. 更新时间
8. 编辑按钮
9. 删除按钮

### 5.2 搜索区

顶部搜索区采用移动端纵向表单，包含：

1. 品牌名称
2. 品牌编码
3. 协议类型
4. 启用状态
5. 选用状态

搜索区下方提供：

1. 搜索
2. 重置

### 5.3 新增入口

新增按钮使用右下角悬浮圆形按钮，避免占用列表空间。

### 5.4 分页

移动端保留分页，默认每页 10 条，避免一次性渲染大量卡片导致低端手机卡顿。

## 6. 文件改动计划

### 6.1 新增共享移动端品牌列表组件

新增：

```text
playground/src/components/MobileBrandList.vue
```

职责：

1. 统一移动端品牌卡片布局。
2. 统一搜索、重置、分页。
3. 统一新增、编辑、删除操作。
4. 通过 props 注入列表接口、删除接口、表单组件、主键字段和默认表单数据。

这样智能抄表品牌和门禁品牌可以复用同一个移动端壳组件。

### 6.2 新增智能抄表品牌移动端页面

新增：

```text
playground/src/views/smart-meter/brand/mobile.vue
```

职责：

1. 接收 `meterType` 参数。
2. 电表品牌传 `meterType = electric`。
3. 水表品牌传 `meterType = water`。
4. 复用 `MobileBrandList.vue`。
5. 复用智能抄表品牌表单。

### 6.3 新增门禁品牌移动端页面

新增：

```text
playground/src/views/access/brand/mobile-list.vue
```

职责：

1. 复用 `MobileBrandList.vue`。
2. 复用门禁品牌表单。
3. 注入门禁品牌列表和删除接口。

### 6.4 路由新增

修改：

```text
playground/src/router/routes/modules/smart-meter.ts
playground/src/router/routes/modules/access.ts
```

新增移动端隐藏路由：

```text
/smart-meter/electric-brand/mobile
/smart-meter/water-brand/mobile
/access/brand/mobile
```

这些路由设置 `hideMenu: true`，不在菜单里重复展示。

### 6.5 手机端自动跳转

修改：

```text
playground/src/router/guard.ts
```

新增映射：

```text
ElectricMeterBrand -> /smart-meter/electric-brand/mobile
WaterMeterBrand -> /smart-meter/water-brand/mobile
AccessBrand -> /access/brand/mobile
```

同时补充 path 映射：

```text
/smart-meter/electric-brand
/smart-meter/water-brand
/access/brand
```

## 7. 交互规则

1. 手机宽度小于 768px 时，进入移动端品牌页。
2. 当前路径已经包含 `/mobile` 时，不重复跳转。
3. PC 端访问原路径时，不跳移动端。
4. 新增时传入默认值：
   - `enabled: true`
   - `isDefault: false`
   - 智能抄表品牌额外传 `meterType`
5. 编辑时合并当前记录和默认值，保证智能抄表品牌表单拿到 `meterType`。
6. 删除成功后刷新当前页列表。
7. 搜索和重置都回到第一页。

## 8. 验收标准

### 8.1 PC 端

1. `/smart-meter/electric-brand` 仍显示原 PC 表格。
2. `/smart-meter/water-brand` 仍显示原 PC 表格。
3. `/access/brand` 仍显示原 PC 表格。
4. 新增、编辑、删除能力不受影响。

### 8.2 移动端

1. 手机打开电表品牌管理，自动进入电表品牌移动端卡片页。
2. 手机打开水表品牌管理，自动进入水表品牌移动端卡片页。
3. 手机打开门禁品牌管理，自动进入门禁品牌移动端卡片页。
4. 卡片内容不横向溢出。
5. 搜索、重置、分页可用。
6. 新增、编辑打开现有表单弹窗。
7. 删除成功后列表刷新。

### 8.3 工程验证

需要执行：

```bash
pnpm exec eslint --no-cache playground/src/components/MobileBrandList.vue playground/src/views/smart-meter/brand/mobile.vue playground/src/views/access/brand/mobile-list.vue playground/src/router/routes/modules/smart-meter.ts playground/src/router/routes/modules/access.ts playground/src/router/guard.ts
pnpm -F @vben/playground typecheck
pnpm -F @vben/playground build
```

说明：不执行 Android 构建。

## 9. 上线注意事项

1. 本次是前端改动，正常只需要重新构建并发布前端。
2. 不涉及 Prisma schema 和数据库变更。
3. 不涉及后端接口发布，除非后续发现现有品牌接口返回字段缺失。
4. 发布后需要用手机浏览器或微信 WebView 验证三条菜单入口。

## 10. 结论

本次适配采用“共享移动端卡片组件 + 各业务页面注入接口和表单 + 手机端路由自动跳转”的方式。这样可以最大程度复用现有业务逻辑，同时避免把 PC 表格硬塞到手机端导致体验差。
