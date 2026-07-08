# backend-springboot 项目学习文档

> 本文档用于 Java 后端新人入职和长期维护。当前进度：已完成本轮 12 步项目带读，后续按业务模块持续补充细节。

## 阅读路线

1. 项目整体架构
2. 目录结构
3. 启动流程
4. 典型接口调用链
5. 数据库设计
6. Redis 使用
7. 登录与鉴权流程
8. 业务模块
9. 定时任务与 XXL-Job
10. 公共组件
11. 配置中心与环境配置
12. 代码协作规范
13. 常见开发位置、新人路线、Debug 路线与源码阅读顺序

## 主题索引

| 你要查的内容 | 对应章节 |
| --- | --- |
| 项目简介 | `1.1 项目定位` |
| 技术栈 | `1.3 技术栈与用途` |
| 项目结构 | `2. 目录结构` |
| 启动流程 | `3. 项目启动流程` |
| 请求流程 | `4. 典型接口调用链：登录接口`、`12.8 一个典型业务接口的协作图` |
| 数据流 | `3.6 数据库如何初始化`、`4.3 完整调用流程图`、`8.2 核心业务关系图` |
| Redis | `6. Redis 使用` |
| 数据库 | `5. 数据库设计` |
| 登录流程 | `7. 登录与权限流程` |
| 权限流程 | `7.6 请求鉴权流程`、`7.9 权限码和菜单权限` |
| 核心业务 | `8. 业务模块` |
| MQ | `8.11 MQ 专项：Kafka、RabbitMQ 与 Outbox` |
| 定时任务 | `9. 定时任务与 XXL-Job` |
| 公共组件 | `10. 公共组件` |
| 配置中心 | `11. 配置中心与环境配置` |
| 代码规范 | `12. 代码协作规范` |
| 常见开发位置 | `13. 常见开发位置` |
| 新人开发路线 | `14. 新人开发路线` |
| Debug 路线 | `15. Debug 路线` |
| 阅读源码顺序 | `16. 阅读源码顺序` |
| 注意事项 | `17. 注意事项` |

## 1. 项目整体架构

### 1.1 项目定位

`apps/backend-springboot` 是 Vben Admin 迁移中的 Java 后端工程。它不是一个从零开始的新系统，而是用于逐步替换旧 `apps/backend-mock` Nitro/Prisma 后端的 Spring Boot 服务。

当前后端统一使用 `/api` 作为上下文路径，目标是保持旧前端协议不变，让前端可以逐个接口切换到 Java 实现。

从代码形态看，这个项目有三个核心特征：

- **迁移型后端**：大量接口在迁移过程中保持旧接口字段、旧错误文案和旧数据兼容逻辑。
- **多租户架构**：中心库保存账号、租户、组织、刷新 token、消息 outbox 等全局数据；租户库保存具体业务数据。
- **安全灰度架构**：Kafka、RabbitMQ、XXL-Job、Redis 清理、通知发送等高副作用能力大多有独立开关，默认偏保守，便于企业项目分批上线。

### 1.2 总体架构图

```mermaid
flowchart LR
  FE[Vue / Vben Admin 前端] -->|HTTP /api| APP[Spring Boot WebMVC]

  APP --> AUTH[AuthFilter + JwtService]
  AUTH --> CTX[TenantContext ThreadLocal]

  APP --> CENTER[(中心库 MySQL)]
  APP --> REG[TenantDataSourceRegistry]
  REG --> TENANT[(租户库 MySQL)]

  APP --> REDIS[(Redis)]
  APP --> KAFKA[(Kafka)]
  APP --> RABBIT[(RabbitMQ)]
  XXL[XXL-Job Admin] --> APP

  APP --> EXT[第三方平台接口]
```

这张图要重点看两条线：

- 请求进入 Spring Boot 后，`AuthFilter` 解析 JWT，把当前用户、租户、数据库名放入 `TenantContext`。业务代码通过 `TenantJdbcTemplateProvider` 拿到当前租户库连接。
- 中心库和租户库是分开的。中心库用固定 `centerJdbcTemplate`，租户库由 `TenantDataSourceRegistry` 按 `customerId/dbName` 动态创建并缓存连接池。

### 1.3 技术栈与用途

| 技术 | 项目证据 | 在项目里的用途 | 为什么这样设计 | 必读代码 |
| --- | --- | --- | --- | --- |
| Java 17 | `pom.xml` 的 `java.version` | 后端运行语言版本 | Java 17 是 Spring Boot 4 的合理基线，兼顾长期支持和现代语法 | `pom.xml` |
| Maven | `pom.xml` | 依赖管理、构建、测试入口 | Java 后端标准构建工具，适合独立 Spring Boot 服务 | `pom.xml` |
| Spring Boot 4.1.0 | `spring-boot-starter-parent`、`@SpringBootApplication` | 应用启动、自动配置、Bean 管理 | 企业 Java 后端主流底座，减少基础设施样板代码 | `BackendSpringbootApplication.java` |
| Spring WebMVC | `spring-boot-starter-webmvc` | 提供 Controller、Filter、JSON HTTP API | 当前项目是传统管理后台 API，WebMVC 模型直接、易排查 | `auth/AuthController.java`、`security/AuthFilter.java` |
| Spring JDBC / HikariCP | `spring-boot-starter-jdbc`、`DataSourceConfig`、大量 `JdbcTemplate` | 连接中心库和租户库，执行 SQL | 迁移期表结构和字段存在漂移，`JdbcTemplate` 比强 ORM 更容易做兼容查询和灰度写入 | `config/DataSourceConfig.java`、`tenant/TenantDataSourceRegistry.java` |
| MySQL | `mysql-connector-j`、数据库 URL 配置 | 中心库和租户库的关系型存储 | 业务数据强关系、需要事务和复杂查询 | `application.yml`、`config/DatabaseUrl.java` |
| MyBatis-Plus | `mybatis-plus-spring-boot4-starter`、`@MapperScan`、`MybatisPlusConfig` | 项目已接入分页拦截、字段下划线映射等能力；当前迁移代码仍以 `JdbcTemplate` 为主 | 为后续标准 CRUD 或 Mapper 化保留能力，但复杂迁移接口先用显式 SQL 控制风险 | `config/MybatisPlusConfig.java` |
| Redis | `spring-boot-starter-data-redis`、`RedisConfig`、`CacheService`、`SmsCodeService` | 缓存菜单、权限码、短信验证码、部分迁移后缓存刷新 | 高频读数据适合缓存；验证码必须有 TTL；迁移事件可通过 Redis 清理降低脏数据风险 | `config/RedisConfig.java`、`cache/CacheService.java`、`auth/SmsCodeService.java` |
| JWT / JJWT | `jjwt-*`、`JwtService` | 生成和校验访问 token、刷新 token | 前后端分离后台常用无状态登录方案；token 内携带租户定位信息，便于动态切库 | `security/JwtService.java`、`security/UserTokenPayload.java` |
| BCrypt | `spring-security-crypto`、`BCryptPasswordEncoder` | 登录密码校验和修改密码哈希 | 不引入完整 Spring Security，只复用安全密码哈希算法，减少迁移期改造面 | `auth/AuthService.java`、`system/user/SystemUserService.java` |
| Kafka | `spring-boot-starter-kafka`、`@EnableKafka`、`OutboxService`、`@KafkaListener` | 核心业务事件流，当前重点是组织开通完成事件 | 关键事件先写 outbox，再异步派发，可降低业务事务和消息发送不一致风险 | `messaging/OutboxService.java`、`messaging/OutboxDispatcher.java` |
| RabbitMQ | `spring-boot-starter-amqp`、`@EnableRabbit`、`RabbitMqConfig`、`@RabbitListener` | 通知、轻任务、延迟重试、死信队列 | RabbitMQ 适合任务分发和延迟重试；项目把它和 Kafka 分工开，Kafka 管事件流，RabbitMQ 管通知/任务 | `messaging/rabbit/RabbitMqConfig.java`、`messaging/NotificationRoutingRabbitListener.java` |
| XXL-Job | `xxl-job-core`、`XxlJobConfig`、`@XxlJob` | 迁移任务、补偿任务、对账、同步、扫描类任务入口 | 定时/批处理任务从 Web 请求中拆出来，便于审计、重跑和灰度执行 | `job/XxlJobConfig.java`、`job/BackendMigrationJobHandlers.java` |
| Spring Scheduling | `@EnableScheduling`、`@Scheduled` | 本地定时派发 outbox | 小型内部轮询任务可先用 Spring 调度，复杂跨实例任务交给 XXL-Job | `messaging/OutboxDispatcher.java` |
| Bean Validation | `spring-boot-starter-validation`、Controller 中的 `@Valid` | 请求参数校验 | 参数入口尽早失败，减少 Service 内部重复判空 | 后续在接口章节展开 |
| Actuator | `spring-boot-starter-actuator`、`management.endpoints` | 健康检查和基础运行探针 | 便于部署平台判断服务存活和依赖状态 | `health/InfrastructureHealthController.java`、`application.yml` |
| ZXing | `com.google.zxing`、`SimpleQrCodeGenerator` | 生成二维码 | CRM 等场景需要二维码生成能力，使用成熟库避免手写编码算法 | `crm/SimpleQrCodeGenerator.java` |

### 1.4 当前没有发现的技术

本次扫描没有发现以下技术在 Java 后端中实际接入：

- Spring Cloud Gateway
- Nacos
- Apollo
- Sa-Token
- Shiro
- 完整 Spring Security 认证链
- Elasticsearch
- MinIO / OSS
- Quartz
- WebSocket
- RocketMQ
- MongoDB

注意：没有发现不代表业务永远不需要，只代表当前 Java 工程没有相应依赖、配置或典型注解/客户端使用。后续如果引入，需要在本文档新增独立章节。

### 1.5 关键设计思想

#### 1.5.1 中心库 + 租户库

企业 SaaS 或多组织系统通常会把全局账号、组织、租户关系放在中心库，把业务数据放在租户库。本项目也是这个方向。

这样设计的原因：

- 全局登录、组织开通、用户租户映射需要跨租户统一管理。
- 租户业务数据隔离更强，后续扩容、迁移、备份和灰度更灵活。
- JWT payload 里带 `customerId/dbName` 后，业务请求可以快速定位租户库。

最值得读：

- `tenant/TenantDataSourceRegistry.java`
- `tenant/TenantJdbcTemplateProvider.java`
- `security/AuthFilter.java`
- `auth/AuthService.java`

#### 1.5.2 迁移期优先显式 SQL

虽然项目接了 MyBatis-Plus，但大量业务代码直接使用 `JdbcTemplate`。这不是随意写法，而是迁移期的工程取舍。

这样设计的原因：

- 旧系统表字段存在命名漂移，需要按 `information_schema.columns` 做兼容判断。
- 很多接口要保持旧前端返回字段，不适合强绑定 Entity。
- 写接口需要严格白名单字段和副作用边界，显式 SQL 更容易审计。

这里体现的是 **Repository 模式**：Controller 不直接写 SQL，Service 组织业务规则，Repository 负责数据访问。

最值得读：

- `rental/tenant/RentalTenantRepository.java`
- `bill/AmountBillRepository.java`
- `menu/MenuRepository.java`

#### 1.5.3 高副作用能力默认灰度

Kafka、RabbitMQ、XXL-Job、通知发送、Redis 清理等都不是简单“写了就开”。配置里有大量 `enabled/required/*-enabled` 开关。

这样设计的原因：

- 当前项目处于重构迁移阶段，不能让新服务无意触发支付、短信、通知、组织开通、财务同步等副作用。
- 企业项目上线通常要先 dry-run、再灰度、再全量。
- 任务和消息需要幂等、重试、死信、审计，而不是 Controller 里直接发。

相关设计模式：

- **Outbox Pattern**：业务事件先落库，再由调度器派发 Kafka。
- **Consumer Idempotency**：消费日志防止重复处理。
- **Feature Toggle**：通过配置开关控制新能力是否执行。

最值得读：

- `messaging/OutboxRepository.java`
- `messaging/OutboxService.java`
- `messaging/OutboxDispatcher.java`
- `messaging/rabbit/RabbitMqConfig.java`
- `job/BackendMigrationJobHandlers.java`

### 1.6 Step 1 必读源码顺序

第一遍不要从业务大类开始读，先按下面顺序建立全局地图：

1. `pom.xml`：确认工程类型和依赖。
2. `src/main/resources/application.yml`：确认端口、上下文路径、数据库、Redis、Kafka、RabbitMQ、XXL-Job 配置。
3. `BackendSpringbootApplication.java`：确认启动注解和开启的基础能力。
4. `config/DataSourceConfig.java`：理解中心库连接。
5. `tenant/TenantDataSourceRegistry.java`：理解租户库动态连接。
6. `security/AuthFilter.java` 和 `security/JwtService.java`：理解请求如何拿到当前租户上下文。
7. `common/ApiResponse.java` 和 `common/GlobalExceptionHandler.java`：理解统一响应和异常格式。

## 2. 目录结构

### 2.1 总体结构

Java 后端主代码位于：

```text
src/main/java/cn/yizuw/magic/backend
├── access
├── agent
├── auth
├── bill
├── cache
├── common
├── config
├── crm
├── dashboard
├── dormitory
├── example
├── factory
├── finance
├── health
├── hrm
├── image
├── integration
├── investment
├── job
├── llm
├── localization
├── maintenance
├── menu
├── messaging
├── notices
├── organization
├── park
├── permission
├── reimbursement
├── rental
├── security
├── smartmeter
├── sms
├── status
├── system
├── tenant
└── user
```

资源文件位于：

```text
src/main/resources
├── application.yml
├── application-local.yml
├── application-prod.yml
└── db
    └── manual
        ├── 001-event-outbox.sql
        └── 002-in-app-notification.sql
```

这个项目不是传统的：

```text
controller
service
mapper
entity
```

这种横向分层结构，而是更偏企业项目常见的 **按业务域纵向分包**：

```text
rental/tenant
├── RentalTenantController.java
├── RentalTenantService.java
├── RentalTenantRepository.java
├── RentalTenantCreateRequest.java
├── RentalTenantUpdateRequest.java
├── RentalTenantListQuery.java
└── ...
```

### 2.2 为什么按业务域分包

按业务域分包的好处是：一个模块的 Controller、Service、Repository、Request、Query 放在一起，读某个业务时不需要在全项目目录间来回跳。

在迁移型项目里，这种设计尤其有价值：

- 每个接口是按批次迁移的，业务包内能看到该模块迁移到什么程度。
- 不同模块有不同的旧接口兼容逻辑，放在同一业务包里更容易审计。
- 复杂 SQL、字段漂移兼容和返回字段适配通常只影响本业务域，减少跨包扩散。

这里主要体现了两类设计：

- **分层架构**：Controller 负责 HTTP，Service 负责编排业务规则，Repository 负责数据库访问。
- **领域分包**：按业务能力组织代码，而不是按技术角色组织全部代码。

### 2.3 核心基础目录

| 目录 | 职责 | 重要程度 | 先读建议 |
| --- | --- | --- | --- |
| `config` | Spring 配置、数据源、Redis、MyBatis-Plus、Web/CORS、统一配置属性 | 很高 | 必读 |
| `common` | 统一响应、分页对象、业务异常、全局异常处理 | 很高 | 必读 |
| `security` | JWT 生成/校验、请求过滤器、token payload | 很高 | 必读 |
| `tenant` | 多租户上下文、租户库动态数据源、当前租户 JdbcTemplate | 很高 | 必读 |
| `cache` | Redis 缓存封装 | 高 | Redis 章节重点读 |
| `permission` | 权限码读取和缓存 | 高 | 登录/权限章节重点读 |
| `health` | 基础设施健康检查 | 中 | 部署或排障时读 |
| `status` | 状态/测试类接口 | 低 | 前期可跳过 |
| `example` | 示例接口 | 低 | 前期可跳过 |

基础目录是理解整个项目的入口。尤其是 `security` 和 `tenant`，不理解它们就很难读懂为什么业务 Repository 不直接注入固定数据源。

### 2.4 登录、用户和权限目录

| 目录 | 职责 | 重要程度 | 必读代码 |
| --- | --- | --- | --- |
| `auth` | 登录、验证码、刷新 token、修改密码 | 很高 | `AuthController`、`AuthService`、`AuthRepository`、`SmsCodeService` |
| `user` | 当前用户信息、用户反馈等前台用户接口 | 高 | `UserInfoController`、`UserInfoService`、`UserInfoRepository` |
| `system/user` | 系统用户管理 | 很高 | `SystemUserController`、`SystemUserService`、`SystemUserRepository` |
| `system/role` | 系统角色、角色权限 | 很高 | `SystemRoleController`、`SystemRoleService`、`SystemRoleRepository` |
| `system/menu` | 系统菜单维护入口 | 高 | `SystemMenuController` |
| `menu` | 前端路由菜单、菜单树、菜单缓存 | 很高 | `MenuController`、`MenuService`、`MenuRepository`、`MenuTreeBuilder` |
| `permission` | 权限码查询和 Redis 缓存 | 很高 | `PermissionService` |

这一组目录是后台管理系统的主线：登录后拿用户信息，再拿菜单和权限码，前端据此渲染页面和按钮。

### 2.5 核心业务目录

| 目录 | 职责 | 重要程度 | 说明 |
| --- | --- | --- | --- |
| `park` | 园区、园区范围、园区图片 | 很高 | 多数业务都按园区授权过滤 |
| `rental/tenant` | 租户、工资、合同相关租赁业务 | 很高 | 当前项目最值得读的业务模块之一 |
| `bill` | 总账单、费用明细、收款、催缴短信预览 | 很高 | SQL 复杂、业务规则多 |
| `factory` | 厂房、楼层、租赁管理 | 高 | 与租户、园区、招商相关 |
| `dormitory` | 宿舍管理 | 中 | 业务相对独立 |
| `finance` | 财务记录 | 高 | 与租赁账单、同步副作用有关 |
| `reimbursement` | 报销申请、审核 | 高 | 涉及权限和财务副作用边界 |
| `maintenance` | 维保、消防、变压器、卫生检查等 | 中 | 模块多但可后读 |
| `access` | 门禁、访客、车辆、设备 | 高 | 包含公开访客登记和有权限的后台接口 |
| `hrm` | 员工、考勤、请假、轨迹 | 高 | 涉及员工账号绑定和考勤写入 |
| `localization` | 定位打卡记录 | 中 | HRM 相关 |
| `dashboard` | 首页、工作台、统计分析 | 中 | 多为聚合查询，适合第二轮读 |
| `notices` | 通知列表 | 中 | 与消息通知有关 |
| `smartmeter` | 智能表品牌 | 中 | 业务较独立 |

建议第一轮重点读 `park`、`rental/tenant`、`bill`。原因是很多模块都依赖园区权限，租赁和账单又是项目业务主干。

### 2.6 异步、消息和任务目录

| 目录 | 职责 | 重要程度 | 说明 |
| --- | --- | --- | --- |
| `messaging` | Kafka outbox、Kafka consumer、RabbitMQ listener、通知计划、消费幂等 | 很高 | 项目异步架构核心 |
| `messaging/rabbit` | RabbitMQ 交换机、队列、路由、发送入口 | 很高 | 需要单独章节分析 |
| `job` | XXL-Job 执行器、迁移任务、组织开通、对账、补偿任务 | 很高 | 需要单独章节分析 |

这两个目录前期不要从细节一行行读，因为类非常多。正确读法是先搞懂三件事：

1. Kafka 事件如何从 outbox 发出去。
2. RabbitMQ 如何做通知和轻任务。
3. XXL-Job 如何通过参数控制 dry-run 和 execute。

### 2.7 外部集成目录

| 目录 | 职责 | 重要程度 | 说明 |
| --- | --- | --- | --- |
| `integration/hezhong` | 合众平台接口 | 中 | 表计/设备相关外部服务 |
| `integration/ymsino` | 亿玛表计平台接口 | 中 | 表计数据查询 |
| `integration/wechat` | 微信支付、JS-SDK、退款、通知验签 | 高 | 支付相关要谨慎读 |
| `integration/wework` | 企业微信回调 | 中 | 通知/CRM 相关 |
| `crm` | CRM、销售二维码、客户绑定、扫码记录 | 高 | 和中心库、二维码、企微有关 |
| `investment` | 招商、雷达、公开机会、触达、爬虫任务 | 高但复杂 | 建议业务主线读完后再深入 |

外部集成目录一般不是第一天就啃完。企业项目里外部系统最容易有副作用、签名、重试、幂等、回调安全等问题，读的时候要先找配置和安全边界。

### 2.8 文件命名规律

大多数业务包遵循下面的协作方式：

```text
XxxController      接收 HTTP 请求，做参数绑定和基础校验
XxxService         组织业务流程、权限范围、事务边界、缓存清理
XxxRepository      执行 SQL，做数据库字段兼容和结果映射
XxxRequest         POST/PUT 请求体
XxxQuery           GET 查询参数
XxxResponse        明确返回模型，当前项目部分接口也直接返回 Map 兼容旧前端
XxxConfig          Spring Bean 或第三方客户端配置
XxxListener        MQ 消费入口
XxxPublisher       MQ 发送入口
XxxJobHandlers     XXL-Job 任务入口
```

当前项目较少使用传统 `Entity/DTO/VO` 全套结构，原因是迁移期很多接口要兼容旧字段，直接定义 `Request/Query/Response` 或返回 `Map<String, Object>` 更灵活。后续稳定模块可以逐步收敛成更明确的 DTO/VO。

### 2.9 第一轮阅读优先级

