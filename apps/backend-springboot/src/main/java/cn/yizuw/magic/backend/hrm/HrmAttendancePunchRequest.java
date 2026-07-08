package cn.yizuw.magic.backend.hrm;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/**
 * HRM 打卡请求。
 *
 * <p>第四十三批只写 attendances 主表；设备绑定、设备异常记录和短信验证码仍保留在旧后端专项处理。
 */
public record HrmAttendancePunchRequest(
    Boolean allowOutsideRange,
    @NotNull(message = "不能为空") BigDecimal latitude,
    @NotNull(message = "不能为空") BigDecimal longitude,
    @NotNull(message = "不能为空") String punchTime) {}
