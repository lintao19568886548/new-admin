# ymsino 设备联调说明

本文档只描述当前项目代码侧的 ymsino 适配边界，不涉及数据库结构变更。

## 修复后仍未闭环的项

桌面资料 `ymsino-sdk`、`ymsino-test.js`、`亿玛API测试.html` 以及 `亿玛系统对外接口(RM-http)20260514(1).pdf` 对应的是 ymsino RM-http 接口。当前资料能确认的接口只有：

- `/GetToken`
- `/GetPlt`
- `/GetInfo`
- `/GetTranDay`
- `/CzDevSy`
- `/CzCusSy`
- `/CzDev`
- `/CzCus`
- `/OnOff`

所以本次代码能修复的是“把已提供的 RM-http 接口接入、标准化、校验、诊断出来”。下面这些仍未修复，原因是当前 ymsino 文档没有提供对应接口或设备侧能力：

- 物理采集协议确认：电表协议已按现场确认标记为 M-Bus；水表 NB/LoRa/M-Bus 等协议说明仍需厂商或嵌入式提供。
- 小时冻结/月冻结：当前只看到 `/GetTranDay` 日冻结，没有小时/月冻结接口。
- 离线缓存补传：缺少网关/采集器离线缓存和补传 topic/API。
- 设备真实在线/离线：缺少在线状态接口或上报 topic。
- 状态和告警：缺少电表异常、水表阀控异常等接口。
- 完整命令闭环：充值、拉闸、合闸当前只能确认厂商接口同步返回，不能证明设备已收到和已执行；缺少命令结果回调/查询接口。

门禁不再列为 ymsino 未完成项：当前确认 ymsino 不生产门禁设备，本项目 ymsino 适配范围只覆盖电表和水表。

`GET /api/ymsino/diagnostics` 已按这 6 类问题返回 `acceptanceChecklist`，可以直接用于联调验收。

## 当前已接入

- 平台鉴权：`/GetToken`，由 `utils/thirdparty/ymsino-token-manager.ts` 管理 token。
- 小区/平台：`/GetPlt`。
- 电表设备：`/GetInfo`，`TjType=0`。
- 水表设备：`/GetInfo`，`TjType=1`。
- 日冻结数据：`/GetTranDay`，按 `TyDate` 查询。
- 设备充值：`/CzDev`，后端路由 `POST /api/ymsino/meterinfo/device-recharge`。
- 用户/房间充值：`/CzCus`，后端路由 `POST /api/ymsino/meterinfo/customer-recharge`。
- 拉合闸：`/OnOff`，后端路由 `POST /api/ymsino/meterinfo/on-off`。
- 联调诊断：`GET /api/ymsino/diagnostics`。
- 冻结能力说明：`GET /api/ymsino/meterinfo/freeze-capability`。
- 设备在线状态能力说明：`GET /api/ymsino/meterinfo/status`。
- 设备告警能力说明：`GET /api/ymsino/meterinfo/alarms`。
- 水表物理协议能力说明：`GET /api/ymsino/waterinfo/protocol`。
- 电表编号核验：`GET /api/ymsino/meterinfo/device-diagnostic?factoryNo=实际电表编号`。
- 已知水表编号核验：`GET /api/ymsino/waterinfo/device-diagnostic?factoryNo=00000260507851`。
- 设备编号映射要求：`GET /api/ymsino/mapping-requirements`。
- 门禁相关路由保留兼容：`POST /api/ymsino/access/open-door`、`GET /api/ymsino/access/status`、`GET /api/ymsino/access/records` 均返回 `not-applicable`，表示不属于 ymsino 电/水表集成范围。

## 六项验收状态

| 验收项 | 当前状态 | 说明 |
| --- | --- | --- |
| 设备真实接入 | 部分完成 | `/GetInfo` 能返回电表/水表 `FactoryNo`、`DeviceId`、`RmId`；但缺少网关/采集器编号、楼栋/租户绑定字段。 |
| 采集协议实现 | 部分完成 | 电表协议已标记为 M-Bus，代码通过 ymsino RM-http 平台读取数据；水表物理协议仍需厂商或嵌入式提供。 |
| 数据上报 | 部分完成 | `/GetTranDay` 能查日冻结，字段包含读数、时间、倍率、尖峰平谷；小时/月冻结、离线缓存补传、真实设备状态未提供。 |
| 命令下发闭环 | 部分完成 | `/CzDev`、`/CzCus`、`/OnOff` 已接入；返回只代表厂商平台同步响应，不代表设备确认收到和执行完成。 |
| 状态和告警 | 未闭环 | 当前文档没有在线/离线、电表异常、水表阀控异常接口。 |
| 联调文档和样例数据 | 部分完成 | 已整理本项目联调文档和 diagnostics；仍需厂商补 MQTT topic/回调、错误码、小时/月/离线样例报文。 |