第一轮建议按这个顺序读：

1. `config`、`common`、`security`、`tenant`
2. `auth`、`user`、`menu`、`permission`
3. `system/user`、`system/role`、`park`
4. `rental/tenant`
5. `bill`
6. `messaging`、`job`
7. `integration`、`crm`、`investment`

暂时可以先不用看的目录：

- `example`：示例接口。
- `status`：状态/测试接口。
- `llm`、`agent`：AI/助手相关，除非当前开发任务涉及。
- `maintenance`、`smartmeter`、`dormitory`：业务相对独立，可在主线读完后补。
- `investment`：类多且业务链长，建议第二轮专题阅读。

### 2.10 Step 2 必读源码

这一节最值得打开的文件：

- `auth/AuthController.java`
- `auth/AuthService.java`
- `tenant/TenantJdbcTemplateProvider.java`
- `menu/MenuController.java`
- `menu/MenuService.java`
- `rental/tenant/RentalTenantController.java`
- `rental/tenant/RentalTenantService.java`
- `rental/tenant/RentalTenantRepository.java`
- `messaging/OutboxService.java`
- `job/BackendMigrationJobHandlers.java`

读这些文件时，先看类名和方法名，不要急着钻 SQL 细节。第一轮目标是建立“请求进来后走哪几层”的地图。

### 2.11 下一步

下一节分析项目启动流程：程序从哪里启动、配置如何加载、Bean 如何创建、数据库和 Redis 如何初始化。

## 3. 项目启动流程

### 3.1 启动入口

启动入口是：

```text
src/main/java/cn/yizuw/magic/backend/BackendSpringbootApplication.java
```

核心代码：

```java
SpringApplication.run(BackendSpringbootApplication.class, args);
```

启动类上的注解决定了这个项目启动时会打开哪些能力：

| 注解 | 作用 |
| --- | --- |
| `@SpringBootApplication` | 开启自动配置、组件扫描、配置类加载 |
| `@EnableConfigurationProperties` | 绑定 `AppProperties` 和 `TenantDataSourceProperties` |
| `@MapperScan("cn.yizuw.magic.backend.**.mapper")` | 扫描 MyBatis/MyBatis-Plus Mapper |
| `@EnableKafka` | 开启 Kafka listener 支持 |
| `@EnableRabbit` | 开启 RabbitMQ listener 支持 |
| `@EnableScheduling` | 开启 Spring 本地定时任务 |

### 3.2 启动流程总图

```mermaid
flowchart TD
  A[main 方法] --> B[SpringApplication.run]
  B --> C[读取 application.yml]
  C --> C1[合并 application-local/prod.yml]
  C1 --> D[绑定 AppProperties / TenantDataSourceProperties]
  D --> E[组件扫描 Controller/Service/Repository/Component]
  E --> F[创建配置类 Bean]
  F --> G[创建 centerDataSource]
  G --> H[创建 centerJdbcTemplate]
  F --> I[自动配置 RedisConnectionFactory]
  I --> J[创建 RedisTemplate]
  F --> K[自动配置 Kafka/RabbitMQ 基础 Bean]
  F --> L[按开关创建 XxlJobSpringExecutor]
  E --> M[注册 AuthFilter 和 MVC Controller]
  E --> N[注册 @Scheduled 任务]
  N --> O[服务启动完成，监听 /api]
```

### 3.3 配置文件如何加载

主配置文件是：

```text
src/main/resources/application.yml
```

环境覆盖文件：

```text
src/main/resources/application-local.yml
src/main/resources/application-prod.yml
```

Spring Boot 会先加载 `application.yml`，再根据 `spring.profiles.active` 合并对应 profile 文件。项目里配置大量使用环境变量占位符：

```yaml
server:
  port: ${SERVER_PORT:8080}

spring:
  datasource:
    center:
      jdbc-url: ${CENTER_DATABASE_URL:}
```

这意味着：

- 不配 `SERVER_PORT` 时默认端口是 `8080`。
- 统一上下文路径是 `/api`。
- 不配 `CENTER_DATABASE_URL` 时，中心库无法初始化，应用会启动失败。
- `local` profile 会把 `KAFKA_REQUIRED`、`RABBITMQ_REQUIRED` 默认降成 `false`。
- `prod` profile 默认要求 Kafka/RabbitMQ，并默认启用 XXL-Job。

### 3.4 配置属性如何绑定

项目有两类重要配置属性类：

| 配置类 | 绑定前缀 | 作用 |
| --- | --- | --- |
| `AppProperties` | `app` | JWT、Cookie、Redis 开关、短信验证码、Kafka、RabbitMQ、XXL-Job、第三方平台配置 |
| `TenantDataSourceProperties` | `spring.datasource.tenant` | 租户库默认 URL、public URL、URL 模板、连接池大小 |

启动类通过 `@EnableConfigurationProperties` 显式启用这两个属性类。这样做的好处是：配置不会散落在业务代码里，Kafka/RabbitMQ/XXL-Job 这些开关也可以被集中审计。

### 3.5 Bean 如何注入

Spring 会扫描 `cn.yizuw.magic.backend` 包下的这些组件：

```text
@RestController
@Service
@Repository
@Component
@Configuration
@RestControllerAdvice
```

项目主要使用构造器注入，例如：

```java
public AuthFilter(JwtService jwtService) {
  this.jwtService = jwtService;
}
```

构造器注入是企业项目更推荐的方式，原因是：

- 依赖关系在构造方法里一眼能看到。
- Bean 缺失时启动阶段就失败，不会运行到一半才空指针。
- 方便单元测试手工构造对象。

### 3.6 数据库如何初始化

#### 3.6.1 中心库启动时初始化

中心库配置在 `DataSourceConfig`：

```text
config/DataSourceConfig.java
```

启动时会创建两个 Bean：

```text
centerDataSource
centerJdbcTemplate
```

`centerDataSource` 的 URL 来自：

```text
spring.datasource.center.jdbc-url
```

也就是环境变量：

```text
CENTER_DATABASE_URL
```

如果 `CENTER_DATABASE_URL` 为空，代码会直接抛出：

```text
CENTER_DATABASE_URL is required for backend-springboot
```

所以中心库是这个服务的硬依赖。登录、刷新 token、组织、消息 outbox、部分 CRM/支付/通知数据都依赖中心库。

#### 3.6.2 租户库按需初始化

租户库不是启动时全部连接，而是通过：

```text
tenant/TenantDataSourceRegistry.java
tenant/TenantJdbcTemplateProvider.java
```

在请求中按需创建。

流程是：

```mermaid
sequenceDiagram
  participant Req as HTTP 请求
  participant Filter as AuthFilter
  participant Ctx as TenantContext
  participant Provider as TenantJdbcTemplateProvider
  participant Registry as TenantDataSourceRegistry
  participant DB as 租户库

  Req->>Filter: Authorization: Bearer token
  Filter->>Ctx: 写入 UserTokenPayload(customerId, dbName)
  Req->>Provider: Service 请求当前租户 JdbcTemplate
  Provider->>Ctx: 读取当前用户和租户
  Provider->>Registry: getDataSource(customerId, dbName)
  Registry->>Registry: computeIfAbsent 创建/复用 HikariDataSource
  Registry-->>Provider: DataSource
  Provider-->>Req: JdbcTemplate
  Req->>DB: 执行业务 SQL
```

这样设计的原因：

- 租户数量可能很多，启动时全部连接会拖慢启动并浪费连接。
- 根据 JWT 中的 `customerId/dbName` 动态路由，适合多租户隔离。
- `ConcurrentHashMap` 缓存连接池，避免每个请求都重新创建连接池。

### 3.7 Redis 如何初始化

Redis 连接配置来自：

```yaml
spring:
  data:
    redis:
      url: ${REDIS_URL:redis://localhost:6379}
```

Spring Boot 自动创建 `RedisConnectionFactory`，项目再通过 `RedisConfig` 创建统一的：

```text
RedisTemplate<String, Object>
```

序列化策略：

| 部分       | 序列化器                             |
| ---------- | ------------------------------------ |
| key        | `StringRedisSerializer`              |
| hash key   | `StringRedisSerializer`              |
| value      | `GenericJackson2JsonRedisSerializer` |
| hash value | `GenericJackson2JsonRedisSerializer` |

这样设计的原因：

- key 保持纯字符串，方便排查和手动删除。
- value 用 JSON，适合缓存菜单、权限码、验证码状态等结构化数据。
- 统一 `RedisTemplate` 能减少各业务模块自己配置序列化导致的不兼容。

Redis 连接通常是按使用时建立；健康检查接口 `/api/internal/health/infrastructure` 会主动 ping Redis。

### 3.8 Kafka、RabbitMQ、XXL-Job 启动行为

| 能力 | 启动时行为 | 开关 |
| --- | --- | --- |
| Kafka 基础设施 | Spring Boot 自动配置 `KafkaTemplate`、`KafkaAdmin` 等 Bean | `spring.kafka.*` |
| Kafka 消费者 | 只有对应 listener Bean 满足条件才启用 | `app.kafka.consumer-enabled` |
| Kafka outbox 派发 | `OutboxDispatcher` 会被注册为定时任务，但方法内部先判断开关 | `app.kafka.outbox-dispatch-enabled` |
| RabbitMQ 基础设施 | 创建 RabbitTemplate、连接工厂、交换机/队列/绑定 Bean | `spring.rabbitmq.*` |
| RabbitMQ listener | 多个 listener 通过 `@ConditionalOnProperty` 控制是否注册 | `app.rabbit-mq.*` |
| XXL-Job | 只有 `app.xxl-job.enabled=true` 才创建 `XxlJobSpringExecutor` | `app.xxl-job.enabled` |

这里体现的是 **Feature Toggle** 设计。迁移项目里，消息、通知、任务都属于高副作用能力，不能因为服务启动就自动全量执行，所以用配置开关拆成多个安全门。

### 3.9 Web 层如何初始化

`WebConfig` 会注册 CORS 规则：

```text
config/WebConfig.java
```

允许的来源来自：

```text
app.cors.allowed-origins
```

默认是 `*`。同时允许：

```text
GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS
```

`AuthFilter` 是 `OncePerRequestFilter`，作为 Spring Bean 注册后会参与请求过滤。它不强制所有接口登录，而是“有 Bearer token 就解析，解析成功就写入 TenantContext”。真正要求登录的地方通常由业务代码调用：

```text
TenantRequired.currentUser()
```

这种设计保留了公开接口兼容能力，例如部分访客登记、公开厂房列表允许无 token 访问默认租户库。

### 3.10 启动阶段最常见失败点

| 现象 | 常见原因 | 排查位置 |
| --- | --- | --- |
| 应用启动直接失败 | `CENTER_DATABASE_URL` 没配 | `DataSourceConfig` |
| 本地 Kafka/RabbitMQ 连接失败 | profile 不是 local，或 required 仍为 true | `application-local.yml` |
| 请求业务表失败 | JWT 中 `customerId/dbName` 指向的租户库不可连 | `TenantDataSourceRegistry` |
| Redis 使用时报错 | `REDIS_URL` 不可连或序列化数据不兼容 | `RedisConfig`、`CacheService` |
| XXL-Job 注册失败 | prod 默认启用但 admin 地址/token 不正确 | `job/XxlJobConfig.java` |

### 3.11 Step 3 必读源码

按这个顺序读启动流程最清楚：

1. `BackendSpringbootApplication.java`
2. `src/main/resources/application.yml`
3. `src/main/resources/application-local.yml`
4. `src/main/resources/application-prod.yml`
5. `config/AppProperties.java`
6. `tenant/TenantDataSourceProperties.java`
7. `config/DataSourceConfig.java`
8. `tenant/TenantDataSourceRegistry.java`
9. `config/RedisConfig.java`
10. `job/XxlJobConfig.java`
11. `messaging/OutboxDispatcher.java`

### 3.12 下一步

下一节选择一个典型接口，完整分析浏览器到 Controller、Service、Repository、SQL、数据库、返回结果的调用链。

## 4. 典型接口调用链：登录接口

### 4.1 为什么选择登录接口

本节选择：

```text
POST /api/auth/login
```

作为第一条完整调用链。

原因是登录接口同时覆盖了本项目最关键的基础能力：

- HTTP Controller 入口
- 参数校验
- 中心库账号查询
- BCrypt/明文兼容密码校验
- 租户库动态连接
- 租户用户、角色、权限码、园区范围查询
- JWT access token 生成
- refresh token 入库
- HttpOnly Cookie 写回
- 统一响应格式

读懂登录接口，后面读用户信息、菜单、权限、业务接口会轻松很多。

### 4.2 请求入口

Controller 在：

```text
auth/AuthController.java
```

入口方法：

```java
@PostMapping("/auth/login")
public ApiResponse<LoginResponse> login(
    @Valid @RequestBody LoginRequest request, HttpServletResponse response) {
  return ApiResponse.ok(authService.login(request, response));
}
```

因为 `application.yml` 配置了：

```yaml
server:
  servlet:
    context-path: /api
```

所以真实接口路径是：

```text
POST /api/auth/login
```

请求体是：

```json
{
  "username": "admin",
  "password": "123456"
}
```

`LoginRequest` 使用 Bean Validation：

```java
public record LoginRequest(@NotBlank String password, @NotBlank String username) {}
```

如果 username/password 为空，会被 `GlobalExceptionHandler` 转成统一错误响应。

### 4.3 完整调用流程图

```mermaid
sequenceDiagram
  participant Browser as 浏览器/前端
  participant Controller as AuthController
  participant Service as AuthService
  participant Repo as AuthRepository
  participant CenterDB as 中心库
  participant Registry as TenantDataSourceRegistry
  participant TenantDB as 租户库
  participant JWT as JwtService
  participant Resp as HTTP Response

  Browser->>Controller: POST /api/auth/login(username,password)
  Controller->>Service: login(LoginRequest,response)
  Service->>Repo: findCenterUserForLogin(username)
  Repo->>CenterDB: SELECT user LEFT JOIN customer
  CenterDB-->>Repo: CenterUserRecord
  Repo-->>Service: 中心用户、customerId、dbName
  Service->>Service: 校验用户状态、租户状态、密码
  Service->>Registry: getDataSource(customerId, dbName)
  Registry-->>Service: 租户库 DataSource
  Service->>Repo: resolveTenantUserInfo(tenantJdbcTemplate,...)
  Repo->>CenterDB: SELECT user_tenant_mapping
  Repo->>TenantDB: SELECT user / role / code / park
  TenantDB-->>Repo: TenantUserInfo
  Repo-->>Service: 租户用户、角色、权限码、园区
  Service->>JWT: generateAccessToken(payload)
  Service->>JWT: issueRefreshToken(payload)
  Service->>Repo: persistRefreshToken(jti, tokenHash, expiresAt, centerUserId)
  Repo->>CenterDB: INSERT refresh_token
  Service->>Resp: Set-Cookie: jwt=refreshToken; HttpOnly
  Service-->>Controller: LoginResponse
  Controller-->>Browser: ApiResponse<LoginResponse>
```

### 4.4 Controller 层职责

`AuthController` 只做三件事：

1. 接收 HTTP 请求。
2. 触发参数校验和 JSON 反序列化。
3. 调用 `AuthService`，并包装成 `ApiResponse.ok(...)`。

它不直接查数据库，也不生成 token。

这样设计的原因：

- Controller 保持薄，接口层容易维护。
- 业务规则集中在 Service，方便复用和测试。
- 数据库访问集中在 Repository，SQL 变更不影响 Controller。

体现的设计模式：

- **Controller-Service-Repository 分层**
- **DTO/Request 入参模型**
- **统一响应包装**

### 4.5 Service 层主流程

核心方法在：

```text
auth/AuthService.java
```

主流程：

```java
public LoginResponse login(LoginRequest request, HttpServletResponse response) {
  CenterUserRecord centerUser = authRepository.findCenterUserForLogin(request.username().trim());
  if (centerUser == null || centerUser.status() == null || centerUser.status() != 1) {
    throw new BusinessException(HttpStatus.FORBIDDEN, "用户名或密码错误");
  }
  if (centerUser.customerId() == null
      || centerUser.customerId().isBlank()
      || centerUser.customerStatus() == null
      || centerUser.customerStatus() == 0) {
    throw new BusinessException(HttpStatus.FORBIDDEN, "用户名或密码错误");
  }
  if (!matchesPassword(request.password(), centerUser.password())) {
    throw new BusinessException(HttpStatus.FORBIDDEN, "用户名或密码错误");
  }

  return issueLoginTokens(centerUser, response, "用户名或密码错误", false);
}
```

这里有三个校验：

| 校验               | 目的                          |
| ------------------ | ----------------------------- |
| 中心用户存在且启用 | 禁止不存在/停用账号登录       |
| 绑定租户存在且启用 | 禁止无租户或租户停用账号登录  |
| 密码匹配           | 支持 BCrypt，也兼容旧明文密码 |

密码校验方法：

```java
private boolean matchesPassword(String rawPassword, String encodedOrRawPassword) {
  if (encodedOrRawPassword.startsWith("$2a$")
      || encodedOrRawPassword.startsWith("$2b$")
      || encodedOrRawPassword.startsWith("$2y$")) {
    return passwordEncoder.matches(rawPassword, encodedOrRawPassword);
  }
  return rawPassword.equals(encodedOrRawPassword);
}
```

这说明项目处于迁移阶段：新密码使用 BCrypt，但老数据可能还有明文，需要兼容。

### 4.6 中心库查询

中心库查询在：

```text
auth/AuthRepository.java
```

登录首先查中心库：

```sql
SELECT u.id, u.username, u.password, u.customer_type, u.status, u.token_version,
       c.db_name, c.status AS customer_status
FROM user u
LEFT JOIN customer c ON c.customer_id = u.customer_type
WHERE u.username = ?
LIMIT 1
```

如果 username 是 11 位手机号，还会兼容按 `u.phone` 查询。

这个 SQL 返回 `CenterUserRecord`：

```java
public record CenterUserRecord(
    String customerId,
    Integer customerStatus,
    String dbName,
    Long id,
    String password,
    Integer status,
    Long tokenVersion,
    String username) {}
```

中心库在登录中负责回答三个问题：

- 这个账号是谁？
- 这个账号属于哪个租户？
- 这个租户对应哪个数据库？

### 4.7 租户库查询

中心库校验通过后，Service 调用：

```java
tenantDataSourceRegistry.getDataSource(centerUser.customerId(), centerUser.dbName())
```

拿到租户库连接，再调用：

```java
authRepository.resolveTenantUserInfo(...)
```

租户用户解析大致分四步：

1. 先查中心库 `user_tenant_mapping`，找中心用户对应的租户用户 ID。
2. 如果没有映射，则按 username 在租户库 `user` 表中兜底查找。
3. 查询租户用户的角色、权限码。
4. 查询租户用户的园区范围。

涉及的主要 SQL：

```sql
SELECT customer_user_id
FROM user_tenant_mapping
WHERE center_user_id = ? AND customer_id = ?
LIMIT 1
```

```sql
SELECT id, username, real_name, phone, home_path, status
FROM user
WHERE id = ?
LIMIT 1
```

```sql
SELECT r.name, r.reimbursement_auth, r.rates
FROM user_role ur
INNER JOIN role r ON r.role_id = ur.role_id
WHERE ur.user_id = ? AND r.name IS NOT NULL
ORDER BY r.role_id ASC
```

```sql
SELECT DISTINCT c.code
FROM user_role ur
INNER JOIN role_code rc ON rc.role_id = ur.role_id
INNER JOIN code c ON c.code_id = rc.code_id
WHERE ur.user_id = ?
  AND c.code IS NOT NULL
  AND c.template_deleted_at IS NULL
ORDER BY c.code ASC
```

如果角色包含 `Super`，园区范围是所有未删除园区：

```sql
SELECT park_id, park_name
FROM park
WHERE is_deleted = false
ORDER BY park_id ASC
```

否则按 `user_park`、旧字段 `user.park_id`、`role_park` 多种方式兼容查找。

### 4.8 Token 生成和 refresh token 入库

租户用户解析成功后，Service 构造：

```text
UserTokenPayload
```

内容包括：

| 字段                | 作用                             |
| ------------------- | -------------------------------- |
| `centerUserId`      | 中心库用户 ID                    |
| `customerId`        | 租户标识                         |
| `dbName`            | 租户数据库名                     |
| `id`                | 租户库用户 ID                    |
| `parks`             | 授权园区                         |
| `rates`             | 报销/角色相关比例                |
| `reimbursementAuth` | 报销权限                         |
| `roles`             | 角色名                           |
| `tokenVersion`      | token 版本，用于强制失效旧 token |
| `username`          | 用户名                           |

随后生成 access token：

```java
String accessToken = jwtService.generateAccessToken(payload);
```

生成 refresh token：

```java
JwtService.RefreshTokenIssue refreshToken = jwtService.issueRefreshToken(payload);
```

refresh token 不直接明文落库，而是 SHA-256 hash 后保存：

```java
authRepository.persistRefreshToken(
    refreshToken.jti(), hashToken(refreshToken.token()), refreshToken.expiresAt(), centerUser.id());
```

入库 SQL：

```sql
INSERT INTO refresh_token (jti, token_hash, expires_at, user_id)
VALUES (?, ?, ?, ?)
```

这样设计的原因：

- access token 给前端放在请求头里使用。
- refresh token 放 HttpOnly Cookie，降低被 JavaScript 读取的风险。
- 数据库存 hash，不存 refresh token 明文，降低泄露后的直接利用风险。
- `tokenVersion` 可以在改密码、登出、异常重放时让旧 token 失效。

