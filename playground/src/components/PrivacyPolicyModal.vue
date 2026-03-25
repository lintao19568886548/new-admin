<!-- eslint-disable prettier/prettier -->
<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import { App as CapacitorApp } from '@capacitor/app';
import { Button, Modal } from 'ant-design-vue';

defineOptions({ name: 'PrivacyPolicyModal' });

const PRIVACY_POLICY_AGREED_KEY = 'PRIVACY_POLICY_AGREED_V1';
const isVisible = ref(false);
const showPrivacyContentModal = ref(false);
const showServiceContentModal = ref(false);

const privacyPolicyContent = `隐私协议

一、引言
感谢您选择使用我们的APP（以下简称“本APP”）。我们非常重视您的隐私和个人信息保护，特此制定本隐私协议（以下简称“本协议”），以向您说明我们如何收集、使用、存储和保护您的个人信息。 请您在使用本APP前仔细阅读本协议，理解并同意我们的个人信息处理规则后再进行使用。如果您不同意本协议中的任何条款，请立即停止使用本APP。
二、信息收集
我们可能收集您在使用本APP过程中主动提供的个人信息，包括但不限于姓名、性别、年龄、生日、联系方式（如电话号码、电子邮箱地址）、地址、账号密码、设备信息（如设备型号、操作系统版本、IP地址、MAC地址等）、位置信息（如通过GPS、蓝牙等获取的位置信息）、浏览记录、搜索记录、交易记录等。 我们可能通过自动化手段收集您的设备信息、使用行为信息、日志信息等。 我们可能获取您的设备ID，用于调整页面兼容性，提供更好的使用体验。 我们可能获取您的ANDROID ID，用于消息的定向推送。
三、信息存储与保护
我们将采取必要的技术和管理措施，确保您的个人信息在收集、传输、存储和使用过程中的安全性。 我们将按照法律法规要求，对您的个人信息进行匿名化或去标识化处理，以降低信息泄露风险。 我们将定期对个人信息存储系统进行安全审计，及时发现并修复潜在的安全漏洞。
四、信息披露与共享
除非得到您的明确同意，或根据法律法规要求，我们不会向第三方披露您的个人信息。 在以下情况下，我们可能向第三方共享您的个人信息： 与我们合作的第三方服务提供商，为向您提供服务而必须访问您的个人信息； 在法律法规要求或政府主管部门要求的情况下，向相关部门提供您的个人信息； 在涉及合并、收购、资产转让等交易时，向交易对方披露您的个人信息。
五、用户权利
您有权查询、更正、删除您的个人信息。您可以通过APP内的设置选项或联系我们的客服部门行使上述权利。 您有权撤回对个人信息处理的同意。但请注意，撤回同意可能导致您无法继续使用本APP的某些功能或服务。 您有权投诉。如果您认为我们违反了本协议或相关法律法规，您有权向我们投诉。我们将尽快处理您的投诉，并告知您处理结果。
六、协议变更与终止
我们可能根据法律法规变化或业务需要，对本协议进行修订。修订后的协议将在APP内公示，您继续使用本APP即视为同意修订后的协议。 您有权随时终止本协议并停止使用本APP。您可以通过卸载APP或联系我们的客服部门行使该权利。
七、适用法律与争议解决
本协议的订立、执行和解释以及争议的解决均应适用中华人民共和国法律。 如因本协议产生争议，双方应友好协商解决。协商不成的，任何一方均有权向本APP运营者所在地有管辖权的人民法院提起诉讼。
八、开发者信息
东莞市宜租网络有限有限公司
九、其他
本协议自您使用本APP之日起生效，并对您在本APP上的所有行为具有约束力。本隐私政策于2026年3月25日正式发布并生效。请您务必仔细阅读并理解本协议的全部内容。
`;

