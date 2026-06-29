<script setup lang="ts">
import type { Recordable } from '@vben/types';

import type { VbenFormSchema } from '@vben-core/form-ui';

import type { AuthenticationProps } from './types';

import { computed, onMounted, reactive, ref } from 'vue';
// @ts-ignore  临时忽略类型声明缺失
import { useRouter } from 'vue-router';

import { VbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { useVbenForm } from '@vben-core/form-ui';
import { preferences } from '@vben-core/preferences';
import { VbenButton, VbenCheckbox } from '@vben-core/shadcn-ui';

import Title from './auth-title.vue';

defineOptions({
  name: 'AuthenticationLogin',
});

const props = withDefaults(
  defineProps<
    AuthenticationProps & {
      formSchema: VbenFormSchema[];
    }
  >(),
  {
    agreeAndContinueText: '',
    agreementRequiredMessage: '',
    agreementRequiredTitle: '',
    agreeText: '',
    andText: '',
    cancelText: '',
    codeLoginPath: '/auth/code-login',
    closeText: '',
    forgetPasswordPath: '/auth/forget-password',
    forgetPasswordText: '',
    formSchema: () => [],
    loading: false,
    mobileLoginText: '',
    privacyPolicyText: '',
    qrCodeLoginPath: '/auth/qrcode-login',
    registerPath: '/auth/register',
    rememberMeText: '',
    serviceAgreementText: '',
    showCodeLogin: true,
    showForgetPassword: true,
    showQrcodeLogin: true,
    showRegister: true,
    showRememberMe: true,
    showThirdPartyLogin: true,
    submitButtonText: '',
    subTitle: '',
    title: '',
  },
);

const emit = defineEmits<{
  submit: [Recordable<any>];
}>();

// 常量定义
const REMEMBER_ME_KEY_PREFIX = 'REMEMBER_ME_USERNAME_';
const PRIVACY_POLICY_MODAL_MAX_HEIGHT = 'max-h-96';
const PRIVACY_POLICY_MODAL_MAX_WIDTH = 'max-w-4xl';
const POPUP_Z_INDEX_FALLBACK = 2000;
const AUTH_TIP_MODAL_Z_INDEX_OFFSET = 20;

const [Form, formApi] = useVbenForm(
  reactive({
    commonConfig: {
      hideLabel: true,
      hideRequiredMark: true,
    },
    schema: computed(() => props.formSchema),
    showDefaultActions: false,
  }),
);
const router = useRouter();

// 使用常量构建localStorage key
const REMEMBER_ME_KEY = `${REMEMBER_ME_KEY_PREFIX}${location.hostname}`;

// 响应式数据
const rememberMe = ref(false);
const agreed = ref(false);
const showAgreeError = ref(false);
const showPrivacyModal = ref(false);
const showServiceAgreementModal = ref(false);
const showAgreementRequiredModal = ref(false);

const authTipModalZIndex = computed(() => {
  if (typeof window === 'undefined') {
    return POPUP_Z_INDEX_FALLBACK + AUTH_TIP_MODAL_Z_INDEX_OFFSET;
  }
  const popupZIndex = Number.parseInt(
    window
      .getComputedStyle(document.documentElement)
      .getPropertyValue('--popup-z-index')
      .trim(),
    10,
  );
  const baseZIndex = Number.isNaN(popupZIndex)
    ? POPUP_Z_INDEX_FALLBACK
    : popupZIndex;
  return baseZIndex + AUTH_TIP_MODAL_Z_INDEX_OFFSET;
});

function localeText(key: string, fallback: string) {
  const text = $t(key);
  return text && text !== key ? text : fallback;
}

function propText(text: string | undefined, key: string, fallback: string) {
  return text || localeText(key, fallback);
}

// 计算属性：获取本地存储的用户名
const localUsername = computed(() => {
  try {
    return localStorage.getItem(REMEMBER_ME_KEY) || '';
  } catch (error) {
    console.warn('Failed to read from localStorage:', error);
    return '';
  }
});

// 计算属性：隐私政策内容
const privacyPolicyContent = computed(() => {
  return `隐私协议

一、引言

1.1 欢迎使用
感谢您选择使用东莞市宜租网络科技有限公司（以下简称"我们"或"宜租网络"）开发的园区管理软件（以下简称"本 APP"）。我们非常重视您的隐私和个人信息保护，特此制定本隐私协议（以下简称"本协议"）。

1.2 协议目的
本协议旨在向您详细说明我们如何收集、使用、存储、共享、转让和保护您的个人信息，以及您如何管理您的个人信息。

1.3 重要提示
请您在使用本 APP 前仔细阅读并充分理解本协议的全部内容，特别是以粗体或加粗标识的条款。如果您不同意本协议中的任何条款，请立即停止使用本 APP。

1.4 协议更新
我们可能根据法律法规变化或业务需要对本协议进行修订。修订后的协议将在 APP 内公示，重大变更将通过弹窗、公告等方式通知您。您继续使用本 APP 即视为同意修订后的协议。

二、信息收集

2.1 信息收集原则
我们遵循合法、正当、必要和诚信的原则收集您的个人信息，不会收集与业务功能无关的个人信息。

2.2 您主动提供的信息
我们可能收集您在使用本 APP 过程中主动提供的个人信息，包括但不限于：
（1）账号信息：姓名、性别、年龄、联系方式（如电话号码、电子邮箱地址）、账号密码等
（2）业务信息：园区信息、租户信息、合同信息、财务数据等业务相关数据
（3）反馈信息：您通过客服、反馈等功能提交的信息

2.3 设备信息
为了提供更好的服务，我们可能收集以下设备信息：
（1）设备型号、操作系统版本、设备设置
（2）唯一设备标识符（如 IMEI、Android ID、IDFA 等）
（3）IP 地址、MAC 地址
（4）应用崩溃信息、性能数据
（5）设备传感器信息：在页面适配、安全校验或系统 WebView 能力检测时，可能读取陀螺仪传感器、加速度传感器等设备传感器状态；我们不会用于识别您的精确身份，也不会用于与园区管理服务无关的目的

2.4 使用行为信息
我们可能收集您在使用本 APP 过程中的行为信息：
（1）浏览记录、搜索记录、点击记录
（2）使用时长、功能使用频率
（3）操作日志、错误日志

2.5 位置信息
经您授权，我们可能收集您的地理位置信息：
（1）GPS 位置信息
（2）基站信息
（3）WiFi 接入点信息

2.6 传感器信息
为保障移动端页面展示、设备兼容性判断和安全风控能力，本 APP 可能在必要范围内读取设备传感器信息，包括陀螺仪传感器、加速度传感器等。相关信息仅用于判断设备状态、页面交互适配、异常排查和安全校验，不会单独用于识别自然人身份。

2.7 权限调用
本 APP 可能调用以下系统权限，您可以随时在设备设置中关闭这些权限：
（1）存储权限：用于保存应用数据
（2）相机权限：用于扫描二维码、拍摄照片
（3）通知权限：用于推送重要通知
（4）网络权限：用于数据传输
（5）位置权限：用于园区定位等功能
（6）传感器相关能力：用于设备兼容性判断、页面交互适配、异常排查和安全校验
（7）安装应用权限：用于应用内版本更新时安装新版本安装包

2.8 征得授权同意的例外
根据相关法律法规，以下情形中收集您的个人信息无需征得您的授权同意：
（1）与国家安全、国防安全直接相关的
（2）与公共安全、公共卫生、重大公共利益直接相关的
（3）与犯罪侦查、起诉、审判和判决执行直接相关的
（4）出于维护个人信息主体或其他个人的生命、财产等重大合法权益但又很难得到本人同意的
（5）所收集的个人信息是您自行向社会公众公开的
（6）从合法公开披露的信息中收集个人信息的
（7）根据您的要求签订和履行合同所必需的
（8）用于维护所提供的产品或服务的安全稳定运行所必需的
（9）法律法规规定的其他情形

三、信息使用

3.1 使用目的
我们将收集的信息用于以下目的：
（1）向您提供本 APP 的各项功能和服务
（2）改进和优化我们的产品和服务
（3）向您发送重要的服务通知
（4）预防和处理欺诈、违法、违规等安全风险
（5）符合相关法律法规要求

3.2 信息使用规则
（1）我们不会向任何无关第三方提供、出售、出租、分享或交易您的个人信息
（2）我们可能使用您的个人信息向您推送相关通知，您可随时选择退订
（3）我们可能对您的信息进行去标识化或匿名化处理后用于数据分析

四、信息存储与保护

4.1 存储地点
我们在中华人民共和国境内收集和产生的个人信息，将存储在中华人民共和国境内。

4.2 存储期限
我们仅在为达成本协议所述目的所需的期限内保留您的个人信息，除非法律有强制的留存要求。具体期限如下：
（1）账号信息：账号存续期间及注销后法律规定期限内
（2）业务数据：业务关系存续期间及终止后法律规定期限内
（3）日志信息：不少于 6 个月
（4）其他信息：实现目的所需的最短时间

4.3 安全措施
我们采取以下技术和管理措施保护您的个人信息安全：
（1）数据加密传输（SSL/TLS 等）
（2）数据分类分级管理
（3）访问控制和权限管理
（4）安全审计和监控
（5）定期安全评估和漏洞修复
（6）员工安全培训和保密协议

4.4 安全事件处理
如发生个人信息安全事件，我们将：
（1）立即启动应急预案
（2）采取补救措施，防止危害扩大
（3）按照法律法规要求向主管部门报告
（4）通过推送通知、公告等方式告知您

4.5 安全提示
请您理解，互联网环境并非 100% 安全，我们建议您采取以下措施保护自己的信息安全：
（1）设置复杂密码并定期更换
（2）不向他人泄露账号密码
（3）定期清理设备缓存
（4）及时更新 APP 到最新版本

五、信息共享、转让与公开披露

5.1 共享原则
我们不会与任何公司、组织和个人共享您的个人信息，但以下情况除外：

5.2 共享情形
在以下情况下，我们可能向第三方共享您的个人信息：
（1）获得您的明确同意
（2）与我们的关联公司共享（仅限于提供服务所必需）
（3）与授权合作伙伴共享（如支付机构、云服务商、数据分析服务商等）
（4）根据法律法规规定或政府主管部门要求
（5）为履行法定义务所必需

5.3 共享限制
我们对共享个人信息的第三方进行严格审查，并与其签署保密协议，要求其：
（1）按照我们的指示和本协议要求处理个人信息
（2）采取相应的保密和安全措施
（3）不得将个人信息用于其他目的

5.4 转让
我们不会将您的个人信息转让给任何公司、组织和个人，但以下情况除外：
（1）获得您的明确同意
（2）在涉及合并、收购、资产转让等交易时，如涉及个人信息转让，我们会要求新的持有您个人信息的公司、组织继续受本协议的约束，否则我们将要求该公司、组织重新向您征求授权同意

5.5 公开披露
我们仅会在以下情况下公开披露您的个人信息：
（1）获得您的明确同意
（2）基于法律规定或合理依据
（3）根据法律法规或政府主管部门要求

六、用户权利

6.1 权利概览
根据相关法律法规，您对自己的个人信息享有以下权利：

6.2 查询权
您有权查询您的个人信息，法律法规规定的例外情况除外。您可以通过 APP 内的"个人中心"或联系客服查询。

6.3 更正权
您有权更正您的个人信息。您可以通过 APP 内的设置选项或联系客服行使该权利。

6.4 删除权
在以下情形中，您可以向我们提出删除个人信息的请求：
（1）如果我们处理个人信息的行为违反法律法规
（2）如果我们收集、使用您的个人信息，却未征得您的同意
（3）如果我们处理个人信息的行为违反了与您的约定
（4）如果您不再使用我们的产品或服务，或您注销了账号
（5）如果我们终止服务及运营

6.5 撤回同意权
您有权撤回对个人信息处理的同意。您可以通过关闭设备权限、注销账号等方式撤回同意。但请注意，撤回同意可能导致您无法继续使用本 APP 的某些功能或服务。

6.6 注销权
您有权注销您的账号。您可以通过 APP 内的"设置"或联系客服申请注销。账号注销后，我们将按照法律规定删除或匿名化处理您的个人信息。

6.7 响应时限
对于您的上述请求，我们将在 15 个工作日内作出答复。

6.8 投诉权
您认为我们违反了本协议或相关法律法规，有权向我们投诉。我们将尽快处理您的投诉，并在 15 个工作日内给予答复。

6.9 权利救济
如您对我们的处理结果不满意，您可以向网信、电信、公安及市场监管等有关部门进行投诉举报，或依法向人民法院提起诉讼。

七、未成年人保护

7.1 保护原则
我们非常重视对未成年人个人信息的保护。

7.2 儿童使用
若您是 14 周岁以下的儿童，请您在监护人的陪同下一同阅读本协议，并在征得您的监护人同意后使用我们的服务。

7.3 监护人责任
若您是未成年人的监护人，请您监督未成年人的使用行为，确保其在使用我们的服务时已征得您的同意。

7.4 信息保护
若您是未成年人的监护人，当您对您所监护的未成年人的个人信息处理存在疑问时，请通过本协议中的联系方式联系我们，我们会尽快解决问题。

八、协议变更与终止

8.1 协议变更
我们可能根据法律法规变化、业务调整或产品功能变更，对本协议进行修订。

8.2 变更通知
对于重大变更，我们将在 APP 内通过弹窗、公告等方式通知您。重大变更包括但不限于：
（1）服务模式发生重大变化
（2）个人信息共享、转让或公开披露的主要对象发生变化
（3）您参与个人信息处理方面的权利及其行使方式发生重大变化
（4）我们的联络方式和投诉渠道发生变化
（5）其他对您的权益有重大影响的变化

8.3 协议终止
您有权随时终止本协议并停止使用本 APP。您可以通过以下方式行使该权利：
（1）卸载本 APP
（2）申请注销账号
（3）停止使用本 APP 的所有功能

8.4 终止后果
协议终止后，我们将停止收集您的个人信息，并按照法律规定删除或匿名化处理已收集的个人信息，法律法规另有规定的除外。

九、适用法律与争议解决

9.1 法律适用
本协议的订立、执行、解释及争议解决均适用中华人民共和国法律（不包括港澳台地区法律）。

9.2 争议解决
如因本协议产生争议，双方应友好协商解决。协商不成的，任何一方均可向宜租网络所在地有管辖权的人民法院提起诉讼。

9.3 诉讼期间
诉讼期间，除争议事项外，双方应继续履行本协议未涉争议的其他条款。

十、联系我们

10.1 联系方式
如您对本协议有任何疑问、意见或建议，可通过以下方式联系我们：
- 公司名称：东莞市宜租网络科技有限公司
- 客服邮箱：kwzg@yizuw.com
- 联系地址：东莞市高埗镇北王路高埗段五号二号楼203室

10.2 个人信息保护负责人
我们设立了个人信息保护负责人，您可以通过上述联系方式与其取得联系。

10.3 响应时限
我们将在收到您的问题后 15 个工作日内予以回复。

十一、其他

11.1 协议完整性
本协议构成双方就个人信息保护达成的完整协议，取代先前所有的口头或书面约定。

11.2 条款可分割
本协议任何条款被认定为无效或不可执行的，不影响其他条款的效力，其他条款仍然有效并具有约束力。

11.3 标题
本协议各条款的标题仅为方便阅读而设，不影响条款的含义或解释。

11.4 语言
本协议以中文书写，其他语言的译本如与中文版本有歧义，以中文版本为准。

11.5 生效
本协议自您使用本 APP 之日起生效，并对您在本 APP 上的所有行为具有约束力。请您务必仔细阅读并充分理解本协议的全部内容。
`;
});

// 计算属性：服务协议内容
const serviceAgreementContent = computed(() => {
  return `服务协议

一、引言

1.1 欢迎使用
感谢您选择使用东莞市宜租网络科技有限公司（以下简称"宜租网络"或"我们"）开发的园区管理软件（以下简称"本服务"）。我们致力于为您提供优质的园区管理服务。

1.2 协议目的
本服务协议（以下简称"协议"）旨在明确双方的权利义务关系，保障您的合法权益，同时也规范我们的服务行为。

1.3 协议效力
请您在使用本服务前仔细阅读并充分理解本协议的全部内容。您点击"同意"按钮或开始使用本服务，即表示您已阅读、理解并同意接受本协议的约束。

二、服务定义与范围

2.1 服务定义
本服务是宜租网络基于互联网技术开发的园区管理软件系统，为用户提供园区信息化管理的整体解决方案。

2.2 服务范围
宜租网络提供的服务包括但不限于：
（1）园区基础管理：园区信息管理、入驻企业管理、房源管理、合同管理
（2）设施管理：设备管理、巡检管理、维修管理、能耗管理
（3）安全管理：门禁管理、视频监控、访客管理、应急预案
（4）财务管理：租金管理、费用收缴、账单管理、财务报表
（5）数据分析：运营数据统计、业务趋势分析、决策支持
（6）客户服务：报修处理、投诉建议、服务评价

2.3 服务调整
宜租网络可根据业务发展需要调整服务内容和范围，调整前将提前通知用户。

三、用户权利

3.1 服务使用权
用户有权按照本协议约定和账号权限范围使用本服务的全部功能。

3.2 数据所有权
用户在使用本服务过程中产生的业务数据（包括园区资料、租户信息、财务数据等）归用户所有。

3.3 数据访问权
用户有权随时访问、导出、更正自己的业务数据。

3.4 建议反馈权
用户有权对本服务的功能和服务提出建议和反馈，宜租网络应予以重视并合理采纳。

3.5 账号注销权
用户有权申请注销账号，宜租网络应在合理期限内处理，并依法删除或匿名化处理相关数据。

四、用户责任

4.1 合法使用义务
用户应遵守中华人民共和国法律法规，不得利用本服务从事任何违法活动。

4.2 信息真实性义务
用户应保证注册信息和业务数据的真实性、准确性和完整性，并及时更新变更信息。

4.3 账号安全义务
用户应妥善保管账号和密码，对账号下的一切行为负责。如发现账号异常，应立即通知宜租网络。

4.4 合理使用义务
用户不得实施以下行为：
（1）对本服务进行反向工程、反编译或试图提取源代码
（2）恶意攻击、干扰本服务的正常运行
（3）利用本服务漏洞获取不当利益
（4）未经授权访问或试图访问其他用户的数据
（5）将账号转借、出租或出售给他人使用
（6）其他损害宜租网络或其他用户合法权益的行为

4.5 配合义务
用户应配合宜租网络进行必要的系统维护、安全检查等工作。

五、宜租网络权利

5.1 服务管理权
宜租网络有权对服务进行管理和维护，确保服务的正常运行和其他用户的合法权益。

5.2 违规处理权
宜租网络有权对用户的违规行为进行处理，包括警告、限制功能、暂停服务、终止服务等。处理前应告知用户理由。

5.3 优化改进权
宜租网络有权根据技术发展和用户需求，对服务功能进行优化和升级。

5.4 信息审核权
宜租网络有权对用户发布的信息进行必要的审核。

六、宜租网络义务

6.1 服务保障义务
宜租网络应提供稳定、安全、可靠的服务，保障服务的可用性（计划维护时间除外）。

6.2 数据保护义务
宜租网络应采取合理的技术措施保护用户数据安全，防止数据泄露、丢失或被非法访问。

6.3 隐私保护义务
宜租网络应严格遵守隐私政策，保护用户个人信息，不得非法收集、使用、加工、传输用户个人信息。

6.4 告知义务
宜租网络修改本协议或变更服务内容时，应提前通过公告等方式通知用户。

6.5 技术支持义务
宜租网络应为用户提供必要的技术支持服务。

6.6 投诉处理义务
宜租网络应建立投诉处理机制，及时受理和处理用户的投诉和建议。

七、知识产权

7.1 平台知识产权
本服务中包含的软件、系统架构、算法、文字、图片、视频、商标、标识等知识产权归宜租网络所有。

7.2 用户数据权利
用户在使用本服务过程中产生的业务数据归用户所有。未经用户同意，宜租网络不得向第三方提供用户的业务数据。

7.3 授权使用
用户授予宜租网络在服务范围内合理使用其业务数据的权利，用于提供服务、优化产品等目的。

7.4 侵权处理
如发现任何侵犯宜租网络知识产权的行为，宜租网络有权依法追究侵权者的法律责任。

八、责任与免责声明

8.1 服务承诺
宜租网络致力于为用户提供稳定、安全、可靠的服务，并采取合理的技术措施保障服务的正常运行。

8.2 平台责任
宜租网络对以下情形承担责任：
（1）因宜租网络故意或重大过失导致的用户直接经济损失
（2）因宜租网络技术故障导致的用户数据丢失或损坏
（3）未经用户授权泄露用户数据造成的损失
（4）法律法规明确规定宜租网络应承担的其他责任

8.3 不可抗力
因不可抗力（包括自然灾害、政府行为、社会异常事件、基础通信线路故障、大规模网络攻击等）导致的服务中断或损失，双方互不承担违约责任，但受影响方应及时通知对方并采取措施减少损失。

8.4 服务中断
因系统维护、升级等原因需要暂停服务的，宜租网络应提前通知用户。突发技术故障导致的服务中断，宜租网络应及时修复并向用户说明情况。

8.5 用户责任
用户因故意或重大过失（包括违规操作、泄露账号密码、违反法律法规等）导致的损失，由用户自行承担。

8.6 责任限制
在法律允许且合理范围内，除本协议明确约定的情形外，宜租网络对用户使用服务过程中产生的间接损失（包括利润损失、商誉损害、业务机会丧失等）不承担赔偿责任。宜租网络的累计赔偿责任不超过用户就导致赔偿事由的服务所支付的费用总额（如有）。

九、服务变更、中断与终止

9.1 服务变更
宜租网络可根据业务发展需要调整服务内容，调整前应提前通知用户。如用户不同意变更，可申请终止服务。

9.2 服务中断
因不可抗力、系统维护等原因需要中断服务的，宜租网络应提前通知用户，并尽快恢复服务。

9.3 服务终止
有下列情形之一的，宜租网络有权终止服务：
（1）用户严重违反本协议约定，经警告后仍不改正的
（2）用户利用服务从事违法活动的
（3）法律法规规定应当终止服务的其他情形

9.4 用户注销
用户可随时申请注销账号。账号注销后，宜租网络将按照法律规定删除或匿名化处理用户数据。

十、保密条款

10.1 保密义务
双方应对在合作过程中获知的对方商业秘密、技术秘密和其他保密信息承担保密义务。

10.2 保密期限
保密义务不因本协议的终止而终止，保密期限自获知保密信息之日起至该信息进入公有领域止。

十一、争议解决

11.1 协商解决
因本协议引起的或与本协议有关的争议，双方应首先通过友好协商解决。

11.2 调解
协商不成的，双方可向相关行业协会或调解组织申请调解。

11.3 诉讼
调解不成的，任何一方均可向宜租网络所在地有管辖权的人民法院提起诉讼。

十二、法律适用

本协议的订立、执行、解释及争议解决均适用中华人民共和国法律（不包括港澳台地区法律）。

十三、协议变更

13.1 变更方式
宜租网络可根据法律法规变化和业务发展需要修改本协议。修改后的协议将在服务内公示。

13.2 重大变更
对于重大变更，宜租网络将提前通过公告、弹窗等方式通知用户。

13.3 用户权利
如用户不同意修改后的协议，可申请终止服务。用户继续使用服务，视为接受修改后的协议。

十四、其他条款

14.1 协议完整性
本协议构成双方就服务使用达成的完整协议，取代先前所有的口头或书面约定。

14.2 可分割性
本协议任何条款被认定为无效或不可执行的，不影响其他条款的效力，其他条款仍然有效。

14.3 标题
本协议各条款的标题仅为方便阅读而设，不影响条款的含义或解释。

14.4 生效
本协议自用户点击"同意"按钮或首次使用服务之日起生效，有效期至服务终止或账号注销之日止。

十五、联系我们

如您对本协议有任何疑问、意见或建议，可通过以下方式联系我们：
- 公司名称：东莞市宜租网络科技有限公司
- 客服邮箱：kwzg@yizuw.com
- 联系地址：东莞市高埗镇北王路高埗段五号二号楼203室
`;
});

async function handleSubmit() {
  try {
    if (!agreed.value) {
      showAgreementRequiredModal.value = true;
      return;
    }
    showAgreeError.value = false;

    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }

    const values = await formApi.getValues();

    // 处理记住用户名功能
    try {
      localStorage.setItem(
        REMEMBER_ME_KEY,
        rememberMe.value ? values?.username || '' : '',
      );
    } catch (error) {
      console.warn('Failed to save remember me setting:', error);
    }

    emit('submit', values);
  } catch (error) {
    console.error('Form submission error:', error);
  }
}

