export interface SmartServicePresetReply {
  answer: string;
  category: string;
  id: string;
  keywords: string[];
  question: string;
}

const presetReplies: SmartServicePresetReply[] = [
  {
    answer: `您好，您可以在登录页面点击“忘记密码”，通过绑定的手机号验证后重置密码。

如果手机号已更换，请联系我们人工客服 18028231766，核实身份后协助处理。`,
    category: '账号与登录',
    id: 'Q1',
    keywords: ['忘记密码', '找回密码', '重置密码', '密码忘了', '登录密码'],
    question: '忘记密码怎么办？',
  },
  {
    answer: `您好，账号锁定通常是由于多次输入错误密码导致。系统会在15分钟后自动解锁。

如需紧急使用，可联系园区主管理员重置密码，或联系人工客服协助处理。`,
    category: '账号与登录',
    id: 'Q2',
    keywords: ['账号被锁定', '账户被锁定', '账号锁定', '登录锁定', '15分钟'],
    question: '账号被锁定了怎么办？',
  },
  {
    answer: `您好，一个账号同一时间仅支持一台设备登录。

如需多人使用，建议为员工单独开通账号，费用为 300元/个/月，不限使用人数。`,
    category: '账号与登录',
    id: 'Q3',
    keywords: [
      '一个账号多人',
      '多人同时使用',
      '多设备登录',
      '一台设备登录',
      '员工账号',
    ],
    question: '一个账号可以多人同时使用吗？',
  },
  {
    answer: `您好，房源录入方式如下：

1. 进入后台 → “系统管理” → “园区管理” → 点击新增园区
2. 填写面积、楼层、租金、配套设施等信息
3. 保存即可。`,
    category: '功能使用',
    id: 'Q4',
    keywords: ['录入房源', '新增房源', '房源信息', '新增园区', '园区管理'],
    question: '如何录入房源信息？',
  },
  {
    answer: `您好，系统每月1号会自动生成租金、物业费、水电费账单。

也可手动生成：

1. 进入“财务管理”→“账单管理”
2. 点击“手动生成账单”
3. 选择租户、费用类型及账期
4. 点击“生成并推送”

⚠️ 水电费需先录入表计读数，系统自动计算金额。`,
    category: '功能使用',
    id: 'Q5',
    keywords: [
      '生成租户账单',
      '生成账单',
      '手动生成账单',
      '租金账单',
      '物业费账单',
      '水电费账单',
    ],
    question: '如何生成租户账单？',
  },
  {
    answer: `您好，请先确认：

1. 租户是否已安装瞰维智管APP或关注公众号
2. 手机号是否正确录入系统

若仍未收到，请检查APP消息通知是否开启，或联系人工客服处理。`,
    category: '功能使用',
    id: 'Q6',
    keywords: [
      '租户收不到账单',
      '收不到账单',
      '账单没收到',
      '账单通知',
      '消息通知',
    ],
    question: '租户收不到账单怎么办？',
  },
  {
    answer: `您好，您可以在手机端点击“待租厂房”查看当前空置房源信息。`,
    category: '功能使用',
    id: 'Q7',
    keywords: ['查看空置房源', '空置房源', '待租厂房', '查厂房', '厂房查询'],
    question: '如何查看空置房源？',
  },
  {
    answer: `您好，目前支持微信支付在线缴费。

租户可在APP内直接支付，系统自动销账，无需人工确认。

如需对公转账，可在后台录入线下收款记录。`,
    category: '功能使用',
    id: 'Q8',
    keywords: ['支付方式', '微信支付', '在线缴费', '对公转账', '线下收款'],
    question: '系统支持哪些支付方式？',
  },
  {
    answer: `您好，进入“总览”模块即可查看：

1. 收入总览（租金/物业费/水电费）
2. 支出统计
3. 收缴率分析
4. 空置率与收入分析

支持导出Excel用于汇报或审计。`,
    category: '功能使用',
    id: 'Q9',
    keywords: ['收支报表', '收入总览', '支出统计', '收缴率', '导出Excel'],
    question: '如何查看收支报表？',
  },
  {
    answer: `您好，支持两种方式：

1. 方式一：网关对接（推荐）
安装智能网关，通过RS485读取电表数据，实现实时上传与远程控制。

2. 方式二：API对接
对接电表厂商云平台API（如安科瑞、林洋等）。

两种方式均支持远程抄表、预警及断电控制。`,
    category: '水电表管理',
    id: 'Q10',
    keywords: [
      '智能水电表',
      '水电表对接',
      '网关对接',
      'RS485',
      'API对接',
      '远程抄表',
    ],
    question: '智能水电表如何对接？',
  },
  {
    answer: `您好，可以的。对接后系统可同步：

1. 当前余额
2. 用电量
3. 累计用量
4. 设备状态

租户可在APP实时查看余额及预警信息。`,
    category: '水电表管理',
    id: 'Q11',
    keywords: ['预付费电表', '电表数据同步', '当前余额', '用电量', '累计用量'],
    question: '预付费电表数据能同步吗？',
  },
  {
    answer: `您好，请检查：

1. 电表编号是否绑定正确
2. 读数时间范围是否正确
3. 网关通信是否正常

如仍异常，请联系人工客服协助排查。`,
    category: '水电表管理',
    id: 'Q12',
    keywords: [
      '水电读数不一致',
      '读数不一致',
      '电表编号',
      '读数异常',
      '网关通信',
    ],
    question: '水电读数不一致怎么办？',
  },
  {
    answer: `您好，需满足已接入智能电表系统。

操作路径：

1. 进入“水电管理”
2. 选择电表
3. 点击“远程拉闸”

系统将在10秒内执行断电，缴费后自动恢复供电。`,
    category: '水电表管理',
    id: 'Q13',
    keywords: ['远程断电', '远程拉闸', '断电控制', '拉闸', '恢复供电'],
    question: '如何远程断电？',
  },
  {
    answer: `您好，租户端发起报修的方式如下：

1. 打开【瞰维智管APP】，点击首页“报修”
2. 选择报修类型（如电路、水暖、设备等），填写问题描述
3. 拍照上传现场情况
4. 点击提交，系统会自动派单给对应维修人员

物业端也可以代租户发起工单：

1. 进入“物业管理”→“工单管理”
2. 点击“新增工单”即可创建报修工单

提交后系统会自动流转，无需人工分配。`,
    category: '工单（报修）管理',
    id: 'Q14/Q24',
    keywords: [
      '发起报修工单',
      '报修工单',
      '我要报修',
      '新增工单',
      '工单管理',
      'q14',
      'q24',
    ],
    question: '如何发起报修工单？',
  },
  {
    answer: `您好，您可以在【瞰维智管APP】中查看工单进度：

进入“我的工单”，即可看到所有报修记录，状态说明如下：

1. 待接单：工单已提交，等待维修人员接单
2. 处理中：维修人员已接单，正在处理问题
3. 待验收：维修已完成，等待您确认结果
4. 已完成：您已确认完成，工单正式闭环

点击任意工单，可查看详细信息，包括维修人员联系方式、处理过程及上传照片记录。`,
    category: '工单（报修）管理',
    id: 'Q15/Q25',
    keywords: [
      '查看工单进度',
      '工单进度',
      '我的工单',
      '待接单',
      '处理中',
      '待验收',
      'q15',
      'q25',
    ],
    question: '如何查看工单进度？',
  },
  {
    answer: `您好，支持两种方式：

1. 方式一：手动录入
合同管理 → 新增合同 → 填写信息并上传PDF

2. 方式二：批量导入
下载模板 → 填写Excel → 批量上传

系统会自动关联房源并启动到期提醒。`,
    category: '合同与租赁',
    id: 'Q16',
    keywords: [
      '录入租赁合同',
      '新增合同',
      '合同管理',
      '上传PDF',
      '批量导入合同',
    ],
    question: '如何录入租赁合同？',
  },
  {
    answer: `您好，系统会自动三重提醒：

1. 90天：黄色预警
2. 60天：系统通知
3. 30天：重点提醒

可提前安排续签或招商。`,
    category: '合同与租赁',
    id: 'Q17',
    keywords: ['合同到期', '到期提醒', '续签', '招商', '黄色预警'],
    question: '合同到期怎么办？',
  },
  {
    answer: `您好，支持15天免费试用，包含全部核心功能。

试用期间无需付费，不绑定银行卡。

到期后可选择继续使用或导出数据。`,
    category: '试用与收费',
    id: 'Q18',
    keywords: ['免费试用', '15天', '试用期', '无需付费', '导出数据'],
    question: '可以免费试用吗？',
  },
  {
    answer: `您好，支持按月付费，随用随停，无违约金。

年付更优惠（9800元/年）。`,
    category: '试用与收费',
    id: 'Q19',
    keywords: ['按月付费', '月付', '随用随停', '年付', '9800'],
    question: '可以按月付费吗？',
  },
  {
    answer: `您好，支持的。瞰维智管提供多端协同使用：

1. PC网页版：适合办公室操作，数据录入、报表导出、批量处理更高效
2. 手机APP：适合外出使用，可查看租控图、处理工单、审批报销等
3. 微信小程序：租户端使用，支持缴费、报修、查合同等功能

所有端数据实时同步，您在任何设备上的操作都会立即更新到其他端。`,
    category: '系统使用',
    id: 'Q20/Q26',
    keywords: [
      '手机和电脑',
      '多端同步',
      'PC端',
      '手机APP',
      '微信小程序',
      'q20',
      'q26',
    ],
    question: '支持手机和电脑同时使用吗？',
  },
  {
    answer: `您好，瞰维智管支持财务公开功能：

1. 系统可自动生成“村集体资产运营公示页面”，包含资产清单、租金收入、合同情况等信息
2. 页面生成后自动生成二维码，村民扫码即可查看，无需登录
3. 公示数据不可篡改，满足审计及监管要求
4. 支持“区-镇-村”三级监管权限，上级单位可统一查看下级数据

目前已有多个村委工业园在使用该功能，如需可安排专人演示。`,
    category: '系统使用',
    id: 'Q21/Q27',
    keywords: [
      '村集体资产',
      '财务公开',
      '公开给村民',
      '公示页面',
      '三级监管',
      'q21',
      'q27',
    ],
    question: '村集体资产财务可以公开给村民看吗？',
  },
  {
    answer: `您好，可以的。瞰维智管企业版支持功能定制开发：

1. 可根据您的特殊流程或报表需求进行评估开发
2. 定制功能仅作用于您的园区，不影响标准版系统
3. 收费按开发人天计算，我们会先提供方案与报价，确认后再开发
4. 若需求具备通用性，经评估后可能纳入标准版本升级

您的需求也可能优化到整个产品体系中。`,
    category: '系统使用',
    id: 'Q22/Q28',
    keywords: [
      '定制功能',
      '定制开发',
      '企业版',
      '特殊流程',
      '报表需求',
      'q22',
      'q28',
    ],
    question: '系统可以根据需求定制功能吗？',
  },
  {
    answer: `您好，支持：

1. Windows / Mac
2. Android / iOS
3. 微信小程序`,
    category: '其他',
    id: 'Q23',
    keywords: ['支持什么设备', '支持设备', 'Windows', 'Mac', 'Android', 'iOS'],
    question: '系统支持什么设备？',
  },
];

