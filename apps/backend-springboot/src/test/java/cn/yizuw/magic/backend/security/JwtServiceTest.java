package cn.yizuw.magic.backend.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cn.yizuw.magic.backend.config.AppProperties;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

  @Test
  void defaultShortSecretCanSignAndVerifyAccessToken() {
    JwtService jwtService = new JwtService(new AppProperties());
    UserTokenPayload payload =
        new UserTokenPayload(
            10L, "customer-a", "customer_a", 20L, List.of(), 0, 0, List.of("Admin"), 1L, "tester");

    UserTokenPayload verified = jwtService.verifyAccessToken(jwtService.generateAccessToken(payload));

    assertThat(verified.customerId()).isEqualTo("customer-a");
    assertThat(verified.id()).isEqualTo(20L);
    assertThat(verified.username()).isEqualTo("tester");
  }

  @Test
  void verifyAccessTokenRejectsMissingRequiredPayloadClaims() {
    AppProperties appProperties = new AppProperties();
    appProperties.getJwt().setAccessTokenSecret("12345678901234567890123456789012");
    JwtService jwtService = new JwtService(appProperties);
    Instant now = Instant.now();
    String token =
        Jwts.builder()
            .claims(Map.of("id", 20L, "username", "tester"))
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(60)))
            .signWith(
                Keys.hmacShaKeyFor(
                    appProperties.getJwt().getAccessTokenSecret().getBytes(StandardCharsets.UTF_8)))
            .compact();

    assertThatThrownBy(() -> jwtService.verifyAccessToken(token))
        .isInstanceOf(JwtException.class)
        .hasMessageContaining("customerId");
  }
}
