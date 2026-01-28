# Repository Guidelines

## 项目结构与模块

- 根目录采用 pnpm monorepo，主要包：`playground` (前端示例/实际开发)、`apps/backend-mock` (Nitro+Prisma Mock 接口)、`internal` (共享配置如 vite-config)。
- 前端源码在 `playground/src`，相关视图位于 `playground/src/views`；API 请求在 `playground/src/api`。
- Prisma schema 位于 `apps/backend-mock/prisma/schema`，上传接口在 `apps/backend-mock/api/image/upload.post.ts`。
- 手机端由 capacitor 自动构建，位于 `playground/android`

## 构建、测试与开发命令

- 本地开发：`pnpm -F @vben/playground run dev` 或 `pnpm run dev:play`（包含代理配置）。
- 前端构建：`pnpm -F @vben/playground run build`。
- 类型检查：`pnpm tsc --noEmit --project <path>` (lsp);`pnpm -F @vben/playground run typecheck`（vue-tsc）。
- Lint：`pnpm exec eslint --no-cache <paths>`；根目录 `pnpm run lint` 会触发 vben 的 lint 脚本。
- Backend-mock 运行：`pnpm -F @vben/backend-mock run start`（含 prisma generate）。

## 代码风格与命名

- 全局使用 TypeScript + Vue 3 组合式 API，推荐 2 空格缩进。
- 格式化依赖 Prettier/ESLint，遵循仓库的 `eslint.config.mjs` 和 `@vben` 预设；提交前建议跑 lint 和 typecheck。
- 命名：组件采用 PascalCase，文件使用 kebab-case，类型接口前缀大写字母（如 `RentalTenant`），API 方法动词开头（如 `getTenantList`）。

## 测试指引

- 主要检查：`pnpm tsc --noEmit --project <paths>`;`pnpm -F @vben/playground run typecheck`，按需运行。
- 新增功能至少确保类型检查通过；若涉及表单/接口，建议补充简单的 e2e/集成用例或手动验收步骤。

## 提交与 Pull Request

- 提交信息遵循工作量化的动词短语，如 `feat: ...`、`fix: ...`、`chore: ...`。
- PR 请简述变更范围、测试情况（命令或手动步骤），如涉及 UI 变动附截图/录屏；关联 Issue 请在描述中引用。

## 配置与安全

- 环境变量：前端常用 `.env` 系列；LLM 密钥示例在 `playground/.env.llmkey` 中，`ALIYUN_BAILIAN_KEY` 需自行填充，不要提交真实密钥。
- 构建/运行需 Node >= 20、pnpm >= 9。遇到类型版本冲突（Vite/@types/node）时，优先统一依赖或在 tsconfig 中排除非目标包。\*\*\*
