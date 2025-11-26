import dayjs from 'dayjs';
import { useResponseSuccess } from '~/utils/response';
import { getHDMData } from '~/utils/thirdparty/hezhong';

function normalizeHDM(res: any) {
  const list =
    (res?.data?.records ??
      res?.records ??
      res?.data?.items ??
      res?.items ??
      []) ||
    [];
  const arr = Array.isArray(list) ? list : [list];
  return arr.map((item: any) => ({
    comAddress: item?.comAddress,
    dataItemName: item?.dataItemName,
    dataValue4: item?.dataValue4,
    writeTime: item?.writeTime,
    dataValue3: item?.dataValue3,
    comtype: item?.comtype,
    proCode: item?.proCode,
    dataValue2: item?.dataValue2,
    dataValue1: item?.dataValue1,
    dataValue: item?.dataValue,
    freezeTime: item?.freezeTime,
    currentRatio: item?.currentRatio,
  }));
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const q = getQuery(event) as any;
  const projCode = String(q.projCode || '241');
  const type = String(q.type || '2');
  const cur = Number(q.page ?? 1) || 1;
  const size = Number(q.pageSize ?? 20) || 20;
  const timeFrom =
    String(q.timeFrom || '') ||
    dayjs().subtract(7, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss');
  const timeTo =
    String(q.timeTo || '') ||
    dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss');
  const comType = 'D.ZDG.FIWBM-GD04';
  const raw = (q as any).comAddress;
  const comAddresses = raw
    ? [
        ...new Set(
          (Array.isArray(raw) ? raw : String(raw).split(','))
            .map((v) => String(v).trim())
            .filter(Boolean),
        ),
      ]
    : [];

  if (comAddresses.length === 0) {
    const res: any = await getHDMData({
      projCode,
      type,
      timeFrom,
      timeTo,
      comType,
      pageSize: String(size),
      page: String(cur),
    });
    const items = normalizeHDM(res);
    const total = Number(res?.data?.total ?? res?.total ?? items.length);
    return useResponseSuccess({ items, total });
  }

  const meta = await Promise.all(
    comAddresses.map((addr) =>
      getHDMData({
        projCode,
        type,
        timeFrom,
        timeTo,
        comAddress: addr,
        comType,
        pageSize: '1',
        page: '1',
      }),
    ),
  );
  const totals = meta.map((res) => Number(res?.data?.total ?? res?.total ?? 0));
  const total = totals.reduce((acc, t) => acc + t, 0);
  let remaining = size;
  let offset = (cur - 1) * size;
  const items: any[] = [];
  for (let i = 0; i < comAddresses.length && remaining > 0; i++) {
    const ti = totals[i] || 0;
    if (offset >= ti) {
      offset -= ti;
      continue;
    }
    const localSkip = offset;
    const localNeed = Math.min(ti - localSkip, remaining);
    const startPage = Math.floor(localSkip / size) + 1;
    const withinSkip = localSkip % size;
    const firstRes: any = await getHDMData({
      projCode,
      type,
      timeFrom,
      timeTo,
      comAddress: comAddresses[i],
      comType,
      pageSize: String(size),
      page: String(startPage),
    });
    const firstList = normalizeHDM(firstRes);
    const takeFirst = Math.min(localNeed, Math.max(0, size - withinSkip));
    if (takeFirst > 0) {
      items.push(...firstList.slice(withinSkip, withinSkip + takeFirst));
    }
    const remain = localNeed - takeFirst;
    if (remain > 0) {
      const secondRes: any = await getHDMData({
        projCode,
        type,
        timeFrom,
        timeTo,
        comAddress: comAddresses[i],
        comType,
        pageSize: String(size),
        page: String(startPage + 1),
      });
      const secondList = normalizeHDM(secondRes);
      items.push(...secondList.slice(0, remain));
    }
    remaining -= localNeed;
    offset = 0;
  }
  return useResponseSuccess({ items, total });
});
