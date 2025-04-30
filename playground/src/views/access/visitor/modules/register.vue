<script lang="ts" setup>
import type { Park } from '#/components/AreaSelector.vue';

import { onMounted, reactive, ref } from 'vue';

import { message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { createVisitor } from '#/api/access/visitor';
import { getVisitorParkList } from '#/api/park';

// 表单数据
const formData = reactive({
  carNum: '',
  parkId: 1,
  phoneNumber: '',
  registerTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  remark: '',
  status: '进入',
  visitorName: '',
});

// 园区列表
const parkList = ref<Park[]>([]);

// 获取园区列表
async function fetchParkList() {
  try {
    const result = await getVisitorParkList({ area: 'all' });
    parkList.value = result || [];
  } catch (error) {
    console.error('获取园区列表失败:', error);
    message.error('获取园区列表失败');
  }
}

// 在组件挂载时获取园区列表
onMounted(() => {
  fetchParkList();
  document.title = '访客登记';
});

// 删除或注释掉未使用的 rules 变量
// const rules = {
//   phoneNumber: [
//     { message: '请输入手机号', required: true, trigger: 'blur' },
//     {
//       message: '请输入正确的手机号码',
//       pattern: /^1[3-9]\d{9}$/,
//       trigger: 'blur',
//     },
//   ],
//   status: [{ message: '请选择访问状态', required: true, trigger: 'change' }],
//   visitorName: [
//     { message: '请输入姓名', required: true, trigger: 'blur' },
//     { max: 20, message: '姓名长度应为2-20个字符', min: 2, trigger: 'blur' },
//   ],
// };

// 提交状态
const submitting = ref(false);
// 提交结果消息
const resultMessage = ref('');
// 提交结果类型（success/error）
const resultType = ref('');
// 是否显示结果消息
const showResult = ref(false);

// 提交表单
async function handleSubmit() {
  // 表单验证
  if (!formData.visitorName) {
    showMessage('请输入姓名', 'error');
    return;
  }

  if (!formData.phoneNumber || !/^1[3-9]\d{9}$/.test(formData.phoneNumber)) {
    showMessage('请输入正确的手机号码', 'error');
    return;
  }

  if (!formData.status) {
    showMessage('请选择访问状态', 'error');
    return;
  }

  submitting.value = true;

  // 准备提交数据
  const submitData = { ...formData } as { [key: string]: any };

  // 处理状态值，将字符串转换为数字
  const statusMap = {
    离开: 1,
    进入: 0,
  };
  submitData.status =
    statusMap[submitData.status as keyof typeof statusMap] ?? submitData.status;

  try {
    await createVisitor(submitData);
    showMessage('访客登记成功', 'success');
    resetForm();
  } catch (error) {
    console.error('提交错误:', error);
    showMessage('提交失败，请检查网络连接', 'error');
  } finally {
    submitting.value = false;
  }
}

// 重置表单
function resetForm() {
  formData.visitorName = '';
  formData.phoneNumber = '';
  formData.carNum = '';
  formData.remark = '';
  formData.status = '进入';
  formData.registerTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
}

// 显示消息
function showMessage(text: string, type: string) {
  resultMessage.value = text;
  resultType.value = type;
  showResult.value = true;

  // 3秒后自动关闭消息
  setTimeout(() => {
    showResult.value = false;
  }, 3000);
}

// 关闭消息
function closeMessage() {
  showResult.value = false;
}
</script>

<template>
  <div class="container">
    <h2>访客登记表</h2>
    <form @submit.prevent="handleSubmit" id="visitorForm">
      <div class="form-group">
        <label for="name">姓名：</label>
        <input
          type="text"
          id="name"
          v-model="formData.visitorName"
          required
          autocomplete="name"
        />
      </div>

      <div class="form-group">
        <label for="reason">来访原因：</label>
        <input type="text" id="reason" v-model="formData.remark" required />
      </div>

      <!-- <div class="form-group">
        <label for="status">访问状态：</label>
        <select id="status" v-model="formData.status" required>
          <option value="">请选择</option>
          <option value="离开">离开</option>
          <option value="进入">进入</option>
        </select>
      </div> -->

      <div class="form-group">
        <label for="parkId">园区：</label>
        <select id="parkId" v-model="formData.parkId" required>
          <option
            v-for="park in parkList"
            :key="park.parkId"
            :value="park.parkId"
          >
            {{ park.parkName }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label for="plate">车牌号：</label>
        <input
          type="text"
          id="plate"
          v-model="formData.carNum"
          placeholder="例：京A12345"
        />
      </div>

      <div class="form-group">
        <label for="phone">手机号：</label>
        <input
          type="tel"
          id="phone"
          v-model="formData.phoneNumber"
          pattern="[0-9]{11}"
          required
          inputmode="numeric"
          autocomplete="tel"
        />
      </div>

      <button type="submit" :disabled="submitting">
        {{ submitting ? '提交中...' : '提交登记' }}
      </button>
    </form>

    <!-- 结果消息模态框 -->
    <div class="modal-overlay" v-if="showResult">
      <div class="modal-content">
        <div class="message" :class="resultType">
          {{ resultMessage }}
        </div>
        <button @click="closeMessage" :class="resultType">关闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 480px) {
  .container {
    padding: 20px;
    border-radius: 12px;
  }

  h2 {
    margin-bottom: 25px;
    font-size: 1.6rem;
  }

  input,
  select,
  button {
    padding: 12px;
    font-size: 16px;
  }

  .form-group {
    margin-bottom: 20px;
  }
}

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

.container {
  max-width: 600px;
  padding: 30px;
  margin: 0 auto;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgb(0 0 0 / 10%);
  animation: fade-in 0.5s ease-out;
}

h2 {
  position: relative;
  padding-bottom: 10px;
  margin-bottom: 30px;
  font-size: 2rem;
  color: #2c3e50;
  text-align: center;
}

h2::after {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 60px;
  height: 3px;
  content: '';
  background: linear-gradient(90deg, #4caf50, #45a049);
  border-radius: 2px;
  transform: translateX(-50%);
}

.form-group {
  margin-bottom: 25px;
}

label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.95rem;
  font-weight: 500;
  color: #2c3e50;
}

input,
select {
  width: 100%;
  padding: 12px 15px;
  font-size: 16px;
  background-color: #f8f9fa;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  transition: all 0.3s ease;
}

input:focus,
select:focus {
  background-color: #fff;
  border-color: #4caf50;
  outline: none;
  box-shadow: 0 0 0 3px rgb(76 175 80 / 20%);
}

input::placeholder {
  color: #adb5bd;
}

button {
  position: relative;
  width: 100%;
  padding: 14px;
  overflow: hidden;
  font-size: 16px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  background: linear-gradient(45deg, #4caf50, #45a049);
  border: none;
  border-radius: 8px;
  transition: all 0.3s ease;
}

button:hover {
  box-shadow: 0 5px 15px rgb(76 175 80 / 30%);
  transform: translateY(-2px);
}

button:active {
  transform: translateY(0);
}

button:disabled {
  cursor: not-allowed;
  background: #ccc;
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: rgb(0 0 0 / 50%);
}

.modal-content {
  position: relative;
  width: 90%;
  max-width: 400px;
  padding: 20px;
  background-color: #fff;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgb(0 0 0 / 20%);
}

.message {
  margin-bottom: 15px;
  font-size: 16px;
  text-align: center;
}

.message.success {
  color: #4caf50;
}

.message.error {
  color: #f44;
}

.modal-content button {
  display: block;
  width: auto;
  padding: 8px 16px;
  margin: 0 auto;
  color: white;
  cursor: pointer;
  border: none;
  border-radius: 4px;
}

.modal-content button.success {
  background-color: #4caf50;
}

.modal-content button.error {
  background-color: #f44;
}
</style>
