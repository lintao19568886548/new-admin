package cn.yizuw.magic.backend.llm;

/** 智谱 Chat 请求；apikey 仅用于旧接口兼容接收，Spring Boot 迁移期不会透传或记录。 */
public record ChatZhipuRequest(String apikey, String message, String model) {}