### 4.9 响应结果

登录成功返回：

```java
public record LoginResponse(
    String accessToken,
    Long centerUserId,
    List<String> codes,
    String customerId,
    String homePath,
    Long id,
    List<Map<String, Object>> parks,
    String phone,
    Integer rates,
    String realName,
    Integer reimbursementAuth,
    List<String> roles,
    Long tokenVersion,
    String username) {}
```

外层由 `ApiResponse.ok(...)` 包装：

```json
{
  "code": 0,
  "data": {
    "accessToken": "...",
    "centerUserId": 1,
    "customerId": "default",
    "dbName": null,
    "id": 1,
    "roles": ["Super"],
    "codes": ["system:user:list"],
    "parks": []
  },
  "error": null,
  "message": "ok"
}
```

同时响应头会写：

```text
Set-Cookie: jwt=<refreshToken>; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax
```

生产如果 `REFRESH_TOKEN_COOKIE_SECURE=true`，还会加：

```text
Secure; SameSite=None
```

### 4.10 登录失败如何返回

登录失败统一抛：

```java
new BusinessException(HttpStatus.FORBIDDEN, "用户名或密码错误")
```

`GlobalExceptionHandler` 会转成：

```json
{
  "code": 403,
  "data": null,
  "error": "用户名或密码错误",
  "message": "用户名或密码错误"
}
```

这里故意不区分“用户不存在、密码错误、租户停用”，是企业登录接口常见安全策略，避免向外暴露账号枚举信息。

### 4.11 这一链路中的设计模式

| 设计 | 体现位置 | 价值 |
| --- | --- | --- |
| 分层架构 | Controller / Service / Repository | 降低 HTTP、业务、SQL 的耦合 |
| Repository 模式 | `AuthRepository` | SQL 集中管理，方便迁移兼容 |
| DTO/Record | `LoginRequest`、`LoginResponse`、`CenterUserRecord` | 明确接口和查询结果结构 |
| 多租户动态数据源 | `TenantDataSourceRegistry` | 按 token 定位租户库 |
| Token Version | `tokenVersion` | 改密码/登出后让旧 token 失效 |
| HttpOnly Cookie | refresh token 写 Cookie | 降低 refresh token 被前端脚本读取的风险 |
| 兼容适配 | 明文密码兼容、手机号兜底、租户映射兜底 | 支持旧系统迁移期间不断流 |

### 4.12 Step 4 必读源码

按这个顺序读：

1. `auth/AuthController.java`
2. `auth/LoginRequest.java`
3. `auth/AuthService.java`
4. `auth/AuthRepository.java`
5. `auth/CenterUserRecord.java`
6. `auth/TenantUserInfo.java`
7. `security/UserTokenPayload.java`
8. `security/JwtService.java`
9. `common/ApiResponse.java`
10. `common/GlobalExceptionHandler.java`

### 4.13 下一步

下一节分析数据库：中心库和租户库分别有哪些核心表、表之间如何关联、哪些字段最重要。

## 5. 数据库设计

### 5.1 先明确边界

当前 Java 工程没有提供完整业务库 DDL。`src/main/resources/db/manual` 下只有两份手工 SQL：

```text
001-event-outbox.sql
002-in-app-notification.sql
```

所以本节不是完整建表说明，而是基于下面三类证据整理出的**代码读库地图**：

- Java Repository 中实际执行的 SQL。
- `db/manual` 中明确提供的手工 DDL。
- `README.md` 中迁移批次对中心库、租户库和表职责的说明。

读这个项目数据库时必须先分清楚两套库：

| 数据库 | 连接入口 | 主要用途 |
| --- | --- | --- |
| 中心库 | `centerJdbcTemplate` | 登录账号、租户、组织、refresh token、outbox、消费日志、CRM、会员支付等全局数据 |
| 租户库 | `TenantJdbcTemplateProvider` / `TenantDataSourceRegistry` | 每个租户自己的菜单、角色、园区、租赁、账单、员工、门禁等业务数据 |

### 5.2 总体关系图

```mermaid
erDiagram
  CENTER_USER ||--o{ USER_TENANT_MAPPING : maps
  CUSTOMER ||--o{ USER_TENANT_MAPPING : owns
  CUSTOMER ||--o{ ORGANIZATION_TENANT_MAPPING : binds
  ORGANIZATION ||--o{ ORGANIZATION_MEMBER : has
  ORGANIZATION ||--o{ TENANT_PROVISIONING_JOB : provisions
  CENTER_USER ||--o{ REFRESH_TOKEN : owns
  EVENT_OUTBOX ||--o{ EVENT_CONSUME_LOG : consumed_by

  TENANT_USER ||--o{ USER_ROLE : has
  ROLE ||--o{ USER_ROLE : assigned
  ROLE ||--o{ ROLE_CODE : grants
  CODE ||--o{ ROLE_CODE : bound
  ROLE ||--o{ ROLE_MENU : grants
  MENU ||--o{ ROLE_MENU : bound
  ROLE ||--o{ ROLE_PARK : scopes
  PARK ||--o{ ROLE_PARK : scoped
  PARK ||--o{ RENTAL_TENANT : contains
  RENTAL_TENANT ||--o{ AMOUNT_BILL : billed
  PARK ||--o{ AMOUNT_BILL : belongs
  PARK ||--o{ FACTORY : contains
  FACTORY ||--o{ FACTORY_FLOOR : has
```

上图里的 `CENTER_*` 是中心库概念，`TENANT_*` 是租户库概念。实际表名里中心用户和租户用户都叫 `user`，区别在于连接的是中心库还是租户库。

### 5.3 中心库核心表

#### 5.3.1 账号与租户

| 表 | 作用 | 关键字段 | 代码位置 |
| --- | --- | --- | --- |
| `user` | 中心账号表，登录首先查它 | `id`、`username`、`password`、`customer_type`、`status`、`token_version`、`phone`、`real_name` | `AuthRepository`、`SystemUserRepository`、`OrganizationRepository` |
| `customer` | 租户/客户空间表 | `customer_id`、`db_name`、`status`、`name` | `AuthRepository`、`TenantDataSourceRegistry` 相关调用 |
| `user_tenant_mapping` | 中心用户和租户库用户的映射 | `center_user_id`、`customer_id`、`customer_user_id`、`db_name` | `AuthRepository`、`SystemUserRepository` |
| `refresh_token` | refresh token 服务端存储和撤销记录 | `jti`、`token_hash`、`expires_at`、`revoked_at`、`replaced_by_jti`、`user_id` | `AuthRepository` |

核心关系：

```text
center.user.customer_type -> customer.customer_id
user_tenant_mapping.center_user_id -> center.user.id
user_tenant_mapping.customer_user_id -> tenant.user.id
refresh_token.user_id -> center.user.id
```

为什么这样设计：

- 中心库账号用于跨租户统一登录。
- 租户库用户用于租户内角色、权限和业务数据关联。
- 映射表解决“同一个中心账号在不同租户库中可能有不同用户 ID”的问题。
- `token_version` 和 `refresh_token.revoked_at` 用来实现改密码、退出登录、异常重放后的 token 失效。

最值得读：

- `auth/AuthRepository.java`
- `system/user/SystemUserRepository.java`
- `security/JwtService.java`

#### 5.3.2 组织与开通

| 表 | 作用 | 关键字段 | 代码位置 |
| --- | --- | --- | --- |
| `organization` | 组织空间源信息 | `id`、`source_customer_id`、`status` | `OrganizationRepository` |
| `organization_member` | 组织成员 | `organization_id`、`center_user_id`、`member_role`、`status` | `OrganizationRepository`、`messaging` 通知计划 |
| `organization_tenant_mapping` | 组织和目标租户空间绑定 | `organization_id`、`customer_id`、`db_name`、`job_id` | `OrganizationRepository`、`job` |
| `tenant_invitation` | 组织邀请码 | `code`、`customer_id`、`role_ids`、`max_uses`、`used_count`、`expires_at`、`status` | `OrganizationRepository` |
| `tenant_invitation_join_log` | 加入邀请码日志 | `invitation_id`、`center_user_id`、`status`、`error_message` | `OrganizationRepository` |
| `tenant_provisioning_job` | 组织开通任务 | `id`、`source_customer_id`、`target_customer_id`、`target_db_name`、`status`、`step`、`lock_owner`、`heartbeat_at` | `OrganizationRepository`、`job/*` |
| `tenant_provisioning_role_snapshot` | 组织角色迁移快照 | `job_id`、`source_role_id`、`target_role_id`、`role_name` | `job/JdbcOrganizationProvisioningRoleSnapshotCenterWriteClient.java` |

这个模块是典型企业后台的“组织生命周期”设计：创建组织、邀请成员、开通租户库、复制基础表、迁移角色成员、切换中心用户租户归属。

为什么这样设计：

- 开通租户不是一个简单 HTTP 请求能完成的事情，需要拆成任务。
- `tenant_provisioning_job` 记录状态和步骤，便于失败重试和人工排查。
- `lock_owner/heartbeat_at` 用来防止多个 worker 同时处理同一个任务。
- 角色快照表用于把源组织角色和目标租户角色建立可追踪映射。

设计模式：

- **Saga/Process Manager 思路**：长流程拆成多个可恢复步骤。
- **Lease Lock**：用 `lock_owner + heartbeat_at` 控制任务所有权。
- **Idempotent Step**：迁移步骤尽量支持重复执行和安全重试。

最值得读：

- `organization/OrganizationRepository.java`
- `job/OrganizationProvisioningJobClaimService.java`
- `job/OrganizationProvisioningJobStepService.java`
- `job/OrganizationProvisioningJobCompletionService.java`

#### 5.3.3 消息与通知

| 表 | 作用 | 关键字段 | DDL/代码 |
| --- | --- | --- | --- |
| `event_outbox` | 待派发业务事件 | `event_id`、`event_type`、`topic`、`customer_id`、`idempotency_key`、`payload`、`status`、`attempts` | `001-event-outbox.sql`、`OutboxRepository` |
| `event_consume_log` | 消费幂等日志 | `event_id`、`consumer_group`、`idempotency_key`、`status`、`error_message` | `001-event-outbox.sql`、`EventConsumeLogRepository` |
| `in_app_notification` | 站内通知 | `event_id`、`idempotency_key`、`recipient_center_user_id`、`target_customer_id`、`template_key`、`status` | `002-in-app-notification.sql` |

`event_outbox` 的核心索引：

```text
uk_event_outbox_event_id
uk_event_outbox_idempotency_key
idx_event_outbox_dispatch(status, next_attempt_at, id)
```

`event_consume_log` 的核心唯一键：

```text
uk_event_consume_log_event_group(event_id, consumer_group)
```

为什么这样设计：

- 业务事件先落库，再由 `OutboxDispatcher` 投递 Kafka，降低“业务写成功但消息没发出去”的风险。
- 消费者用 `event_consume_log` 做幂等，防止 Kafka/RabbitMQ 重复投递导致重复发送通知或重复写库。
- 通知表的 `idempotency_key` 保证同一收件人同一事件只写一次。

设计模式：

- **Outbox Pattern**
- **Idempotent Consumer**
- **Retry with Dead Letter 思路**

最值得读：

- `messaging/OutboxRepository.java`
- `messaging/OutboxDispatcher.java`
- `messaging/EventConsumeLogRepository.java`
- `messaging/OrganizationProvisioningCompletedInAppNotificationRepository.java`

#### 5.3.4 系统配置、版本、CRM、会员支付

| 表 | 作用 | 代码位置 |
| --- | --- | --- |
| `key` | 系统配置读取，内部密钥禁止返回 | `system/key/SystemKeyService.java` |
| `app_versions` | App 版本信息，MyBatis-Plus 样板表 | `system/version/*` |
| `crm_sales_channel` | CRM 销售渠道 | `crm/CrmRepository.java` |
| `crm_customer_owner_binding` | 客户归属绑定 | `crm/CrmRepository.java` |
| `crm_scan_log` | 扫码/归属审计日志 | `crm/CrmRepository.java` |
| `crm_external_contact_log` | 外部联系人日志 | `crm/CrmRepository.java` |
| `crm_wework_contact_way` | 企业微信联系我方式本地快照 | `crm/CrmRepository.java` |
| `vip_membership` | 会员汇总 | `integration/wechat`、`job` |
| `vip_membership_payment` | 会员支付快照 | `integration/wechat`、`job` |
| `vip_membership_refund` | 退款申请/退款状态快照 | `integration/wechat`、`job` |
| `vip_membership_entitlement` | 会员权益明细 | `job/VipMembershipEntitlementRollbackPreviewService.java` |

这些表都属于全局能力，不适合放在某个租户库里。尤其 CRM 和会员支付，通常跨租户、跨组织、跨销售账号统计，需要中心库统一维护。

### 5.4 租户库核心表

#### 5.4.1 用户、角色、权限、菜单

| 表 | 作用 | 关键字段 | 代码位置 |
| --- | --- | --- | --- |
| `user` | 租户内用户 | `id`、`username`、`password`、`real_name`、`phone`、`customer_type`、`status`、`token_version`、`park_id` | `AuthRepository`、`UserInfoRepository`、`SystemUserRepository` |
| `role` | 租户角色 | `role_id`、`name`、`parent_id`、`scope`、`status`、`reimbursement_auth`、`rates` | `SystemRoleRepository` |
| `user_role` | 用户和角色多对多 | `user_id`、`role_id` | `AuthRepository`、`SystemUserRepository` |
| `code` | 权限码 | `code_id`、`code`、`menu_id`、`template_deleted_at` | `PermissionService`、`MenuRepository` |
| `role_code` | 角色和权限码多对多 | `role_id`、`code_id` | `SystemRoleRepository`、`PermissionService` |
| `menu` | 前端路由/菜单 | `menu_id`、`name`、`path`、`component`、`type`、`status`、`pid`、`auth_code` | `MenuRepository` |
| `menu_meta` | 菜单展示元数据 | `menu_id`、`title`、`icon`、`order`、`hide_in_menu` 等 | `MenuRepository` |
| `role_menu` | 角色和菜单多对多 | `role_id`、`menu_id`、`is_deleted` | `MenuRepository`、`SystemRoleRepository` |
| `role_park` | 角色园区范围 | `role_id`、`park_id`、`is_deleted` | `ParkRepository`、`SystemRoleRepository` |
| `user_park` | 用户直接园区范围 | `user_id`、`park_id`、`is_deleted` | `ParkRepository`、`SystemUserRepository` |
| `user_code` | 用户直接权限码，主要在组织成员迁移中出现 | `user_id`、`code_id` | `OrganizationRepository`、`job` |

权限关系可以简化为：

```text
user -> user_role -> role
role -> role_menu -> menu
role -> role_code -> code
role -> role_park -> park
user -> user_park -> park
```

为什么这样设计：

- 菜单控制前端能看到哪些路由。
- 权限码控制按钮或接口级权限判断。
- 园区范围控制业务数据行级访问。
- 用户可直接绑定园区，也可通过角色继承园区范围，保留旧数据兼容。

最值得读：

- `menu/MenuRepository.java`
- `permission/PermissionService.java`
- `system/role/SystemRoleRepository.java`
- `system/user/SystemUserRepository.java`
- `park/ParkScopeService.java`

#### 5.4.2 园区与空间资源

| 表 | 作用 | 关键字段 | 代码位置 |
| --- | --- | --- | --- |
| `park` | 园区主表 | `park_id`、`park_name`、`address`、`area`、`manager`、`contact`、`is_deleted` | `ParkRepository` |
| `park_image` | 园区图片关联 | `park_id`、`img_id` | `ParkRepository` |
| `factory` | 厂房主表 | `factory_id`、`factory_name`、`park_id`、`is_deleted` | `ParkRepository`、`FactoryRepository` |
| `factory_floor` | 厂房楼层 | `floor_id`、`factory_id`、`total_area`、`used_area`、`rent_price`、`is_deleted` | `ParkRepository`、`FactoryRepository` |
| `factory_floor_image` | 楼层图片 | `floor_id`、`img_id` | `ParkRepository` |
| `dormitory` | 宿舍 | `dormitory_id`、`park_id`、`total_rooms`、`is_deleted` | `ParkRepository`、`DormitoryRepository` |
| `dormitory_image` | 宿舍图片 | `dormitory_id`、`img_id` | `ParkRepository` |
| `image` | 图片资源表 | `img_id`、`img_url`、`hash` | `ImageRepository` |
| `image_binding` | 通用图片绑定表 | `biz_type`、`biz_id`、`img_id`、`field`、`sort` | `UserFeedbackRepository` 等 |

`park` 是很多业务的行级权限锚点。租户、账单、员工、门禁、报销等查询经常会通过 `park_id` 限定当前用户可见范围。

#### 5.4.3 租赁、合同、账单、财务

| 表 | 作用 | 关键字段 | 代码位置 |
| --- | --- | --- | --- |
| `rental_tenant` | 租赁租户/合同主体 | `rental_tenant_id`、`tenant_name`、`phone_number`、`park_id`、`contract_start`、`contract_end`、`rental_amount`、`is_deleted` | `RentalTenantRepository` |
| `tenant_image` | 租户图片 | `rental_tenant_id`、`img_id` | `RentalTenantRepository` |
| `salary` | 工资/租户关联费用 | `salary_id`、`rental_tenant_id`、`is_deleted` | `RentalTenantRepository` |
| `salary_image` | 工资图片 | `salary_id`、`img_id` | `RentalTenantRepository` |
| `amount_bill` | 总账单 | `bill_id`、`project_name`、`tenant_id`、`park_id`、`total_fee`、`receipt_time`、`finance_id` | `AmountBillRepository` |
| `ele_bill` | 电费明细，代码中动态检测使用 | `bill_id` | `AmountBillRepository` |
| `water_bill` | 水费明细，代码中动态检测使用 | `bill_id` | `AmountBillRepository` |
| `amount_bill_collection_sms_log` | 催缴短信发送日志 | `bill_id`、`collection_type`、`success`、`sent_at` | `AmountBillRepository` |
| `finance` | 财务流水 | `finance_id`、`park_id`、`is_deleted` | `FinanceRepository`、`AmountBillRepository` |
| `finance_image` | 财务图片 | `finance_id`、`url` | `FinanceRepository` |

核心关系：

```text
park.park_id -> rental_tenant.park_id
rental_tenant.rental_tenant_id -> amount_bill.tenant_id
park.park_id -> amount_bill.park_id
amount_bill.bill_id -> ele_bill.bill_id / water_bill.bill_id
amount_bill.finance_id -> finance.finance_id
```

为什么这样设计：

- 园区是租赁和账单的权限边界。
- 租户合同信息和账单分开，便于一个租户产生多期账单。
- 水电明细拆表，主账单只保存汇总和公共字段。
- 财务流水和账单有关联，但当前迁移阶段很多财务同步副作用被显式保留在后续专项或任务中。

最值得读：

- `rental/tenant/RentalTenantRepository.java`
- `bill/AmountBillRepository.java`
- `finance/FinanceRepository.java`

#### 5.4.4 员工、考勤、报销、门禁、通知

| 表 | 作用 | 代码位置 |
| --- | --- | --- |
| `employee` | 员工信息，可绑定租户用户 `user_id` | `HrmRepository` |
| `attendances` | 考勤打卡记录 | `HrmRepository` |
| `leave_application` | 请假申请 | `HrmRepository` |
| `attendance_device_abnormal_log` | 考勤设备异常记录 | `HrmRepository` |
| `localization` | 定位/打卡定位记录 | `LocalizationRepository` |
| `reimbursement` | 报销单 | `ReimbursementRepository` |
| `reimbursement_image` | 报销图片 | `ReimbursementRepository` |
| `access_brand` | 门禁品牌 | `AccessRepository` |
| `access_visitor` | 访客登记 | `AccessRepository` |
| `access_car` | 车辆 | `AccessRepository` |
| `access_door` | 门禁设备 | `AccessRepository` |
| `notices` | 通知列表 | `NoticesRepository` |
| `feedback` | 反馈 | `UserFeedbackRepository`、`SystemFeedbackRepository` |

这些表多数也会围绕 `park_id`、`user_id` 或业务主键做权限过滤。第一轮读项目时可以先掌握 `park/rental/bill/user/role`，第二轮再逐个专题看 HRM、门禁、报销。

### 5.5 字段命名和兼容策略

