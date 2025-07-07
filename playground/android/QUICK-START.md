# 🚀 Android团队签名快速开始

## 📋 新团队成员快速配置指南

### 第一次设置（团队负责人）

1. **生成团队keystore**

   ```bash
   # Windows PowerShell
   .\generate-keystore.ps1

   # Linux/macOS
   ./generate-keystore.sh
   ```

2. **配置密码文件**

   ```bash
   # 编辑配置文件
   app/keystore/team-keystore.properties
   ```

3. **分发给团队**
   - 将 `team-release-key.jks` 文件安全分享
   - 将密码信息安全告知团队成员

### 团队成员配置（接收方）

1. **获取文件**

   - 从团队负责人处获取 `team-release-key.jks`
   - 将文件放到 `app/keystore/` 目录

2. **配置密码**

   ```properties
   # 编辑 app/keystore/team-keystore.properties
   storeFile=keystore/team-release-key.jks
   storePassword=实际密码
   keyAlias=team-release-key
   keyPassword=实际密码
   ```

3. **验证配置**
   ```bash
   # 打包测试
    ./gradlew assembleRelease
   ```

## 📦 常用命令

```bash
# 生成带签名的APK（推荐用于内部分发）
# 生成路径：app/build/outputs/apk/release/app-release.apk
./gradlew assembleRelease

# 生成带签名的AAB（用于Google Play商店）
# 生成路径：app/build/outputs/bundle/release/app-release.aab
./gradlew bundleRelease

# 打包Debug版本
./gradlew assembleDebug

# 清理构建
./gradlew clean

# 查看签名信息
keytool -list -v -keystore app/keystore/team-release-key.jks
```

**📱 格式选择指南：**

- **APK** → 公司内部分发、测试、直接安装
- **AAB** → Google Play商店上架

# 验证APK签名

keytool -printcert -jarfile app/build/outputs/apk/release/app-release.apk

```

## ⚠️ 重要提醒

- ✅ **DO**: 妥善保管keystore文件和密码
- ✅ **DO**: 定期备份keystore文件
- ✅ **DO**: 使用强密码
- ❌ **DON'T**: 将密码提交到Git
- ❌ **DON'T**: 在聊天工具中明文发送密码
- ❌ **DON'T**: 丢失keystore文件（无法恢复）

## 🆘 遇到问题？

1. **脚本执行失败** → 查看 [README-团队签名配置.md](./README-团队签名配置.md#故障排除)
2. **编码问题** → 使用PowerShell版本脚本
3. **Java环境** → 确保安装JDK并配置环境变量
4. **权限问题** → 检查文件权限或以管理员身份运行

## 📞 技术支持

如果遇到问题，请联系团队技术负责人或查看完整文档：

## 📚 详细文档

- [APK vs AAB 格式说明](./APK-vs-AAB-格式说明.md) - 了解格式选择
- [完整配置指南](./README-团队签名配置.md) - 详细配置步骤
- [Android 官方文档](https://developer.android.com/studio/publish/app-signing)
```
