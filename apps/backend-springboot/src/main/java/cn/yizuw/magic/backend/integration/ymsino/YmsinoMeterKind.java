package cn.yizuw.magic.backend.integration.ymsino;

/** 亿玛表计平台当前只读接入的表计类型。 */
public enum YmsinoMeterKind {
  ELECTRIC("electric"),
  WATER("water");

  private final String value;

  YmsinoMeterKind(String value) {
    this.value = value;
  }

  public String value() {
    return value;
  }
}
