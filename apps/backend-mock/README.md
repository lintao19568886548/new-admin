# @vben/backend-mock

## Description

Vben Admin 数据 mock 服务，没有对接任何的数据库，所有数据都是模拟的，用于前端开发时提供数据支持。线上环境不再提供 mock 集成，可自行部署服务或者对接真实数据，由于 `mock.js` 等工具有一些限制，比如上传文件不行、无法模拟复杂的逻辑等，所以这里使用了真实的后端服务来实现。唯一麻烦的是本地需要同时启动后端服务和前端服务，但是这样可以更好的模拟真实环境。该服务不需要手动启动，已经集成在 vite 插件内，随应用一起启用。

## Running the app

```bash
# development
$ pnpm run start

# production mode
$ pnpm run build
```

## Attendance Automation Test Worker

The `attendance-automation-test` worker is a transparent test-only scheduler for checking attendance automation behavior. It is disabled by default and will not start when `NODE_ENV=production` unless production is explicitly allowed.

Required environment variables:

```bash
ATTENDANCE_AUTOMATION_TEST_ENABLED=true
ATTENDANCE_AUTOMATION_TEST_USERNAMES=auto_test_user
ATTENDANCE_AUTOMATION_TEST_LONGITUDE=113.000000
ATTENDANCE_AUTOMATION_TEST_LATITUDE=23.000000
```

Optional environment variables:

```bash
ATTENDANCE_AUTOMATION_TEST_USER_IDS=1001
ATTENDANCE_AUTOMATION_TEST_CUSTOMER_IDS=public
ATTENDANCE_AUTOMATION_TEST_CHECK_IN_START=08:20:00
ATTENDANCE_AUTOMATION_TEST_CHECK_IN_END=08:30:00
ATTENDANCE_AUTOMATION_TEST_CHECK_OUT_START=18:00:00
ATTENDANCE_AUTOMATION_TEST_CHECK_OUT_END=18:10:00
ATTENDANCE_AUTOMATION_TEST_WORKDAYS=1,2,3,4,5,6
ATTENDANCE_AUTOMATION_TEST_WORKER_INTERVAL_MS=60000
ATTENDANCE_AUTOMATION_TEST_RANDOM_SALT=local-test
ATTENDANCE_AUTOMATION_TEST_ALLOW_NON_TEST_USERS=false
ATTENDANCE_AUTOMATION_TEST_ALLOW_PRODUCTION=false
```

Only explicitly configured users whose username, real name, phone, or `customerType` clearly marks them as test/mock/auto/demo/sandbox accounts are eligible by default. Other users are skipped and logged. Set `ATTENDANCE_AUTOMATION_TEST_ALLOW_NON_TEST_USERS=true` only in local development when a normal-looking account must be included in the scheduler. Set `ATTENDANCE_AUTOMATION_TEST_ALLOW_PRODUCTION=true` only with explicit `ATTENDANCE_AUTOMATION_TEST_CUSTOMER_IDS`, user IDs or usernames, coordinates, and workday windows. `ATTENDANCE_AUTOMATION_TEST_WORKDAYS` uses `0` for Sunday through `6` for Saturday. Picked punch times avoid exact `00` seconds when the configured window allows it.
