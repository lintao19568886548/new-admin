# Backend Spring Boot 重构开发文档

> 目标：在不删除现有 `apps/backend-mock` 的前提下，新建 Spring Boot 后端，保持 `/api` 协议兼容，按模块、按批次逐步替换 Nitro/Prisma 接口。每迁移 5 个接口必须完成自动化或手动验收，通过后再进入下一批。

## 1. 现状结论

这个项目虽然包名叫 `backend-mock`，但实际已经承担真实后端职责，不是简单 mock。

- 前端主应用：`playground`，Vue 3 + Vite + Capacitor，小程序/WebView/App 共用网页端能力。
- 后端现状：`apps/backend-mock`，Nitro + H3 路由 + Prisma + MariaDB/MySQL + Redis 可选。
- 请求入口：前端 `playground/src/api/request.ts` 统一创建 `requestClient`，开发环境 `VITE_GLOB_API_URL=/api`，生产环境目前指向 `https://yizuw.cn/api`。
- 本地代理：`playground/vite.config.mts` 将 `/api/*` 转发到 `http://localhost:5320/api/*`；Nitro 由 `internal/vite-config/src/plugins/nitro-mock.ts` 在 5320 端口启动。
- 数据库：后端存在中心库和租户库两套边界。
  - `systemDbClient` 连接中心库，处理账号、组织、会员、刷新令牌、模板同步等。
  - `prismaClient` 通过 `customerId/dbName` 动态选择租户库，处理园区、租赁、账单、门禁、招商等业务数据。
- 路由规模：当前仓库实测 `apps/backend-mock/api` 下约 336 个接口文件，其中 `investment` 117 个、`investment/radar` 112 个、系统 27 个、CRM 24 个、维护 20 个、HR 19 个、租赁 18 个。
- 数据模型：租户库 schema 约 77 个模型，中心库 schema 约 26 个模型，另有 notices 独立 schema。

结论：Spring Boot 重构不能按“删 mock、重写后端”的方式做，必须按“兼容协议、双后端并行、逐接口切流、可回滚”的方式做。

## 2. 截图交接内容解读

截图里的同事交接信息可以整理为以下约束：

- “上线”一般包含网页端上线、打包 App 上线、商城上架，属于同一类发布动作。
- 小程序是壳浏览器，小程序里打开网页端，所以网页端更新通常等同于小程序内容更新。
- 小程序存在缓存，不一定实时同步，必要时只能硬等或引导刷新。
- 同事提到“服务器项目在 magic 目录”和“三个更新脚本”，但当前仓库中没有发现可直接等同服务器后端项目的 `magic` 目录；仓库内 `magic` 更多体现为 App 包名、安卓目录和数据库名线索。
- 当前仓库确实存在多个运维脚本，主要在 `apps/backend-mock/scripts`，包括备份、同步、修复、健康检查、菜单同步、租户创建等。
- 交接建议顺序是：先备份，再更新后端，本地起 dev 测试。

迁移执行时不要把截图里的“magic 目录”和“三个更新脚本”当成仓库已确认事实，必须在服务器上再次确认真实路径、脚本名和执行顺序。

## 3. 当前后端关键机制

### 3.1 通用响应协议

前端请求拦截器按下面结构判断成功：

```json
{
  "code": 0,
  "data": {},
  "error": null,
  "message": "ok"
}
```

Spring Boot 必须兼容：

- 成功：`code=0`，业务数据放 `data`。
- 未登录：HTTP 401，并保留 `errorCode`，例如 `AUTH_TOKEN_VERSION_MISMATCH`、`AUTH_REFRESH_TOKEN_INVALID`。
- 会员限制：HTTP 403，`errorCode=MEMBERSHIP_REQUIRED`，带 `redirectTo` 和 `restrictionReason`。
- 分页：多数接口返回 `{ items, total, currentPage?, pageSize? }`。

### 3.2 鉴权与会话

现有鉴权在 `apps/backend-mock/middleware/1.api.ts` 和 `utils/jwt-utils.ts`：

- Access Token：`Authorization: Bearer <token>`，默认有效期来自 `ACCESS_TOKEN_EXPIRES_IN`。
- Refresh Token：HttpOnly Cookie，名称是 `jwt`，刷新接口为 `POST /api/auth/refresh`。
- Refresh Token Rotation：刷新时签发新 refresh token，旧 token 标记 revoked/replaced。
- 账号状态、租户归属、`tokenVersion` 每次都会校验；账号变更会强制重新登录。
- 会员/试用状态在中间件层统一拦截，部分接口白名单放行。

Spring Boot 需要实现同等能力：

- `OncePerRequestFilter` 解析 JWT。
- `TenantContext` 保存 `customerId`、`dbName`、`centerUserId`、`tenantUserId`。
- `AuthService` 负责登录、短信登录、刷新、退出、密码修改。
- `RefreshToken` 表逻辑和现有中心库兼容。
- Cookie 属性兼容现有前端：`httpOnly`、`path=/`、生产 `sameSite=None; secure=true`。

### 3.3 多租户数据库

当前不是单库多租户，而是中心库 + 多租户库：

- 中心库：用户、客户、组织、会员、菜单模板同步、CRM 绑定、租户开通任务。
- 默认租户库：`DATABASE_URL`。
- 公共租户库：`PUBLIC_DATABASE_URL`。
- 其他租户库：通过 `CUSTOMER_DATABASE_URL_TEMPLATE` 或 `CUSTOMER_DB_PREFIX + customerId` 组装。
- 登录后从中心库 `customer.dbName` 决定实际租户库。

Spring Boot 推荐结构：

- `centerDataSource`：固定连接中心库。
- `tenantRoutingDataSource`：基于 `TenantContext` 动态路由租户库。
- `TenantDataSourceRegistry`：按 `customerId:dbName` 缓存 `HikariDataSource`，实现 TTL 和最大连接池数量，替代当前 Prisma 客户端池。
- MyBatis-Plus 优先于 JPA：当前 Prisma 查询很多是动态 where、事务、原生 SQL、软删除和复杂批处理，MyBatis-Plus 更贴近现有写法，也能减少普通 CRUD 的 SQL 编写量。

### 3.4 权限、组织、会员

现有请求中间件做了很多业务级准入：

- 未登录接口白名单。
- 会员过期/试用到期拦截。
- 专属空间开通中禁止写租户业务数据。
- 请求结束后记录 API 操作日志到中心库。
- 用户园区范围、角色菜单、父角色菜单权限分散在 `utils/*scope*`、`role-scope.ts`、`profile-route-menus.ts` 等工具里。

Spring Boot 迁移时要先做统一横切层：

- `AuthFilter`：登录态校验。
- `MembershipAccessInterceptor`：会员/试用访问拦截。
- `TenantWriteGuardInterceptor`：租户开通中禁止写。
- `ApiLogAspect`：记录 POST/PUT/DELETE 成功请求日志。
- `DataScopeService`：园区、角色、组织范围计算。

### 3.5 外部服务

需要迁移的第三方能力：

- 微信支付：预支付、查单、支付回调、退款、退款回调，当前在 `utils/wechat-pay.ts`。
- 微信/小程序：JS SDK 配置、小程序 session、手机号、小程序码、URL Link。
- 企业微信：回调验签、客户联系、渠道活码。
- 短信：登录验证码、催缴短信、模板短信。
- LLM：账单分析、租户图片识别，依赖环境密钥。
- 第三方表计接口：`hezhong` 相关。
- Redis：权限缓存、验证码缓存可选。

这些模块迁移时必须先迁移配置和签名/验签测试，不能只迁移 Controller。

### 3.6 数据加载性能治理：Redis、Kafka、RabbitMQ 与 XXL-Job

当前系统“加载数据难/慢”的主要原因不是单一技术问题，而是多因素叠加：

- 接口数量多，列表页、看板、菜单、权限、园区范围、会员状态都会在页面初始化时频繁请求。
- 多租户数据库动态切换会增加连接池、上下文和查询成本。
- 部分接口存在复杂聚合，例如账单汇总、财务同步、招商雷达线索/爬虫统计、看板统计。
- 前端部分页面会并发加载多个接口，如果每个接口都实时查库，会放大数据库压力。
- 当前已有 Redis 可选能力，但还没有形成统一缓存策略。

建议分四条线处理：

1. **Redis：第一阶段就应该纳入 Spring Boot 重构计划。**
2. **Kafka：作为 Spring Boot 重构的必选基础设施纳入规划，但必须先完成 outbox、幂等、死信和监控，再逐业务接入。**
3. **RabbitMQ：适当引入，定位为轻量队列、通知队列、延迟重试和削峰补偿，不替代 Kafka 主事件流。**
4. **XXL-Job：用于统一调度现有 Nitro worker、补偿任务、巡检任务和运维脚本，避免任务散落在应用启动插件和手工脚本里。**

Redis 适合先解决这些问题：

- 登录用户信息缓存：`/api/user/info`。
- 权限码、菜单树、角色菜单范围缓存：`/api/auth/codes`、`/api/menu/all`、`/api/system/menu/list`。
- 园区、部门、员工下拉、租户下拉等低频变化数据。
- 看板统计短 TTL 缓存，例如 30 秒到 5 分钟。
- 短信验证码、页面访问验证码、登录防刷、接口限流。
- 支付/回调幂等锁、重复提交锁。
- 招商雷达爬虫调度锁、任务抢占锁。

Redis 使用边界：

- Key 必须带租户维度：`tenant:{customerId}:...`，中心库数据用 `center:...`。
- 写接口必须明确清理或更新相关缓存。
- 缓存只做加速，不作为唯一事实来源。
- 会员状态、支付状态、组织开通状态可以短缓存，但最终以中心库为准。
- 不要把 Redis 当长期任务库；重要任务仍要落 MariaDB/MySQL。

Kafka 必须纳入目标架构，重点解决这些问题：

- 支付成功后异步触发会员权益、组织开通、通知。
- 账单收款后异步同步财务、生成通知、发送催缴状态变更事件。
- 招商雷达爬虫任务拆分、采集结果入库、质量评估、线索重建。
- 短信/企微/通知发送从主请求链路解耦。
- 操作审计、API 日志、行为日志异步入库。

RabbitMQ 适合解决这些问题：

- 短信、企微、站内通知等低延迟发送任务。
- 账单催缴短信的发送队列、失败重试、人工补发。
- 文件、图片、LLM 识别等轻量异步任务。
- 延迟重试：例如 1 分钟、5 分钟、30 分钟后重新检查支付/退款/开通状态。
- 削峰：前端批量操作后，把非核心副作用放入队列。

RabbitMQ 使用边界：

- 不承载长期事实事件流，核心业务事实仍进入 Kafka。
- 不直接在主事务里裸发消息，重要消息仍建议走 outbox 或业务状态表。
- 延迟队列优先使用 TTL + DLX，若生产环境确认有 `rabbitmq_delayed_message_exchange` 插件，再使用 x-delayed-message。
- 每类消息必须有 retry queue 和 dead-letter queue。
- 消费者必须幂等，按 `messageId`、`billId`、`smsLogId`、`outTradeNo` 去重。

XXL-Job 适合解决这些问题：

- 组织/专属空间开通 worker。
- 会员退款对账、支付查单补偿。
- 应收账单与财务同步补偿。
- 催缴短信定时扫描和重发。
- 招商雷达公开机会爬虫、任务回收、健康检查。
- 菜单模板同步、数据修复、历史数据回填。
- Redis/Kafka/RabbitMQ 积压巡检、数据库慢任务巡检。

XXL-Job 使用边界：

- 只调度任务，不直接替代业务 API。
- 每个任务必须支持幂等和断点续跑。
- 高风险修复任务默认 dry-run，必须显式 execute。
- 长任务拆分为任务项，执行状态落库。
- 任务执行日志要能关联 `jobId`、`triggerTime`、`customerId`、`taskId`。

Kafka 落地前置条件：

- 先有稳定的事件表或 outbox 表，避免“数据库写成功但消息丢失”。
- 每个事件必须定义幂等键，例如 `outTradeNo`、`billId:eventType`、`crawlerTaskItemId`。
- 消费者必须支持重复消费。
- 先把现有 worker 梳理出事件边界，再决定哪些由 Spring Boot `@Scheduled` 保留，哪些改为 Kafka 消费。
- 运维侧能监控 topic 积压、消费失败、重试和死信。

结论：**Spring Boot 4.1.0、Redis、Kafka、RabbitMQ、XXL-Job 都纳入目标架构。Redis 优先解决高频读取和短期状态；Kafka 承接核心业务事件流；RabbitMQ 承接通知、轻量任务和延迟重试；XXL-Job 统一调度后台 worker 和补偿任务。基础设施要早期准备好，但业务接入必须分批做，不阻塞第一批接口迁移。**

## 4. Spring Boot 目标工程建议

推荐新增工程，不改名、不删除旧后端：

```text
apps/
  backend-mock/          # 保留旧 Nitro 后端
  backend-springboot/    # 新 Spring Boot 后端
```

推荐技术栈：

- Java 21 或 Java 17。
- Spring Boot 4.1.0。
- Gradle Kotlin DSL 或 Maven，团队熟悉哪个用哪个。
- MyBatis-Plus Boot 4 starter。
- HikariCP。
- Spring Security 只做基础过滤链，业务鉴权保持自定义，避免一开始引入过重权限模型。
- Redis：缓存、验证码、短期锁、接口限流。
- Kafka：核心业务事件流、outbox、审计、爬虫事件。
- RabbitMQ：通知、轻量异步任务、延迟重试和失败队列。
- XXL-Job：分布式任务调度、补偿任务、worker 迁移。
- Flyway/Liquibase 暂不接管生产 schema。当前项目明确“不走 migrate，而是 db push，用户手动管理”，迁移期只读现有表结构，DDL 由用户确认后执行。
- Springdoc OpenAPI 用于生成接口文档和对照测试。
- JUnit 5 + Testcontainers 或独立测试库做集成测试。

MyBatis-Plus 使用边界：

- 简单 CRUD、单表分页、按 id 查询、普通条件筛选优先用 `BaseMapper`、`IService`、`LambdaQueryWrapper`。
- 列表接口优先用 MyBatis-Plus `Page`，再转换为现有前端的 `{ items, total, currentPage, pageSize }`。
- 表名、驼峰/下划线、非标准字段必须显式写 `@TableName`、`@TableField`，例如旧表里的 `createdAt`、`updatedAt`。
- 复杂聚合、跨库/跨租户统计、报表 SQL、性能敏感 SQL 可以用 XML mapper 或少量 `JdbcTemplate`。
- 写接口必须保留事务边界，涉及 Kafka 事件时业务写入和 outbox 写入必须同事务完成。
- 不使用 MyBatis-Plus 自动 DDL，不接管生产 schema；数据库变更仍由用户手动确认和执行。

建议包结构：

```text
com.yizuw.magic
  common          # ApiResponse、异常、分页、工具
  config          # Web、CORS、Jackson、数据源、Redis、OpenAPI
  security        # JWT、RefreshToken、Cookie、AuthFilter
  tenant          # TenantContext、RoutingDataSource、租户库注册
  center          # 中心库实体/Mapper/Service
  system          # 菜单、角色、用户、园区、部门
  rental          # 租户、薪资、租赁管理
  bill            # 应收账单、催缴短信、导出
  finance         # 财务记录
  access          # 访客、车辆、门禁
  hrm             # 员工、考勤、请假、轨迹
  crm             # SCRM、企微、小程序邀请
  investment      # 招商、招商雷达、爬虫任务
  integration     # 微信支付、短信、企微、LLM、第三方表计
  job             # 定时任务和后台 worker
  messaging       # Kafka/RabbitMQ/outbox/消费者幂等
```

## 5. 迁移边界和强制规则

1. 不删除 `apps/backend-mock`。
2. 不改前端 API 返回结构，除非同一批次同时改前端并完成验收。
3. 新后端统一暴露 `/api` 前缀，路径、方法、字段名先保持兼容。
4. 每批最多迁移 5 个接口。
5. 每批 5 个接口完成后必须停下来测试，通过后才能迁移下一批。
6. 旧 Nitro 后端在至少 2 个完整发布周期稳定后，再评估删除。
7. 所有写接口迁移前必须确认回滚方案：切回旧后端、数据库备份、幂等处理。
8. 支付、短信、组织开通、批量修复脚本、爬虫任务这类高风险模块，必须最后迁移或单独开专项。
9. 不执行安卓构建；App 打包由用户执行。
10. Prisma schema 不自动转生产迁移，表结构变更由用户手动管理。

## 6. 分阶段迁移计划

### 阶段 0：准备与冻结基线

目标：让新旧后端可以并行运行。

- 在 `apps/backend-springboot` 新建 Spring Boot 工程。
- 新后端监听独立端口，例如 8080。
- 保持前端开发代理仍默认指向 Nitro 5320。
- 新增网关或 Nginx 路由能力，支持按路径切到 Spring Boot。
- 整理环境变量，不提交真实密钥。
- 导出接口清单和当前响应样例。
- 备份中心库、默认租户库、public 租户库、上传文件目录。
- 接入 Redis 基础配置，但先不开复杂业务缓存。
- 接入 Kafka 基础配置和 outbox 表。
- 接入 RabbitMQ 基础配置和通知队列拓扑。
- 接入 XXL-Job 执行器配置，但先只注册空任务/巡检任务。

验收：

- `GET /api/status` 或 `/actuator/health` 可访问。
- CORS、Cookie、Authorization 头在本地可用。
- 新后端不影响旧后端启动。
- Redis 连接失败时本地开发可降级启动；生产环境按配置决定是否强依赖。
- Kafka、RabbitMQ、XXL-Job 在 local profile 可关闭强依赖，prod profile 必须开启健康检查和告警。

### 阶段 0.5：Redis 缓存治理

目标：先解决页面初始化和高频读取压力。

优先缓存：

1. 当前用户信息：`GET /api/user/info`
2. 权限码：`GET /api/auth/codes`
3. 菜单树：`GET /api/menu/all`
4. 园区列表：`GET /api/park/list`、`GET /api/system/park/list`
5. 看板统计：`/api/dashboard/*`

缓存策略：

- 用户信息、权限码、菜单树：TTL 5-30 分钟，用户/角色/菜单写接口后主动清理。
- 园区/部门/下拉：TTL 5-30 分钟，新增/编辑/删除后清理。
- 看板统计：TTL 30 秒到 5 分钟，按业务实时性设置。
- 短信验证码：TTL 按验证码有效期，记录验证失败次数。
- 幂等锁：TTL 必须短，且释放失败时能自动过期。

验收重点：

- Redis 开启前后接口返回完全一致。
- 写接口后缓存不会读到旧数据。
- Redis 不可用时，非强依赖读取接口可以回退查库。
- 缓存 key 有租户隔离，不串租户。

### 阶段 1：基础横切能力

优先迁移 5 个低风险接口：

1. `GET /api/status`
2. `GET /api/system/version`
3. `POST /api/auth/login`
4. `POST /api/auth/refresh`
5. `POST /api/auth/logout`

验收重点：

- 登录返回 `accessToken`。
- refresh cookie 名称仍为 `jwt`。
- token 过期后前端能自动 refresh。
- 旧账号、租户归属、`tokenVersion` 校验一致。
- 切回 Nitro 后旧 token 策略不冲突。

### 阶段 2：当前用户和菜单

第二批建议：

1. `GET /api/user/info`
2. `GET /api/auth/codes`
3. `GET /api/menu/all`
4. `GET /api/system/menu/list`
5. `GET /api/menu/by-parent-role`

验收重点：

- 登录后页面能正常进入。
- 菜单树结构、`meta` 字段、权限码不变。
- 不同角色看到的菜单一致。
- 园区/会员信息仍能显示。

### 阶段 3：低风险 CRUD 模块

建议每批 5 个接口，按模块做：

- 园区只读/基础 CRUD：`/api/park/*`、`/api/system/park/*`。
- 宿舍 CRUD：`/api/dormitory/*`。
- 厂房 CRUD：`/api/factory/*`，注意 `/factory/own`、`/factory/settled` 当前由中间件转成 `/factory` 并补 `isOwn`。
- 维修模块：消防、变压器、卫生、电梯、厂房维护。

验收重点：

- 分页字段。
- 软删除字段。
- 图片关联。
- 园区数据权限。
- 新增/编辑/删除后列表刷新。

### 阶段 4：租赁、账单、财务

这些模块业务耦合较强，迁移前先补测试。

建议顺序：

- `/api/rental/tenant/*`
- `/api/rental/salary/*`
- `/api/bill/amount/*`
- `/api/finance/*`
- `/api/reimbursement/*`

验收重点：

- 合同状态、到期筛选、园区范围。
- 账单项目月份排序、收款状态汇总。
- 账单与财务同步副作用。
- 导出格式。
- 催缴短信预览和发送记录。

### 阶段 5：HR、门禁、CRM

建议顺序：

- 员工、考勤、请假、轨迹。
- 访客、车辆、门禁。
- CRM 小程序邀请、企微绑定、渠道活码。

验收重点：

- 手机端页面。
- 考勤设备绑定和异常记录。
- 公开访客登记接口不强制登录。
- 小程序 WebView 分享、扫码、手机号授权。

### 阶段 6：支付、会员、组织开通

这是高风险阶段，单独迁移。

- 微信 App 预支付。
- 支付回调验签和解密。
- 查单和退款。
- 会员权益生效。
- public 空间到专属租户空间开通任务。
- 组织、邀请、成员关系。

验收重点：

- 沙箱或小额真实支付闭环。
- 回调幂等。
- 退款幂等。
- 专属空间开通任务失败可重试。
- 支付后会员状态和租户库创建一致。

### 阶段 7：招商雷达和爬虫任务

招商雷达接口最多、后台任务最多，建议最后迁移。

- 线索、企业档案、信号、评分规则。
- 外部联系限制。
- 公开机会采集、批量导入、修复。
- 爬虫任务、任务项、日志、健康检查、调度器。
- 外呼模板和任务。

验收重点：

- 爬虫任务并发控制。
- 任务项重试和超时回收。
- 日志和审计。
- 数据质量规则。
- 长任务不能阻塞普通接口。

### 阶段 8：Kafka/事件总线落地

Kafka 是本次 Spring Boot 重构的必选基础设施，但不能一开始就把所有业务改成消息驱动。正确顺序是先建事件底座，再按业务批次接入。

第一步先完成基础设施：

- 搭建 Kafka 集群或托管 Kafka。
- 建立统一 `event_outbox` 表。
- 建立生产者封装：业务事务内只写 outbox，不直接裸发消息。
- 建立 outbox dispatcher：扫描待发送事件，投递 Kafka，成功后标记 sent。
- 建立消费者基类：统一幂等、重试、死信、日志、告警。
- 建立 DLQ：每个核心 topic 至少有对应死信 topic。
- 建立监控：topic 积压、消费失败率、重试次数、死信数量。

建议事件主题：

- `payment.events`：支付成功、退款成功、支付异常。
- `bill.events`：账单创建、收款、作废、催缴发送。
- `notification.events`：短信、企微、站内通知。
- `investment.crawler.events`：爬虫任务拆分、任务项完成、质量评估、线索重建。
- `audit.events`：API 操作日志、关键业务审计。

outbox 要求：

- 业务事务内写业务表和 `event_outbox`。
- 后台任务扫描 outbox 并投递 Kafka。
- 投递成功后标记 sent。
- 消费端按幂等键去重。
- 事件 payload 必须带 `eventId`、`eventType`、`tenantId/customerId`、`occurredAt`、`idempotencyKey`。

接入顺序：

1. 审计日志和 API 操作日志。
2. 通知类事件：短信、企微、站内通知。
3. 账单类事件：账单创建、收款、作废、催缴。
4. 支付类事件：支付成功、退款成功、会员权益变更。
5. 招商雷达和爬虫任务。

Kafka 不应该用来掩盖慢 SQL 或错误分页。列表查询、看板查询仍然要先做索引、分页和 Redis 缓存治理。

### 阶段 9：RabbitMQ 通知与延迟重试

RabbitMQ 是目标架构的一部分，但定位要轻，不和 Kafka 抢主事件流。

第一批 RabbitMQ 接入对象：

1. 催缴短信发送队列。
2. 登录/页面验证码发送队列。
3. 企微/站内通知队列。
4. 支付查单延迟重试队列。
5. LLM 图片/账单分析轻量任务队列。

建议队列：

- `magic.notification.queue`
- `magic.notification.retry.queue`
- `magic.notification.dlq`
- `magic.delay.retry.queue`
- `magic.light-task.queue`
- `magic.light-task.dlq`

验收重点：

- 生产者发送失败可重试或落 outbox。
- 消费者失败进入 retry queue，超过次数进入 DLQ。
- 消费幂等，不重复发短信、不重复通知、不重复变更状态。
- 积压和死信数量可监控。

### 阶段 10：XXL-Job 调度治理

XXL-Job 用来替代当前 Nitro plugins 和部分 `apps/backend-mock/scripts` 人工触发脚本。

优先接入任务：

1. `organizationProvisioningJob`：专属空间开通。
2. `vipMembershipRefundReconcileJob`：会员退款对账。
3. `rentalExpenseFinanceSyncJob`：租赁/账单财务补偿同步。
4. `amountBillCollectionSmsScanJob`：催缴短信扫描。
5. `investmentRadarCrawlerJob`：招商雷达爬虫调度。
6. `menuTemplateSyncJob`：菜单模板同步。
7. `publicCrawlerHealthCheckJob`：公开机会爬虫健康检查。

任务规则：

- 默认 dry-run，危险任务必须显式传 `execute=true`。
- 每个任务必须落库记录任务开始、结束、成功、失败、处理数量。
- 大任务拆分成 item，支持失败 item 单独重试。
- 任务参数必须包含 `customerId` 或明确声明全局任务。
- XXL-Job 只负责触发，业务幂等仍由 Service 层保证。

## 7. 每 5 个接口的验收模板

每批迁移必须填写：

```text
批次编号：
接口列表：
涉及表：
是否写接口：
是否影响支付/短信/外部回调：
是否需要备份：
旧后端路径：
新后端 Controller：
测试账号：
测试租户：
回滚方式：
```

每批必须完成：

- 单元测试：Service 核心分支。
- 集成测试：Controller 返回结构、HTTP 状态码、鉴权。
- 前端冒烟：真实页面点一遍。
- 数据库核对：写接口检查新增/更新/软删除数据。
- 回归对比：同一请求分别打旧后端和新后端，比对关键字段。

通过标准：

- 5 个接口全部通过再继续下一批。
- 任意一个接口失败，整批不切生产。
- 写接口失败必须先回滚到旧后端，再修复。

## 8. 灰度切流方案

推荐用 Nginx 或网关按路径切流：

```nginx
location /api/auth/login {
  proxy_pass http://springboot_backend;
}

location /api/system/version {
  proxy_pass http://springboot_backend;
}

location /api/ {
  proxy_pass http://nitro_backend;
}
```

本地开发也可以改 Vite proxy：

```ts
server: {
  proxy: {
    '/api/auth/login': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
    '/api': {
      target: 'http://localhost:5320/api',
      rewrite: (path) => path.replace(/^\/api/, ''),
      changeOrigin: true,
    },
  },
}
```

生产切流优先在网关层做，不建议每批都改前端代码。

## 9. 配置迁移清单

必须迁移但不能提交真实值：

- 数据库：`CENTER_DATABASE_URL`、`DATABASE_URL`、`PUBLIC_DATABASE_URL`、`CUSTOMER_DATABASE_URL_TEMPLATE`、`CUSTOMER_DB_PREFIX`、`DATABASE_CACHING_RSA_PUBLIC_KEY_BASE64`。
- JWT/Cookie：`ACCESS_TOKEN_SECRET`、`REFRESH_TOKEN_SECRET`、`ACCESS_TOKEN_EXPIRES_IN`、`REFRESH_TOKEN_EXPIRES_IN`、`REFRESH_TOKEN_COOKIE_SECURE`、`REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS`。
- Redis：`REDIS_URL`。
- Kafka：`KAFKA_BOOTSTRAP_SERVERS`、`KAFKA_SECURITY_PROTOCOL`、`KAFKA_USERNAME`、`KAFKA_PASSWORD`、`KAFKA_CONSUMER_GROUP`、`KAFKA_CONSUMER_ENABLED`。
- RabbitMQ：`RABBITMQ_HOST`、`RABBITMQ_PORT`、`RABBITMQ_USERNAME`、`RABBITMQ_PASSWORD`、`RABBITMQ_VIRTUAL_HOST`、`RABBITMQ_CONSUMER_ENABLED`。
- XXL-Job：`XXL_JOB_ENABLED`、`XXL_JOB_ADMIN_ADDRESSES`、`XXL_JOB_ACCESS_TOKEN`、`XXL_JOB_EXECUTOR_APPNAME`、`XXL_JOB_EXECUTOR_ADDRESS`、`XXL_JOB_EXECUTOR_IP`、`XXL_JOB_EXECUTOR_PORT`、`XXL_JOB_LOG_PATH`、`XXL_JOB_LOG_RETENTION_DAYS`。
- 微信支付：`WECHAT_PAY_*`、`WECHAT_OPEN_APP_ID`、`WECHAT_PAY_MERCHANT_ID`。
- 微信/小程序：`WECHAT_APP_ID`、`WECHAT_APP_SECRET`、`WECHAT_MINIPROGRAM_APP_ID`、`WECHAT_MINIPROGRAM_APP_SECRET`。
- 企业微信：`WEWORK_*`、`WECOM_*`。
- 短信：`SMS_*`。
- LLM/百炼：相关 API Key。
- 招商雷达任务：`INVESTMENT_RADAR_*`。
- 会员/组织开通任务：`VIP_*`、`ORGANIZATION_PROVISIONING_*`。

Spring Boot 中建议用环境变量 + profile：

- `application-local.yml`
- `application-test.yml`
- `application-prod.yml`

真实密钥只放服务器环境变量或配置中心。

## 10. 旧后端保留和删除条件

旧后端至少保留到满足全部条件：

- 所有线上正在使用接口都已迁移。
- 至少 2 个完整发布周期无严重回滚。
- 支付、短信、组织开通、招商雷达任务稳定。
- 备份脚本、修复脚本、菜单同步脚本都有 Spring Boot 等价实现或明确废弃依据。
- 服务器更新脚本已经改成新后端流程，并经过演练。
- 前端、小程序、App 三端都验证通过。

在满足前，`apps/backend-mock` 只能冻结或少量修 bug，不能删除。

## 11. 建议优先落地的代码任务

1. 新建 `apps/backend-springboot`。
2. 实现 `ApiResponse`、全局异常、CORS、健康检查。
3. 接入中心库和租户库动态数据源。
4. 实现 JWT 登录/刷新/退出。
5. 实现第一批 5 个接口并完成测试。
6. 配置本地路径切流。
7. 写批次验收记录。

第一批完成后，再决定是否继续迁移菜单/用户信息。不要先动账单、支付、组织开通和招商雷达。

## 12. 当前已落地记录

截至 2026-06-27，已按“新旧后端并行、不删除旧后端”的边界创建 `apps/backend-springboot`。

已落地：

