import { readMultipartFormData } from 'h3';
import {
  importRadarLeadsFromItems,
  parseRadarLeadImportFile,
} from '~/utils/investment-radar/radar-lead-import-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const formData = await readMultipartFormData(event);
    const file =
      formData?.find((item) => item.name === 'file') || formData?.[0];
    if (!file?.data) {
      return badRequestResponse('请上传导入文件', event);
    }

    const items = parseRadarLeadImportFile(
      file.filename || 'leads.csv',
      file.data,
    );
    const result = await runWithRadarSharedScope(() =>
      importRadarLeadsFromItems(items),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error('import radar leads file failed:', error);
    return serverErrorResponse('上传导入潜客文件失败', event);
  }
});
