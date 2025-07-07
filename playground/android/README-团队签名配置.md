# Android 团队统一签名配置指南

## 概述

为了确保团队成员打包的APK具有相同的签名，我们配置了统一的签名方案。这样可以避免不同开发者打包的APK签名不一致的问题。

## 🚀 快速开始

### 1. 生成团队共用的Keystore文件

**方法一：使用提供的脚本（推荐）**

根据你的操作系统选择合适的脚本：

```bash
# Windows PowerShell (推荐)
.\generate-keystore.ps1

# Windows 命令提示符
.\generate-keystore.bat

# Linux/macOS
chmod +x generate-keystore.sh
./generate-keystore.sh
```

**方法二：手动生成**

```bash
# 创建keystore目录
mkdir app\keystore  # Windows
mkdir -p app/keystore  # Linux/macOS

# 生成keystore文件
keytool -genkey -v -keystore app/keystore/team-release-key.jks -alias team-release-key -keyalg RSA -keysize 2048 -validity 10000
```

### 2. 配置签名属性

编辑 `app/keystore/team-keystore.properties` 文件，填入实际的密码：

```properties
# 团队共用签名配置文件
storeFile=keystore/team-release-key.jks
storePassword=你的实际keystore密码
keyAlias=team-release-key
keyPassword=你的实际key密码
```

### 3. 安全配置

**重要：** 将密码配置文件添加到 `.gitignore`：

```gitignore
# Android签名文件（包含密码，不应提交）
app/keystore/team-keystore.properties
app/keystore/*.jks
app/keystore/*.p12
```

## 📋 使用方法

### 团队成员使用步骤

1. **获取keystore文件**

   - 从团队负责人处获取 `team-release-key.jks` 文件
   - 将文件放置到 `app/keystore/` 目录下

2. **配置密码**

   - 复制 `team-keystore.properties` 文件
   - 填入正确的密码信息

3. **打包APK**

   ```bash
   # 生成带签名的APK（推荐用于内部分发）
   ./gradlew assembleRelease

   # 生成带签名的AAB（用于Google Play商店）
   ./gradlew bundleRelease
   ```

   **Android Studio中的操作：**

   - **生成APK**：`Build > Generate Signed Bundle / APK > APK`
   - **生成AAB**：`Build > Generate Signed Bundle / APK > Android App Bundle`

   **格式选择说明：**

   - **APK格式**：适合内部分发、测试、直接安装
   - **AAB格式**：主要用于Google Play商店上架

   **注意**：`Build > Build Bundle(s) / APK(s) > Build APK(s)` 生成的是**未签名**的APK，不适合正式分发。

### 验证签名一致性

使用以下命令验证APK签名：

```bash
# 查看APK签名信息
keytool -printcert -jarfile app/build/outputs/apk/release/app-release.apk

# 或者使用apksigner
apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk
```

## 🔒 安全最佳实践

### 1. 密码管理

- 使用强密码（至少8位，包含大小写字母、数字、特殊字符）
- 不要在代码仓库中提交密码
- 考虑使用密码管理工具

### 2. 环境变量方式（高级）

可以使用环境变量来管理密码，修改 `build.gradle`：

```gradle
signingConfigs {
    release {
        keyAlias System.getenv('KEY_ALIAS') ?: keystoreProperties['keyAlias']
        keyPassword System.getenv('KEY_PASSWORD') ?: keystoreProperties['keyPassword']
        storeFile file(System.getenv('STORE_FILE') ?: keystoreProperties['storeFile'])
        storePassword System.getenv('STORE_PASSWORD') ?: keystoreProperties['storePassword']
    }
}
```

### 3. 文件备份

- 定期备份keystore文件到安全位置
- 建议多人保管备份
- 记录密码信息（安全存储）

## 🛠️ 故障排除

### 脚本执行问题

1. **Windows批处理脚本编码问题**

   ```
   症状: 运行 generate-keystore.bat 时出现乱码或"不是内部或外部命令"错误
   解决方案: 使用PowerShell脚本代替
   ```

   ```powershell
   # 推荐使用PowerShell版本
   .\generate-keystore.ps1
   ```

2. **PowerShell执行策略限制**

   ```
   症状: 无法加载文件，因为在此系统上禁止运行脚本
   解决方案: 临时允许脚本执行
   ```

   ```powershell
   # 查看当前执行策略
   Get-ExecutionPolicy

   # 临时允许当前会话执行脚本
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

   # 或者直接绕过策略执行
   powershell -ExecutionPolicy Bypass -File .\generate-keystore.ps1
   ```

3. **Linux/macOS权限问题**
   ```bash
   # 给脚本添加执行权限
   chmod +x generate-keystore.sh
   ```

### 常见问题

1. **找不到keystore文件**

   - 检查文件路径是否正确
   - 确认文件是否存在于 `app/keystore/` 目录
   - 确保路径分隔符正确（Windows用`\`，Linux/macOS用`/`）

2. **密码错误**

   - 检查 `team-keystore.properties` 中的密码是否正确
   - 确认keystore密码和key密码
   - 注意密码中的特殊字符是否需要转义

3. **Java环境问题**

   - 确保已安装JDK（不仅仅是JRE）
   - 检查 `java -version` 和 `keytool -help` 命令是否可用
   - 确认JAVA_HOME环境变量设置正确

4. **权限问题**
   - 确保对keystore文件有读取权限
   - 检查目录权限设置
   - Windows用户可能需要以管理员身份运行

### 重新生成keystore

如果需要重新生成keystore文件：

```bash
# 删除旧文件
rm app/keystore/team-release-key.jks

# 重新运行生成脚本
generate-keystore.bat
```

## 📝 注意事项

1. **版本升级**：使用相同keystore签名的APK才能正常升级
2. **发布应用**：发布到应用商店的APK必须使用相同签名
3. **团队协作**：确保所有团队成员使用相同的keystore文件
4. **安全存储**：keystore文件丢失将无法更新已发布的应用

## 🔗 相关链接

- [APK vs AAB 格式说明](./APK-vs-AAB-格式说明.md) - 详细了解格式选择
- [快速开始指南](./QUICK-START.md) - 快速配置参考
- [Android官方签名文档](https://developer.android.com/studio/publish/app-signing)
- [Capacitor Android配置](https://capacitorjs.com/docs/android/configuration)
- [Gradle签名配置](https://developer.android.com/studio/build/gradle-tips#configure-signing-settings)
