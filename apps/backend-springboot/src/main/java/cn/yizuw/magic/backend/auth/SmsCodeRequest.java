package cn.yizuw.magic.backend.auth;

/** 手机号验证码发送请求，兼容旧 Nitro 的宽松入参。 */
public record SmsCodeRequest(String phoneNumber) {}