这个项目有大量 `information_schema.columns` 检测，例如：

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = ?
```

这说明迁移过程中不同环境可能存在：

- 表还没 db push。
- 字段名新旧不一致。
- 某些关联表暂时不存在。
- 旧 Prisma schema 和真实库字段有漂移。

代码里的兼容策略通常是：

- 列表接口：缺表/缺关键字段时返回空页或空列表。
- 详情接口：缺数据时返回旧接口风格业务错误。
- 写接口：先检查关键字段，不满足则抛“请先执行 db push”类业务错误。
- 更新接口：只写白名单字段，避免旧前端 body 透传未知字段。

为什么这样设计：

- 迁移期不能因为某个灰度库缺字段就让整个服务不可用。
- 显式字段白名单能降低误写库风险。
- 兼容旧库结构有助于逐接口迁移，而不是一次性全量切换。

### 5.6 当前数据库变更策略

从项目说明和手工 SQL 看，当前 Java 后端没有自动迁移机制。数据库变更需要人工确认后执行：

```text
src/main/resources/db/manual/001-event-outbox.sql
src/main/resources/db/manual/002-in-app-notification.sql
```

尤其是消息和通知相关表，必须先确认 DDL 已执行，再打开对应配置开关：

- `KAFKA_OUTBOX_EVENT_WRITE_ENABLED`
- `KAFKA_OUTBOX_DISPATCH_ENABLED`
- `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_NOTIFICATION_DDL_APPLIED`
- `RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_NOTIFICATION_INSERT_ENABLED`

企业项目这样设计的原因是：迁移中的 DDL、消息消费、通知发送都属于高风险操作，不能随着应用启动自动执行。

### 5.7 Step 5 必读源码

按这个顺序读数据库最清楚：

1. `config/DataSourceConfig.java`
2. `tenant/TenantDataSourceRegistry.java`
3. `auth/AuthRepository.java`
4. `system/user/SystemUserRepository.java`
5. `system/role/SystemRoleRepository.java`
6. `menu/MenuRepository.java`
7. `park/ParkRepository.java`
8. `rental/tenant/RentalTenantRepository.java`
9. `bill/AmountBillRepository.java`
10. `messaging/OutboxRepository.java`
11. `messaging/EventConsumeLogRepository.java`
12. `organization/OrganizationRepository.java`

### 5.8 下一步

下一节分析 Redis：保存了什么、key 如何设计、TTL 是多少、什么时候写、什么时候删、什么时候更新。

## 6. Redis 使用

### 6.1 Redis 在项目里的定位

当前 Java 后端使用 Redis 做两类事情：

| 类型 | 保存内容 | 代码位置 | 是否强依赖 |
| --- | --- | --- | --- |
| 高频读缓存 | 当前用户菜单、系统菜单、父角色菜单、权限码、用户信息 | `cache/CacheService.java`、`menu/MenuService.java`、`permission/PermissionService.java`、`user/UserInfoService.java` | 非强依赖，Redis 失败时回退查库 |
| 短期状态 | 短信验证码、验证码错误次数、发送时间 | `auth/SmsCodeService.java` | 强依赖，验证码必须依赖 TTL 和跨实例共享 |
| 缓存刷新计划 | 组织开通完成后要清理哪些缓存前缀 | `messaging/OrganizationProvisioningCompletedRedisRefreshPlanService.java` | 默认预览，开关打开后执行 |
| 基础设施健康检查 | `PING` Redis | `health/InfrastructureHealthController.java` | 只用于诊断 |

配置入口：

```yaml
spring:
  data:
    redis:
      url: ${REDIS_URL:redis://localhost:6379}

app:
  redis:
    organization-provisioning-refresh-enabled: ${REDIS_ORGANIZATION_PROVISIONING_REFRESH_ENABLED:false}
```

为什么这样设计：

- 菜单、权限、用户信息是登录后高频读取数据，适合短 TTL 缓存，减少租户库压力。
- 验证码不能放进 JVM 内存，因为生产环境可能多实例部署，请求下一次可能打到另一台机器。
- Redis 不可用时，菜单和权限接口不能直接拖垮主业务，所以 `CacheService` 捕获异常后回退查库。
- 缓存刷新属于有副作用操作，迁移期必须加开关，避免误删其它租户缓存或提前触发未验收逻辑。

### 6.2 Redis 初始化流程

Redis 自动连接由 Spring Boot `spring.data.redis.url` 完成，自定义部分在 `RedisConfig`：

```java
@Bean
public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
  RedisTemplate<String, Object> template = new RedisTemplate<>();
  template.setConnectionFactory(connectionFactory);
  template.setKeySerializer(new StringRedisSerializer());
  template.setHashKeySerializer(new StringRedisSerializer());
  GenericJackson2JsonRedisSerializer serializer = new GenericJackson2JsonRedisSerializer();
  template.setValueSerializer(serializer);
  template.setHashValueSerializer(serializer);
  return template;
}
```

这里的关键点：

- key 使用 `StringRedisSerializer`，所以 Redis 里能直接看到可读 key。
- value 使用 `GenericJackson2JsonRedisSerializer`，所以可以保存 `List`、`UserInfoResponse`、`SmsCodeEntry` 这类对象。
- 项目没有启用 `@Cacheable`/`@CacheEvict` 这类 Spring Cache 注解，而是手写 `CacheService.getOrLoad(...)`，因为当前迁移期需要显式控制 key、TTL 和降级策略。

### 6.3 统一缓存封装 CacheService

`CacheService` 是普通业务缓存的统一入口：

```mermaid
flowchart TD
  A[业务 Service 调用 getOrLoad] --> B{Redis 有缓存?}
  B -->|有| C[直接返回缓存对象]
  B -->|没有或 Redis 异常| D[执行 loader 查数据库]
  D --> E[写 Redis, 设置 TTL]
  E --> F[返回数据库结果]
```

核心方法：

| 方法 | 作用 | 设计原因 |
| --- | --- | --- |
| `getOrLoad(key, type, ttl, loader)` | 先查缓存，未命中再执行数据库查询 | 把缓存旁路逻辑集中起来 |
| `get(key, type)` | 读取 Redis 并按类型转换 | 避免业务层直接处理反序列化 |
| `put(key, value, ttl)` | 写入 Redis 并设置 TTL | 所有业务缓存都必须有过期时间 |
| `evictByPrefix(prefix)` | 按前缀删除缓存 | 菜单/权限变更后批量清理同租户缓存 |

注意：`evictByPrefix` 当前使用 `redisTemplate.keys(prefix + "*")`。这在小规模或迁移期可接受，但生产大 key 空间下 `KEYS` 可能阻塞 Redis。后续如果缓存量明显增加，应改为 `SCAN` 分批删除。

这里体现的设计模式：

- **Cache Aside Pattern**：应用先查缓存，未命中查库并回填缓存。
- **Graceful Degradation**：Redis 读写失败只打 debug 日志，业务继续查库。
- **Template/Wrapper 思路**：业务层不直接散落 Redis 操作，而是通过 `CacheService` 统一入口。

最值得读：

- `cache/CacheService.java`
- `config/RedisConfig.java`

### 6.4 当前 Redis Key 设计

#### 6.4.1 菜单缓存

代码位置：`menu/MenuService.java`

| 场景 | Key | TTL | 写入时机 | 删除时机 |
| --- | --- | --- | --- | --- | --- |
| 当前用户路由菜单 | `tenant:{customerId}:route-menus:{userId}:v{tokenVersion}` | 10 分钟 | 调用当前用户菜单接口且缓存未命中 | 新增、更新、删除菜单后按 `tenant:{customerId}:route-menus:` 前缀清理 |
| 系统菜单列表 | `tenant:{customerId}:system-menu-list:v1` | 10 分钟 | 调用系统菜单列表且缓存未命中 | 菜单写接口后按 `tenant:{customerId}:system-menu-list:` 前缀清理 |
| 父角色菜单 | `tenant:{customerId}:parent-role-menus:{parentRoleId | all}:v{tokenVersion}` | 10 分钟 | 查询父角色菜单且缓存未命中 | 菜单写接口后按 `tenant:{customerId}:parent-role-menus:` 前缀清理 |

为什么 key 里带 `tenant:{customerId}`：

- 多租户系统必须避免不同租户的缓存串数据。
- 缓存清理可以限定在某个租户前缀内，降低误删范围。

为什么部分 key 带 `tokenVersion`：

- 当用户权限版本变化时，新 token 会携带新版本号，旧缓存自然不再命中。
- 这是一种低成本的权限缓存失效机制，比逐个用户删除 key 更稳。

#### 6.4.2 权限码缓存

代码位置：`permission/PermissionService.java`

| 场景 | Key | TTL | 查询来源 |
| --- | --- | --- | --- |
| 当前用户权限码 | `tenant:{customerId}:permission-codes:{userId}:v{tokenVersion}` | 10 分钟 | `user_role -> role_code -> code` |

SQL 逻辑：

```sql
SELECT DISTINCT c.code
FROM user_role ur
INNER JOIN role_code rc ON rc.role_id = ur.role_id
INNER JOIN code c ON c.code_id = rc.code_id
WHERE ur.user_id = ?
  AND c.code IS NOT NULL
  AND c.template_deleted_at IS NULL
ORDER BY c.code ASC
```

权限码缓存的意义：

- 前端按钮权限、接口权限判断会频繁读取权限码。
- 权限码来自多表 join，缓存 10 分钟能减少租户库压力。
- 菜单变更时会清理 `permission-codes`，因为按钮菜单可能同步创建或删除权限码。

#### 6.4.3 用户信息缓存

代码位置：`user/UserInfoService.java`

| 场景 | Key | TTL | 内容 |
| --- | --- | --- | --- |
| 当前登录用户信息 | `tenant:{customerId}:user-info:{userId}:v{tokenVersion}` | 5 分钟 | 用户基础信息、角色、园区、权限码、首页路径等 |

为什么 TTL 是 5 分钟：

- 用户信息变化比菜单权限更敏感，例如姓名、手机号、角色、园区范围。
- 5 分钟能降低数据库压力，同时把脏数据窗口控制在较短范围。

### 6.5 短信验证码 Redis 设计

代码位置：`auth/SmsCodeService.java`

验证码 key：

```text
magic:sms-code:{phoneNumber}
```

value 类型：

```java
public record SmsCodeEntry(
    int attempts,
    String code,
    long expiresAtMillis,
    long sentAtMillis
) {}
```

TTL 和限制来自配置：

| 配置                            | 默认值 | 作用                           |
| ------------------------------- | ------ | ------------------------------ |
| `LOGIN_SMS_CODE_LENGTH`         | `6`    | 验证码位数                     |
| `LOGIN_SMS_CODE_TTL`            | `300`  | 验证码有效期，代码中至少 60 秒 |
| `LOGIN_SMS_RESEND_INTERVAL`     | `60`   | 重发间隔                       |
| `LOGIN_SMS_MAX_VERIFY_ATTEMPTS` | `5`    | 最大错误次数                   |

验证码完整流程：

```mermaid
sequenceDiagram
  participant Client as 前端
  participant Auth as AuthService
  participant Sms as SmsCodeService
  participant Redis as Redis
  participant Rabbit as RabbitMQ

  Client->>Auth: POST /auth/send-login-code
  Auth->>Sms: issueCode(phone)
  Sms->>Redis: GET magic:sms-code:{phone}
  alt 未超过重发间隔
    Sms-->>Auth: 抛出发送过频繁
  else 可以发送
    Sms->>Redis: SET key SmsCodeEntry EX 300s
    Auth->>Rabbit: 投递短信发送任务
    Auth-->>Client: debugCode/expiresIn/messageId
  end

  Client->>Auth: POST /auth/code-login
  Auth->>Sms: verifyCode(phone, code)
  Sms->>Redis: GET magic:sms-code:{phone}
  alt 验证成功
    Sms->>Redis: DEL key
    Auth-->>Client: 登录成功 token
  else 验证失败
    Sms->>Redis: 更新 attempts 并保留剩余 TTL
    Auth-->>Client: 验证码不正确
  end
```

这里的关键设计：

- 发送验证码时先读 Redis，判断是否还在重发间隔内。
- 写入 Redis 时设置 TTL，避免验证码永久存在。
- 验证成功后立即删除，防止重复使用。
- 错误次数达到上限后删除，防止暴力猜测。
- 错误次数未到上限时重新写入对象，并把 TTL 设置为剩余有效期。

为什么验证码不通过 `CacheService`：

- 验证码不是普通缓存，而是登录安全状态。
- Redis 失败不能静默降级为查库，否则验证码状态会不一致。
- 验证码有错误次数、重发间隔、成功即删除等强业务语义，适合单独封装。

最值得读：

- `auth/SmsCodeService.java`
- `auth/AuthService.java` 的 `sendLoginCode(...)`、`sendPageAccessCode(...)`、`verifyPageAccessCode(...)`

### 6.6 Redis 写入、删除、更新时机

#### 6.6.1 什么时候写 Redis

| 场景                 | 写入动作                         |
| -------------------- | -------------------------------- |
| 用户首次读取菜单     | 查租户库后写入菜单树缓存         |
| 用户首次读取权限码   | 查租户库后写入权限码列表         |
| 用户首次读取个人信息 | 查租户库后写入用户信息           |
| 发送验证码           | 生成 `SmsCodeEntry` 并写入 Redis |

#### 6.6.2 什么时候删除 Redis

| 场景                             | 删除动作                               |
| -------------------------------- | -------------------------------------- |
| 验证码校验成功                   | 删除 `magic:sms-code:{phoneNumber}`    |
| 验证码过期后被校验               | 删除 `magic:sms-code:{phoneNumber}`    |
| 验证码错误次数达到上限           | 删除 `magic:sms-code:{phoneNumber}`    |
| 新增/更新/删除菜单               | 清理当前租户菜单和权限码前缀           |
| 组织开通完成 followup 且开关打开 | 清理目标租户菜单、权限码、用户信息前缀 |

#### 6.6.3 什么时候更新 Redis

| 场景                       | 更新方式                                 |
| -------------------------- | ---------------------------------------- |
| 验证码输入错误但未达上限   | 更新 `attempts`，并保留剩余 TTL          |
| 菜单/权限/用户信息普通缓存 | 不原地更新，先删除前缀，下次读取重新加载 |

企业项目里更推荐“删除后重建”而不是“原地修改缓存”，原因是：

- 菜单、权限、用户信息是多表聚合结果，原地修改容易遗漏关联。
- 删除缓存后由读请求重新构建，逻辑更简单。
- 短 TTL 可以兜底处理少量未清理到的旧缓存。

### 6.7 组织开通后的 Redis 刷新计划

组织开通完成后，项目不会在 HTTP 请求里直接清 Redis，而是在消息 followup 中生成刷新计划：

```text
OrganizationProvisioningCompletedFollowupConsumerService
  -> OrganizationProvisioningCompletedRedisRefreshPlanService
  -> OrganizationProvisioningCompletedRedisRefreshExecutor
  -> CacheService.evictByPrefix(...)
```

目标前缀：

```text
tenant:{targetCustomerId}:route-menus:
tenant:{targetCustomerId}:system-menu-list:
tenant:{targetCustomerId}:parent-role-menus:
tenant:{targetCustomerId}:permission-codes:
tenant:{targetCustomerId}:user-info:
```

开关：

```text
REDIS_ORGANIZATION_PROVISIONING_REFRESH_ENABLED=false
```

默认关闭的原因：

- 组织开通是高副作用流程，可能伴随建库、复制基础数据、角色迁移、菜单同步。
- 缓存清理范围必须先可视化确认，再开启执行。
- 执行器只接受计划服务生成的前缀，不允许消费端临时拼接新范围，避免误删其它租户缓存。

这里体现的设计模式：

- **Plan/Execute 分离**：先生成计划，再由执行器按计划执行。
- **Feature Toggle**：通过配置开关控制是否真实清理。
- **Least Privilege**：执行器只清理计划内前缀。

最值得读：

- `messaging/OrganizationProvisioningCompletedRedisRefreshPlanService.java`
- `messaging/OrganizationProvisioningCompletedRedisRefreshExecutor.java`
- `messaging/OrganizationProvisioningCompletedFollowupConsumerService.java`

### 6.8 Redis 使用中的注意事项

1. 普通业务缓存必须有 TTL，不要写永久 key。
2. 多租户缓存 key 必须带 `tenant:{customerId}` 前缀，避免串租户。
3. 用户权限相关 key 尽量带 `tokenVersion`，便于权限版本变更后自然失效。
4. 写接口优先清理前缀，而不是手动更新每一个聚合缓存。
5. `CacheService` 可以吞掉 Redis 异常，但验证码这类安全状态不能吞异常。
6. 当前 `evictByPrefix` 使用 `KEYS`，如果后续 Redis key 数量增长，应改为 `SCAN`。
7. 不要把 Redis 当长期任务表；重要任务和消息状态应落 MySQL，例如 `event_outbox`、`event_consume_log`。

### 6.9 Step 6 必读源码

按这个顺序读 Redis 最清楚：

1. `src/main/resources/application.yml`
2. `config/RedisConfig.java`
3. `cache/CacheService.java`
4. `menu/MenuService.java`
5. `permission/PermissionService.java`
6. `user/UserInfoService.java`
7. `auth/SmsCodeService.java`
8. `messaging/OrganizationProvisioningCompletedRedisRefreshPlanService.java`
9. `messaging/OrganizationProvisioningCompletedRedisRefreshExecutor.java`
10. `health/InfrastructureHealthController.java`

### 6.10 下一步

下一节分析登录流程：密码登录、短信验证码登录、JWT、refresh token、Redis 验证码、过滤器鉴权和租户上下文如何串起来。

## 7. 登录与权限流程

### 7.1 先看结论

当前项目没有使用完整的 Spring Security 登录认证链，也没有发现 `SecurityFilterChain`、`@PreAuthorize`、`@Secured` 这类方法级鉴权配置。

它采用的是迁移期更轻量的认证方式：

```text
登录接口签发 JWT
浏览器后续请求带 Authorization: Bearer accessToken
AuthFilter 解析 JWT
解析成功后写入 TenantContext
业务 Service 调用 TenantRequired.currentUser()
没有登录态则抛 401
```

也就是说：

- **登录态鉴权**：靠 `AuthFilter + JwtService + TenantContext + TenantRequired`。
- **刷新会话**：靠 refresh token cookie 和中心库 `refresh_token` 表。
- **密码安全**：使用 `BCryptPasswordEncoder`，同时兼容旧库明文密码。
- **权限码**：从租户库 `user_role -> role_code -> code` 查询，当前主要返回给前端控制菜单和按钮。
- **数据权限**：大量业务接口通过 token 中的 `parks` 和业务 SQL 的 `park_id` 过滤实现。

这样设计的原因：

- 项目处于旧 Nitro 后端迁移到 Java 的阶段，需要保持旧前端接口协议和旧响应结构。
- 完整 Spring Security 改造会影响登录、错误响应、跨域、cookie、前端拦截器等多个面，迁移期风险更大。
- 自定义 JWT payload 可以直接带 `customerId/dbName/roles/parks/tokenVersion`，方便多租户切库和行级权限过滤。

### 7.2 登录相关接口

代码位置：`auth/AuthController.java`

| 接口 | 作用 | 是否需要登录 |
| --- | --- | --- |
| `POST /auth/login` | 用户名密码登录 | 不需要 |
| `POST /auth/code-login` | 短信验证码登录 | 不需要 |
| `POST /auth/refresh` | 用 refresh token 换新的 access token | 不需要 access token，但需要 cookie |
| `POST /auth/logout` | 登出并撤销 refresh token | 需要 cookie，access token 可有可无 |
| `POST /auth/password` | 修改当前用户密码 | 需要 access token |
| `POST /auth/send-login-code` | 发送登录短信验证码 | 不需要 |
| `POST /auth/send-page-access-code` | 给当前登录用户发送页面访问验证码 | 需要 access token |
| `POST /auth/verify-page-access-code` | 校验当前用户页面访问验证码 | 需要 access token |
| `GET /auth/codes` | 获取当前用户权限码 | 需要 access token |

注意：项目没有在 Filter 层直接拦截所有未登录请求。`AuthFilter` 只负责“尝试解析 token 并写入上下文”，真正强制登录发生在业务方法调用 `TenantRequired.currentUser()` 时。

### 7.3 密码登录流程

入口：

```java
@PostMapping("/auth/login")
public ApiResponse<LoginResponse> login(
    @Valid @RequestBody LoginRequest request,
    HttpServletResponse response) {
  return ApiResponse.ok(authService.login(request, response));
}
```

完整流程：

```mermaid
sequenceDiagram
  participant FE as 浏览器
  participant C as AuthController
  participant S as AuthService
  participant R as AuthRepository
  participant Center as 中心库
  participant Tenant as 租户库
  participant JWT as JwtService

  FE->>C: POST /api/auth/login(username,password)
  C->>S: login(request,response)
  S->>R: findCenterUserForLogin(username)
  R->>Center: 查询 user + customer
  Center-->>R: CenterUserRecord
  S->>S: 校验用户状态、租户状态、密码
  S->>Tenant: 根据 customerId/dbName 查询租户用户、角色、权限码、园区
  Tenant-->>S: TenantUserInfo
  S->>JWT: generateAccessToken(payload)
  S->>JWT: issueRefreshToken(payload)
  S->>Center: refresh_token 写入 jti + tokenHash + expiresAt
  S->>FE: Set-Cookie jwt=refreshToken; HttpOnly
  S-->>C: LoginResponse(accessToken + 用户信息)
  C-->>FE: ApiResponse<LoginResponse>
```

密码登录重点逻辑：

1. 中心库用 `username` 查询 `user`，同时关联 `customer`。
2. 检查中心用户 `status=1`。
3. 检查租户 `customer.status` 不是禁用。
4. 校验密码。
5. 用 `customerId/dbName` 获取租户库连接。
6. 查询租户用户、角色、权限码、园区。
7. 生成 access token。
8. 生成 refresh token，并只把 refresh token 的 SHA-256 哈希写入中心库。
9. refresh token 原文写入 HttpOnly cookie。

为什么 refresh token 只存哈希：

- 如果中心库泄漏，攻击者拿不到可直接使用的 refresh token。
- 服务端校验时重新计算请求 token 的 SHA-256，与库里的 `token_hash` 比对。

为什么 access token 不入库：

- access token 设计为短期无状态 token，默认 30 分钟。
- 每次请求只需要验签，不需要查中心库，性能更好。
- 真正需要服务端撤销能力的是 refresh token，因此 refresh token 入库。

### 7.4 短信验证码登录流程

短信登录涉及 Redis 和 RabbitMQ：

```mermaid
sequenceDiagram
  participant FE as 浏览器
  participant Auth as AuthService
  participant Sms as SmsCodeService
  participant Redis as Redis
  participant Rabbit as RabbitMQ
  participant DB as 中心库/租户库

  FE->>Auth: POST /auth/send-login-code(phoneNumber)
  Auth->>Sms: issueCode(phoneNumber)
  Sms->>Redis: SET magic:sms-code:{phone} EX 300s
  Auth->>Rabbit: publishNotification(login_sms_code)
  Auth-->>FE: debugCode/expiresIn/messageId

  FE->>Auth: POST /auth/code-login(phoneNumber,code)
  Auth->>Sms: verifyCode(phoneNumber,code)
  Sms->>Redis: GET + DEL magic:sms-code:{phone}
  Auth->>DB: 查询或受控补齐中心用户、租户用户、映射关系
  Auth->>Auth: issueLoginTokens(...)
  Auth-->>FE: accessToken + refresh cookie
