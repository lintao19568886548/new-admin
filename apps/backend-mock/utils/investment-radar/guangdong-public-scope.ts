export const GUANGDONG_PROVINCE_NAME = '广东省';

export const GUANGDONG_CITY_NAMES = [
  '广州',
  '深圳',
  '珠海',
  '汕头',
  '佛山',
  '韶关',
  '湛江',
  '肇庆',
  '江门',
  '茂名',
  '惠州',
  '梅州',
  '汕尾',
  '河源',
  '阳江',
  '清远',
  '东莞',
  '中山',
  '潮州',
  '揭阳',
  '云浮',
] as const;

export const GUANGDONG_PRIORITY_CITY_NAMES = [
  '东莞',
  '深圳',
  '广州',
  '佛山',
  '惠州',
  '中山',
  '珠海',
  '江门',
  '肇庆',
] as const;

export type GuangdongCityName = (typeof GUANGDONG_CITY_NAMES)[number];

const NON_GUANGDONG_REGION_NAMES = [
  '北京',
  '北京市',
  '天津',
  '天津市',
  '上海',
  '上海市',
  '重庆',
  '重庆市',
  '河北',
  '河北省',
  '山西',
  '山西省',
  '内蒙古',
  '内蒙古自治区',
  '辽宁',
  '辽宁省',
  '吉林',
  '吉林省',
  '黑龙江',
  '黑龙江省',
  '江苏',
  '江苏省',
  '浙江',
  '浙江省',
  '安徽',
  '安徽省',
  '福建',
  '福建省',
  '江西',
  '江西省',
  '山东',
  '山东省',
  '河南',
  '河南省',
  '湖北',
  '湖北省',
  '湖南',
  '湖南省',
  '广西',
  '广西壮族自治区',
  '海南',
  '海南省',
  '四川',
  '四川省',
  '贵州',
  '贵州省',
  '云南',
  '云南省',
  '西藏',
  '西藏自治区',
  '陕西',
  '陕西省',
  '甘肃',
  '甘肃省',
  '青海',
  '青海省',
  '宁夏',
  '宁夏回族自治区',
  '新疆',
  '新疆维吾尔自治区',
  '香港',
  '香港特别行政区',
  '澳门',
  '澳门特别行政区',
  '台湾',
  '台湾省',
] as const;

const NON_GUANGDONG_CITY_NAMES = [
  '杭州',
  '南京',
  '嘉兴',
  '苏州',
  '无锡',
  '常州',
  '南通',
  '扬州',
  '镇江',
  '泰州',
  '盐城',
  '徐州',
  '淮安',
  '连云港',
  '宿迁',
  '宁波',
  '温州',
  '湖州',
  '绍兴',
  '金华',
  '衢州',
  '舟山',
  '台州',
  '丽水',
  '合肥',
  '芜湖',
  '蚌埠',
  '淮南',
  '马鞍山',
  '淮北',
  '铜陵',
  '安庆',
  '黄山',
  '滁州',
  '阜阳',
  '宿州',
  '六安',
  '亳州',
  '池州',
  '宣城',
  '福州',
  '厦门',
  '泉州',
  '漳州',
  '莆田',
  '三明',
  '南平',
  '龙岩',
  '宁德',
  '南昌',
  '九江',
  '赣州',
  '宜春',
  '上饶',
  '吉安',
  '抚州',
  '萍乡',
  '景德镇',
  '鹰潭',
  '新余',
  '济南',
  '青岛',
  '烟台',
  '潍坊',
  '临沂',
  '淄博',
  '济宁',
  '泰安',
  '威海',
  '日照',
  '德州',
  '聊城',
  '滨州',
  '菏泽',
  '郑州',
  '洛阳',
  '开封',
  '许昌',
  '新乡',
  '南阳',
  '商丘',
  '安阳',
  '平顶山',
  '焦作',
  '濮阳',
  '漯河',
  '三门峡',
  '鹤壁',
  '周口',
  '驻马店',
  '信阳',
  '武汉',
  '襄阳',
  '宜昌',
  '黄石',
  '十堰',
  '荆州',
  '荆门',
  '鄂州',
  '孝感',
  '黄冈',
  '咸宁',
  '随州',
  '长沙',
  '株洲',
  '湘潭',
  '衡阳',
  '岳阳',
  '常德',
  '益阳',
  '郴州',
  '永州',
  '怀化',
  '娄底',
  '南宁',
  '柳州',
  '桂林',
  '梧州',
  '北海',
  '防城港',
  '钦州',
  '贵港',
  '玉林',
  '百色',
  '贺州',
  '河池',
  '来宾',
  '崇左',
  '海口',
  '三亚',
  '儋州',
  '成都',
  '绵阳',
  '德阳',
  '宜宾',
  '南充',
  '泸州',
  '达州',
  '乐山',
  '自贡',
  '内江',
  '贵阳',
  '遵义',
  '六盘水',
  '安顺',
  '毕节',
  '铜仁',
  '昆明',
  '曲靖',
  '玉溪',
  '保山',
  '昭通',
  '丽江',
  '普洱',
  '临沧',
  '西安',
  '咸阳',
  '宝鸡',
  '渭南',
  '汉中',
  '延安',
  '榆林',
  '兰州',
  '天水',
  '白银',
  '嘉峪关',
  '金昌',
  '银川',
  '石嘴山',
  '吴忠',
  '固原',
  '西宁',
  '乌鲁木齐',
  '克拉玛依',
  '石家庄',
  '唐山',
  '保定',
  '邯郸',
  '廊坊',
  '沧州',
  '邢台',
  '秦皇岛',
  '太原',
  '大同',
  '长治',
  '临汾',
  '运城',
  '沈阳',
  '大连',
  '鞍山',
  '抚顺',
  '本溪',
  '丹东',
  '锦州',
  '营口',
  '辽阳',
  '盘锦',
  '长春',
  '吉林市',
  '四平',
  '辽源',
  '通化',
  '松原',
  '白城',
  '哈尔滨',
  '齐齐哈尔',
  '牡丹江',
  '佳木斯',
  '大庆',
  '伊春',
  '呼和浩特',
  '包头',
  '赤峰',
  '通辽',
  '鄂尔多斯',
  '拉萨',
] as const;

