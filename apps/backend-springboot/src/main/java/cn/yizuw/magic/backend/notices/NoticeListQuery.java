package cn.yizuw.magic.backend.notices;

/** 公告列表查询参数，来源于旧 `/api/notices/list`。 */
public record NoticeListQuery(
    int currentPage, String keyword, int pageSize, String regionCode, boolean validOnly) {}
