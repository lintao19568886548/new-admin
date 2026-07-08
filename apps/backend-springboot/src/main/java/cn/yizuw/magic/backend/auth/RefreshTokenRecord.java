package cn.yizuw.magic.backend.auth;

import java.time.OffsetDateTime;

public record RefreshTokenRecord(
    OffsetDateTime expiresAt,
    String jti,
    OffsetDateTime revokedAt,
    String tokenHash,
    Long userId) {}
