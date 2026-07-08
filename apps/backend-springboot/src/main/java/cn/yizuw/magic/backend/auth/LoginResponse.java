package cn.yizuw.magic.backend.auth;

import java.util.List;
import java.util.Map;

public record LoginResponse(
    String accessToken,
    Long centerUserId,
    List<String> codes,
    String customerId,
    String homePath,
    Long id,
    List<Map<String, Object>> parks,
    String phone,
    Integer rates,
    String realName,
    Integer reimbursementAuth,
    List<String> roles,
    Long tokenVersion,
    String username) {}