const NON_GUANGDONG_PLACE_NAMES = [
  ...NON_GUANGDONG_REGION_NAMES,
  ...NON_GUANGDONG_CITY_NAMES,
] as const;

function normalizeScopeText(value: null | string | undefined) {
  return String(value || '')
    .replaceAll(/\s+/g, '')
    .replaceAll(/[|｜/\\,，;；]/g, ' ')
    .trim();
}

function normalizeComparableScopeText(value: null | string | undefined) {
  return normalizeScopeText(value).replaceAll(/\s+/g, '').toLowerCase();
}

function matchesAnyText(
  value: null | string | undefined,
  patterns: readonly string[],
) {
  const normalized = normalizeComparableScopeText(value);
  if (!normalized) {
    return false;
  }
  return patterns.some((pattern) =>
    normalized.includes(normalizeComparableScopeText(pattern)),
  );
}

const UNKNOWN_CITY_VALUES = new Set([
  '-',
  '--',
  'n/a',
  'na',
  'null',
  'undefined',
  '不限',
  '不限城市',
  '全国',
  '全省',
  '全部城市',
  '城市',
  '广东',
  '广东省',
  '当前',
  '当前城市',
  '所在城市',
  '无',
  '未知',
  '请选择',
  '请选择城市',
  '选择城市',
]);

const GUANGDONG_DISTRICT_TOWN_CITY_PAIRS: Array<
  readonly [string, GuangdongCityName]
