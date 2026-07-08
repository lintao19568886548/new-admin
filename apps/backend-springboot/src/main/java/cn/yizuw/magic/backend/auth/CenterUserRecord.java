package cn.yizuw.magic.backend.auth;

public record CenterUserRecord(
    String customerId,
    Integer customerStatus,
    String dbName,
    Long id,
    String password,
    Integer status,
    Long tokenVersion,
    String username) {}