function normalizeText(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replaceAll(/[\s"'“”‘’、，。？！?：:；;（）()[\]【】<>《》]/g, '');
}

function scorePresetReply(question: string, item: SmartServicePresetReply) {
  const normalizedQuestion = normalizeText(question);
  const normalizedTitle = normalizeText(item.question);
  let score = 0;

  if (!normalizedQuestion) {
    return 0;
  }

  if (
    normalizedQuestion === normalizedTitle ||
    normalizedQuestion.includes(normalizedTitle)
  ) {
    score += 100;
  }

  if (normalizedQuestion.includes(normalizeText(item.id))) {
    score += 90;
  }

  for (const keyword of item.keywords) {
    const normalizedKeyword = normalizeText(keyword);
    if (!normalizedKeyword || !normalizedQuestion.includes(normalizedKeyword)) {
      continue;
    }
    score += Math.max(normalizedKeyword.length, 4);
  }

  return score;
}

export function findSmartServicePresetReply(question: string) {
  let bestMatch: null | SmartServicePresetReply = null;
  let bestScore = 0;

  for (const item of presetReplies) {
    const score = scorePresetReply(question, item);
    if (score > bestScore) {
      bestMatch = item;
      bestScore = score;
    }
  }

  return bestScore >= 4 ? bestMatch : null;
}

export { presetReplies as smartServicePresetReplies };