```

这条链路的关键点：

- 验证码状态放 Redis，不放 JVM 内存，支持多实例部署。
- 短信发送不是 Controller 里直接调用供应商，而是投递 RabbitMQ 通知任务。
- 手机号不存在时会尝试自动补齐中心用户、租户用户、默认角色、映射关系，这是为了兼容旧 Nitro 行为。
- 自动补齐只写账号相关表，不触发组织开通、第三方系统、真实短信外呼等高副作用逻辑。

这里的企业项目设计原因：

- 登录验证码是短期状态，Redis 天然适合 TTL 和错误次数限制。
- 短信外呼是外部副作用，放到 RabbitMQ 可重试、可审计，也能避免接口切流时直接打供应商。
- 自动建号属于迁移兼容能力，所以代码故意吞掉部分补齐失败细节，对外仍返回“手机号或验证码错误”。

### 7.5 JWT Payload 里保存什么

代码位置：`security/UserTokenPayload.java`

```java
public record UserTokenPayload(
    Long centerUserId,
    String customerId,
    String dbName,
    Long id,
    List<Map<String, Object>> parks,
    Integer rates,
    Integer reimbursementAuth,
    List<String> roles,
    Long tokenVersion,
    String username) {}
```

字段含义：

| 字段                | 作用                                                |
| ------------------- | --------------------------------------------------- |
| `centerUserId`      | 中心库用户 ID，用于 refresh token、改密、撤销 token |
| `customerId`        | 当前租户 ID，也是缓存 key 和数据源路由的重要字段    |
| `dbName`            | 当前租户库名，用于动态数据源定位                    |
| `id`                | 租户库用户 ID，业务表通常用这个用户 ID              |
| `parks`             | 当前用户可访问的园区范围                            |
| `rates`             | 报销等业务里用到的费率或审批比例                    |
| `reimbursementAuth` | 报销权限级别                                        |
| `roles`             | 当前用户角色名，例如 `Super`                        |
| `tokenVersion`      | token 版本，用于主动失效旧 token 和缓存 key 隔离    |
| `username`          | 登录名                                              |

为什么 payload 带 `dbName`：

- 每个请求进入业务层后，需要通过 `TenantJdbcTemplateProvider` 连接当前租户库。
- 如果每次请求都查中心库再定位租户，会增加中心库压力。

为什么 payload 带 `parks`：

- 园区是核心数据权限边界。
- 很多列表查询需要按 `park_id` 限制当前用户可见数据。

### 7.6 请求鉴权流程

`AuthFilter` 继承 `OncePerRequestFilter`，Spring 会把这个 Filter Bean 注册到 Web 过滤链。

流程：

```mermaid
flowchart TD
  A[HTTP 请求进入] --> B[AuthFilter]
  B --> C{Authorization 是否 Bearer token?}
  C -->|否| D[不设置 TenantContext]
  C -->|是| E[JwtService.verifyAccessToken]
  E -->|成功| F[TenantContext.set(payload)]
  E -->|失败| G[TenantContext.clear]
  D --> H[进入 Controller/Service]
  F --> H
  G --> H
  H --> I{业务是否调用 TenantRequired.currentUser?}
  I -->|是且无 payload| J[抛 401 验证失败]
  I -->|是且有 payload| K[继续执行业务]
  I -->|否| L[作为公开/内部/兼容接口继续执行]
  K --> M[finally 清理 TenantContext]
  L --> M
  J --> M
```

这说明一个重要阅读原则：

- 判断接口是否需要登录，不是只看 Controller 注解。
- 要继续看 Service 是否调用 `TenantRequired.currentUser()` 或 `TenantJdbcTemplateProvider.currentTenantJdbcTemplate()`。
- 如果使用 `currentOrDefaultTenantJdbcTemplate()`，说明它可能允许无 token 走默认租户库。

### 7.7 Refresh Token 流程

配置默认值：

```yaml
app:
  jwt:
    access-token-expires-in: 30m
    refresh-token-expires-in: 7d
  refresh-cookie:
    name: jwt
    secure: false
    max-age-seconds: 604800
```

刷新流程：

```mermaid
sequenceDiagram
  participant FE as 浏览器
  participant Auth as AuthService
  participant JWT as JwtService
  participant DB as 中心库 refresh_token

  FE->>Auth: POST /auth/refresh Cookie: jwt=refreshToken
  Auth->>JWT: verifyRefreshToken(refreshToken)
  Auth->>DB: findRefreshToken(jti)
  Auth->>Auth: 比对 token hash、revoked_at、expires_at
  Auth->>DB: 查询中心用户与 tokenVersion
  Auth->>Auth: 重新解析租户用户
  Auth->>JWT: 生成新 access token 和新 refresh token
  Auth->>DB: 写新 refresh_token，撤销旧 refresh_token
  Auth->>FE: Set-Cookie 新 refresh token
  Auth-->>FE: 新 access token 字符串
```

刷新失败时：

- 清空 refresh token cookie。
- 返回 401。
- 按失败原因带不同 `errorCode`，例如：
  - `AUTH_REFRESH_TOKEN_MISSING`
  - `AUTH_TOKEN_VERSION_MISMATCH`
  - `AUTH_REFRESH_TOKEN_REVOKED`
  - `AUTH_REFRESH_TOKEN_INVALID`

为什么 refresh token 要轮换：

- 每次刷新都生成新 refresh token，并撤销旧 token。
- 如果旧 token 再次出现，说明可能被重放，代码会撤销该用户所有 refresh token 并递增 `token_version`。

### 7.8 登出、改密和 tokenVersion

`tokenVersion` 是这个项目里非常重要的主动失效机制。

| 场景 | 服务端动作 | 结果 |
| --- | --- | --- |
| 登出 | 撤销当前 refresh token，撤销该用户所有未撤销 token，递增 `token_version` | 后续 refresh 失败，新缓存 key 也不命中旧版本 |
| 修改密码 | 更新密码，递增 `token_version`，撤销所有未撤销 refresh token | 所有旧会话失效 |
| refresh token 重放 | 撤销该用户所有 refresh token，递增 `token_version` | 防止被盗 token 继续刷新 |

这里的设计原因：

- JWT access token 本身无状态，签发后在过期前不能直接从库里删除。
- `tokenVersion` 能让下一次 refresh 失败，并让权限/用户缓存 key 进入新版本。
- 对于已经签发且未过期的 access token，当前项目没有每次请求查库校验版本，这是性能和实时撤销之间的取舍。

### 7.9 权限码和菜单权限

权限码接口：

```java
@GetMapping("/auth/codes")
public ApiResponse<List<String>> codes() {
  return ApiResponse.ok(permissionService.getCurrentPermissionCodes());
}
```

查询链路：

```text
AuthController
  -> PermissionService.getCurrentPermissionCodes()
  -> TenantRequired.currentUser()
  -> CacheService.getOrLoad(...)
  -> 租户库 SQL:
     user_role -> role_code -> code
```

当前项目的权限系统可以分三层理解：

| 层次 | 实现方式 | 作用 |
| --- | --- | --- |
| 登录态 | `AuthFilter + TenantRequired` | 判断有没有合法 access token |
| 菜单/按钮权限 | `menu`、`role_menu`、`code`、`role_code` | 控制前端可见菜单和按钮 |
| 数据范围权限 | `parks`、`role_park`、`user_park`、业务 SQL 里的 `park_id` | 控制用户能看哪些园区数据 |

当前没有发现统一的后端接口权限注解，例如 `@RequirePermission("xxx")`。所以阅读业务接口时，要重点看：

- Service 是否调用 `TenantRequired.currentUser()`。
- Repository 是否按 `payload.parks()` 过滤 `park_id`。
- 是否判断 `roles` 中包含 `Super`。
- 写接口是否限制当前用户可操作的园区或资源。

### 7.10 登录相关设计模式

| 设计模式/思想         | 项目体现                                      |
| --------------------- | --------------------------------------------- |
| Filter Chain          | `AuthFilter` 在 Controller 前解析 JWT         |
| ThreadLocal Context   | `TenantContext` 保存当前请求用户和租户信息    |
| Token Rotation        | refresh 时撤销旧 refresh token 并签发新 token |
| Cache Aside           | 权限码、菜单、用户信息读取走 Redis 旁路缓存   |
| Repository Pattern    | `AuthRepository` 封装中心库和租户库 SQL       |
| Feature Compatibility | 短信登录缺失用户时受控补齐旧端账号行为        |

### 7.11 最值得阅读的代码

第一遍按这个顺序读：

1. `auth/AuthController.java`
2. `auth/AuthService.java`
3. `auth/AuthRepository.java`
4. `security/JwtService.java`
5. `security/UserTokenPayload.java`
6. `security/AuthFilter.java`
7. `tenant/TenantContext.java`
8. `tenant/TenantRequired.java`
9. `tenant/TenantJdbcTemplateProvider.java`
10. `permission/PermissionService.java`
11. `menu/MenuService.java`

### 7.12 Debug 路线

如果登录失败，按这个顺序查：

1. `POST /api/auth/login` 请求体是否有 `username/password`。
2. 中心库 `user` 是否存在，`status` 是否为 `1`。
3. 中心库 `customer` 是否存在，`status` 是否启用，`db_name` 是否正确。
4. 密码是否 BCrypt 格式，或是否为旧明文兼容密码。
5. 租户库 `user` 是否存在对应用户，`status` 是否为 `1`。
6. 中心库 `user_tenant_mapping` 是否正确关联中心用户和租户用户。
7. 租户库 `user_role/role/role_code/code/role_park/user_park` 是否有数据。
8. 返回头是否包含 `Set-Cookie: jwt=...`。
9. 前端后续请求是否带 `Authorization: Bearer {accessToken}`。
10. 业务接口是否在 `TenantRequired.currentUser()` 抛出 401。

如果 refresh 失败，重点查：

1. 浏览器是否带 `jwt` cookie。
2. 中心库 `refresh_token.jti` 是否存在。
3. `revoked_at` 是否为空。
4. `expires_at` 是否过期。
5. `token_hash` 是否和请求 token 的 SHA-256 一致。
6. 中心用户 `token_version` 是否和 refresh token payload 一致。

### 7.13 下一步

下一节分析业务模块：按包列出所有业务域、每个模块负责什么、模块之间如何关联，以及第一轮读代码应该优先看哪些模块。

## 8. 业务模块

### 8.1 模块总览

这个项目按业务域纵向分包。一个包内通常同时包含：

```text
Controller -> Service -> Repository -> Request/Query/Response
```

当前主要模块如下：

| 模块 | 核心入口 | 负责什么 | 第一轮优先级 |
| --- | --- | --- | --- |
| `auth` | `AuthController` | 登录、短信验证码登录、refresh token、登出、改密 | 必读 |
| `security` | `AuthFilter`、`JwtService` | JWT 签发、验签、请求上下文 | 必读 |
| `tenant` | `TenantDataSourceRegistry`、`TenantJdbcTemplateProvider` | 多租户动态数据源和当前租户上下文 | 必读 |
| `user` | `UserInfoController`、`UserFeedbackController` | 当前用户信息、用户反馈 | 必读 |
| `system` | `SystemUserController`、`SystemRoleController`、`SystemMenuController` 等 | 用户、角色、菜单、部门、系统配置、版本、菜单模板同步 | 必读 |
| `menu` | `MenuController`、`MenuService` | 当前用户路由菜单、系统菜单树、父角色菜单 | 必读 |
| `permission` | `PermissionService` | 当前用户权限码 | 必读 |
| `park` | `SystemParkController`、`ParkScopeService` | 园区管理、园区权限范围、园区看板统计 | 必读 |
| `factory` | `FactoryController` | 厂房、楼层、出租资源 | 高 |
| `rental` | `RentalTenantController` | 租赁客户、租户档案、工资/关联费用 | 高 |
| `bill` | `AmountBillController` | 总账单、水电明细、催缴短信预览/发送 | 高 |
| `finance` | `FinanceController` | 财务流水、财务图片、账单关联财务查询 | 高 |
| `dashboard` | `DashboardOverviewController`、`AnalyticsController` | 首页看板、统计分析 | 中 |
| `hrm` | `HrmController` | 员工、考勤、请假、轨迹 | 中 |
| `reimbursement` | `ReimbursementController` | 报销申请、报销统计、报销图片 | 中 |
| `access` | `AccessController` | 门禁品牌、访客、车辆、门禁设备 | 中 |
| `maintenance` | `MaintenanceController` | 设备/维保/巡检类接口兼容 | 中 |
| `crm` | `CrmController` | 销售渠道、扫码日志、客户归属、邀请链接、企微/小程序相关 CRM 能力 | 中 |
| `investment` | `InvestmentController` | 招商、招商雷达、线索、爬虫任务、触达、商机分析 | 后置但重要 |
| `organization` | `OrganizationController` | 组织创建、邀请、加入、开通状态、失败重排 | 高 |
| `messaging` | `OutboxController`、RabbitMQ listener/service | Kafka outbox、RabbitMQ 通知/轻任务、消费幂等、站内通知计划 | 高 |
| `job` | `BackendMigrationJobHandlers`、组织开通任务服务 | XXL-Job 任务、组织开通、补偿、退款对账 | 高 |
| `integration` | 微信支付、合众、云码、企微回调 | 第三方系统接入 | 按业务需要读 |
| `image` | `ImageController` | 图片上传和图片表写入 | 中 |
| `sms` | `SmsController` | 通用短信发送/批量发送入口 | 中 |
| `notices` | `NoticesController` | 通知列表 | 中 |
| `llm` | `LlmController`、`ChatController` | LLM 账单分析、智能客服聊天 | 后置 |
| `agent` | `AgentController` | Agent 任务/技能/聊天兼容能力 | 后置 |
| `localization` | `LocalizationController` | 定位记录 | 后置 |
| `smartmeter` | `SmartMeterBrandController` | 智能表品牌 | 后置 |
| `dormitory` | `DormitoryController` | 宿舍创建、更新、删除 | 后置 |
| `cache/common/config/health/status/example` | 基础设施包 | 缓存、公共响应、配置、健康检查、测试接口 | 按需读 |

### 8.2 核心业务关系图

第一轮理解业务时，先抓住这条主线：

```mermaid
flowchart LR
  Auth[登录/用户] --> Perm[角色/菜单/权限]
  Perm --> ParkScope[园区权限范围]

  Park[园区] --> Factory[厂房/楼层]
  Park --> Dormitory[宿舍]
  Factory --> Rental[租赁客户/合同主体]
  Rental --> Bill[账单]
  Bill --> Finance[财务流水]

  ParkScope --> Rental
  ParkScope --> Bill
  ParkScope --> Finance
  ParkScope --> Dashboard[看板统计]

  CRM[CRM/招商] --> Investment[招商雷达/线索]
  Investment --> Rental

  Organization[组织开通] --> Job[XXL-Job 任务]
  Job --> Messaging[Kafka/RabbitMQ]
  Messaging --> Redis[Redis 缓存刷新]
```

企业项目里这样划分的原因：

- `auth/system/menu/permission/tenant` 是所有接口的基础，先解决“谁在访问、访问哪个租户、有什么角色和数据范围”。
- `park/factory/rental/bill/finance` 是园区经营管理主线，业务数据多数围绕 `park_id` 展开。
- `organization/job/messaging` 是迁移期和 SaaS 化的基础设施，承接组织开通、异步事件、通知和补偿。
- `investment/crm` 是业务增长线，代码量大、接口多，建议在主线跑通后再深入。

### 8.3 用户、角色、菜单、权限模块

相关包：

```text
auth
user
system/user
system/role
system/menu
menu
permission
security
tenant
```

职责拆分：

| 包            | 职责                                      |
| ------------- | ----------------------------------------- |
| `auth`        | 登录、短信登录、refresh token、登出、改密 |
| `security`    | JWT 和请求过滤器                          |
| `tenant`      | 当前用户上下文和租户库连接                |
| `user`        | 当前用户信息、用户反馈                    |
| `system/user` | 用户列表、新增、更新、删除、注销          |
| `system/role` | 角色列表、角色菜单、角色权限码、角色园区  |
| `system/menu` | 系统菜单 CRUD                             |
| `menu`        | 菜单树读取和缓存                          |
| `permission`  | 权限码读取和缓存                          |

核心关系：

```text
center.user -> user_tenant_mapping -> tenant.user
tenant.user -> user_role -> role
role -> role_menu -> menu
role -> role_code -> code
role -> role_park -> park
user -> user_park -> park
```

为什么这样设计：

- 中心用户负责全局登录，租户用户负责租户内业务身份。
- 角色同时承载菜单、权限码和园区范围，方便后台统一授权。
- 用户也可以直接绑定园区，兼容旧数据里“用户直接拥有园区”的模型。

设计模式：

- **Repository Pattern**：SQL 集中在 `AuthRepository`、`SystemUserRepository`、`SystemRoleRepository`、`MenuRepository`。
- **Cache Aside**：菜单、权限码、用户信息走 Redis 旁路缓存。
- **Context Holder**：`TenantContext` 通过 ThreadLocal 保存当前用户。

最值得读：

1. `auth/AuthService.java`
2. `auth/AuthRepository.java`
3. `system/user/SystemUserService.java`
4. `system/role/SystemRoleService.java`
5. `menu/MenuService.java`
6. `menu/MenuRepository.java`
7. `permission/PermissionService.java`

### 8.4 园区、厂房、租赁、账单、财务主线

相关包：

```text
park
factory
rental
bill
finance
dashboard
image
```

这条线是当前系统最像“园区经营后台”的核心业务。

业务流：

```mermaid
flowchart TD
  P[创建园区 park] --> F[维护厂房 factory]
  F --> FL[维护楼层 factory_floor]
  FL --> RT[租赁客户 rental_tenant]
  RT --> AB[生成账单 amount_bill]
  AB --> EB[电费明细 ele_bill]
  AB --> WB[水费明细 water_bill]
  AB --> FIN[关联财务 finance]
  FIN --> DASH[看板/统计]