- Spring Boot 4.1.0 Maven 工程。
- 第一批 5 个接口：`GET /api/status`、`GET /api/system/version`、`POST /api/auth/login`、`POST /api/auth/refresh`、`POST /api/auth/logout`。
- 第二批 5 个接口：`GET /api/user/info`、`GET /api/auth/codes`、`GET /api/menu/all`、`GET /api/system/menu/list`、`GET /api/menu/by-parent-role`。
- 第三批 5 个只读接口：`GET /api/system/park/list`、`GET /api/system/park/{id}`、`GET /api/rental/tenant/select`、`GET /api/rental/salary/tenant-options`、`GET /api/user/list`。
- 第四批 5 个低风险只读接口：`GET /api/park/list`、`GET /api/system/menu/name-exists`、`GET /api/system/menu/path-exists`、`GET /api/system/key`、`GET /api/system/dept/list`。
- 第五批 5 个只读接口：`GET /api/system/role/list`、`GET /api/system/role/{id}`、`GET /api/system/feedback/list`、`GET /api/system/menu-template-sync/jobs`、`GET /api/system/menu-template-sync/jobs/{id}`。
- 第六批 5 个厂房/租赁园区只读接口：`GET /api/factory/list`、`GET /api/factory/available-list`、`GET /api/factory/{id}`、`GET /api/factory/list-by-park`、`GET /api/rental/park/list`。
- 第七批 5 个门禁只读接口：`GET /api/access/visitor/list`、`GET /api/access/visitor/{id}`、`GET /api/access/car/list`、`GET /api/access/car/{id}`、`GET /api/access/door/list`。
- 第八批 5 个维保只读接口：`GET /api/maintenance/elevator/list`、`GET /api/maintenance/elevator/{id}`、`GET /api/maintenance/firefighting/list`、`GET /api/maintenance/firefighting/{id}`、`GET /api/maintenance/transformer/list`。
- 第九批 5 个维保只读接口：`GET /api/maintenance/transformer/{id}`、`GET /api/maintenance/hygieneCheck/list`、`GET /api/maintenance/hygieneCheck/{id}`、`GET /api/maintenance/factoryMaint/list`、`GET /api/maintenance/factoryMaint/{id}`。
- 第十批 5 个财务/租赁管理只读接口：`GET /api/finance/list`、`GET /api/finance/{id}`、`GET /api/finance/bill-name-options`、`GET /api/rental/manage/list`、`GET /api/rental/manage/{id}`。
- 第十一批 5 个租户/工资/账单辅助只读接口：`GET /api/rental/tenant/list`、`GET /api/rental/tenant/{id}`、`GET /api/rental/salary/list`、`GET /api/rental/salary/{id}`、`GET /api/bill/amount/project-options`。
- 第十二批 5 个报销只读接口：`GET /api/reimbursement/list`、`GET /api/reimbursement/{id}`、`GET /api/reimbursement/pending-count`、`GET /api/reimbursement/summary`、`GET /api/reimbursement/analysis`。
- 第十三批 5 个低风险只读接口：`GET /api/park/visitor-list`、`GET /api/localization/list`、`GET /api/localization/{id}`、`GET /api/dashboard/workspace/list`、`GET /api/table/list`。
- 第十四批 5 个合众表计/园区统计只读接口：`GET /api/hezhong/waterinfo/data`、`GET /api/hezhong/waterinfo/tree`、`GET /api/hezhong/meterinfo/data`、`GET /api/hezhong/meterinfo/tree`、`GET /api/park/dashboard-stats`。
- 第十五批 5 个看板统计只读接口：`GET /api/dashboard/factory-rental-stats`、`GET /api/dashboard/contract-stats`、`GET /api/dashboard/customer-overview-stats`、`GET /api/dashboard/energy-electricity-consumption`、`GET /api/dashboard/energy-water-consumption`。
- 第十六批 5 个 HRM 员工/考勤配置只读接口：`GET /api/hrm/employee/list`、`GET /api/hrm/employee/{id}`、`GET /api/hrm/employee/accounts`、`GET /api/hrm/attendance/config`、`GET /api/hrm/attendance/locations`。
- 第十七批 5 个 HRM 考勤/请假只读接口：`GET /api/hrm/attendance/list`、`GET /api/hrm/attendance/today`、`GET /api/hrm/attendance/stats`、`GET /api/hrm/leaveapplication/list`、`GET /api/hrm/leaveapplication/parks`。
- 第十八批 5 个 HR 轨迹/CRM 只读接口：`GET /api/hrm/trajectory/list`、`GET /api/crm/config/status`、`GET /api/crm/overview`、`GET /api/crm/binding/list`、`GET /api/crm/external-contact/list`。
- 第十九批 5 个 CRM/组织中心库只读接口：`GET /api/crm/sales/channel/list`、`GET /api/crm/scan-log/list`、`GET /api/organization/invitation/list`、`GET /api/organization/provisioning/status`、`GET /api/organization/provisioning/failed-manual`。
- 第二十批 5 个公告/租赁/analytics 只读接口：`GET /api/notices/list`、`GET /api/rental/tenant/{id}/sms-info`、`GET /api/rental/park/{id}`、`GET /api/analytics/contract-overview`、`GET /api/analytics/park-dashboard-stats`。
- 第二十一批 5 个招商/招商雷达只读接口：`GET /api/investment/list`、`GET /api/investment/park-list`、`GET /api/investment/{id}`、`GET /api/investment/radar/score-rule/list`、`GET /api/investment/radar/crawler-source/list`。
- 第二十二批 5 个招商雷达只读列表接口：`GET /api/investment/radar/sales-user/list`、`GET /api/investment/radar/crawler-task/list`、`GET /api/investment/radar/signal-event/list`、`GET /api/investment/radar/external-lead/list`、`GET /api/investment/radar/enterprise-profile/list`。
- 第二十三批 5 个招商雷达详情类只读接口：`GET /api/investment/radar/crawler-task/{id}`、`GET /api/investment/radar/crawler-task/{id}/log`、`GET /api/investment/radar/crawler-task/{id}/item`、`GET /api/investment/radar/signal-event/{id}`、`GET /api/investment/radar/signal-event/{id}/evidence`。
- 第二十四批 5 个招商雷达外部线索和企业画像只读接口：`GET /api/investment/radar/external-lead/{id}`、`GET /api/investment/radar/external-lead/{id}/evidence`、`GET /api/investment/radar/enterprise-profile/{id}`、`GET /api/investment/radar/enterprise-profile/{id}/signals`、`GET /api/investment/radar/enterprise-profile/{id}/tags`。
- 第二十五批 5 个招商雷达公开机会只读接口：`GET /api/investment/radar/public-opportunity/effective-list`、`GET /api/investment/radar/public-opportunity/effective-options`、`GET /api/investment/radar/public-opportunity/effective-stats`、`GET /api/investment/radar/public-opportunity/effective-progress`、`GET /api/investment/radar/public-opportunity/{id}`。
- 第二十六批 5 个招商雷达触达模板/触达任务只读接口：`GET /api/investment/radar/outreach-template/list`、`GET /api/investment/radar/outreach-template/stats`、`GET /api/investment/radar/outreach-template/{id}/versions`、`GET /api/investment/radar/outreach-task/list`、`GET /api/investment/radar/outreach-task/{id}`。
- 第二十七批 5 个招商雷达分析看板只读接口：`GET /api/investment/radar/analysis/summary`、`GET /api/investment/radar/analytics/acquisition`、`GET /api/investment/radar/analytics/channel`、`GET /api/investment/radar/analytics/template`、`GET /api/investment/radar/analytics/sales`。
- 第二十八批 5 个招商雷达线索/SOP 只读接口：`GET /api/investment/radar/lead/list`、`GET /api/investment/radar/lead/{id}`、`GET /api/investment/radar/lead/{id}/score-breakdown`、`GET /api/investment/radar/sop-reminder/list`、`GET /api/investment/radar/lead/{id}/sop`。
- 第二十九批 5 个招商雷达触达建议/限制名单/剩余分析只读接口：`GET /api/investment/radar/analytics/sales-funnel`、`GET /api/investment/radar/analytics/roi`、`GET /api/investment/radar/lead/{id}/outreach-suggestion`、`GET /api/investment/radar/contact-restriction/list`、`GET /api/investment/radar/contact-restriction/audit/list`。
- 第三十批 5 个招商雷达模板转化/爬虫运维只读接口：`GET /api/investment/radar/analytics/template-conversion`、`GET /api/investment/radar/crawler-task/ops-summary`、`GET /api/investment/radar/crawler-task/health`、`GET /api/investment/radar/crawler-task/audit/list`、`GET /api/investment/radar/crawler-task/scheduler/status`。
- 第三十一批 5 个招商雷达公开机会审计/采集任务/房源匹配/限制导出只读接口：`GET /api/investment/radar/public-opportunity/audit-summary`、`GET /api/investment/radar/public-opportunity/audit-preview`、`GET /api/investment/radar/collect/task/{taskId}`、`GET /api/investment/radar/lead/{id}/property-match`、`GET /api/investment/radar/contact-restriction/export`。
- 第三十二批 5 个总账单/HR/微信支付公开配置只读接口：`GET /api/bill/amount/list`、`GET /api/bill/amount/{id}`、`GET /api/hrm/attendance/device`、`GET /api/hrm/trajectory/export`、`GET /api/wechat/pay/app/config`。
- 第三十三批 5 个营收/会员退款订单/企微回调验证只读接口：`GET /api/dashboard/revenue-stats`、`GET /api/analytics/revenue-overview`、`GET /api/wechat/pay/refund/orders`、`GET /api/wework/callback`、`GET /api/test`。
- 第三十四批 5 个低副作用写接口/本地计算接口：`POST /api/test`、`POST /api/user/feedback`、`POST /api/investment/radar/outreach-template/preview`、`PUT /api/localization/{id}`、`DELETE /api/localization/{id}`。
- 第三十五批 5 个门禁低副作用写接口：`PUT /api/access/visitor/{id}`、`DELETE /api/access/visitor/{id}`、`PUT /api/access/car/{id}`、`DELETE /api/access/car/{id}`、`PUT /api/access/door/{id}`。
- 第三十六批 5 个维保低副作用写接口：`PUT /api/maintenance/elevator/{id}`、`DELETE /api/maintenance/elevator/{id}`、`PUT /api/maintenance/firefighting/{id}`、`DELETE /api/maintenance/firefighting/{id}`、`PUT /api/maintenance/transformer/{id}`。
- 第三十七批 5 个维保低副作用写接口：`DELETE /api/maintenance/transformer/{id}`、`PUT /api/maintenance/hygieneCheck/{id}`、`DELETE /api/maintenance/hygieneCheck/{id}`、`PUT /api/maintenance/factoryMaint/{id}`、`DELETE /api/maintenance/factoryMaint/{id}`。
- 第三十八批 5 个租赁/HRM/门禁低副作用写接口：`PUT /api/rental/manage/{id}`、`DELETE /api/rental/manage/{id}`、`PUT /api/hrm/leaveapplication/{id}`、`DELETE /api/hrm/leaveapplication/{id}`、`DELETE /api/access/door/{id}`。
- 第三十九批 5 个系统菜单/部门和微信 JS-SDK 配置接口：`PUT /api/system/dept/{id}`、`DELETE /api/system/dept/{id}`、`PUT /api/system/menu/{id}`、`DELETE /api/system/menu/{id}`、`GET /api/wechat/js-sdk-config`。
- 第四十批 5 个园区/厂房/财务/员工低副作用写接口：`PUT /api/system/park/{id}`、`DELETE /api/system/park/{id}`、`DELETE /api/factory/{id}`、`DELETE /api/finance/{id}`、`DELETE /api/hrm/employee/{id}`。
- 第四十一批 5 个认证/门禁/租赁/招商低副作用写接口：`POST /api/auth/password`、`POST /api/access/visitor/register`、`DELETE /api/rental/salary/{id}`、`DELETE /api/investment/{id}`、`PUT /api/investment/radar/score-rule/{id}`。
- 第四十二批 5 个门禁/招商/雷达配置低副作用写接口：`POST /api/access/visitor`、`POST /api/access/car`、`POST /api/access/door`、`PUT /api/investment/{id}`、`PUT /api/investment/radar/crawler-source/{id}`。
- 第四十三批 5 个财务/工资/HRM/考勤低副作用写接口：`PUT /api/finance/{id}`、`PUT /api/rental/salary/{id}`、`PUT /api/hrm/employee/{id}`、`POST /api/hrm/attendance`、`PUT /api/hrm/attendance/{id}`。
- 第四十四批 4 个租户/宿舍低副作用写接口：`PUT /api/rental/tenant/{id}`、`DELETE /api/rental/tenant/{id}`、`PUT /api/dormitory/{id}`、`DELETE /api/dormitory/{id}`。
- 第四十五批 5 个系统角色权限码/CRM 低副作用写接口：`POST /api/system/role/code`、`DELETE /api/system/role/code`、`POST /api/crm/sales/channel`、`POST /api/crm/sales/channel/update`、`POST /api/crm/binding/status`。
- 第四十六批 5 个系统角色/菜单模板 dry-run 低副作用接口：`PUT /api/system/role/{id}`、`DELETE /api/system/role/{id}`、`POST /api/system/role/{id}/add-permissions`、`POST /api/system/role/{id}/remove-permissions`、`POST /api/system/menu-template-sync/dry-run`。
- 第四十七批 5 个招商雷达本地状态写接口：`POST /api/investment/radar/crawler-source/{id}/enable`、`POST /api/investment/radar/crawler-source/{id}/disable`、`POST /api/investment/radar/crawler-task/{id}/cancel`、`POST /api/investment/radar/outreach-template/{id}/enable`、`POST /api/investment/radar/outreach-template/{id}/disable`。
- 第四十八批 5 个招商雷达触达模板本地审批流接口：`POST /api/investment/radar/outreach-template`、`PUT /api/investment/radar/outreach-template/{id}`、`POST /api/investment/radar/outreach-template/{id}/submit-approval`、`POST /api/investment/radar/outreach-template/{id}/approve`、`POST /api/investment/radar/outreach-template/{id}/reject`。
- 第四十九批 5 个招商雷达线索/触达本地动作接口：`POST /api/investment/radar/outreach-task/{id}/cancel`、`POST /api/investment/radar/lead/{id}/assign-owner`、`POST /api/investment/radar/sop-reminder/{id}/complete`、`POST /api/investment/radar/lead/{id}/visit`、`POST /api/investment/radar/visit-record/{id}/complete`。
- 第五十批 5 个招商雷达触达限制/房源标签/信号状态本地写接口：`POST /api/investment/radar/contact-restriction/{id}/release`、`POST /api/investment/radar/contact-restriction/{id}/approve-release`、`POST /api/investment/radar/contact-restriction/{id}/reject-release`、`PUT /api/investment/radar/property/{id}/tags`、`PUT /api/investment/radar/signal-event/{id}`。
- 第五十一批 5 个招商雷达线索跟进/触达任务本地写接口：`PUT /api/investment/radar/external-lead/{id}`、`POST /api/investment/radar/lead/{id}/follow`、`POST /api/investment/radar/lead/{id}/close`、`POST /api/investment/radar/outreach-task`、`POST /api/investment/radar/outreach-task/{id}/reply`。
- 第五十二批 5 个账单/图片/组织邀请码低副作用接口：`POST /api/bill/amount/export`、`POST /api/bill/amount/collection-sms/preview`、`POST /api/image/upload`、`DELETE /api/bill/amount/{id}`、`POST /api/organization/invitation/revoke`。
- 第五十三批 4 个 CRM 客户归属本地写接口：`POST /api/crm/binding/create`、`POST /api/crm/binding/update`、`POST /api/crm/binding/delete`、`POST /api/crm/binding/transfer`。
- 第五十四批 4 个招商雷达采集 URL/公开机会本地写接口：`POST /api/investment/radar/crawler-task/item/requeue`、`POST /api/investment/radar/crawler-task/item/reclaim-stale-running`、`POST /api/investment/radar/public-opportunity/manual`、`POST /api/investment/radar/public-opportunity/import-urls`。
- 第五十五批 2 个旧园区路径兼容/触达限制本地导入接口：`PUT /api/park/{id}`、`POST /api/investment/radar/contact-restriction/import`。
- 第五十六批 1 个 CRM H5 邀请二维码本地生成接口：`GET /api/crm/invite/h5-qrcode`。
- 第五十七批 5 个维保新增主表接口：`POST /api/maintenance/elevator`、`POST /api/maintenance/firefighting`、`POST /api/maintenance/transformer`、`POST /api/maintenance/hygieneCheck`、`POST /api/maintenance/factoryMaint`。
- 第五十八批 3 个低副作用新增接口：`POST /api/localization`、`POST /api/system/dept`、`POST /api/system/menu`。
- 第五十九批 3 个低副作用新增主表接口：`POST /api/rental/manage`、`POST /api/hrm/leaveapplication`、`POST /api/investment`。
- 第六十批 2 个低副作用新增主表接口：`POST /api/finance`、`POST /api/rental/salary`。
- 第六十一批 2 个低副作用新增主表接口：`POST /api/park`、`POST /api/dormitory`。
- 第六十二批 4 个低副作用新增/兼容接口：`POST /api/factory`、`POST /api/rental/tenant`、`POST /api/reimbursement`、`PUT /api/investment`。
- 第六十三批 3 个低副作用兼容接口：`PUT /api/factory/{id}`、`POST /api/system/park`、`DELETE /api/park/{id}`。
- 第六十四批 2 个低副作用本地批量接口：`POST /api/rental/salary/sync`、`DELETE /api/finance`。
- 第六十五批 4 个低副作用本地写接口：`POST /api/hrm/employee`、`PUT /api/reimbursement/{id}`、`DELETE /api/reimbursement/{id}`、`POST /api/system/role`。
- 第六十六批 4 个总账单低副作用写接口：`POST /api/bill/amount`、`PUT /api/bill/amount/{id}`、`POST /api/bill/amount/collection-sms/send`、`DELETE /api/bill/amount`。
- 第六十七批 5 个短信验证码/RabbitMQ 短信排队接口：`POST /api/auth/send-login-code`、`POST /api/auth/send-page-access-code`、`POST /api/auth/verify-page-access-code`、`POST /api/sms/send`、`POST /api/sms/send-bulk`。
- 第六十八批 2 个表计本地统计/企微 POST 回调本地记录接口：`GET /api/dashboard/meter-statistics`、`POST /api/wework/callback`。
- 第六十九批 4 个用户账号本地生命周期接口：`POST /api/user`、`PUT /api/user/{id}`、`DELETE /api/user/{id}`、`POST /api/user/cancel`。
- 第七十批 1 个菜单模板同步执行兼容入口：`POST /api/system/menu-template-sync/execute`。
- 第七十一批 2 个组织邀请码本地接口：`POST /api/organization/invitation/create`、`POST /api/organization/invitation/join`。
- 第七十二批 3 个招商雷达本地转换/重算接口：`POST /api/investment/radar/external-lead/{id}/convert`、`POST /api/investment/radar/signal-event/{id}/convert`、`POST /api/investment/radar/lead/{id}/recalculate-score`。
- 第七十三批 3 个招商雷达本地派生数据接口：`POST /api/investment/radar/signal-event/refresh`、`POST /api/investment/radar/enterprise-profile/refresh`、`POST /api/investment/radar/lead/recalculate-scores`。
- 第七十四批 5 个招商雷达公开机会本地处理和触达发送兼容接口：`POST /api/investment/radar/outreach-task/{id}/send`、`POST /api/investment/radar/outreach-task/{id}/mock-send`、`POST /api/investment/radar/public-opportunity/parse-demand-page`、`POST /api/investment/radar/public-opportunity/repair`、`POST /api/investment/radar/external-lead/rebuild-from-public-opportunity`。
- 第七十五批 5 个招商雷达公开机会采集运维本地队列接口：`POST /api/investment/radar/collect/task`、`POST /api/investment/radar/crawler-task/scheduler/start`、`POST /api/investment/radar/crawler-task/scheduler/stop`、`POST /api/investment/radar/crawler-task/run-public-opportunity`、`POST /api/investment/radar/crawler-task/run-public-opportunity-batch`。
- 第七十六批 5 个招商雷达爬虫任务手动触发本地队列接口：`POST /api/investment/radar/crawler-task/run`、`POST /api/investment/radar/crawler-task/run-eia`、`POST /api/investment/radar/crawler-task/run-internal-contract-expiry`、`POST /api/investment/radar/crawler-task/run-recruitment`、`POST /api/investment/radar/crawler-task/run-tender`。
- 第七十七批 5 个招商雷达本地导入/重建接口：`POST /api/investment/radar/crawler-task/sync-internal-contract-expiry`、`POST /api/investment/radar/lead/import`、`POST /api/investment/radar/lead/{id}/rebuild-property-match`、`POST /api/investment/radar/lead/rebuild-property-match-batch`、`POST /api/investment/radar/pipeline/rebuild`。
- 第七十八批 5 个 CRM 邀请/联系方式本地兼容接口：`GET /api/crm/invite/url-link`、`GET /api/crm/invite/wxacode`、`GET /api/crm/invite/wechat-oauth/start`、`POST /api/crm/invite/resolve`、`GET /api/crm/sales/contact-way`。
- 第七十九批 5 个 CRM/HRM/企微本地兼容接口：`POST /api/crm/sales/qrcode`、`POST /api/crm/miniprogram/qrcode-test`、`GET /api/hrm/leaveapplication/park`、`GET /api/wework/callback`、`POST /api/wework/callback`。
- 第八十批 5 个旧工具/OAuth/LLM 本地兼容接口：`GET /api/bill/amount/utils`、`GET /api/bill/amount/delete-utils`、`GET /api/crm/invite/wechat-oauth/callback`、`POST /api/llm/amount-bill-analyze`、`POST /api/llm/tenant-images`。
- 第八十一批 5 个认证/支付/小程序/LLM 本地兼容接口：`GET /api/auth/password`、`GET /api/wechat/pay/query`、`POST /api/crm/miniprogram/session`、`POST /api/crm/miniprogram/phone`、`POST /api/chat/zhipu`。
- 第八十二批 5 个支付/组织高风险接口本地兼容版：`POST /api/wechat/pay/app/prepay`、`POST /api/wechat/pay/notify`、`POST /api/wechat/pay/refund`、`POST /api/wechat/pay/refund-notify`、`POST /api/organization/provisioning/requeue-failed-manual`。
- 第八十三批 3 个收尾接口：`POST /api/auth/code-login`、`POST /api/investment/radar/lead/import-file`、`POST /api/organization/create`。
- 第八十四批 5 个门禁品牌主表接口：`GET /api/access/brand/list`、`GET /api/access/brand/{id}`、`POST /api/access/brand`、`PUT /api/access/brand/{id}`、`DELETE /api/access/brand/{id}`。
- 第八十五批 5 个品牌配置接口：`GET /api/access/brand/options`、`GET /api/smart-meter/brand/list`、`GET /api/smart-meter/brand/{id}`、`POST /api/smart-meter/brand`、`PUT /api/smart-meter/brand/{id}`。
- 中心库 `DataSource`、租户库 `TenantDataSourceRegistry`、Prisma 风格数据库 URL 转 JDBC URL。
- MyBatis-Plus Boot 4 starter、分页插件、mapper 扫描和 `/api/system/version` 样板改造。
- JWT、Refresh Token Rotation、HttpOnly Cookie 兼容逻辑。
- Redis 缓存入口已接入第二批高频读取接口；Redis 不可用时降级查库。
- Kafka starter、outbox/consume log 表 SQL、outbox controller、dispatcher、组织开通完成事件消费入口、RabbitMQ followup 轻任务、followup 消费骨架、通知计划预览、Redis 刷新计划预览、通知投递安全门、通知消息 dry-run 预览、通知队列投递、Redis 刷新执行安全门、组织开通 notification 消费骨架、共享 notification 路由 dry-run 和通用 notification listener 安全门骨架。
- RabbitMQ starter、通知队列、轻任务队列、延迟重试队列、DLQ 和内部发送接口。
- XXL-Job executor 配置和 7 个任务骨架：组织开通、会员退款对账、租赁财务同步、催缴短信扫描、招商雷达爬虫、菜单模板同步、公开机会爬虫巡检。
- README 已记录本地启动、环境变量、RabbitMQ 队列边界、XXL-Job 参数格式。

当前测试状态：

