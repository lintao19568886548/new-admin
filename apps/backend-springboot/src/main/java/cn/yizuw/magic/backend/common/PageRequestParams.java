package cn.yizuw.magic.backend.common;

public final class PageRequestParams {

  private PageRequestParams() {}

  public static int normalizePage(Object value, int fallback) {
    return normalizeInt(value, fallback, 1, 9999);
  }

  public static int normalizePageSize(Object value, int fallback) {
    return normalizeInt(value, fallback, 1, 200);
  }

  public static int normalizeInt(Object value, int fallback, int min, int max) {
    if (value == null) {
      return fallback;
    }
    try {
      int parsed = (int) Math.floor(Double.parseDouble(String.valueOf(value)));
      if (parsed < min) {
        return min;
      }
      if (parsed > max) {
        return max;
      }
      return parsed;
    } catch (NumberFormatException error) {
      return fallback;
    }
  }
}
