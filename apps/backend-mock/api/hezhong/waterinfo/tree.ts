import { useResponseSuccess } from '~/utils/response';
import { getDevice } from '~/utils/thirdparty/hezhong';

export default eventHandler(async (event) => {
  const result = await getDevice({
    comtype: 'HS.BLHQW.DWWF8-NG811',
    projCode: '241',
    pageSize: '1000',
    page: '1',
  });
  const query = getQuery(event) as any;
  const keyword = String(query?.keyword || '')
    .trim()
    .toLowerCase();
  const base = (result?.data?.records ?? result?.records ?? []).filter(
    (r: any) => r && (r.address || r.piplineName),
  );
  const records = base.filter((r: any) => {
    if (!keyword) return true;
    const a = String(r.address || '').toLowerCase();
    const n = String(r.piplineName || '').toLowerCase();
    return a.includes(keyword) || n.includes(keyword);
  });

  function extractPath(r: any) {
    const addrArr = String(r.address || '')
      .split('/')
      .filter((s) => !!s);
    if (addrArr.length > 0) {
      addrArr.pop();
    }
    const name = String(r.piplineName || '');
    const m = name.match(/(\d{3,})$/);
    const leaf = m ? m[1] : addrArr[addrArr.length - 1] || name || '';
    return { segments: addrArr, leaf };
  }

  function buildTree(list: any[]) {
    const root: Record<string, any> = {};
    for (const r of list) {
      const { segments, leaf } = extractPath(r);
      let cursor = root;
      let keyPath = '';
      for (const seg of segments) {
        keyPath = keyPath ? `${keyPath}/${seg}` : seg;
        if (!cursor[seg]) {
          cursor[seg] = { title: seg, key: keyPath, children: {} };
        }
        cursor = cursor[seg].children;
      }
      const leafKey = `${keyPath}/${leaf}`;
      if (!cursor[leaf]) {
        cursor[leaf] = {
          title: leaf,
          key: leafKey,
          isLeaf: true,
          dataRef: r,
        };
      }
    }
    function toArray(map: Record<string, any>): any[] {
      const arr: any[] = [];
      for (const k of Object.keys(map)) {
        const node = map[k];
        if (node.children) {
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
