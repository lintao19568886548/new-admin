package cn.yizuw.magic.backend.factory;

import java.math.BigDecimal;

/**
 * 租赁管理厂房列表查询条件。
 *
 * <p>旧接口路径是 `/rental/manage/list`，底层仍读 `factory` 表。
 */
public record RentalManageQuery(
    String address,
    String area,
    String availableArea,
    String contact,
    Integer currentPage,
    Integer currentPark,
    String description,
    String factoryName,
    Integer pageSize,
    String rentPrice) {

  BigDecimal numericValue(String raw) {
    if (raw == null) {
      return null;
    }
    try {
      return new BigDecimal(raw.trim());
    } catch (NumberFormatException error) {
      return null;
    }
  }
}
