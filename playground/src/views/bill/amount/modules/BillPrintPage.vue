<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import dayjs from 'dayjs'; // 添加 dayjs 导入

import { getAmountBillDetail } from '#/api/bill';

// 组件属性定义
const billData = ref();
const route = useRoute();
const query = ref(route.query);
const gestureStageRef = ref<HTMLElement>();
const billContainerRef = ref<HTMLElement>();
const enableGesture = ref(false);
const scale = ref(1);
const translateX = ref(0);
const translateY = ref(0);
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const panStartPoint = ref<null | { x: number; y: number }>(null);
const panStartTranslate = ref({ x: 0, y: 0 });
const pinchStartDistance = ref(0);
const pinchStartScale = ref(1);
const pinchStartTranslate = ref({ x: 0, y: 0 });
const pinchAnchor = ref({ x: 0, y: 0 });

const billTransformStyle = computed(() => {
  if (!enableGesture.value) {
    return {};
  }
  return {
    transform: `translate3d(${translateX.value}px, ${translateY.value}px, 0) scale(${scale.value})`,
    transformOrigin: '0 0',
  };
});

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampTranslate(nextX: number, nextY: number, nextScale = scale.value) {
  const stage = gestureStageRef.value;
  const bill = billContainerRef.value;
  if (!stage || !bill) {
    return { x: nextX, y: nextY };
  }

  const stageWidth = stage.clientWidth;
  const stageHeight = stage.clientHeight;
  const scaledWidth = bill.offsetWidth * nextScale;
  const scaledHeight = bill.offsetHeight * nextScale;

  let x = nextX;
  let y = nextY;

  x =
    scaledWidth <= stageWidth
      ? (stageWidth - scaledWidth) / 2
      : clampValue(x, stageWidth - scaledWidth, 0);

  y =
    scaledHeight <= stageHeight
      ? (stageHeight - scaledHeight) / 2
      : clampValue(y, stageHeight - scaledHeight, 0);

  return { x, y };
}

function getTouchDistance(touches: TouchList) {
  const touchA = touches.item(0);
  const touchB = touches.item(1);
  if (!touchA || !touchB) return 0;
  const dx = touchA.clientX - touchB.clientX;
  const dy = touchA.clientY - touchB.clientY;
  return Math.hypot(dx, dy);
}

function getTouchMidpoint(touches: TouchList) {
  const touchA = touches.item(0);
  const touchB = touches.item(1);
  if (!touchA || !touchB) return { x: 0, y: 0 };
  return {
    x: (touchA.clientX + touchB.clientX) / 2,
    y: (touchA.clientY + touchB.clientY) / 2,
  };
}

function initMobileTransform() {
  if (!enableGesture.value) return;
  const stage = gestureStageRef.value;
  const bill = billContainerRef.value;
  if (!stage || !bill) return;

  const fitScale = stage.clientWidth / bill.offsetWidth;
  scale.value = clampValue(fitScale, MIN_SCALE, 1);
  const initialX = (stage.clientWidth - bill.offsetWidth * scale.value) / 2;
  const clamped = clampTranslate(initialX, 0, scale.value);
  translateX.value = clamped.x;
  translateY.value = clamped.y;
}

function updateGestureMode() {
  enableGesture.value = window.matchMedia('(max-width: 1024px)').matches;
  if (!enableGesture.value) {
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    return;
  }
  nextTick(() => {
    initMobileTransform();
  });
}

function onTouchStart(event: TouchEvent) {
  if (!enableGesture.value) return;

  if (event.touches.length === 2) {
    pinchStartDistance.value = getTouchDistance(event.touches);
    pinchStartScale.value = scale.value;
    pinchStartTranslate.value = {
      x: translateX.value,
      y: translateY.value,
    };
    pinchAnchor.value = getTouchMidpoint(event.touches);
    panStartPoint.value = null;
    return;
  }

  if (event.touches.length === 1) {
    const touch = event.touches.item(0);
    if (!touch) return;
    panStartPoint.value = {
      x: touch.clientX,
      y: touch.clientY,
    };
    panStartTranslate.value = {
      x: translateX.value,
      y: translateY.value,
    };
  }
}

