import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    // 获取上传的文件数据
    const formData = await readMultipartFormData(event);
    console.log(formData);

    if (!formData || formData.length === 0) {
      return createError({
        statusCode: 400,
        message: '没有接收到文件', // 使用message替代statusMessage
      });
    }

    const file = formData[0]; // 获取第一个文件

    // 检查文件类型
    const isImageType =
      file.type === 'image/jpeg' ||
      file.type === 'image/png' ||
      file.type === 'image/jpg';

    if (!isImageType) {
      return createError({
        statusCode: 400,
        message: '只能上传JPG/PNG格式的图片', // 使用message替代statusMessage
      });
    }

    // 创建上传目录
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // 生成唯一文件名
    const fileExt = file.filename.split('.').pop();
    const fileName = `${randomUUID()}.${fileExt}`;
    const filePath = join(uploadDir, fileName);

    // 写入文件
    await writeFile(filePath, file.data);

    // 返回文件URL
    const fileUrl = `/uploads/${fileName}`;

    console.log('文件上传成功:', {
      originalName: file.filename,
      size: file.data.length,
      type: file.type,
      url: fileUrl,
    });

    return useResponseSuccess({
      url: fileUrl,
      name: file.filename,
      thumbUrl: fileUrl,
    });
  } catch (error) {
    console.error('文件上传失败:', error);
    return createError({
      statusCode: 500,
      message: '文件上传失败', // 使用message替代statusMessage
      data: error instanceof Error ? error.message : String(error),
    });
  }
});
