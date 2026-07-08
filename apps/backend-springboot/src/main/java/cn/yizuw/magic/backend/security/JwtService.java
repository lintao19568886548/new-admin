package cn.yizuw.magic.backend.security;

import cn.yizuw.magic.backend.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

  private final AppProperties appProperties;

  public JwtService(AppProperties appProperties) {
    this.appProperties = appProperties;
  }

  public String generateAccessToken(UserTokenPayload payload) {
    Instant now = Instant.now();
    return Jwts.builder()
        .claims(toClaims(payload))
        .issuedAt(Date.from(now))
        .expiration(Date.from(now.plus(parseDuration(appProperties.getJwt().getAccessTokenExpiresIn()))))
        .signWith(secretKey(appProperties.getJwt().getAccessTokenSecret()))
        .compact();
  }

  public UserTokenPayload verifyAccessToken(String token) {
    Claims claims =
        Jwts.parser()
            .verifyWith(secretKey(appProperties.getJwt().getAccessTokenSecret()))
            .build()
            .parseSignedClaims(token)
            .getPayload();

    return fromClaims(claims);
  }

  public RefreshPayload verifyRefreshToken(String token) {
    Claims claims =
        Jwts.parser()
            .verifyWith(secretKey(appProperties.getJwt().getRefreshTokenSecret()))
            .build()
            .parseSignedClaims(token)
            .getPayload();
    return new RefreshPayload(fromClaims(claims), String.valueOf(claims.get("jti")));
  }

  public RefreshTokenIssue issueRefreshToken(UserTokenPayload payload) {
    Instant now = Instant.now();
    String jti = UUID.randomUUID().toString();
    Instant expiresAt = now.plus(parseDuration(appProperties.getJwt().getRefreshTokenExpiresIn()));
    Map<String, Object> claims = new java.util.LinkedHashMap<>(toClaims(payload));
    claims.put("jti", jti);
    String token =
        Jwts.builder()
            .claims(claims)
            .issuedAt(Date.from(now))
            .expiration(Date.from(expiresAt))
            .signWith(secretKey(appProperties.getJwt().getRefreshTokenSecret()))
            .compact();
    return new RefreshTokenIssue(OffsetDateTime.ofInstant(expiresAt, ZoneOffset.UTC), jti, token);
  }

  private Map<String, Object> toClaims(UserTokenPayload payload) {
    return Map.ofEntries(
        Map.entry("centerUserId", payload.centerUserId()),
        Map.entry("customerId", payload.customerId()),
        Map.entry("id", payload.id()),
        Map.entry("rates", payload.rates() == null ? 0 : payload.rates()),
        Map.entry("reimbursementAuth", payload.reimbursementAuth() == null ? 0 : payload.reimbursementAuth()),
        Map.entry("tokenVersion", payload.tokenVersion()),
        Map.entry("username", payload.username()),
        Map.entry("dbName", payload.dbName() == null ? "" : payload.dbName()),
        Map.entry("roles", payload.roles() == null ? List.of() : payload.roles()),
        Map.entry("parks", payload.parks() == null ? List.of() : payload.parks()));
  }

  @SuppressWarnings("unchecked")
  private UserTokenPayload fromClaims(Claims claims) {
    return new UserTokenPayload(
        toLong(claims.get("centerUserId")),
        requiredString(claims, "customerId"),
        normalizeOptionalString(claims.get("dbName")),
        toLong(claims.get("id")),
        (List<Map<String, Object>>) claims.getOrDefault("parks", List.of()),
        toInteger(claims.get("rates")),
        toInteger(claims.get("reimbursementAuth")),
        (List<String>) claims.getOrDefault("roles", List.of()),
        toLong(claims.get("tokenVersion")),
        requiredString(claims, "username"));
  }

  private Duration parseDuration(String value) {
    String normalized = value == null ? "" : value.trim().toLowerCase();
    if (normalized.endsWith("ms")) {
      return Duration.ofMillis(Long.parseLong(normalized.substring(0, normalized.length() - 2)));
    }
    if (normalized.endsWith("s")) {
      return Duration.ofSeconds(Long.parseLong(normalized.substring(0, normalized.length() - 1)));
    }
    if (normalized.endsWith("m")) {
      return Duration.ofMinutes(Long.parseLong(normalized.substring(0, normalized.length() - 1)));
    }
    if (normalized.endsWith("h")) {
      return Duration.ofHours(Long.parseLong(normalized.substring(0, normalized.length() - 1)));
    }
    if (normalized.endsWith("d")) {
      return Duration.ofDays(Long.parseLong(normalized.substring(0, normalized.length() - 1)));
    }
    return Duration.ofSeconds(Long.parseLong(normalized));
  }

  private SecretKey secretKey(String secret) {
    byte[] raw = secret.getBytes(StandardCharsets.UTF_8);
    return raw.length >= 32
        ? Keys.hmacShaKeyFor(raw)
        : new SecretKeySpec(sha256(raw), "HmacSHA256");
  }

  private byte[] sha256(byte[] raw) {
    try {
      return MessageDigest.getInstance("SHA-256").digest(raw);
    } catch (NoSuchAlgorithmException error) {
      throw new IllegalStateException("SHA-256 digest is not available", error);
    }
  }

  private String requiredString(Claims claims, String name) {
    String normalized = normalizeOptionalString(claims.get(name));
    if (normalized == null) {
      throw new JwtException("JWT claim is missing: " + name);
    }
    return normalized;
  }

  private String normalizeOptionalString(Object value) {
    if (value == null) {
      return null;
    }
    String normalized = String.valueOf(value).trim();
    return normalized.isEmpty() ? null : normalized;
  }

  private Long toLong(Object value) {
    if (value == null) {
      return null;
    }
    if (value instanceof Number number) {
      return number.longValue();
    }
    return Long.parseLong(String.valueOf(value));
  }

  private Integer toInteger(Object value) {
    if (value == null) {
      return 0;
    }
    if (value instanceof Number number) {
      return number.intValue();
    }
    return Integer.parseInt(String.valueOf(value));
  }

  public record RefreshPayload(UserTokenPayload payload, String jti) {}

  public record RefreshTokenIssue(OffsetDateTime expiresAt, String jti, String token) {}
}
