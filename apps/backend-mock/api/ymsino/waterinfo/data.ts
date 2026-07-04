/**
 * api/ymsino/waterinfo/data.ts
 * 亿玛水表冻结数据（仿 hezhong/waterinfo/data.ts）
 * 接口：GET /api/ymsino/waterinfo/data
 */
import dayjs from 'dayjs';
import { useResponseSuccess } from '~/utils/response';
import { getTranDay } from '~/utils/thirdparty/ymsino';

function normalizeHDM(list: any[]) {
  return list.map((item: any) => ({
    comAddress: item.FactoryNo,
    dataItemName: '累计流量',
    dataValue4: item.ZVale,
    writeTime: item.TranDate,
    dataValue3: item.ZComm,
    comtype: 'HS.BLHQW.DWWF8-NG811',
    proCode: item.RmId,
    dataValue2: item.ZPeak,
    dataValue1: item.ZTip,
    dataValue: item.ZTotal,
    freezeTime: item.TranDate,
    currentRatio: `Pt:${item.Pt} Ct:${item.Ct}`,
  }));
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const q = getQuery(event) as any;
  const _cur = Number(q.page ?? 1) || 1;
  const _size = Number(q.pageSize ?? 20) || 20;
  const tyDate = String(q.tyDate || '') || dayjs().format('YYYY-MM-DD');

  const raw = (q as any).comAddress;
  const comAddresses = raw
    ? [
        ...new Set(
          (Array.isArray(raw) ? raw : String(raw).split(','))
            .map((v: string) => String(v).trim())
            .filter(Boolean),
        ),
      ]
    : [];

  if (comAddresses.length === 0) {
    const res: any = await getTranDay({
      PtId: 'YZWL',
      TyDate: tyDate,
      TjType: '1',
    });
    const items = normalizeHDM(res?.Date || []);
    const total = items.length;
    return useResponseSuccess({ items, total });
  }

  const items: any[] = [];
  for (const addr of comAddresses) {
    const res: any = await getTranDay({
      PtId: 'YZWL',
      TyDate: tyDate,
      RmId: '',
      TjType: '1',
    });
    const list = normalizeHDM(res?.Date || []);
    const filtered = list.filter((d: any) => d.comAddress === addr);
    items.push(...filtered);
  }

  return useResponseSuccess({ items, total: items.length });
});
