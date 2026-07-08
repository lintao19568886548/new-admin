package cn.yizuw.magic.backend.security;

import java.util.List;
import java.util.Map;

public record UserTokenPayload(
    Long centerUserId,
    String customerId,
    String dbName,
    Long id,
    List<Map<String, Object>> parks,
    Integer rates,
    Integer reimbursementAuth,
    List<String> roles,
    Long tokenVersion,
    String username) {}
