package cn.yizuw.magic.backend.park;

/**
 * 旧 `/park` 园区新增请求。
 *
 * <p>第 61 批只写 park 主表白名单字段；系统园区嵌套创建厂房、宿舍和图片关系留给后续专项迁移。
 */
public record ParkCreateRequest(
    Object address,
    Object area,
    Object contact,
    Object description,
    Object manager,
    Object parkName,
    Object status) {}
