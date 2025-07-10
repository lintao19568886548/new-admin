# APK 下载和更新功能

本功能实现了通过 `@capacitor/file-transfer` 下载 APK 文件并使用 FileProvider 安装的完整流程。

## 功能特性

- 使用 `@capacitor/file-transfer` 下载 APK 文件到应用数据目录
- 支持下载进度显示和取消下载
- 使用 FileProvider 处理 Android 7+ 的文件访问限制
- 自动调用系统安装界面

## 技术实现

### 前端部分 (Vue.js)

- **文件**: `src/views/profile/index.vue`
- **核心函数**: `handleApkDownload()`
- **功能**: 下载 APK 文件并调用原生安装方法

### Android 原生部分

#### 1. MainActivity.java

- **文件**: `android/app/src/main/java/cn/yizuw/magic/MainActivity.java`
- **功能**: 提供 JavaScript 接口，处理 FileProvider 和 APK 安装
- **核心方法**: `AndroidInterface.installApk()`

#### 2. FileProvider 配置

- **文件**: `android/app/src/main/res/xml/file_paths.xml`
- **功能**: 定义 FileProvider 可访问的路径

#### 3. AndroidManifest.xml

- **权限**: `REQUEST_INSTALL_PACKAGES` - 允许安装 APK
- **Provider**: FileProvider 配置

## 使用流程

1. 用户点击"检查更新"
2. 显示更新模态框
3. 用户确认更新后开始下载 APK
4. 显示下载进度
5. 下载完成后自动调用安装
6. 系统弹出安装确认界面

## 关键代码说明

### 文件下载 API 使用

```javascript
// 添加进度监听器
const progressListener = await FileTransfer.addListener('progress', (progress: ProgressStatus) => {
  if (progress.lengthComputable && progress.contentLength > 0) {
    const percent = Math.round((progress.bytes / progress.contentLength) * 100);
    downloadProgress.value = percent;
  }
});

// 下载文件
const downloadResult = await FileTransfer.downloadFile({
  path: fullPath,
  progress: true,
  url: downloadUrl,
});
```

### 前端调用原生方法

```javascript
if (Capacitor.isNativePlatform() && (window as any).AndroidInterface) {
  (window as any).AndroidInterface.installApk(uri, fileName);
}
```

### Android FileProvider 处理

```java
// Android 7.0 及以上使用 FileProvider
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
    apkUri = FileProvider.getUriForFile(
        MainActivity.this,
        getPackageName() + ".fileprovider",
        apkFile
    );
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
} else {
    apkUri = Uri.fromFile(apkFile);
}
```

## 注意事项

1. **权限要求**: 需要 `REQUEST_INSTALL_PACKAGES` 权限
2. **Android 版本**: 自动处理 Android 7+ 的 FileProvider 要求
3. **文件路径**: APK 文件存储在应用数据目录
4. **安全性**: 使用 FileProvider 确保文件访问安全
5. **类型安全**: 导入 `ProgressStatus` 类型确保 TypeScript 类型检查
6. **资源管理**: 下载完成后自动移除进度监听器，避免内存泄漏

## 测试建议

1. 在不同 Android 版本上测试（特别是 Android 7 前后）
2. 测试下载取消功能
3. 测试网络异常情况
4. 验证安装权限申请流程
