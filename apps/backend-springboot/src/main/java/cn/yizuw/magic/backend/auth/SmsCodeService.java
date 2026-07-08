package cn.yizuw.magic.backend.auth;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.config.AppProperties;
import java.security.SecureRandom;
import java.time.Duration;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * 短信验证码存取与校验服务。
 *
 * <p>旧 Nitro 使用进程内 Map；Spring Boot 迁移期改为 Redis，保证多实例部署时验证码、重发限流和错误尝试次数一致。
 */
@Service
public class SmsCodeService {

  private static final SecureRandom SECURE_RANDOM = new SecureRandom();

  private final AppProperties appProperties;
  private final RedisTemplate<String, Object> redisTemplate;

  public SmsCodeService(AppProperties appProperties, RedisTemplate<String, Object> redisTemplate) {
    this.appProperties = appProperties;
    this.redisTemplate = redisTemplate;
  }

  /** 生成并保存验证码；若仍处于重发间隔内，保持旧接口错误文案。 */
  public String issueCode(String phoneNumber) {
    String normalizedPhone = normalizePhone(phoneNumber);
    SmsCodeEntry existing = findEntry(normalizedPhone);
    long now = System.currentTimeMillis();
    if (existing != null && existing.expiresAtMillis() > now) {
      long elapsedSeconds = Math.max(0, (now - existing.sentAtMillis()) / 1000);
      long retryAfter = appProperties.getSms().getResendIntervalSeconds() - elapsedSeconds;
      if (retryAfter > 0) {
        throw new BusinessException(
            HttpStatus.BAD_REQUEST, "验证码发送过于频繁，请稍后再试，请" + retryAfter + "秒后再试");
      }
    }

    String code = generateNumericCode(Math.max(4, appProperties.getSms().getCodeLength()));
    long ttlSeconds = Math.max(60, appProperties.getSms().getCodeTtlSeconds());
    SmsCodeEntry entry = new SmsCodeEntry(0, code, now + ttlSeconds * 1000, now);
    redisTemplate.opsForValue().set(codeKey(normalizedPhone), entry, Duration.ofSeconds(ttlSeconds));
    return code;
  }

  /** 校验验证码，成功后立即删除，错误次数超过限制也删除。 */
  public void verifyCode(String phoneNumber, String code) {
    String normalizedPhone = normalizePhone(phoneNumber);
    String normalizedCode = code == null ? "" : code.trim();
    if (!StringUtils.hasText(normalizedCode)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "验证码不能为空");
    }
    SmsCodeEntry entry = findEntry(normalizedPhone);
    if (entry == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "验证码不存在或已失效");
    }
    long now = System.currentTimeMillis();
    if (entry.expiresAtMillis() <= now) {
      redisTemplate.delete(codeKey(normalizedPhone));
      throw new BusinessException(HttpStatus.BAD_REQUEST, "验证码已过期");
    }
    if (!entry.code().equals(normalizedCode)) {
      int attempts = entry.attempts() + 1;
      if (attempts >= appProperties.getSms().getMaxVerifyAttempts()) {
        redisTemplate.delete(codeKey(normalizedPhone));
      } else {
        redisTemplate
            .opsForValue()
            .set(
                codeKey(normalizedPhone),
                new SmsCodeEntry(attempts, entry.code(), entry.expiresAtMillis(), entry.sentAtMillis()),
                Duration.ofMillis(Math.max(1000, entry.expiresAtMillis() - now)));
      }
      throw new BusinessException(HttpStatus.BAD_REQUEST, "验证码不正确");
    }
    redisTemplate.delete(codeKey(normalizedPhone));
  }

  public long ttlSeconds() {
    return Math.max(60, appProperties.getSms().getCodeTtlSeconds());
  }

  public String normalizePhone(String phoneNumber) {
    String normalized = phoneNumber == null ? "" : phoneNumber.trim();
    if (!normalized.matches("\\d{11}")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "请输入11位手机号");
    }
    return normalized;
  }

  private SmsCodeEntry findEntry(String phoneNumber) {
    Object value = redisTemplate.opsForValue().get(codeKey(phoneNumber));
    return value instanceof SmsCodeEntry entry ? entry : null;
  }

  private String codeKey(String phoneNumber) {
    return "magic:sms-code:" + phoneNumber;
  }

  private String generateNumericCode(int length) {
    StringBuilder builder = new StringBuilder(length);
    for (int i = 0; i < length; i += 1) {
      builder.append(SECURE_RANDOM.nextInt(10));
    }
    return builder.toString();
  }
}
