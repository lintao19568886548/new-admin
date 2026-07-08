package cn.yizuw.magic.backend.user;

import java.util.List;
import java.util.Map;

public record UserInfoResponse(
    Long centerUserId,
    List<String> codes,
    String customerId,
    String desc,
    String homePath,
    Long id,
    List<Map<String, Object>> parks,
    String phone,
    Integer rates,
    String realName,
    Integer reimbursementAuth,
    List<String> roles,
    String token,
    Long tokenVersion,
    Long userId,
    String username) {}
