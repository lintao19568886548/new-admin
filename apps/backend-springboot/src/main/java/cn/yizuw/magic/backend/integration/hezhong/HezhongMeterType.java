package cn.yizuw.magic.backend.integration.hezhong;

/** 合众平台当前接入的表计类型及平台 comType 常量。 */
public enum HezhongMeterType {
  ELECTRICITY("D.ZDG.FIWBM-GD04"),
  WATER("HS.BLHQW.DWWF8-NG811");

  private final String comType;

  HezhongMeterType(String comType) {
    this.comType = comType;
  }

  public String comType() {
    return comType;
  }
}
