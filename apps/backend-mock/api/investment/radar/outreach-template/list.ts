import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';

const templates = [
  {
    channel: 'SMS',
    content: '您好，关注到贵司有厂房需求，我们可安排专人对接园区房源。',
    createTime: null,
    enabled: true,
    placeholderJson: ['companyName', 'parkName', 'intentArea'],
    priorityLevel: 'A',
    taskType: 'OUTREACH',
    templateCode: 'RADAR_A_SMS',
    templateId: 1,
    templateName: 'A级线索短信首触达',
    updateTime: null,
  },
  {
    channel: 'CALL',
    content: '电话确认企业面积、层高、用电和入驻时间。',
    createTime: null,
    enabled: true,
    placeholderJson: ['companyName', 'parkName'],
    priorityLevel: 'A',
    taskType: 'OUTREACH',
    templateCode: 'RADAR_A_CALL',
    templateId: 2,
    templateName: 'A级线索电话外呼',
    updateTime: null,
  },
  {
    channel: 'SMS',
    content: '您好，我们可提供园区可租厂房清单供参考。',
    createTime: null,
    enabled: true,
    placeholderJson: ['companyName', 'parkName'],
    priorityLevel: 'B',
    taskType: 'OUTREACH',
    templateCode: 'RADAR_B_SMS',
    templateId: 3,
    templateName: 'B级线索短信培育',
    updateTime: null,
  },
];

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  return useResponseSuccess({
    items: templates,
    page: {
      currentPage: 1,
      pageSize: templates.length,
      total: templates.length,
    },
    total: templates.length,
  });
});