```

模块职责：

| 模块 | 负责什么 | 关键点 |
| --- | --- | --- |
| `park` | 园区 CRUD、园区详情、当前用户园区范围、园区看板统计 | `ParkScopeService` 是数据权限入口 |
| `factory` | 厂房、楼层、可租面积、出租资源 | 与 `park_id` 强关联 |
| `rental` | 租赁客户、合同、租户图片、工资/关联费用 | 关联 `park`、`factory_floor`、`amount_bill` |
| `bill` | 总账单、水电账单、项目选项、导出、催缴短信 | 与 `rental_tenant`、`finance` 强关联 |
| `finance` | 财务流水、财务图片、账单名称选项 | 常被账单模块引用 |
| `dashboard` | 合同、收入、能耗、租赁等统计 | 多表聚合，适合后续优化索引/缓存 |
| `image` | 图片上传和图片资源表 | 被园区、租户、财务、反馈等模块复用 |

这里最重要的代码不是 Controller，而是 Repository 里的查询条件：

- 是否按当前用户 `parks` 限制。
- 是否兼容 `is_deleted`、字段缺失、旧字段名。
- 写接口是否只写白名单字段。

为什么这样设计：

- 园区是数据权限核心，业务表通过 `park_id` 形成访问边界。
- 租户、账单、财务拆表，便于合同主体、多期账单、财务流水分别维护。
- 迁移期接口要保持旧前端字段，所以返回值多用 `Map<String,Object>` 而不是强类型 VO。

设计模式：

- **Domain Service**：Service 负责校验登录态、园区权限、事务边界。
- **Query Object**：例如 `RentalTenantListQuery`、`AmountBillQuery` 封装列表筛选条件。
- **Soft Delete**：大量业务表通过 `is_deleted` 做逻辑删除。

最值得读：

1. `park/ParkScopeService.java`
2. `park/ParkRepository.java`
3. `factory/FactoryService.java`
4. `rental/tenant/RentalTenantService.java`
5. `rental/tenant/RentalTenantRepository.java`
6. `bill/AmountBillService.java`
7. `bill/AmountBillRepository.java`
8. `finance/FinanceRepository.java`

### 8.5 HRM、报销、门禁、维修、定位

相关包：

```text
hrm
reimbursement
access
maintenance
localization
dormitory
smartmeter
```

职责：

| 模块 | 负责什么 | 阅读建议 |
| --- | --- | --- |
| `hrm` | 员工、考勤、请假、轨迹、考勤设备 | 第二轮重点读，接口多但业务边界清楚 |
| `reimbursement` | 报销列表、详情、创建、更新、统计分析 | 与用户、角色、园区权限相关 |
| `access` | 门禁品牌、访客、车辆、门禁设备 | CRUD 结构清晰，适合练习读迁移型接口 |
| `maintenance` | 维保、电梯、消防、卫生、维修单等兼容接口 | 以旧接口迁移为主 |
| `localization` | 定位记录 CRUD | 相对独立 |
| `dormitory` | 宿舍写接口 | 范围较小，可后置 |
| `smartmeter` | 智能表品牌 CRUD | 范围较小，可后置 |

为什么这些可以第二轮读：

- 它们大多依赖前面已经建立的登录态、租户库、园区权限。
- 业务相对垂直，先理解主线后再读，成本更低。
- 很多代码是迁移旧接口的 CRUD 和字段兼容，不是系统架构核心。

最值得读：

- `hrm/HrmService.java`
- `hrm/HrmRepository.java`
- `reimbursement/ReimbursementService.java`
- `access/AccessService.java`
- `maintenance/MaintenanceService.java`

### 8.6 CRM 与招商雷达

相关包：

```text
crm
investment
agent
llm
sms
notices
```

职责：

| 模块 | 负责什么 |
| --- | --- |
| `crm` | 销售渠道、扫码日志、客户归属、邀请链接、小程序/企微入口 |
| `investment` | 招商项目、公开商机、爬虫源、爬虫任务、外部线索、企业画像、招商雷达、触达模板、触达任务、线索跟进、SOP、联系人限制 |
| `agent` | Agent 技能、任务、聊天入口 |
| `llm` | 账单分析、智能客服、LLM 图片/账单辅助 |
| `sms` | 通用短信发送、批量发送 |
| `notices` | 通知列表 |

`investment` 是当前代码量最大的业务包之一，接口非常多。建议不要第一天就陷进去。正确读法是按子域拆：

```text
招商项目 investment/list
公开商机 public-opportunity
爬虫 crawler-source / crawler-task
信号事件 signal-event
外部线索 external-lead
招商线索 lead
触达模板 outreach-template
触达任务 outreach-task
分析看板 analytics
联系人限制 contact-restriction
```

为什么这样设计：

- 招商雷达本质是一个业务中台模块，既有采集任务，也有线索生命周期，还有销售触达和分析统计。
- 接口多、状态多，所以 Service 负责业务动作编排，Repository 负责大量 SQL 和字段兼容。
- LLM、Agent、短信、通知都是外挂能力，不应该放进主交易链路里强耦合。

设计模式：

- **Facade Service**：`InvestmentService` 对 Controller 提供统一门面，内部调用大 Repository 方法。
- **State Machine 思路**：线索、任务、触达模板都有状态流转。
- **Adapter 思路**：LLM、短信、外部平台都通过独立服务封装。

最值得读：

- `crm/CrmController.java`
- `crm/CrmService.java`
- `investment/InvestmentController.java`
- `investment/InvestmentService.java`
- `investment/InvestmentRepository.java`
- `sms/SmsService.java`
- `notices/NoticesService.java`

### 8.7 组织开通、消息、任务

相关包：

```text
organization
job
messaging
```

职责：

| 模块 | 负责什么 |
| --- | --- |
| `organization` | 组织创建、邀请、加入、开通状态、失败任务重排 |
| `job` | XXL-Job 任务、组织开通步骤、建库、复制基础数据、角色成员迁移、心跳、失败处理 |
| `messaging` | Kafka outbox、Kafka listener、RabbitMQ 轻任务、通知路由、站内通知、Redis 刷新计划、消费幂等 |

这条链路是企业级异步架构重点：

```mermaid
flowchart TD
  A[HTTP 创建/重排组织开通任务] --> B[organization_provisioning_job]
  B --> C[XXL-Job 扫描/认领任务]
  C --> D[建库/复制基础数据/迁移成员/切换中心用户]
  D --> E[event_outbox 写业务事件]
  E --> F[OutboxDispatcher 发 Kafka]
  F --> G[Kafka Listener 消费组织开通完成]
  G --> H[RabbitMQ followup 轻任务]
  H --> I[通知计划]
  H --> J[Redis 刷新计划]
  I --> K[站内通知/后续渠道]
  J --> L[按前缀清理缓存]
```

为什么这样设计：

- 组织开通不是普通 HTTP 请求，涉及建库、复制数据、迁移成员，必须可重试、可观察、可补偿。
- Kafka 用于核心业务事件流，RabbitMQ 用于后续轻任务和通知分发，两者职责分开。
- 站内通知、Redis 刷新等都走计划和安全门，避免迁移期误触发副作用。

设计模式：

- **Outbox Pattern**
- **Idempotent Consumer**
- **Plan/Execute 分离**
- **Lease/Claim 任务认领**
- **Feature Toggle**

最值得读：

- `organization/OrganizationService.java`
- `organization/OrganizationRepository.java`
- `job/BackendMigrationJobHandlers.java`
- `job/OrganizationProvisioningJobScanner.java`
- `job/OrganizationProvisioningJobClaimService.java`
- `job/OrganizationProvisioningJobStepService.java`
- `messaging/OutboxService.java`
- `messaging/OutboxDispatcher.java`
- `messaging/EventConsumeLogRepository.java`
- `messaging/OrganizationProvisioningCompletedFollowupConsumerService.java`

### 8.8 外部集成模块

相关包：

```text
integration/hezhong
integration/ymsino
integration/wechat
integration/wework
```

职责：

| 模块                  | 负责什么                                        |
| --------------------- | ----------------------------------------------- |
| `integration/hezhong` | 合众设备/水电接口，包含 token 获取和树/数据查询 |
| `integration/ymsino`  | 云码/水电接口，包含 token 获取和水电数据        |
| `integration/wechat`  | 微信支付、退款、回调验签、JS SDK 配置           |
| `integration/wework`  | 企业微信回调                                    |

为什么外部集成要单独分包：

- 第三方接口有自己的签名、token、超时、重试、错误码，不能散落在业务 Service。
- 这样可以把“外部协议适配”和“内部业务处理”拆开。
- 单元测试更容易 mock 外部响应。

设计模式：

- **Adapter Pattern**：把第三方 API 包成项目内部可调用的 Service/Client。
- **Anti-Corruption Layer**：避免第三方字段直接污染内部业务模型。

最值得读：

- `integration/hezhong/HezhongClient.java`
- `integration/ymsino/YmsinoClient.java`
- `integration/wechat/WechatPayController.java`
- `integration/wechat/WechatPayHttpClient.java`
- `integration/wechat/WechatPaySignatureVerificationService.java`

### 8.9 哪些模块先不用看

第一轮可以暂时后置：

- `example`：示例接口，不代表核心业务。
- `status`：健康/测试类接口。
- `agent`、`llm`：外围智能能力，不影响主业务理解。
- `smartmeter`、`dormitory`、`localization`：垂直小模块，可以在需要改动时再读。
- `investment` 的全部细节：先知道它是招商雷达大模块，不要一开始逐行读超大 Repository。

第一轮必须先看：

1. `auth`
2. `security`
3. `tenant`
4. `system/user`
5. `system/role`
6. `menu`
7. `permission`
8. `park`
9. `factory`
10. `rental`
11. `bill`
12. `finance`

### 8.10 Step 8 阅读顺序

建议按这条路线读业务代码：

```text
登录和租户上下文
  -> 用户/角色/菜单/权限
  -> 园区权限范围
  -> 园区/厂房/楼层
  -> 租赁客户
  -> 账单
  -> 财务
  -> 看板
  -> HRM/报销/门禁
  -> CRM/招商雷达
  -> 组织开通/消息/任务
  -> 外部集成
```

### 8.11 MQ 专项：Kafka、RabbitMQ 与 Outbox

本项目同时接入 Kafka 和 RabbitMQ，但二者职责不同：

| 组件 | 项目用途 | 核心代码 |
| --- | --- | --- |
| Kafka | 核心业务事件流，例如组织开通完成事件 | `OutboxService`、`OutboxDispatcher`、`OrganizationProvisioningCompletedKafkaListener` |
| RabbitMQ | 通知、轻任务、短信任务、延迟重试、死信队列 | `RabbitMqConfig`、`RabbitMessagePublisher`、各类 `RabbitListener` |
| MySQL Outbox | 业务事件先落库，再异步发 Kafka | `event_outbox`、`OutboxRepository` |
| 消费幂等日志 | 防止 Kafka/RabbitMQ 重复投递导致重复处理 | `event_consume_log`、`EventConsumeLogRepository` |

#### 8.11.1 Kafka Outbox 流程

手工 DDL：

```text
src/main/resources/db/manual/001-event-outbox.sql
```

核心表：

| 表 | 作用 |
| --- | --- |
| `event_outbox` | 待发送业务事件，状态包括 `pending/retry/dispatching/sent/dead` |
| `event_consume_log` | 消费幂等日志，按 `event_id + consumer_group` 唯一 |

Outbox 派发流程：

```mermaid
sequenceDiagram
  participant Biz as 业务服务
  participant DB as 中心库 event_outbox
  participant Dispatcher as OutboxDispatcher
  participant Kafka as Kafka

  Biz->>DB: INSERT event_outbox(status=pending)
  Dispatcher->>DB: findDispatchable(pending/retry)
  Dispatcher->>DB: markDispatching(id)
  Dispatcher->>Kafka: send(topic,key,payload,headers)
  alt 发送成功
    Dispatcher->>DB: markSent(id)
  else 发送失败
    Dispatcher->>DB: markRetry(id,last_error,next_attempt_at)
  end
```

关键配置：

```yaml
app:
  kafka:
    consumer-enabled: false
    outbox-dispatch-enabled: false
    outbox-event-write-enabled: false
    outbox-dispatch-interval-ms: 5000
```

为什么这样设计：

- 业务事件先落库，避免“数据库提交成功但消息发送失败”的不一致。
- Dispatcher 通过条件更新把事件从 `pending/retry` 改为 `dispatching`，避免多实例重复发送。
- 失败后指数退避，最多重试到 `dead`，便于人工排查。

设计模式：

- **Outbox Pattern**
- **Retry with Backoff**
- **Competing Consumers/Claim**

最值得读：

- `messaging/OutboxRepository.java`
- `messaging/OutboxService.java`
- `messaging/OutboxDispatcher.java`

#### 8.11.2 Kafka 当前消费：组织开通完成事件

当前 Kafka listener 默认关闭：

```java
@ConditionalOnProperty(prefix = "app.kafka", name = "consumer-enabled", havingValue = "true")
```

监听 topic：

```text
magic.organization.provisioning
```

只处理事件类型：

```text
organization.provisioning.completed
```

消费流程：

```mermaid
flowchart TD
  A[Kafka 消息] --> B[OrganizationProvisioningCompletedKafkaListener]
  B --> C{eventType 是否 organization.provisioning.completed}
  C -->|否| D[跳过]
  C -->|是| E[校验 eventId/customerId/idempotencyKey/topic]
  E --> F[解析 payload: jobId/targetCustomerId/targetDbName]
  F --> G[event_consume_log claimProcessing]
  G --> H{是否首次或 failed 可重试}
  H -->|否| I[duplicate/already_processing]
  H -->|是| J[投递 RabbitMQ light-task]
  J --> K[event_consume_log markSuccess]
```

为什么消费时要写 `event_consume_log`：

- Kafka 默认至少一次投递，重复消费是正常现象。
- 组织开通完成后续可能触发通知、缓存刷新、补偿任务，必须保证同一个事件同一个 consumer group 只处理一次。
- 历史 `failed` 允许重新认领，方便 Kafka 重试后继续处理。

最值得读：

- `messaging/OrganizationProvisioningCompletedKafkaListener.java`
- `messaging/OrganizationProvisioningCompletedConsumerService.java`
- `messaging/EventConsumeLogRepository.java`

#### 8.11.3 RabbitMQ 拓扑

拓扑常量在 `RabbitMqTopology.java`：

| 类型           | 名称                             |
| -------------- | -------------------------------- |
| 通知交换机     | `magic.notification.exchange`    |
| 轻任务交换机   | `magic.light-task.exchange`      |
| 延迟交换机     | `magic.delay.exchange`           |
| 死信交换机     | `magic.dlx.exchange`             |
| 通知主队列     | `magic.notification.queue`       |
| 通知重试队列   | `magic.notification.retry.queue` |
| 通知死信队列   | `magic.notification.dlq`         |
| 轻任务队列     | `magic.light-task.queue`         |
| 轻任务死信队列 | `magic.light-task.dlq`           |
| 延迟重试队列   | `magic.delay.retry.queue`        |

RabbitMQ 配置特点：

- 使用 topic exchange 区分通知和轻任务。
- 队列 durable，消息 publisher 设置 persistent。
- 重试队列通过 TTL + DLX 回到主通知队列。
- 轻任务和通知都有 DLQ，失败消息不会静默丢失。

最值得读：

- `messaging/rabbit/RabbitMqConfig.java`
- `messaging/rabbit/RabbitMqTopology.java`
- `messaging/rabbit/RabbitMessagePublisher.java`

#### 8.11.4 RabbitMQ 当前主要链路

组织开通完成后的异步链路：

```mermaid
sequenceDiagram
  participant KafkaConsumer as Kafka Consumer
  participant LightQ as Rabbit light-task queue
  participant Followup as Followup Consumer
  participant NotifyQ as Rabbit notification queue
  participant Redis as Redis
  participant Log as event_consume_log

  KafkaConsumer->>LightQ: publish followup task
  LightQ->>Followup: consume organization.provisioning.completed.followup
  Followup->>Log: claimProcessing
  Followup->>Followup: build notification plan
  Followup->>Followup: build redis refresh plan
  alt Redis 刷新开关打开
    Followup->>Redis: evictByPrefix(...)
  end
  alt 通知投递开关打开
    Followup->>NotifyQ: publish notification message
  end
  Followup->>Log: markSuccess
```

相关开关：

```yaml
app:
  rabbit-mq:
    consumer-enabled: false
    notification-routing-consumer-enabled: false
    organization-provisioning-notification-consumer-enabled: false
    notification-publish-enabled: false
```

默认关闭的原因：

- `magic.notification.queue` 是共享队列，不能让未验收的 listener 把不属于自己的消息 ack 掉。
- 通知发送、站内通知写入、Redis 刷新都是副作用，必须逐个开关灰度。
- 当前不少服务先生成 plan，再由开关决定是否执行，这是迁移期常见的安全策略。

最值得读：

- `messaging/OrganizationProvisioningCompletedFollowupPublisher.java`
- `messaging/OrganizationProvisioningCompletedFollowupRabbitListener.java`
- `messaging/OrganizationProvisioningCompletedFollowupConsumerService.java`
- `messaging/OrganizationProvisioningCompletedNotificationPublisher.java`
- `messaging/OrganizationProvisioningCompletedNotificationRabbitListener.java`
- `messaging/NotificationRoutingRabbitListener.java`

#### 8.11.5 消息设计注意事项

1. 新增业务事件时，优先写 `event_outbox`，不要在业务事务里直接发 Kafka。
2. Kafka 消费必须考虑重复投递，使用 `event_consume_log` 或业务唯一键做幂等。
3. RabbitMQ 消费共享队列时必须校验 `eventType/templateKey/taskType`，不能误 ack 其它业务消息。
4. 高副作用能力必须有配置开关，默认关闭，先 dry-run 再开启。
5. 消息 payload 必须包含可排查字段，例如 `eventId/eventType/customerId/idempotencyKey/jobId`。
6. RabbitMQ 重试和 DLQ 是兜底，不应该掩盖业务幂等设计缺失。

### 8.12 下一步

下一节分析定时任务：Spring `@Scheduled`、XXL-Job 配置、组织开通任务、补偿任务和对账任务。

## 9. 定时任务与 XXL-Job

### 9.1 项目里有哪些任务机制

当前项目有两类任务机制：

| 机制 | 代码证据 | 用途 | 适合场景 |
| --- | --- | --- | --- |
| Spring `@Scheduled` | `messaging/OutboxDispatcher.java` | 本地定时扫描 outbox 并派发 Kafka | 轻量、低风险、可幂等的小轮询 |
| XXL-Job | `job/XxlJobConfig.java`、`BackendMigrationJobHandlers.java` | 组织开通、对账、同步、补偿、爬虫调度等 | 需要调度平台、人工触发、参数、日志、重跑的任务 |

启动入口 `BackendSpringbootApplication` 上有：

```java
@EnableScheduling
```

所以 `@Scheduled` 会生效。XXL-Job 是否生效由配置控制：

```yaml
app:
  xxl-job:
    enabled: ${XXL_JOB_ENABLED:false}
```

`application-prod.yml` 中默认：

```yaml
app:
  xxl-job:
    enabled: ${XXL_JOB_ENABLED:true}
```

也就是说：本地默认不开 XXL-Job，生产 profile 默认准备开启，但仍可通过环境变量关闭。

### 9.2 Spring Scheduled：Outbox 派发

代码位置：`messaging/OutboxDispatcher.java`

```java
@Scheduled(fixedDelayString = "${app.kafka.outbox-dispatch-interval-ms:5000}")
public void dispatch() {
  if (!appProperties.getKafka().isOutboxDispatchEnabled()) {
    return;
  }
  outboxService.dispatchBatch(50);
}
```

作用：

- 每隔 5 秒扫描 `event_outbox`。
- 只在 `KAFKA_OUTBOX_DISPATCH_ENABLED=true` 时真正派发。
- 每批最多处理 50 条。

为什么这个适合用 `@Scheduled`：

- 派发逻辑是幂等的，事件会先 `markDispatching`。
- 失败会回写 `retry/dead`，不会在内存里丢状态。
- 它是基础设施小任务，不需要复杂人工参数。

### 9.3 XXL-Job 初始化

代码位置：`job/XxlJobConfig.java`

```java
@Bean
@ConditionalOnProperty(prefix = "app.xxl-job", name = "enabled", havingValue = "true")
public XxlJobSpringExecutor xxlJobExecutor(AppProperties appProperties) {
  ...
}
```

配置项：

| 配置 | 作用 |
| --- | --- |
| `XXL_JOB_ENABLED` | 是否注册 XXL-Job executor |
| `XXL_JOB_ADMIN_ADDRESSES` | XXL-Job Admin 地址 |
| `XXL_JOB_ACCESS_TOKEN` | executor 和 admin 通信 token |
| `XXL_JOB_EXECUTOR_APPNAME` | executor 应用名，默认 `magic-backend-springboot` |
| `XXL_JOB_EXECUTOR_ADDRESS` | executor 注册地址 |
| `XXL_JOB_EXECUTOR_IP` | executor IP |
| `XXL_JOB_EXECUTOR_PORT` | executor 端口，默认 `9999` |
| `XXL_JOB_LOG_PATH` | 任务日志目录 |
| `XXL_JOB_LOG_RETENTION_DAYS` | 日志保留天数 |

为什么要用 XXL-Job：

- 组织开通、退款对账、爬虫巡检这类任务需要可视化调度、人工重跑和执行日志。
- 任务执行通常跨数据库、跨外部系统，不适合由 HTTP 请求直接触发完成。
- 调度平台可以控制并发、超时、重试和执行历史。

### 9.4 当前 XXL-Job Handler

代码位置：`job/BackendMigrationJobHandlers.java`

| Handler 名称                      | 当前用途                        |
| --------------------------------- | ------------------------------- |
| `organizationProvisioningJob`     | 组织空间开通任务                |
| `vipMembershipRefundReconcileJob` | 会员退款对账                    |
| `rentalExpenseFinanceSyncJob`     | 租赁费用财务同步，占位/迁移任务 |
| `amountBillCollectionSmsScanJob`  | 账单催缴短信扫描，占位/迁移任务 |
| `investmentRadarCrawlerJob`       | 招商雷达爬虫调度，占位/迁移任务 |
| `menuTemplateSyncJob`             | 菜单模板同步，占位/迁移任务     |
| `publicCrawlerHealthCheckJob`     | 公开爬虫健康检查，占位/迁移任务 |

所有 handler 都走同一入口：

```text
BackendMigrationJobHandlers.run(jobName)
  -> JobParameterParser.parse(...)
  -> JobParameterParser.execute(...)
  -> MigrationJobService.run(jobName, parameters, execute)
```

这里有一个很重要的设计：**默认可以 dry-run**。

XXL-Job 参数会解析出 `execute`，只有 `execute=true` 且具体动作参数也打开时，才进入真实执行。这样做是为了迁移期能先看计划和候选数据，再逐步打开写操作。

### 9.5 组织开通任务为什么复杂

组织开通不是简单插一行表，它可能包含：

```text
扫描候选任务
认领任务租约
预检
重建目标数据库
克隆 schema
复制基础数据
迁移组织角色和成员
迁移用户范围数据
写角色快照
切换中心用户到目标租户
标记开通完成
写 outbox 事件
Kafka/RabbitMQ 后续通知和缓存刷新
```

流程图：

```mermaid
flowchart TD
  A[tenant_provisioning_job pending] --> B[Scanner 扫描候选]
  B --> C[ClaimService 抢占租约]
  C --> D[Preflight 预检]
  D --> E[DatabaseRebuildPlan]
  E --> F[SchemaClonePlan]
  F --> G[BaseDataCopyPlan]
  G --> H[RoleMemberMigrationPlan]
  H --> I[CenterUserSwitch]
  I --> J[CompletionService 标记 completed]
  J --> K[BusinessOutboxPublisher 写 outbox]
  K --> L[OutboxDispatcher 发 Kafka]
