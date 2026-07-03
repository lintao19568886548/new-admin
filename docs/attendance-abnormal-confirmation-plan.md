# 考勤异常确认去重开发方案

## 1. 背景

当前员工在考勤打卡时，如果出现以下异常：

- 不在指定打卡范围内
- 当前设备与已绑定考勤设备不一致
- 当前设备被多个账号使用

系统会在打卡前弹窗提醒，用户确认后允许继续打卡。

用户反馈的问题是：上班时已经确认过异常，下班重新登录或重新进入页面继续打卡时，系统又提醒一次。用户认为自己并没有再次换手机或换地点，重复提醒体验较差。

## 2. 当前原因

### 2.1 地点异常

前端文件：

- `playground/src/views/hrm/attendance/check-in.vue`

当前逻辑：

- 每次点击上班/下班打卡都会执行 `ensurePunchLocation()`
- 如果 `isInRange === false`，就弹出“非指定区域”确认框
- 用户确认后，只在本次请求里带上 `confirmOutsideRange: true`
- 这个确认结果没有写入后端，也没有本地持久化

结果：

- 用户重新登录、刷新页面、再次点击下班打卡时，前端不知道之前已经确认过
- 所以同一天同一地点会重复提醒

### 2.2 设备异常

前端文件：

- `playground/src/views/hrm/attendance/check-in.vue`
- `playground/src/api/hrm/attendance.ts`

后端文件：

- `apps/backend-mock/api/hrm/attendance/device.ts`
- `apps/backend-mock/utils/attendance-device.ts`
- `apps/backend-mock/api/hrm/attendance/index.post.ts`
- `apps/backend-mock/api/hrm/attendance/[id].put.ts`

当前逻辑：

- 每次点击打卡前，前端调用 `getAttendanceDeviceStatus()`
- 后端根据当前设备 ID、账号绑定设备、重复绑定账号判断设备状态
- 如果当前设备与绑定设备不一致，返回 `status: 'abnormal'`
- 用户点“继续打卡”后，只在本次请求里带上 `confirmDeviceAbnormal: true`
- 后端只把异常写入 `attendance_device_abnormal_log`，没有记录“用户今天已确认过该异常”

结果：

- 只要绑定设备和当前设备仍不一致，后端每次都会返回异常
- 重新登录或下班打卡时仍会再次提醒

## 3. 目标

实现“同一天、同一用户、同一异常场景，只提醒一次”。

具体目标：

- 上班打卡已确认过设备异常，下班打卡不再重复弹设备异常提醒
- 上班打卡已确认过地点异常，下班打卡如果仍在同一异常地点附近，不再重复弹地点异常提醒
- 重新登录、刷新页面、重新进入打卡页后，确认状态仍然有效
- 异常打卡记录仍然要保留，后台仍可审计
- 如果异常场景发生变化，需要重新提醒

## 4. 非目标

本次方案不处理以下内容：

- 不改变考勤设备绑定规则
- 不自动把异常设备设为正常设备
- 不自动扩大考勤打卡范围
- 不取消异常日志记录
- 不改请假、迟到、早退计算逻辑

## 5. 推荐方案

采用后端持久化确认记录，而不是只用前端 `localStorage`。

原因：

- 用户重新登录后仍然要生效
- App WebView 存储丢失后仍然要生效
- 后台需要可审计
- 后续可扩展为管理员查看异常确认记录

## 6. 数据设计

新增考勤异常确认表，建议命名：

```text
attendance_abnormal_confirmation
```

建议字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | BigInt | 主键 |
| user_id | Int | 用户 ID |
| confirmation_date | Date | 确认日期，按打卡日期归属 |
| abnormal_category | String | 异常分类：`device` / `location` |
| abnormal_type | String | 异常类型：`device_changed` / `same_device_multi_account` / `outside_range` |
| fingerprint | String | 异常指纹，用于判断是否同一异常场景 |
| action_scope | String | 生效范围，默认 `day` |
| confirmed_at | DateTime | 确认时间 |
| expire_at | DateTime | 过期时间，通常为当天 23:59:59 |
| attendance_id | Int? | 关联打卡记录，可为空 |
| current_device_id | String? | 当前设备 ID |
| bound_device_id | String? | 已绑定设备 ID |
| latitude | Decimal? | 确认时纬度 |
| longitude | Decimal? | 确认时经度 |
| nearest_location_name | String? | 最近考勤点名称 |
| distance_meters | Decimal? | 距离最近考勤点距离 |
| create_time | DateTime | 创建时间 |
| update_time | DateTime | 更新时间 |

