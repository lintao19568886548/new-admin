interface AuthenticationProps {
  /**
   * @zh_CN 协议连接词
   */
  andText?: string;

  /**
   * @zh_CN 已阅读并同意文案
   */
  agreeText?: string;

  /**
   * @zh_CN 同意并继续按钮文案
   */
  agreeAndContinueText?: string;

  /**
   * @zh_CN 未勾选协议提示内容
   */
  agreementRequiredMessage?: string;

  /**
   * @zh_CN 未勾选协议提示标题
   */
  agreementRequiredTitle?: string;

  /**
   * @zh_CN 验证码登录路径
   */
  codeLoginPath?: string;
  /**
   * @zh_CN 取消按钮文案
   */
  cancelText?: string;
  /**
   * @zh_CN 关闭按钮文案
   */
  closeText?: string;
  /**
   * @zh_CN 忘记密码路径
   */
  forgetPasswordPath?: string;
  /**
   * @zh_CN 忘记密码文案
   */
  forgetPasswordText?: string;

  /**
   * @zh_CN 是否处于加载处理状态
   */
  loading?: boolean;
  /**
   * @zh_CN 手机号登录文案
   */
  mobileLoginText?: string;

  /**
   * @zh_CN 隐私协议文案
   */
  privacyPolicyText?: string;

  /**
   * @zh_CN 二维码登录路径
   */
  qrCodeLoginPath?: string;

  /**
   * @zh_CN 注册路径
   */
  registerPath?: string;
  /**
   * @zh_CN 记住账号文案
   */
  rememberMeText?: string;

  /**
   * @zh_CN 服务协议文案
   */
  serviceAgreementText?: string;

  /**
   * @zh_CN 是否显示验证码登录
   */
  showCodeLogin?: boolean;
  /**
   * @zh_CN 是否显示忘记密码
   */
  showForgetPassword?: boolean;

  /**
   * @zh_CN 是否显示二维码登录
   */
  showQrcodeLogin?: boolean;

  /**
   * @zh_CN 是否显示注册按钮
   */
  showRegister?: boolean;

  /**
   * @zh_CN 是否显示记住账号
   */
  showRememberMe?: boolean;

  /**
   * @zh_CN 是否显示第三方登录
   */
  showThirdPartyLogin?: boolean;

  /**
   * @zh_CN 登录框子标题
   */
  subTitle?: string;

  /**
   * @zh_CN 登录框标题
   */
  title?: string;
  /**
   * @zh_CN 提交按钮文本
   */
  submitButtonText?: string;
}

export type { AuthenticationProps };