```

为什么这样设计：

- 组织开通涉及建库和跨库数据复制，失败后必须知道卡在哪一步。
- 使用 `step/status/retry_count/lock_owner/heartbeat_at` 能支持续跑和人工排障。
- 每一步拆成独立 service，便于单元测试和灰度执行。

核心服务：

| 服务 | 作用 |
| --- | --- |
| `OrganizationProvisioningJobScanner` | 扫描可执行候选任务，不加锁 |
| `OrganizationProvisioningJobClaimService` | 抢占任务租约，写 `lock_owner/heartbeat_at/step` |
| `OrganizationProvisioningJobPreflightService` | 执行前预检 |
| `OrganizationProvisioningDatabaseRebuildPlanService` | 重建目标库计划 |
| `OrganizationProvisioningSchemaClonePlanService` | schema 克隆计划/执行 |
| `OrganizationProvisioningBaseDataCopyPlanService` | 基础数据复制 |
| `OrganizationProvisioningRoleMemberMigrationPlanService` | 角色、成员、用户范围数据迁移 |
| `OrganizationProvisioningJobCompletionService` | 标记任务完成，并可选写 outbox |
| `OrganizationProvisioningJobFailureService` | 标记失败、重试或人工处理 |
| `OrganizationProvisioningJobHeartbeatService` | 长任务执行中刷新心跳 |

### 9.6 HTTP 为什么不直接执行长任务

`OrganizationController` 里很多注释都强调：HTTP 入口只登记、查询、重排，不直接执行开通 worker。

企业项目这样设计的原因：

- HTTP 请求有超时限制，建库/复制数据可能需要较长时间。
- 长任务失败后需要可恢复，不能只靠请求日志。
- 用户重复点击或网络重试可能导致重复执行，需要任务表和租约保护。
- 组织开通属于高副作用动作，必须支持 dry-run、确认串、人工重排。

典型例子：

- `/organization/provisioning/requeue-failed-manual` 只把 `failed_manual` 重置为 `pending`。
- 真正执行仍由 XXL-Job worker 后续消费。

### 9.7 任务相关设计模式

| 设计模式/思想 | 项目体现 |
| --- | --- |
| Lease/Claim | `lock_owner/locked_at/heartbeat_at` 抢占任务 |
| Heartbeat | 长步骤执行中刷新 `heartbeat_at`，避免误判卡死 |
| Step Machine | `tenant_provisioning_job.step` 表示当前阶段 |
| Dry Run / Plan | 很多方法先返回计划，不直接执行 |
| Retry / Manual Intervention | `failed_retryable`、`failed_manual` 区分自动重试和人工介入 |
| Outbox Pattern | 任务完成后写 outbox，再异步发 Kafka |

### 9.8 Step 9 必读源码

按这个顺序读任务部分：

1. `job/XxlJobConfig.java`
2. `job/BackendMigrationJobHandlers.java`
3. `job/JobParameterParser.java`
4. `job/MigrationJobService.java`
5. `organization/OrganizationController.java`
6. `organization/OrganizationService.java`
7. `job/OrganizationProvisioningJobScanner.java`
8. `job/OrganizationProvisioningJobClaimService.java`
9. `job/OrganizationProvisioningJobStepService.java`
10. `job/OrganizationProvisioningJobCompletionService.java`
11. `messaging/BusinessOutboxPublisher.java`
12. `messaging/OutboxDispatcher.java`

### 9.9 下一步

下一节分析公共组件：统一响应、异常处理、分页、配置类、过滤器、缓存封装、数据源封装和常用工具。

## 10. 公共组件

### 10.1 公共组件总览

| 组件 | 代码位置 | 作用 |
| --- | --- | --- |
| 统一响应 | `common/ApiResponse.java` | Controller 成功返回统一 `{code,data,error,message}` |
| 业务异常 | `common/BusinessException.java` | 带 HTTP 状态码和可选业务错误码 |
| 全局异常处理 | `common/GlobalExceptionHandler.java` | 统一处理业务异常、参数校验异常和未知异常 |
| 分页参数 | `common/PageRequestParams.java` | 归一化页码、页大小、整数参数 |
| 分页结果 | `common/PageResult.java` | 统一返回 `items/total/currentPage/pageSize` |
| 中心库数据源 | `config/DataSourceConfig.java` | 创建中心库 Hikari 数据源和 `centerJdbcTemplate` |
| 数据库 URL 解析 | `config/DatabaseUrl.java` | 兼容 `mysql://user:pwd@host/db` 和 `jdbc:mysql://...` |
| 租户库数据源 | `tenant/TenantDataSourceRegistry.java` | 按 `customerId/dbName` 动态创建并缓存租户库连接池 |
| 当前租户 JDBC | `tenant/TenantJdbcTemplateProvider.java` | 根据当前 token 拿租户库 `JdbcTemplate` |
| 请求上下文 | `tenant/TenantContext.java` | ThreadLocal 保存当前用户 payload |
| 登录态要求 | `tenant/TenantRequired.java` | 没有当前用户时抛 401 |
| JWT 过滤器 | `security/AuthFilter.java` | 从 Bearer token 解析用户上下文 |
| Redis 封装 | `cache/CacheService.java` | 旁路缓存和前缀删除 |
| Web 配置 | `config/WebConfig.java` | CORS 配置 |
| Redis 配置 | `config/RedisConfig.java` | `RedisTemplate<String,Object>` 序列化配置 |
| MyBatis-Plus 配置 | `config/MybatisPlusConfig.java` | 分页插件、下划线转驼峰、关闭二级缓存 |
| 应用配置绑定 | `config/AppProperties.java` | 绑定 `app.*` 下的 JWT、Redis、Kafka、RabbitMQ、XXL-Job 等配置 |

### 10.2 统一响应和异常

成功响应：

```java
public record ApiResponse<T>(Integer code, T data, Object error, String message) {
  public static <T> ApiResponse<T> ok(T data) {
    return new ApiResponse<>(0, data, null, "ok");
  }
}
```

业务异常：

```java
throw new BusinessException(HttpStatus.BAD_REQUEST, "参数错误");
```

异常处理：

```java
@ExceptionHandler(BusinessException.class)
public ResponseEntity<Object> handleBusinessException(BusinessException exception) {
  ...
}
```

返回结构特点：

- 成功：HTTP 200，`code=0`。
- 业务失败：HTTP 状态码跟 `BusinessException.status` 一致，body 里也放 `code/status/message/error`。
- 参数校验失败：HTTP 400。
- 未知异常：HTTP 500，日志里记录堆栈，对外只返回“服务器内部错误”。

为什么这样设计：

- 保持旧前端对 `code/data/message` 的兼容。
- 业务异常可控，不需要每个 Controller 手写 try/catch。
- 未知异常不把堆栈暴露给前端，符合生产安全要求。

设计模式：

- **Controller Advice**
- **Exception Translation**
- **Factory Method**：`ApiResponse.ok/error` 静态工厂。

最值得读：

- `common/ApiResponse.java`
- `common/BusinessException.java`
- `common/GlobalExceptionHandler.java`

### 10.3 分页组件

分页结果：

```java
public record PageResult<T>(
    List<T> items,
    long total,
    Integer currentPage,
    Integer pageSize
) {}
```

分页参数归一化：

```java
PageRequestParams.normalizePage(currentPage, 1)
PageRequestParams.normalizePageSize(pageSize, 20)
```

约束：

- 页码最小为 1。
- 页大小最小为 1，最大为 200。
- 非数字参数回退默认值。

为什么这样设计：

- 前端传参可能是字符串、空值或非法数字。
- 统一兜底避免每个 Service 重复写参数校验。
- 限制最大 pageSize，避免一次查询拖垮数据库。

### 10.4 数据源公共组件

中心库：

```text
DataSourceConfig
  -> centerDataSource
  -> centerJdbcTemplate
```

租户库：

```text
TenantContext 当前用户
  -> TenantJdbcTemplateProvider
  -> TenantDataSourceRegistry.getDataSource(customerId, dbName)
  -> HikariDataSource 缓存
```

租户库连接池缓存 key：

```text
{customerId}:{dbName}
```

如果没有 `dbName`，则使用：

```text
{customerId}
```

为什么租户库要动态创建：

- 每个租户可能对应不同数据库。
- 登录 token 中带 `customerId/dbName` 后，请求可以直接定位租户库。
- 使用 `ConcurrentHashMap` 缓存 HikariDataSource，避免每次请求重新建连接池。

注意事项：

- `normalizeDatabaseName` 只允许 `\w+`，防止数据库名注入。
- `public` 租户优先使用 `PUBLIC_DATABASE_URL`。
- 非默认客户如果没有模板 URL，会基于 `DATABASE_URL` 替换库名为 `customer_{customerId}`。

最值得读：

- `config/DataSourceConfig.java`
- `config/DatabaseUrl.java`
- `tenant/TenantDataSourceRegistry.java`
- `tenant/TenantJdbcTemplateProvider.java`

### 10.5 请求上下文组件

请求上下文链路：

```mermaid
flowchart LR
  HTTP[HTTP 请求] --> Filter[AuthFilter]
  Filter --> Jwt[JwtService.verifyAccessToken]
  Jwt --> Context[TenantContext.set(payload)]
  Context --> Service[业务 Service]
  Service --> Required[TenantRequired.currentUser]
  Required --> Jdbc[TenantJdbcTemplateProvider.currentTenantJdbcTemplate]
  Jdbc --> DB[(租户库)]
```

为什么用 ThreadLocal：

- WebMVC 一个请求通常绑定一个线程，ThreadLocal 能让业务层不用层层传 `UserTokenPayload`。
- Service 和 Repository 可以通过统一入口拿到当前租户和用户。

注意事项：

- `AuthFilter` 的 `finally` 中必须 `TenantContext.clear()`，否则线程复用会串用户。
- 异步线程里不能直接依赖 `TenantContext`，需要显式传 payload。

### 10.6 配置组件

`AppProperties` 绑定 `app.*`：

```text
app.jwt
app.refresh-cookie
app.redis
app.sms
app.kafka
app.rabbit-mq
app.xxl-job
app.hezhong
app.ymsino
```

为什么不用到处 `@Value`：

- 集中管理配置，类型更清晰。
- 测试时可以直接构造或修改 properties。
- 新人查配置时只看一个类就能知道有哪些业务开关。

少数基础设施配置仍使用 Spring 标准前缀：

```text
spring.datasource.center
spring.datasource.tenant
spring.data.redis
spring.kafka
spring.rabbitmq
management.*
mybatis-plus.*
```

### 10.7 Web 与跨域

`WebConfig` 配置 CORS：

- 允许方法：`GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS`
- 允许 header：`*`
- 暴露 header：`*`
- 允许 credentials：`true`
- 来源从 `app.cors.allowed-origins` 读取，默认 `*`

为什么要注意 CORS：

- refresh token 存在 HttpOnly cookie 中。
- 前端跨域请求如果要带 cookie，需要 `allowCredentials(true)`。
- 生产环境不建议长期使用 `*`，应配置明确域名。

### 10.8 公共组件阅读顺序

1. `common/ApiResponse.java`
2. `common/BusinessException.java`
3. `common/GlobalExceptionHandler.java`
4. `common/PageRequestParams.java`
5. `config/AppProperties.java`
6. `config/DataSourceConfig.java`
7. `config/DatabaseUrl.java`
8. `tenant/TenantContext.java`
9. `tenant/TenantRequired.java`
10. `tenant/TenantDataSourceRegistry.java`
11. `security/AuthFilter.java`
12. `cache/CacheService.java`

### 10.9 下一步

下一节分析配置中心与环境配置：`application.yml`、`application-local.yml`、`application-prod.yml`、环境变量、Nacos/Apollo 是否存在。

## 11. 配置中心与环境配置

### 11.1 当前配置结论

当前 Java 后端没有接入：

- Nacos
- Apollo
- Spring Cloud Config
- Consul
- `bootstrap.yml`

配置来源是标准 Spring Boot：

```text
application.yml
application-local.yml
application-prod.yml
环境变量
命令行参数
```

为什么这样设计：

- 当前是迁移中的独立 Spring Boot 服务，先用本地配置和环境变量能降低基础设施依赖。
- 生产部署时通过环境变量注入数据库、Redis、Kafka、RabbitMQ、JWT 密钥等敏感配置。
- 大量副作用能力通过开关控制，方便逐步灰度。

### 11.2 配置文件职责

| 文件 | 作用 |
| --- | --- |
| `application.yml` | 主配置，定义端口、上下文路径、数据源、Redis、Kafka、RabbitMQ、JWT、短信、XXL-Job 等默认值 |
| `application-local.yml` | 本地开发覆盖配置，Kafka/RabbitMQ required 默认为 false，XXL-Job 默认关闭 |
| `application-prod.yml` | 生产覆盖配置，refresh cookie 默认 secure，Kafka/RabbitMQ required 为 true，XXL-Job 默认 true |

应用端口和上下文路径：

```yaml
server:
  port: ${SERVER_PORT:8080}
  servlet:
    context-path: /api
```

所以 Controller 里的：

```java
@PostMapping("/auth/login")
```

实际访问路径是：

```text
POST /api/auth/login
```

### 11.3 核心环境变量

#### 11.3.1 数据库

| 环境变量                         | 作用                               |
| -------------------------------- | ---------------------------------- |
| `CENTER_DATABASE_URL`            | 中心库连接，必填                   |
| `CENTER_DATABASE_POOL_MAX`       | 中心库最大连接池                   |
| `CENTER_DATABASE_POOL_MIN_IDLE`  | 中心库最小空闲连接                 |
| `DATABASE_URL`                   | 默认租户库连接                     |
| `PUBLIC_DATABASE_URL`            | public 租户库连接                  |
| `CUSTOMER_DATABASE_URL_TEMPLATE` | 按客户生成租户库 URL 的模板        |
| `CUSTOMER_DB_PREFIX`             | 默认租户库名前缀，默认 `customer_` |
| `TENANT_DATABASE_POOL_MAX`       | 租户库最大连接池                   |
| `TENANT_DATABASE_POOL_MIN_IDLE`  | 租户库最小空闲连接                 |

注意：`CENTER_DATABASE_URL` 为空时应用启动会失败，这是中心库强依赖。

#### 11.3.2 Redis

| 环境变量 | 作用 |
| --- | --- |
| `REDIS_URL` | Redis 连接地址 |
| `REDIS_ORGANIZATION_PROVISIONING_REFRESH_ENABLED` | 组织开通完成后是否执行 Redis 缓存刷新 |

#### 11.3.3 JWT 和 Cookie

| 环境变量 | 默认值 | 作用 |
| --- | --- | --- |
| `ACCESS_TOKEN_SECRET` | `access-secret` | access token 签名密钥 |
| `REFRESH_TOKEN_SECRET` | `refresh-secret` | refresh token 签名密钥 |
| `ACCESS_TOKEN_EXPIRES_IN` | `30m` | access token 有效期 |
| `REFRESH_TOKEN_EXPIRES_IN` | `7d` | refresh token 有效期 |
| `REFRESH_TOKEN_COOKIE_SECURE` | local false / prod true | cookie 是否加 Secure |
| `REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS` | `604800` | refresh cookie 有效期 |

生产注意事项：

- 不能使用默认 JWT secret。
- HTTPS 环境下 refresh cookie 应使用 `Secure; SameSite=None`。

#### 11.3.4 短信验证码

| 环境变量                        | 默认值 | 作用         |
| ------------------------------- | ------ | ------------ |
| `LOGIN_SMS_CODE_LENGTH`         | `6`    | 验证码位数   |
| `LOGIN_SMS_CODE_TTL`            | `300`  | 验证码有效期 |
| `LOGIN_SMS_RESEND_INTERVAL`     | `60`   | 重发间隔     |
| `LOGIN_SMS_MAX_VERIFY_ATTEMPTS` | `5`    | 最大错误次数 |

#### 11.3.5 Kafka

| 环境变量                            | 作用                    |
| ----------------------------------- | ----------------------- |
| `KAFKA_BOOTSTRAP_SERVERS`           | Kafka 地址              |
| `KAFKA_CONSUMER_GROUP`              | 消费组                  |
| `KAFKA_REQUIRED`                    | Kafka 是否强依赖        |
| `KAFKA_CONSUMER_ENABLED`            | 是否启用 Kafka listener |
| `KAFKA_OUTBOX_DISPATCH_ENABLED`     | 是否启用 outbox 派发    |
| `KAFKA_OUTBOX_EVENT_WRITE_ENABLED`  | 是否允许业务写 outbox   |
| `KAFKA_OUTBOX_DISPATCH_INTERVAL_MS` | outbox 派发间隔         |

#### 11.3.6 RabbitMQ

| 环境变量 | 作用 |
| --- | --- |
| `RABBITMQ_HOST`、`RABBITMQ_PORT` | RabbitMQ 地址 |
| `RABBITMQ_USERNAME`、`RABBITMQ_PASSWORD` | 账号密码 |
| `RABBITMQ_VIRTUAL_HOST` | vhost |
| `RABBITMQ_CONSUMER_ENABLED` | 是否启用轻任务消费者 |
| `RABBITMQ_NOTIFICATION_ROUTING_CONSUMER_ENABLED` | 是否启用通用 notification 路由消费者 |
| `RABBITMQ_ORGANIZATION_PROVISIONING_NOTIFICATION_CONSUMER_ENABLED` | 是否启用组织开通通知专用消费者 |
| `RABBITMQ_NOTIFICATION_PUBLISH_ENABLED` | 是否真实投递 notification 队列 |
| `RABBITMQ_RETRY_DELAY_MS` | 重试队列 TTL |

RabbitMQ 配置里的开关非常多，本质都是为了控制通知、站内消息、provider 执行等副作用。

#### 11.3.7 XXL-Job

| 环境变量                     | 作用                      |
| ---------------------------- | ------------------------- |
| `XXL_JOB_ENABLED`            | 是否启用 XXL-Job executor |
| `XXL_JOB_ADMIN_ADDRESSES`    | XXL-Job Admin 地址        |
| `XXL_JOB_ACCESS_TOKEN`       | 通信 token                |
| `XXL_JOB_EXECUTOR_APPNAME`   | executor appName          |
| `XXL_JOB_EXECUTOR_ADDRESS`   | executor 注册地址         |
| `XXL_JOB_EXECUTOR_IP`        | executor IP               |
| `XXL_JOB_EXECUTOR_PORT`      | executor 端口             |
| `XXL_JOB_LOG_PATH`           | 日志目录                  |
| `XXL_JOB_LOG_RETENTION_DAYS` | 日志保留天数              |

### 11.4 第三方配置

合众接口：

```text
TP_BASE_URL
TP_LOGIN_USERNAME
TP_LOGIN_KEY
TP_TIMEOUT_MS
TP_TOKEN_REFRESH_LEEWAY_MS
```

云码接口：

```text
TP_YMSINO_BASE_URL
TP_YMSINO_USERNAME
TP_YMSINO_PASSWORD
TP_YMSINO_ORG_ID
TP_YMSINO_PT_ID
TP_YMSINO_ELECTRIC_TJ_TYPE
TP_YMSINO_WATER_TJ_TYPE
TP_YMSINO_TIMEOUT_MS
TP_YMSINO_REFRESH_LEEWAY_MS
```

这些配置现在有默认值，但生产环境不应依赖代码中的默认账号密码，应由部署环境注入。

### 11.5 配置加载顺序

Spring Boot 会先加载 `application.yml`，再根据 active profile 叠加：

```text
application-local.yml
application-prod.yml
```

如果通过命令：

```bash
java -jar app.jar --spring.profiles.active=prod
```

则 `application-prod.yml` 会覆盖主配置中同路径的值。

环境变量 `${VAR:default}` 会在加载配置时解析：

```yaml
access-token-expires-in: ${ACCESS_TOKEN_EXPIRES_IN:30m}
```

意思是：

- 有 `ACCESS_TOKEN_EXPIRES_IN` 时用环境变量。
- 没有时用 `30m`。

### 11.6 配置阅读顺序

1. `src/main/resources/application.yml`
2. `src/main/resources/application-local.yml`
3. `src/main/resources/application-prod.yml`
4. `config/AppProperties.java`
5. `tenant/TenantDataSourceProperties.java`
6. `config/DataSourceConfig.java`
7. `job/XxlJobConfig.java`
8. `messaging/rabbit/RabbitMqConfig.java`

### 11.7 下一步

下一节分析代码协作规范：DTO/VO/Entity/Mapper/Service/Controller 在这个项目里如何协作，以及迁移期为什么大量使用 record 和 Map。

## 12. 代码协作规范

### 12.1 先看结论

这个项目不是严格的传统 Java 四层模型：

```text
Controller -> Service -> Mapper -> Entity
```

它当前更常见的真实链路是：

```text
Controller -> Service -> Repository -> JdbcTemplate -> Map/record
```

少量标准 CRUD 场景使用 MyBatis-Plus：

```text
Controller -> Service -> Mapper -> Entity -> Response record
```

为什么这样设计：

- 这是迁移型后端，很多接口要兼容旧 Nitro/Prisma 的字段名、返回结构、错误文案和分页结构。
- 项目是多租户库架构，业务数据很多不在默认数据源里，而是通过当前 token 解析出的租户库动态获取 `JdbcTemplate`。
- 旧库字段存在漂移，很多 Repository 会先查 `information_schema.columns`，再决定字段是否参与 SQL。
- 大量接口返回 `Map<String, Object>` 是为了保持旧前端协议稳定，避免迁移一个接口就牵动前端和所有调用方。
- 新增稳定接口时，可以优先使用强类型 `Response record`，但迁移旧接口时不要强行改返回结构。

### 12.2 当前代码类型分布

当前 Java 代码里，分层文件大致分布如下：