建议唯一索引：

```text
user_id + confirmation_date + abnormal_category + abnormal_type + fingerprint
```

说明：

- 项目 Prisma 当前不走 migrate，开发完成后由用户手动执行 `db push`
- schema 应新增到 `apps/backend-mock/prisma/schema` 下对应考勤相关 schema 文件

## 7. 异常指纹规则

### 7.1 设备异常指纹

设备异常需要区分不同设备场景。

建议指纹：

```text
device:{abnormalType}:{boundDeviceId}:{currentDeviceId}
```

示例：

```text
device:device_changed:old-device-id:new-device-id
device:same_device_multi_account::current-device-id
```

规则：

- 同一天同一个设备异常指纹只提醒一次
- 如果当前设备 ID 变了，需要重新提醒
- 如果绑定设备变了，需要重新提醒
- 如果异常类型从 `device_changed` 变成 `device_changed + same_device_multi_account`，新增异常类型需要提醒

### 7.2 地点异常指纹

地点异常需要避免 GPS 小范围漂移导致重复提醒。

建议指纹：

```text
location:outside_range:{nearestLocationName}:{gridLat}:{gridLng}
```

经纬度建议做网格化：

- 以 300 米左右为一个容忍范围
- 或使用经纬度保留 3 位小数作为近似区域

规则：

- 同一天同一异常区域只提醒一次
- 如果用户去了明显不同的异常地点，需要重新提醒
- 如果从异常区域回到正常范围，不需要提醒

## 8. 后端改造

### 8.1 新增工具方法

建议新增工具文件：

```text
apps/backend-mock/utils/attendance-abnormal-confirmation.ts
```

提供方法：

```ts
findActiveAttendanceAbnormalConfirmation(params);
createAttendanceAbnormalConfirmation(params);
buildDeviceAbnormalFingerprints(decision);
buildLocationAbnormalFingerprint(validation, latitude, longitude);
```

### 8.2 设备状态接口增加确认态

接口：

```text
POST /api/hrm/attendance/device
```

当前返回 `AttendanceDeviceDecision`。

建议增加字段：

```ts
confirmedToday?: boolean;
unconfirmedAbnormalTypes?: string[];
confirmationKeys?: string[];
```

处理逻辑：

- 后端仍然判断设备是否异常
- 如果异常，但当天相同指纹已确认，则返回 `confirmedToday: true`
- 前端看到 `confirmedToday: true` 时不弹窗

### 8.3 打卡接口保存确认记录

接口：

```text
POST /api/hrm/attendance
PUT /api/hrm/attendance/:id
```

请求字段：

```ts
confirmDeviceAbnormal?: boolean;
confirmOutsideRange?: boolean;
```

处理逻辑：

- 后端不再信任 `allowDeviceAbnormal` / `allowOutsideRange` 这类仅表示“允许继续”的字段
- 异常放行只接受两种情况：本次请求明确带 `confirm...: true`，或后端查询到当天同一异常指纹已确认
- 用户第一次确认设备异常并打卡成功后，写入设备异常确认记录
- 用户第一次确认地点异常并打卡成功后，写入地点异常确认记录
- 如果打卡失败，不建议写确认记录，避免用户没有实际完成打卡却被视为已确认

### 8.4 保留异常日志

`attendance_device_abnormal_log` 继续写入。

原因：

- 确认记录用于减少重复提醒
- 异常日志用于审计每一次异常打卡

二者职责不同，不建议合并。

## 9. 前端改造

文件：

```text
playground/src/views/hrm/attendance/check-in.vue
playground/src/api/hrm/attendance.ts
```

### 9.1 地点异常

当前：

```ts
if (!isInRange.value) {
  const ok = await confirmOutsideRange();
  if (!ok) return false;
}
```

建议改为：

