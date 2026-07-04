/**
 * api/ymsino/meterinfo/data.ts
 * 亿玛电表冻结数据（仿 hezhong/meterinfo/data.ts）
 * 接口：GET /api/ymsino/meterinfo/data
 */
import dayjs from 'dayjs';
import { useResponseSuccess } from '~/utils/response';
import { getTranDay } from '~/utils/thirdparty/ymsino';

function normalizeHDM(list: any[]) {
  return list.map((item: any) => ({
    comAddress: item.FactoryNo,
    dataItemName: '正向有功总电能',
    dataValue4: item.ZVale,
    writeTime: item.TranDate,
    dataValue3: item.ZComm,
    comtype: 'D.ZDG.FIWBM-GD04',
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

  // 查询电表冻结数据（TjType='0'）
  if (comAddresses.length === 0) {
    const res: any = await getTranDay({
      PtId: 'YZWL',
      TyDate: tyDate,
      TjType: '0',
    });
    const items = normalizeHDM(res?.Date || []);
    const total = items.length;
    return useResponseSuccess({ items, total });
  }

  // 按指定设备查询
  const items: any[] = [];
  for (const addr of comAddresses) {
    const res: any = await getTranDay({
      PtId: 'YZWL',
      TyDate: tyDate,
      RmId: '',
      TjType: '0',
    });
    const list = normalizeHDM(res?.Date || []);
    const filtered = list.filter((d: any) => d.comAddress === addr);
    items.push(...filtered);
  }

  return useResponseSuccess({ items, total: items.length });
});
