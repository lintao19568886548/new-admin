<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'; // 添加 computed
import { useRoute } from 'vue-router';

import dayjs from 'dayjs'; // 添加 dayjs 导入

import { getAmountBillDetail } from '#/api/bill';

// 组件属性定义
const billData = ref();
const route = useRoute();
const query = ref(route.query);

// 格式化停水停电日期
const formattedCutoffDate = computed(() => {
  if (!query.value.cutoffDate) return '';

  try {
    const date = dayjs(query.value.cutoffDate as string);
    return `${date.date()}日${date.hour()}时`;
  } catch (error) {
    console.error('日期格式化错误:', error);
    return query.value.cutoffDate as string;
  }
});

// 新增计算属性
const paymentDeadlineDate = computed(() => {
  if (!query.value.cutoffDate) return '5'; // Fallback to original day
  try {
    return dayjs(query.value.cutoffDate as string).date();
  } catch (error) {
    console.error('Error parsing cutoffDate for paymentDeadlineDate:', error);
    return '5'; // Fallback
  }
});

const lateFeeStartFullDate = computed(() => {
  const fallback = { day: '6', monthStr: '本' }; // Fallback to original
  if (!query.value.cutoffDate || !query.value.billingDate) {
    return fallback;
  }

  try {
    const lateFeeDate = dayjs(query.value.cutoffDate as string).add(1, 'day');
    const billing = dayjs(query.value.billingDate as string);
    let monthDisplay;

    if (lateFeeDate.isSame(billing, 'month')) {
      monthDisplay = '本';
    } else if (lateFeeDate.isSame(billing.add(1, 'month'), 'month')) {
      monthDisplay = '次';
    } else {
      monthDisplay = lateFeeDate.format('YYYY年M');
    }
    return { day: lateFeeDate.date(), monthStr: monthDisplay };
  } catch (error) {
    console.error('Error parsing dates for lateFeeStartFullDate:', error);
    return fallback;
  }
});

const cutoffMonthDisplay = computed(() => {
  const fallback = '本'; // Fallback to original '本'
  if (!query.value.cutoffDate || !query.value.billingDate) {
    return fallback;
  }

  try {
    const cutoff = dayjs(query.value.cutoffDate as string);
    const billing = dayjs(query.value.billingDate as string);

    if (cutoff.isSame(billing, 'month')) {
      return '本';
    } else if (cutoff.isSame(billing.add(1, 'month'), 'month')) {
      return '次';
    } else {
      return cutoff.format('YYYY年M');
    }
  } catch (error) {
    console.error('Error parsing dates for cutoffMonthDisplay:', error);
    return fallback;
  }
});

const publicAccount = ref<Record<string, any>>();
const privateAccount = ref<Record<string, any>>();

onMounted(async () => {
  // 从路径参数中获取 id
  const billId = route.params.id ? Number(route.params.id) : undefined;
  if (billId) {
    billData.value = await getAmountBillDetail(billId);
    if (billData.value?.publicBankAccount) {
      publicAccount.value = JSON.parse(billData.value.publicBankAccount);
    }
    if (billData.value?.privateBankAccount) {
      privateAccount.value = JSON.parse(billData.value.privateBankAccount);
    }
    await nextTick();
    setTimeout(() => {
      // window.print();
    }, 800);
  } else {
    console.error('未提供账单ID');
    // 可以添加错误处理逻辑，例如显示错误消息或重定向
  }
});
</script>

