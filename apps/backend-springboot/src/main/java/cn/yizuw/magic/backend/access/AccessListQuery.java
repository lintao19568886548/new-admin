package cn.yizuw.magic.backend.access;

/**
 * 门禁模块列表查询条件。
 *
 * <p>字段覆盖访客、车辆、门禁设备三个旧接口的查询参数，Controller 负责按接口传入对应字段。
 */
public record AccessListQuery(
    String carNum,
    String carNumber,
    Integer currentPage,
    Integer currentPark,
    String deviceCode,
    String deviceName,
    String location,
    Integer pageSize,
    Integer parkId,
    String phoneNumber,
    String registerTime,
    Integer status,
    String visitorName) {}
