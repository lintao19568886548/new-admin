package cn.yizuw.magic.backend.dormitory;

import java.math.BigDecimal;

/**
 * 宿舍新增请求。
 *
 * <p>第 61 批只写 dormitory 主表白名单字段；images 字段仅保留入参兼容，不写 dormitory_image 关系。
 */
public record DormitoryCreateRequest(
    String dormitoryName,
    Object floorCount,
    BigDecimal floorHeightFirst,
    BigDecimal floorHeightOther,
    Object images,
    Object parkId,
    BigDecimal rentPriceFirst,
    BigDecimal rentPriceOther,
    BigDecimal roomArea,
    String remark,
    Object totalRooms,
    Object usedRoomsFirst,
    Object usedRoomsOther) {}