> = [
  ['越秀', '广州'],
  ['海珠', '广州'],
  ['荔湾', '广州'],
  ['天河', '广州'],
  ['白云', '广州'],
  ['黄埔', '广州'],
  ['番禺', '广州'],
  ['花都', '广州'],
  ['南沙', '广州'],
  ['从化', '广州'],
  ['增城', '广州'],
  ['福田', '深圳'],
  ['罗湖', '深圳'],
  ['南山', '深圳'],
  ['宝安', '深圳'],
  ['新安', '深圳'],
  ['西乡', '深圳'],
  ['航城', '深圳'],
  ['福永', '深圳'],
  ['福海', '深圳'],
  ['沙井', '深圳'],
  ['新桥', '深圳'],
  ['松岗', '深圳'],
  ['燕罗', '深圳'],
  ['石岩', '深圳'],
  ['龙岗', '深圳'],
  ['坂田', '深圳'],
  ['布吉', '深圳'],
  ['平湖', '深圳'],
  ['横岗', '深圳'],
  ['坪地', '深圳'],
  ['南湾', '深圳'],
  ['吉华', '深圳'],
  ['园山', '深圳'],
  ['宝龙', '深圳'],
  ['盐田', '深圳'],
  ['龙华', '深圳'],
  ['民治', '深圳'],
  ['大浪', '深圳'],
  ['观湖', '深圳'],
  ['观澜', '深圳'],
  ['福城', '深圳'],
  ['坪山', '深圳'],
  ['坑梓', '深圳'],
  ['马峦', '深圳'],
  ['碧岭', '深圳'],
  ['石井', '深圳'],
  ['龙田', '深圳'],
  ['光明', '深圳'],
  ['公明', '深圳'],
  ['凤凰', '深圳'],
  ['玉塘', '深圳'],
  ['马田', '深圳'],
  ['新湖', '深圳'],
  ['大鹏', '深圳'],
  ['葵涌', '深圳'],
  ['南澳', '深圳'],
  ['香洲', '珠海'],
  ['斗门', '珠海'],
  ['金湾', '珠海'],
  ['金平', '汕头'],
  ['龙湖', '汕头'],
  ['濠江', '汕头'],
  ['潮阳', '汕头'],
  ['潮南', '汕头'],
  ['澄海', '汕头'],
  ['南澳', '汕头'],
  ['禅城', '佛山'],
  ['南海', '佛山'],
  ['顺德', '佛山'],
  ['三水', '佛山'],
  ['高明', '佛山'],
  ['浈江', '韶关'],
  ['武江', '韶关'],
  ['曲江', '韶关'],
  ['始兴', '韶关'],
  ['仁化', '韶关'],
  ['翁源', '韶关'],
  ['乳源', '韶关'],
  ['新丰', '韶关'],
  ['乐昌', '韶关'],
  ['南雄', '韶关'],
  ['赤坎', '湛江'],
  ['霞山', '湛江'],
  ['坡头', '湛江'],
  ['麻章', '湛江'],
  ['遂溪', '湛江'],
  ['徐闻', '湛江'],
  ['廉江', '湛江'],
  ['雷州', '湛江'],
  ['吴川', '湛江'],
  ['端州', '肇庆'],
  ['鼎湖', '肇庆'],
  ['高要', '肇庆'],
  ['广宁', '肇庆'],
  ['怀集', '肇庆'],
  ['封开', '肇庆'],
  ['德庆', '肇庆'],
  ['四会', '肇庆'],
  ['蓬江', '江门'],
  ['江海', '江门'],
  ['新会', '江门'],
  ['台山', '江门'],
  ['开平', '江门'],
  ['鹤山', '江门'],
  ['恩平', '江门'],
  ['茂南', '茂名'],
  ['电白', '茂名'],
  ['高州', '茂名'],
  ['化州', '茂名'],
  ['信宜', '茂名'],
  ['惠城', '惠州'],
  ['惠阳', '惠州'],
  ['博罗', '惠州'],
  ['惠东', '惠州'],
  ['龙门', '惠州'],
  ['仲恺', '惠州'],
  ['大亚湾', '惠州'],
  ['梅江', '梅州'],
  ['梅县', '梅州'],
  ['大埔', '梅州'],
  ['丰顺', '梅州'],
  ['五华', '梅州'],
  ['平远', '梅州'],
  ['蕉岭', '梅州'],
  ['兴宁', '梅州'],
  ['陆丰', '汕尾'],
  ['海丰', '汕尾'],
  ['陆河', '汕尾'],
  ['源城', '河源'],
  ['紫金', '河源'],
  ['龙川', '河源'],
  ['连平', '河源'],
  ['和平', '河源'],
  ['东源', '河源'],
  ['江城', '阳江'],
  ['阳东', '阳江'],
  ['阳西', '阳江'],
  ['阳春', '阳江'],
  ['海陵', '阳江'],
  ['清城', '清远'],
  ['清新', '清远'],
  ['佛冈', '清远'],
  ['阳山', '清远'],
  ['连山', '清远'],
  ['连南', '清远'],
  ['英德', '清远'],
  ['连州', '清远'],
  ['莞城', '东莞'],
  ['南城', '东莞'],
  ['东城', '东莞'],
  ['万江', '东莞'],
  ['石碣', '东莞'],
  ['石龙', '东莞'],
  ['茶山', '东莞'],
  ['石排', '东莞'],
  ['企石', '东莞'],
  ['横沥', '东莞'],
  ['桥头', '东莞'],
  ['谢岗', '东莞'],
  ['东坑', '东莞'],
  ['常平', '东莞'],
  ['寮步', '东莞'],
  ['樟木头', '东莞'],
  ['大朗', '东莞'],
  ['黄江', '东莞'],
  ['清溪', '东莞'],
  ['塘厦', '东莞'],
  ['凤岗', '东莞'],
  ['大岭山', '东莞'],
  ['长安', '东莞'],
  ['虎门', '东莞'],
  ['厚街', '东莞'],
  ['沙田', '东莞'],
  ['道滘', '东莞'],
  ['洪梅', '东莞'],
  ['麻涌', '东莞'],
  ['望牛墩', '东莞'],
  ['中堂', '东莞'],
  ['高埗', '东莞'],
  ['松山湖', '东莞'],
  ['滨海湾', '东莞'],
  ['石岐', '中山'],
  ['火炬', '中山'],
  ['黄圃', '中山'],
  ['南头', '中山'],
  ['东凤', '中山'],
  ['阜沙', '中山'],
  ['小榄', '中山'],
  ['东升', '中山'],
  ['古镇', '中山'],
  ['横栏', '中山'],
  ['三角', '中山'],
  ['民众', '中山'],
  ['南朗', '中山'],
  ['港口', '中山'],
  ['大涌', '中山'],
  ['沙溪', '中山'],
  ['三乡', '中山'],
  ['坦洲', '中山'],
  ['板芙', '中山'],
  ['神湾', '中山'],
  ['湘桥', '潮州'],
  ['潮安', '潮州'],
  ['饶平', '潮州'],
  ['枫溪', '潮州'],
  ['榕城', '揭阳'],
  ['揭东', '揭阳'],
  ['揭西', '揭阳'],
  ['惠来', '揭阳'],
  ['普宁', '揭阳'],
  ['云城', '云浮'],
  ['云安', '云浮'],
  ['新兴', '云浮'],
  ['郁南', '云浮'],
  ['罗定', '云浮'],
];