- 定位后先请求/判断当天该异常地点是否已确认
- 已确认：不再弹窗，打卡请求不需要再带 `confirmOutsideRange`
- 未确认：弹窗；用户确认并打卡成功后，后端记录确认

### 9.2 设备异常

当前：

- `resolveDevicePunchOptions()` 每次都调用 `getAttendanceDeviceStatus()`
- 只要 `decision.status === 'abnormal'` 就弹窗

建议改为：

- 如果 `decision.status === 'normal'`，正常打卡
- 如果 `decision.status === 'bind_required'`，仍然弹绑定确认
- 如果 `decision.status === 'abnormal' && decision.confirmedToday === true`，不弹窗，直接允许本次异常打卡
- 如果 `decision.status === 'abnormal' && decision.confirmedToday !== true`，弹窗确认

## 10. 交互规则

### 10.1 第一次异常打卡

用户点击打卡：

1. 系统检测到地点或设备异常
2. 弹窗说明异常原因
3. 用户确认继续打卡
4. 打卡成功
5. 后端保存当天异常确认记录
6. 后端保存异常打卡审计日志

### 10.2 当天下班再次打卡

用户点击下班打卡：

1. 系统再次检测到同一异常
2. 后端发现当天已确认
3. 前端不再弹重复确认
4. 继续打卡
5. 后端仍保存本次异常打卡审计日志

### 10.3 异常发生变化

示例：

- 上班确认的是设备 A
- 下班变成设备 B

处理：

- 指纹变化
- 需要重新提醒

## 11. 验收用例

### 11.1 地点异常去重

前置条件：

- 用户在考勤范围外

步骤：

1. 上班打卡
2. 弹出地点异常提醒
3. 用户确认并打卡成功
4. 退出登录或刷新页面
5. 下班打卡

预期：

- 下班打卡不再重复弹同一地点异常提醒
- 下班打卡成功
- 后台仍能看到下班是异常地点打卡

### 11.2 设备异常去重

前置条件：

- 用户账号已绑定设备 A
- 当前使用设备 B

步骤：

1. 上班打卡
2. 弹出设备异常提醒
3. 用户确认继续打卡
4. 打卡成功
5. 退出登录或刷新页面
6. 使用同一设备 B 下班打卡

预期：

- 下班打卡不再重复弹同一设备异常提醒
- 下班打卡成功
- 后台仍能看到上下班均为设备异常打卡

### 11.3 设备变化后重新提醒

前置条件：

- 上班已确认设备 B 异常

步骤：

1. 下班改用设备 C
2. 点击下班打卡

预期：

- 系统重新弹设备异常提醒
- 用户确认后才允许继续打卡

### 11.4 地点明显变化后重新提醒

前置条件：

- 上班已确认地点 X 异常

步骤：

1. 下班移动到明显不同的地点 Y
2. 点击下班打卡

预期：

- 系统重新弹地点异常提醒
- 用户确认后才允许继续打卡

### 11.5 正常范围不提醒

前置条件：

- 用户在考勤范围内

步骤：

1. 点击打卡

预期：

- 不弹地点异常提醒

## 12. 开发顺序

建议按以下顺序开发：

1. 新增 Prisma schema：`attendance_abnormal_confirmation`
2. 新增后端工具方法：确认记录查询、创建、指纹生成
3. 改造设备状态接口，返回当天确认态
4. 改造上班/下班打卡接口，打卡成功后保存确认记录
5. 改造前端 API 类型
6. 改造前端打卡页，已确认异常不再重复弹窗
7. 补充手动验收用例
8. 执行 ESLint 和类型检查
9. 由用户手动执行 Prisma `db push`

## 13. 风险点

- 地点指纹不能太精细，否则 GPS 漂移会导致重复提醒
- 地点指纹不能太粗，否则用户换到较远异常地点也不提醒
- 设备异常去重不能跳过新设备场景
- 确认记录只能减少提醒，不能影响异常审计
- 打卡失败时不要保存确认记录，否则用户未完成打卡也会被视为已确认

## 14. 推荐结论

建议做后端持久化确认记录。

最终体验：

- 第一次异常：提醒并要求确认
- 当天同一异常：不重复提醒
- 当天新异常：继续提醒
- 后台审计：完整保留每一次异常打卡
