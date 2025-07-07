#!/bin/bash
# Android团队统一签名生成脚本 (Shell版本)
# 使用方法: chmod +x generate-keystore.sh && ./generate-keystore.sh

# 脚本配置
KEYSTORE_PATH="app/keystore/team-release-key.jks"
KEY_ALIAS="team-release-key"
VALIDITY_DAYS=10000

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔐 正在生成团队共用的Android签名文件...${NC}"
echo ""

# 检查Java环境
if ! command -v java &> /dev/null; then
    echo -e "${RED}❌ 错误: 未找到Java环境，请确保已安装JDK并配置环境变量${NC}"
    echo -e "${YELLOW}   Ubuntu/Debian: sudo apt install openjdk-11-jdk${NC}"
    echo -e "${YELLOW}   CentOS/RHEL: sudo yum install java-11-openjdk-devel${NC}"
    echo -e "${YELLOW}   macOS: brew install openjdk@11${NC}"
    exit 1
fi

if ! command -v keytool &> /dev/null; then
    echo -e "${RED}❌ 错误: 未找到keytool命令${NC}"
    echo -e "${YELLOW}   keytool通常包含在JDK中，请检查JDK安装${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Java环境检查通过${NC}"

# 创建keystore目录
if [ ! -d "app/keystore" ]; then
    mkdir -p "app/keystore"
    echo -e "${GREEN}📁 已创建keystore目录${NC}"
fi

# 检查keystore文件是否已存在
if [ -f "$KEYSTORE_PATH" ]; then
    echo -e "${YELLOW}⚠️  警告: keystore文件已存在: $KEYSTORE_PATH${NC}"
    read -p "是否覆盖现有文件? (y/N): " overwrite
    if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}操作已取消${NC}"
        exit 0
    fi
fi

echo ""
echo -e "${CYAN}📝 请按提示输入以下信息:${NC}"
echo -e "${WHITE}   1. 输入keystore密码 (建议使用强密码)${NC}"
echo -e "${WHITE}   2. 再次确认keystore密码${NC}"
echo -e "${WHITE}   3. 输入key密码 (建议与keystore密码相同)${NC}"
echo -e "${WHITE}   4. 输入您的姓名和组织信息${NC}"
echo ""
echo -e "${YELLOW}💡 提示: 密码建议包含大小写字母、数字和特殊字符，长度至少8位${NC}"
echo ""

# 生成keystore文件
if keytool -genkey -v -keystore "$KEYSTORE_PATH" -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity $VALIDITY_DAYS; then
    echo ""
    echo -e "${GREEN}🎉 Keystore文件生成成功!${NC}"
    echo -e "${WHITE}📁 文件位置: $KEYSTORE_PATH${NC}"
    echo -e "${WHITE}🔑 Key别名: $KEY_ALIAS${NC}"
    echo -e "${WHITE}⏰ 有效期: $VALIDITY_DAYS 天${NC}"
    echo ""
    echo -e "${RED}⚠️  重要提醒:${NC}"
    echo -e "${WHITE}   1. 请将生成的密码更新到 app/keystore/team-keystore.properties 文件中${NC}"
    echo -e "${WHITE}   2. 请妥善保管keystore文件和密码${NC}"
    echo -e "${WHITE}   3. 建议将keystore文件备份到安全位置${NC}"
    echo -e "${WHITE}   4. 不要将密码提交到版本控制系统${NC}"
    echo ""
    echo -e "${CYAN}📋 下一步操作:${NC}"
    echo -e "${WHITE}   1. 编辑 app/keystore/team-keystore.properties 文件${NC}"
    echo -e "${WHITE}   2. 将keystore文件和密码安全地分享给团队成员${NC}"
    echo -e "${WHITE}   3. 使用 ./gradlew assembleRelease 打包APK${NC}"
else
    echo ""
    echo -e "${RED}❌ Keystore文件生成失败${NC}"
    echo -e "${YELLOW}   可能的原因:${NC}"
    echo -e "${WHITE}   - Java环境配置不正确${NC}"
    echo -e "${WHITE}   - 文件权限不足${NC}"
    echo -e "${WHITE}   - 目录路径包含特殊字符${NC}"
    echo -e "${WHITE}   - keytool命令不在PATH中${NC}"
    exit 1
fi

echo ""
echo -e "${WHITE}按Enter键退出...${NC}"
read