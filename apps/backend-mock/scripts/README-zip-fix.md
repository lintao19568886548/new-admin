# ZIP 压缩脚本修复说明

## 问题描述

在 Windows 环境下构建项目并将生成的 `node.zip` 上传到 Linux 服务器解压时，出现以下错误：

```
error: cannot delete old node/server/node_modules/debug/node_modules/ms
       Is a directory
error: cannot delete old node/server/node_modules/jsonwebtoken/node_modules/ms
       Is a directory
error: cannot delete old node/server/node_modules/ms
       Is a directory
```

## 问题原因

1. **文件系统差异**: Windows 和 Linux 在处理文件路径、符号链接和权限方面存在差异
2. **node_modules 结构**: npm/pnpm 在不同操作系统上可能创建不同的 node_modules 结构
3. **符号链接处理**: Windows 的符号链接在 Linux 上可能无法正确处理
4. **权限问题**: 压缩包中的文件权限信息在跨平台解压时可能导致冲突

## 解决方案

修改了 `zip-nitro-output.mjs` 脚本，添加了以下过滤逻辑：

### 1. 排除 node_modules 目录

```javascript
if (entry.name.includes('node_modules')) {
  console.log(`跳过 node_modules 相关文件: ${entry.name}`);
  return false;
}
```

### 2. 排除符号链接

```javascript
if (entry.stats && entry.stats.isSymbolicLink()) {
  console.log(`跳过符号链接: ${entry.name}`);
  return false;
}
```

### 3. 排除缓存和锁文件

```javascript
const fileName = path.basename(entry.name);
if (
  fileName.startsWith('.') &&
  (fileName.includes('lock') || fileName.includes('cache'))
) {
  console.log(`跳过缓存/锁文件: ${entry.name}`);
  return false;
}
```

## 为什么可以安全排除 node_modules

1. **Nitro 构建特性**: Nitro 在构建时会将所有依赖打包到最终的输出文件中
2. **自包含输出**: `.output` 目录包含了运行所需的所有代码，不依赖外部 node_modules
3. **生产环境**: 服务器上运行的是编译后的代码，不需要开发依赖

## 验证方法

1. 运行构建命令：`pnpm run build`
2. 检查生成的 `node.zip` 文件大小（应该比之前小很多）
3. 上传到服务器并解压：`unzip -o node.zip -d node`
4. 启动服务：`cd node && node server/index.mjs`

## 注意事项

- 如果服务器上需要安装额外的依赖，请在服务器上单独运行 `npm install --production`
- 确保 `.output` 目录包含了所有必要的运行时文件
- 如果遇到模块缺失错误，检查 Nitro 配置是否正确包含了所有依赖