const serviceAgreementContent = `服务协议

1. 引言

本服务协议（以下简称“协议”）是东莞市宜租网络科技有限公司（以下简称“宜租网络”或“我们”）与您之间就您使用园区管理软件服务（以下简称“服务”）所达成的协议。请您仔细阅读本协议的全部内容，特别是关于免责条款、知识产权和争议解决等重要条款。

2. 定义

“服务”指宜租网络提供的园区管理软件及相关服务。
“用户”指使用服务的个人或单位。
“园区”指用户管理的园区。
3. 服务内容

宜租网络提供以下服务：

园区基础管理功能，如园区信息管理、用户管理、设施管理、安全监控等。
数据分析服务，如用户行为分析、设施使用情况分析等。
客户支持服务，包括在线帮助、电话支持等。
4. 用户责任

用户应遵守国家法律法规和本协议的约定。
用户应对其使用服务的行为负责，并保证其信息的真实性、准确性和完整性。
用户不得利用服务从事任何违法活动。
5. 宜租网络的权利

宜租网络有权随时修改、暂停或终止服务。
宜租网络有权对用户的使用行为进行监控和记录。
宜租网络有权根据法律法规和本协议的约定，对用户的违规行为进行处理。
6. 知识产权

服务中包含的软件、文字、图片、视频等知识产权归宜租网络所有。
用户不得未经授权复制、传播、修改或使用服务中的知识产权。
7. 免责条款

宜租网络不对服务的可用性、准确性、安全性等做出任何保证。
宜租网络不对因服务中断、延迟、错误等给用户造成的损失承担责任。
用户使用服务时，应自行承担风险。
8. 争议解决

因本协议引起的争议，双方应友好协商解决；协商不成的，任何一方均可向宜租网络所在地人民法院提起诉讼。

9. 法律适用

本协议受中国法律管辖。

10. 生效日期

本服务协议自用户点击“同意”按钮或使用服务之日起生效。

11. 其他

本协议的标题仅为方便阅读，不具有法律效力。
本协议的任何条款无效，不影响其他条款的效力。`;

function checkPrivacyAgreement() {
  const agreed = localStorage.getItem(PRIVACY_POLICY_AGREED_KEY);
  if (!agreed) {
    isVisible.value = true;
  }
}

function handleAgree() {
  localStorage.setItem(PRIVACY_POLICY_AGREED_KEY, 'true');
  isVisible.value = false;
}

async function handleDisagree() {
  try {
    await CapacitorApp.exitApp();
  } catch {
    // Fallback for web or if exitApp fails
    window.location.href = 'about:blank';
  }
}

function openPrivacyPolicy() {
  showPrivacyContentModal.value = true;
}

function openServiceAgreement() {
  showServiceContentModal.value = true;
}

onMounted(() => {
  checkPrivacyAgreement();
});
</script>

<template>
  <div>
    <!-- Main Privacy Policy Modal -->
    <Modal
      v-model:open="isVisible"
      title="隐私政策"
      :closable="false"
      :mask-closable="false"
      :keyboard="false"
      :footer="null"
      centered
      width="320px"
      class="privacy-policy-modal"
    >
      <div class="privacy-content">
        <p class="mb-4 text-sm leading-relaxed text-gray-600">
          本应用尊重并保护所有用户的个人隐私权。为了给您提供更准确、更有个性化的服务，本应用会按照隐私政策的规定使用和披露您的个人信息。可阅读
          <span
            class="text-primary cursor-pointer"
            @click="openServiceAgreement"
          >
            《服务协议》
          </span>

          和
          <span class="text-primary cursor-pointer" @click="openPrivacyPolicy">
          </span>
          《隐私政策》
          <span class="text-primary cursor-pointer" @click="openPrivacyPolicy">
            《隐私政策》
          </span>
        </p>
        <div class="flex flex-col gap-3">
          <Button
            type="primary"
            block
            @click="handleAgree"
            class="h-10 text-base"
          >
            同意
          </Button>
          <Button
            block
            @click="handleDisagree"
            class="h-10 text-base text-gray-500"
          >
            不同意并退出APP
          </Button>
        </div>
      </div>
    </Modal>

    <!-- Detailed Privacy Policy Content Modal -->
    <Modal
      v-model:open="showPrivacyContentModal"
      title="隐私政策"
      :footer="null"
      centered
      width="600px"
      class="policy-content-modal"
    >
      <div class="max-h-[60vh] overflow-y-auto p-4">
        <pre class="whitespace-pre-wrap text-sm leading-relaxed">{{
          privacyPolicyContent
        }}</pre>
      </div>
      <div class="mt-4 text-center">
        <Button type="primary" @click="showPrivacyContentModal = false">
          确定
        </Button>
      </div>
    </Modal>

    <!-- Detailed Service Agreement Content Modal -->
    <Modal
      v-model:open="showServiceContentModal"
      title="服务协议"
      :footer="null"
      centered
      width="600px"
      class="policy-content-modal"
    >
      <div class="max-h-[60vh] overflow-y-auto p-4">
        <pre class="whitespace-pre-wrap text-sm leading-relaxed">{{
          serviceAgreementContent
        }}</pre>
      </div>
      <div class="mt-4 text-center">
        <Button type="primary" @click="showServiceContentModal = false">
          确定
        </Button>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.privacy-policy-modal :deep(.ant-modal-content) {
  overflow: hidden;
  border-radius: 12px;
}

.privacy-content {
  text-align: left;
}
</style>
