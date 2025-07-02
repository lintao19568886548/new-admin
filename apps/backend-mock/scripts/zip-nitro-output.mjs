import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import archiver from 'archiver';

/**
 * @description 压缩文件夹
 * @param {string} folderPath - 需要压缩的文件夹路径
 * @param {string} outputPath - 输出的 zip 文件路径
 * @returns {Promise<void>}
 */
async function zipFolder(folderPath, outputPath) {
  // 确保目标文件夹存在
  const outputDir = path.dirname(outputPath);
  try {
    await fsp.mkdir(outputDir, { recursive: true });
  } catch {
    // 忽略目录已存在的错误
  }

  return new Promise((resolve, reject) => {
    // 确保源文件夹存在
    if (!fs.existsSync(folderPath)) {
      return reject(new Error(`Source folder not found: ${folderPath}`));
    }

    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // 设置压缩级别
    });

    output.on('close', () => {
      console.log(
        `ZIP file created: ${outputPath} (${archive.pointer()} total bytes)`,
      );
      resolve();
    });

    output.on('error', (err) => {
      reject(err);
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Archiver warning:', err);
      } else {
        reject(err);
      }
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    // 将文件夹内容添加到压缩包，false 表示不包含文件夹本身作为根目录
    // 添加过滤器以排除可能导致解压问题的文件和目录
    archive.directory(folderPath, false, (entry) => {
      // 排除 node_modules 目录以避免 Windows/Linux 兼容性问题
      if (entry.name.includes('node_modules')) {
        console.log(`跳过 node_modules 相关文件: ${entry.name}`);
        return false;
      }

      // 排除符号链接以避免解压时的权限问题
      if (entry.stats && entry.stats.isSymbolicLink()) {
        console.log(`跳过符号链接: ${entry.name}`);
        return false;
      }

      // 排除可能导致权限问题的隐藏文件和临时文件
      const fileName = path.basename(entry.name);
      if (
        fileName.startsWith('.') &&
        (fileName.includes('lock') || fileName.includes('cache'))
      ) {
        console.log(`跳过缓存/锁文件: ${entry.name}`);
        return false;
      }

      return entry;
    });

    archive.finalize();
  });
}

// --- 主执行逻辑 ---
async function main() {
  // 获取当前工作目录，即 backend-mock 目录
  const backendMockDir = process.cwd();
  const folderToZip = path.join(backendMockDir, '.output'); // Nitro build 输出目录
  const projectRoot = path.resolve(backendMockDir, '..', '..'); // 项目根目录
  const zipOutputDir = projectRoot; // 将 zip 文件放在项目根目录下
  const zipFileName = 'node.zip'; // 定义 zip 文件名
  const zipOutputPath = path.join(zipOutputDir, zipFileName);

  console.log(`Starting zipping process for: ${folderToZip}`);
  console.log(`Outputting ZIP to: ${zipOutputPath}`);
  console.log(
    '注意: 为了避免 Windows/Linux 兼容性问题，将自动排除 node_modules 和符号链接',
  );

  try {
    await zipFolder(folderToZip, zipOutputPath);
    console.log('Backend output successfully zipped.');
  } catch (error) {
    console.error('Error zipping backend output:', error);
    throw error; // 抛出错误而不是直接退出进程
  }
}

main();