| 类型         | 当前数量 | 说明                                             |
| ------------ | -------: | ------------------------------------------------ |
| `Controller` |       47 | HTTP 路由入口，保持旧 `/api` 协议                |
| `Service`    |       87 | 业务编排、权限范围、事务、缓存、异步触发         |
| `Repository` |       31 | JdbcTemplate SQL、字段兼容、数据映射             |
| `Request`    |      105 | 写接口入参，很多用 Java `record`                 |
| `Query`      |       34 | 列表筛选参数，通常只在 Service/Repository 内流转 |
| `Response`   |        6 | 少量稳定响应模型                                 |
| `Entity`     |        1 | 当前主要是 MyBatis-Plus 示例                     |
| `Mapper`     |        2 | MyBatis-Plus 或复杂映射组件                      |

这个分布说明：项目当前处于迁移和兼容阶段，重点不是堆 Entity，而是让旧接口可靠迁移到 Java。

### 12.3 Controller 如何写

Controller 的职责：

- 定义 HTTP 路径和方法。
- 接收 `@RequestParam`、`@PathVariable`、`@RequestBody`。
- 调用 Service。
- 用 `ApiResponse.ok(...)` 包装返回。
- 不写 SQL，不做复杂业务，不直接访问 Redis 或数据库。

典型代码：

```java
@GetMapping("/rental/tenant/{id}")
public ApiResponse<Map<String, Object>> tenantDetail(@PathVariable int id) {
  return ApiResponse.ok(rentalTenantService.getTenantDetail(id));
}
```

为什么这样设计：

- Controller 越薄，接口路径和业务逻辑越容易分开维护。
- 旧前端依赖路径稳定，所以 Controller 最重要的是保持协议兼容。
- 企业项目里 Controller 经常被前端、测试、接口文档同时引用，过多业务逻辑会让维护成本上升。

最值得阅读：

- `auth/AuthController.java`
- `rental/tenant/RentalTenantController.java`
- `system/version/VersionController.java`

### 12.4 Service 如何写

Service 的职责：

- 获取当前登录用户和租户上下文。
- 判断参数是否合法。
- 计算当前用户能访问哪些园区。
- 开启事务。
- 调用 Repository。
- 触发缓存失效、消息 outbox、通知或任务。
- 组合多个 Repository 的结果。

典型代码结构：

```java
@Service
@Transactional(readOnly = true)
public class RentalTenantService {

  public Map<String, Object> getTenantDetail(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "tenantId错误");
    }
    RentalContext context = rentalContext();
    return rentalTenantRepository.findTenantDetail(
        context.jdbcTemplate(), id, context.authorizedParkIds());
  }
}
```

为什么这样设计：

- Service 是业务边界，应该决定“允许谁做什么”，Repository 只负责“怎么查、怎么写”。
- 多租户项目里，Service 必须先拿到当前租户库连接，避免 Repository 自己猜数据源。
- 事务标在 Service 层，方便把多个 Repository 操作放进同一个业务事务。

设计模式：

- Service Layer：业务编排集中在 Service。
- Facade：Controller 面向一个 Service 方法，不暴露内部多个 Repository。
- Transaction Script：迁移期很多接口按旧业务流程逐步翻译成一个明确的业务脚本。

最值得阅读：

- `auth/AuthService.java`
- `rental/tenant/RentalTenantService.java`
- `organization/OrganizationService.java`
- `job/MigrationJobService.java`

### 12.5 Repository 如何写

Repository 的职责：

- 写 SQL。
- 调用 `JdbcTemplate`。
- 做 ResultSet 到 `Map` 或对象的映射。
- 处理字段兼容。
- 处理分页 SQL。
- 不读取登录态，不直接决定用户是谁。

典型设计：

```text
Service 传入 JdbcTemplate 和 authorizedParkIds
Repository 拼 SQL
Repository 查询数据库
Repository 映射成旧接口需要的字段
```

为什么 Repository 方法经常接收 `JdbcTemplate`：

- 租户库不是固定数据源。
- 不同客户可能对应不同库。
- 当前请求使用哪个库，要由 `TenantContext` 和 `TenantJdbcTemplateProvider` 决定。
- Repository 接收 `JdbcTemplate` 可以明确数据来源，减少误用默认数据源的风险。

为什么很多 Repository 检查字段：

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = ?
```

企业项目迁移时，不同环境的表结构可能不完全一致。字段检查让接口在灰度期间更稳，但代价是 Repository 代码更长。

设计模式：

- Repository Pattern：封装数据访问。
- Adapter：把真实数据库字段适配成旧前端需要的字段。
- Defensive Programming：字段缺失时返回空页或业务错误，避免接口直接 500。

最值得阅读：

- `auth/AuthRepository.java`
- `rental/tenant/RentalTenantRepository.java`
- `menu/MenuRepository.java`
- `organization/OrganizationRepository.java`

### 12.6 Request、Query、Response 如何协作

本项目的命名约定：

| 类型 | 用途 | 示例 |
| --- | --- | --- |
| `Request` | 写接口入参，包括新增、修改、审核、操作命令 | `RentalTenantCreateRequest` |
| `Query` | 列表查询条件，通常包含分页和筛选字段 | `RentalTenantListQuery` |
| `Response` | 稳定的强类型返回对象 | `LoginResponse`、`UserInfoResponse` |
| `Map<String, Object>` | 迁移旧接口时保持字段兼容 | 租赁、工资、账单等大量接口 |
| `Entity` | 数据库表模型，当前只在 MyBatis-Plus 场景少量使用 | `AppVersionEntity` |
| `Mapper` | MyBatis-Plus 数据访问接口或专用映射器 | `AppVersionMapper` |

Request 和 Query 多使用 Java `record`：

```java
public record RentalTenantListQuery(
    Integer currentPage,
    Integer currentPark,
    String address,
    Integer pageSize,
    Integer parkId,
    String tenantName) {}
```

为什么用 `record`：

- 入参对象通常只需要承载数据，不需要 setter。
- 字段不可变，减少 Service/Repository 中被意外修改。
- 代码短，适合迁移期大量接口参数对象。

什么时候用强类型 `Response`：

- 登录、用户信息、菜单、版本号这类协议稳定、调用方重要的接口。
- 新开发、不是为了兼容旧 Nitro 的接口。
- 需要长期维护字段含义，避免 `Map` 泛化导致误用。

什么时候可以继续用 `Map<String, Object>`：

- 旧接口已经被前端大量使用。
- 字段名和结构需要一比一兼容旧实现。
- 返回字段跟数据库字段强绑定，且迁移阶段还会变化。

### 12.7 Entity 和 Mapper 该怎么看

当前 MyBatis-Plus 的典型样例是版本接口：

```text
system/version/VersionController.java
system/version/VersionService.java
system/version/entity/AppVersionEntity.java
system/version/mapper/AppVersionMapper.java
```

调用链：

```mermaid
sequenceDiagram
  participant C as VersionController
  participant S as VersionService
  participant M as AppVersionMapper
  participant DB as Database

  C->>S: getLatestVersion()
  S->>M: selectOne(orderByDesc createdAt limit 1)
  M->>DB: SELECT app_versions
  DB-->>M: AppVersionEntity
  M-->>S: Entity
  S-->>C: AppVersion response
```

为什么这里只适合用 MyBatis-Plus：

- 表结构简单。
- 查询条件简单。
- 响应结构稳定。
- 不涉及复杂多租户业务权限和旧字段兼容。

注意：不要看到 MyBatis-Plus 就把所有 Repository 改成 Mapper。租户库动态连接、旧字段兼容、复杂 SQL 拼接，是当前很多模块继续用 `JdbcTemplate` 的主要原因。

### 12.8 一个典型业务接口的协作图

以租户详情接口为例：

```mermaid
flowchart TD
  A[GET /api/rental/tenant/{id}] --> B[RentalTenantController]
  B --> C[RentalTenantService.getTenantDetail]
  C --> D{参数 id 是否合法}
  D -- 否 --> E[BusinessException]
  D -- 是 --> F[TenantRequired.currentUser]
  F --> G[TenantJdbcTemplateProvider.currentTenantJdbcTemplate]
  G --> H[ParkScopeService.resolveAuthorizedParkIds]
  H --> I[RentalTenantRepository.findTenantDetail]
  I --> J[查询 rental_tenant + park]
  J --> K{park_id 是否在授权范围}
  K -- 否 --> L[BusinessException 没有查看权限]
  K -- 是 --> M[appendTenantImages]
  M --> N[Map 字段适配旧接口]
  N --> O[ApiResponse.ok]
```

这条链路体现了项目的核心协作方式：

- Controller 保持接口协议。
- Service 负责登录态、租户库、园区权限、事务。
- Repository 负责 SQL、字段兼容、旧返回结构。
- `ApiResponse` 统一响应格式。
- `BusinessException` 统一业务错误。

### 12.9 新增接口时怎么选分层方式

新增接口前先判断两件事：

1. 这是迁移旧接口，还是全新接口。
2. 数据在中心库，还是租户库。

推荐决策：

| 场景              | 推荐方式                                          |
| ----------------- | ------------------------------------------------- |
| 迁移旧 Nitro 接口 | `Controller -> Service -> Repository -> Map`      |
| 多表复杂 SQL      | `JdbcTemplate + Repository`                       |
| 多租户业务表      | Service 获取租户 `JdbcTemplate` 后传给 Repository |
| 中心库简单 CRUD   | 可以考虑 MyBatis-Plus                             |
| 稳定新接口        | Request/Query/Response 全部强类型                 |
| 需要缓存          | Service 调用 `CacheService`，并明确失效时机       |
| 需要异步可靠投递  | 写 `event_outbox`，由 outbox 派发                 |

不要做的事：

- 不要在 Controller 写 SQL。
- 不要在 Repository 里读取当前登录用户。
- 不要在多租户业务里直接使用默认 `JdbcTemplate`。
- 不要为了“看起来标准”强行把兼容旧接口的 `Map` 改成 Entity。
- 不要改接口字段名，除非同步改前端和旧接口兼容层。

### 12.10 代码协作中的设计模式

| 模式 | 项目中的体现 | 企业项目价值 |
| --- | --- | --- |
| MVC | Controller 处理 HTTP，Service 处理业务，Repository 处理数据 | 分层清晰，便于协作 |
| Repository | `*Repository` 封装 SQL 和数据映射 | 隔离数据库细节 |
| DTO | `Request`、`Query`、`Response` | 避免接口参数散落 |
| Facade | Controller 只调用一个 Service 方法 | 降低调用方复杂度 |
| Adapter | Repository 把数据库字段适配成旧前端字段 | 支持平滑迁移 |
| Template Method | 组织开通 Job 拆成 preflight、step、completion 等固定阶段 | 复杂任务可恢复、可追踪 |
| Outbox Pattern | 业务写 `event_outbox`，定时任务或 MQ 派发 | 保证数据库提交和消息投递尽量一致 |
| Strategy | 通知 provider、外部集成、任务处理按服务拆分 | 后续扩展不同渠道 |

### 12.11 Step 12 必读源码

按这个顺序读：

1. `common/ApiResponse.java`
2. `common/BusinessException.java`
3. `common/PageResult.java`
4. `auth/AuthController.java`
5. `auth/AuthService.java`
6. `auth/AuthRepository.java`
7. `rental/tenant/RentalTenantController.java`
8. `rental/tenant/RentalTenantService.java`
9. `rental/tenant/RentalTenantRepository.java`
10. `system/version/VersionController.java`
11. `system/version/VersionService.java`
12. `system/version/entity/AppVersionEntity.java`
13. `system/version/mapper/AppVersionMapper.java`

读完这组代码后，基本就能理解本项目两套主流写法：迁移兼容型写法和标准 CRUD 型写法。

## 13. 常见开发位置

### 13.1 按需求类型找代码

| 需求 | 优先看哪里 |
| --- | --- |
| 登录、登出、刷新 token、短信登录 | `auth/`、`security/` |
| 当前用户信息 | `user/` |
| 菜单、权限码 | `menu/`、`permission/`、`system/menu/` |
| 用户、角色、部门 | `system/user/`、`system/role/`、`system/dept/` |
| 园区 | `park/` |
| 厂房、租赁管理 | `factory/`、`rental/tenant/` |
| 账单、财务 | `bill/`、`finance/` |
| HRM | `hrm/` |
| 报销 | `reimbursement/` |
| 门禁 | `access/` |
| 维修保养 | `maintenance/` |
| 组织开通 | `organization/`、`job/` |
| Kafka、RabbitMQ、Outbox | `messaging/` |
| XXL-Job | `job/` |
| Redis 缓存 | `cache/`、`auth/SmsCodeService.java` |
| 文件上传、图片 | `image/` |
| 微信、企微、合众、云码 | `integration/` |
| LLM | `llm/` |
| 配置 | `config/`、`src/main/resources/application*.yml` |

### 13.2 改接口时的固定检查清单

1. 找 Controller 路径，确认前端请求路径是否已经加 `/api`。
2. 看 Service 是否需要登录用户、租户库、园区范围。
3. 判断数据在中心库还是租户库。
4. 如果是租户库，优先用 `TenantJdbcTemplateProvider.currentTenantJdbcTemplate()`。
5. 如果有分页，用 `PageRequestParams` 和 `PageResult`。
6. 如果会影响菜单、权限或用户信息，检查 `CacheService` 缓存是否要清。
7. 如果会触发异步动作，优先考虑 outbox，而不是在 HTTP 请求里直接做长耗时操作。
8. 如果返回旧接口，保持字段名、空值策略、错误文案尽量兼容。

## 14. 新人开发路线

### 14.1 第一阶段：跑起来并理解边界

先读：

1. `pom.xml`
2. `src/main/resources/application.yml`
3. `BackendSpringbootApplication.java`
4. `config/DataSourceConfig.java`
5. `tenant/TenantDataSourceRegistry.java`
6. `security/AuthFilter.java`

目标：

- 知道项目怎么启动。
- 知道 `/api` 是全局 context path。
- 知道中心库和租户库的区别。
- 知道 token 如何进入 `TenantContext`。

### 14.2 第二阶段：读懂登录和权限

先读：

1. `auth/AuthController.java`
2. `auth/AuthService.java`
3. `security/JwtService.java`
4. `security/AuthFilter.java`
5. `tenant/TenantRequired.java`
6. `permission/PermissionService.java`
7. `menu/MenuService.java`

目标：

- 理解登录后 JWT 里有什么。
- 理解 refresh token 为什么入中心库。
- 理解菜单和权限码主要服务前端。
- 理解后端接口的主要强制边界是登录态、租户和园区范围。

### 14.3 第三阶段：读懂一个完整业务模块

建议选 `rental/tenant`：

1. 先看 Controller 路由。
2. 再看 Service 如何获取租户库和园区权限。
3. 再看 Repository 如何拼 SQL。
4. 最后看 Request/Query 字段为什么保持旧接口命名。

这个模块覆盖了列表、详情、新增、修改、删除、分页、图片关系、园区权限，是迁移型业务模块的典型样本。

### 14.4 第四阶段：读异步和任务

先读：

1. `messaging/OutboxService.java`
2. `messaging/OutboxRepository.java`
3. `messaging/KafkaOutboxDispatcher.java`
4. `messaging/rabbit/RabbitMqConfig.java`
5. `job/BackendMigrationJobHandlers.java`
6. `job/MigrationJobService.java`

目标：

- 理解为什么消息不直接在业务里发。
- 理解 outbox 如何保证可靠性。
- 理解组织开通为什么要拆成任务步骤。

## 15. Debug 路线

### 15.1 登录失败

按顺序查：

1. 请求是否是 `POST /api/auth/login`。
2. `application.yml` 的 `server.servlet.context-path` 是否为 `/api`。
3. `AuthController.login` 是否进入。
4. `AuthService.login` 查询中心库用户是否成功。
5. 用户的 `customerId` 是否能找到租户数据库配置。
6. 租户库用户表是否存在对应账号。
7. 密码校验是否通过。
8. `JwtService` 生成 token 是否正常。
9. refresh token 是否写入中心库。

### 15.2 请求返回未登录或无权限

按顺序查：

1. 请求头是否带 `Authorization: Bearer <token>`。
2. `AuthFilter` 是否跳过了该路径。
3. `JwtService` 是否能解析 token。
4. `TenantContext` 是否写入当前请求。
5. Service 是否调用 `TenantRequired.currentUser()`。
6. 园区权限是否由 `ParkScopeService` 正确解析。
7. SQL 是否按 `park_id` 过滤。

### 15.3 查不到业务数据

先判断：

- 当前接口查中心库还是租户库。
- token 里的 `customerId` 是否对应正确客户。
- 当前用户是否有对应园区权限。
- Repository 是否因为字段缺失返回空页。
- SQL 是否带了 `is_deleted = false`。

建议断点：

1. Controller 方法入口。
2. Service 里获取 `JdbcTemplate` 的位置。
3. `ParkScopeService.resolveAuthorizedParkIds`。
4. Repository 拼完 where 条件的位置。
5. RowMapper 映射返回字段的位置。

### 15.4 Redis 缓存异常

按顺序查：

1. Redis 是否能连接。
2. key 是否包含正确 `customerId`。
3. tokenVersion 是否变化。
4. 修改菜单、角色、用户后是否调用了缓存清理。
5. 短信验证码是否过期，是否超过最大验证次数。

重点 key：

```text
tenant:{customerId}:menus:{tokenVersion}
tenant:{customerId}:permissions:{tokenVersion}
tenant:{customerId}:user-info:{userId}:{tokenVersion}
magic:sms-code:{phoneNumber}
```

### 15.5 MQ 或任务没有执行

Kafka 先查：

1. `KAFKA_OUTBOX_EVENT_WRITE_ENABLED`
2. `KAFKA_OUTBOX_DISPATCH_ENABLED`
3. `KAFKA_CONSUMER_ENABLED`
4. `event_outbox` 是否有 `pending` 或 `failed` 记录。
5. `event_consume_log` 是否已有消费记录。

RabbitMQ 先查：

1. `RABBITMQ_CONSUMER_ENABLED`
2. `RABBITMQ_NOTIFICATION_PUBLISH_ENABLED`
3. retry 和 DLQ 队列是否有积压。

XXL-Job 先查：

1. `XXL_JOB_ENABLED`
2. executor 是否注册到 Admin。
3. handler 名称是否和 Admin 配置一致。
4. 组织开通任务表中的步骤状态和 heartbeat。

## 16. 阅读源码顺序

### 16.1 最短路径

如果只想最快读懂项目，按这个顺序：

1. `src/main/resources/application.yml`
2. `BackendSpringbootApplication.java`
3. `config/DataSourceConfig.java`
4. `tenant/TenantDataSourceRegistry.java`
5. `security/AuthFilter.java`
6. `auth/AuthController.java`
7. `auth/AuthService.java`
8. `auth/AuthRepository.java`
9. `cache/CacheService.java`
10. `menu/MenuService.java`
11. `rental/tenant/RentalTenantController.java`
12. `rental/tenant/RentalTenantService.java`
13. `rental/tenant/RentalTenantRepository.java`
14. `messaging/OutboxService.java`
15. `job/MigrationJobService.java`

### 16.2 深入路径

读完最短路径后，再按专题补：

- 数据库：`schema.sql`、`apps/backend-mock/prisma/schema`
- Redis：`cache/CacheService.java`、`auth/SmsCodeService.java`
- 登录权限：`security/`、`auth/`、`permission/`、`menu/`
- MQ：`messaging/`、`messaging/rabbit/`
- 定时任务：`job/`
- 外部集成：`integration/`
- 组织开通：`organization/`、`job/OrganizationProvisioning*`

## 17. 注意事项

### 17.1 开发注意事项

- 不要把中心库和租户库混用。中心库保存全局身份和任务，租户库保存业务数据。
- 不要绕过 `TenantRequired.currentUser()` 读取租户业务数据。
- 不要在 HTTP 请求里执行长耗时组织开通、批量通知、消息重试，应交给任务或 MQ。
- 不要随意改变旧接口返回字段，前端可能依赖字段名和空值策略。
- 不要默认所有权限都在 Spring Security 注解里，本项目当前主要是过滤器、租户上下文和园区数据范围。
- 修改菜单、角色、用户、权限后，要考虑 Redis 菜单、权限码、用户信息缓存。
- 涉及财务、账单、工资、合同的接口，要额外关注删除方式是软删还是物理删除。
- 涉及 MQ 的业务要考虑幂等，优先看 `event_consume_log`。
- 涉及组织开通的代码要关注可恢复、可重试和 heartbeat。

### 17.2 为什么企业项目会这样设计

这个项目不是为了追求代码样式统一而重写一切，而是为了在真实业务运行中逐步替换旧后端。企业系统迁移最重要的是三件事：

1. 对前端和用户保持接口稳定。
2. 对数据保持安全边界。
3. 对高副作用能力保持可回滚、可灰度、可观测。

因此你会看到：

- 大量 `Map` 是为了兼容旧响应。
- 大量环境变量开关是为了灰度发布。
- 多租户 `JdbcTemplate` 是为了隔离客户数据。
- outbox 是为了避免数据库提交成功但消息丢失。
- XXL-Job 是为了让长任务脱离 HTTP 生命周期。
- Redis key 带 `customerId` 和 `tokenVersion` 是为了隔离租户并支持权限刷新。

### 17.3 后续维护建议

- 新接口优先使用强类型 Request/Query/Response。
- 旧接口迁移时优先保持兼容，等前端和调用方稳定后再考虑收敛模型。
- Repository 内重复 SQL helper 可以逐步抽取，但不要在迁移未稳定时做大范围重构。
- 对组织开通、消息通知、账单财务这类高风险模块，先补测试或手动验收清单，再做行为修改。
- 文档每次补充业务模块时，至少记录接口入口、核心表、缓存 key、异步副作用和 Debug 断点。