function onTouchMove(event: TouchEvent) {
  if (!enableGesture.value) return;

  if (event.touches.length === 2 && pinchStartDistance.value > 0) {
    const currentDistance = getTouchDistance(event.touches);
    const rawScale =
      pinchStartScale.value * (currentDistance / pinchStartDistance.value);
    const nextScale = clampValue(rawScale, MIN_SCALE, MAX_SCALE);

    const contentX =
      (pinchAnchor.value.x - pinchStartTranslate.value.x) /
      pinchStartScale.value;
    const contentY =
      (pinchAnchor.value.y - pinchStartTranslate.value.y) /
      pinchStartScale.value;

    const nextX = pinchAnchor.value.x - contentX * nextScale;
    const nextY = pinchAnchor.value.y - contentY * nextScale;
    const clamped = clampTranslate(nextX, nextY, nextScale);

    scale.value = nextScale;
    translateX.value = clamped.x;
    translateY.value = clamped.y;
    return;
  }

  if (event.touches.length === 1 && panStartPoint.value) {
    const touch = event.touches.item(0);
    if (!touch) return;
    const deltaX = touch.clientX - panStartPoint.value.x;
    const deltaY = touch.clientY - panStartPoint.value.y;
    const nextX = panStartTranslate.value.x + deltaX;
    const nextY = panStartTranslate.value.y + deltaY;
    const clamped = clampTranslate(nextX, nextY);
    translateX.value = clamped.x;
    translateY.value = clamped.y;
  }
}

function onTouchEnd(event: TouchEvent) {
  if (!enableGesture.value) return;

  if (event.touches.length === 1) {
    const touch = event.touches.item(0);
    if (!touch) return;
    panStartPoint.value = {
      x: touch.clientX,
      y: touch.clientY,
    };
    panStartTranslate.value = {
      x: translateX.value,
      y: translateY.value,
    };
    pinchStartDistance.value = 0;
    return;
  }

  if (event.touches.length === 0) {
    panStartPoint.value = null;
    pinchStartDistance.value = 0;
  }
}

// 计算费用合计项目
const feeItems = computed(() => {
  if (billData.value?.extraProjectItem) {
    try {
      const parsed = JSON.parse(billData.value.extraProjectItem);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.error('解析 extraProjectItem 失败', error);
    }
  }
  // 回退逻辑
  const items = [
    { itemName: '电费', value: billData.value?.eleFee },
    { itemName: '水费', value: billData.value?.waterFee },
    { itemName: '厂房租金', value: billData.value?.factoryRent },
    { itemName: '基本管理费', value: billData.value?.managementFee },
    { itemName: '服务费', value: billData.value?.serviceFee },
    { itemName: '开票税金', value: billData.value?.invoiceTax },
    { itemName: '滞纳金', value: billData.value?.penaltyFee },
    { itemName: '本月收费金额', value: billData.value?.totalFee },
  ];
  return items;
});

function shouldDisplaySummaryItem(item: { itemName?: string; value?: any }) {
  const isPenalty = String(item.itemName || '').includes('滞纳金');
  if (isPenalty) {
    return Number(item.value) !== 0;
  }
  return true;
}

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
  updateGestureMode();
  window.addEventListener('resize', updateGestureMode);

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

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateGestureMode);
});
</script>

