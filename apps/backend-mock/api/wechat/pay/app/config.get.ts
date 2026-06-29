import { useResponseSuccess } from '~/utils/response';
import { getWechatPayAppConfigStatus } from '~/utils/wechat-pay';

export default eventHandler(() => {
  return useResponseSuccess(getWechatPayAppConfigStatus());
});
