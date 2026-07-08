package cn.yizuw.magic.backend.auth;

/** 短信验证码登录请求，兼容旧 Nitro `/api/auth/code-login.post.ts`。 */
public record AuthCodeLoginRequest(String code, String phoneNumber) {}
