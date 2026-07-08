package cn.yizuw.magic.backend.auth;

/** Redis 中保存的短信验证码状态，包含过期时间、发送时间和错误尝试次数。 */
public record SmsCodeEntry(int attempts, String code, long expiresAtMillis, long sentAtMillis) {}
