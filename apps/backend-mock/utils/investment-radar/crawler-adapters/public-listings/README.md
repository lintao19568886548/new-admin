# 广东房源平台适配器

本目录包含三个广东地区房源平台的爬虫适配器，用于从公开房源网站提取厂房、仓库等工业地产信息。

## 适配器列表

### 1. 99厂房网 (listing-99cfw-guangdong-adapter.ts)

**平台信息：**

- 平台名：99厂房网
- 域名：99cfw.com
- 特点：专业厂房信息平台，信息结构化程度高

**覆盖城市：**

- 东莞、深圳、广州、佛山、惠州、中山、江门、珠海

**URL格式：**

- 列表页：`https://{city}.99cfw.com/factory/`
- 详情页：`https://{city}.99cfw.com/factory/{id}.html`

**导出内容：**

```typescript
export const PLATFORM_NAME: string;
export const PLATFORM_CODE: string;
export const GUANGDONG_LIST_URLS: string[];
export function isValidDetailUrl(url: string): boolean;
export function extractListingFromHtml(
  html: string,
  sourceUrl: string,
): PublicOpportunityCrawlerInput | null;
```

---

### 2. 淘丁厂房网 (listing-toodc-guangdong-adapter.ts)

**平台信息：**

- 平台名：淘丁厂房网
- 域名：toodc.com
- 特点：工业地产垂直平台，信息较为专业

**覆盖城市：**

- 东莞、深圳、广州、佛山、惠州、中山

**URL格式：**

- 列表页：`https://{city}.toodc.com/factory/`
- 详情页：`https://{city}.toodc.com/factory/{id}.html`

**导出内容：**

```typescript
export const PLATFORM_NAME: string;
export const PLATFORM_CODE: string;
export const GUANGDONG_LIST_URLS: string[];
export function isValidDetailUrl(url: string): boolean;
export function extractListingFromHtml(
  html: string,
  sourceUrl: string,
): PublicOpportunityCrawlerInput | null;
```

---

### 3. 仓小二 (listing-cangxiaoer-guangdong-adapter.ts)

**平台信息：**

- 平台名：仓小二
- 域名：cangxiaoer.com
- 特点：专注仓储物流地产，信息针对性强

**覆盖城市：**

- 东莞、深圳、广州、佛山、惠州、中山

**URL格式：**

- 列表页：`https://{city}.cangxiaoer.com/`
- 详情页：多种格式支持
  - `https://{city}.cangxiaoer.com/warehouse/{id}`
  - `https://{city}.cangxiaoer.com/factory/{id}`
  - `https://www.cangxiaoer.com/{city}/detail/{id}`

**导出内容：**

```typescript
export const PLATFORM_NAME: string;
export const PLATFORM_CODE: string;
export const GUANGDONG_LIST_URLS: string[];
export function isValidDetailUrl(url: string): boolean;
export function extractListingFromHtml(
  html: string,
  sourceUrl: string,
): PublicOpportunityCrawlerInput | null;
```

---

## 提取字段说明

每个适配器从HTML中提取以下字段：

| 字段              | 说明                       | 是否必需 |
| ----------------- | -------------------------- | -------- |
| title             | 房源标题                   | ✅ 是    |
| sourceSite        | 平台名称                   | ✅ 是    |
| sourceUrl         | 来源URL                    | ✅ 是    |
| opportunityType   | 机会类型（固定为SUPPLY）   | ✅ 是    |
| city              | 城市                       | ⚠️ 建议  |
| areaText          | 面积文本（如"2000㎡"）     | ⚠️ 建议  |
| priceText         | 价格文本（如"25元/㎡/月"） | ❌ 可选  |
| contactName       | 联系人姓名                 | ❌ 可选  |
| phoneNumber       | 联系电话                   | ⚠️ 建议  |
| district          | 区域/镇区                  | ❌ 可选  |
| description       | 房源描述                   | ❌ 可选  |
| publishedDateText | 发布时间原文               | ❌ 可选  |
| publishedAt       | 发布时间ISO格式            | ❌ 可选  |
| missingFields     | 缺失字段列表               | 仅失败时 |

**缺失字段处理：**

- 如果缺失字段 >= 3个，返回简化结果（仅包含title、sourceSite、sourceUrl和missingFields）
- 否则返回完整提取结果

---

## 使用示例

### 在爬虫中集成

```typescript
import {
  isValidDetailUrl,
  extractListingFromHtml,
  PLATFORM_NAME,
} from './crawler-adapters/public-listings/listing-99cfw-guangdong-adapter';

// 验证URL
if (isValidDetailUrl(url)) {
  // 获取HTML内容
  const html = await fetchHtml(url);

  // 提取房源信息
  const listing = extractListingFromHtml(html, url);

  if (listing) {
    if (listing.missingFields) {
      console.warn('部分字段提取失败:', listing.missingFields);
    }

    // 保存到数据库
    await savePublicOpportunity(listing);
  }
}
```

### 本地测试

```bash
# 运行测试脚本（不访问真实网站）
cd apps/backend-mock
npx tsx utils/investment-radar/crawler-adapters/public-listings/test-adapters.ts
```

---

## 注意事项

1. **不猜测字段**：所有提取都基于明确的正则表达式匹配，无法提取的字段返回null
2. **保留原始数据**：始终保留sourceUrl、sourceSite、publishedDateText等原始信息
3. **安全降级**：关键信息缺失时返回简化结果，不会抛出异常
4. **城市标准化**：自动将城市代码（如dg）转换为标准名称（东莞市）
5. **文本清理**：自动移除HTML标签、合并空白字符、解码HTML实体

---

## 待接入说明

⚠️ **重要**：这些适配器文件尚未接入主爬虫系统。

需要由开发者统一在 `public-crawler-adapters.ts` 中注册这些适配器，包括：

- 添加source code常量
- 注册适配器到适配器映射表
- 配置爬取策略和频率限制

请勿自行修改 `public-crawler-adapters.ts` 文件。

---

## 开发规范

- ✅ 纯函数设计，无副作用
- ✅ 不访问真实网站（测试使用模拟HTML）
- ✅ 完整的TypeScript类型定义
- ✅ 详细的中文注释
- ✅ 错误处理和降级机制
- ❌ 不修改公共配置文件
- ❌ 不包含硬编码的认证信息
