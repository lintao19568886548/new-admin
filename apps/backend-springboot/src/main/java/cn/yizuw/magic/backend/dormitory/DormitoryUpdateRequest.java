package cn.yizuw.magic.backend.dormitory;

import java.math.BigDecimal;

/** 宿舍更新请求；本批只写 dormitory 主表白名单字段，不重建 dormitory_image 图片关系。 */
public record DormitoryUpdateRequest(
    String dormitoryName,
    Object floorCount,
    BigDecimal floorHeightFirst,
    BigDecimal floorHeightOther,
    Object parkId,
    BigDecimal rentPriceFirst,
    BigDecimal rentPriceOther,
    BigDecimal roomArea,
    String remark,
    Object totalRooms,
    Object usedRoomsFirst,
    Object usedRoomsOther) {}
