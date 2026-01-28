# Android应用启动顺序与自动更新说明

## 应用启动顺序

### 1. 原生层启动

- **AndroidManifest.xml**: 定义应用入口点和权限
- **MainActivity.java**: 应用主活动，继承自 `BridgeActivity`
  - 在 `onStart()` 方法中注册 `AndroidInterface` JavaScript 接口
  - 提供 `installApk()` 方法供 WebView 调用

### 2. WebView 层启动

- Capacitor 框架初始化
- 加载 `index.html` 文件
- 启动 Vue 应用

### 3. Vue 应用启动

- **main.ts**: 应用入口点
  - 初始化偏好设置
  - 调用 `bootstrap()` 函数

- **bootstrap.ts**: 应用初始化
  - 初始化组件适配器
  - 创建 Vue 应用实例
  - 注册各种插件和指令（路由、国际化、状态管理等）
  - 挂载应用到 DOM

### 4. 路由层启动

- **router/index.ts**: 路由配置
  - 创建路由实例
  - 配置路由守卫 `createRouterGuard`

- **router/guard.ts**: 路由守卫
  - 通用守卫：页面加载进度条
  - 权限守卫：登录状态检查、accessToken 验证、动态路由生成

### 5. 布局层启动

- **app.vue**: 根组件
  - 配置 Ant Design Vue 主题和国际化
  - 包含 `<RouterView />` 显示路由组件

- **layouts/basic.vue**: 基础布局组件
  - 处理移动端适配
  - 硬件返回按钮逻辑
  - 根据设备类型调整应用偏好设置
  - 定义用户菜单和登出功能
  - **集成自动更新检查组件**

### 6. 页面组件层

- 根据路由配置加载对应的页面组件
- 如 `views/profile/index.vue` 等具体页面

## 自动更新检查实现

### 核心架构：服务化设计

**更新服务**: `src/utils/update-service.ts`

- 统一的更新状态管理
- 可复用的更新检查逻辑
- 完整的下载安装流程
- 错误处理和通知功能

#### 主要功能

1. **checkAppUpdate()**: 检查应用更新
   - 参数控制：显示加载提示、成功提示、自动安装
   - 支持静默检查和手动检查两种模式
2. **downloadAndInstallApk()**: 下载并安装APK
3. **updateState**: 共享的更新状态（弹窗显示、下载进度等）
4. **sendDebugNotification()**: 发送调试通知

### 自动更新组件：AutoUpdateChecker

**文件位置**: `src/components/auto-update-checker.vue`

#### 功能特点

1. **智能触发**: 监听用户登录状态（accessToken存在即触发）
2. **精确时机**: 在Vue应用完全加载且用户权限验证完成后立即触发
3. **确认弹窗**: 检测到新版本后显示确认弹窗，需要用户确认后安装
4. **单次执行**: 确保每次应用启动只检查一次
5. **静默处理**: 不显示加载提示，错误静默处理
6. **早期触发**: 不需要等待权限检查完成，应用启动后即可触发
7. **完整UI**: 包含更新弹窗、进度显示、样式等完整的用户界面

#### 集成方式

在 `layouts/basic.vue` 中引入：

```vue
<template>
  <BasicLayout>
    <!-- 布局内容 -->
  </BasicLayout>
  <!-- 自动更新检查组件（包含完整更新弹窗UI） -->
  <AutoUpdateChecker />
</template>
```

#### 执行时机（非硬编码）

1. **监听条件**: 使用 `watch` 监听 `accessStore.accessToken`
2. **触发条件**: 用户已登录（有accessToken即可）
3. **延迟执行**: 使用 `nextTick` + `setTimeout(1000ms)` 确保页面完全渲染
4. **防重复**: 使用 `hasAutoChecked` 标志防止重复执行

#### 自动检查流程

1. **触发条件**: 用户已登录（有accessToken即可）
2. **检查时机**: 监听 `accessStore.accessToken` 状态变化
3. **执行逻辑**:

   ```typescript
   // 检查条件
   const canCheck = !!accessStore.accessToken;

   // 调用更新检查
   await checkAppUpdate(false, false, false); // 静默检查，显示确认弹窗
   ```

### 手动更新流程

**触发位置**: `views/profile/index.vue` 中的"检查更新"按钮

#### 代码复用

```javascript
// 手动检查更新，参数说明：
// showLoading: true - 显示加载提示
// showSuccessMessage: true - 显示成功提示
// autoInstall: false - 需要用户确认后安装
async function handleCheckUpdate() {
  await checkAppUpdate(true, true, false);
}
```

#### 用户体验流程

1. **手动触发**: 用户点击"检查更新"按钮
2. **显示加载**: 显示"正在检查更新..."加载提示
3. **版本检查**: 调用统一的更新检查服务
4. **结果处理**:
   - 有更新：通过 `AutoUpdateChecker` 组件显示更新弹窗，包含版本信息和更新说明
   - 无更新：显示"当前已是最新版本"提示
5. **用户确认**: 用户在弹窗中确认是否更新
6. **下载安装**: 调用 `downloadAndInstallApk()` 执行下载安装

### 技术架构优势

1. **服务化设计**: 将更新逻辑封装为独立服务，提高代码复用性
2. **状态共享**: 使用统一的状态管理，避免状态冲突
3. **参数化控制**: 通过参数控制不同场景下的行为（静默/手动、自动/确认）
4. **时机精确**: 基于应用状态监听，而非硬编码延迟时间
5. **错误隔离**: 分层错误处理，确保自动检查不影响应用启动
6. **代码复用**: 自动检查和手动检查共享核心逻辑，减少重复代码
7. **UI统一**: 更新弹窗统一在 `AutoUpdateChecker` 组件中管理，确保全局可用
8. **可维护性**: 模块化设计，易于维护和扩展

### 实现对比

| 特性       | 自动检查                    | 手动检查     |
| ---------- | --------------------------- | ------------ |
| 触发方式   | 应用启动后自动              | 用户点击按钮 |
| 触发条件   | 用户已登录（有accessToken） | 用户主动操作 |
| 加载提示   | 无                          | 有           |
| 成功提示   | 无                          | 有           |
| 发现更新后 | 显示确认弹窗                | 显示确认弹窗 |
| 错误处理   | 静默处理                    | 显示错误信息 |
| 用户体验   | 静默检查，需确认安装        | 完整反馈     |