## 已标准化的样例报文

设备列表标准化：

```json
{
  "comAddress": "ELECTRIC-MBUS-001",
  "deviceId": "",
  "factoryNo": "ELECTRIC-MBUS-001",
  "parkId": "YZWL",
  "parkName": "YZWL",
  "roomId": "CS1001",
  "roomName": "CS1001",
  "protocol": "M-Bus",
  "currentRatio": "Pt:1 Ct:1",
  "multiplier": 1,
  "source": "ymsino",
  "status": "reported-reading-only"
}
```

日冻结标准化：

```json
{
  "comAddress": "00000260507851",
  "deviceId": "",
  "factoryNo": "00000260507851",
  "roomId": "CS1001",
  "roomName": "CS1001",
  "freezeTime": "2026-07-03",
  "writeTime": "2026-07-03",
  "dataValue": "0.00",
  "dataValue1": "0.00",
  "dataValue2": "0.00",
  "dataValue3": "0.00",
  "dataValue4": "0.00",
  "currentRatio": "Pt:1 Ct:1",
  "multiplier": 1,
  "deviceStatus": "reported-reading-only",
  "source": "ymsino"
}
```

命令返回标准化：

```json
{
  "action": "switchOff",
  "commandSent": true,
  "commandId": "biz-command-20260704-001",
  "received": true,
  "phase": "acknowledged",
  "deviceAcknowledged": false,
  "executed": false,
  "confirmationSource": "vendor-response",
  "resultCallbackRequired": true,
  "missingClosureFields": [
    "device receipt acknowledgement",
    "device execution result",
    "final device state callback/query",
    "vendor timeout retry policy"
  ],
  "retryable": false,
  "timeoutMs": 30000
}
```

## 设备编号和绑定要求

代码侧会校验以下字段：

- `FactoryNo`：设备出厂号/通信编号，必须唯一。
- `DeviceId`：厂商平台设备编号，必须唯一。
- `RmId`：房间编号，用于把设备挂到房间。
- `RmName`：房间名称，用于页面展示。
- `PtId`：园区/小区编号，默认来自 `TP_YMSINO_PT_ID`，未配置时为 `YZWL`。

当前项目没有修改数据库，所以绑定关系不落库，只从厂商接口实时读取并标准化返回。即使 `FactoryNo` / `DeviceId` / `RmId` / `PtId` 都存在，也只能说明厂商报文具备必要标识；仍需要嵌入式/厂商侧给现场台账，确认每个园区、楼栋、房间、租户、表具是一一对应的。

当前已知的亿玛信诺水表设备编号：

- `00000260507851`

电表也提供同样的核验接口：

- `GET /api/ymsino/meterinfo/device-diagnostic?factoryNo=实际电表编号&tyDate=YYYY-MM-DD&lookbackDays=7`

如果不想每次传电表编号，可以配置 `TP_YMSINO_KNOWN_ELECTRIC_FACTORY_NOS`，多个编号用英文逗号分隔。未配置时电表诊断接口不会猜默认编号，必须通过 `factoryNo` 或 `comAddress` 传入。

代码会通过 `GET /api/ymsino/waterinfo/device-diagnostic?factoryNo=00000260507851&tyDate=YYYY-MM-DD&lookbackDays=7` 同时核验：

- 该编号是否出现在 `/GetInfo` 的水表设备列表中。
- 该编号是否出现在 `/GetTranDay` 的水表日冻结数据中，默认从 `tyDate` 往前查 7 天。
- 该编号对应的 `RmId` / `DeviceId` / `PtId` 是否具备业务映射所需字段。

这个核验仍不代表水表在线，也不代表水表协议已确认；它只证明亿玛平台能用该编号查询到设备或日冻结数据。设备启动后可重点看返回里的 `startupCheck.ready`、`dailyFreeze.readingEvidence` 和 `dailyFreeze.checks`：如果为 true 且有 `freezeTime` / `total`，说明亿玛平台在查询窗口内能看到该水表的日冻结读数。