<template>
  <div
    ref="gestureStageRef"
    class="h-screen w-screen touch-none overflow-hidden bg-[#f5f5f5] lg:h-auto lg:w-full lg:touch-auto lg:overflow-visible lg:bg-transparent"
    @touchstart="onTouchStart"
    @touchmove.prevent="onTouchMove"
    @touchend="onTouchEnd"
    @touchcancel="onTouchEnd"
  >
    <div
      ref="billContainerRef"
      class="min-h-[297mm] w-[210mm] bg-white px-[10mm] will-change-transform lg:mx-auto lg:will-change-auto"
      :style="billTransformStyle"
    >
      <div class="mb-[5px]">
        <div class="mb-[5px] text-center text-[22px] font-bold">收款通知单</div>
        <div class="mb-[3px] text-left text-[18px] font-bold">
          TO：{{ billData?.tenant?.tenantName || billData?.tenantName }}
        </div>
      </div>

      <div>
        <div class="w-full border border-black">
          <div class="flex">
            <div class="w-32 border-r border-black p-[6px] text-center">
              项目
            </div>
            <div class="flex-1 p-[6px] text-center">
              {{ billData?.projectName }}
            </div>
          </div>
        </div>

        <div class="my-[2px] ml-5 text-sm">电费（度）</div>

        <div class="w-full border border-black">
          <div
            class="flex [&>*:last-child]:border-r-0 [&>*]:flex [&>*]:min-h-10 [&>*]:flex-1 [&>*]:items-center [&>*]:justify-center [&>*]:border-r [&>*]:border-black [&>*]:px-[3px] [&>*]:py-[5px] [&>*]:text-center [&>*]:text-xs [&>*]:leading-[1.2]"
          >
            <div class="!w-32 !flex-none">名称</div>
            <div>上月<br />电表数</div>
            <div>本月<br />抄表数</div>
            <div>本月际<br />度数</div>
            <div>倍数</div>
            <div>本月实<br />际度数</div>
            <div>单价<br />元/度</div>
            <div>电费金额<br />（元）</div>
            <div>备注</div>
          </div>

          <div
            :key="item.eleId"
            v-for="item in billData?.eleBills"
            class="flex border-t border-black [&>*:last-child]:border-r-0 [&>*]:flex-1 [&>*]:border-r [&>*]:border-black [&>*]:p-[5px] [&>*]:text-center [&>*]:text-xs"
          >
            <div class="!w-32 !flex-none">{{ item.meterName }}</div>
            <div>
              {{
                !['合计', '公共'].some((name) => item.meterName.includes(name))
                  ? item.previousReading
                  : ''
              }}
            </div>
            <div>
              {{
                !['合计', '公共'].some((name) => item.meterName.includes(name))
                  ? item.currentReading
                  : ''
              }}
            </div>
            <div>{{ item.meterName !== '合计' ? item.monthlyUsage : '' }}</div>
            <div>
              {{ Number(item.multiplier) === 1 ? '' : item.multiplier }}
            </div>
            <div>{{ item.totalUsage }}</div>
            <div>{{ Number(item.unitPrice) === 0 ? '' : item.unitPrice }}</div>
            <div>{{ item.amount }}</div>
            <div>{{ item.remark }}</div>
          </div>
        </div>

        <div class="my-[2px] ml-5 text-sm">水费（方）</div>

        <div class="w-full border border-black">
          <div
            class="flex [&>*:last-child]:border-r-0 [&>*]:flex [&>*]:min-h-10 [&>*]:flex-1 [&>*]:items-center [&>*]:justify-center [&>*]:border-r [&>*]:border-black [&>*]:px-[3px] [&>*]:py-[5px] [&>*]:text-center [&>*]:text-xs [&>*]:leading-[1.2]"
          >
            <div class="!w-32 !flex-none">名称</div>
            <div>上月<br />水表数</div>
            <div>本月<br />抄表数</div>
            <div>本月<br />用水量</div>
            <div>倍数</div>
            <div>总用量</div>
            <div>单价<br />元/m²</div>
            <div>水费金额<br />（元）</div>
            <div>备注</div>
          </div>

          <div
            :key="item.waterId"
            v-for="item in billData?.waterBills"
            class="flex border-t border-black [&>*:last-child]:border-r-0 [&>*]:flex-1 [&>*]:border-r [&>*]:border-black [&>*]:p-[5px] [&>*]:text-center [&>*]:text-xs"
          >
            <div class="!w-32 !flex-none">{{ item.meterName }}</div>
            <div>
              {{
                !['合计', '公共', '公摊'].some((name) =>
                  item.meterName.includes(name),
                )
                  ? item.previousReading
                  : ''
              }}
            </div>
            <div>
              {{
                !['合计', '公共', '公摊'].some((name) =>
                  item.meterName.includes(name),
                )
                  ? item.currentReading
                  : ''
              }}
            </div>
            <div>{{ item.meterName !== '合计' ? item.monthlyUsage : '' }}</div>
            <div></div>
            <div>{{ item.totalUsage }}</div>
            <div>{{ Number(item.unitPrice) === 0 ? '' : item.unitPrice }}</div>
            <div>{{ item.amount }}</div>
            <div>{{ item.remark }}</div>
          </div>
        </div>

        <div class="my-[2px] ml-5 text-sm">项目合计</div>

        <div class="mb-[10px] w-full border border-black">
          <template :key="item.itemName" v-for="(item, index) in feeItems">
            <div
              class="flex border-black"
              :class="index === 0 ? 'border-t-0' : 'border-t'"
              v-if="shouldDisplaySummaryItem(item)"
            >
              <div
                class="w-[200px] border-r border-black py-[5px] pl-5 text-center text-xs"
              >
                {{ item.itemName }}
              </div>
              <div class="flex-1 p-[5px] text-center text-xs">
                {{ item.value }}
              </div>
            </div>
          </template>
        </div>

        <div class="text-[13px] leading-[1.5]">
          <div>
            <p class="m-0 indent-[2em]">
              以上款项烦请贵公司核对，请于{{ cutoffMonthDisplay }}月{{
                paymentDeadlineDate
              }}日之前把各项费用以现金或转账方式存入账户，
              并请将转账凭证截屏发送或传真至我公司财务部或园区负责人。
            </p>
          </div>
          <div class="my-[3px]">
            <div>
              <div
                class="flex flex-wrap justify-end gap-x-10 gap-y-0"
                v-if="
                  query.accountType?.includes('public') &&
                  publicAccount &&
                  Object.keys(publicAccount).length > 0
                "
              >
                <div class="basis-[calc(50%-20px)]">
                  对公户名：{{ publicAccount.name }}
                </div>
                <div class="basis-[calc(50%-20px)]">
                  对公账号：{{ publicAccount.number }}
                </div>
                <div class="basis-full">开户行：{{ publicAccount.bank }}</div>
              </div>
              <div
                class="flex flex-wrap justify-end gap-x-10 gap-y-0"
                v-if="
                  query.accountType?.includes('private') &&
                  privateAccount &&
                  Object.keys(privateAccount).length > 0
                "
              >
                <div class="basis-[calc(50%-20px)]">
                  对私户名：{{ privateAccount.name }}
                </div>
                <div class="basis-[calc(50%-20px)]">
                  对私账号：{{ privateAccount.number }}
                </div>
                <div class="basis-full">开户行：{{ privateAccount.bank }}</div>
              </div>

              <div class="text-[#333]">
                温馨提示：如贵司不能在规定时间内将款项交至我公司，我公司从{{
                  lateFeeStartFullDate.monthStr
                }}月{{ lateFeeStartFullDate.day }}日起按日收取 总金额{{
                  billData?.penaltyRate
                }}‰ 每天的滞纳金，并将按合同规定在{{ cutoffMonthDisplay }}月{{
                  formattedCutoffDate
                }}停止对贵公司的供水、
                供电，直至缴清所有款项及滞纳金后再回复供水、供电。谢谢合作！
              </div>
              <div class="mt-[3px] flex justify-between">
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
    </div>
  </div>
</template>
