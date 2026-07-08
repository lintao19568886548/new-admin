package cn.yizuw.magic.backend.investment;

/** 招商雷达触达任务回执请求；只记录本地回复并按规则推进线索阶段。 */
public record OutreachTaskReplyRequest(String replyContent, String replyStatus) {}
