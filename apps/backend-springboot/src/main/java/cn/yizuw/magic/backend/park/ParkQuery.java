package cn.yizuw.magic.backend.park;

public record ParkQuery(String address, String area, Integer currentPage, Integer pageSize, String parkName) {}
