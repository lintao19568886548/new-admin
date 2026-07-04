/**
 * api/ymsino/waterinfo/tree.ts
 * 亿玛水表建筑树（仿 hezhong/waterinfo/tree.ts）
 * 接口：GET /api/ymsino/waterinfo/tree
 */
import { useResponseSuccess } from '~/utils/response';
import { getInfo } from '~/utils/thirdparty/ymsino';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const result = await getInfo({
    PtId: 'YZWL',
    TjType: '1',
  });

  const query = getQuery(event) as any;
  const keyword = String(query?.keyword || '')
    .trim()
    .toLowerCase();

  const base = (result?.Date || []).filter(
    (r: any) => r && (r.FactoryNo || r.RmName),
  );

  const records = base.filter((r: any) => {
    if (!keyword) return true;
    const a = String(r.FactoryNo || '').toLowerCase();
    const n = String(r.RmName || '').toLowerCase();
    return a.includes(keyword) || n.includes(keyword);
  });

  function buildTree(list: any[]) {
    const root: Record<string, any> = {};

    for (const r of list) {
      const roomKey = r.RmId || 'unknown';
      const roomName = r.RmName || roomKey;
      const deviceKey = r.FactoryNo;

      if (!root[roomKey]) {
        root[roomKey] = {
          title: roomName,
          key: roomKey,
          children: {},
        };
      }

      root[roomKey].children[deviceKey] = {
        title: `${deviceKey}`,
        key: `${roomKey}/${deviceKey}`,
        isLeaf: true,
        dataRef: r,
      };
    }

    function toArray(map: Record<string, any>): any[] {
      const arr: any[] = [];
      for (const k of Object.keys(map)) {
        const node = map[k];
        if (node.children && Object.keys(node.children).length > 0) {
          arr.push({
            title: node.title,
            key: node.key,
            children: toArray(node.children),
          });
        } else {
          arr.push(node);
        }
      }
      return arr;
    }

    return toArray(root);
  }

  const tree = buildTree(records);
  return useResponseSuccess(tree);
});
