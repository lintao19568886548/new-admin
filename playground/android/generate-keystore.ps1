# Android团队统一签名生成脚本 (PowerShell版本)
# 使用方法: 在PowerShell中运行 .\generate-keystore.ps1

# 设置控制台编码为UTF-8，解决中文显示问题
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
# 设置PowerShell会话的编码
chcp 65001 | Out-Null

# 脚本配置
$KEYSTORE_PATH = "app\keystore\team-release-key.jks"
$KEY_ALIAS = "team-release-key"
$VALIDITY_DAYS = 10000

Write-Host "🔐 正在生成团队共用的Android签名文件..." -ForegroundColor Green
Write-Host ""

# 检查Java环境
try {
    $javaVersion = java -version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Java not found"
    }
    Write-Host "✅ Java环境检查通过" -ForegroundColor Green
} catch {
    Write-Host "❌ 错误: 未找到Java环境，请确保已安装JDK并配置环境变量" -ForegroundColor Red
    Write-Host "   下载地址: https://www.oracle.com/java/technologies/downloads/" -ForegroundColor Yellow
    pause
    exit 1
}

# 创建keystore目录
if (!(Test-Path "app\keystore")) {
    New-Item -ItemType Directory -Path "app\keystore" -Force | Out-Null
    Write-Host "📁 已创建keystore目录" -ForegroundColor Green
}

# 检查keystore文件是否已存在
if (Test-Path $KEYSTORE_PATH) {
    Write-Host "⚠️  警告: keystore文件已存在: $KEYSTORE_PATH" -ForegroundColor Yellow
    $overwrite = Read-Host "是否覆盖现有文件? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "操作已取消" -ForegroundColor Yellow
        pause
        exit 0
    }
}

Write-Host ""
Write-Host "📝 请按提示输入以下信息:" -ForegroundColor Cyan
Write-Host "   1. 输入keystore密码 (建议使用强密码)" -ForegroundColor White
Write-Host "   2. 再次确认keystore密码" -ForegroundColor White
Write-Host "   3. 输入key密码 (建议与keystore密码相同)" -ForegroundColor White
Write-Host "   4. 输入您的姓名和组织信息" -ForegroundColor White
Write-Host ""
Write-Host "💡 提示: 密码建议包含大小写字母、数字和特殊字符，长度至少8位" -ForegroundColor Yellow
Write-Host ""

# 生成keystore文件
try {
    # 设置Java工具选项以使用UTF-8编码
    $env:JAVA_TOOL_OPTIONS = "-Dfile.encoding=UTF-8 -Dconsole.encoding=UTF-8 -Duser.language=en -Duser.country=US"
    
    # 直接调用keytool命令，让用户可以正常交互
    & keytool -genkey -v -keystore $KEYSTORE_PATH -alias $KEY_ALIAS -keyalg RSA -keysize 2048 -validity $VALIDITY_DAYS
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "🎉 Keystore文件生成成功!" -ForegroundColor Green
        Write-Host "📁 文件位置: $KEYSTORE_PATH" -ForegroundColor White
        Write-Host "🔑 Key别名: $KEY_ALIAS" -ForegroundColor White
        Write-Host "⏰ 有效期: $VALIDITY_DAYS 天" -ForegroundColor White
        Write-Host ""
        Write-Host "⚠️  重要提醒:" -ForegroundColor Red
        Write-Host "   1. 请将生成的密码更新到 app\keystore\team-keystore.properties 文件中" -ForegroundColor White
        Write-Host "   2. 请妥善保管keystore文件和密码" -ForegroundColor White
        Write-Host "   3. 建议将keystore文件备份到安全位置" -ForegroundColor White
        Write-Host "   4. 不要将密码提交到版本控制系统" -ForegroundColor White
        Write-Host ""
        Write-Host "📋 下一步操作:" -ForegroundColor Cyan
        Write-Host "   1. 编辑 app\keystore\team-keystore.properties 文件" -ForegroundColor White
        Write-Host "   2. 将keystore文件和密码安全地分享给团队成员" -ForegroundColor White
        Write-Host "   3. 使用 ./gradlew assembleRelease 打包APK" -ForegroundColor White
    } else {
        throw "Keytool command failed"
    }
} catch {
    Write-Host ""
    Write-Host "❌ Keystore文件生成失败" -ForegroundColor Red
    Write-Host "   可能的原因:" -ForegroundColor Yellow
    Write-Host "   - Java环境配置不正确" -ForegroundColor White
    Write-Host "   - 文件权限不足" -ForegroundColor White
    Write-Host "   - 目录路径包含特殊字符" -ForegroundColor White
    Write-Host "   - keytool命令不在PATH中" -ForegroundColor White
}

Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")