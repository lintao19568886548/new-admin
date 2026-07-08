package cn.yizuw.magic.backend.auth;

import java.util.List;
import java.util.Map;

public record TenantUserInfo(
    List<String> codes,
    String homePath,
    Long id,
    List<Map<String, Object>> parks,
    String phone,
    Integer rates,
    String realName,
    Integer reimbursementAuth,
    List<String> roles,
    String username) {}
