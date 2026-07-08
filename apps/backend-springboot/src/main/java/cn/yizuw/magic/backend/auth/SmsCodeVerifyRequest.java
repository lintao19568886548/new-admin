package cn.yizuw.magic.backend.auth;

/** 页面访问验证码校验请求。 */
public record SmsCodeVerifyRequest(String code) {}
