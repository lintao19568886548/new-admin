export const GUANGDONG_CITY_CODE_MAP: Record<string, string> = {
  '440000': '广东省',
  '440100': '广州市',
  '440200': '韶关市',
  '440300': '深圳市',
  '440400': '珠海市',
  '440500': '汕头市',
  '440600': '佛山市',
  '440700': '江门市',
  '440800': '湛江市',
  '440900': '茂名市',
  '441200': '肇庆市',
  '441300': '惠州市',
  '441400': '梅州市',
  '441500': '汕尾市',
  '441600': '河源市',
  '441700': '阳江市',
  '441800': '清远市',
  '441900': '东莞市',
  '442000': '中山市',
  '445100': '潮州市',
  '445200': '揭阳市',
  '445300': '云浮市',
};

export function getCityNameByCode(code?: string): string {
  const c = String(code ?? '').trim();
  if (!c) return '';
  const name6 = GUANGDONG_CITY_CODE_MAP[c];
  if (name6) return name6;
  const prefix = c.length >= 4 ? c.slice(0, 4) : '';
  if (prefix) {
    for (const [k, v] of Object.entries(GUANGDONG_CITY_CODE_MAP)) {
      if (k.slice(0, 4) === prefix) return v;
    }
  }
  return c;
}
