package cn.yizuw.magic.backend.common;

import java.util.List;

public record PageResult<T>(List<T> items, long total, Integer currentPage, Integer pageSize) {}
