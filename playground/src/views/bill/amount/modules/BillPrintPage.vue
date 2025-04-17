<script setup lang="ts">
import type { AmountBill } from '../data';

import { nextTick, onMounted, ref } from 'vue'; // 导入 nextTick
import { useRoute } from 'vue-router';

import { getAmountBillDetail } from '#/api/bill';

// 组件属性定义
const billData = ref<AmountBill>();
const route = useRoute();

onMounted(async () => {
  // 从路径参数中获取 id
  const billId = route.params.id ? Number(route.params.id) : undefined;
  if (billId) {
    billData.value = await getAmountBillDetail(billId);
    await nextTick();
    setTimeout(() => {
      window.print();
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
      <div class="bill-recipient">TO：{{ billData?.tenantName }}</div>
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
            {{ Number(item.previousReading) === 0 ? '' : item.previousReading }}
          </div>
          <div class="td">
            {{ Number(item.currentReading) === 0 ? '' : item.currentReading }}
          </div>
          <div class="td">
            {{ Number(item.monthlyUsage) === 0 ? '' : item.monthlyUsage }}
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
            {{ Number(item.previousReading) === 0 ? '' : item.previousReading }}
          </div>
          <div class="td">
            {{ Number(item.currentReading) === 0 ? '' : item.currentReading }}
          </div>
          <div class="td">
            {{ Number(item.monthlyUsage) === 0 ? '' : item.monthlyUsage }}
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
        <div class="summary-row">
          <div class="summary-cell summary-label">服务费</div>
          <div class="summary-cell summary-value">
            {{ billData?.serviceFee }}
          </div>
        </div>
        <div class="summary-row">
          <div class="summary-cell summary-label">开票税金</div>
          <div class="summary-cell summary-value">
            {{ billData?.invoiceTax }}
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
            以上款项烦请贵公司核对，请于本月5日之前把各项费用以现金或转账方式存入账户，
            并请将转账凭证截屏发送或传真至我公司财务部或园区负责人。
          </p>
        </div>
        <div class="account-info">
          <div class="bank-info">
            <div>对公户名：xxxxx有限公司</div>
            <div>对公账号：xxxxxxxx</div>
            <div>开户行：xxxxx</div>
          </div>

          <div class="warning-info">
            温馨提示：如贵司不能在规定时间内将款项交至我公司，我公司从本月6日起按日收取
            总金额10%每天的滞纳金，并将按合同规定在本月8月18时停止对贵公司的供水、
            供电，直至缴清所有款项及滞纳金后再回复供水、供电。谢谢合作！
          </div>
          <div class="contact-info">
            <span>园区负责人： 13712341234（刘先生）</span>
            <div>
              <span class="ml-20">制单日期：</span>
              <span>2025年2月28日</span>
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