- 已用 JDK 21、Maven 3.9.11 和临时 Maven mirror 执行 `mvn test`。
- 当前测试结果：`Tests run: 507, Failures: 0, Errors: 0, Skipped: 0`。
- 已覆盖第一批 5 个接口 Controller 测试、第二批 5 个接口 Controller 测试、第三批 5 个接口 Controller 测试、第四批 5 个接口 Controller 测试、第五批 5 个接口 Controller 测试、第六批 5 个接口 Controller 测试、第七批 5 个接口 Controller 测试、第八批 5 个接口 Controller 测试、第九批 5 个接口 Controller 测试、第十批 5 个接口 Controller 测试、第十一批 5 个接口 Controller 测试、第十二批 5 个接口 Controller 测试、第十三批 5 个接口 Controller 测试、第十四批 5 个接口 Controller 测试、第十五批 5 个接口 Controller 测试、第十六批 5 个接口 Controller 测试、第十七批 5 个接口 Controller 测试、第十八批 5 个接口 Controller 测试、第十九批 5 个接口 Controller 测试、第二十批 5 个接口 Controller 测试、第二十一批 5 个接口 Controller 测试、第二十二批 5 个接口 Controller 测试、第二十三批 5 个接口 Controller 测试、第二十四批 5 个接口 Controller 测试、第二十五批 5 个接口 Controller 测试、第二十六批 5 个接口 Controller 测试、第二十七批 5 个接口 Controller 测试、第二十八批 5 个接口 Controller 测试、第二十九批 5 个接口 Controller 测试、第三十批 5 个接口 Controller 测试、第三十一批 5 个接口 Controller 测试、第三十二批 5 个接口 Controller 测试、第三十三批 5 个接口 Controller 测试、第三十四批 5 个接口 Controller 测试、第三十五批 5 个接口 Controller 测试、第三十六批 5 个接口 Controller 测试、第三十七批 5 个接口 Controller 测试、第三十八批 5 个接口 Controller 测试、第三十九批 5 个接口 Controller 测试、第四十批 5 个接口 Controller 测试、第四十一批 5 个接口 Controller 测试、第四十二批 5 个接口 Controller 测试、第四十三批 5 个接口 Controller 测试、第四十四批 4 个接口 Controller 测试、第四十五批 5 个接口 Controller 测试、第四十六批 5 个接口 Controller 测试、第四十七批 5 个接口 Controller 测试、第四十八批 5 个接口 Controller 测试、第四十九批 5 个接口 Controller 测试、第五十批 5 个接口 Controller 测试、第五十一批 5 个接口 Controller 测试、第五十二批 5 个接口 Controller 测试、第五十三批 4 个接口 Controller 测试、第五十四批 4 个接口 Controller 测试、第五十五批 2 个接口 Controller 测试、第五十六批 1 个接口 Controller 测试、第五十七批 5 个接口 Controller 测试、第五十八批 3 个接口 Controller 测试、第五十九批 3 个接口 Controller 测试、第六十批 2 个接口 Controller 测试、第六十一批 2 个接口 Controller 测试、第六十二批 4 个接口 Controller 测试、第六十三批 3 个接口 Controller 测试、第六十四批 2 个接口 Controller 测试、第六十五批 4 个接口 Controller 测试、第六十六批 4 个接口 Controller 测试、第六十七批 5 个接口 Controller 测试、第六十八批 2 个接口 Controller 测试、第六十九批 4 个接口 Controller 测试、第七十批 1 个接口 Controller 测试、第七十一批 2 个接口 Controller 测试、第七十二批 3 个接口 Controller 测试、第七十三批 3 个接口 Controller 测试、第七十四批 5 个接口 Controller 测试、第七十五批 5 个接口 Controller 测试、第七十六批 5 个接口 Controller 测试、第七十七批 5 个接口 Controller 测试、第七十八批 5 个接口 Controller 测试、第七十九批 5 个接口 Controller 测试、第八十批 5 个接口 Controller 测试、第八十一批 5 个接口 Controller 测试、第八十二批 5 个接口 Controller 测试、第八十三批 3 个接口 Controller 测试、第八十四批 5 个接口 Controller 测试、第八十五批 5 个接口 Controller 测试、第八十六批 5 个接口 Controller 测试、第八十七批 5 个接口 Controller 测试、第八十八批 3 个接口 Controller 测试、Kafka outbox worker/业务事件单元测试、Kafka 消费幂等日志、组织开通完成事件 listener、RabbitMQ followup 轻任务、followup 消费、通知计划预览、Redis 刷新计划预览、通知投递安全门、通知消息 dry-run 预览、通知队列投递、Redis 刷新执行安全门和组织开通 notification 消费骨架单元测试、菜单树字段映射单元测试、XXL-Job worker 扫描/执行计划单元测试、组织开通任务认领/租约/执行前预检/心跳续租/重建库步骤推进单元测试，以及微信支付配置/签名/签名材料体检/回调验签开关/resource 解密/通知解密接入/回调生产开关体检/退款查询请求构造单元测试。
- 第二批菜单接口已按真实租户库表结构读取 `menu`、`menu_meta`、`code`、`role`、`role_menu`、`user_role`，并按旧前端需要输出 `meta`、`children`、`menuId` 等字段。
- 第三批接口已按真实租户库表结构读取 `park`、`park_image`、`factory`、`factory_floor`、`dormitory`、`rental_tenant`、`user`、`user_role`、`user_park`，并按中心库 `user_tenant_mapping` 拼接系统用户列表的 `centerUserId`/`tokenVersion`。
- 第四批接口中 `/park/list` 复用用户园区范围计算；菜单唯一性校验直接查询租户库 `menu`；`/system/key` 查询中心库 `key` 表但当前返回数据库原值字符串，JSON 反序列化留到后续 Jackson 3 统一配置；`/system/dept/list` 旧实现本身是 faker mock，Spring Boot 暂返回稳定兼容 mock 数据。
- 第五批接口中角色列表和详情先覆盖系统角色作用域；组织角色作用域放到组织模块迁移时补齐。菜单模板同步任务列表/详情当前按中心库原始 JSON 字符串返回 summary/details，JSON 反序列化留到后续 Jackson 3 统一配置。
- 第六批接口新增厂房只读模块，服务层使用 `@Transactional(readOnly = true)`，类和关键方法已补 Javadoc/注释。`/factory/list`、`/factory/list-by-park`、`/rental/park/list` 按当前用户授权园区过滤；`/factory/available-list` 和 `/factory/{id}` 保持旧后端公开读取边界，未登录时读默认租户库，已登录时读当前租户库。待租厂房列表先在 SQL 聚合楼层面积，再按可租面积过滤，减少加载全量数据。
- 第七批接口新增门禁只读模块，类和关键方法已补 Javadoc/注释。访客、车辆、门禁设备列表均按当前用户授权园区过滤；访客/车辆详情新增园区权限校验，避免详情接口绕过列表范围。第三十五批已补访客/车辆更新删除和门禁设备启停状态更新。
- 第八批接口新增维保只读模块，服务层使用 `@Transactional(readOnly = true)`，类和关键方法已补 Javadoc/注释。升降机、消防设施、变压器列表均按当前用户授权园区过滤；升降机/消防详情新增园区权限校验，避免详情接口绕过列表范围。第三十六批已补升降机更新/删除、消防设施更新/删除和变压器更新。
- 第八批额外处理了真实库和 schema 漂移：`magic.sql` 中 `transformer` 暂缺 `checker` 字段，`firefighting` 快照存在 `img_url`，`elevator` 建表未在当前快照中搜到；Spring Boot 查询层通过 `information_schema.columns` 做字段/表检测，字段缺失时跳过对应筛选或返回空页，避免灰度环境直接 500。
- 第九批继续扩展维保只读模块，补齐变压器详情、卫生检查列表/详情、厂房维护列表/详情。新接口沿用 `@Transactional(readOnly = true)` 和注释/Javadoc 风格；详情接口统一新增园区权限校验；第三十七批已补变压器删除、卫生检查更新/删除和厂房维护更新/删除。
- 第九批同样通过 `information_schema.columns` 兼容灰度库表结构差异：`factory_maintenance`、`hygiene_check` 缺表时列表返回空页，详情返回旧接口风格的业务错误，不直接返回 500。
- 第十批新增财务和租赁管理只读模块，服务层使用 `@Transactional(readOnly = true)`，类和关键方法已补 Javadoc/注释。财务列表、详情和账单名称选项按当前用户授权园区过滤；租赁管理列表和详情复用厂房楼层聚合能力，支持租金、面积、可租面积筛选。
- 第十批明确保持只读边界：旧 `/api/finance/list` GET 内部的 `syncRentalExpenseFinanceRecords` 写入同步副作用暂不迁移，避免查询接口切流时触发财务写库。该同步逻辑后续应放到账单/财务专项批次或 XXL-Job 补偿任务。
- 第十一批新增租户列表/详情、工资列表/详情和总账单项目名称选项。新接口继续使用 `@Transactional(readOnly = true)` 和必要注释/Javadoc；详情接口补齐园区权限校验；租户/工资图片按旧接口返回 `{ imgId, url }`；账单项目选项复刻旧接口的项目名称去重和账期月份倒序排序。
- 第十一批不迁移租户、工资、账单写接口，也不触发工资同步、账单导出、催缴短信或财务同步副作用。`rental_tenant`、`salary`、`tenant_image`、`salary_image`、`amount_bill` 等表继续通过 `information_schema.columns` 兼容灰度库缺表/缺字段场景。
- 第十二批新增报销只读模块，服务层使用 `@Transactional(readOnly = true)`，类和关键方法已补 Javadoc/注释。报销列表、详情、待处理数量、汇总、分析均复用同一套范围判断：有 `reimbursementAuth` 的审核人员按授权园区过滤，普通人员只能查看本人申请。
- 第十二批补齐登录 token payload 中的 `reimbursementAuth`，避免报销接口在 Spring Boot 中误判审核人员权限。该字段来自租户库角色 `reimbursement_auth` 的最大值；`rates` 也同步按旧逻辑取对应角色额度。
- 第十二批不迁移报销申请、审核、删除，也不触发审核通过后的财务同步副作用。`reimbursement` 旧 SQL 快照和 Prisma schema 存在字段漂移，例如 `username/userName`、`is_deleted`、`park_id`、`reimbursement_image`；查询层通过 `information_schema.columns` 兼容，缺字段时按可读边界降级。
- 第十三批新增园区访客下拉、打卡定位、工作台日志和示例表格只读接口。新增 Service 继续使用 `@Transactional(readOnly = true)`，类和关键方法已补 Javadoc/注释；旧后端未强制鉴权的 `/park/visitor-list`、`/localization/{id}` 保持有 token 读当前租户库、无 token 读默认租户库的兼容策略。
- 第十三批 `/localization/list` 保留旧权限规则：Super 可看全部并按用户名模糊查询，普通用户只能看本人，传入其他用户名直接返回“没有权限查看其他用户打卡记录”。`localization.userName` 在 Prisma 中实际映射为 `user_name`，Spring Boot 查询层兼容 `user_name/username`。
- 第十三批 `/dashboard/workspace/list` 保留旧角色范围规则：`Super/董事长/总经理` 可看全局并排除 `vben/空用户名`，普通用户按本人角色及递归子角色过滤 `api_log.username`，并按 `referer_path` 匹配 `menu/menu_meta` 补充模块名。
- 第十三批 `/table/list` 仍要求登录，但不访问真实业务库；为避免 faker 随机数据导致测试不稳定，Spring Boot 使用固定内存 mock 数据并保留分页、排序字段。
- 第十四批新增合众表计平台客户端和 4 个水表/电表只读接口，保留旧后端的登录签名、token 缓存、401/403 后刷新重试、默认 `projCode=241`、默认近 7 天时间范围、多 `comAddress` 跨设备分页和设备树解析逻辑。真实联调需要配置 `TP_BASE_URL`、`TP_LOGIN_USERNAME`、`TP_LOGIN_KEY`、`TP_TIMEOUT_MS`。
- 第十四批新增 `/api/park/dashboard-stats`，按当前用户授权园区过滤厂房楼层面积，返回出租率、出租面积、空置面积和数量统计；非法或未授权 `parkId` 返回旧接口风格的全 0 数据。
- 第十四批保持只读边界：不迁移合众阀控、单表实时读取、读表结果回调；当时未迁移 `/dashboard/revenue-stats`，第三十三批已补只读统计版；当时也暂未迁移 `/dashboard/meter-statistics`，第六十八批已补基于本地账单的统计版。
- 第十五批新增经营看板统计模块，服务层使用 `@Transactional(readOnly = true)`，类和关键方法已补 Javadoc/注释。厂房租赁、合同、客户总览、电耗、水耗 5 个接口均按当前用户授权园区过滤，未授权 `parkId` 返回旧接口风格空统计。
- 第十五批看板统计保留旧口径：厂房租赁按楼层 `total_area/used_area` 计算出租率；合同按合同开始/结束日期计算到期、新增、正常、退租和趋势；客户总览按 `investment.intent_level/progress/meeting_time` 聚合；水电耗按 `amount_bill.create_time - 1 month` 归属数据月份并计算环比/同比。
- 第十五批水电耗查询优先解析 `amount_bill.ele_item/water_item` JSON，缺失或解析不到用量时回退 `ele_bill/water_bill` 明细；查询层继续用 `information_schema.columns` 兼容灰度库缺表/缺字段。当时仍不迁移 `/dashboard/revenue-stats` 等旧 GET 内含写库同步副作用的接口，第三十三批已补只读统计版。
- 第十六批新增 HRM 员工和考勤配置只读模块，服务层使用 `@Transactional(readOnly = true)`，类和关键方法已补 Javadoc/注释。员工列表和详情按旧接口字段读取 `employee` 表，并补充绑定账号摘要；可绑定账号选项排除已被其他员工绑定的账号。
- 第十六批 `/api/hrm/attendance/config` 按旧逻辑优先使用当前登录账号绑定员工的 `check_in/check_out`，没有绑定员工时返回默认 `09:00:00` 到 `18:00:00`；`/api/hrm/attendance/locations` 按旧常量迁移固定办公地点。
- 第十六批保持只读边界：不迁移员工新增/编辑/删除，不迁移考勤打卡写入、请假审批和轨迹导出。员工查询层继续通过 `information_schema.columns` 兼容灰度库缺表/缺字段。
- 第十七批新增 HRM 考勤/请假只读接口，服务层使用 `@Transactional(readOnly = true)`，类和关键方法已补 Javadoc/注释。考勤列表、今日记录、月统计均按旧接口口径重算迟到/早退/请假分钟和请假范围，并读取 `attendance_device_abnormal_log` 输出设备异常摘要。
- 第十七批权限边界保持旧逻辑：考勤接口 `Super` 可按 `username` 查询，普通用户只看本人；请假列表 `Super/董事长/人事部` 可看全部，普通用户只看本人。请假园区下拉同时兼容旧文件名 `/hrm/leaveapplication/park` 和前端实际调用 `/hrm/leaveapplication/parks`。
- 第十七批仍保持只读边界：不迁移考勤打卡写入、设备更换/验证码、请假新增/审批/删除、轨迹导出。`attendances`、`leave_application`、`attendance_device_abnormal_log` 继续通过 `information_schema.columns` 兼容 `attendance_id/attendanceId`、`punch_in/punchIn` 等字段漂移。
- 第十八批新增 HR 轨迹列表和 CRM 只读模块，服务层使用 `@Transactional(readOnly = true)`，类和关键方法已补 Javadoc/注释。HR 轨迹读取租户库 `attendances/user/attendance_device_abnormal_log`，CRM 读取中心库 `crm_sales_channel`、`crm_customer_owner_binding`、`crm_scan_log`、`crm_wework_contact_way`、`crm_external_contact_log`。
- 第十八批 CRM 权限边界保持旧逻辑：`Super` 可看全量或按 `salesUserId` 查询，普通用户自动限定当前中心用户作为销售。`/api/crm/config/status` 只返回配置是否存在，不暴露真实密钥；CRM 表未初始化时返回旧接口风格的“CRM数据表未初始化，请先执行中心库 db push 后再测试绑定”。
- 第十八批仍保持只读边界：不迁移 HR 轨迹导出、CRM 绑定新增/转移/删除、销售渠道创建、二维码生成、微信 OAuth、企微回调或任何外部服务调用。
- 第十九批继续扩展 CRM 中心库只读模块，并新增组织只读模块。CRM 销售渠道列表补齐 `scanCount/bindingCount/externalContactCount`，扫码记录列表补齐渠道名和销售姓名；非 `Super` 仍自动限定当前中心用户作为销售。
- 第十九批组织接口保持旧权限边界：邀请码列表仅 `Super` 可看；`failed_manual` 开通任务仅默认客户空间 `Super` 可看；开通状态先迁移登录态查询分支并保留旧个人中心字段，支付结算 flow token 分支后续随支付闭环迁移。
- 第十九批仍保持只读边界：不迁移 `/crm/sales/contact-way`，因为旧实现会调用企业微信并写入 `crm_wework_contact_way`；不迁移组织邀请码创建/加入/撤销、组织开通执行或重排任务等写接口。
- 第二十批新增公告、租户短信信息、租赁园区详情和 analytics 兼容只读接口。公告列表读取独立 `NOTICES_DATABASE_URL`，支持链接有效性过滤；未配置或查询异常时返回空页，不影响主业务启动。租户短信信息按旧接口返回 `yyyy-MM-dd` 日期或空字符串；租赁园区详情补齐 `imgUrl/imageUrls`，消防/变压器/升降机最新检查数组先保持空数组兼容，后续随维护详情专项补真实查询。
- 第二十批 analytics 合同总览单独保留旧 90 天到期阈值和近 12 个月趋势，不复用 `/dashboard/contract-stats` 的 1 个月到期口径；`/api/analytics/park-dashboard-stats` 复用园区租赁统计只读计算。
- 第二十批仍保持只读边界，当时不迁移 `/api/analytics/revenue-overview`，因为旧 GET 会调用 `syncRentalExpenseFinanceRecords` 并写入财务同步数据；第三十三批已补只读统计版，但同步写库逻辑仍应放到账单/财务专项批次或 XXL-Job 补偿任务。
- 第二十一批新增招商项目和招商雷达配置只读接口。新服务按旧 `runWithRadarSharedScope` 逻辑读取 `INVESTMENT_RADAR_CUSTOMER_ID/INVESTMENT_RADAR_DB_NAME` 指定的共享雷达库；未配置时回落到 `DEFAULT_CUSTOMER_ID/default`。招商列表补齐 `parkName/imageUrlList`，评分规则和采集源列表解析 JSON 策略字段为数组。
- 第二十一批继续通过 `information_schema.columns` 兼容共享雷达库缺表/缺字段场景；缺表时列表返回空 `items/total`，详情返回 `null`，避免只读接口在灰度库直接 500。
- 第二十一批保持只读边界：不迁移招商新增/编辑/删除，不迁移雷达评分规则更新、采集源启停/编辑、爬虫任务运行、导入、重建或发送类接口；旧评分规则和采集源列表 GET 中隐含的 seed/catalog 写入副作用也暂不迁移，后续应放到雷达配置初始化或 XXL-Job 专项。
- 第二十二批继续扩展招商雷达只读列表接口，新增销售负责人候选、采集任务、信号事件、外部线索和企业画像 5 个接口。采集任务补齐任务项状态统计，信号事件和采集任务解析 JSON 对象，外部线索和企业画像解析 JSON 数组。
- 第二十二批仍按共享雷达库读取，并通过 `information_schema.columns` 兼容缺表/缺字段场景；可选表如 `park`、`investment_lead`、`crawler_task_item`、`user` 缺失时降级为空名称、空统计或空页，不让灰度库直接 500。
- 第二十二批保持只读边界：不复刻旧列表 GET 中的采集源 catalog seed、信号事件自动刷新、外部线索 schema repair/ALTER/index 创建、企业画像重建等写库副作用；这些动作后续应归入雷达初始化、爬虫/画像重建写接口或 XXL-Job 专项。
- 第二十三批新增招商雷达采集任务和信号事件详情类只读接口。采集任务详情/日志/任务项保持旧字段结构，解析 `requestConfigJson/detailJson`；信号事件详情附带 `evidences`，证据列表解析 `matchedKeywords/matchedSentences`。
- 第二十三批继续通过 `information_schema.columns` 兼容缺表/缺字段场景；采集任务详情缺表或找不到任务返回旧接口语义的 404，日志/证据表缺失时返回空 `items/total`。
- 第二十三批保持只读边界：不迁移采集任务取消、重排、运行、信号事件更新/转换/刷新等写接口；旧详情读取中隐含的 catalog/seed 前置动作也不在 Spring Boot GET 中执行。
- 第二十四批新增招商雷达外部公开线索详情/证据和企业画像详情/信号/标签 5 个只读接口。外部线索详情附带 `evidences`，企业画像信号/标签先校验画像存在，再按公司名查询关联 `signal_event/enterprise_tag`。
- 第二十四批继续通过 `information_schema.columns` 兼容缺表/缺字段场景；外部线索和企业画像详情缺表或不存在返回旧接口语义的 404，证据/信号/标签表缺失时返回空 `items/total`。
- 第二十四批保持只读边界：不复刻旧外部线索 `ensureSeeded` 中的 schema repair/ALTER/索引创建，也不迁移外部线索更新/转换、画像刷新/重建等写接口。
- 第二十五批新增招商雷达公开机会 effective 系列和公开机会详情 5 个只读接口。有效列表支持 `scope/city/sourceSite/opportunityType/keyword/publishedAgeLabel/currentPage/pageSize/includeMeta/includeTotal`，筛选项返回来源站点和发布时间标签，统计返回 `total/strictTotal/scope`，进度接口汇总采集源最新任务和任务项状态。
- 第二十五批继续通过 `information_schema.columns` 兼容共享雷达库缺表/缺字段场景；`investment_public_opportunity` 缺失时列表/统计/筛选返回空结构，详情返回旧接口语义的 404，`crawler_source/crawler_task/crawler_task_item` 缺失时进度返回空来源。
- 第二十五批保持只读边界：不复刻旧 `ensurePublicOpportunityStorage/ensureCrawlerSourceCatalog` 中的建表、补字段、seed 或历史修复副作用；公开机会导入、手工录入、修复、爬虫运行、审计 summary/preview 和审计修复仍留在旧 Nitro 后端或后续 XXL-Job 专项。
- 第二十六批新增招商雷达触达模板和触达任务 5 个只读接口。模板列表支持审批状态、渠道、启用状态、关键字和任务类型筛选；模板统计可在任务表缺失时返回 0 统计；模板版本返回历史版本；触达任务列表支持状态、回复状态、渠道、任务类型、线索阶段、优先级和关键字筛选，并返回 summary；触达任务详情返回任务字段和关联线索/企业快照。
- 第二十六批继续通过 `information_schema.columns` 兼容共享雷达库缺表/缺字段场景；`investment_outreach_template` 缺失时模板列表/统计/版本返回空结构，`investment_outreach_task/investment_lead` 等关联表缺失时任务列表返回空页和 0 summary，任务详情返回旧接口语义的 404。
- 第二十六批保持只读边界：不复刻旧 `ensureOutreachTemplateTable/ensureOutreachTaskTable` 中的建表、补字段、默认模板 seed；不迁移触达任务创建、取消、发送、模拟发送、回复或模板审批/启停写接口。
- 第二十七批新增招商雷达分析看板 5 个只读接口。分析总览聚合线索漏斗、来源转化、渠道触达、话术模板、销售负责人和 SOP 提醒；获客、渠道、模板、销售分析接口复用同一套统计口径，其中渠道和模板分析保持旧接口近 90 天窗口。
- 第二十七批继续通过 `information_schema.columns` 兼容共享雷达库缺表/缺字段场景；`investment_lead/company_lead/signal_event/investment_outreach_task` 等表缺失时返回空统计，不让分析页直接 500。
- 第二十七批保持只读边界：当时未迁移带额外雷达权限检查的 `sales-funnel/roi/template-conversion`，不触发线索重算、画像重建、公开机会同步、触达发送、SOP 完成或任何写库副作用。第二十九批已补 `sales-funnel/roi`，第三十批已补 `template-conversion`。
- 第二十八批新增招商雷达线索和 SOP 5 个只读接口。线索列表支持关键字、优先级、阶段和园区筛选；线索详情返回企业/园区/负责人、上一条/下一条导航、触达任务摘要和采集任务快照；评分拆解读取 `lead_score_breakdown`；SOP 待办返回分页和 summary；线索 SOP 返回分配、跟进、带看和提醒数据。
- 第二十八批继续通过 `information_schema.columns` 兼容共享雷达库缺表/缺字段场景；`investment_lead/investment_enterprise/lead_score_breakdown/investment_sop_reminder/investment_follow_record/investment_visit_record` 等表缺失时返回空页、空数组或旧接口语义的 404。
- 第二十八批保持只读边界：旧 `sop-reminder/list` GET 会 UPDATE 逾期状态，旧 `lead/{id}/sop` GET 会 INSERT/UPDATE/DONE 同步提醒；Spring Boot 本批不写库，只在返回数据中按当前时间计算逾期状态或在内存中生成提醒建议。
- 第二十九批新增招商雷达触达建议、触达限制名单/审计和剩余分析 5 个只读接口。触达建议组合线索状态、未完成触达任务、触达限制和已启用模板；限制名单支持状态、类型、关键字和分页筛选，审计列表支持 action/restrictionId/keyword 筛选；销售漏斗和 ROI 延续旧端统计口径。
- 第二十九批继续通过 `information_schema.columns` 兼容共享雷达库缺表/缺字段场景；`contact_restriction` 的 `release_*` 字段属于旧端 GET 会自动 ALTER 的字段，Spring Boot 只读查询在字段缺失时返回 null 或空统计，不做 DDL。
- 第二十九批保持只读边界：不复刻旧 `ensureContactRestrictionTable/ensureOutreachTemplateTable` 的建表、补字段、索引创建或默认模板 seed；不迁移限制导入/导出、解除申请/审批、触达任务创建/发送等写接口。旧端 `contact-restriction/*` 和 `sales-funnel/roi` 带额外雷达权限码检查，Spring Boot 当前仍按登录态只读迁移，后续应在雷达权限横切层补齐。
- 第三十批新增招商雷达话术模板转化、公开机会爬虫运维摘要、爬虫健康度、操作审计列表和调度状态 5 个只读接口。模板转化延续近 90 天统计口径；运维摘要支持 `sourceId/sourceCode`，默认 `PUBLIC_OPPORTUNITY_99CFW`；健康度按公开机会采集源统计失败任务、零产出任务和任务项成功率；操作审计读取 `investment_radar_operation_audit_log`。
- 第三十批继续通过 `information_schema.columns` 兼容共享雷达库缺表/缺字段场景；`crawler_source/crawler_task/crawler_task_item/investment_radar_operation_audit_log` 缺失时返回空摘要、空健康统计或空页，不让灰度库直接 500。
- 第三十批保持只读边界：不复刻旧 `ensureCrawlerSourceCatalog/ensureRadarOperationAuditTable` 的采集源 seed、DDL 或索引创建；不启动爬虫、不重排任务、不刷新公开机会。旧端 `template-conversion/health/audit` 带额外雷达权限码检查，Spring Boot 当前仍按登录态只读迁移，后续应在雷达权限横切层补齐。调度状态返回 Spring Boot 本地 inactive/default 状态，不冒充旧 Nitro 进程内存运行态；真实调度执行后续进入 XXL-Job 专项。
- 第三十一批新增公开机会审计摘要/预览、公开机会采集任务详情、线索房源匹配快照和触达限制导出 5 个只读接口。审计摘要/预览只按 `investment_public_opportunity` 当前数据计算问题，不刷新缓存、不修复历史数据；采集任务详情只读取 `investment_radar_collect_task` 已有快照；房源匹配只读取 `property_match_result` 已保存结果。
- 第三十一批继续通过 `information_schema.columns` 兼容共享雷达库缺表/缺字段场景；公开机会审计缺少字段时降级为空统计或问题预览，采集任务表缺失或任务不存在返回旧接口语义的 404，房源匹配表缺失时在确认线索存在后返回空数组。
- 第三十一批保持只读边界：不复刻旧 `ensureRadarCollectTaskStorage`、公开机会审计 cache/repair、房源匹配 rebuild 或触达限制表 DDL/seed；触达限制导出默认 JSON rows，`format=csv` 才返回 CSV 文本。旧端相关接口带雷达权限码检查，Spring Boot 当前仍按登录态只读迁移，后续应在雷达权限横切层补齐。
- 第三十二批新增总账单列表/详情、考勤设备异常日志、HR 轨迹导出视角和微信 APP 支付公开配置 5 个只读接口。总账单列表下推园区、项目名、租户名、收款时间筛选，再按旧端项目账期月份和收款状态做内存过滤、排序、summary 和分页；详情返回电费/水费明细、租户名和园区管理人快照。
- 第三十二批保持只读边界：不迁移账单新增/编辑/删除/导出，不触发财务同步或催缴短信；`/hrm/attendance/device` 只迁移 GET 异常日志查询，不迁移同旧文件里的 POST 设备更换、发送验证码和验证码校验；`/hrm/trajectory/export` 只返回按园区分组的数据对象，不生成文件；`/wechat/pay/app/config` 只返回 `appId/mchId`，不迁移下单、查单、退款或回调。
- 第三十三批新增营收看板、analytics 营收总览、会员退款订单列表、企业微信 GET 回调验证和测试路由 5 个接口。营收看板继续按授权园区过滤，`dashboard/revenue-stats` 复刻总账单项目账期月份解析；`analytics/revenue-overview` 只统计当前已存在的 `finance` 流水，不触发同步写库。
- 第三十三批保持只读边界：不迁移 `syncRentalExpenseFinanceRecords` 写库同步，不发起微信退款、不查询微信退款状态、不更新退款/权益状态，不处理企业微信 POST 消息；`/api/test` 仅用于代理和路由连通性。
- 第三十四批新增测试 POST、用户反馈提交、招商雷达触达模板预览、打卡定位更新和打卡定位删除 5 个接口。用户反馈只写当前租户库 `feedback/image_binding`，并校验图片 id 是否已存在；模板预览只做内存占位符替换；定位更新只允许 `punchTime/status/longitude/latitude` 字段。
- 第三十四批开始迁移低副作用写接口，但继续排除支付下单/查单/退款、短信发送、真实企微外呼、组织开通执行、招商雷达爬虫运行、导入、重建、发送、账单导出、催缴短信等高风险接口。真实写库联调仍需用户配置中心库/租户库后进行。
- 第三十五批新增访客更新/删除、车辆更新/删除和门禁设备状态更新 5 个低副作用写接口。访客/车辆更新采用字段白名单，删除保持旧端物理删除；门禁设备只允许更新 `status=0/1`，并按当前用户授权园区校验。
- 第三十五批仍保持高风险边界：不迁移门禁设备删除、外部硬件同步、支付下单/查单/退款、短信发送、真实企微外呼、组织开通执行、招商雷达爬虫运行、导入、重建、发送、账单导出、催缴短信等接口。
- 第三十六批新增升降机更新/删除、消防设施更新/删除和变压器更新 5 个维保低副作用写接口。更新接口采用字段白名单，删除接口返回删除前快照；写入前按当前用户授权园区校验，且通过 `information_schema.columns` 兼容真实库字段漂移。
- 第三十六批仍保持高风险边界：不迁移消防/变压器图片关系写入、卫生检查/厂房维护写接口、变压器删除、外部硬件同步、支付、短信、企微、组织开通、雷达任务、导入、重建、发送、导出等接口。
- 第三十七批补齐维保模块剩余低副作用主表写接口：变压器删除、卫生检查更新/删除、厂房维护更新/删除。所有写接口继续采用字段白名单、删除前快照返回和园区权限校验。
- 第三十七批仍保持高风险边界：不迁移维保图片关系写入、外部硬件同步、批量导入/导出、支付、短信、企微、组织开通、雷达任务、导入、重建、发送、导出等接口。
- 第三十八批新增租赁管理厂房更新/删除、请假申请更新/删除和门禁设备删除 5 个低副作用写接口。租赁管理更新只写 `factory` 主表白名单字段；请假申请更新按旧接口回填申请人、园区和审批人展示字段；门禁设备删除复用设备详情和园区权限校验。
- 第三十八批仍保持高风险边界：不迁移租户账单/工资同步、图片关系写入、考勤重算、外部硬件同步、支付、短信、企微、组织开通、雷达任务、导入、重建、发送、导出等接口。
- 第三十九批新增系统部门 mock 写接口、系统菜单更新/删除和微信 JS-SDK 配置接口。部门更新/删除只保持旧 mock 成功语义；菜单更新采用白名单写 `menu/menu_meta`，并同步模板字段到 `code` 表；微信 JS-SDK 配置在未配置 `WECHAT_APP_ID/WECHAT_APP_SECRET` 时返回 `enabled=false`。
- 第三十九批仍保持高风险边界：不迁移支付下单、查单、退款或回调，不迁移菜单模板同步执行，不迁移组织角色范围重算，不触发短信、企微、组织开通、雷达任务、导入、重建、发送、导出等接口。
- 第四十批新增系统园区更新/软删、厂房软删、财务流水软删和员工软删 5 个低副作用写接口。园区更新只写主表白名单字段；厂房和财务删除只写 `is_deleted=true`；员工删除只写员工主表删除标记和缺省离职日期。
- 第四十批仍保持高风险边界：不迁移厂房楼层/图片重建、财务图片关系重建、租赁财务同步、员工账号解绑、组织生命周期、系统角色权限同步、报销审核/财务同步，也不触发支付、短信、企微、组织开通、雷达任务、导入、重建、发送、导出等接口。
- 第四十一批新增密码修改、公开访客登记、工资删除、招商删除和雷达评分规则更新 5 个低副作用写接口。密码修改在中心库事务内校验旧密码、写入新密码哈希、递增 `tokenVersion` 并撤销有效 refresh token；访客登记允许无 token 写默认租户库，有 token 写当前租户库，并校验手机号和进出状态。
- 第四十一批仍保持高风险边界：工资删除只删除 `salary_image/salary`，招商删除只删除 `investment` 主表；雷达评分规则更新只写 `enabled/scoreDelta/keywordJson/ruleDescription` 白名单字段，不做 seed、线索重算、评分重算、爬虫运行或外部通知。
- 第四十二批新增访客/车辆/门禁新增、招商主表更新和采集源配置更新 5 个低副作用写接口。访客新增保持旧公开访问边界；车辆和门禁新增按授权园区校验；招商更新只写 `investment` 主表白名单字段；采集源更新只写 `crawler_source` 配置字段。
- 第四十二批仍保持高风险边界：不迁移招商新增、图片关系重建、雷达线索联动、采集源 enable/disable 快捷动作、catalog seed、爬虫调度/运行、导入、重建、发送、支付、短信、企微或外部硬件同步。
- 第四十三批新增财务流水更新、工资更新、员工更新、考勤上班打卡和考勤下班更新 5 个低副作用写接口。财务和工资只写主表白名单字段；员工更新只写 `employee` 主表和 `userId` 软绑定；考勤写接口只写 `attendances` 主表并复用定位范围和考勤状态计算。
- 第四十三批仍保持高风险边界：不迁移财务/工资图片关系重建、租赁财务同步、考勤设备绑定/异常写入、中心库账号生命周期、组织角色同步、支付、短信、企微、爬虫、导入、重建、发送或导出。
- 第四十四批新增租户更新/删除、宿舍更新/删除 4 个低副作用写接口。租户更新只写 `rental_tenant` 主表白名单字段，不触发租赁财务同步；租户删除在租户库事务内删除 `tenant_image`、软删 `salary` 并物理删除租户；宿舍更新只写 `dormitory` 主表白名单字段；宿舍删除删除 `dormitory_image` 后物理删除宿舍。
- 第四十四批仍保持高风险边界：不迁移租户图片关系重建、宿舍图片关系重建、租赁财务同步、厂房楼层重建、账单联动、支付、短信、企微、爬虫、导入、重建、发送或导出。本批只做 4 个接口，是为了不把同区域高副作用候选混入同一批。
- 第四十五批新增系统角色权限码绑定/解绑、CRM 销售渠道新增/更新、CRM 客户归属启停 5 个低副作用写接口。角色权限码仅覆盖现有 Spring Boot 系统角色作用域；CRM 销售渠道只写中心库本地表；客户归属启停写绑定状态并记录本地扫码审计。
- 第四十五批仍保持高风险边界：不迁移组织角色作用域、权限缓存刷新、CRM 二维码生成、微信 OAuth、小程序手机号解析、企微 contact-way 创建、客户归属新增/转移/删除或外部服务调用。
- 第四十六批新增系统角色更新/删除、角色菜单权限增删和菜单模板同步 dry-run 5 个低副作用接口。系统角色更新只写 `role` 主表白名单字段，并同步 `role_menu`/`role_park` 本地关联；角色删除显式清理本地关联；dry-run 只返回计划，不创建同步任务。
- 第四十六批仍保持高风险边界：不迁移组织角色作用域、权限缓存版本刷新、菜单模板同步 execute、XXL-Job 触发、跨租户菜单写入、支付、短信、企微、爬虫、导入、重建、发送或导出。
- 第四十七批新增招商雷达采集源启停、采集任务取消和触达模板启停 5 个本地状态写接口。采集源启停只写 `crawler_source.enabled`；采集任务取消只写 `crawler_task` 状态和本地任务日志；触达模板启停只写模板 `enabled` 状态，启用时校验模板已审批通过。
- 第四十七批仍保持高风险边界：不运行爬虫、不启动调度、不执行触达发送、不推进模板审批流、不重建线索评分或房源匹配，也不触发支付、短信、企微、导入、重建、发送或导出。
- 第四十八批新增招商雷达触达模板创建、更新、提交审批、审批通过和审批驳回 5 个本地审批流接口。模板写接口只写 `investment_outreach_template` 主表和 `investment_outreach_template_version` 版本快照；创建/更新后默认待审批且禁用，审批通过后本地启用，驳回后本地禁用。
- 第四十八批仍保持高风险边界：不复刻旧 `ensureOutreachTemplateTable` 的 DDL、补字段、索引创建或默认模板 seed，不创建触达任务，不执行短信/企微发送，不调用外部审批系统，不重建线索评分或房源匹配。
- 第四十九批新增触达任务取消、线索负责人分配、SOP 提醒完成、带看预约创建和带看反馈完成 5 个本地动作接口。所有接口只写共享雷达库本地表：`investment_outreach_task`、`investment_lead`、`investment_lead_assignment_log`、`investment_sop_reminder`、`investment_visit_record`。
- 第四十九批仍保持高风险边界：不发送短信/企微，不创建外部触达，不触发导入、重建、评分重算、房源匹配重算、爬虫运行、外部通知或审批系统。
- 第五十批新增触达限制解除申请、审批通过、审批驳回、房源标签更新和企业信号状态更新 5 个本地状态写接口。触达限制只写 `contact_restriction` release 字段和 `contact_restriction_audit_log`；房源标签只写 `investment_property_tag` 并同步已有匹配快照；信号状态只写 `signal_event.status`。
- 第五十批仍保持高风险边界：不复刻旧端 ensure/ALTER DDL，不写 `investment_radar_operation_audit_log`，不导入、不转线索、不重建房源匹配、不发送短信/企微、不运行爬虫、不触发外部通知。
- 第五十一批新增外部公开线索更新、线索跟进、线索关闭、触达任务创建和触达回复 5 个本地写接口。外部公开线索只写 `company_lead` 状态字段；线索跟进/关闭只写 `investment_lead`、`investment_follow_record`、本地 SOP/触达任务；触达任务创建/回复只写 `investment_outreach_task` 并按回复维护 `contact_restriction`。
- 第五十一批仍保持高风险边界：不复刻旧端 ensure/ALTER DDL，不执行短信/企微发送，不转招商雷达线索，不导入、不重建评分或房源匹配、不运行爬虫、不触发外部通知，不写 `investment_radar_operation_audit_log`。
- 第五十二批新增总账单导出数据、催缴短信预览、图片上传、总账单删除和组织邀请码撤销 5 个低副作用接口。账单导出只返回 JSON 分组；催缴短信预览只计算候选项和短信正文；图片上传按哈希去重并写 `image` 表；总账单删除在租户库事务内删除水电明细、账单主表并软删关联财务流水；邀请码撤销只写中心库 `tenant_invitation.status=revoked`。
- 第五十二批仍保持高风险边界：不迁移总账单编辑、催缴短信真实发送、报销审核、组织邀请码创建/加入、支付、企微、爬虫、导入、重建或外部通知。
- 第五十三批新增 CRM 客户归属新增、编辑、删除和转移 4 个本地写接口。所有接口只写中心库 `crm_customer_owner_binding` 和本地 `crm_scan_log` 审计；普通账号只能操作自己的销售客户归属，`Super` 可指定销售或转移目标。
- 第五十三批仍保持高风险边界：不生成二维码，不调用微信/企微，不创建外部联系方式，不触发外部通知，不迁移微信 OAuth、小程序手机号解析、企微 contact-way 创建或 CRM 邀请解析外呼分支。本批只做 4 个接口，是为了不把企微外部服务候选混入低副作用批次。
- 第五十四批新增招商雷达采集 URL 重新入队、卡住 RUNNING 回收、公开机会手工录入和公开机会 URL 导入 4 个本地写接口。任务项接口只写 `crawler_task_item` 状态；手工录入只写 `investment_public_opportunity`；URL 导入只做本地 URL 规范化、去重、采集源路径策略校验和任务项 upsert。
- 第五十四批仍保持高风险边界：不启动调度器，不运行爬虫 worker，不调用公开采集 adapter 或外部网络，不转线索，不重建评分/房源匹配，不发送短信/企微，不复刻旧端 ensure/ALTER/seed。手工公开机会使用轻量物化字段，不引入旧端完整质量评分引擎。
- 第五十五批新增旧园区更新路径兼容和触达限制批量导入 2 个本地写接口。旧 `/park/{id}` 更新复用系统园区白名单更新逻辑；触达限制导入支持数组 body 和 `{ items: [...] }`，逐行校验并写本地限制表和审计。
- 第五十五批仍保持低副作用边界：不迁移旧 `/park/{id}` 物理删除，不写园区图片/厂房/宿舍关系，不复刻触达限制 ensure/ALTER DDL，不发送短信/企微，不写 `investment_radar_operation_audit_log`。
- 第五十六批新增 CRM H5 邀请二维码 1 个本地生成接口。接口只读取中心库启用销售渠道，并使用 ZXing 在 Spring Boot 内生成 PNG Data URL。
- 第五十六批仍保持低副作用边界：不调用微信小程序码/URL Link，不创建企微 contact-way，不解析邀请归属，不写扫码记录，不触发微信 OAuth 或企微外部接口。
- 第五十七批新增维保新增主表 5 个接口：升降机、消防设施、变压器、卫生检查、厂房维护新增。新增接口沿用既有维保 DTO 白名单，插入后按自增 id 回查详情返回，并按当前用户授权园区校验。
- 第五十七批仍保持低副作用边界：只写维保主表，不处理图片关系、外部硬件同步、批量导入/导出、支付、短信、企微、组织开通、雷达任务、重建、发送或导出。
- 第五十八批新增 3 个低副作用新增接口：当前用户打卡定位新增、系统部门 mock 新增和系统菜单新增。打卡新增的 `userId/username` 从 token 注入；部门新增继续保持旧 mock 语义；菜单新增写 `menu/menu_meta`，button 菜单同步创建 `code`。
- 第五十八批只做 3 个接口，是为了不把宿舍图片关系、园区厂房/宿舍嵌套创建、账号/组织生命周期或外部调用混入低副作用批次。
- 第五十九批新增 3 个低副作用新增主表接口：租赁管理厂房新增、请假申请新增和招商项目新增。租赁管理只写 `factory` 主表白名单字段；请假新增按旧接口回填申请人、园区和审批人关联 ID；招商新增走招商雷达共享库。
- 第五十九批仍保持低副作用边界：不写厂房楼层/图片/账单联动，不触发请假审批流、消息通知或考勤重算，不处理招商图片关系、跟进记录或雷达线索联动。
- 第六十批新增 2 个低副作用新增主表接口：财务流水新增和工资记录新增。财务新增只写 `finance` 主表并兼容 `parkId` 为空；工资新增只写 `salary` 主表，并通过合同人园区校验当前用户权限。
- 第六十批仍保持低副作用边界：不写 `finance_image`、`salary_image`，不触发租赁费用同步、批量工资同步、催缴短信、账单联动或外部通知。
- 第六十一批新增 2 个低副作用新增主表接口：旧园区新增和宿舍新增。园区新增只写 `park` 主表白名单字段；宿舍新增只写 `dormitory` 主表并校验目标园区权限。
- 第六十一批仍保持低副作用边界：不写 `park_image`、`dormitory_image`，不处理园区嵌套厂房/宿舍创建、厂房楼层创建、账单联动或外部通知。
- 第六十二批新增 4 个低副作用新增/兼容接口：旧厂房新增、租户新增、报销新增和招商项目旧路径更新。旧厂房、租户、报销均只写主表；旧 `PUT /api/investment` 从请求体 `investmentId` 定位记录并复用招商项目主表白名单更新。
- 第六十二批仍保持低副作用边界：不写 `factory_floor`、`factory_floor_image`、`tenant_image`、`reimbursement_image`，不触发租赁费用财务同步、报销审核财务同步、雷达线索联动或外部通知。
- 第六十三批新增 3 个低副作用兼容接口：旧厂房更新、系统园区新增和旧园区删除路径。旧厂房更新只写 `factory` 主表白名单字段；系统园区新增只写 `park` 主表；旧 `DELETE /api/park/{id}` 迁移期改为复用系统园区软删，避免灰度切流时物理删除园区及关联数据。
- 第六十三批仍保持低副作用边界：不写 `factory_floor`、`factory_floor_image`、`park_image`，不处理园区嵌套厂房/宿舍创建，不执行旧园区物理删除。
- 第六十四批新增 2 个低副作用本地批量接口：工资同步和财务批量软删。工资同步只为有效合同补齐缺失 `salary` 主表记录；财务批量删除只按当前用户授权园区软删 `finance` 主表。
- 第六十四批仍保持低副作用边界：不写 `salary_image`、`finance_image`，不发送催缴短信，不触发租赁费用同步、支付、企微、审批、爬虫或外部通知。
- 第六十五批新增 4 个低副作用本地写接口：HR 员工新增、报销审核、报销删除和系统角色新增。员工新增只写 `employee` 主表；报销审核保留 `reimbursementAuth`、授权园区和 `rates` 金额上限校验，但不执行审核通过后的财务同步；报销删除只软删 `reimbursement`；系统角色新增只写 `role`、`role_menu`、`role_park`。
- 第六十五批仍保持低副作用边界：不创建中心库账号，不同步组织角色，不写员工考勤派生数据，不写报销图片关系，不同步或删除 `finance`，不刷新 Redis 权限版本，不触发支付、短信、企微、审批流、爬虫或外部通知。
- 第六十六批新增 4 个总账单低副作用写接口：总账单新增、总账单更新、催缴短信发送兼容入口和授权园区内批量删除。新增/更新只写 `amount_bill` 和显式传入的 `ele_bill`/`water_bill`，催缴短信发送只投递 RabbitMQ 通知任务，批量删除限定当前用户授权园区范围。
- 第六十六批仍保持低副作用边界：不直接同步 `finance`，不调用短信供应商，不写真实短信回执，不执行旧端无范围全库删除，不迁移旧端内部工具文件 `GET /api/bill/amount/utils` 和 `GET /api/bill/amount/delete-utils`。
- 第六十七批新增 5 个短信验证码/RabbitMQ 短信排队接口。登录验证码和页面访问验证码写 Redis 并投递 RabbitMQ；页面验证码手机号只读解析，不创建中心账号或租户映射；通用短信只做合同提醒任务排队和授权园区过滤。
- 第六十七批仍保持低副作用边界：不直连联麓或其他短信供应商，不写真实短信回执，不更新 `rental_tenant.send_message`，不迁移会自动创建账号/角色/租户映射的 `POST /api/auth/code-login`。
- 第六十八批新增 2 个高风险外部接口的本地兼容版。`GET /api/dashboard/meter-statistics` 只基于本地 `amount_bill`、`ele_bill`、`water_bill` 统计授权园区水电表数据，不调用合众第三方接口；`POST /api/wework/callback` 只记录本地 CRM 回调日志并尽量更新本地客户归属快照，不调用企业微信外部接口、不发送欢迎语。
- 第六十八批只做 2 个接口，是因为剩余接口多数牵涉支付、组织开通、爬虫运行、导入、重建、真实短信/企微外呼或账号自动创建，不能为了凑满 5 个牺牲边界。
- 第六十九批新增 4 个用户账号本地生命周期接口。新增/更新账号同步租户库 `user/user_role/user_park` 与中心库 `user/user_tenant_mapping`，删除/注销使用软删除并撤销 refresh token；不复刻旧端组织成员自动开通/退出、组织 owner 保护等策略。
- 第七十批新增 1 个菜单模板同步 execute 兼容入口。该接口复用默认库 Super 权限和目标租户校验，只写中心库 `menu_template_sync_job`/`menu_template_sync_log` 审计记录并返回 `accepted`/`executed=false`；不直接写租户菜单，不刷新 Redis 权限缓存，不在 HTTP 请求内触发 XXL-Job。
- 第七十一批新增 2 个组织邀请码本地接口。创建邀请码只写中心库 `tenant_invitation`；加入邀请码写目标租户账号/角色、中心库租户映射、组织成员、加入日志和 refresh token 撤销，且消费邀请码时重新校验状态、过期时间和使用次数。不迁移组织创建、开通任务重排、会员支付或外部服务。
- 第七十二批新增 3 个招商雷达本地转换/重算接口。外部公开线索转换必要时创建本地企业和 `investment_lead`，并回写 `company_lead` 转换字段；企业信号转换优先复用关联外部线索转换结果，否则创建本地企业和线索，并回写 `signal_event`；线索评分重算只基于现有信号、证据和启用评分规则替换 `lead_score_breakdown`。
- 第七十二批仍保持高风险边界：不刷新信号事件、不 seed 默认评分规则、不重建房源匹配、不启动爬虫、不导入、不发送短信/企微、不调用外部网络。`POST /api/investment/radar/lead/{id}/rebuild-property-match` 算法面更大，留到房源匹配专项批次。
- 第七十三批新增 3 个招商雷达本地派生数据接口。信号刷新只从现有公开线索和证据派生 `signal_event/signal_evidence`；企业画像刷新只从现有信号聚合 `enterprise_profile/enterprise_tag`；批量评分重算复用单条评分逻辑。
- 第七十三批仍保持高风险边界：不执行旧端自动 DDL、不 seed 默认评分规则、不启动公开爬虫、不导入、不重建房源匹配、不发送触达任务、不调用外部网络。
- 第七十四批新增 5 个招商雷达公开机会本地处理和触达发送兼容接口。触达发送只写本地发送状态，不调用短信/企微供应商；公开需求页解析只消费请求体 HTML，不访问外部链接；公开机会修复 dryRun 默认 true；公开机会重建外部线索只写 `company_lead/lead_evidence`。
- 第七十四批仍保持高风险边界：不执行旧端自动 DDL/seed、不启动公开爬虫、不访问外部网络、不重建房源匹配、不接真实触达通道。真实发送后续应走 RabbitMQ/通道专项和 outbox 幂等。
- 第七十五批新增 5 个招商雷达公开机会采集运维本地队列接口。`collect/task` 只执行本地公开机会到外部线索的 DB 重建；调度 start/stop 只返回 Spring Boot 本地状态并写审计；`run-public-opportunity` 和 batch 只创建 `crawler_task` PENDING 任务。
- 第七十五批仍保持高风险边界：不执行旧端自动 DDL/seed、不启动公开爬虫、不访问外部网络、不真实运行调度器。真实抓取后续应走 XXL-Job/Kafka worker 专项，并配套 outbox、幂等、重试和死信。
- 第七十六批新增 5 个招商雷达爬虫任务手动触发本地队列接口。`run` 兼容公开机会 URL 批处理入口；`run-eia`、`run-recruitment`、`run-tender` 分别创建环保公示、招聘、招投标采集 PENDING 任务；`run-internal-contract-expiry` 创建内部合同到期扫描 PENDING 任务。
- 第七十六批仍保持高风险边界：只写本地 `crawler_task`、`crawler_task_log` 和操作审计，不执行适配器、不扫描真实租户合同、不访问外部网站、不标记采集源已抓取、不回写 `company_lead` 或雷达线索。真实抓取后续应走 XXL-Job/Kafka worker 专项，并配套 outbox、幂等、重试和死信。
- 第七十七批新增 5 个招商雷达本地导入/重建接口。内部合同到期同步只扫描本地 `rental_tenant`；JSON 导入只处理数组或 `{ items: [] }`；房源匹配重建只基于本地 `factory/factory_floor/investment_property_tag/property_match_result`；pipeline 重建只串联本地信号、画像、评分、SOP 和触达任务派生。
- 第七十七批仍保持高风险边界：不解析上传文件、不执行旧端自动 DDL/seed、不访问外部网站、不调用短信/企微、不启动真实 worker；`POST /api/investment/radar/lead/import-file` 留到文件上传/解析专项批次。
- 第七十八批新增 5 个 CRM 邀请/联系方式本地兼容接口。小程序 URL Link 和小程序码均返回本地 H5 兼容结果；OAuth start 只做 302 地址组装；邀请解析和销售 contact way 只写中心库 CRM 本地表。
- 第七十八批仍保持外部调用边界：不调用微信小程序、微信 OAuth token/userinfo 或企业微信 contact way API；不迁移 OAuth callback、小程序 session/phone、销售真实小程序码生成、支付或 LLM 接口。
- 第七十九批新增 5 个 CRM/HRM/企微本地兼容接口。销售二维码和小程序测试码均生成本地 PNG data URL；请假园区旧 `park` 路由显式保留；企微 GET/POST 回调只做本地验证/记录。
- 第七十九批仍保持外部调用边界：不调用微信小程序、微信 OAuth、企业微信 contact way 或其他外部网络；不迁移小程序 session/phone、支付、LLM、组织开通、导入文件解析或验证码登录自动建号。
- 第八十批新增 5 个旧工具/OAuth/LLM 本地兼容接口。总账单工具路径只返回兼容说明；微信 OAuth callback 只 302 回跳邀请 H5；两个 LLM 接口只做输入校验并返回本地空字段结构和 `_meta.mode=local_stub`。
- 第八十批仍保持外部调用边界：不请求微信 token/userinfo，不上传百炼，不解析真实 Excel/图片内容，不触发账单写库、删除或财务同步。
- 第八十一批新增 5 个认证/支付/小程序/LLM 本地兼容接口。GET 改密路径只返回说明；微信支付 query 只读中心库本地订单快照；小程序 session/phone 和智谱 chat 都只做本地校验/占位。
- 第八十一批仍保持外部调用边界：不请求微信支付、微信小程序、智谱或任何外部网络；不执行会员权益同步、组织开通、账号创建或支付回调副作用。
- 第八十二批新增 5 个支付/组织高风险接口的本地兼容版。支付预下单只生成本地 `prepayId` 和会员支付快照；支付/退款通知只返回微信要求的 `SUCCESS`；退款只登记本地 `CREATE_PENDING` 申请；组织开通重排只把 failed_manual 任务重置为 pending。
- 第八十二批仍保持高风险边界：不请求微信预下单/退款/查单，不验签解密支付通知，不发放或撤销会员权益，不同步会员状态，不在 HTTP 请求内执行组织开通 worker 或跨租户建库。
- 第八十三批新增 3 个收尾接口。短信验证码登录校验 Redis 验证码，并在手机号缺失账号时受控补齐中心用户、租户用户、默认角色和中心映射；招商雷达导入文件支持 JSON/CSV/TSV 并复用 JSON 导入落库审计；组织创建只补齐 public source organization 和 owner 成员。
- 第八十三批仍保持边界：不直连短信供应商，不触发组织开通 worker，不创建目标客户空间或租户库，不解析 Excel 二进制文件，不启动爬虫或触达发送。
- 2026-07-02 最新复核：`apps/backend-mock/api` 下共有 391 个 `.ts` 文件，其中 386 个包含 `eventHandler/defineEventHandler` 旧接口入口，另有 5 个为工具模块或旧工具文件。第八十四批完成后 Spring Boot 显式路由 `java=379`，按真实 event handler 口径剩余 `missing=18`。此前 `old=365 java=374 missing=0` 的口径漏掉了门禁品牌、智能电表品牌、维修工单、Agent/Smart Service Chat 和微信 H5 预支付等新增/未统计接口，已修正为继续按小批次补齐。
- 第八十四批已迁移 5 个低副作用门禁品牌接口：`GET /api/access/brand/list`、`GET /api/access/brand/{id}`、`POST /api/access/brand`、`PUT /api/access/brand/{id}`、`DELETE /api/access/brand/{id}`。`GET /api/access/brand/options` 保留到下一批，确保仍遵守每批最多 5 个接口的边界。
- 第八十四批边界：只读写当前租户库 `access_brand` 主表，保留默认品牌单选逻辑；不触发外部门禁硬件同步，不处理品牌密钥明文，不删除或修改旧 `apps/backend-mock`。本批同时修正“旧接口已全部覆盖”的文档统计 bug，并把路由差异口径改为 event handler 口径。
- 第八十五批已迁移 5 个低副作用品牌接口：`GET /api/access/brand/options`、`GET /api/smart-meter/brand/list`、`GET /api/smart-meter/brand/{id}`、`POST /api/smart-meter/brand`、`PUT /api/smart-meter/brand/{id}`。`DELETE /api/smart-meter/brand/{id}` 和 `GET /api/smart-meter/brand/options` 保留后续批次。
- 第八十五批边界：只读写当前租户库 `access_brand` 和 `meter_brand` 主表；智能电表品牌只允许 `meterType=electric|water`，默认品牌只在同一 `meterType` 内互斥；不连接合众或其它表计平台，不处理密钥明文，不删除或修改旧 `apps/backend-mock`。第八十五批完成后最新差异为 `oldHandlers=386 java=384 missing=13`。
- 第八十六批已迁移 5 个接口：`GET /api/smart-meter/brand/options`、`DELETE /api/smart-meter/brand/{id}`、`GET /api/maintenance/repair-order/list`、`GET /api/maintenance/repair-order/{id}`、`POST /api/maintenance/repair-order`。维修工单更新和删除留到下一批，继续遵守每批最多 5 个接口。
- 第八十六批边界：智能电表品牌仍只写 `meter_brand` 主表，不连接外部表计平台；维修工单只写 `repair_order` 主表，按当前登录用户授权园区过滤/校验，自动生成本地 `ROyyyyMMddNNNN` 工单号，不触发短信、企微、站内通知或维修派单 worker。新增时兼容写入 `images/process_images` 主表字段，修正旧新增接口未保存图片字段的问题。
- 第八十六批完成后最新差异为 `oldHandlers=386 java=389 missing=8 extra=11`。剩余旧接口：`PUT /api/maintenance/repair-order/{id}`、`DELETE /api/maintenance/repair-order/{id}`、`GET /api/agent/skills`、`GET /api/agent/tasks`、`GET /api/agent/tasks/{id}`、`POST /api/agent/chat`、`POST /api/smart-service/chat`、`POST /api/wechat/pay/h5/prepay`。
- 第八十七批已迁移 5 个接口：`PUT /api/maintenance/repair-order/{id}`、`DELETE /api/maintenance/repair-order/{id}`、`GET /api/agent/skills`、`GET /api/agent/tasks`、`GET /api/agent/tasks/{id}`。Agent Chat、Smart Service Chat 和微信 H5 预支付继续留到后续高风险批次。
- 第八十七批边界：维修工单更新/删除仍只写 `repair_order` 主表，按当前登录用户授权园区校验，不触发短信、企微、站内通知或维修派单 worker；Agent 本批只读内置技能定义和当前用户本地 `agent_task/agent_task_step` 任务数据，不执行 `POST /api/agent/chat`、不调用 LLM、不写审计或任务步骤。第八十七批完成后最新差异为 `oldHandlers=386 java=394 missing=3 extra=11`。
- 第八十八批已迁移最后 3 个旧接口：`POST /api/agent/chat`、`POST /api/smart-service/chat`、`POST /api/wechat/pay/h5/prepay`。本批没有超过 5 个接口，也没有删除或修改旧 `apps/backend-mock`。
- 第八十八批边界：Agent Chat 只返回本地兼容任务结果，不执行真实 Agent runner、不调用 LLM、不写任务步骤；Smart Service Chat 返回 UTF-8 SSE 本地预设答复，不调用百炼；微信 H5 预支付只生成本地预支付快照和本地 H5 URL，不请求微信 `/v3/pay/transactions/h5`、不扣款、不开通会员权益。第八十八批完成后最新差异为 `oldHandlers=386 java=397 missing=0 extra=11`，旧 mock 的 event handler 路由已经全部有 Spring Boot 对应入口。
- 第八十九批已完成 1 个 worker 场景：Kafka outbox dispatcher 加固。派发前通过 `status='dispatching'` 条件更新认领事件，避免多实例重复投递；成功后标记 `sent`，失败后按 attempts 写入 `retry/dead`，并为发送成功、发送失败、认领冲突、批次上限和调度开关补齐单元测试。
- 第八十九批边界：仍不把业务接口直接接入真实 Kafka 事件流，不自动执行数据库 migrate，不默认开启 dispatcher；本地和灰度继续通过 `KAFKA_OUTBOX_DISPATCH_ENABLED=false` 降级，真实联调前需用户手动确认 `event_outbox` SQL 已执行且 Kafka broker 可用。
- 第九十批已完成 1 个业务事件接入场景：微信 APP/H5 会员预支付本地快照成功写入 `vip_membership_payment` 后，可按开关写入 `vip.membership.payment.created` outbox 事件，topic 为 `magic.vip-membership.payment`，幂等键为 `vip-membership-payment-created:{outTradeNo}`。接口响应会返回 `paymentSnapshotRecorded`、`outboxEventQueued` 和可选 `outboxEventId`，方便灰度验证。
- 第九十批边界：默认 `KAFKA_OUTBOX_EVENT_WRITE_ENABLED=false`，不影响未建 `event_outbox` 表的本地/灰度环境；开启后 outbox 写入失败会让当前事务失败，避免会员支付快照和事件流不一致。本批不请求微信、不发放会员权益、不执行组织开通 worker、不默认开启 dispatcher。
- 第九十一批已完成 1 个业务事件接入场景：微信支付通知本地更新 `vip_membership_payment` 成功后，可按开关写入 `vip.membership.payment.notified` outbox 事件，topic 仍为 `magic.vip-membership.payment`，幂等键为 `vip-membership-payment-notified:{outTradeNo}`。通知响应会返回 `paymentSnapshotUpdated`、`outboxEventQueued` 和可选 `outboxEventId`，方便灰度核对支付回调落库与事件写入。
- 第九十一批边界：仍不验签、不解密、不请求微信查单、不发放会员权益、不执行组织开通 worker；只有本地支付快照更新命中且能读取到订单归属客户空间时才写事件。默认 `KAFKA_OUTBOX_EVENT_WRITE_ENABLED=false`，未建 outbox 表的环境不受影响。
- 第九十二批已完成 1 个业务事件接入场景：微信会员退款本地申请写入 `vip_membership_refund` 并回读成功后，可按开关写入 `vip.membership.refund.requested` outbox 事件，topic 为 `magic.vip-membership.refund`，幂等键为 `vip-membership-refund-requested:{outRefundNo}`。退款申请响应会返回 `outboxEventQueued` 和可选 `outboxEventId`，方便灰度核对退款申请落库与事件写入。
- 第九十二批边界：仍不请求微信退款、不验签、不解密、不撤销会员权益、不修改组织开通状态、不执行退款对账或权益回滚 worker；只有本地退款申请新建或从 `CREATE_FAILED` 重新置为 `CREATE_PENDING` 后才写事件。默认 `KAFKA_OUTBOX_EVENT_WRITE_ENABLED=false`，未建 outbox 表的环境不受影响。
- 第九十三批已完成 1 个业务事件接入场景：微信退款通知本地更新 `vip_membership_refund` 成功后，可按开关写入 `vip.membership.refund.notified` outbox 事件，topic 仍为 `magic.vip-membership.refund`，幂等键为 `vip-membership-refund-notified:{outRefundNo}`。服务层结果会返回 `refundSnapshotUpdated`、`outboxEventQueued` 和可选 `outboxEventId`，用于灰度核对退款回调落库与事件写入；Controller 仍按微信要求返回原生 `SUCCESS`。
- 第九十三批边界：仍不验签、不解密、不撤销会员权益、不修改组织开通状态、不执行退款对账或权益回滚 worker；只有本地退款快照更新命中且能读取到客户空间时才写事件。默认 `KAFKA_OUTBOX_EVENT_WRITE_ENABLED=false`，未建 outbox 表的环境不受影响。
- 第九十四批已完成 1 个业务事件接入场景：组织空间开通 `failed_manual` 任务在 `execute=true` 且确认串匹配、状态成功重置为 `pending` 后，可按开关写入 `organization.provisioning.requeued` outbox 事件，topic 为 `magic.organization.provisioning`，幂等键为 `organization-provisioning-requeued:{jobId}:{requeuedAt}`。接口响应会返回 `outboxEventQueued` 和可选 `outboxEventId`，方便灰度核对任务重排与事件写入。
- 第九十四批边界：预览模式不写 outbox；本批仍不执行跨租户建库、不初始化目标库菜单/角色/成员、不创建 customer、不消费事件、不启动 XXL-Job worker。默认 `KAFKA_OUTBOX_EVENT_WRITE_ENABLED=false`，未建 outbox 表的环境不受影响。本批同时把 `BusinessOutboxPublisher` 中重复的 JSON 序列化异常处理收敛为私有方法，未改变事件格式。
- 第九十五批已完成 1 个 Kafka outbox 基础设施加固场景：`event_outbox.idempotency_key` 唯一键冲突时，`OutboxRepository.createPendingEvent` 会按幂等键查询并返回已有 `event_id`，避免支付/退款/组织开通回调重放导致已开启 outbox 的业务接口失败。
- 第九十五批边界：只处理重复业务事件的幂等返回，不修改 dispatcher 派发状态机、不新增数据库迁移、不吞掉找不到既有事件的异常；如果唯一键冲突后无法查回原事件，仍重新抛出 `DuplicateKeyException`，暴露异常数据状态。
- 第九十六批已完成 1 个 XXL-Job worker 预检场景：`organizationProvisioningJob` 从占位升级为只读扫描中心库 `tenant_provisioning_job` 中 `pending/failed_retryable` 且 `source_customer_id='public'` 的候选任务，返回 `items/total/readyCount/tableReady/requestedLimit`，并对缺少 `targetCustomerId/targetDbName/sourceOrgId/initiatorCenterUserId` 的任务标记 `ready=false` 和 `blockedReason`。
- 第九十六批边界：本批不加锁、不更新任务状态、不建目标库、不初始化菜单/角色/成员、不消费 Kafka 事件；即使 XXL-Job 参数传 `execute=true`，返回状态也只是 `scan-only` 且 `executionSupported=false`。其它 XXL-Job handler 继续保持原 dry-run/accepted 占位行为。
- 第九十七批已完成 1 个 XXL-Job worker 预检场景：`vipMembershipRefundReconcileJob` 从占位升级为只读扫描中心库 `vip_membership_refund` 中 `next_check_at IS NULL OR next_check_at <= NOW()` 且状态非 `ABNORMAL/CLOSED/SUCCESS` 的候选退款单，返回 `items/total/readyCount/tableReady/requestedLimit`，并对缺少 `outRefundNo/outTradeNo/customerId/centerUserId/amountTotal/refundAmount/status` 的退款单标记 `ready=false` 和 `blockedReason`。
- 第九十七批边界：本批不请求微信退款查询或创建接口、不更新 `vip_membership_refund`、不撤销会员权益、不修改组织开通任务、不消费 Kafka/RabbitMQ；即使 XXL-Job 参数传 `execute=true`，返回状态也只是 `scan-only` 且 `executionSupported=false`。其它 XXL-Job handler 继续保持原 dry-run/accepted 占位行为。
- 第九十八批已完成 1 个微信支付/退款对账执行前置体检场景：`GET /api/wechat/pay/app/config` 对齐旧接口语义，返回 `appId/mchId/configured/missing`，缺微信支付配置时不再直接 500；`vipMembershipRefundReconcileJob` 结果增加 `wechatPayConfigured/wechatPayMissing`，方便真实退款对账执行前先核对环境变量。
- 第九十八批边界：本批只读取环境变量和本地密钥文件是否存在，不读取或返回密钥内容，不发起微信签名请求，不创建微信退款，不更新 `vip_membership_refund`，不消费 Kafka/RabbitMQ。
- 第九十九批已完成 1 个退款对账执行计划预检场景：`vipMembershipRefundReconcileJob` 每个候选退款单会输出 `plannedAction`，其中 `PENDING/PROCESSING` 计划为 `query_wechat_refund`，其它非终态退款计划为 `query_then_create_wechat_refund`；当微信支付配置不完整时，候选项会标记 `ready=false`、`executionBlockedReason=微信支付配置不完整` 并附带 `wechatPayMissing`。
- 第九十九批边界：本批仍不请求微信、不更新退款状态、不撤销会员权益、不写 outbox、不消费 Kafka/RabbitMQ；只是把下一步真实执行的动作计划和阻塞原因显式化。
- 第一百批已完成 1 个微信支付签名材料离线体检场景：`GET /api/wechat/pay/app/config` 返回新增 `signingReady/signingMissing`，会用 JDK 离线解析 `WECHAT_PAY_PRIVATE_KEY` 或 `WECHAT_PAY_PRIVATE_KEY_PATH` 是否为可用 PKCS#8 RSA 私钥，并在配置了微信支付公钥时解析 `WECHAT_PAY_PUBLIC_KEY` 或 `WECHAT_PAY_PUBLIC_KEY_PATH` 是否为可用 X.509 RSA 公钥。
- 第一百批边界：本批不生成 Authorization、不签名任何真实请求、不请求微信、不返回密钥内容、不创建退款、不更新退款状态；只返回 `WECHAT_PAY_PRIVATE_KEY_PARSEABLE`、`WECHAT_PAY_PUBLIC_KEY_PARSEABLE` 等安全的缺失项名称。
- 第一百零一批已完成 1 个微信支付 Authorization 离线生成场景：新增 `WechatPaySigningService`，按微信支付 v3 规则构造签名串 `method/pathWithQuery/timestamp/nonce/body`，使用 `SHA256withRSA` 生成 Authorization 头；新增 `WechatPayPemSupport` 复用 PEM 解析逻辑，避免配置体检和签名生成重复实现。
- 第一百零一批边界：本批不新增 HTTP 路由、不发起微信请求、不提交预下单或退款、不处理响应验签、不写数据库；测试只用本地生成 RSA key 验证签名可被公钥校验，且 Authorization 不包含私钥内容。
- 第一百零二批已完成 1 个微信支付回包/回调签名离线验签场景：新增 `WechatPaySignatureVerificationService`，按微信支付回包/回调规则构造 `timestamp\nnonce\nbody\n` 验签消息，使用 `WECHAT_PAY_PUBLIC_KEY` 或 `WECHAT_PAY_PUBLIC_KEY_PATH` 配置的公钥离线校验签名，并要求请求头序列号匹配 `WECHAT_PAY_PUBLIC_KEY_ID`。
- 第一百零二批边界：本批不拉取微信平台证书、不发起网络请求、不接入 Controller、不验签真实生产回调、不解密 `resource`、不写数据库；测试只用本地 RSA key 验证合法签名、错误签名和序列号不匹配场景。
- 第一百零三批已完成 1 个微信支付通知验签灰度接入场景：`POST /api/wechat/pay/notify` 和 `POST /api/wechat/pay/refund-notify` 在 `WECHAT_PAY_NOTIFY_SIGNATURE_VERIFY_ENABLED=true` 时，会先读取 `Wechatpay-Serial/Timestamp/Nonce/Signature` 头并调用 `WechatPaySignatureVerificationService` 离线验签，验签通过后才继续本地快照更新和 outbox 写入。
- 第一百零三批边界：默认不开启验签，不改变旧本地 ACK 兼容行为；开启后无效签名会在写库前中断并返回微信原生 `FAIL` 结构。本批不拉取微信平台证书、不解密 `resource`、不发起查单/退款外呼、不发放或撤销会员权益。
- 第一百零四批已完成 1 个微信支付回调 `resource` 离线解密场景：新增 `WechatPayNotificationDecryptService`，按微信支付 `AEAD_AES_256_GCM` 规则使用本地 `WECHAT_PAY_API_V3_KEY` 解密 `resource.ciphertext`，返回明文 JSON 和解析后的业务字段。
- 第一百零四批边界：本批不接入 Controller、不改变支付/退款通知写库路径、不验签真实生产回调、不请求微信、不拉平台证书、不发放或撤销会员权益；测试只覆盖本地 AES-GCM 解密、算法拒绝和 API v3 key 长度校验。
- 第一百零五批已完成 1 个微信支付通知 `resource` 解密灰度接入场景：`POST /api/wechat/pay/notify` 和 `POST /api/wechat/pay/refund-notify` 在 `WECHAT_PAY_NOTIFY_RESOURCE_DECRYPT_ENABLED=true` 时，会先调用 `WechatPayNotificationDecryptService` 解密 `resource`，再按现有本地快照和 outbox 逻辑处理解密后的业务字段，响应结果增加 `resourceDecrypted` 便于灰度核对。
- 第一百零五批边界：默认不开启解密，不改变旧明文 mock/body 兼容行为；开启后解密失败会在写库前中断。本批不请求微信、不拉平台证书、不执行查单/退款外呼、不发放或撤销会员权益。
- 第一百零六批已完成 1 个微信支付回调生产开关体检场景：`GET /api/wechat/pay/app/config` 返回新增 `notifyReady/notifyMissing/notifySignatureVerifyEnabled/notifyResourceDecryptEnabled`，用于上线前确认验签开关、解密开关、公钥 ID、公钥可解析性和 32 字节 API v3 key 是否齐全。
- 第一百零六批边界：本批只读取环境变量和本地密钥文件解析状态，不读取或返回密钥内容；不改变支付/退款通知处理逻辑、不请求微信、不拉平台证书、不执行查单/退款外呼、不发放或撤销会员权益。
- 第一百零七批已完成 1 个微信支付退款查询请求离线构造场景：新增 `WechatPayRefundQueryRequestFactory`，复用 `WechatPaySigningService` 构造 `GET /v3/refund/domestic/refunds/{out_refund_no}` 的 path、headers、空 body 和 Authorization，包含 outRefundNo path segment 编码。
- 第一百零七批边界：本批不发起 HTTP 请求、不请求微信、不验签响应、不更新 `vip_membership_refund`、不创建退款、不撤销会员权益；只为后续退款对账 worker 真实执行提供可测试请求材料。
- 第一百零八批已完成 1 个微信支付退款创建请求离线构造场景：新增 `WechatPayRefundCreateRequestFactory`，复用 `WechatPaySigningService` 构造 `POST /v3/refund/domestic/refunds` 的 JSON body、headers 和 Authorization，支持 `transaction_id` 优先、`out_trade_no` 兜底、`out_refund_no`、`amount.refund/total/currency`、可选 `reason/notify_url`。
- 第一百零八批边界：本批不发起 HTTP 请求、不请求微信、不验签响应、不更新 `vip_membership_refund`、不写 outbox、不撤销会员权益；只为后续退款对账 worker 的真实退款创建执行提供可测试请求材料。
- 第一百零九批已完成 1 个微信支付退款响应离线解析场景：新增 `WechatPayRefundResponseMapper`，可解析退款查询/创建响应 JSON 或已反序列化 Map，提取 `out_refund_no/refund_id/out_trade_no/transaction_id/status/success_time/amount`，保留微信原始状态并归一化本地状态。
- 第一百零九批边界：本批不发起 HTTP 请求、不请求微信、不验签响应、不更新 `vip_membership_refund`、不写 outbox、不撤销会员权益；只为后续退款对账 worker 的响应验签后写库提供字段映射和校验。
- 第一百一十批已完成 1 个退款对账 dry-run 请求预览场景：`vipMembershipRefundReconcileJob` 在微信支付配置完整且候选退款单预检通过时，会为 `query_wechat_refund` 输出退款查询请求预览，为 `query_then_create_wechat_refund` 输出退款查询和退款创建两步请求预览。
- 第一百一十批边界：本批只生成脱敏 `requestPreviews`，Authorization 统一返回 `[redacted]`，不返回签名原文，不发起 HTTP 请求，不请求微信，不验签响应，不更新 `vip_membership_refund`，不写 outbox，不撤销会员权益；候选项 `ready=false` 时不会生成请求预览。
- 第一百一十一批已完成 1 个微信支付外部 HTTP 客户端安全门场景：新增 `WechatPayHttpClient`，支持执行退款查询和退款创建请求材料，默认 `WECHAT_PAY_EXTERNAL_HTTP_ENABLED=false` 时直接拒绝，不触发 transport；开启后才会拼接 `WECHAT_PAY_API_BASE_URL` 或默认 `https://api.mch.weixin.qq.com` 发起 `/v3/` 路径请求。
- 第一百一十一批边界：本批不接入 `vipMembershipRefundReconcileJob` 真实执行、不请求生产微信接口、不验签响应、不解析业务响应、不更新 `vip_membership_refund`、不写 outbox、不撤销会员权益；单元测试只使用 fake transport 验证开关、路径限制、响应透传和异常包装。
- 第一百一十二批已完成 1 个微信支付 HTTP 回包验签门面场景：新增 `WechatPayHttpResponseVerificationService`，从 `Wechatpay-Serial/Timestamp/Nonce/Signature` 响应头提取验签材料，复用 `WechatPaySignatureVerificationService` 用本地配置公钥校验 `timestamp\nnonce\nbody\n` 签名消息。
- 第一百一十二批边界：本批不接入 `WechatPayHttpClient` 自动验签、不接入退款对账 worker 真实执行、不请求微信、不拉取平台证书、不解析业务响应、不更新 `vip_membership_refund`、不写 outbox、不撤销会员权益；单元测试只用本地 RSA key 覆盖合法签名、响应头大小写、缺签名头和错误签名。
- 第一百一十三批已完成 1 个微信支付退款远程编排场景：新增 `WechatPayRefundRemoteService`，串联退款查询/创建请求构造、`WechatPayHttpClient`、HTTP 回包验签和 `WechatPayRefundResponseMapper`，返回请求方法、路径、HTTP 状态、验签摘要和解析后的退款响应。
- 第一百一十三批边界：本批不接入 `vipMembershipRefundReconcileJob`，不更新 `vip_membership_refund`，不写 outbox，不撤销会员权益，不默认开启真实外呼；非 2xx 响应会在验签通过后以 `BAD_GATEWAY` 中断，避免错误响应进入业务解析和后续写库链路。
- 第一百一十四批已完成 1 个退款对账 worker 远程只读查单场景：`vipMembershipRefundReconcileJob` 增加 `remoteQuery=true` 显式开关，只有同时传 `execute=true` 时才会对预检通过且微信配置完整的候选退款单调用 `WechatPayRefundRemoteService.queryRefund(outRefundNo)`。
- 第一百一十四批边界：本批只执行微信退款查询，不调用 `createRefund`，不更新 `vip_membership_refund`，不写 outbox，不撤销会员权益；Job 返回值只记录 `remoteQueryStatus` 和脱敏后的 `remoteQueryResult` 摘要，远程失败只落到单条候选项，不中断整批扫描。
- 第一百一十五批已完成 1 个退款对账本地写回预案场景：`vipMembershipRefundReconcileJob` 在远程查单成功后返回 `localWriteBackPreview`，预览下一批可能写入 `vip_membership_refund` 的目标表、where 条件、状态、终态判断、复查策略和后续权益撤销标记。
- 第一百一十五批边界：本批对齐旧端 `SUCCESS/CLOSED/ABNORMAL` 终态、非终态 60 秒后复查、`SUCCESS` 后续撤销权益的规则，但 `writeEnabled=false`，不执行 SQL，不更新退款表，不撤销权益，不写 outbox，不创建退款。
- 第一百一十六批已完成 1 个退款对账本地状态写回场景：新增 `VipMembershipRefundWriteBackService`，`vipMembershipRefundReconcileJob` 只有同时满足 `execute=true`、`remoteQuery=true`、`writeBack=true` 且微信配置完整时，才会把远程查询结果写回 `vip_membership_refund` 快照。
- 第一百一十六批边界：本批只更新 `refund_id/status/success_at/last_checked_at/next_check_at/provider_raw/update_time`，不调用 `createRefund`，不撤销会员权益，不写 outbox，不修改组织开通任务；`SUCCESS` 只标记 `entitlementRevokeRequired=true`、`entitlementRevokeExecuted=false`，后续权益回滚单独批次处理。
- 第一百一十七批已完成 1 个会员权益回滚预览场景：新增 `VipMembershipEntitlementRollbackPreviewService`，`vipMembershipRefundReconcileJob` 支持 `entitlementRollbackPreview=true` 显式开关，在远程退款查询返回 `SUCCESS` 后只读预览支付单、权益流水和会员汇总的后续回滚动作。
- 第一百一十七批边界：本批只输出客户锁定目标、`vip_membership_payment.trade_state=REFUND`、`vip_membership_entitlement.status=refunded/refunded_at/refunded_out_refund_no` 和 `vip_membership` 汇总重算预案，全部 `writeEnabled=false`；不更新支付表、不更新权益表、不同步会员汇总、不写 outbox、不修改组织开通任务，真实权益回滚执行继续单独批次处理。
- 第一百一十八批已完成 1 个会员权益回滚真实执行场景：`VipMembershipEntitlementRollbackPreviewService` 新增 `rollback(...)`，`vipMembershipRefundReconcileJob` 支持 `entitlementRollback=true` 显式开关，在远程退款 `SUCCESS`、本地退款写回成功后，按旧端规则锁定客户、更新支付单、标记权益 refunded 并重算会员汇总。
- 第一百一十八批边界：真实回滚必须同时满足 `execute=true`、`remoteQuery=true`、`writeBack=true`、`entitlementRollback=true`；权益已是 `refunded` 时幂等跳过，状态不是 `active` 或客户空间不一致时失败。仍不调用 `createRefund`，不写 outbox，不修改组织开通任务，不触发 Kafka/RabbitMQ；真实库联调前必须小 limit 灰度。
- 第一百一十九批已完成 1 个组织空间开通 worker 认领场景：`organizationProvisioningJob` 增加 `claim=true` 显式开关，只有同时满足 `execute=true`、`claim=true` 时，才会调用 `OrganizationProvisioningJobClaimService` 抢占候选任务租约。
- 第一百一十九批边界：只把 `pending/failed_retryable` 或 heartbeat 超时的 `provisioning` 任务乐观更新为 `status='provisioning'`、`step='claimed'`，并写入 `lock_owner/locked_at/heartbeat_at/started_at/update_time`、清空 `error_message`；不创建目标租户库、不复制 schema/data、不切换组织成员、不标记 complete/failed、不写 outbox、不消费 Kafka/RabbitMQ。
- 第一百二十批已完成 1 个组织空间开通 worker 执行前预检场景：`organizationProvisioningJob` 增加 `preflight=true` 显式开关，读取已认领的 `status='provisioning'`、`step='claimed'` 任务，输出中心库表状态、发起人状态、source organization、owner 身份、成员切换风险、目标库安全性和后续执行计划。
- 第一百二十批边界：预检只读中心库和配置，不更新 `tenant_provisioning_job`，不心跳，不建库，不复制 schema/data，不初始化菜单/角色/成员，不切换中心用户或 refresh token，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ；下一步真实执行仍必须分批灰度。
- 第一百二十一批已完成 1 个组织空间开通 worker 心跳续租场景：`organizationProvisioningJob` 增加 `heartbeat=true` 显式开关，只有同时满足 `execute=true`、`heartbeat=true`、有效 `jobId` 和 `workerId` 时，才会调用 `OrganizationProvisioningJobHeartbeatService` 刷新任务租约。
- 第一百二十一批边界：心跳只更新 `tenant_provisioning_job.heartbeat_at/update_time`，乐观条件对齐旧 worker 的 `id + lock_owner + status='provisioning'`；不更新 `step`，不建库，不复制 schema/data，不初始化菜单/角色/成员，不切换中心用户或 refresh token，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ。
- 第一百二十二批已完成 1 个组织空间开通 worker 重建库步骤推进场景：`organizationProvisioningJob` 增加 `markRebuildingDatabase=true` 显式开关，只有同时满足 `execute=true`、`markRebuildingDatabase=true`、有效 `jobId` 和 `workerId` 时，才会调用 `OrganizationProvisioningJobStepService` 把任务从 `claimed` 推进到 `rebuilding_database`。
- 第一百二十二批边界：步骤推进只更新 `error_message=NULL`、`heartbeat_at`、`step='rebuilding_database'`、`update_time`，乐观条件为 `id + lock_owner + status='provisioning' + step='claimed'`；不执行 `DROP DATABASE`、`CREATE DATABASE`、schema clone、基础数据复制、组织角色/成员迁移、中心用户切换、complete/failed 状态流转、outbox 写入或 Kafka/RabbitMQ 消费。
- 第一百二十三批已完成 1 个组织空间开通 worker 目标库重建 DDL 计划预检场景：新增 `OrganizationProvisioningDatabaseRebuildPlanService`，`organizationProvisioningJob` 增加 `previewRebuildDatabase=true` 显式开关，只有同时满足 `execute=true`、`previewRebuildDatabase=true`、有效 `jobId` 和 `workerId` 时，才会读取当前 worker 持有的 `status='provisioning'`、`step='rebuilding_database'` 任务并输出目标库重建计划。
- 第一百二十三批边界：预检只校验 `public -> 专属租户`、目标租户和目标库名、中心库/默认租户库/public 库/系统库/默认客户库保护名单、目标 JDBC 配置可解析性；返回 `planStatus=ready|blocked|lease_lost|table_not_ready`、`blockedReasons`、脱敏 JDBC 预览、`executeDdl=false`、`nextExplicitSwitch=executeRebuildDatabase` 和 `DROP/CREATE DATABASE` 的 `ddlPreview`。本批不打开目标库连接，不执行真实 DDL，不推进 step，不复制 schema/data，不迁移组织角色/成员，不切换中心用户，不写 outbox，不消费 Kafka/RabbitMQ。
- 第一百二十四批已完成 1 个组织空间开通 worker 目标库重建 DDL 真实执行场景：新增 `OrganizationProvisioningDatabaseAdminClient` 和 JDBC 实现，`organizationProvisioningJob` 增加 `executeRebuildDatabase=true` 强显式开关，必须同时满足 `execute=true`、有效 `jobId`、`workerId`、`confirmTargetDbName` 与任务 `targetDbName` 完全一致，才会执行目标库 `DROP/CREATE DATABASE`。
- 第一百二十四批边界：执行前复用第 123 批的租约和目标库安全预检；真实执行仅限 `DROP DATABASE IF EXISTS` 与 `CREATE DATABASE ... CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` 两条 DDL，执行后只刷新 `tenant_provisioning_job.heartbeat_at/update_time`。本批不推进 `step=cloning_schema`，不 clone schema，不复制基础数据，不迁移组织角色/成员，不切换中心用户，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ。
- 第一百二十五批已完成 1 个组织空间开通 worker schema clone 步骤推进场景：`organizationProvisioningJob` 增加 `markCloningSchema=true` 显式开关，必须同时满足 `execute=true`、有效 `jobId` 和 `workerId`，才会调用 `OrganizationProvisioningJobStepService` 把任务从 `rebuilding_database` 推进到 `cloning_schema`。
- 第一百二十五批边界：步骤推进只更新 `error_message=NULL`、`heartbeat_at`、`step='cloning_schema'`、`update_time`，乐观条件为 `id + lock_owner + status='provisioning' + step='rebuilding_database'`；不执行 `SHOW CREATE TABLE`，不建表，不复制索引，不复制基础数据，不迁移组织角色/成员，不切换中心用户，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ。XXL-Job 灰度参数示例：`customerId=default;execute=true;markCloningSchema=true;jobId=31;workerId=springboot-gray-1`。
- 第一百二十六批已完成 1 个组织空间开通 worker schema clone 建表计划预览场景：新增 `OrganizationProvisioningSchemaMetadataClient`、JDBC 实现和 `OrganizationProvisioningSchemaClonePlanService`，`organizationProvisioningJob` 增加 `previewSchemaClone=true` 显式开关，必须同时满足 `execute=true`、有效 `jobId` 和 `workerId`，才会读取当前 worker 持有的 `status='provisioning'`、`step='cloning_schema'` 任务。
- 第一百二十六批边界：预览只连接 public 模板库读取基础表列表和 `SHOW CREATE TABLE`，按旧 worker 规则改写为 `CREATE TABLE IF NOT EXISTS \`tableName\``并移除表级`AUTO_INCREMENT=数字`；返回 `schemaCloneStatus`、`tablePlans`、`previewedTableCount`、`totalBaseTableCount`、`limited`、脱敏模板/目标 JDBC 预览、`executeDdl=false`、`targetDdlExecuted=false`、`nextExplicitSwitch=executeSchemaClone`。本批不连接目标库，不执行 `SET FOREIGN_KEY_CHECKS`，不执行建表，不刷新 heartbeat，不推进 `step=seeding_base_data`，不复制基础数据，不迁移组织角色/成员，不切换中心用户，不写 outbox，不消费 Kafka/RabbitMQ。XXL-Job 灰度参数示例：`customerId=default;execute=true;previewSchemaClone=true;jobId=31;workerId=springboot-gray-1;schemaTableLimit=20`。
- 第一百二十七批已完成 1 个组织空间开通 worker schema clone 建表真实执行场景：新增 `OrganizationProvisioningSchemaDdlClient` 和 JDBC 实现，`organizationProvisioningJob` 增加 `executeSchemaClone=true` 强显式开关，必须同时满足 `execute=true`、有效 `jobId`、`workerId`、`confirmTargetDbName` 与任务 `targetDbName` 完全一致，才会执行目标库建表。
- 第一百二十七批边界：执行前复用第 126 批预览计划，任务必须仍由当前 worker 持有且处于 `status='provisioning'`、`step='cloning_schema'`；如果 `schemaTableLimit` 小于基础表总数会拒绝执行，避免目标库部分建表。真实执行仅限目标库 `SET FOREIGN_KEY_CHECKS = 0`、全部 `CREATE TABLE IF NOT EXISTS ...`、`SET FOREIGN_KEY_CHECKS = 1`，并在每张表建完后刷新 `tenant_provisioning_job.heartbeat_at/update_time`，租约丢失会中断。本批不推进 `step=seeding_base_data`，不复制基础数据，不迁移组织角色/成员，不切换中心用户，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ。XXL-Job 灰度参数示例：`customerId=default;execute=true;executeSchemaClone=true;jobId=31;workerId=springboot-gray-1;confirmTargetDbName=tenant_org001;schemaTableLimit=200`。
- 第一百二十八批已完成 1 个组织空间开通 worker 基础数据复制步骤推进场景：`OrganizationProvisioningJobStepService` 增加 `markSeedingBaseData(...)`，`organizationProvisioningJob` 增加 `markSeedingBaseData=true` 显式开关，必须同时满足 `execute=true`、有效 `jobId` 和 `workerId`，才会把任务从 `cloning_schema` 推进到 `seeding_base_data`。
- 第一百二十八批边界：步骤推进只更新 `error_message=NULL`、`heartbeat_at`、`step='seeding_base_data'`、`update_time`，乐观条件为 `id + lock_owner + status='provisioning' + step='cloning_schema'`；不复制 Super 权限闭包，不复制 `app_versions` 等基础表，不复制菜单/角色/成员，不开启目标库事务迁移，不切换中心用户，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ。XXL-Job 灰度参数示例：`customerId=default;execute=true;markSeedingBaseData=true;jobId=31;workerId=springboot-gray-1`。
- 第一百二十九批已完成 1 个组织空间开通 worker Super 权限闭包复制预览场景：新增 `OrganizationProvisioningSuperPermissionClosurePreviewClient`、JDBC 实现和 `OrganizationProvisioningSuperPermissionClosurePlanService`，`organizationProvisioningJob` 增加 `previewSuperPermissionClosure=true` 显式开关，必须同时满足 `execute=true`、有效 `jobId` 和 `workerId`，才会读取当前 worker 持有的 `status='provisioning'`、`step='seeding_base_data'` 任务。
- 第一百二十九批边界：预览只读中心库任务、public 模板库和目标租户库，检查 `role/menu/menu_meta/code/role_menu/role_code` 表是否齐全，并统计源库 Super 角色、菜单、菜单元数据、权限码、`role_menu`、`role_code` 行数及目标库现状；返回 `superPermissionClosureStatus=ready|blocked|lease_lost|table_not_ready`、`executeCopy=false`、`targetWriteExecuted=false`、`missingSourceTables`、`missingTargetTables`、`sourceSuperClosure`、`targetSuperClosure`、`targetAlreadyHasSuper`、`plannedCopyTables` 和 `nextExplicitSwitch=executeSuperPermissionClosure`。本批不复制 `menu/menu_meta/role/code/role_menu/role_code`，不刷新 heartbeat，不推进 step，不复制基础表，不迁移组织角色/成员，不切换中心用户，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ。XXL-Job 灰度参数示例：`customerId=default;execute=true;previewSuperPermissionClosure=true;jobId=31;workerId=springboot-gray-1`。
- 第一百三十批已完成 1 个组织空间开通 worker Super 权限闭包真实复制场景：新增 `OrganizationProvisioningSuperPermissionClosureCopyClient` 和 JDBC 实现，`organizationProvisioningJob` 增加 `executeSuperPermissionClosure=true` 强显式开关，必须同时满足 `execute=true`、有效 `jobId`、`workerId`、`confirmTargetDbName` 与任务 `targetDbName` 完全一致，才会执行复制。
- 第一百三十批边界：执行前复用第 129 批预览安全门，任务必须仍由当前 worker 持有且处于 `status='provisioning'`、`step='seeding_base_data'`；真实执行仅限目标租户库 `SET FOREIGN_KEY_CHECKS = 0`、按旧 worker 顺序复制 `menu -> menu_meta -> role(Super,parent_id=null) -> code(按 Super role_code 的 code_id) -> role_menu -> role_code`、`SET FOREIGN_KEY_CHECKS = 1`，复制使用源/目标表交集列和 `ON DUPLICATE KEY UPDATE` 保持幂等覆盖，并在每个复制阶段后刷新 `tenant_provisioning_job.heartbeat_at/update_time`，租约丢失会中断。本批不推进 step，不复制 `app_versions` 等基础表，不迁移组织角色/成员，不切换中心用户，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ；成功后的下一显式开关为 `executeBaseDataTables`。XXL-Job 灰度参数示例：`customerId=default;execute=true;executeSuperPermissionClosure=true;jobId=31;workerId=springboot-gray-1;confirmTargetDbName=tenant_org001`。
- 第一百三十一批已完成 1 个组织空间开通 worker 基础数据复制预览场景：新增 `OrganizationProvisioningBaseDataCopyPreviewClient`、JDBC 实现和 `OrganizationProvisioningBaseDataCopyPlanService`，`organizationProvisioningJob` 增加 `previewBaseDataTables=true` 显式开关，必须同时满足 `execute=true`、有效 `jobId` 和 `workerId`，才会读取当前 worker 持有的 `status='provisioning'`、`step='seeding_base_data'` 任务。
- 第一百三十一批边界：当前基础数据复制范围只包含 `app_versions`；预览只读中心库任务、public 模板库和目标租户库，检查源/目标 `app_versions` 表是否存在，并统计源库待复制行数和目标库现有行数；返回 `baseDataCopyStatus=ready|blocked|lease_lost|table_not_ready`、`executeCopy=false`、`targetWriteExecuted=false`、`plannedCopyTables=["app_versions"]`、`missingSourceTables`、`missingTargetTables`、`tablePlans`、脱敏源/目标 JDBC 预览和 `nextExplicitSwitch=executeBaseDataTables`。本批不复制 `app_versions`，不刷新 heartbeat，不推进 step，不迁移组织角色/成员，不切换中心用户，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ。XXL-Job 灰度参数示例：`customerId=default;execute=true;previewBaseDataTables=true;jobId=31;workerId=springboot-gray-1`。
- 第一百三十二批已完成 1 个组织空间开通 worker 基础数据真实复制场景：新增 `OrganizationProvisioningBaseDataCopyClient` 和 JDBC 实现，`organizationProvisioningJob` 增加 `executeBaseDataTables=true` 强显式开关，必须同时满足 `execute=true`、有效 `jobId`、`workerId`、`confirmTargetDbName` 与任务 `targetDbName` 完全一致，才会执行复制。
- 第一百三十二批边界：执行前复用第 131 批预览安全门，任务必须仍由当前 worker 持有且处于 `status='provisioning'`、`step='seeding_base_data'`；当前仅复制 `app_versions`，按源/目标交集列读取并使用 `INSERT ... ON DUPLICATE KEY UPDATE` 或 `INSERT IGNORE` 幂等写入目标库，每个 chunk 写入后刷新 `tenant_provisioning_job.heartbeat_at/update_time`，租约丢失会中断。本批不推进 step，不迁移组织角色/成员，不切换中心用户，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ；成功后的下一显式开关为 `migrateOrganizationRolesAndMembers`。XXL-Job 灰度参数示例：`customerId=default;execute=true;executeBaseDataTables=true;jobId=31;workerId=springboot-gray-1;confirmTargetDbName=tenant_org001`。
- 第一百三十三批已完成 1 个组织空间开通 worker 组织角色/成员迁移预览场景：新增 `OrganizationProvisioningRoleMemberMigrationPreviewClient`、JDBC 实现和 `OrganizationProvisioningRoleMemberMigrationPlanService`，`organizationProvisioningJob` 增加 `migrateOrganizationRolesAndMembers=true` 显式开关。
- 第一百三十三批边界：当前 `migrateOrganizationRolesAndMembers=true` 仍是 preview-only，必须同时满足 `execute=true`、有效 `jobId` 和 `workerId`，才会读取当前 worker 持有的 `status='provisioning'`、`step='seeding_base_data'` 任务；预览只读中心库、源租户库和目标租户库，检查中心表、源库 `role/role_code/role_park/user/user_role`、目标库 `role/code/park/role_menu/role_park/role_code/user/user_role/user_code`，并校验组织角色树、active 成员、中心用户状态、source 用户解析和普通成员组织角色绑定。返回 `roleMemberMigrationStatus=ready|blocked|lease_lost|table_not_ready`、`executeMigration=false`、`migrationPreviewOnly=true`、`targetWriteExecuted=false`、`roleSnapshotPlan`、`sourceUserPlans`、`centerMemberPlans`、脱敏源/目标 JDBC 信息和 `nextExplicitSwitch=executeOrganizationRolesAndMembers`。本批不执行目标库事务，不复制角色/权限/园区，不创建目标用户，不写 `tenant_provisioning_role_snapshot`，不刷新 heartbeat，不推进 step，不切换中心用户，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ。XXL-Job 灰度参数示例：`customerId=default;execute=true;migrateOrganizationRolesAndMembers=true;jobId=31;workerId=springboot-gray-1`。
- 第一百三十四批已完成 1 个组织空间开通 worker 组织角色快照真实复制场景：新增 `OrganizationProvisioningRoleSnapshotCopyClient`、JDBC 实现，`OrganizationProvisioningRoleMemberMigrationPlanService` 增加 `executeOrganizationRolesAndMembers(...)`，`organizationProvisioningJob` 增加 `executeOrganizationRolesAndMembers=true` 强显式开关。
- 第一百三十四批边界：执行前复用第 133 批预览安全门，任务必须仍由当前 worker 持有且处于 `status='provisioning'`、`step='seeding_base_data'`；必须额外传 `confirmTargetDbName` 且与任务 `targetDbName` 完全一致。真实执行仅限目标租户库事务内按旧 worker 顺序复制 `role -> code -> park -> role_menu -> role_park -> role_code`，其中 `role.organization_id=null`、`role.scope='system'`，复制使用源/目标表交集列和 `ON DUPLICATE KEY UPDATE` 保持幂等，并在每个 chunk 后刷新 `tenant_provisioning_job.heartbeat_at/update_time`，租约丢失会中断。返回 `roleMemberMigrationStatus=success|blocked|lease_lost|table_not_ready`、`executeMigration=true`、`migrationPreviewOnly=false`、`roleSnapshotCopied=true`、`organizationMembersMigrated=false`、`targetWriteExecuted=true`、`copiedTables`、`copyResult` 和 `nextExplicitSwitch=executeOrganizationMembers`。虽然开关名包含 members，本批不创建目标用户，不写 `user_role/user_code`，不迁移用户范围数据，不写 `tenant_provisioning_role_snapshot`，不推进 step，不切换中心用户，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ。XXL-Job 灰度参数示例：`customerId=default;execute=true;executeOrganizationRolesAndMembers=true;jobId=31;workerId=springboot-gray-1;confirmTargetDbName=tenant_org001`。
- 第一百三十五批已完成 1 个组织空间开通 worker 组织成员真实迁移场景：新增 `OrganizationProvisioningMemberMigrationClient`、JDBC 实现，`OrganizationProvisioningRoleMemberMigrationPlanService` 增加 `executeOrganizationMembers(...)`，`organizationProvisioningJob` 增加 `executeOrganizationMembers=true` 强显式开关。
- 第一百三十五批边界：执行前复用第 133 批预览安全门，任务必须仍由当前 worker 持有且处于 `status='provisioning'`、`step='seeding_base_data'`；必须额外传 `confirmTargetDbName` 且与任务 `targetDbName` 完全一致。真实执行仅限目标租户库事务内按旧 worker 语义创建/更新目标 `user`，按 owner/Super 或普通成员源组织角色重建 `user_role`，并从目标库 `role_code -> code` 反查权限编码重建 `user_code`；每处理一个成员后刷新 `tenant_provisioning_job.heartbeat_at/update_time`，租约丢失会中断。返回 `roleMemberMigrationStatus=success|blocked|lease_lost|table_not_ready`、`executeMigration=true`、`migrationPreviewOnly=false`、`memberMigrationExecuted=true`、`organizationMembersMigrated=true`、`targetUsersUpserted`、`userRoleRowsInserted`、`userCodeRowsInserted`、`targetWriteExecuted=true` 和 `nextExplicitSwitch=executeOrganizationUserScopedData`。本批不迁移用户范围业务表，不写 `tenant_provisioning_role_snapshot`，不推进 step，不切换中心用户，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ。XXL-Job 灰度参数示例：`customerId=default;execute=true;executeOrganizationMembers=true;jobId=31;workerId=springboot-gray-1;confirmTargetDbName=tenant_org001`。
- 第一百三十六批已完成 1 个组织空间开通 worker 用户范围业务数据真实迁移场景：新增 `OrganizationProvisioningUserScopedDataMigrationClient`、JDBC 实现，`OrganizationProvisioningRoleMemberMigrationPlanService` 增加 `executeOrganizationUserScopedData(...)`，`organizationProvisioningJob` 增加 `executeOrganizationUserScopedData=true` 强显式开关。
- 第一百三十六批边界：执行前复用第 133 批预览安全门，任务必须仍由当前 worker 持有且处于 `status='provisioning'`、`step='seeding_base_data'`；必须额外传 `confirmTargetDbName` 且与任务 `targetDbName` 完全一致。真实执行仅限目标租户库事务内按旧 worker `migrateUserScopedData(...)` 语义分页复制 `localization/attendances/feedback/leave_application/reimbursement/investment`，并按页补复制依赖 `park/image/reimbursement_image/investment_image`；复制使用源/目标表交集列和 `ON DUPLICATE KEY UPDATE` 保持幂等，每个写入 chunk 后刷新 `tenant_provisioning_job.heartbeat_at/update_time`，租约丢失会中断。`user_id/customer_id/center_user_id/audit_user_id` 字段替换对齐旧 worker，`investment` 继续按用户名/手机号筛选并原样复制。返回 `roleMemberMigrationStatus=success|blocked|lease_lost|table_not_ready`、`executeMigration=true`、`migrationPreviewOnly=false`、`userScopedDataMigrationExecuted=true`、`userScopedDataMigrated=true`、`userScopedRowsCopied`、`userScopedCopiedChunks`、`targetWriteExecuted=true` 和 `nextExplicitSwitch=writeTenantProvisioningRoleSnapshot`。本批不创建目标用户，不重建 `user_role/user_code`，不写 `tenant_provisioning_role_snapshot`，不推进 step，不切换中心用户，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ。XXL-Job 灰度参数示例：`customerId=default;execute=true;executeOrganizationUserScopedData=true;jobId=31;workerId=springboot-gray-1;confirmTargetDbName=tenant_org001`。
- 第一百三十七批已完成 1 个组织空间开通 worker 中心库角色快照写入场景：新增 `OrganizationProvisioningRoleSnapshotCenterWriteClient`、JDBC 实现，`OrganizationProvisioningRoleMemberMigrationPlanService` 增加 `writeTenantProvisioningRoleSnapshot(...)`，`organizationProvisioningJob` 增加 `writeTenantProvisioningRoleSnapshot=true` 强显式开关。
- 第一百三十七批边界：执行前复用第 133 批预览安全门，任务必须仍由当前 worker 持有且处于 `status='provisioning'`、`step='seeding_base_data'`；必须额外传 `confirmTargetDbName` 且与任务 `targetDbName` 完全一致，并单独检查中心库 `tenant_provisioning_role_snapshot` 表存在。真实执行仅限中心库事务内按旧 worker `saveOrganizationProvisioningRoleSnapshots(...)` 语义先 `DELETE FROM tenant_provisioning_role_snapshot WHERE job_id = ?`，再插入当前组织角色快照 `job_id/source_org_id/source_role_id/target_role_id/role_name/create_time/update_time`；写入后在同一事务内刷新 `tenant_provisioning_job.heartbeat_at/update_time`，租约丢失会回滚并中断。返回 `roleMemberMigrationStatus=success|blocked|lease_lost|table_not_ready`、`executeMigration=true`、`migrationPreviewOnly=false`、`centerWriteExecuted=true`、`roleSnapshotCenterWriteExecuted=true`、`tenantProvisioningRoleSnapshotWritten=true`、`roleSnapshotRowsDeleted`、`roleSnapshotRowsInserted`、`targetWriteExecuted=false` 和 `nextExplicitSwitch=switchCenterUserToTarget`。本批不写目标租户库，不切换中心用户，不推进 step，不标记 complete/failed，不写 outbox，不消费 Kafka/RabbitMQ。XXL-Job 灰度参数示例：`customerId=default;execute=true;writeTenantProvisioningRoleSnapshot=true;jobId=31;workerId=springboot-gray-1;confirmTargetDbName=tenant_org001`。
- 第一百三十八批已完成 1 个组织空间开通 worker 中心用户租户切换场景：新增 `OrganizationProvisioningCenterUserSwitchClient`、JDBC 实现，`OrganizationProvisioningRoleMemberMigrationPlanService` 增加 `switchCenterUserToTarget(...)`，`organizationProvisioningJob` 增加 `switchCenterUserToTarget=true` 强显式开关。
- 第一百三十八批边界：执行前复用第 133 批预览安全门，任务必须仍由当前 worker 持有且处于 `status='provisioning'`、`step='seeding_base_data'`；必须额外传 `confirmTargetDbName` 且与任务 `targetDbName` 完全一致，并要求当前 job 已经写入 `tenant_provisioning_role_snapshot`。真实执行仅限中心库事务内按旧 worker `switchCenterUserToTarget(...)` 的完成前语义写 `customer/user_tenant_mapping/user.customer_type/user.token_version/refresh_token/organization_tenant_mapping`，目标租户库只用于按中心用户名确认目标 `user.id`；写入后刷新 `tenant_provisioning_job.heartbeat_at/update_time`，租约丢失会回滚并中断。返回 `roleMemberMigrationStatus=success|blocked|lease_lost|table_not_ready`、`executeMigration=true`、`migrationPreviewOnly=false`、`centerSwitchExecuted=true`、`centerUsersSwitched`、`customerRowsAffected`、`userTenantMappingRowsAffected`、`refreshTokenRowsRevoked`、`organizationTenantMappingRowsAffected`、`targetWriteExecuted=false`、`tenantProvisioningCompleted=false` 和 `nextExplicitSwitch=completeTenantProvisioningJob`。本批不写目标租户库，不创建目标用户，不重建 `user_role/user_code`，不迁移用户范围业务表，不推进 step，不标记 complete/failed，不写 outbox，不发布或消费 Kafka/RabbitMQ。XXL-Job 灰度参数示例：`customerId=default;execute=true;switchCenterUserToTarget=true;jobId=31;workerId=springboot-gray-1;confirmTargetDbName=tenant_org001`。
- 第一百三十九批已完成 1 个组织空间开通 worker 完成状态收口场景：新增 `OrganizationProvisioningJobCompletionService`，`organizationProvisioningJob` 增加 `completeTenantProvisioningJob=true` 强显式开关，并扩展 `BusinessOutboxPublisher.publishOrganizationProvisioningCompleted(...)`。
- 第一百三十九批边界：执行前检查中心库 `tenant_provisioning_job/organization_member/organization_tenant_mapping/user_tenant_mapping` 表存在，任务必须仍由当前 worker 持有且处于 `status='provisioning'`、`step='seeding_base_data'`；必须额外传 `confirmTargetDbName` 且与任务 `targetDbName` 完全一致，并确认 `organization_tenant_mapping` 指向当前 job、所有 active 成员已有目标 `user_tenant_mapping.customer_user_id`。真实执行仅更新中心库 `tenant_provisioning_job` 为 `completed_at=now`、`error_message/heartbeat_at/locked_at/lock_owner=NULL`、`status='active'`、`step='completed'`、`update_time=now`，乐观条件为 `id + lock_owner + status='provisioning' + step='seeding_base_data'`。开启 `KAFKA_OUTBOX_EVENT_WRITE_ENABLED=true` 后写入 `organization.provisioning.completed` outbox 事件，topic 为 `magic.organization.provisioning`，幂等键为 `organization-provisioning-completed:{jobId}`；默认关闭时不写 outbox。返回 `completionStatus=success|blocked|lease_lost|table_not_ready`、`tenantProvisioningCompleted`、`updatedRows`、`outboxEventQueued`、可选 `outboxEventId`、`status=active` 和 `step=completed`。本批不执行 failed/failed_retryable/failed_manual 标记，不写目标租户库，不创建或切换中心用户，不直接发布 Kafka，不消费 Kafka/RabbitMQ，不发送通知。XXL-Job 灰度参数示例：`customerId=default;execute=true;completeTenantProvisioningJob=true;jobId=31;workerId=springboot-gray-1;confirmTargetDbName=tenant_org001`。
- 第一百四十批已完成 1 个组织空间开通 worker 失败状态收口场景：新增 `OrganizationProvisioningJobFailureService`，`organizationProvisioningJob` 增加 `markTenantProvisioningJobFailed=true` 强显式开关。
- 第一百四十批边界：执行前只检查中心库 `tenant_provisioning_job` 表存在，任务必须仍由当前 worker 持有且处于 `status='provisioning'`；必须额外传非空 `failureReason`，`maxRetry` 可选且默认 5。真实执行按旧 worker `markJobFailed(...)` 语义写中心库：`retry_count = retry_count + 1`、`error_message=failureReason`、`heartbeat_at/locked_at/lock_owner=NULL`、`update_time=now`；当新 retryCount 小于 `maxRetry` 时置 `status='failed_retryable'`、`step='retry_waiting'`，达到或超过时置 `status='failed_manual'`、`step='failed'`。返回 `failureStatus=success|lease_lost|table_not_ready`、`tenantProvisioningFailed`、`failedManual`、`retryable`、`retryCount`、`targetStatus`、`targetStep` 和 `updatedRows`。本批不写 outbox，不直接发布 Kafka，不消费 Kafka/RabbitMQ，不执行目标库补偿，不删除已创建的目标库、schema 或中心映射；失败后的人工重排继续走已有 `requeue-failed-manual` 入口。XXL-Job 灰度参数示例：`customerId=default;execute=true;markTenantProvisioningJobFailed=true;jobId=31;workerId=springboot-gray-1;failureReason=copy failed;maxRetry=5`。
- 第一百四十一批已完成 1 个组织空间开通完成事件 Kafka 消费入口场景：新增 `EventConsumeLogRepository`、`OrganizationProvisioningCompletedConsumerService` 和 `OrganizationProvisioningCompletedKafkaListener`，并补充 `KAFKA_CONSUMER_ENABLED` 默认关闭开关。
- 第一百四十一批边界：listener 只监听 `magic.organization.provisioning` 中的 `organization.provisioning.completed`，从 headers 读取 `eventId/eventType/customerId/idempotencyKey`，解析 payload 中的 `jobId/targetCustomerId/targetDbName`，写中心库 `event_consume_log`；同一 `eventId + consumerGroup` 通过唯一键幂等跳过。缺关键 header 不写库，payload 解析失败或缺少关键字段时写 `status=failed` 消费日志。本批不发送通知、不刷新 Redis 缓存、不发布 RabbitMQ、不修改组织开通任务、不写目标租户库。
- 第一百四十二批已完成 1 个组织空间开通完成事件 RabbitMQ followup 场景：新增 `OrganizationProvisioningCompletedFollowupPublisher`，消费服务改为先 `processing` 认领、投递 RabbitMQ light-task 后再 `success` 落表。
- 第一百四十二批边界：RabbitMQ 轻任务进入 `magic.light-task.queue`，任务类型 `organization.provisioning.completed.followup`，幂等键 `organization-provisioning-completed-followup:{jobId}`，投递前要求 header `customerId` 与 payload `targetCustomerId` 一致。投递失败会把消费日志标记为 `failed` 并抛出异常，等待 Kafka 重试；历史 `failed` 允许重新认领。本批不直接发送通知、不刷新 Redis 缓存、不修改组织开通任务、不写目标租户库。
- 第一百四十三批已完成 1 个组织空间开通完成 RabbitMQ followup 消费骨架场景：新增 `OrganizationProvisioningCompletedFollowupConsumerService` 和 `OrganizationProvisioningCompletedFollowupRabbitListener`，并补充 `RABBITMQ_CONSUMER_ENABLED` 默认关闭开关。
- 第一百四十三批边界：listener 只处理 `magic.light-task.queue` 中 `taskType=organization.provisioning.completed.followup` 的轻任务，其它 light-task 跳过。消费服务只解析 `jobId/targetCustomerId/targetDbName` 并写 `event_consume_log` 成功/失败幂等记录，consumerGroup 为 `rabbit-light-task-organization-provisioning-followup`。本批不直接发送通知、不刷新 Redis 缓存、不修改组织开通任务、不写目标租户库。
- 第一百四十四批已完成 1 个组织空间开通完成 RabbitMQ followup 通知计划预览场景：新增 `OrganizationProvisioningCompletedNotificationPlanService`，followup 消费成功结果新增 `notificationPlan/notificationPlanGenerated`。
- 第一百四十四批边界：首次 followup 消费写入 `event_consume_log.status=success` 后只生成 preview-only 通知计划，计划包含 `in_app/wechat_work/sms` 渠道、`magic.notification.queue` 队列、幂等键 `organization-provisioning-completed-notification:{jobId}` 和下一步显式开关 `publishOrganizationProvisioningCompletedNotification`；重复消息不重复生成计划。本批不调用 `RabbitMessagePublisher.publishNotification(...)`，不解析真实收件人，不发送短信/企微/站内通知，不刷新 Redis 缓存，不修改组织开通任务，不写目标租户库。
- 第一百四十五批已完成 1 个组织空间开通完成 RabbitMQ followup Redis 刷新计划预览场景：新增 `OrganizationProvisioningCompletedRedisRefreshPlanService`，followup 消费成功结果新增 `redisRefreshPlan/redisRefreshPlanGenerated`。
- 第一百四十五批边界：首次 followup 消费写入 `event_consume_log.status=success` 后同时生成通知计划和 Redis 刷新计划。Redis 计划只列出当前 Spring Boot 已使用的 `tenant:{targetCustomerId}:route-menus:`、`system-menu-list:`、`parent-role-menus:`、`permission-codes:`、`user-info:` 缓存前缀，幂等键为 `organization-provisioning-completed-redis-refresh:{jobId}`，下一步显式开关为 `refreshOrganizationProvisioningCompletedCaches`；重复消息不重复生成计划。本批不注入 `CacheService`，不调用 `CacheService.evictByPrefix(...)`，不执行 Redis `keys/delete`，不发送通知，不修改组织开通任务，不写目标租户库。
- 第一百四十六批已完成 1 个组织空间开通完成通知投递前置安全门场景：`AppProperties.RabbitMq` 新增 `notificationPublishEnabled`，配置项 `RABBITMQ_NOTIFICATION_PUBLISH_ENABLED` 默认关闭；通知计划新增 `rabbitNotificationPublishRequested/rabbitNotificationPublishExecuted` 和安全门阻断原因。
- 第一百四十六批边界：安全门关闭时计划显示 `rabbitNotificationPublishEnabled=false` 和 `blockedReasons=RABBITMQ_NOTIFICATION_PUBLISH_ENABLED 未开启`；安全门开启时也只显示环境允许进入后续真实投递批次，仍固定 `rabbitNotificationPublishRequested=false`、`rabbitNotificationPublishExecuted=false`、`sendEnabled=false`、`providerCallEnabled=false`。本批不注入 `RabbitMessagePublisher`，不调用 `publishNotification(...)`，不投递 `magic.notification.queue`，不解析真实收件人，不发送短信/企微/站内通知，不刷新 Redis，不修改组织开通任务，不写目标租户库。
- 第一百四十七批已完成 1 个组织空间开通完成通知消息 dry-run 预览场景：`OrganizationProvisioningCompletedNotificationPlanService` 新增 `rabbitMessagePreview`，按 `RabbitMessageRequest` 关键字段生成 `aggregateId/aggregateType/customerId/headers/idempotencyKey/messageId/payload/routingKey/targetExchange/targetQueue` 预览；计划新增 `rabbitNotificationDryRun=true` 和 `rabbitMessagePreviewGenerated=true`。
- 第一百四十七批边界：消息预览 payload 只包含 `jobId/targetCustomerId/targetDbName/templateKey/channels/recipientResolution/providerCallEnabled=false`，真实收件人继续延后到发送批次解析；消息预览固定 `publishExecuted=false`。本批不创建 `RabbitMessageRequest` 实例，不注入 `RabbitMessagePublisher`，不调用 `publishNotification(...)`，不投递 RabbitMQ，不发送短信/企微/站内通知，不刷新 Redis，不修改组织开通任务，不写目标租户库。
- 第一百四十八批已完成 1 个组织空间开通完成 followup 通知队列投递场景：新增 `OrganizationProvisioningCompletedNotificationPublisher`，把通知计划中的 `rabbitMessagePreview` 转成 `RabbitMessageRequest` 并调用 `RabbitMessagePublisher.publishNotification(...)`。
- 第一百四十八批边界：followup 消费改为 `claimProcessing -> buildPlan -> publish/skip -> markSuccess`；计划生成、Redis 计划生成、通知投递或成功落表任一阶段异常，都会先 `markFailure` 再抛出，交给 RabbitMQ/Kafka 重试链路。只有 `RABBITMQ_NOTIFICATION_PUBLISH_ENABLED=true` 且首次认领成功时才投递 `magic.notification.queue`，成功后返回 `notificationMessagePublished=true`、`notificationMessageId`、`rabbitNotificationPublishRequested=true`、`rabbitNotificationPublishExecuted=true`，并把 `rabbitMessagePreview.publishExecuted=true`。本批只投递 RabbitMQ notification 队列，不解析真实收件人，不调用短信/企微/站内通知 provider，不刷新 Redis，不修改组织开通任务，不写目标租户库。
- 第一百四十九批已完成 1 个组织空间开通完成 followup Redis 刷新执行安全门场景：`AppProperties.Redis` 新增 `organizationProvisioningRefreshEnabled`，配置项 `REDIS_ORGANIZATION_PROVISIONING_REFRESH_ENABLED` 默认关闭；新增 `OrganizationProvisioningCompletedRedisRefreshExecutor`。
- 第一百四十九批边界：Redis 计划关闭时仍只预览，开启时只允许通过 `CacheService.evictByPrefix(...)` 清理计划里的 5 个限定缓存前缀：`route-menus`、`system-menu-list`、`parent-role-menus`、`permission-codes`、`user-info`。followup 首次认领成功后先执行 Redis 清理，再进入 RabbitMQ notification 投递；成功后 `redisRefreshPlan` 返回 `planStatus=cache_evicted`、`cacheEvictRequested=true`、`cacheEvictExecuted=true` 和 `cacheEvictPrefixCount`。本批不直接调用 `RedisTemplate`，不写 Redis 缓存，不调用短信/企微/站内通知 provider，不修改组织开通任务，不写目标租户库。
- 第一百五十批已完成 1 个组织空间开通完成 notification 消费骨架场景：新增 `OrganizationProvisioningCompletedNotificationConsumerService`、`OrganizationProvisioningCompletedNotificationRabbitListener`、notification 消费 request/result，并新增独立开关 `RABBITMQ_ORGANIZATION_PROVISIONING_NOTIFICATION_CONSUMER_ENABLED` 默认关闭。
- 第一百五十批边界：`magic.notification.queue` 是共享通知队列，当前同时承载登录验证码、合同提醒、催缴短信和组织开通完成通知；组织开通 notification listener 不复用 `RABBITMQ_CONSUMER_ENABLED`，必须单独灰度开启。消费服务只校验 `eventType/templateKey`、header 幂等键和 payload 中的 `jobId/targetCustomerId/targetDbName`，并写 `event_consume_log` 幂等日志；收到其它通知类型时 listener 抛错进入 RabbitMQ 重试/DLQ 路径，不静默确认。本批不解析真实收件人，不调用短信/企微/站内通知 provider，不投递 retry，不修改组织开通任务，不写目标租户库。
- 第一百五十一批已完成 1 个组织空间开通完成 notification 收件人解析预览场景：新增 `OrganizationProvisioningCompletedNotificationRecipientPlanService`，消费服务在 payload 校验通过且 `providerCallEnabled=false` 后，把中心库只读解析结果写入 `sendPlan.recipientPlan`。
- 第一百五十一批边界：收件人解析只读取中心库 `tenant_provisioning_job/organization_member/user`，按 job 找 `sourceOrgId/sourceCustomerId`，再解析 active 组织成员和 active 中心账号；返回脱敏 `phoneMasked`、`memberRole`、`recipientScope`、`channels`、`recipientCount` 和 `blockedReasons`。缺表、任务不存在、消息目标租户与 job 不一致、无可发送 active 中心账号时返回 `recipientResolutionStatus=blocked`，但不调用 provider，不让共享通知队列因预览受阻反复重试。本批不连接目标租户库，不写中心库或租户库，不发送短信/企微/站内通知，不投递 retry，不修改组织开通任务。
- 第一百五十二批已完成 1 个组织空间开通完成 notification provider 发送 dry-run 场景：新增 `OrganizationProvisioningCompletedNotificationProviderPlanService`，消费服务在首次幂等成功后基于 `recipientPlan` 生成 `sendPlan.providerPlan`。
- 第一百五十二批边界：新增 `RABBITMQ_ORGANIZATION_PROVISIONING_PROVIDER_SEND_ENABLED` 独立安全门，默认关闭；即使开启，本批仍固定 `providerCallRequested=false`、`providerCallExecuted=false`、`sendEnabled=false`，只生成 `in_app/wechat_work/sms` 渠道计划、脱敏收件人、provider 名称、幂等键和阻断原因。收件人 blocked 或渠道无收件人时仍只返回 dry-run 阻断原因，不调用短信/企微/站内信 provider，不投递 retry，不读写数据库，不修改组织开通任务，不写目标租户库。
- 第一百五十三批已完成 1 个共享 notification 队列路由 dry-run 场景：新增 `NotificationRoutingPlanService`，只根据 RabbitMQ headers 和 payload 识别 `organization_provisioning_completed`、`contract_reminder_sms`、`bill_collection_sms`、`login_sms_code`、`page_access_sms_code` 或 `unknown`。
- 第一百五十三批边界：本批不新增通用 `@RabbitListener`，不接管 `magic.notification.queue`，不 ack/nack 消息，不写 `event_consume_log`，不调用短信/企微/站内信 provider，不投递 retry/DLQ。未知消息返回 `routeSupported=false` 和“不能静默 ack”的阻断原因；组织开通完成消息仍标记为专用 consumer 单独灰度。
- 第一百五十四批已完成 1 个共享 notification 队列通用 listener 安全门骨架场景：新增 `NotificationRoutingRabbitListener` 和 `RABBITMQ_NOTIFICATION_ROUTING_CONSUMER_ENABLED` 独立开关，默认关闭。
- 第一百五十四批边界：该 listener 开启后只调用 `NotificationRoutingPlanService` 生成路由 dry-run，然后主动抛出异常，避免 RabbitMQ 把共享通知消息静默 ack；本批不委托专用 consumer，不写 `event_consume_log`，不调用短信/企微/站内信 provider，不投递 retry/DLQ，不读写数据库。该开关只能用于 listener 安全门验收，不能作为生产通知消费者使用。
- 第一百五十五批已完成 1 个共享 notification 队列通用 listener 分发预检 dry-run 场景：新增 `NotificationDispatchPreflightService` 和 `RABBITMQ_NOTIFICATION_DISPATCH_ENABLED` 独立开关，默认关闭；`NotificationRoutingRabbitListener` 现在先生成路由计划，再生成分发预检计划。
- 第一百五十五批边界：预检计划只判断 `routeSupported`、`handlerReady`、`dispatchEnabled` 和 `dispatchAllowed`，并固定 `dispatchExecuted=false`、`ackStrategy=throw_to_avoid_ack`；当前只有 `organization_provisioning_completed` 标记为已有专用 handler，其它路由仍被阻断。即使 `RABBITMQ_NOTIFICATION_DISPATCH_ENABLED=true` 且 `dispatchAllowed=true`，listener 仍主动抛错阻止 ack；本批不调用 handler，不写 `event_consume_log`，不调用短信/企微/站内信 provider，不投递 retry/DLQ，不读写数据库。
- 第一百五十六批已完成 1 个共享 notification 队列专用 handler adapter dry-run 场景：新增 `NotificationHandlerAdapterPlanService`，`NotificationRoutingRabbitListener` 现在依次生成路由计划、分发预检计划和 adapter 调用计划。
- 第一百五十六批边界：当前只支持 `organization_provisioning_completed` 的 adapter dry-run，计划内只返回 `adapterBean`、`targetHandlerBean`、`adapterInvocationAllowed`、`adapterInvocationRequested=false`、`adapterInvocationExecuted=false`、`requestType` 和脱敏 request preview。即使 adapter 允许调用，listener 仍主动抛错阻止 ack；本批不调用专用 consumer，不写 `event_consume_log`，不读写数据库，不调用短信/企微/站内信 provider，不投递 retry/DLQ。
- 第一百五十七批已完成 1 个组织开通完成 notification adapter 请求校验 dry-run 场景：新增 `NotificationAdapterRequestValidationPlanService`，通用 listener 现在在 adapter 调用计划之后生成请求校验计划。
- 第一百五十七批边界：当前只校验组织开通完成通知的 headers、`eventType/templateKey`、payload JSON、`jobId/targetCustomerId/targetDbName` 和 `providerCallEnabled` 阻断；计划返回 `requestValidationPassed`、`requestValidationStatus`、`missingHeaders`、`missingPayloadFields`、`payloadParseStatus`、`providerCallBlocked` 和脱敏 `payloadPreview`。即使校验通过，listener 仍主动抛错阻止 ack；本批不构造真实消费结果，不调用专用 consumer，不写 `event_consume_log`，不读写中心库或租户库，不调用短信/企微/站内信 provider，不投递 retry/DLQ。
- 第一百五十八批已完成 1 个组织开通完成 notification 专用 consumer 委托前置计划 dry-run 场景：新增 `NotificationConsumerDelegationPlanService`，通用 listener 现在在请求校验计划之后生成委托计划。
- 第一百五十八批边界：当前只预览将要构造的 `OrganizationProvisioningCompletedNotificationConsumeRequest` 字段和 `OrganizationProvisioningCompletedNotificationConsumeResult` 字段形态，返回 `consumerBean`、`consumerMethod`、`delegationSupported`、`requestValidationPassed`、`requestTypeMatched`、`delegationAllowed`、`delegationRequested=false`、`delegationExecuted=false`、`requestPreview` 和 `resultPreview`。即使委托允许，listener 仍主动抛错阻止 ack；本批不注入或调用专用 consumer，不写 `event_consume_log`，不读写中心库或租户库，不调用短信/企微/站内信 provider，不投递 retry/DLQ。
- 第一百五十九批已完成 1 个组织开通完成 notification 真实委托安全门与单 route 保护灰度前检查场景：新增 `RABBITMQ_NOTIFICATION_CONSUMER_DELEGATION_ENABLED` 和 `RABBITMQ_NOTIFICATION_CONSUMER_DELEGATION_ROUTE_GUARD` 配置，默认关闭且只允许 `organization_provisioning_completed` route。
- 第一百五十九批边界：`NotificationConsumerDelegationPlanService` 计划新增 `delegationEnabled`、`routeGuard`、`routeGuardMatched`，并把安全门和 route guard 纳入 `delegationAllowed`；安全门关闭、route guard 不匹配、请求校验失败、requestType 不匹配都会阻断委托。即使 `delegationAllowed=true`，listener 仍主动抛错阻止 ack；本批不执行真实委托，不注入或调用专用 consumer，不写 `event_consume_log`，不读写中心库或租户库，不调用短信/企微/站内信 provider，不投递 retry/DLQ。
- 第一百六十批已完成 4 个新增亿玛表计平台只读接口：`GET /api/ymsino/waterinfo/data`、`GET /api/ymsino/waterinfo/tree`、`GET /api/ymsino/meterinfo/data`、`GET /api/ymsino/meterinfo/tree`。
- 第一百六十批边界：新增 `YmsinoClient/YmsinoService/YmsinoController/YmsinoMeterKind` 和 `app.ymsino.*` 配置，只接入 `GetInfo/GetTranDay` 两类只读调用，保留 token 缓存、刷新重试、默认 `ptId=YZWL`、默认 `tyDate=今天`、水电 `TjType` 过滤、设备树构建、分页和 diagnostics/source 响应结构；不迁移余额、充值、实时通断等写操作，不写数据库，不发 Kafka/RabbitMQ，不改旧后端。后续补丁已兼容 `includeDiagnostics=1`、token 重试 JSON header 和 baseUrl 末尾 `/`。
- 第一百六十一批已完成 1 个高风险外部统计场景：`GET /api/dashboard/meter-statistics` 从第六十八批本地账单统计版升级为合众第三方设备/历史读数优先、本地账单兜底版。
- 第一百六十一批边界：新增 `projCode` 查询参数兼容，默认 `241`；补 `date=YYYY-MM` 月统计解析；成功时读取合众 `getDevice/getHDMData` 并按授权园区名称过滤设备、按日期范围过滤读数，返回 `source=hezhong_vendor`；合众 `BAD_GATEWAY` 类异常时返回本地统计并标记 `source=amount_bill_local_fallback` 和兜底提示。仍不写数据库，不发 Kafka/RabbitMQ，不调用阀控、实时抄表或回调写入，不改旧后端。
- 第一百六十二批已完成 1 个共享 notification 队列真实委托前 dry-run 验收矩阵场景：`NotificationConsumerDelegationPlanService` 新增 `delegationReadinessMatrix`、`delegationReadinessFailedChecks`、`consumerInvocationMode`、`ackStrategy` 和 `nextAction`，逐项展示 route、请求校验、requestType、安全门、route guard、provider 开关和委托边界是否满足。
- 第一百六十二批边界：即使 `RABBITMQ_NOTIFICATION_CONSUMER_DELEGATION_ENABLED=true` 且 route guard 匹配，本批仍不注入或调用 `OrganizationProvisioningCompletedNotificationConsumerService`，不写 `event_consume_log`，不读写中心库或租户库，不 ack/nack RabbitMQ 消息，不调用短信/企微/站内信 provider，不投递 retry/DLQ；若上游计划出现 `providerCallEnabled/providerCallBlocked`，委托计划会额外阻断，避免真实 provider 被误放开。
- 第一百六十三批已完成 1 个共享 notification 队列到组织开通完成专用 consumer 的受控真实委托场景：`NotificationRoutingRabbitListener` 在 `delegationAllowed=true` 时构造 `OrganizationProvisioningCompletedNotificationConsumeRequest` 并调用 `OrganizationProvisioningCompletedNotificationConsumerService.consume(...)`，委托请求来自 RabbitMQ headers/body。
- 第一百六十三批边界：只有 `success/duplicate` 结果会正常返回并由 RabbitMQ 容器确认；`invalid/failed/skipped`、非组织开通 route、安全门未开启、route guard 不匹配、请求校验失败或 provider 开关被打开时仍抛错保留消息。本批允许专用 consumer 写 `event_consume_log` 幂等记录并生成中心库收件人/provider dry-run 计划；仍不调用短信/企微/站内信 provider，不写租户库，不投递 retry/DLQ，不放开其它 notification route。为避免两个 listener 竞争同一 `magic.notification.queue`，当通用 `RABBITMQ_NOTIFICATION_ROUTING_CONSUMER_ENABLED=true` 时，旧的组织开通完成专用 listener 会被条件禁用。
- 第一百六十四批已完成 1 个组织开通完成 notification provider 真实发送前置验收矩阵和单渠道灰度安全门场景：新增 `RABBITMQ_ORGANIZATION_PROVISIONING_PROVIDER_CHANNEL_GUARD`，默认 `in_app`；`OrganizationProvisioningCompletedNotificationProviderPlanService` 输出 `providerReadinessMatrix`、`providerReadinessFailedChecks`、`providerReadyChannels`、`providerBlockedChannels`、渠道级 `readinessChecks` 和 `channelReadyForProviderDryRun`。
- 第一百六十四批边界：只有同时满足 `RABBITMQ_ORGANIZATION_PROVISIONING_PROVIDER_SEND_ENABLED=true`、收件人解析 ready、渠道已登记 provider、渠道匹配 guard、渠道有收件人的计划才会进入 `providerReadyChannels`；本批仍固定 `providerCallRequested=false`、`providerCallExecuted=false`、`sendEnabled=false`、`dryRun=true`，不调用短信/企微/站内信 provider，不写租户库，不投递 retry/DLQ，不放开多渠道真实发送。
- 第一百六十五批已完成 1 个组织开通完成 notification `in_app` 单渠道 provider 执行器写库/幂等预案场景：新增 `OrganizationProvisioningCompletedInAppProviderExecutionPlanService`，并在 provider plan 中输出 `inAppExecutionPlan`。预案包含后续 `event_consume_log` 认领、`in_app_notification` 逐收件人写入、幂等键、未读状态、收件人写入预览和延后副作用。
- 第一百六十五批边界：当前项目尚未固定站内通知业务表结构，因此本批只输出 `notificationTable=in_app_notification`、`manualDdlRequired=true`、`recipientWritePreviews`、`executionBoundary=第 165 批只生成 in_app 写库/幂等预案，不执行 SQL`；不执行 SQL，不写 `event_consume_log`，不创建或写入 `in_app_notification`，不调用短信/企微 provider，不投递 RabbitMQ/Kafka，不写租户库。
- 第一百六十六批已完成 1 个组织开通完成 notification `in_app` 单渠道 provider 执行器 claim 预检场景：新增中心库 `in_app_notification` 手工 DDL 草案 `apps/backend-springboot/src/main/resources/db/manual/002-in-app-notification.sql`，新增 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_NOTIFICATION_DDL_APPLIED` 默认关闭，并新增 `OrganizationProvisioningCompletedInAppProviderExecutorPreflightService` 输出 `executorPreflightPlan`。
- 第一百六十六批边界：只有手工确认 DDL 已应用、`inAppExecutionPlan.planStatus=ready_for_write_plan`、存在 provider in_app 幂等 eventId/idempotencyKey、且每个收件人写入预览都有 `centerUserId/idempotencyKey` 时，`executorPreflightPlan.planStatus` 才会进入 `ready_for_claim_dry_run`。本批仍固定 `claimRequested=false`、`claimExecuted=false`、`dbWriteExecuted=false`、`markSuccessExecuted=false`、`markFailureExecuted=false`；不调用 `EventConsumeLogRepository.claimProcessing(...)`，不写 `event_consume_log`，不插入 `in_app_notification`，不触发 websocket/push，不接短信/企微 provider，不写租户库。
- 第一百六十七批已完成 1 个组织开通完成 notification `in_app` 单渠道 provider 执行器真实 claim 场景：新增 `OrganizationProvisioningCompletedInAppProviderExecutor`、`OrganizationProvisioningCompletedInAppProviderClaimResult` 和 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_CLAIM_ENABLED` 默认关闭。开关开启且 `executorPreflightPlan.claimReady=true` 时，executor 调用 `EventConsumeLogRepository.claimProcessing(...)` 写 provider 级 `event_consume_log.status=processing`。
- 第一百六十七批边界：真实 claim 只处理 `CLAIMED/DUPLICATE_SUCCESS/IN_PROGRESS` 三种结果并返回结构化状态；`CLAIMED` 只表示 `claimed_write_deferred`，后续站内通知写库仍未执行。本批不插入 `in_app_notification`，不调用 `markSuccess/markFailure`，不触发 websocket/push，不接短信/企微 provider，不写租户库，不新增 listener 自动调用 executor。
- 第一百六十八批已完成 1 个组织开通完成 notification `in_app_notification` 逐收件人 insert 参数预检场景：新增 `OrganizationProvisioningCompletedInAppNotificationInsertPlanService`，并在 `inAppExecutionPlan.writePreview.notificationInsertPlan` 输出 `insertColumns`、`insertRows`、`insertRowCount`、`manualDdlApplied`、`insertRequested=false`、`insertExecuted=false`、`dbWriteExecuted=false`。
- 第一百六十八批边界：insert 预检只校验 `event_id/idempotency_key/recipient_center_user_id/target_customer_id/target_db_name/template_key/title/content/status/payload_json` 的字段映射和逐收件人参数，不持有 `JdbcTemplate`，不执行 `INSERT INTO in_app_notification`，不调用 `event_consume_log.markSuccess/markFailure`，不触发 websocket/push，不接短信/企微 provider，不写租户库。
- 第一百六十九批已完成 1 个组织开通完成 notification `in_app_notification` 单表真实 insert repository 场景：新增 `OrganizationProvisioningCompletedInAppNotificationRepository`、insert row/result records 和 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_NOTIFICATION_INSERT_ENABLED` 默认关闭；executor 增加 `insertNotifications(...)`，只有 claim accepted、insert plan ready、insert 开关开启时才写中心库 `in_app_notification`。
- 第一百六十九批边界：repository 只执行 `INSERT INTO in_app_notification`，重复 `idempotency_key` 计入 `duplicateRows`；本批不调用 `event_consume_log.markSuccess/markFailure`，不新增 listener 自动调用 insert，不触发 websocket/push，不接短信/企微 provider，不写租户库。
- 第一百七十批已完成 1 个组织开通完成 notification `in_app` provider 成功收口场景：新增 `OrganizationProvisioningCompletedInAppProviderMarkSuccessResult` 和 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_MARK_SUCCESS_ENABLED` 默认关闭；executor 增加 `markSuccess(...)`，只有 claim accepted、insert accepted、mark success 开关开启时才调用 `EventConsumeLogRepository.markSuccess(...)`。
- 第一百七十批边界：本批只把 provider 级 `event_consume_log` 从 processing 收口为 success；不新增 listener 自动串联 `claim -> insert -> markSuccess`，不调用 `markFailure`，不触发 websocket/push，不接短信/企微 provider，不写租户库。
- 第一百七十一批已完成 1 个组织开通完成 notification `in_app` provider 手动串联场景：新增 `OrganizationProvisioningCompletedInAppProviderManualExecutionService` 和 `OrganizationProvisioningCompletedInAppProviderManualExecutionResult`，显式按 `claim -> insertNotifications -> markSuccess` 顺序执行，claim 或 insert 未 accepted 时立即停止。
- 第一百七十一批边界：本批只是 service 级内部灰度入口，不新增 Controller，不接 `@RabbitListener`，不让 RabbitMQ listener 自动调用，不触发 websocket/push，不接短信/企微 provider，不写租户库。`inAppExecutionPlan` 已补充 `manualExecutionBean`、`listenerAutoExecution=false`、`websocketExecuted=false` 和 `pushExecuted=false` 方便验收。
- 第一百七十二批已完成 1 个组织开通完成 notification `in_app` provider 失败收口场景：新增 `OrganizationProvisioningCompletedInAppProviderMarkFailureResult` 和 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_MARK_FAILURE_ENABLED` 默认关闭；executor 增加 `markFailure(...)`，只有 claim accepted、失败原因非空、mark failure 开关开启时才调用 `EventConsumeLogRepository.markFailure(...)`。
- 第一百七十二批边界：本批只提供显式失败收口方法，不把 `markFailure(...)` 接入手动串联 service 的异常捕获，不新增 Controller，不接 `@RabbitListener`，不投递 retry/DLQ，不触发 websocket/push，不接短信/企微 provider，不写租户库。
- 第一百七十三批已完成 1 个组织开通完成 notification `in_app` provider 手动入口异常失败收口场景：`OrganizationProvisioningCompletedInAppProviderManualExecutionService` 在 `insertNotifications(...)` 或 `markSuccess(...)` 抛出 `RuntimeException` 后，会调用 executor 的 `markFailure(...)`；`OrganizationProvisioningCompletedInAppProviderManualExecutionResult` 新增 `markFailureResult`，`inAppExecutionPlan` 新增 `manualFailureClosureSupported=true` 和 `manualFailureClosureExecuted=false`。
- 第一百七十三批边界：本批只处理手动入口内 insert/markSuccess 异常，不捕获 claim 异常，不新增 Controller，不接 `@RabbitListener`，不投递 retry/DLQ，不触发 websocket/push，不接短信/企微 provider，不写租户库；是否真实把 provider 消费日志标记 failed 仍由 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_MARK_FAILURE_ENABLED` 控制。
- 第一百七十四批已完成 1 个组织开通完成 notification `in_app` provider websocket/push dry-run 场景：新增 `OrganizationProvisioningCompletedInAppDeliveryPlanService`，在 `inAppExecutionPlan.writePreview.websocketPushDeliveryPlan` 输出 `deliveryChannels`、`deliveryRows`、`websocketTopic`、`websocketEvent`、`pushTemplateKey`、`websocketExecuted=false` 和 `pushExecuted=false`。
- 第一百七十四批边界：本批只生成 websocket/push 投递预案，不新增 WebSocket 配置，不接入移动推送 SDK，不创建推送 outbox，不投递 RabbitMQ retry/DLQ，不修改手动串联执行顺序，不新增 Controller，不接 `@RabbitListener`，不执行真实 websocket/push。
- 第一百七十五批已完成 1 个组织开通完成 notification `in_app` provider listener 自动执行前综合安全门 dry-run 场景：新增 `OrganizationProvisioningCompletedInAppListenerAutoExecutionGatePlanService` 和配置项 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_LISTENER_AUTO_EXECUTION_ENABLED` 默认关闭；`inAppExecutionPlan.listenerAutoExecutionGatePlan` 输出 `listenerAutoExecutionAllowed`、`readinessMatrix`、`failedChecks`、`blockedReasons`、`listenerIntegrationExecuted=false`、`websocketExecuted=false` 和 `pushExecuted=false`。
- 第一百七十五批边界：安全门只做判定，不修改 `NotificationRoutingRabbitListener` 或专用 notification listener，不调用手动执行 service，不确认 RabbitMQ 消息，不执行 provider，不触发 websocket/push；即使所有安全门通过，本批也只是返回 `ready_for_listener_auto_execution_dry_run`。
- 第一百七十六批已完成 1 个组织开通完成 notification `in_app` provider listener 自动执行显式调用预案 dry-run 场景：新增 `OrganizationProvisioningCompletedInAppListenerAutoExecutionInvocationPlanService`；`inAppExecutionPlan.listenerAutoExecutionGatePlan.invocationPlan` 输出调用参数来源、调用顺序、ack/nack 策略、预期结果字段和所有执行态布尔值。
- 第一百七十六批边界：调用预案只描述未来 listener 如何调用 `OrganizationProvisioningCompletedInAppProviderManualExecutionService.execute(...)`，并阻断综合安全门失败、计划未 ready 或嵌套预案缺失的情况；本批不修改 `NotificationRoutingRabbitListener` 或专用 notification listener，不调用手动执行 service，不确认或拒绝 RabbitMQ 消息，不执行 provider，不触发 websocket/push。
- 第一百七十七批已完成 1 个共享 notification listener 委托结果到 `in_app` provider 的后置 adapter dry-run 场景：新增 `NotificationInAppProviderAutoExecutionAdapterPlanService`；`NotificationConsumerDelegationPlanService.inAppProviderAutoExecutionAdapterPlan` 输出 source consumer、source result path、manual execution bean/method、执行顺序、ack/nack 保持策略和所有执行态布尔值。
- 第一百七十七批边界：adapter 预案只描述未来如何从 `OrganizationProvisioningCompletedNotificationConsumeResult.sendPlan.providerPlan.inAppExecutionPlan` 串联到手动 provider；本批不修改 `NotificationRoutingRabbitListener` 的真实委托分支，不读取真实 consumer result，不调用 `OrganizationProvisioningCompletedInAppProviderManualExecutionService`，不改变 RabbitMQ ack/nack 行为，不触发 websocket/push。
- 第一百七十八批已完成 1 个共享 notification listener 后置 `in_app` provider adapter 安全门场景：新增 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_ENABLED` 默认关闭；`NotificationInAppProviderAutoExecutionAdapterPlanService` 新增 `readinessMatrix/readinessFailedChecks`，检查 route、requestType、专用 consumer 委托、委托失败项、result adapter 开关和 providerCall 关闭状态。
- 第一百七十八批边界：开关开启时也只让 `inAppProviderAutoExecutionAdapterPlan` 返回 `ready_for_result_adapter_dry_run`；本批不修改 `NotificationRoutingRabbitListener`，不读取真实 consumer result，不调用 `OrganizationProvisioningCompletedInAppProviderManualExecutionService`，不改变 RabbitMQ ack/nack 行为，不触发 websocket/push。
- 第一百七十九批已完成 1 个共享 notification listener 后置 adapter consumer result 错误分类预案场景：`NotificationInAppProviderAutoExecutionAdapterPlanService.consumerResultValidationPlan` 输出必需路径、`inAppExecutionPlan.planStatus` blocked 路径、`listenerAutoExecutionGatePlan.invocationPlan` 路径，以及 `missing_send_plan/missing_provider_plan/missing_in_app_execution_plan/in_app_execution_plan_blocked/missing_listener_auto_execution_invocation_plan` 分类。
- 第一百七十九批边界：本批只生成 consumer result 校验和错误分类预案，固定 `consumerResultProvided=false`、`consumerResultInspected=false`、`validationExecuted=false`；不修改 `NotificationRoutingRabbitListener`，不读取真实 consumer result，不调用 `OrganizationProvisioningCompletedInAppProviderManualExecutionService`，不改变 RabbitMQ ack/nack 行为，不触发 websocket/push。
- 第一百八十批已完成 1 个 consumer result 分类预案提炼场景：新增 `NotificationInAppProviderConsumerResultValidationPlanService`，集中输出 `sourceResultPath/requiredNestedPaths/blockedStatusPath/invocationPlanPath/errorClassifications`；`NotificationInAppProviderAutoExecutionAdapterPlanService` 改为注入该 validator 并复用 `sourceResultPath()` 与 `buildPlan()`。
- 第一百八十批边界：validator 只生成 dry-run 预案，固定 `consumerResultProvided=false`、`consumerResultInspected=false`、`validationExecuted=false`；本批不修改 `NotificationRoutingRabbitListener`，不接 listener，不读取真实 consumer result，不调用 `OrganizationProvisioningCompletedInAppProviderManualExecutionService`，不改变 RabbitMQ ack/nack 行为，不触发 websocket/push。
- 第一百八十一批已完成 1 个 consumer result 纯内存分类方法场景：`NotificationInAppProviderConsumerResultValidationPlanService.classify(...)` 只检查传入 Map 的 `sendPlan/providerPlan/inAppExecutionPlan/listenerAutoExecutionGatePlan.invocationPlan` 路径，返回 `missing_send_plan/missing_provider_plan/missing_in_app_execution_plan/in_app_execution_plan_blocked/missing_listener_auto_execution_invocation_plan/ready_for_result_adapter_validation` 分类。
- 第一百八十一批边界：分类方法只服务单元测试和后续 no-op 分支复用；即使返回 ready，也固定 `adapterInvocationAllowed=false`、`manualExecutionAllowed=false`。本批不修改 `NotificationRoutingRabbitListener`，不接 listener，不读取 RabbitMQ 消息，不写数据库，不调用 `OrganizationProvisioningCompletedInAppProviderManualExecutionService`，不改变 RabbitMQ ack/nack 行为。
- 第一百八十二批已完成 1 个真实 result adapter listener 接入前置开关和 no-op 分支预案场景：新增 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_LISTENER_NOOP_ENABLED` 默认关闭；`NotificationInAppProviderAutoExecutionAdapterPlanService.listenerNoopIntegrationPlan` 输出 listener bean/method、no-op 分支开关、adapter plan ready 状态、阻断原因和所有执行态布尔值。
- 第一百八十二批边界：只有 result adapter dry-run ready 且 no-op 开关开启时才返回 `ready_for_listener_noop_dry_run`；本批不修改 `NotificationRoutingRabbitListener`，不接 listener，不把真实 consumer result 传入 validator，不调用 `OrganizationProvisioningCompletedInAppProviderManualExecutionService`，不改变 RabbitMQ ack/nack 行为。
- 第一百八十三批已完成 1 个 listener no-op ack/nack 决策矩阵 dry-run 场景：`listenerNoopIntegrationPlan` 新增 `ackNackDecisionMatrix`，覆盖 adapter 阻断、no-op 开关关闭、no-op 分支允许、未来 result 校验失败和未来 result 校验通过 5 类场景。
- 第一百八十三批边界：矩阵和顶层 no-op 预案都固定 `ackNackDecisionExecuted=false`、`ackNackPolicyChanged=false`、`rabbitAckExecuted=false`、`rabbitNackExecuted=false`；本批不修改 `NotificationRoutingRabbitListener`，不转发真实 consumer result，不调用 `OrganizationProvisioningCompletedInAppProviderManualExecutionService`，不改变 RabbitMQ ack/nack 行为。
- 第一百八十四批已完成 1 个 listener no-op 预案职责拆分场景：新增 `NotificationInAppProviderListenerNoopPlanService`，集中维护 `listenerNoopIntegrationPlan`、阻断原因和 ack/nack 决策矩阵；adapter 预案只注入并调用该 service。
- 第一百八十四批边界：本批只是拆分 service 和补独立测试，不修改 `NotificationRoutingRabbitListener`，不新增 listener 分支，不读取或转发真实 consumer result，不调用 `OrganizationProvisioningCompletedInAppProviderManualExecutionService`，不改变 RabbitMQ ack/nack 行为。
- 第一百八十五批已完成 1 个 no-op 分支到 validator 的参数契约 dry-run 场景：`NotificationInAppProviderListenerNoopPlanService.validatorContractPlan` 输出 `classify(...)` 的参数名、参数来源、必需路径、ready 分类和阻断分类清单。
- 第一百八十五批边界：契约预案固定 `argumentSourceAvailable=false`、`contractCheckExecuted=false`、`consumerResultForwardedToValidator=false`、`adapterInvocationAllowed=false`、`manualExecutionAllowed=false`；本批不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不调用 `classify(...)`，不改变 RabbitMQ ack/nack 行为。
- 第一百八十六批已完成 1 个 validator 参数契约输入样例矩阵 dry-run 场景：`validatorContractPlan.inputSampleMatrix` 覆盖缺 `sendPlan`、缺 `providerPlan`、缺 `inAppExecutionPlan`、`planStatus` 阻断、缺 invocation plan 和 ready 结构 6 类样例。
- 第一百八十六批边界：样例矩阵只描述输入形态和预期分类，固定 `samplePayloadProvided=false`、`classificationExecuted=false`、`consumerResultForwardedToValidator=false`；本批不修改 `NotificationRoutingRabbitListener`，不构造真实 consumer result，不调用 `classify(...)`，不改变 RabbitMQ ack/nack 行为。
- 第一百八十七批已完成 1 个 adapter/no-op/validator contract 嵌套计划只读验收测试场景：新增测试从 `inAppProviderAutoExecutionAdapterPlan` 逐层检查 `listenerNoopIntegrationPlan`、`validatorContractPlan` 和 `inputSampleMatrix`。
- 第一百八十七批边界：本批只补测试和文档，固定 adapter、no-op、validator contract、样例矩阵的执行态为 false；不修改生产代码，不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不改变 RabbitMQ ack/nack 行为。
- 第一百八十八批已完成 1 个 validator 分类与 ack/nack 决策矩阵对齐 dry-run 场景：`validatorContractPlan.ackNackAlignmentMatrix` 将 5 个 blocked 分类映射到 `future_validation_blocked`，将 ready 分类映射到 `future_validation_ready`。
- 第一百八十八批边界：对齐矩阵固定 `ackNackAlignmentExecuted=false`、`classificationExecuted=false`、`rabbitAckExecuted=false`、`rabbitNackExecuted=false`；本批不调用 validator，不修改 `NotificationRoutingRabbitListener`，不改变 RabbitMQ ack/nack 行为。
- 第一百八十九批已完成 1 个 `ackNackAlignmentMatrix` adapter/no-op 嵌套只读验收测试场景：测试固定矩阵必须包含 6 条记录，5 个 blocked 分类均映射 `future_validation_blocked`，ready 分类映射 `future_validation_ready`。
- 第一百八十九批边界：本批只补测试和文档，继续固定 `alignmentExecuted=false`、`classificationExecuted=false`、`rabbitAckExecuted=false`、`rabbitNackExecuted=false`；不修改生产代码，不修改 `NotificationRoutingRabbitListener`，不改变 RabbitMQ ack/nack 行为。
- 第一百九十批已完成 1 个 no-op/validator ack/nack 策略常量整理场景：`NotificationInAppProviderListenerNoopPlanService` 抽取 keep-current、future validation blocked/ready、no-ack/nack 和 defer-ack 策略常量，减少矩阵重复字符串。
- 第一百九十批边界：本批只做内部常量整理，对外 dry-run Map 字段值保持不变；不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不调用 validator，不改变 RabbitMQ ack/nack 行为。
- 第一百九十一批已完成 1 个 ack/nack 策略常量整理后只读回归测试场景：新增测试集中验收顶层 no-op 预案、`ackNackDecisionMatrix` 和 `ackNackAlignmentMatrix` 的策略字符串输出不变。
- 第一百九十一批边界：本批只补测试和文档，继续固定 `ackNackDecisionExecuted=false`、`rabbitAckExecuted=false`、`rabbitNackExecuted=false`；不修改生产代码，不修改 `NotificationRoutingRabbitListener`，不调用 validator，不改变 RabbitMQ ack/nack 行为。
- 第一百九十二批已完成 1 个 no-op/validator 分类字符串常量整理场景：`NotificationInAppProviderConsumerResultValidationPlanService` 和 `NotificationInAppProviderListenerNoopPlanService` 抽取分类码、ready 状态和 blocked/ready 分类状态常量。
- 第一百九十二批边界：本批只做内部常量整理，对外 dry-run 分类码和状态输出保持不变；不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不调用 validator，不改变 RabbitMQ ack/nack 行为。
- 第一百九十三批已完成 1 个分类字符串常量整理后只读回归测试场景：`NotificationInAppProviderConsumerResultValidationPlanServiceTest` 锁定 `errorClassifications` 和 `classify(...)` 的分类码、状态、执行态，`NotificationInAppProviderListenerNoopPlanServiceTest` 锁定 validator contract 的 blocked 分类、输入样例和 ack/nack alignment 完整顺序。
- 第一百九十三批边界：本批只补测试和文档，不修改生产代码，不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不调用 `OrganizationProvisioningCompletedInAppProviderManualExecutionService`，不改变 RabbitMQ ack/nack 行为。
- 第一百九十四批已完成 1 个 no-op planStatus/sampleName 字符串常量整理场景：`NotificationInAppProviderListenerNoopPlanService` 抽取顶层 no-op `planStatus`、validator contract `planStatus` 和 6 个 `inputSampleMatrix.sampleName` 常量。
- 第一百九十四批边界：本批只做内部常量整理，对外 dry-run `planStatus`、`sampleName`、分类码和 ack/nack alignment 字段值保持不变；不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。
- 第一百九十五批已完成 1 个 no-op `planStatus/sampleName` 常量整理后只读回归测试场景：`NotificationInAppProviderListenerNoopPlanServiceTest` 锁定 adapter 未 ready、no-op 开关关闭和 no-op ready 三种计划状态，固定顶层 `planStatus`、`validatorContractPlan.planStatus` 和 6 个输入样例名称顺序。
- 第一百九十五批边界：本批只补测试和文档，继续固定 `samplePayloadProvided=false`、`classificationExecuted=false`、`consumerResultForwardedToValidator=false`；不修改生产代码，不修改 `NotificationRoutingRabbitListener`，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。
- 第一百九十六批已完成 1 个 no-op `nextAction/scenario` 字符串常量整理场景：`NotificationInAppProviderListenerNoopPlanService` 抽取 `ackNackDecisionMatrix.scenario` 三个基础场景和顶层/validator contract 四个 `nextAction` 输出常量。
- 第一百九十六批边界：本批只做内部常量整理，对外 dry-run `scenario`、`nextAction`、ack/nack 字段值保持不变；不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。
- 第一百九十七批已完成 1 个 no-op `nextAction/scenario` 常量整理后只读回归测试场景：`NotificationInAppProviderListenerNoopPlanServiceTest` 锁定顶层 no-op blocked/ready 和 validator contract blocked/ready 的 4 个 `nextAction` 输出，并锁定 `ackNackDecisionMatrix.scenario` 5 条顺序。
- 第一百九十七批边界：本批只补测试和文档，继续固定 `decisionExecuted=false`、`rabbitAckExecuted=false`、`rabbitNackExecuted=false`；不修改生产代码，不修改 `NotificationRoutingRabbitListener`，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。
- 第一百九十八批已完成 1 个 no-op `blockedReasons` 字符串常量整理场景：`NotificationInAppProviderListenerNoopPlanService` 抽取 result adapter dry-run 未 ready 和 no-op 开关未开启两个阻断原因文本常量。
- 第一百九十八批边界：本批只做内部常量整理，对外 dry-run `blockedReasons` 数组内容和顺序保持不变；不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。
- 第一百九十九批已完成 1 个 no-op `blockedReasons` 常量整理后只读回归测试场景：`NotificationInAppProviderListenerNoopPlanServiceTest` 集中锁定 adapter 未 ready、no-op 开关关闭和 no-op ready 三种状态下的 `blockedReasons` 完整数组顺序。
- 第一百九十九批边界：本批只补测试和文档，继续固定 `noopBranchExecuted=false`、`consumerResultForwardedToValidator=false`、`manualExecutionExecuted=false`、`rabbitAckExecuted=false`、`rabbitNackExecuted=false`；不修改生产代码，不修改 `NotificationRoutingRabbitListener`，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。
- 第二百批已完成 1 个 no-op `executionBoundary/note` 说明文本常量整理场景：`NotificationInAppProviderListenerNoopPlanService` 抽取顶层和 validator contract 的 `executionBoundary` 文本，并抽取 `ackNackDecisionMatrix.note` 五条说明文本常量。
- 第二百批边界：本批只做内部常量整理，对外 dry-run `executionBoundary`、`note`、scenario、ack/nack 字段值保持不变；不修改 `NotificationRoutingRabbitListener`，不传真实 consumer result，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。
- 第二百零一批已完成 1 个 no-op `executionBoundary/note` 常量整理后只读回归测试场景：`NotificationInAppProviderListenerNoopPlanServiceTest` 锁定顶层 no-op `executionBoundary`、`validatorContractPlan.executionBoundary` 和 `ackNackDecisionMatrix.note` 五条说明文本顺序。
- 第二百零一批边界：本批只补测试和文档，继续固定 `contractCheckExecuted=false`、`consumerResultForwardedToValidator=false`、`decisionExecuted=false`、`rabbitAckExecuted=false`、`rabbitNackExecuted=false`；不修改生产代码，不修改 `NotificationRoutingRabbitListener`，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。
- 第二百零二批已完成 1 个 no-op 测试 helper 去重场景：`NotificationInAppProviderListenerNoopPlanServiceTest` 抽取 `assertNoopPlanDoesNotExecute(...)`，集中断言顶层 no-op 不执行状态。
- 第二百零二批边界：本批只整理测试重复断言，不修改生产代码，不修改 dry-run 输出字段值，不修改 `NotificationRoutingRabbitListener`，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。
- 第二百零三批已完成 1 个 no-op ack/nack decision 测试 helper 去重场景：`NotificationInAppProviderListenerNoopPlanServiceTest` 抽取 `assertAckNackDecisionDoesNotExecute(...)` 和 `assertAckNackDecisionMatrixDoesNotExecute(...)`，集中断言 decision 未执行、未 ack、未 nack。
- 第二百零三批边界：本批只整理测试重复断言，不修改生产代码，不修改 dry-run 输出字段值，不修改 `NotificationRoutingRabbitListener`，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。
- 第二百零四批已完成 1 个 listener 接入前静态边界测试场景：`NotificationRoutingRabbitListenerTest` 新增源码扫描，确认 `NotificationRoutingRabbitListener` 仍只委托组织开通完成专用 consumer，未注入 no-op 计划 service、consumer result validator 或站内信 provider 手动执行 service。
- 第二百零四批边界：本批只补只读验收测试和文档，不修改生产代码，不传真实 consumer result 到 validator，不调用 `classify(...)`，不调用 `OrganizationProvisioningCompletedInAppProviderManualExecutionService.execute(...)`，不改变 RabbitMQ ack/nack 行为。
- 第二百零五批已完成 1 个 listener 依赖和调用顺序静态验收场景：`NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsDedicatedConsumerDelegationPipelineOrder()`，锁定字段依赖、构造器参数和 `onMessage(...)` 调用链仍保持 `routing -> dispatch -> adapter -> request validation -> delegation -> dedicated consumer -> ackable`。
- 第二百零五批边界：本批只补源码顺序保护测试和文档，不修改生产代码，不新增 listener 依赖，不传真实 consumer result 到 validator，不调用 `OrganizationProvisioningCompletedInAppProviderManualExecutionService`，不改变 RabbitMQ ack/nack 行为。
- 第二百零六批已完成 1 个 listener 不读取 provider 执行计划的静态验收场景：`NotificationRoutingRabbitListenerTest` 新增 `sourceDoesNotInspectProviderExecutionPlansAfterDedicatedConsumerReturns()`，确认专用 consumer 返回后 listener 只用 `consumed/duplicate` 做 `ackable` 判断，不读取 `sendPlan/providerPlan/inAppExecutionPlan/providerReadyChannels/listenerAutoExecutionGatePlan`。
- 第二百零六批边界：本批只补源码边界测试和文档，不修改生产代码，不新增 provider 自动执行，不传真实 consumer result 到 validator，不调用手动执行 service，不改变 RabbitMQ ack/nack 行为。
- 第二百零七批已完成 1 个 listener ack/nack 边界静态验收场景：`NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsRabbitAckNackBoundaryOwnedByContainerOnly()`，确认当前 `ackable` 结果只 `return`，阻断或非 ackable 结果继续抛错保留消息，listener 未引入手动 `basicAck/basicNack/basicReject`、`Channel`、`Acknowledgment` 或 AMQP 手动确认异常。
- 第二百零七批边界：本批只补源码边界测试和文档，不修改生产代码，不新增手动 ack/nack，不接 no-op/validator/manual execution，不改变 RabbitMQ 消费行为。
- 第二百零八批已完成 1 个 no-op validator 分类到 return/throw 边界只读验收场景：`NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `buildPlanDocumentsFutureValidatorClassificationToReturnThrowBoundary()`，锁定 5 类 blocked 分类映射为 `future_validation_blocked + no_ack_until_real_adapter_policy_batch + throw_for_retry_or_dlq_until_real_policy_batch`，ready 分类映射为 `future_validation_ready + defer_ack_until_manual_execution_result_is_verified + not_applicable_until_real_adapter_policy_batch`。
- 第二百零八批边界：本批只补 no-op 分支正式接入前的分类到 return/throw 边界测试和文档，不调用 validator，不传真实 consumer result，不修改 `NotificationRoutingRabbitListener`，不改变 RabbitMQ ack/nack 行为。
- 第二百零九批已完成 1 个 listener 构造器依赖面静态验收场景：`NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsConstructorDependencySurfaceBeforeNoopIntegration()`，锁定当前 listener 仍只有 6 个 `private final` 依赖字段，构造器参数和赋值仍只包含 routing、dispatch、adapter、request validation、delegation 和组织开通完成专用 consumer。
- 第二百零九批边界：本批只补构造器依赖面测试和文档，不修改生产代码，不新增 no-op/validator/manual execution 依赖，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。
- 第二百一十批已完成 1 个 listener consumer result Map 和 validator 输入静态验收场景：`NotificationRoutingRabbitListenerTest` 新增 `sourceDoesNotReadConsumerResultMapOrBuildValidatorInputBeforeNoopIntegration()`，锁定专用 consumer 返回后 listener 仍只做 `ackable(result)` 判断，不读取 `consumerResult/dedicatedConsumerResult/resultMap`，不构造 `validatorInput/validationInput/classificationInput`，不调用 `classify(...)`。
- 第二百一十批边界：本批只补 listener 源码边界测试和文档，不修改生产代码，不传真实 consumer result 到 validator，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。
- 第二百一十一批已完成 1 个 listener no-op 接入契约只读验收场景：`NotificationInAppProviderAutoExecutionAdapterPlanServiceTest` 新增 `buildPlanDocumentsListenerNoopContractWithoutManualExecutionOrAckNack()`，锁定 result adapter 和 listener no-op 安全门都开启时仍只生成 adapter/no-op/validator dry-run 预案，不转发真实 consumer result，不调用 manual execution，不执行 ack/nack/websocket/push。
- 第二百一十一批边界：本批只补契约测试和文档，不修改生产代码，不接 `NotificationRoutingRabbitListener`，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。
- 第二百一十二批已完成 1 个 listener no-op 正式接入前最终源码保护场景：`NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsFinalNoopPreIntegrationBoundaryBeforeRealListenerChange()`，集中锁定 listener 依赖数量、调用顺序、`return/throw` 数量和未注入 no-op/validator/manual execution/手动 ack/nack。
- 第二百一十二批边界：本批只补最终源码保护测试和文档，不修改生产代码，不新增 listener 依赖，不调用 validator 或手动执行 service，不改变 RabbitMQ ack/nack 行为。
- 第二百一十三批已完成 1 个 listener no-op dry-run 受控接入场景：`NotificationRoutingRabbitListener` 注入 `NotificationInAppProviderListenerNoopPlanService`，只在专用 consumer 返回 `ackable(result)` 后基于 delegation dry-run 计划生成 no-op 预案；`NotificationRoutingRabbitListenerTest` 新增 `onMessageBuildsListenerNoopPlanWhenAckableAndAdapterPlanIsReady()` 并更新依赖面/调用顺序断言。
- 第二百一十三批边界：本批只接入 no-op dry-run 预案生成，不读取真实 `sendPlan/providerPlan/inAppExecutionPlan`，不传真实 consumer result 到 validator，不调用 `classify(...)` 或 manual execution service，不执行 websocket/push，不新增手动 ack/nack，不改变原有 return/throw 策略。
- 第二百一十四批已完成 1 个 listener no-op 接入后源码级回归场景：`NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsNoopPlanGenerationInsideAckableBranchOnly()`，锁定 no-op plan 生成只出现一次、只位于 `ackable(result)` 分支内且只接收 `resultAdapterPlanReady(delegationPlan)`。
- 第二百一十四批边界：本批只补源码回归测试和文档，不修改生产代码，不传真实 result/consumerResult/dedicatedConsumerResult 到 no-op/validator，不调用 validator 或手动执行 service，不改变 RabbitMQ return/throw/ack/nack 行为。
- 第二百一十五批已完成 1 个 result adapter ready 判定行为回归场景：`NotificationRoutingRabbitListenerTest` 新增 `onMessageBuildsListenerNoopPlanWithFalseWhenAdapterPlanIsBlocked()`，覆盖 nested adapter 计划 `planStatus=blocked` 时只向 no-op plan service 传 `false`。
- 第二百一十五批边界：本批只补测试和文档，不修改生产代码；结合既有缺失 nested adapter 计划和 ready 计划场景，`resultAdapterPlanReady(...)` 三种输入只影响 no-op dry-run boolean，不触发 validator/manual execution/websocket/push，不改变 RabbitMQ return/throw/ack/nack 行为。
- 第二百一十六批已完成 1 个 listener no-op 安全矩阵测试场景：`NotificationRoutingRabbitListenerTest` 新增 `sourceDocumentsListenerNoopSafetyMatrixAfterDryRunIntegration()`，集中锁定 delegation blocked、non-ackable、ackable missing adapter、ackable blocked adapter、ackable ready adapter 五类路径的 no-op 调用和 return/throw 边界。
- 第二百一十六批边界：本批只补安全矩阵测试和文档，不修改生产代码；矩阵继续固定 validator/manual execution/websocket/push 未调用，手动 ack/nack 未执行，RabbitMQ return/throw 策略不变。
- 第二百一十七批已完成 1 个 validator 输入适配器预案场景：`NotificationInAppProviderListenerNoopPlanService` 在 `validatorContractPlan` 下新增 `inputAdapterPlan` dry-run 字段，描述未来从 `dedicatedConsumerResult` 提取 `consumerResult` 并传给 `classify(...)` 的参数契约；`NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `buildPlanDocumentsValidatorInputAdapterContractWithoutForwardingResult()`。
- 第二百一十七批边界：本批只新增输入适配器 dry-run 预案，不传真实 consumer result，不调用 `classify(...)`，不调用 manual execution，不执行 websocket/push，不改变 RabbitMQ return/throw/ack/nack 行为。
- 第二百一十八批已完成 1 个 input adapter 状态回归场景：`NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `buildPlanKeepsInputAdapterBlockedUntilListenerNoopIsReady()`，覆盖 adapter plan 未 ready、no-op gate 关闭、no-op ready 三种状态。
- 第二百一十八批边界：本批只补测试和文档，不修改生产代码；`inputAdapterPlan` 仍不执行 adapter，不转发 consumer result，不调用 `classify(...)`，不调用 manual execution，不改变 RabbitMQ ack/nack 行为。
- 第二百一十九批已完成 1 个 input adapter required path 顺序回归场景：`NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `buildPlanKeepsInputAdapterRequiredPathOrderStable()`，锁定 `sourceResultPath` 和 `requiredNestedPaths` 的顺序。
- 第二百一十九批边界：本批只补路径顺序测试和文档，不修改生产代码，不提供 sample payload，不调用 validator 或 manual execution，不改变 RabbitMQ ack/nack 行为。
- 第二百二十批已完成 1 个 input adapter nextAction 和执行态字符串稳定性场景：`NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `buildPlanKeepsInputAdapterNextActionAndExecutionFlagsStable()`。
- 第二百二十批边界：本批只补测试和文档，不修改生产代码；`inputAdapterPlan` 继续固定不执行 adapter、不转发 result、不执行 classification、不调用 manual execution、不改变 RabbitMQ ack/nack 行为。
- 第二百二十一批已完成 1 个 listener no-op dry-run 四层嵌套契约完整性场景：`NotificationInAppProviderAutoExecutionAdapterPlanServiceTest` 新增 `buildPlanExposesNestedNoopValidatorInputAdapterAndAckNackContractsTogether()`，同时锁定顶层 adapter、listener no-op、validator contract、input adapter 和 ack/nack alignment 均可读且均不执行。
- 第二百二十一批边界：本批只补嵌套契约完整性测试和文档，不修改生产代码，不传真实 consumer result，不调用 validator 或 manual execution，不改变 RabbitMQ ack/nack 行为。
- 第二百二十二批已完成 1 个 listener no-op 接入后公开文档澄清场景：更新 README 环境变量和 RabbitMQ 队列边界说明，明确当前 listener 已生成 no-op dry-run 预案，但仍不读取真实 provider 执行计划、不调用 validator/manual execution、不执行 websocket/push、不新增手动 ack/nack。
- 第二百二十二批边界：本批只修正文档，不修改生产代码，不改变 RabbitMQ 行为。
- 第二百二十三批已完成 1 个 README listener no-op 当前态术语对齐场景：修正后置 adapter、validator 和 listener no-op 当前状态说明，避免继续出现“当前不修改 listener/不接 listener”的误导性当前态表述。
- 第二百二十三批边界：本批只修正文档，不修改生产代码，不改变 RabbitMQ 行为；历史批次记录中的当时边界描述保留。
- 第二百二十四批已完成 1 个 validator 真接入前 listener 源码保护场景：`NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsValidatorInvocationBlockedAfterNoopDryRunIntegration()`，确认 listener 只调用 no-op `buildPlan(...)`，未读取 input adapter/validator contract/真实 provider result，未调用 `classify(...)` 或 manual execution。
- 第二百二十四批边界：本批只补源码保护测试和文档，不修改生产代码，不调用 validator/manual execution，不改变 RabbitMQ ack/nack 行为。
- 第二百二十五批已完成 1 个 validator 调用安全门 dry-run 预案场景：新增 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_VALIDATOR_ENABLED` 默认关闭；`NotificationInAppProviderListenerNoopPlanService.inputAdapterPlan` 新增 `validatorInvocationGatePlan`；`NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `buildPlanDocumentsValidatorInvocationGateWithoutCallingClassify()`。
- 第二百二十五批边界：本批只新增 validator 调用安全门预案，不传真实 consumer result，不调用 `classify(...)`，不调用 manual execution，不改变 RabbitMQ ack/nack 行为。
- 第二百二十六批已完成 1 个 validator invocation gate 阻断原因和配置开关回归场景：`NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `buildPlanKeepsValidatorInvocationGateBlockedReasonsStable()`，覆盖 validator gate 关闭、listener no-op 未 ready 和两者同时 ready 的输出。
- 第二百二十六批边界：本批只补测试和文档，不修改生产代码，不调用 validator/manual execution，不改变 RabbitMQ ack/nack 行为。
- 第二百二十七批已完成 1 个 validator gate 配置/文档命名对齐场景：`NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `configAndReadmeKeepValidatorGatePropertyNameAligned()`，静态检查 yml、`AppProperties` 和 README 中的新开关命名一致。
- 第二百二十七批边界：本批只补配置/文档命名对齐测试和文档，不修改生产行为。
- 第二百二十八批已完成 1 个 validator gate ready 前 listener 源码回归场景：`NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsValidatorGatePlanOutOfListenerBeforeRealValidationIntegration()`，确认 listener 未注入 validation service、未读取 validator gate/input adapter、未调用 `classify(...)`。
- 第二百二十八批边界：本批只补源码回归测试和文档，不修改生产代码，不调用 validator/manual execution，不改变 RabbitMQ ack/nack 行为。
- 第二百二十九批已完成 1 个 validator 分类结果到 ack/nack 策略预案场景：`NotificationInAppProviderListenerNoopPlanService.validatorInvocationGatePlan` 新增 `classificationAckNackPlan` dry-run 字段；`NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `buildPlanDocumentsClassificationAckNackPlanWithoutExecutingDecision()`。
- 第二百二十九批边界：本批只新增 classification 到 ack/nack 的预案矩阵，不调用 validator，不执行 ack/nack，不改变 RabbitMQ 行为。
- 第二百三十批已完成 1 个 classification ack/nack 预案字符串和分类顺序稳定性场景：`NotificationInAppProviderListenerNoopPlanServiceTest` 新增 `buildPlanKeepsClassificationAckNackPlanClassificationsAndNextActionStable()`。
- 第二百三十批边界：本批只补测试和文档，不修改生产行为，不调用 validator，不执行 ack/nack。
- 第二百三十一批已完成 1 个 listener/validator dry-run 公开摘要文档场景：README RabbitMQ 队列边界新增当前 validator dry-run 边界，集中说明 validator gate、input adapter、classification ack/nack plan 和 listener 未注入 validator 的当前状态。
- 第二百三十一批边界：本批只补公开摘要文档，不修改生产代码，不改变 RabbitMQ 行为。
- 第二百三十二批已完成 1 个工具链路径澄清文档场景：README 环境要求修正为 `mvn` 未加入 PATH、仓库没有 Maven wrapper，但临时目录已有 `codex-maven-3.9.11`，且该 Maven 可识别 `C:\Program Files\Java\jdk-21.0.1`。
- 第二百三十二批边界：本批只修正文档中的工具链和验证状态，不改变 RabbitMQ 行为。
- 第二百三十三批已完成 1 个编译与测试基线恢复场景：修复 `NotificationInAppProviderListenerNoopPlanService` 中 `classificationAckNackPlan` 的错误挂载位置；修复 `MigrationJobServiceTest` completion/failure helper 依赖链；将 messaging plan 测试中的 `List<?>` / `Map<?, ?>` 断言机械收窄为明确类型；修复 4 个全量测试 fixture/期望漂移。
- 第二百三十三批验证：使用临时 Maven 和临时 mirror settings 执行完整 `mvn test`，结果 `Tests run: 795, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百三十四批已完成 1 个 consumer result extraction dry-run 契约场景：`NotificationInAppProviderListenerNoopPlanService.inputAdapterPlan` 新增 `consumerResultExtractionPlan`，描述未来从 `OrganizationProvisioningCompletedNotificationConsumeResult` 到 validator `consumerResult` 参数的提取契约；当前不读取专用 consumer 返回值，不构造真实入参，不调用 `classify(...)`，不改变 ack/nack。
- 第二百三十四批验证：`NotificationInAppProviderListenerNoopPlanServiceTest` 新增 extraction dry-run 测试，`NotificationInAppProviderAutoExecutionAdapterPlanServiceTest` 补嵌套断言；完整 `mvn test` 结果 `Tests run: 796, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百三十五批已完成 1 个 consumer result adapter 纯服务骨架场景：新增 `NotificationInAppProviderConsumerResultAdapterService`，只在独立 service 中把 ackable 且带 `sendPlan` 的 `OrganizationProvisioningCompletedNotificationConsumeResult` 包装成 validator 所需 `consumerResult` dry-run Map；blocked 场景覆盖 result 缺失、非 ackable、`sendPlan` 未生成/缺失。
- 第二百三十五批验证：新增 `NotificationInAppProviderConsumerResultAdapterServiceTest` 覆盖 4 个 adapter 边界；目标测试 `Tests run: 33, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 800, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百三十六批已完成 1 个 adapter 到 validator classify 的独立 dry-run bridge 场景：新增 `NotificationInAppProviderConsumerResultClassificationBridgeService`，在独立 service 中串联 `adapt(...)` 与 `classify(...)`，输出 adapter blocked、future validation blocked、future validation ready 对应的 return/throw 和 ack/nack 预案。
- 第二百三十六批边界与验证：本批不接 `NotificationRoutingRabbitListener`，不执行 manual execution，不执行 RabbitMQ ack/nack；目标测试 `Tests run: 35, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 804, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百三十七批已完成 1 个 listener no-op 到 bridge 的安全门 dry-run 场景：`NotificationInAppProviderListenerNoopPlanService.validatorInvocationGatePlan` 新增 `classificationBridgeGatePlan`，只描述未来 listener 调用 `NotificationInAppProviderConsumerResultClassificationBridgeService.classifyDryRun(...)` 的 bean/method、allowed 状态、next action 和 side-effect flags。
- 第二百三十七批边界与验证：本批不调用 bridge，不转发 consumer result，不执行 adapter/classify/manual execution/ack/nack；目标测试 `Tests run: 34, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 805, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百三十八批已完成 1 个 listener 正式接入 bridge 前的源码保护场景：`NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsClassificationBridgeOutOfListenerBeforeBridgeIntegration()`，锁定 listener 当前仍未注入 `NotificationInAppProviderConsumerResultClassificationBridgeService`、未调用 `classifyDryRun(...)`、未读取真实 `sendPlan/providerPlan/inAppExecutionPlan`、未执行手动 ack/nack/reject。
- 第二百三十八批边界与验证：本批只补源码保护测试，不修改生产代码；目标测试 `Tests run: 39, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 806, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百三十九批已完成 1 个 bridge 结果到 listener return/throw 决策矩阵 dry-run 场景：`classificationBridgeGatePlan` 新增 `bridgeOutcomeDecisionMatrix`，固定 adapter blocked、future validation blocked、future validation ready 三类结果到未来 return/throw 和 ack/nack 的映射。
- 第二百三十九批边界与验证：本批只扩展 no-op dry-run 预案，不调用 bridge，不修改 `NotificationRoutingRabbitListener`，不改变 RabbitMQ 行为；目标测试 `Tests run: 44, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 807, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百四十批已完成 1 个 bridge listener 接入安全门配置场景：新增 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_ENABLED`，默认 `false`；`classificationBridgeGatePlan` 必须同时满足 validator invocation ready 与 bridge gate enabled 才显示 ready，并输出独立 blocked reasons。
- 第二百四十批边界与验证：本批不接 `NotificationRoutingRabbitListener`，不调用 bridge，不改变 RabbitMQ 行为；目标测试 `Tests run: 51, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 809, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百四十一批已完成 1 个 listener bridge invocation policy 源码策略场景：`NotificationRoutingRabbitListenerTest` 新增 `sourceDocumentsFutureBridgeInvocationPolicyBeforeListenerIntegration()`，明确 `duplicate_without_send_plan` 不调用 bridge、保持 return，`consumed_adapter_blocked` / `consumed_validation_blocked` 才进入未来 throw/retry/DLQ，`consumed_validation_ready` 保持 return 等待 manual execution 结果批次。
- 第二百四十一批边界与验证：本批只补源码策略测试，不修改生产代码，不改变 RabbitMQ 行为；目标测试 `Tests run: 43, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 810, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百四十二批已完成 1 个 listener 最小 bridge dry-run 调用路径：`NotificationRoutingRabbitListener` 在专用 consumer 返回 ackable 且 `result.consumed()`、`classificationBridgeGatePlan.bridgeInvocationAllowed=true` 时调用 `NotificationInAppProviderConsumerResultClassificationBridgeService.classifyDryRun(result)`；duplicate 继续 bypass bridge 并 return。
- 第二百四十二批边界与验证：listener 当前只读取 no-op plan 中的 bridge gate，不读取真实 `sendPlan/providerPlan/inAppExecutionPlan`，不执行 manual execution，不新增手动 ack/nack/reject，bridge 结果不改变 return/throw；目标测试 `Tests run: 49, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 812, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百四十三批已完成 1 个 bridge dry-run 结果不改变 listener return/throw 的安全边界场景：`NotificationRoutingRabbitListenerTest` 新增 `onMessageKeepsReturnPolicyWhenBridgeDryRunReportsFutureThrowDecision()`，模拟 bridge 返回 future throw/retry 决策，确认当前 listener 仍 return。
- 第二百四十三批边界与验证：本批只补安全边界测试，不修改生产代码，不执行 manual execution，不新增手动 ack/nack/reject；目标测试 `Tests run: 50, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 813, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百四十四批已完成 1 个 bridge result 只读观测预案场景：`classificationBridgeGatePlan` 新增 `bridgeResultObservationPlan`，固定未来观测字段、log message key 和只读 side-effect flags。
- 第二百四十四批边界与验证：本批只扩展 no-op dry-run 预案，不修改 listener，不执行 observation/log/database write/manual execution/ack/nack；目标测试 `Tests run: 51, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 814, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百四十五批已完成 1 个 listener return/throw 正式切换前的独立配置安全门场景：新增 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_RETURN_THROW_ENABLED`，并在 `classificationBridgeGatePlan.bridgeReturnThrowPolicyGatePlan` 中固定默认 blocked、显式开启才 ready 的契约。
- 第二百四十五批边界与验证：本批不修改 listener，不根据 bridge 结果切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 53, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 816, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百四十六批已完成 1 个 listener 不读取 return/throw policy gate 的源码保护场景：`NotificationRoutingRabbitListenerTest` 新增 `sourceDoesNotReadBridgeReturnThrowPolicyGateBeforePolicySwitchIntegration()`，锁定 listener 当前只读取 `classificationBridgeGatePlan.bridgeInvocationAllowed`。
- 第二百四十六批边界与验证：本批只补源码保护测试，不修改生产代码，不读取 `bridgeReturnThrowPolicyGatePlan` / `futureReturnThrowDecision`，不执行 manual execution/ack/nack；目标测试 `Tests run: 54, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 817, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百四十七批已完成 1 个 return/throw policy gate ready 仍不触发 listener 策略切换的行为测试：`NotificationRoutingRabbitListenerTest` 新增 `onMessageKeepsReturnPolicyWhenReturnThrowPolicyGateIsReadyButSwitchNotIntegrated()`。
- 第二百四十七批边界与验证：本批只补行为安全边界测试，不修改生产代码；即使 `returnThrowPolicyChangeAllowed=true` 且 bridge 返回 future throw/retry，listener 仍 return，不执行 manual execution/ack/nack；目标测试 `Tests run: 55, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 818, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百四十八批已完成 1 个 bridge result 到 listener return/throw 策略的独立 dry-run 决策适配器场景：新增 `NotificationInAppProviderBridgeReturnThrowPolicyDecisionService`，只输出 future listener decision 预案，不应用策略。
- 第二百四十八批边界与验证：本批不接入 listener，不执行 manual execution/ack/nack；新增 3 个 service 测试覆盖 gate blocked、gate ready + future throw、bridge result missing；目标测试 `Tests run: 58, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 821, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百四十九批已完成 1 个 listener 正式接入决策适配器前的源码保护场景：`NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsReturnThrowPolicyDecisionServiceOutOfListenerBeforeIntegration()`，锁定 `NotificationInAppProviderBridgeReturnThrowPolicyDecisionService` 未注入、`decideDryRun(...)` 未调用。
- 第二百四十九批边界与验证：本批只补源码保护测试，不修改生产代码，不读取 `futureListenerDecision/decisionApplied/throwRequested`，不执行 manual execution/ack/nack；目标测试 `Tests run: 59, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 822, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百五十批已完成 1 个 return/throw 决策适配器只读观测预案场景：`NotificationInAppProviderBridgeReturnThrowPolicyDecisionService` 新增 `decisionObservationPlan`，固定 future observed fields、log message key 和只读 side-effect flags。
- 第二百五十批边界与验证：本批不接入 listener，不执行 observation/log/database write，不应用 return/throw 决策，不执行 manual execution/ack/nack；目标测试 `Tests run: 59, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 822, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百五十一批已完成 1 个 bridge classify 到 return/throw decision 的独立组合 dry-run 场景：新增 `NotificationInAppProviderBridgeReturnThrowDecisionDryRunService`，串联 bridge dry-run 与 policy decision dry-run，并输出合成预案。
- 第二百五十一批边界与验证：本批不接入 listener，不应用 return/throw 决策，不执行 manual execution/ack/nack；新增 3 个组合 service 测试，目标测试 `Tests run: 62, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 825, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百五十二批已完成 1 个 listener 正式接入组合 dry-run service 前的源码保护场景：`NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsReturnThrowDecisionDryRunCompositionOutOfListenerBeforeIntegration()`，锁定 `NotificationInAppProviderBridgeReturnThrowDecisionDryRunService` 未注入、组合 dry-run 未调用。
- 第二百五十二批边界与验证：本批只补源码保护测试，不修改生产代码，不读取 `policyDecisionPlan` / `bridgeDryRunExecuted` / `policyDecisionDryRunExecuted`，不执行 manual execution/ack/nack；目标测试 `Tests run: 63, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 826, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百五十三批已完成 1 个 listener 只读调用组合 dry-run 的独立安全门预案场景：新增 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_DECISION_DRY_RUN_ENABLED`，并在 `classificationBridgeGatePlan.bridgeDecisionDryRunInvocationGatePlan` 中固定默认 blocked、显式开启才 ready 的契约。
- 第二百五十三批边界与验证：本批不修改 listener，不执行组合 dry-run，不应用 return/throw 决策，不执行 manual execution/ack/nack；目标测试 `Tests run: 65, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 828, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百五十四批已完成 1 个 listener 读取组合 dry-run gate 前的源码保护场景：`NotificationRoutingRabbitListenerTest` 新增相关源码保护；第二百五十五批 read-only 接入后，该保护演进为 `sourceReadsBridgeDecisionDryRunInvocationGateOnlyForReadOnlyComposition()`。
- 第二百五十四批边界与验证：本批只补源码保护测试，不修改生产 listener，不执行组合 dry-run，不应用 return/throw 决策，不执行 manual execution/ack/nack；目标测试 `Tests run: 66, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 829, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百五十五批已完成 1 个 listener read-only 调用组合 dry-run 的行为边界：`NotificationRoutingRabbitListener` 注入 `NotificationInAppProviderBridgeReturnThrowDecisionDryRunService`，仅在 consumed、classification bridge gate ready 且 `decisionDryRunInvocationAllowed=true` 时调用组合 dry-run，并将 `bridgeReturnThrowPolicyGatePlan` 作为 policy gate 输入。
- 第二百五十五批边界与验证：decision dry-run gate 未 ready 时仍走 standalone `classifyDryRun`；本批不读取 `policyDecisionPlan`，不应用 `futureListenerDecision`，不改变 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 67, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 830, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百五十六批已完成 1 个 listener 忽略组合 dry-run 输出的行为边界：`NotificationRoutingRabbitListenerTest` 新增 `onMessageIgnoresDecisionDryRunOutputAndKeepsReturnPolicy()`，模拟组合 dry-run 返回 future throw 决策时，当前 listener 仍只读调用并保持 return。
- 第二百五十六批边界与验证：本批只补测试，不修改生产代码，不读取 `policyDecisionPlan`，不应用 `futureListenerDecision`，不执行 manual execution/ack/nack；目标测试 `Tests run: 68, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 831, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百五十七批已完成 1 个组合 dry-run 输出观测预案场景：`NotificationInAppProviderBridgeReturnThrowDecisionDryRunService` 新增 `decisionOutputObservationPlan`，固定 observed fields 与 `notification.in_app_provider.bridge_return_throw_decision_dry_run` log key。
- 第二百五十七批边界与验证：本批不修改 listener，不执行 observation/log/database write，不应用 return/throw 决策，不执行 manual execution/ack/nack；目标测试 `Tests run: 69, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 832, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百五十八批已完成 1 个 listener 读取 observation plan 前的源码保护场景：`NotificationRoutingRabbitListenerTest` 新增 `sourceDoesNotReadDecisionOutputObservationPlanBeforeLoggingIntegration()`，锁定 listener 不读取 `decisionOutputObservationPlan` / `logMessageKey`，不执行 observation/log/database write。
- 第二百五十八批边界与验证：本批只补测试，不修改生产代码，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 70, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 833, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百五十九批已完成 1 个组合 dry-run 输出 observation logging 独立安全门预案场景：新增 `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_DECISION_DRY_RUN_OBSERVATION_LOG_ENABLED`，并在 `bridgeDecisionDryRunInvocationGatePlan.decisionOutputObservationLoggingGatePlan` 中固定默认 blocked、显式开启才 ready 的契约。
- 第二百五十九批边界与验证：本批不修改 listener，不读取 `decisionOutputObservationPlan`，不执行 observation logging/database write，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 72, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 835, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百六十批已完成 1 个 listener 读取 observation logging gate 前的源码保护场景：`NotificationRoutingRabbitListenerTest` 新增 `sourceDoesNotReadDecisionOutputObservationLoggingGateBeforeIntegration()`，锁定 listener 不读取 `decisionOutputObservationLoggingGatePlan` / `observationLoggingAllowed`，不执行 log/database write。
- 第二百六十批边界与验证：本批只补测试，不修改生产代码，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 73, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 836, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百六十一批已完成 1 个 observation logging payload no-op 预案场景：`decisionOutputObservationLoggingGatePlan` 新增 `observationLoggingPayloadPlan`，固定未来日志 payload 字段契约。
- 第二百六十一批边界与验证：本批只描述 payload，不构造 payload，不执行 log/database write，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 74, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 837, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百六十二批已完成 1 个 listener 读取 observation logging payload plan 前的源码保护场景：`NotificationRoutingRabbitListenerTest` 新增 `sourceDoesNotReadObservationLoggingPayloadPlanBeforeIntegration()`，锁定 listener 不读取 `observationLoggingPayloadPlan` / `payloadFields`，不构造日志 payload，不执行 log/database write。
- 第二百六十二批边界与验证：本批只补测试，不修改生产代码，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 75, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 838, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百六十三批已完成 1 个 logging read-only payload 构造边界：新增 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunService`，只在 logging gate/source result/decision output observation plan 都 ready 时构造 payload preview。
- 第二百六十三批边界与验证：本批不接入 listener，不执行 log/database write，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 77, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 840, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百六十四批已完成 1 个 listener 正式注入/调用 payload dry-run service 前的源码保护场景：`NotificationRoutingRabbitListenerTest` 新增 `sourceDoesNotInjectObservationLogPayloadDryRunServiceBeforeIntegration()`，锁定 listener 不注入该 service，不调用 `buildDryRun(...)`，不读取 `payloadPreview`。
- 第二百六十四批边界与验证：本批只补测试，不修改生产代码，不接入 listener payload 构造，不执行 log/database write，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 78, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 841, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百六十五批已完成 1 个 listener 只读调用 payload dry-run service 行为边界：`NotificationRoutingRabbitListener` 在 decision dry-run gate ready 路径保存 `decisionDryRunPlan`，并只读调用 `buildDryRun(result, decisionDryRunPlan, decisionOutputObservationLoggingGatePlan(listenerNoopPlan))`。
- 第二百六十五批边界与验证：本批不执行 observation logging，不读取 payload preview 返回值，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 78, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 841, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百六十六批已完成 1 个 logging gate blocked 时 listener payload dry-run 行为边界：`NotificationRoutingRabbitListenerTest` 覆盖 observation logging gate blocked 时仍只把 blocked gate 传给 payload dry-run service。
- 第二百六十六批边界与验证：本批只补行为测试，不修改生产代码，不执行 log/database write，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 79, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 842, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百六十七批已完成 1 个 payload dry-run 返回值隔离边界：`NotificationRoutingRabbitListenerTest` 覆盖 payload dry-run 输出包含 `payloadPreview`、`throwRequested=true`、`rabbitNackExecuted=true` 时 listener 仍忽略返回值并保持当前策略。
- 第二百六十七批边界与验证：本批只补行为测试，不修改生产代码，不执行 log/database write，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 80, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 843, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百六十八批已完成 1 个正式 observation logging 前的 listener 源码保护场景：`NotificationRoutingRabbitListenerTest` 锁定 payload dry-run 接入后 listener 仍没有 Logger、日志调用、payload 输出读取或数据库写入痕迹。
- 第二百六十八批边界与验证：本批只补源码保护测试，不修改生产代码，不执行 log/database write，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 81, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 844, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百六十九批已完成 1 个只读 observation logging 预案 service：新增 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunService`，只在 logging gate 和 payload dry-run 都 ready 时生成 log 预览计划。
- 第二百六十九批边界与验证：本批不接入 listener，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 83, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 846, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百七十批已完成 1 个 listener 正式注入/调用 observation logging dry-run service 前的源码保护场景：`NotificationRoutingRabbitListenerTest` 锁定 listener 不注入该 service，不读取 log payload 预览，不执行日志或数据库写入。
- 第二百七十批边界与验证：本批只补源码保护测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 84, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 847, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百七十一批已完成 1 个 listener 只读调用 observation logging dry-run service 行为边界：listener 在 payload dry-run 后调用 `observationLogDryRunService.buildDryRun(payloadDryRunPlan, loggingGatePlan)`。
- 第二百七十一批边界与验证：本批不调用 Logger，不读取 observation log dry-run 返回值，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 84, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 847, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百七十二批已完成 1 个 observation log dry-run 返回值隔离边界：`NotificationRoutingRabbitListenerTest` 覆盖 observation log dry-run 输出包含 `logPayloadPreview`、`logExecuted=true`、`databaseWriteExecuted=true`、`rabbitNackExecuted=true` 时，listener 仍忽略返回值并保持当前策略。
- 第二百七十二批边界与验证：本批只补行为测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 85, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 848, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百七十三批已完成 1 个正式 Logger 接入前的源码保护边界：`NotificationRoutingRabbitListenerTest` 锁定 listener 在已调用 observation log dry-run service 的状态下仍不引入 Logger、日志调用、`eventConsumeLog`、`in_app_notification` 或 `databaseWrite` 痕迹。
- 第二百七十三批边界与验证：本批只补源码保护测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 86, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 849, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百七十四批已完成 1 个 observation logging 执行前的只读日志消息格式化预案：新增 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunService`，把 ready 的 observation log dry-run plan 转成 `formattedMessagePreview`，并固定 `loggerInvocationExecuted=false`。
- 第二百七十四批边界与验证：本批不接 listener，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 88, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 851, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百七十五批已完成 1 个 listener 正式接入 message dry-run service 前的源码保护边界：`NotificationRoutingRabbitListenerTest` 锁定 listener 不注入/调用 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunService`，不读取 `formattedMessagePreview` 或 `loggerInvocationExecuted`。
- 第二百七十五批边界与验证：本批只补源码保护测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 89, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 852, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百七十六批已完成 1 个 listener 只读调用 message dry-run service 行为边界：listener 在 observation log dry-run 后调用 `observationLogMessageDryRunService.buildDryRun(observationLogDryRunPlan)`。
- 第二百七十六批边界与验证：本批不读取 message dry-run 返回值，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 89, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 852, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百七十七批已完成 1 个 message dry-run 返回值隔离边界：`NotificationRoutingRabbitListenerTest` 覆盖 message dry-run 输出包含 `formattedMessagePreview`、`loggerInvocationExecuted=true`、`logExecuted=true`、`databaseWriteExecuted=true`、`rabbitNackExecuted=true` 时 listener 仍忽略返回值并保持当前策略。
- 第二百七十七批边界与验证：本批只补行为测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 90, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 853, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百七十八批已完成 1 个正式 Logger 接入前的最终源码保护边界：`NotificationRoutingRabbitListenerTest` 锁定 listener 在已接入 message dry-run service 后仍不读取 message 输出、不引入 Logger/日志调用/数据库写入痕迹。
- 第二百七十八批边界与验证：本批只补源码保护测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 91, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 854, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百七十九批已完成 1 个 logger invocation 安全门 dry-run 预案：新增 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunService`，根据 message dry-run plan 和 logger invocation gate 输出只读 Logger 调用计划，固定 `loggerInvocationExecuted=false`。
- 第二百七十九批边界与验证：本批不接 listener，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 93, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 856, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百八十批已完成 1 个 listener 正式接入 logger invocation dry-run service 前的源码保护边界：`NotificationRoutingRabbitListenerTest` 锁定 listener 不注入/调用 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunService`，不读取 `loggerInvocationPlanned`、`loggerNamePreview` 或 `logLevelPreview`。
- 第二百八十批边界与验证：本批只补源码保护测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 94, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 857, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百八十一批已完成 1 个 listener 只读调用 logger invocation dry-run service 行为边界：listener 在 message dry-run 后调用 `observationLoggerInvocationDryRunService.buildDryRun(messageDryRunPlan, loggerInvocationGatePlan(loggingGatePlan))`。
- 第二百八十一批边界与验证：本批不读取 logger invocation dry-run 返回值，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 94, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 857, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百八十二批已完成 1 个 logger invocation dry-run 返回值隔离边界：`NotificationRoutingRabbitListenerTest` 覆盖 logger invocation dry-run 输出包含 `loggerInvocationPlanned=true`、`loggerInvocationExecuted=true`、`logExecuted=true`、`databaseWriteExecuted=true`、`rabbitNackExecuted=true` 时 listener 仍忽略返回值并保持当前策略。
- 第二百八十二批边界与验证：本批只补行为测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 95, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 858, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百八十三批已完成 1 个正式 Logger 接入前的最终源码保护边界：`NotificationRoutingRabbitListenerTest` 锁定 listener 在已接入 logger invocation dry-run service 后仍不读取 logger invocation 输出、不引入 Logger/日志调用/数据库写入痕迹。
- 第二百八十三批边界与验证：本批只补源码保护测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 96, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 859, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百八十四批已完成 1 个真实 Logger 调用前的最小灰度执行合同：新增 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanService`，只有 `loggerInvocationPlanned=true`、`formattedMessagePreview` 非空且 `loggerExecutionAllowed=true` 时才返回 ready，并固定 `loggerExecutionRequiresExplicitGate=true`、`allowedLogLevel=INFO`、`allowedMessageSource=formattedMessagePreview`。
- 第二百八十四批边界与验证：本批不接 listener，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；新增源码红线测试确认 execution plan service 不持有 `Logger`/`LoggerFactory`、不调用 `.info/.warn/.error`、不写库、不手动 ack/nack/reject；目标测试 `Tests run: 99, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 862, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百八十五批已完成 1 个 listener 正式接入 logger execution plan service 前的源码保护边界：`NotificationRoutingRabbitListenerTest` 锁定当前 listener 仍不注入/调用 `NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanService`，不读取 `loggerExecutionAllowed/loggerExecutionPlanned/loggerExecutionRequiresExplicitGate/allowedLogLevel/allowedMessageSource`。
- 第二百八十五批边界与验证：本批只补源码保护测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 100, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 863, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百八十六批已完成 1 个 listener 只读调用 logger execution plan service 行为边界：`NotificationRoutingRabbitListener` 在 logger invocation dry-run 后调用 `observationLoggerExecutionPlanService.buildPlan(loggerInvocationDryRunPlan, loggerExecutionGatePlan(loggingGatePlan))`，并把依赖面更新为 14 个。
- 第二百八十六批边界与验证：本批不读取 logger execution plan 返回值，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 100, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 863, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百八十七批已完成 1 个正式 Logger 接入前的最终源码保护边界：`NotificationRoutingRabbitListenerTest` 锁定 listener 在已接入 logger execution plan service 后仍不读取 execution plan 输出、不引入 Logger/日志调用/数据库写入痕迹。
- 第二百八十七批边界与验证：本批只补源码保护测试，不修改生产代码，不调用 Logger，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 101, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 864, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百八十八批已完成 1 个正式 Logger 的最小灰度接入：`NotificationRoutingRabbitListener` 新增 `invokeLoggerIfPlanned(...)`，只在 execution plan 返回 `loggerExecutionPlanned=true`、`allowedLogLevel=INFO`、`allowedMessageSource=formattedMessagePreview` 且 `formattedMessagePreview` 非空时调用 `LOGGER.info(...)`。
- 第二百八十八批边界与验证：本批只接入受控 INFO 观测日志，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；历史“完全禁止 Logger”的源码红线已演进为“只允许 gated INFO Logger”，并继续禁止 `.warn/.error`、`eventConsumeLog/in_app_notification/databaseWrite` 和 `basicAck/basicNack/basicReject`；目标测试 `Tests run: 101, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 864, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百八十九批已完成 1 个 gated Logger 负向行为隔离测试：`NotificationRoutingRabbitListenerTest` 通过 logback `ListAppender` 验证 `loggerExecutionPlanned=false`、非 `INFO`、非 `formattedMessagePreview` source 或空消息时 listener 不输出 INFO 日志。
- 第二百八十九批边界与验证：本批只补测试，不修改生产代码，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 102, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 865, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百九十批已完成 1 个 `event_consume_log` 写库前 dry-run 预案：新增 `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogWritePlanService`，只有 `loggerExecutionPlanned=true`、`formattedMessagePreview` 非空且 `eventConsumeLogWriteAllowed=true` 时才返回 ready，并固定 `databaseWriteExecuted=false`、`sqlExecuted=false`。
- 第二百九十批边界与验证：本批不接 listener，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；源码红线确认该 service 不持有 repository/mapper/JdbcTemplate、不调用 insert/save/update/execute、不手动 ack/nack/reject；目标测试 `Tests run: 105, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 868, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百九十一批已完成 1 个 listener 正式接入 `event_consume_log` 写库预案 service 前的源码保护边界：`NotificationRoutingRabbitListenerTest` 锁定当前 listener 仍不注入/调用 `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogWritePlanService`，不读取 `eventConsumeLogWriteAllowed/databaseWritePlanned/sqlExecuted`。
- 第二百九十一批边界与验证：本批只补源码保护测试，不修改生产代码，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 106, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 869, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百九十二批已完成 1 个 listener 只读接入 `event_consume_log` 写库预案 service 场景：`NotificationRoutingRabbitListener` 注入 `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogWritePlanService`，在 gated Logger 后调用 `buildPlan(loggerExecutionPlan, eventConsumeLogWriteGatePlan(loggingGatePlan))`，只把 `observationLoggingAllowed` 映射为 `eventConsumeLogWriteAllowed`。
- 第二百九十二批边界与验证：listener 隔离忽略写库预案返回值，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；源码保护确认未引入 `JdbcTemplate/Repository/Mapper/insert/save/update/basicAck/basicNack/basicReject`；目标测试 `Tests run: 106, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 869, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百九十三批已完成 1 个 listener 对 `event_consume_log` 写库预案返回值的隔离源码测试：确认当前 listener 只调用 `observationEventConsumeLogWritePlanService.buildPlan(...)`，不把返回值赋给 `eventConsumeLogWritePlan`，不读取 `databaseWritePlanned/databaseWriteExecuted/sqlExecuted/rabbitNackExecuted`，也不手动 ack/nack/reject。
- 第二百九十三批边界与验证：本批只补测试，不修改生产代码，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 107, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 870, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百九十四批已完成 1 个真实 `event_consume_log` repository/SQL 集成前最终源码保护测试：确认当前 listener 仍只保留 `observationEventConsumeLogWritePlanService.buildPlan(...)` dry-run 调用，不注入 `EventConsumeLogRepository/EventConsumeLogMapper/JdbcTemplate`，不加事务，不读取 `targetTable/writeMode`，不调用 insert/save/update/execute。
- 第二百九十四批边界与验证：本批只补测试，不修改生产代码，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 108, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 871, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百九十五批已完成 1 个真实 `event_consume_log` repository 集成预案 dry-run service：新增 `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryIntegrationPlanService`，只有写库预案 `databaseWritePlanned=true`、`targetTable=event_consume_log` 且事件元数据完整时，才生成 `EventConsumeLogEntry` 预览和 `EventConsumeLogRepository.recordSuccess(EventConsumeLogEntry)` 方法预览。
- 第二百九十五批边界与验证：该 service 只生成纯内存预案，不注入 repository/JdbcTemplate，不调用 `recordSuccess/claimProcessing/markSuccess/markFailure`，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 111, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 874, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百九十六批已完成 1 个 listener 正式接入 repository integration plan service 前的源码保护测试：确认当前 listener 仍不注入/调用 `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryIntegrationPlanService`，不读取 `repositoryIntegrationPlanned/eventConsumeLogEntryPreview/repositoryClassPreview/repositoryMethodPreview/repositoryInvoked`，构造器依赖面仍为 15 个字段。
- 第二百九十六批边界与验证：本批只补测试，不修改生产代码，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 112, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 875, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百九十七批已完成 1 个 listener 只读接入 repository integration plan service 场景：`NotificationRoutingRabbitListener` 注入 `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryIntegrationPlanService`，在 `event_consume_log` 写库预案后调用 `buildPlan(writePlan, eventConsumeLogRepositoryMetadataPlan(properties))`，事件元数据来自 RabbitMQ header 和 `magic.notification.queue`。
- 第二百九十七批边界与验证：listener 构造器依赖面更新为 16；本批只把写库预案作为下一层 dry-run 输入，不读取 `repositoryIntegrationPlanned/eventConsumeLogEntryPreview/repositoryInvoked`，不注入真实 `EventConsumeLogRepository/JdbcTemplate`，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 112, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 875, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百九十八批已完成 1 个 listener 对 repository integration plan 返回值的隔离源码测试：确认当前 listener 只调用 `observationEventConsumeLogRepositoryIntegrationPlanService.buildPlan(...)`，不把返回值赋给 `repositoryIntegrationPlan`，不读取 `repositoryIntegrationPlanned/eventConsumeLogEntryPreview/repositoryInvoked/databaseWriteExecuted/sqlExecuted/rabbitNackExecuted`。
- 第二百九十八批边界与验证：本批只补测试，不修改生产代码，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 113, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 876, Failures: 0, Errors: 0, Skipped: 0`。
- 第二百九十九批已完成 1 个真实 `EventConsumeLogRepository` 调用前最终源码保护测试：确认当前 listener 仍不持有 `EventConsumeLogRepository` 字段，不赋值 `this.eventConsumeLogRepository`，不加事务，不调用 `recordSuccess/recordFailure/claimProcessing/markSuccess/markFailure`，也不引入 `JdbcTemplate/update/execute`。
- 第二百九十九批边界与验证：本批只补测试，不修改生产代码，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 114, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 877, Failures: 0, Errors: 0, Skipped: 0`。
- 第三百批已完成 1 个真实 repository 调用 dry-run 预案场景：新增 `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryCallPlanService`，只有 repository integration plan 已 ready、目标仓储为 `EventConsumeLogRepository`、方法为 `recordSuccess(EventConsumeLogEntry)` 且 `eventConsumeLogEntryPreview` 完整时，才输出 repository 调用参数和顺序预览。
- 第三百批边界与验证：本批只新增纯内存 plan service 和测试，不注入真实 `EventConsumeLogRepository/JdbcTemplate`，不调用 `recordSuccess/claimProcessing/markSuccess/markFailure`，不执行 SQL，不写数据库，不读取插入结果，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 117, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 880, Failures: 0, Errors: 0, Skipped: 0`。
- 第三百零一批已完成 1 个 listener 接入 repository call plan service 前的源码保护测试：`NotificationRoutingRabbitListenerTest` 新增 `sourceKeepsRepositoryCallPlanServiceOutBeforeListenerIntegration()`，确认 listener 当前仍不注入/调用 `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryCallPlanService`，不读取 `repositoryCallPlanned/repositoryArgumentPreview/insertedResultObserved`，构造器依赖面仍为 16 个字段。
- 第三百零一批边界与验证：本批只补测试，不修改生产代码，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 118, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 881, Failures: 0, Errors: 0, Skipped: 0`。
- 第三百零二批已完成 1 个 listener 只读接入 repository call plan service 场景：`NotificationRoutingRabbitListener` 注入 `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryCallPlanService`，将 repository integration plan 的返回值作为输入调用 `buildPlan(...)`，构造器依赖面更新为 17。
- 第三百零二批边界与验证：本批只把 repository call plan 接到 dry-run 链路尾部，listener 不保存或读取 `repositoryCallPlanned/repositoryArgumentPreview/insertedResultObserved`，不注入真实 `EventConsumeLogRepository/JdbcTemplate`，不调用 `recordSuccess/claimProcessing/markSuccess/markFailure`，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 118, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 881, Failures: 0, Errors: 0, Skipped: 0`。
- 第三百零三批已完成 1 个 listener 对 repository call plan 返回值的隔离源码测试：确认当前 listener 只调用 `observationEventConsumeLogRepositoryCallPlanService.buildPlan(...)`，不把返回值赋给 `repositoryCallPlan`，不读取 `repositoryCallPlanned/repositoryArgumentPreview/repositoryInvocationOrderPreview/insertedResultObserved/repositoryInvoked/databaseWriteExecuted/sqlExecuted/rabbitNackExecuted`。
- 第三百零三批边界与验证：本批只补测试，不修改生产代码，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 119, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 882, Failures: 0, Errors: 0, Skipped: 0`。
- 第三百零四批已完成 1 个真实 `EventConsumeLogRepository.recordSuccess` 执行前最终源码保护测试：确认 listener 在 repository call plan service 已接入后，仍不持有 `EventConsumeLogRepository` 字段，不构造 `EventConsumeLogEntry`，不调用 `recordSuccess(...)`，不读取 inserted 结果，不引入 `JdbcTemplate/@Transactional/update/execute`。
- 第三百零四批边界与验证：本批只补测试，不修改生产代码，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 120, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 883, Failures: 0, Errors: 0, Skipped: 0`。
- 第三百零五批已完成 1 个 `recordSuccess` 执行门控 dry-run 预案场景：新增 `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionGatePlanService`，只有 repository call plan 已 ready、目标仓储/方法/参数完整且 `recordSuccessExecutionAllowed=true` 时，才输出 `recordSuccessExecutionPlanned=true` 和未来调用参数预览。
- 第三百零五批边界与验证：该 service 只生成纯内存预案，不注入真实 `EventConsumeLogRepository/JdbcTemplate`，不调用 `recordSuccess/claimProcessing/markSuccess/markFailure`，不执行 SQL，不写数据库，不读取 inserted 结果，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 123, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 886, Failures: 0, Errors: 0, Skipped: 0`。
- 第三百零六批已完成 1 个 listener 接入 recordSuccess execution gate plan service 前的源码保护测试：当批确认 listener 仍不注入/调用 `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionGatePlanService`，不读取 `recordSuccessExecutionPlanned/recordSuccessExecutionAllowed/repositoryInvoked/insertedResultObserved`，构造器依赖面仍为 17 个字段；该保护在第三百零七批只读接入后已演进为接入后不执行仓储的源码测试。
- 第三百零六批边界与验证：本批只补测试，不修改生产代码，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 124, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 887, Failures: 0, Errors: 0, Skipped: 0`。
- 第三百零七批已完成 1 个 listener 只读接入 recordSuccess execution gate plan service 场景：`NotificationRoutingRabbitListener` 注入 `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionGatePlanService`，将 repository call plan 的返回值作为输入调用 `buildPlan(...)`，并通过 `recordSuccessExecutionGatePlan()` 固定传入 `recordSuccessExecutionAllowed=false`，构造器依赖面更新为 18。
- 第三百零七批边界与验证：本批只把 recordSuccess execution gate plan 接到 dry-run 链路尾部，listener 不保存或读取 `recordSuccessExecutionPlanned/repositoryInvoked/insertedResultObserved/databaseWriteExecuted/sqlExecuted`，不注入真实 `EventConsumeLogRepository/JdbcTemplate`，不调用 `recordSuccess/claimProcessing/markSuccess/markFailure`，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 124, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 887, Failures: 0, Errors: 0, Skipped: 0`。
- 第三百零八批已完成 1 个 listener 对 recordSuccess execution gate plan 返回值的隔离源码测试：确认当前 listener 只调用 `observationEventConsumeLogRecordSuccessExecutionGatePlanService.buildPlan(...)`，不把返回值赋给 `recordSuccessExecutionGatePlan`，不读取 `recordSuccessExecutionPlanned/repositoryInvoked/insertedResultObserved/databaseWriteExecuted/sqlExecuted/listenerPolicyChanged/decisionApplied/throwRequested`。
- 第三百零八批边界与验证：本批只补测试，不修改生产代码，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 125, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 888, Failures: 0, Errors: 0, Skipped: 0`。
- 第三百零九批已完成 1 个 listener 在 recordSuccess execution gate plan 只读接入后的真实 `recordSuccess` 执行前最终源码保护测试：确认当前 listener 即使已调用 `observationEventConsumeLogRecordSuccessExecutionGatePlanService.buildPlan(...)` 且固定传入 `recordSuccessExecutionAllowed=false`，仍不持有真实 `EventConsumeLogRepository`，不构造 `EventConsumeLogEntry`，不调用 `recordSuccess(...)`，不读取 inserted 结果，不引入 `JdbcTemplate/@Transactional`。
- 第三百零九批边界与验证：本批只补测试，不修改生产代码，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 126, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 889, Failures: 0, Errors: 0, Skipped: 0`。
- 第三百一十批已完成 1 个真实 recordSuccess 执行前显式开关 dry-run 预案场景：新增 `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionSwitchPlanService`，只有上游 execution gate plan ready、`recordSuccessExecutionPlanned=true`，且显式开关属性 `RABBITMQ_NOTIFICATION_EVENT_CONSUME_LOG_RECORD_SUCCESS_ENABLED` 匹配并开启时，才输出未来 execution adapter dry-run 预案。
- 第三百一十批边界与验证：该 service 只接收调用方传入的 switch plan，不读取环境变量，不注入真实 `EventConsumeLogRepository/JdbcTemplate`，不调用 `recordSuccess/claimProcessing/markSuccess/markFailure`，不执行 SQL，不写数据库，不读取 inserted 结果，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 129, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 892, Failures: 0, Errors: 0, Skipped: 0`。
- 第三百一十一批已完成 1 个 listener 接入 recordSuccess execution switch plan service 前的源码保护测试：确认当批 listener 仍不注入/调用 `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionSwitchPlanService`，不读取 `recordSuccessExecutionSwitchProperty/recordSuccessExecutionSwitchAllowed/recordSuccessExecutionAdapterPlanned`，不读取显式属性名 `RABBITMQ_NOTIFICATION_EVENT_CONSUME_LOG_RECORD_SUCCESS_ENABLED`，构造器依赖面仍为 18；该保护在第三百一十二批只读接入后已演进为接入后不执行仓储的源码测试。
- 第三百一十一批边界与验证：本批只补测试，不修改生产代码，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 130, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 893, Failures: 0, Errors: 0, Skipped: 0`。
- 第三百一十二批已完成 1 个 listener 只读接入 recordSuccess execution switch plan service 场景：`NotificationRoutingRabbitListener` 注入 `NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionSwitchPlanService`，将 execution gate plan 的返回值作为输入调用 `buildPlan(...)`，并通过 `recordSuccessExecutionSwitchPlan()` 固定传入 `RABBITMQ_NOTIFICATION_EVENT_CONSUME_LOG_RECORD_SUCCESS_ENABLED` 和 `recordSuccessExecutionSwitchAllowed=false`，构造器依赖面更新为 19。
- 第三百一十二批边界与验证：本批只把 recordSuccess execution switch plan 接到 dry-run 链路尾部，listener 不保存或读取 `recordSuccessExecutionAdapterPlanned/repositoryInvoked/insertedResultObserved/databaseWriteExecuted/sqlExecuted`，不注入真实 `EventConsumeLogRepository/JdbcTemplate`，不调用 `recordSuccess/claimProcessing/markSuccess/markFailure`，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 130, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 893, Failures: 0, Errors: 0, Skipped: 0`。
- 第三百一十三批已完成 1 个 listener 对 recordSuccess execution switch plan 返回值的隔离源码测试：确认当前 listener 只调用 `observationEventConsumeLogRecordSuccessExecutionSwitchPlanService.buildPlan(...)`，不把返回值赋给 `recordSuccessExecutionSwitchPlan`，不读取 `recordSuccessExecutionAdapterPlanned/repositoryInvoked/insertedResultObserved/databaseWriteExecuted/sqlExecuted/listenerPolicyChanged/decisionApplied/throwRequested`。
- 第三百一十三批边界与验证：本批只补测试，不修改生产代码，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 131, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 894, Failures: 0, Errors: 0, Skipped: 0`。
- 第三百一十四批已完成 1 个 listener 在 recordSuccess execution switch plan 只读接入后的真实 `recordSuccess` execution adapter 执行前最终源码保护测试：确认当前 listener 即使已调用 `observationEventConsumeLogRecordSuccessExecutionSwitchPlanService.buildPlan(...)` 且固定传入 `recordSuccessExecutionSwitchAllowed=false`，仍不持有真实 `EventConsumeLogRepository`，不构造 `EventConsumeLogEntry`，不调用 `recordSuccess(...)`，不读取 inserted 结果，不引入 `JdbcTemplate/@Transactional`。
- 第三百一十四批边界与验证：本批只补测试，不修改生产代码，不执行 SQL，不写数据库，不切换 return/throw，不执行 manual execution/ack/nack；目标测试 `Tests run: 132, Failures: 0, Errors: 0, Skipped: 0`，完整 `mvn test` 结果 `Tests run: 895, Failures: 0, Errors: 0, Skipped: 0`。
- 当前剩余流程评估（2026-07-06）：旧 mock event handler 路由覆盖已补齐，剩余重点约 8 条生产化流程，包括 RabbitMQ notification no-op/validator/manual execution 灰度接入、站内信 websocket/push 投递、Kafka outbox 生产消费闭环、Redis 缓存刷新联调、XXL-Job 真实调度补偿、微信支付/退款/会员权益真实链路、LLM/Agent/招商爬虫真实外部集成、真实数据库/中间件/部署观测联调。按一个高风险场景一批估算还需约 25 到 40 个小批次；环境齐全时主要闭环预计 3 到 6 周，完全替代并删除旧后端仍需至少 2 个完整发布周期稳定观察，现实估算约 6 到 10 周。
- 下一批建议继续按单个高风险场景推进：设计 recordSuccess execution adapter dry-run 预案，仍保持 dry-run，不直接写库、不切换 return/throw、不手动 ack/nack。
- 当前机器 Docker daemon 不可用，且 `3306/6379/9092/5672` 未发现监听，因此真实数据库、Redis、Kafka、RabbitMQ 的启动联调暂时无法完成；这不是代码编译或自动化测试失败。
- 使用真实数据库联调前，应从项目 `docker-compose.yaml` 中确认中心库、租户库、Redis 配置；Spring Boot 在宿主机运行时需把 compose 内部主机名 `mysql`、`redis` 改成 `127.0.0.1`。
- 第二批 `/api/user/info` 暂未完整拼接会员/组织开通资料；不要伪造会员有效状态，应在后续会员与支付批次迁移 `vip_membership`、`tenant_provisioning_job` 等中心库逻辑后补齐。