## 冻结数据返回字段

标准化后的列表字段包括：

- `comAddress` / `factoryNo`：设备编号。
- `deviceId`：厂商设备编号。
- `roomId` / `roomName`：房间信息。
- `freezeTime` / `writeTime` / `readAt`：冻结时间。
- `dataValue`：总读数。
- `dataValue1` / `dataValue2` / `dataValue3` / `dataValue4`：尖峰平谷。
- `currentRatio` / `multiplier`：倍率信息。
- `deviceStatus`：当前只能表示厂商已返回数据，不能代表设备在线。
- `raw`：厂商原始报文对象。

当前只接入 `GetTranDay` 日冻结。小时冻结、月冻结、离线缓存补传必须由 ymsino 或采集网关提供接口/回调后才能实现。

## 命令闭环说明

命令路由返回统一结构：

- `commandSent`：后端是否已向厂商平台发起命令。
- `commandId`：业务侧命令编号。`POST /api/ymsino/meterinfo/on-off` 必须传 `commandId` 或 `sid`，充值接口必须传 `sid`。
- `received`：厂商平台同步响应是否表示已接收。
- `phase`：`acknowledged` / `failed` / `unsupported` 等。
- `deviceAcknowledged`：设备是否确认收到。当前为 `false`。
- `executed`：设备是否确认执行完成。当前为 `false`。
- `resultCallbackRequired`：是否仍需要厂商回调或结果查询接口才能闭环。
- `missingClosureFields`：当前厂商文档缺失的闭环字段。
- `failedReason` / `errorCode`：失败原因和错误码。
- `timeoutMs`：业务侧建议超时时间。

原因：当前 ymsino 同步接口只能证明厂商平台返回了响应，不能证明电表或水表已经物理执行。要做到完整闭环，厂商还需提供命令回调、命令结果查询接口，或 MQTT topic。

## 门禁说明

当前确认 ymsino 不生产门禁设备，因此门禁不属于 ymsino 电/水表适配范围。相关兼容路由会返回 `not-applicable`，不会再作为 ymsino 未完成项统计。

## 联调配置

常用环境变量：

- `TP_YMSINO_BASE_URL`
- `TP_YMSINO_USERNAME`
- `TP_YMSINO_PASSWORD`
- `TP_YMSINO_ORG_ID`
- `TP_YMSINO_PT_ID`
- `TP_YMSINO_TIMEOUT_MS`
- `TP_YMSINO_COMMAND_TIMEOUT_MS`
- `TP_YMSINO_READ_SUCCESS_CODES`
- `TP_YMSINO_COMMAND_SUCCESS_CODES`
- `TP_YMSINO_ELECTRIC_PROTOCOL`：默认 `M-Bus`
- `TP_YMSINO_KNOWN_ELECTRIC_FACTORY_NOS`：已知电表编号列表，逗号分隔；未配置时电表诊断接口要求显式传 `factoryNo` 或 `comAddress`
- `TP_YMSINO_WATER_PROTOCOL`：未配置时返回 `unconfirmed`，表示水表物理协议未确认
- `TP_YMSINO_KNOWN_WATER_FACTORY_NOS`：已知水表编号列表，逗号分隔；未配置时默认 `00000260507851`
- `TP_YMSINO_ELECTRIC_COMTYPE`
- `TP_YMSINO_WATER_COMTYPE`

## 建议验收

1. 调 `GET /api/ymsino/diagnostics?ptId=实际PtId&tyDate=YYYY-MM-DD`，确认 token、小区、设备、日冻结数据都能返回。
2. 检查 `devices.*.validation.ok` 是否为 `true`，如果不是，先让厂商修复设备编号或房间绑定。
3. 调 `GET /api/ymsino/meterinfo/device-diagnostic?factoryNo=实际电表编号&tyDate=YYYY-MM-DD&lookbackDays=7`，确认电表编号能命中设备列表和最近日冻结数据。
4. 调 `GET /api/ymsino/waterinfo/device-diagnostic?factoryNo=00000260507851&tyDate=YYYY-MM-DD&lookbackDays=7`，确认该水表编号能命中水表设备列表和最近日冻结数据。
5. 选一个测试电表设备，调用 `POST /api/ymsino/meterinfo/on-off` 验证厂商平台是否接收命令。
6. 让厂商提供设备侧日志或回调，人工核对设备是否真实执行。
7. 充值接口必须使用业务唯一 `sid`，避免重复充值。
