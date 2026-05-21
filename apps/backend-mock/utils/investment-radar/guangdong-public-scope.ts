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

function normalizeScopeText(value: null | string | undefined) {
  return String(value || '')
    .replaceAll(/\s+/g, '')
    .replaceAll(/[|｜/\\,，;；]/g, ' ')
    .trim();
}

function normalizeComparableScopeText(value: null | string | undefined) {
  return normalizeScopeText(value).replaceAll(/\s+/g, '').toLowerCase();
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
  ['龙岗', '深圳'],
  ['盐田', '深圳'],
  ['龙华', '深圳'],
  ['坪山', '深圳'],
  ['光明', '深圳'],
  ['大鹏', '深圳'],
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
      haystack.includes('hz.') ||
      haystack.includes('/hz/') ||
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
