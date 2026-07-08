package cn.yizuw.magic.backend.system.user;

public record SystemUserQuery(
    Integer currentPage,
    Integer pageSize,
    String phone,
    String realName,
    Integer status,
    String username) {}