function expandPlaceAliases(place: string) {
  const aliases = [place];
  if (!/(?:[区县市镇]|街道|园区|新区)$/.test(place)) {
    aliases.push(
      `${place}区`,
      `${place}县`,
      `${place}市`,
      `${place}镇`,
      `${place}街道`,
      `${place}园区`,
      `${place}新区`,
    );
  }
  return aliases;
}

const cityAliasMap = new Map<string, GuangdongCityName>(
  GUANGDONG_CITY_NAMES.flatMap((city) => [
    [normalizeComparableScopeText(city), city],
    [normalizeComparableScopeText(`${city}市`), city],
  ]),
);

const districtAliasEntries = GUANGDONG_DISTRICT_TOWN_CITY_PAIRS.flatMap(
  ([place, city]) =>
    expandPlaceAliases(place).map(
      (alias) => [normalizeComparableScopeText(alias), city] as const,
    ),
);

const districtAliasMap = new Map<string, GuangdongCityName>(
  districtAliasEntries,
);

const districtAliasSearchEntries = [...districtAliasMap.entries()].sort(
  (left, right) => right[0].length - left[0].length,
);

export const GUANGDONG_CITY_SCOPE_NAMES = [
  ...new Set([
    ...districtAliasSearchEntries.map(([alias]) => alias),
    ...GUANGDONG_CITY_NAMES.flatMap((city) => [city, `${city}市`]),
  ]),
];