function handleGo(path: string) {
  if (path === props.codeLoginPath && !agreed.value) {
    showAgreementRequiredModal.value = true;
    return;
  }
  router.push(path);
}

function showPrivacyPolicy() {
  showPrivacyModal.value = true;
}

function closePrivacyModal() {
  showPrivacyModal.value = false;
}

function handleClose() {
  showPrivacyModal.value = false;
  showServiceAgreementModal.value = false;
  showAgreeError.value = false;
}

function closeAgreementRequiredModal() {
  showAgreementRequiredModal.value = false;
}

function handleAgreeAndClose() {
  agreed.value = true;
  showAgreementRequiredModal.value = false;
}

function showServiceAgreement() {
  showServiceAgreementModal.value = true;
}

function showServiceAgreementFromTip() {
  showAgreementRequiredModal.value = false;
  showServiceAgreementModal.value = true;
}

function showPrivacyPolicyFromTip() {
  showAgreementRequiredModal.value = false;
  showPrivacyModal.value = true;
}

function closeServiceAgreementModal() {
  showServiceAgreementModal.value = false;
}

onMounted(() => {
  // 初始化记住用户名功能
  const savedUsername = localUsername.value;
  if (savedUsername) {
    formApi.setFieldValue('username', savedUsername);
    rememberMe.value = true;
  }
});

