package cn.yizuw.magic.backend.rental.tenant;

/**
 * 合同工资记录同步请求。
 *
 * <p>旧接口只接收 {@code currentPark} 做园区范围收窄；同步逻辑只补齐缺失的 {@code salary} 主表记录。
 */
public record SalarySyncRequest(Object currentPark) {}