function escapeRegexp(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

export const GUANGDONG_CITY_SCOPE_PATTERN = GUANGDONG_CITY_SCOPE_NAMES.map(
  (value) => escapeRegexp(value),
).join('|');

export const NON_GUANGDONG_REGION_PATTERN = NON_GUANGDONG_REGION_NAMES.map(
  (value) => escapeRegexp(value),
).join('|');

export const UNKNOWN_CITY_VALUE_PATTERN = `^(?:${[
  ...[...UNKNOWN_CITY_VALUES].map((value) => escapeRegexp(value)),
  '请选择.*城市',
  '选择.*城市',
  '当前.*城市',
].join('|')})$`;

export function isUnknownCityValue(value: null | string | undefined) {
  const normalized = normalizeComparableScopeText(value);
  if (!normalized) {
    return true;
  }

  return (
    UNKNOWN_CITY_VALUES.has(normalized) ||
    /^(?:请选择|选择|当前).{0,8}城市$/.test(normalized)
  );
}

export function normalizeGuangdongCity(
  value: null | string | undefined,
): GuangdongCityName | null {
  const normalized = normalizeComparableScopeText(value);
  if (!normalized || isUnknownCityValue(value)) {
    return null;
  }

  const direct = cityAliasMap.get(normalized);
  if (direct) {
    return direct;
  }

  const matchedCity = GUANGDONG_CITY_NAMES.find(
    (city) => normalized.includes(city) || normalized.includes(`${city}市`),
  );
  if (matchedCity) {
    return matchedCity;
  }

  const directDistrict = districtAliasMap.get(normalized);
  if (directDistrict) {
    return directDistrict;
  }

  const matchedDistrict = districtAliasSearchEntries.find(([alias]) =>
    normalized.includes(alias),
  );
  return matchedDistrict?.[1] || null;
}

export function isGuangdongCity(value: null | string | undefined) {
  return Boolean(normalizeGuangdongCity(value));
}

export function hasExplicitNonGuangdongCity(value: null | string | undefined) {
  const normalized = normalizeComparableScopeText(value);
  return Boolean(
    normalized && !isUnknownCityValue(value) && !normalizeGuangdongCity(value),
  );
}

export function hasExplicitNonGuangdongRegion(
  value: null | string | undefined,
) {
  return matchesAnyText(value, NON_GUANGDONG_REGION_NAMES);
}

export function hasExplicitNonGuangdongPlaceSignal(
  value: null | string | undefined,
) {
  const normalized = normalizeComparableScopeText(value);
  if (!normalized) {
    return false;
  }
  return NON_GUANGDONG_PLACE_NAMES.some((place) => {
    const normalizedPlace = normalizeComparableScopeText(place);
    if (!normalizedPlace) {
      return false;
    }
    return (
      normalized.includes(normalizedPlace) ||
      normalized.includes(`${normalizedPlace}市`)
    );
  });
}

export interface GuangdongScopeInput {
  city?: null | string;
  district?: null | string;
  province?: null | string;
  sourceUrl?: null | string;
  text?: null | string;
}

function urlContainsGuangdongSignal(sourceUrl: null | string | undefined) {
  if (!sourceUrl) {
    return false;
  }

  try {
    const url = new URL(sourceUrl);
    const haystack = `${url.hostname}${url.pathname}`.toLowerCase();
    return (
      haystack.includes('guangdong') ||
      haystack.includes('gd.') ||
      haystack.includes('/gd/') ||
      haystack.includes('dongguan') ||
      haystack.includes('dg.') ||
      haystack.includes('/dg/') ||
      haystack.includes('shenzhen') ||
      haystack.includes('sz.') ||
      haystack.includes('/sz/') ||
      haystack.includes('guangzhou') ||
      haystack.includes('gz.') ||
      haystack.includes('/gz/') ||
      haystack.includes('foshan') ||
      haystack.includes('fs.') ||
      haystack.includes('/fs/') ||
      haystack.includes('huizhou') ||
      haystack.includes('zhongshan') ||
      haystack.includes('zs.') ||
      haystack.includes('/zs/') ||
      haystack.includes('zhuhai') ||
      haystack.includes('zhu hai') ||
      haystack.includes('/zh/') ||
      haystack.includes('jiangmen') ||
      haystack.includes('jm.') ||
      haystack.includes('/jm/') ||
      haystack.includes('zhaoqing') ||
      haystack.includes('zq.') ||
      haystack.includes('/zq/')
    );
  } catch {
    return false;
  }
}

export function resolveGuangdongCityFromText(
  text: null | string | undefined,
): GuangdongCityName | null {
  return normalizeGuangdongCity(text);
}

export function isWithinGuangdongScope(input: GuangdongScopeInput) {
  const regionText = [input.province, input.city, input.district, input.text]
    .filter(Boolean)
    .join(' ');

  if (hasExplicitNonGuangdongRegion(regionText)) {
    return false;
  }

  if (hasExplicitNonGuangdongCity(input.city)) {
    return false;
  }

  const province = normalizeScopeText(input.province);
  if (
    province &&
    (province.includes('广东') || province.includes('guangdong'))
  ) {
    return true;
  }

  if (normalizeGuangdongCity(input.city)) {
    return true;
  }

  if (normalizeGuangdongCity(input.district)) {
    return true;
  }

  if (normalizeGuangdongCity(input.text)) {
    return true;
  }

  return urlContainsGuangdongSignal(input.sourceUrl);
}