defineExpose({
  getFormApi: () => formApi,
});
</script>

<template>
  <div @keydown.enter.prevent="handleSubmit">
    <slot name="title">
      <Title>
        <slot name="title">
          {{
            title ||
            `${localeText('authentication.welcomeBack', '欢迎回来')} 👋🏻`
          }}
        </slot>
        <template #desc>
          <span class="text-muted-foreground">
            <slot name="subTitle">
              {{
                subTitle ||
                localeText(
                  'authentication.loginSubtitle',
                  '请输入您的帐户信息以开始管理您的项目',
                )
              }}
            </slot>
          </span>
        </template>
      </Title>
    </slot>

    <Form />

    <div
      v-if="showRememberMe || showForgetPassword"
      class="mb-4 flex justify-between"
    >
      <VbenCheckbox
        v-if="showRememberMe"
        v-model:checked="rememberMe"
        name="rememberMe"
      >
        {{ propText(rememberMeText, 'authentication.rememberMe', '记住账号') }}
      </VbenCheckbox>

      <span
        v-if="showForgetPassword"
        class="vben-link text-sm font-normal"
        @click="handleGo(forgetPasswordPath)"
      >
        {{
          propText(
            forgetPasswordText,
            'authentication.forgetPassword',
            '忘记密码?',
          )
        }}
      </span>
    </div>

    <div class="mb-4 flex flex-col">
      <div class="flex items-center">
        <VbenCheckbox v-model:checked="agreed" name="agreed">
          <span class="text-muted-foreground text-sm font-normal">
            {{ propText(agreeText, 'authentication.agree', '我同意') }}
            <span
              class="vben-link cursor-pointer"
              @click.stop.prevent="showServiceAgreement"
            >
              《{{
                propText(
                  serviceAgreementText,
                  'authentication.serviceAgreement',
                  '服务协议',
                )
              }}》
            </span>
            {{ propText(andText, 'common.and', '和') }}
            <span
              class="vben-link cursor-pointer"
              @click.stop.prevent="showPrivacyPolicy"
            >
              《{{
                propText(
                  privacyPolicyText,
                  'authentication.privacyPolicy',
                  '隐私协议',
                )
              }}》
            </span>
          </span>
        </VbenCheckbox>
      </div>
      <div v-if="showAgreeError" class="text-destructive mt-1 text-xs">
        {{ localeText('authentication.agreeTip', '请同意隐私协议和条款') }}
      </div>
    </div>
    <div
      v-if="showCodeLogin || showQrcodeLogin"
      class="mb-2 mt-4 flex items-center justify-between"
    >
      <VbenButton
        v-if="showCodeLogin"
        class="w-full"
        variant="outline"
        @click="handleGo(codeLoginPath)"
      >
        {{
          propText(mobileLoginText, 'authentication.mobileLogin', '手机号登录')
        }}
      </VbenButton>
    </div>

    <VbenButton
      :class="{
        'cursor-wait': loading,
      }"
      :loading="loading"
      aria-label="login"
      class="w-full"
      @click="handleSubmit"
    >
      {{ submitButtonText || localeText('common.login', '登录') }}
    </VbenButton>

    <!-- 第三方登录 -->
    <!-- <slot name="third-party-login">
      <ThirdPartyLogin v-if="showThirdPartyLogin" />
    </slot>

    <slot name="to-register">
      <div v-if="showRegister" class="mt-3 text-center text-sm">
        {{ $t('authentication.accountTip') }}
        <span
          class="vben-link text-sm font-normal"
          @click="handleGo(registerPath)"
        >
          {{ $t('authentication.createAccount') }}
        </span>
      </div>
    </slot> -->

    <!-- 隐私政策弹窗 -->
    <VbenModal
      v-model:open="showPrivacyModal"
      :title="
        propText(privacyPolicyText, 'authentication.privacyPolicy', '隐私协议')
      "
      :z-index="authTipModalZIndex"
      :mobile-fullscreen="false"
      class="mobile-small-modal"
      :class="PRIVACY_POLICY_MODAL_MAX_WIDTH"
      :bordered="true"
      :centered="true"
      header-class="bg-card text-foreground px-5 py-3"
      content-class="bg-card text-foreground p-4 no-scrollbar"
      :closable="false"
      @close="closePrivacyModal"
    >
      <div class="p-4" :class="[PRIVACY_POLICY_MODAL_MAX_HEIGHT]">
        <pre
          class="text-foreground whitespace-pre-wrap text-sm leading-relaxed"
        >
          {{ privacyPolicyContent }}
        </pre>
      </div>
      <template #footer>
        <div class="flex w-full justify-end space-x-2">
          <VbenButton @click="handleClose">
            {{ propText(closeText, 'common.close', '关闭') }}
          </VbenButton>
        </div>
      </template>
    </VbenModal>

    <!-- 服务协议弹窗 -->
    <VbenModal
      v-model:open="showServiceAgreementModal"
      :title="
        propText(
          serviceAgreementText,
          'authentication.serviceAgreement',
          '服务协议',
        )
      "
      :z-index="authTipModalZIndex"
      :mobile-fullscreen="false"
      class="mobile-small-modal"
      :class="PRIVACY_POLICY_MODAL_MAX_WIDTH"
      :bordered="true"
      :centered="true"
      header-class="bg-card text-foreground px-5 py-3"
      content-class="bg-card text-foreground p-4 no-scrollbar"
      :closable="false"
      @close="closeServiceAgreementModal"
    >
      <div class="p-4" :class="[PRIVACY_POLICY_MODAL_MAX_HEIGHT]">
        <pre
          class="text-foreground whitespace-pre-wrap text-sm leading-relaxed"
        >
          {{ serviceAgreementContent }}
        </pre>
      </div>
      <template #footer>
        <div class="flex w-full justify-end space-x-2">
          <VbenButton @click="handleClose">
            {{ propText(closeText, 'common.close', '关闭') }}
          </VbenButton>
        </div>
      </template>
    </VbenModal>

    <!-- 同意协议提示弹窗 -->
    <VbenModal
      v-model:open="showAgreementRequiredModal"
      :title="
        propText(
          agreementRequiredTitle,
          'authentication.agreementRequired',
          '温馨提示',
        )
      "
      :z-index="authTipModalZIndex"
      :mobile-fullscreen="false"
      class="mobile-small-modal mobile-agreement-required-modal"
      :bordered="true"
      :centered="true"
      header-class="bg-card text-foreground px-5 py-3"
      content-class="bg-card text-foreground p-3 min-h-0 flex-none"
      :closable="false"
    >
      <div class="p-3 text-center">
        <p class="mb-3 text-sm leading-6">
          {{
            propText(
              agreementRequiredMessage,
              'authentication.agreementRequiredMessage',
              '登录前请先阅读并同意',
            )
          }}
        </p>
        <p class="mb-1 text-sm">
          <span
            class="vben-link cursor-pointer font-medium"
            @click.stop.prevent="showServiceAgreementFromTip"
          >
            《{{
              propText(
                serviceAgreementText,
                'authentication.serviceAgreement',
                '服务协议',
              )
            }}》
          </span>
          {{ propText(andText, 'common.and', '和') }}
          <span
            class="vben-link cursor-pointer font-medium"
            @click.stop.prevent="showPrivacyPolicyFromTip"
          >
            《{{
              propText(
                privacyPolicyText,
                'authentication.privacyPolicy',
                '隐私协议',
              )
            }}》
          </span>
        </p>
      </div>
      <template #footer>
        <div class="flex w-full flex-wrap justify-center gap-3">
          <VbenButton variant="outline" @click="closeAgreementRequiredModal">
            {{ propText(cancelText, 'common.cancel', '取消') }}
          </VbenButton>
          <VbenButton type="primary" @click="handleAgreeAndClose">
            {{
              propText(
                agreeAndContinueText,
                'authentication.agreeAndContinue',
                '同意并继续',
              )
            }}
          </VbenButton>
        </div>
      </template>
    </VbenModal>

    <!-- ICP 备案信息 -->
    <div
      v-if="preferences.copyright.enable && preferences.copyright.icp"
      class="mt-8 flex flex-col items-center justify-center pb-6 text-xs text-gray-400"
    >
      <a
        :href="preferences.copyright.icpLink || 'https://beian.miit.gov.cn/'"
        class="hover:text-primary mb-1 text-gray-400 no-underline"
        target="_blank"
      >
        {{ preferences.copyright.icp }}
      </a>
      <div>
        Copyright © {{ preferences.copyright.date }}
        {{ preferences.copyright.companyName }}
      </div>
    </div>
  </div>
