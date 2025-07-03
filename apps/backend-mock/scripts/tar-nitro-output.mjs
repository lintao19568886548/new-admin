import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

/**
 * @description 使用原生 tar 命令创建 tar.gz 压缩包
 * @param {string} folderPath - 需要压缩的文件夹路径
 * @param {string} outputPath - 输出的 tar.gz 文件路径
 * @returns {Promise<void>}
 */
async function createTarGz(folderPath, outputPath) {
  // 确保目标文件夹存在
  const outputDir = path.dirname(outputPath);
  try {
    await fsp.mkdir(outputDir, { recursive: true });
  } catch {
    // 忽略目录已存在的错误
  }

  // 确保源文件夹存在
  if (!fs.existsSync(folderPath)) {
    throw new Error(`Source folder not found: ${folderPath}`);
  }

  console.log('Creating tar.gz archive using native tar command...');

  const { spawn } = await import('node:child_process');

  return new Promise((resolve, reject) => {
    // 删除已存在的文件
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    // 使用 tar 命令创建 gzip 压缩的 tar 文件
    const tarProcess = spawn(
      'tar',
      [
        '-czf', // c=create, z=gzip, f=file
        outputPath,
        '-C', // 改变到指定目录
        path.dirname(folderPath),
        path.basename(folderPath),
      ],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );

    const _stdout = '';
    let stderr = '';

    tarProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    tarProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    tarProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`Archive created successfully: ${outputPath}`);
        resolve();
      } else {
        reject(new Error(`tar command failed with code ${code}: ${stderr}`));
      }
    });

    tarProcess.on('error', (err) => {
      reject(new Error(`Failed to start tar command: ${err.message}`));
    });
  });
}

// --- 主执行逻辑 ---
async function main() {
  // 获取当前工作目录，即 backend-mock 目录
  const backendMockDir = process.cwd();
  const folderToZip = path.join(backendMockDir, '.output'); // Nitro build 输出目录
  const projectRoot = path.resolve(backendMockDir, '..', '..'); // 项目根目录
  const zipOutputDir = projectRoot; // 将 zip 文件放在项目根目录下
  const tarFileName = 'node.tar.gz'; // 定义 tar.gz 文件名
  const tarOutputPath = path.join(zipOutputDir, tarFileName);

  console.log(`Starting compression process for: ${folderToZip}`);
  console.log(`Outputting tar.gz to: ${tarOutputPath}`);

  try {
    await createTarGz(folderToZip, tarOutputPath);
    console.log('Backend output successfully compressed.');
  } catch (error) {
    console.error('Error compressing backend output:', error);
    throw error; // 抛出错误而不是直接退出进程
  }
}

main();
