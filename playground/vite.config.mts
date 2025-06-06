import type { ConfigEnv } from 'vite'; // 2. 从 vite 导入 ConfigEnv 类型，增强类型安全

import process from 'node:process'; // 1. 导入 process 模块以使用 process.env

import { defineConfig } from '@vben/vite-config';

/**
 * Vite 配置函数。
 * 此函数被传递给 @vben/vite-config 的 defineConfig，用于生成最终的 Vite 配置。
 * @param env Vite 传递的配置环境对象 (ConfigEnv)，可能包含 'command' ('build' 或 'serve') 和 'mode'。
 *            根据 TypeScript 错误提示，此处的 env 参数可能为 undefined，因此添加了可选链和检查。
 * @returns 返回一个 Promise，解析为 Vite 配置对象。
 */
export default defineConfig(async (env?: ConfigEnv) => {
  // 3. 将 env 参数标记为可选 ConfigEnv
  // Vite 会传入 command ('build' 或 'serve')

  // 4. 安全检查：如果 env 或 env.command 未定义，则需要处理此情况
  // 标准的 Vite 应该总是提供 env 对象及其 command 属性。
  // 如果 env 可能为 undefined (如TS错误所暗示)，我们需要一个回退策略。
  if (!env) {
    console.warn(
      '[@vben/vite-config] 未提供有效的 ConfigEnv 对象给 defineConfig 回调。将使用默认的 base 路径。',
    );
    // 根据项目需求，这里可以返回一个默认配置或抛出错误
    return {
      application: {},
      vite: {
        base: process.env.VITE_PUBLIC_PATH || '/', // 使用默认 base
        // 其他必要的默认配置...
      },
    };
  }
  // 此时，env 被确认是 ConfigEnv 类型
  const command = env.command;

  return {
    application: {},
    vite: {
      /**
       * 为 Capacitor 构建设置正确的 base URL。
       * 当 command 为 'build' 时，我们假设是为生产或 Capacitor 构建，
       * 将 base 设置为 './' 以确保相对路径正确。
       * 否则，使用默认的 '/' 或环境变量 VITE_PUBLIC_PATH。
       */
      base: command === 'build' ? './' : process.env.VITE_PUBLIC_PATH || '/', // 5. 使用导入的 process.env
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            // mock代理目标地址
            target: 'http://localhost:5320/api',
            ws: true,
          },
        },
      },
    },
  };
});