</template>

<style>
@media (max-width: 768px) {
  .mobile-small-modal {
    width: 90vw !important;
    max-width: 400px !important;
    height: auto !important;
    max-height: calc(
      100dvh - env(safe-area-inset-top, 0) - env(safe-area-inset-bottom, 0) -
        24px
    ) !important;
    color: hsl(var(--card-foreground));
    background-color: hsl(var(--card));
    border: 1px solid hsl(var(--border));
    border-radius: var(--radius);
    box-shadow: 0 8px 24px rgb(0 0 0 / 8%);
  }

  .mobile-small-modal .ant-modal-content,
  .mobile-small-modal [data-slot='content'] {
    padding: 12px !important;
  }

  .mobile-small-modal .ant-modal-header,
  .mobile-small-modal [data-slot='header'] {
    padding: 12px 16px !important;
    font-size: 16px !important;
  }

  .mobile-small-modal .ant-modal-body,
  .mobile-small-modal [data-slot='body'] {
    padding: 16px !important;
    font-size: 14px !important;
  }

  .mobile-small-modal .ant-modal-footer,
  .mobile-small-modal [data-slot='footer'] {
    padding: 12px 16px !important;
  }

  .mobile-small-modal button {
    min-height: 40px !important;
    padding: 8px 16px !important;
    font-size: 14px !important;
  }

  .mobile-agreement-required-modal {
    width: calc(
      100vw - env(safe-area-inset-left, 0) - env(safe-area-inset-right, 0) -
        40px
    ) !important;
    max-width: 420px !important;
    height: auto !important;
    max-height: calc(
      100dvh - env(safe-area-inset-top, 0) - env(safe-area-inset-bottom, 0) -
        56px
    ) !important;
  }

  .mobile-agreement-required-modal .ant-modal-content,
  .mobile-agreement-required-modal [data-slot='content'] {
    max-height: inherit !important;
    overflow: hidden !important;
  }

  .mobile-agreement-required-modal .ant-modal-body,
  .mobile-agreement-required-modal [data-slot='body'] {
    padding: 12px !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch;
  }

  .mobile-agreement-required-modal .ant-modal-header,
  .mobile-agreement-required-modal [data-slot='header'] {
    padding: 10px 14px !important;
    font-size: 15px !important;
  }

  .mobile-agreement-required-modal .ant-modal-footer,
  .mobile-agreement-required-modal [data-slot='footer'] {
    padding: 10px 12px !important;
  }

  .mobile-agreement-required-modal button {
    min-height: 36px !important;
    padding: 6px 12px !important;
    font-size: 13px !important;
  }
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
</style>