<template>
  <div class="bill-print-container">
    <div class="bill-header">
      <div class="bill-title">收款通知单</div>
      <div class="bill-recipient">TO：{{ billData?.tenant.tenantName }}</div>
    </div>
    <div class="bill-content">
      <div class="project-table">
        <div class="project-row">
          <div class="project-cell project-label">项目</div>
          <div class="project-cell project-value">
            {{ billData?.projectName }}
          </div>
        </div>
      </div>

      <!-- 电费表格 -->
      <div class="bill-section-title">电费（度）</div>

      <div class="electricity-table">
        <div class="table-header">
          <div class="th name-column">名称</div>
          <div class="th">上月<br />电表数</div>
          <div class="th">本月<br />抄表数</div>
          <div class="th">本月际<br />度数</div>
          <div class="th">倍数</div>
          <div class="th">本月实<br />际度数</div>
          <div class="th">单价<br />元/度</div>
          <div class="th">电费金额<br />（元）</div>
          <div class="th">备注</div>
        </div>
        <!-- 这里可以添加表格数据行 -->
        <div
          :key="item.eleId"
          v-for="item in billData?.eleBills"
          class="table-row"
        >
          <div class="td name-column">{{ item.meterName }}</div>
          <div class="td">
            {{
              !['合计', '公共'].some((name) => item.meterName.includes(name))
                ? item.previousReading
                : ''
            }}
          </div>
          <div class="td">
            {{
              !['合计', '公共'].some((name) => item.meterName.includes(name))
                ? item.currentReading
                : ''
            }}
          </div>
          <div class="td">
            {{ item.meterName !== '合计' ? item.monthlyUsage : '' }}
          </div>
          <div class="td">
            {{ Number(item.multiplier) === 1 ? '' : item.multiplier }}
          </div>
          <div class="td">{{ item.totalUsage }}</div>
          <div class="td">
            {{ Number(item.unitPrice) === 0 ? '' : item.unitPrice }}
          </div>
          <div class="td">{{ item.amount }}</div>
          <div class="td">{{ item.remark }}</div>
        </div>
      </div>

      <!-- 水费表格 -->
      <div class="bill-section-title">水费（方）</div>

      <div class="electricity-table">
        <div class="table-header">
          <div class="th name-column">名称</div>
          <div class="th">上月<br />水表数</div>
          <div class="th">本月<br />抄表数</div>
          <div class="th">本月<br />用水量</div>
          <div class="th">倍数</div>
          <div class="th">总用量</div>
          <div class="th">单价<br />元/m²</div>
          <div class="th">水费金额<br />（元）</div>
          <div class="th">备注</div>
        </div>
        <!-- 这里可以添加表格数据行 -->
        <div
          :key="item.waterId"
          v-for="item in billData?.waterBills"
          class="table-row"
        >
          <div class="td name-column">{{ item.meterName }}</div>
          <div class="td">
            {{
              !['合计', '公共', '公摊'].some((name) =>
                item.meterName.includes(name),
              )
                ? item.previousReading
                : ''
            }}
          </div>
          <div class="td">
            {{
              !['合计', '公共', '公摊'].some((name) =>
                item.meterName.includes(name),
              )
                ? item.currentReading
                : ''
            }}
          </div>
          <div class="td">
            {{ item.meterName !== '合计' ? item.monthlyUsage : '' }}
          </div>
          <div class="td"></div>
          <div class="td">{{ item.totalUsage }}</div>
          <div class="td">
            {{ Number(item.unitPrice) === 0 ? '' : item.unitPrice }}
          </div>
          <div class="td">{{ item.amount }}</div>
          <div class="td">{{ item.remark }}</div>
        </div>
      </div>

      <!-- 项目合计表格 -->
      <div class="bill-section-title">项目合计</div>

      <div class="summary-table">
        <div class="summary-row">
          <div class="summary-cell summary-label">电费</div>
          <div class="summary-cell summary-value">{{ billData?.eleFee }}</div>
        </div>
        <div class="summary-row">
          <div class="summary-cell summary-label">水费</div>
          <div class="summary-cell summary-value">{{ billData?.waterFee }}</div>
        </div>
        <div class="summary-row">
          <div class="summary-cell summary-label">厂房租金</div>
          <div class="summary-cell summary-value">
            {{ billData?.factoryRent }}
          </div>
        </div>
        <div class="summary-row">
          <div class="summary-cell summary-label">基本管理费</div>
          <div class="summary-cell summary-value">
            {{ billData?.managementFee }}
          </div>
        </div>
        <div class="summary-row" v-if="Number(billData?.serviceFee) !== 0">
          <div class="summary-cell summary-label">服务费</div>
          <div class="summary-cell summary-value">
            {{ billData?.serviceFee }}
          </div>
        </div>
        <div class="summary-row" v-if="Number(billData?.garbageFee) !== 0">
          <div class="summary-cell summary-label">垃圾处理费</div>
          <div class="summary-cell summary-value">
            {{ billData?.garbageFee }}
          </div>
        </div>
        <div class="summary-row" v-if="Number(billData?.invoiceTax) !== 0">
          <div class="summary-cell summary-label">开票税金</div>
          <div class="summary-cell summary-value">
            {{ billData?.invoiceTax }}
          </div>
        </div>
        <div class="summary-row" v-if="Number(billData?.penaltyFee) !== 0">
          <div class="summary-cell summary-label">滞纳金</div>
          <div class="summary-cell summary-value">
            {{ billData?.penaltyFee }}
          </div>
        </div>
        <div class="summary-row">
          <div class="summary-cell summary-label">本月收费金额</div>
          <div class="summary-cell summary-value">{{ billData?.totalFee }}</div>
        </div>
      </div>

      <!-- 底部区域 -->
      <div class="bill-footer">
        <div class="payment-notice">
          <p>
            以上款项烦请贵公司核对，请于{{ cutoffMonthDisplay }}月{{
              paymentDeadlineDate
            }}日之前把各项费用以现金或转账方式存入账户，
            并请将转账凭证截屏发送或传真至我公司财务部或园区负责人。
          </p>
        </div>
        <div class="account-info">
          <div
            class="bank-info"
            v-if="
              query.accountType?.includes('public') &&
              publicAccount &&
              Object.keys(publicAccount).length > 0
            "
          >
            <div>对公户名：{{ publicAccount.name }}</div>
            <div>对公账号：{{ publicAccount.number }}</div>
            <div>开户行：{{ publicAccount.bank }}</div>
          </div>
          <div
            class="bank-info"
            v-if="
              query.accountType?.includes('private') &&
              privateAccount &&
              Object.keys(privateAccount).length > 0
            "
          >
            <div>对私户名：{{ privateAccount.name }}</div>
            <div>对私账号：{{ privateAccount.number }}</div>
            <div>开户行：{{ privateAccount.bank }}</div>
          </div>

          <div class="warning-info">
            温馨提示：如贵司不能在规定时间内将款项交至我公司，我公司从{{
              lateFeeStartFullDate.monthStr
            }}月{{ lateFeeStartFullDate.day }}日起按日收取 总金额{{
              billData?.penaltyRate
            }}‰ 每天的滞纳金，并将按合同规定在{{ cutoffMonthDisplay }}月{{
              formattedCutoffDate
            }}停止对贵公司的供水、
            供电，直至缴清所有款项及滞纳金后再回复供水、供电。谢谢合作！
          </div>
          <div class="contact-info">
            <span>园区负责人： {{ billData?.park.manager }}</span>
            <div>
              <span class="ml-20">制单日期：</span>
              <span>{{ query.billingDate }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.bill-print-container {
  width: 210mm;
  min-height: 297mm;
  padding: 0 10mm; /* 减小顶部内边距 */
  margin: 0 auto;
  background-color: white;
  // box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

.bill-header {
  margin-bottom: 5px; /* 添加整体头部区域的下边距 */

  .bill-title {
    text-align: center;
    font-size: 22px; /* 稍微减小标题字体 */
    font-weight: bold;
    margin-bottom: 5px; /* 减小标题下边距 */
  }

  .bill-recipient {
    text-align: left;
    font-weight: bold;
    font-size: 18px; /* 减小收件人字体 */
    margin-bottom: 3px; /* 减小收件人下边距 */
  }
}

.bill-content {
  .bill-section-title {
    margin: 2px 0 2px 20px;
    font-size: 14px;
  }

  .project-table {
    width: 100%;
    border: 1px solid #000000;

    .project-row {
      display: flex;

      .project-cell {
        padding: 6px;
        text-align: center;

        &.project-label {
          width: 128px;
          border-right: 1px solid #000000;
        }

        &.project-value {
          flex: 1;
        }
      }
    }
  }

  .electricity-table {
    width: 100%;
    border: 1px solid #000000;

    .table-header {
      display: flex;

      .th {
        flex: 1;
        padding: 5px 3px;
        border-right: 1px solid #000000;
        text-align: center;
        line-height: 1.2;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 40px;
        font-size: 12px;

        &:last-child {
          border-right: none;
        }

        &.name-column {
          width: 128px;
          flex: none;
        }
      }
    }

    .table-row {
      display: flex;
      border-top: 1px solid #000000;

      .td {
        flex: 1;
        padding: 5px;
        border-right: 1px solid #000000;
        text-align: center;
        font-size: 12px;

        &:last-child {
          border-right: none;
        }

        &.name-column {
          width: 128px;
          flex: none;
        }
      }
    }
  }

  .summary-table {
    width: 100%;
    border: 1px solid #000000;
    margin-bottom: 10px;

    .summary-row {
      display: flex;
      border-top: 1px solid #000000;

      &:first-child {
        border-top: none;
      }

      .summary-cell {
        padding: 5px;
        text-align: center;
        font-size: 12px;

        &.summary-label {
          width: 200px;
          border-right: 1px solid #000000;
          text-align: center;
          padding-left: 20px;
        }

        &.summary-value {
          flex: 1;
        }
      }
    }
  }

  .bill-footer {
    font-size: 13px;
    line-height: 1.5;

    .payment-notice {
      p {
        margin: 0;
        text-indent: 2em;
      }
    }

    .account-info {
      margin: 3px 0;
      .bank-info {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 0px 40px;

        > div {
          flex: 0 0 calc(50% - 20px);

          &:last-child {
            flex: 0 0 100%;
          }
        }
      }
    }

    .warning-info {
      // text-indent: 2em;
      color: #333;
    }

    .contact-info {
      margin-top: 3px;
      display: flex;
      justify-content: space-between;
    }
  }
}
</style>