恢复推进条件：

```bash
java -version
mvn -version
cd apps/backend-springboot
mvn test
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

第四批原计划包含 `GET /api/park/{id}` 和角色接口；实际检查旧后端后发现 `GET /api/park/{id}` 不存在旧实现，角色接口涉及组织角色作用域，因此已调整为更低风险的 5 个只读接口。第五批已完成角色只读、反馈列表和菜单模板同步任务只读接口。第六批已完成厂房/租赁园区只读接口。第七批已完成门禁只读接口。第八批已完成维保模块首批只读接口。第九批已继续补齐维保模块只读接口。第十批已完成财务/租赁管理只读接口。第十一批已完成租户/工资/账单项目选项只读接口。第十二批已完成报销只读接口。第十三批已完成园区访客下拉、打卡定位、工作台日志和示例表格只读接口。第十四批已完成合众水表/电表读取和园区租赁统计只读接口。第十五批已完成厂房租赁、合同、客户总览和水电耗看板统计只读接口。第十六批已完成 HRM 员工列表/详情、可绑定账号、考勤配置和打卡地点只读接口。第十七批已完成 HRM 考勤列表、今日记录、月统计、请假申请列表和请假园区下拉只读接口。第十八批已完成 HR 轨迹列表、CRM 配置状态、CRM 概览、客户归属绑定列表和企微外部联系人日志列表只读接口。第十九批已完成 CRM 销售渠道列表、扫码记录列表、组织邀请码列表、组织开通状态和 failed_manual 开通任务列表只读接口。第二十批已完成公告列表、租户短信信息、租赁园区详情、analytics 合同总览和 analytics 园区统计只读接口。第二十一批已完成招商项目列表/园区下拉/详情、评分规则列表和采集源列表只读接口。第二十二批已完成招商雷达销售负责人、采集任务、信号事件、外部线索和企业画像列表只读接口。第二十三批已完成招商雷达采集任务详情/日志/任务项和信号事件详情/证据只读接口。第二十四批已完成招商雷达外部线索详情/证据和企业画像详情/信号/标签只读接口。第二十五批已完成招商雷达公开机会 effective 列表/筛选项/统计/进度和公开机会详情只读接口。第二十六批已完成招商雷达触达模板列表/统计/版本和触达任务列表/详情只读接口。第二十七批已完成招商雷达分析总览、获客、渠道、模板和销售分析只读接口。第二十八批已完成招商雷达线索列表/详情/评分拆解、SOP 待办列表和线索 SOP 明细只读接口。第二十九批已完成招商雷达触达建议、触达限制名单/审计和销售漏斗/ROI 分析只读接口。第三十批已完成招商雷达模板转化、爬虫运维摘要、爬虫健康、操作审计和调度状态只读接口。第三十一批已完成公开机会审计摘要/预览、采集任务详情、线索房源匹配快照和触达限制导出只读接口。第三十二批已完成总账单列表/详情、考勤设备异常日志、HR 轨迹导出视角和微信 APP 支付公开配置只读接口。第三十三批已完成营收看板、analytics 营收总览、会员退款订单列表、企业微信 GET 回调验证和测试路由只读接口。第三十四批已完成测试 POST、用户反馈提交、招商雷达触达模板预览、打卡定位更新和删除接口。第三十五批已完成访客更新/删除、车辆更新/删除和门禁设备状态更新接口。第三十六批已完成升降机更新/删除、消防设施更新/删除和变压器更新接口。第三十七批已完成变压器删除、卫生检查更新/删除和厂房维护更新/删除接口。第三十八批已完成租赁管理厂房更新/删除、请假申请更新/删除和门禁设备删除接口。第三十九批已完成系统部门更新/删除、系统菜单更新/删除和微信 JS-SDK 配置接口。第四十批已完成系统园区更新/软删、厂房软删、财务流水软删和员工软删接口。第四十一批已完成密码修改、访客公开登记、工资删除、招商删除和雷达评分规则更新接口。第四十二批已完成访客新增、车辆新增、门禁设备新增、招商项目更新和雷达采集源配置更新接口。第四十三批已完成财务流水更新、工资更新、员工更新、考勤上班打卡和考勤下班更新接口。

第四十四批已完成租户更新/删除和宿舍更新/删除接口。

第四十五批已完成系统角色权限码绑定/解绑、CRM 销售渠道新增/更新和 CRM 客户归属启停接口。

第四十六批已完成系统角色更新/删除、角色菜单权限增删和菜单模板同步 dry-run 接口。

第四十七批已完成招商雷达采集源启停、采集任务取消和触达模板启停接口。

第四十八批已完成招商雷达触达模板创建、更新、提交审批、审批通过和审批驳回接口。

第四十九批已完成招商雷达触达任务取消、线索负责人分配、SOP 提醒完成、带看预约创建和带看反馈完成接口。

第五十批已完成招商雷达触达限制解除申请/审批/驳回、房源标签更新和企业信号状态更新接口。

第五十一批已完成外部公开线索更新、线索跟进、线索关闭、触达任务创建和触达回复接口。

第五十二批已完成总账单导出数据、催缴短信预览、图片上传、总账单删除和组织邀请码撤销接口。

第五十三批已完成 CRM 客户归属新增、编辑、删除和转移接口。

第五十四批已完成招商雷达采集 URL 重新入队、卡住 RUNNING 回收、公开机会手工录入和公开机会 URL 导入接口。

第五十五批已完成旧园区更新路径兼容和触达限制批量导入接口。

第五十六批已完成 CRM H5 邀请二维码本地生成接口。

第五十七批已完成维保升降机、消防设施、变压器、卫生检查和厂房维护新增主表接口。

第五十八批已完成当前用户打卡定位新增、系统部门 mock 新增和系统菜单新增接口。

第五十九批已完成租赁管理厂房新增、请假申请新增和招商项目新增主表接口。

第六十批已完成财务流水新增和工资记录新增主表接口。

第六十一批已完成旧园区新增和宿舍新增主表接口。

第六十二批已完成旧厂房新增、租户新增、报销新增和招商项目旧路径更新接口。

第六十三批已完成旧厂房更新、系统园区新增和旧园区删除路径兼容接口。

第六十四批已完成工资同步和财务批量软删接口。

第六十五批已完成 HR 员工新增、报销审核、报销删除和系统角色新增接口。

第六十六批已完成总账单新增、更新、催缴短信 RabbitMQ 投递兼容入口和授权园区内批量删除接口。

第六十七批已完成登录验证码、页面访问验证码发送/校验、单条合同提醒短信排队和批量合同提醒短信排队接口。

第六十八批已完成表计本地统计和企业微信 POST 回调本地记录接口。

第六十九批已完成用户新增、更新、软删除和当前账号注销接口。

第七十批已完成菜单模板同步 execute 兼容入口，当前只登记中心库审计 job/log，不直接执行跨租户菜单写入。

第七十一批已完成组织邀请码创建和加入接口。创建只写中心库邀请码；加入只处理已有组织空间的本地账号、角色、映射、成员、日志和 token 失效，不触发组织开通或支付。

第七十二批已完成招商雷达外部公开线索转换、企业信号转换和线索评分重算接口。转换接口只写共享雷达库本地企业、线索和关联状态；评分重算只使用现有信号/证据/评分规则，不刷新信号、不 seed 规则、不触发爬虫或房源匹配重建。

第七十三批已完成招商雷达信号刷新、企业画像刷新和线索批量评分重算接口。刷新逻辑只基于现有本地数据派生，不执行旧端自动 DDL、默认规则 seed、公开爬虫、导入或房源匹配重建。

第七十四批已完成触达任务本地发送/模拟发送、公开需求页 HTML 解析、公开机会历史修复和从公开机会重建外部线索接口。触达发送当前是本地兼容状态写入，不连接短信/企微；公开机会解析和重建均不访问外部网络。

第七十五批已完成公开机会采集任务、调度 start/stop、单平台采集运行和批量采集运行接口。当前只创建本地任务/状态/审计，不启动真实爬虫、不访问外部网络，后续接 XXL-Job/Kafka worker。

第七十六批已完成招商雷达爬虫任务手动触发本地队列接口。当前只创建 `crawler_task` PENDING 任务、任务日志和操作审计，不执行适配器、不访问外部网络、不扫描真实合同。

第七十七批已完成招商雷达内部合同到期同步、JSON 线索导入、房源匹配单条/批量重建和本地主动获客 pipeline 重建接口。当前只用本地数据库派生数据，不解析上传文件、不调用短信/企微、不启动真实 crawler/worker。

第七十八批已完成 CRM 邀请 URL Link、小程序码、OAuth start、邀请解析和销售联系方式本地兼容接口。当前只读/写中心库 CRM 本地表，不连接微信或企业微信外部 API。

第七十九批已完成 CRM 销售二维码、小程序测试码、请假园区旧 `park` 路由和企业微信 GET/POST 回调显式路由。当前二维码均为本地 PNG data URL，企微回调只做本地验证/记录，不连接微信或企业微信外部 API。

第八十批已完成总账单旧工具路由显式兼容、微信 OAuth callback 本地回跳、总账单 Excel LLM 占位解析和租户图片 LLM 占位解析。当前均为本地兼容，不连接微信、百炼或其他外部 API。

第八十一批已完成 GET 改密兼容说明、微信支付本地查单、小程序 session/phone 本地校验和智谱 chat 本地占位。当前均为本地兼容，不连接微信、智谱或支付外部 API。

第八十二批已完成微信支付预下单、支付通知、退款、退款通知和组织开通 failed_manual 重排的本地兼容版。当前只做本地快照、回调 ACK 和任务状态重置，不连接微信支付、不处理验签解密、不执行会员权益或组织开通 worker。

第一百一十八批已完成退款成功后的会员权益回滚真实执行。2026-07-02 复核后的路由状态仍为 `oldHandlers=386 java=397 missing=0 extra=11`；旧 mock 的 event handler 路由覆盖已经补齐。后续重点不再是补旧接口数量，而是按每批最多 5 个接口或 1 个 worker/外部集成场景，继续推进组织开通 worker 锁定/执行、真实退款创建、真实 LLM、微信支付真实下单、RabbitMQ/XXL-Job 联调、Kafka outbox 生产链路和真实数据库验收。
