import { createHash, randomBytes } from 'node:crypto'; // 引入 createHash 和 randomBytes
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, parse } from 'node:path'; // 引入 parse 用于获取文件名和后缀

import { createError, readMultipartFormData } from 'h3'; // 引入 H3 工具函数
import { prismaClient } from '~/utils/db'; // 引入 prismaClient
import { verifyAccessToken } from '~/utils/jwt-utils'; // 确保引入了 verifyAccessToken
import {
  unAuthorizedResponse, // 确保引入了 useResponseError
  useResponseSuccess,
} from '~/utils/response'; // 确保引入了 useResponseSuccess 和 unAuthorizedResponse

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    // 获取上传的文件数据
    const formData = await readMultipartFormData(event);

    if (!formData || formData.length === 0) {
      return createError({
        statusCode: 400,
        message: '没有接收到文件',
      });
    }

    const file = formData[0];
    const originalFilename = file.filename || 'unknown'; // 获取原始文件名

    // 检查文件类型
    const isImageType =
      file.type === 'image/jpeg' ||
      file.type === 'image/png' ||
      file.type === 'image/jpg';

    if (!isImageType) {
      return createError({
        statusCode: 400,
        message: '只能上传JPG/PNG格式的图片',
      });
    }

    // 1. 计算文件内容的 SHA-256 哈希值
    const hash = createHash('sha256').update(file.data).digest('hex');

    // 2. 检查数据库中是否已存在相同哈希值的图片
    const existingImage = await prismaClient.image.findUnique({
      where: { hash },
      // 只选择需要的字段，不再需要 originalName
      select: { imgId: true, imgUrl: true },
    });

    // 3. 如果图片已存在 (基于哈希值判断)
    if (existingImage) {
      console.log('图片已存在 (哈希值匹配):', {
        hash,
        url: existingImage.imgUrl,
        // 注意：这里我们不再从数据库读取 originalName
        // 直接使用上传时的原始文件名返回给前端，因为内容相同
        originalName: originalFilename,
      });
      // 直接返回已存在图片的信息
      return useResponseSuccess({
        imgId: existingImage.imgId,
        url: existingImage.imgUrl,
        name: originalFilename, // 返回上传时的原始文件名给前端显示
        thumbUrl: existingImage.imgUrl,
      });
    }

    // 4. 如果图片不存在，则保存文件并存入数据库
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // 5. 生成新的文件名：原始基本名.时间戳.随机后缀.后缀
    const parsedPath = parse(originalFilename);
    const originalBaseName = parsedPath.name; // 获取不含后缀的文件名
    const originalFileExt = parsedPath.ext.slice(1) || 'png'; // 获取后缀 (去掉点), 提供默认值

    // --- 新增：限制文件后缀长度 ---
    const maxExtLength = 10; // 设定后缀最大字符数
    const truncatedFileExt =
      originalFileExt.length > maxExtLength
        ? originalFileExt.slice(0, maxExtLength) // 如果过长，则截断
        : originalFileExt;
    // --- 结束新增部分 ---

    const timestamp = Date.now();
    // 对原始基本名进行简单清理
    const sanitizedBaseName = originalBaseName.replaceAll(/[\\/:*?"<>|]/g, '_');

    // 限制基础名称长度
    const maxBaseNameChars = 200;
    const truncatedBaseName =
      sanitizedBaseName.length > maxBaseNameChars
        ? sanitizedBaseName.slice(0, maxBaseNameChars)
        : sanitizedBaseName;

    // --- 新增：生成随机后缀 ---
    const randomSuffix = randomBytes(3).toString('hex'); // 生成一个6位的十六进制随机字符串
    // --- 结束新增部分 ---

    // 使用截断后的基础名称、时间戳、随机后缀和截断后的后缀组合文件名
    const fileName = `${truncatedBaseName}.${timestamp}.${randomSuffix}.${truncatedFileExt}`; // 组合新文件名
    const filePath = join(uploadDir, fileName);
    const fileUrl = `/uploads/${fileName}`; // 文件访问 URL

    // 6. 写入文件
    await writeFile(filePath, file.data);

    // 7. 将图片信息存入数据库
    const newImage = await prismaClient.image.create({
      data: {
        imgUrl: fileUrl,
        hash,
        // originalName: originalFilename, // 不再存储原始文件名
      },
      // 选择返回的字段，确认 imgId 是否需要
      select: { imgId: true },
    });

    console.log('文件上传并记录成功:', {
      imgId: newImage.imgId,
      originalName: originalFilename, // 日志中仍记录原始名
      generatedName: fileName, // 日志中记录生成的文件名
      size: file.data.length,
      type: file.type,
      hash,
      url: fileUrl,
    });

    // 8. 返回成功信息，包含 URL 和原始文件名 (保持不变)
    return useResponseSuccess({
      imgId: newImage.imgId,
      url: fileUrl,
      name: originalFilename, // 返回原始文件名给前端显示
      thumbUrl: fileUrl,
    });
  } catch (error: any) {
    // 显式声明 error 类型为 any 或 unknown
    console.error('文件上传失败:', error);
    // 区分 Prisma 错误和其他错误
    let statusCode = 500;
    let message = '文件上传失败';
    if (error?.code === 'P2002' && error?.meta?.target?.includes('hash')) {
      // 理论上不会进入这里，因为前面已经检查过hash了，但作为保险
      statusCode = 409; // Conflict
      message = '文件哈希值冲突，可能已存在相同文件';
      console.warn('数据库层面检测到哈希冲突:', error.meta);
    }

    return createError({
      statusCode,
      message,
      data: error instanceof Error ? error.message : String(error),
    });
  }
});
