const officeLocations = [
  {
    lat: 23.099_596_024_527_226,
    lng: 113.769_574_897_051_29,
    name: '总部办公室',
    radius: 100,
  },
  {
    lat: 23.107_344,
    lng: 113.573_356,
    name: '广州新塘园区夏埔二',
    radius: 100,
  },
  {
    lat: 23.033_413_470_702_452,
    lng: 114.142_578_383_666_77,
    name: '桥头十一宏威',
    radius: 100,
  },
  {
    lat: 23.121_099,
    lng: 113.751_778,
    name: '东莞同兴园区',
    radius: 100,
  },
  {
    lat: 22.936_352_751_584_29,
    lng: 113.149_505_685_088_98,
    name: '佛山乐从园区',
    radius: 100,
  },
  {
    lat: 23.107_068_675_711_43,
    lng: 113.587_792_446_653_94,
    name: '广州西州二园区',
    radius: 100,
  },
  {
    lat: 23.105_772,
    lng: 113.592_908,
    name: '广州园区（西州一）',
    radius: 100,
  },
  {
    lat: 22.880_809,
    lng: 113.014_824,
    name: '佛山九江园区',
    radius: 130,
  },
  {
    lat: 23.105_563,
    lng: 113.592_559,
    name: '广州园区',
    radius: 100,
  },
  {
    lat: 23.112_274,
    lng: 113.590_177,
    name: '广州十一兄弟实业',
    radius: 100,
  },
  {
    lat: 22.769_621,
    lng: 114.377_519,
    name: '深圳坪山23园区',
    radius: 100,
  },
  {
    lat: 23.183_788,
    lng: 113.696_806,
    name: '广州荔新',
    radius: 120,
  },
];

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  return useResponseSuccess(officeLocations);
});
