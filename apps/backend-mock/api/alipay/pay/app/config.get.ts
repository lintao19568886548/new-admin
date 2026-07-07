import { getAlipayPayConfigStatus } from '~/utils/alipay-pay';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(() => {
  return useResponseSuccess(getAlipayPayConfigStatus());
});
