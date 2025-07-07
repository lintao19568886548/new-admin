# Android APK vs AAB 格式说明

## 📱 格式对比

| 特性         | APK                  | AAB (Android App Bundle) |
| ------------ | -------------------- | ------------------------ |
| **用途**     | 直接安装、内部分发   | Google Play 商店上架     |
| **文件大小** | 较大（包含所有资源） | 较小（动态分发）         |
| **安装方式** | 直接安装到设备       | 通过 Google Play 下载    |
| **兼容性**   | 所有 Android 设备    | 需要 Google Play 服务    |
| **分发渠道** | 任意渠道             | 仅限 Google Play         |
| **签名要求** | 开发者签名           | Google Play 签名         |

## 🏢 企业内部分发推荐

### ✅ 推荐使用 APK 格式

**原因：**

- 无需 Google Play 商店
- 可通过内部渠道分发
- 支持离线安装
- 完全控制分发流程

**生成命令：**

```bash
# 生成带签名的 Release APK
./gradlew assembleRelease

# 生成带签名的 Debug APK
./gradlew assembleDebug
```

**Android Studio 操作：**

1. `Build` → `Generate Signed Bundle / APK`
2. 选择 `APK`
3. 选择已配置的签名文件
4. 选择 `release` 构建变体

## 🚫 避免的操作

### ❌ 不要使用未签名的 APK

```bash
# 这个命令生成的是未签名 APK，不适合分发
./gradlew assembleRelease --no-signing
```

### ❌ Android Studio 中避免的选项

- `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
  - 这个选项生成**未签名**的 APK
  - 仅适合开发测试，不适合正式分发

## 📋 内部分发最佳实践

### 1. 签名管理

- 使用团队统一的签名文件
- 妥善保管 keystore 文件和密码
- 定期备份签名文件

### 2. 版本管理

```gradle
// app/build.gradle
defaultConfig {
    versionCode 1
    versionName "1.0.1"
}
```

### 3. 分发渠道

- **内部服务器**：上传到公司内部下载页面
- **邮件分发**：直接发送 APK 文件
- **移动设备管理 (MDM)**：通过企业 MDM 系统分发
- **文件共享**：通过企业网盘等方式分享

### 4. 安装指导

```text
用户安装步骤：
1. 下载 APK 文件到设备
2. 在设备设置中启用"未知来源"应用安装
3. 点击 APK 文件进行安装
4. 按照提示完成安装
```

## 🔍 验证 APK 签名

```bash
# 查看 APK 签名信息
keytool -list -printcert -jarfile app-release.apk

# 验证签名一致性
jarsigner -verify -verbose -certs app-release.apk
```

## 📁 文件位置

生成的文件位置：

```
app/build/outputs/apk/release/app-release.apk
```

## ⚠️ 注意事项

1. **签名一致性**：确保所有版本使用相同的签名
2. **版本升级**：新版本的 versionCode 必须大于旧版本
3. **权限管理**：检查应用所需的权限设置
4. **测试验证**：在目标设备上充分测试
5. **安全考虑**：通过安全渠道分发，避免 APK 被篡改

## 🔗 相关文档

- [团队签名配置指南](./README-团队签名配置.md)
- [快速开始指南](./QUICK-START.md)
- [Android 官方文档 - APK vs AAB](https://developer.android.com/guide/app-bundle)
