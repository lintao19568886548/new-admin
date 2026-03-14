import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 这是真实模板，因为执行前将开启ssh 隧道
const DATABASE_URL_TEMPLATE =
  'mysql://root:123456@127.0.0.1:3307/{database}?timezone=Asia/Shanghai';

const databases = ['magic', 'public_magic'];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendMockDir = path.resolve(scriptDir, '..');
const require = createRequire(import.meta.url);
const prismaCliPath = require.resolve('prisma/build/index.js', {
  paths: [backendMockDir],
});

class PushFailedError extends Error {
  /**
   * @param {string} message
   * @param {{ cause?: unknown; exitCode?: number; stderr?: string }} options
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'PushFailedError';
    this.exitCode = options.exitCode ?? 1;
    this.stderr = options.stderr ?? '';
    this.cause = options.cause;
  }
}

function run() {
  if (!DATABASE_URL_TEMPLATE.includes('{database}')) {
    throw new Error(
      '[push:multi] DATABASE_URL_TEMPLATE 必须包含 "{database}" 占位符',
    );
  }

  if (databases.length === 0) {
    throw new Error('[push:multi] databases 为空，请先在脚本中配置数据库数组');
  }

  for (const [index, rawDatabase] of databases.entries()) {
    const database = String(rawDatabase || '').trim();
    if (!database) {
      throw new Error(
        `[push:multi] 第 ${index + 1} 个数据库名为空，请检查 databases 数组`,
      );
    }

    const databaseUrl = DATABASE_URL_TEMPLATE.replace('{database}', database);

    console.log(
      `[push:multi] (${index + 1}/${databases.length}) 正在执行 db push: ${database}`,
    );

    const result = spawnSync(process.execPath, [prismaCliPath, 'db', 'push'], {
      cwd: backendMockDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
    });

    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    if (result.error) {
      throw new PushFailedError(
        `[push:multi] 无法启动 db push: ${database} (${prismaCliPath})`,
        {
          cause: result.error,
        },
      );
    }

    if (result.status !== 0) {
      throw new PushFailedError(
        `[push:multi] db push 失败: ${database} (exit code: ${result.status ?? 1})`,
        {
          exitCode: result.status ?? 1,
          stderr: result.stderr ?? '',
        },
      );
    }
  }

  console.log('[push:multi] 全部数据库执行完成');
}

try {
  run();
} catch (error) {
  const exitCode = error instanceof PushFailedError ? error.exitCode : 1;
  process.exitCode = exitCode;
  if (error instanceof PushFailedError) {
    console.error('[push:multi] 执行失败:', error.message);
    if (error.cause instanceof Error) {
      console.error('[push:multi] 原始错误:', error.cause.message);
    }
    if (error.stderr.trim()) {
      console.error('[push:multi] 子进程 stderr 已如上输出');
    }
  } else {
    console.error(
      '[push:multi] 执行失败:',
      error instanceof Error ? error.message : String(error),
    );
  }
}
