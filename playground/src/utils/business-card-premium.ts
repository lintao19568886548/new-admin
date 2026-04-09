import type { Product, Transaction } from '@capgo/native-purchases';

import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { v5 as uuidv5 } from 'uuid';

export const BUSINESS_CARD_PREMIUM_PRODUCT_ID =
  'cn.yizuw.magic.businesscard.pro.lifetime';

const BUSINESS_CARD_PREMIUM_APP_ACCOUNT_NAMESPACE =
  'd2c43b46-5719-4fd8-8584-28a4ca819c29';

function getPlatform() {
  return Capacitor.getPlatform();
}

export function isBusinessCardPremiumPurchaseSupported() {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  return getPlatform() === 'ios';
}

export function getBusinessCardPremiumAppAccountToken(userId?: null | string) {
  const normalizedUserId = `${userId || ''}`.trim();
  if (!normalizedUserId) {
    return undefined;
  }

  return uuidv5(
    `business-card-premium:${normalizedUserId}`,
    BUSINESS_CARD_PREMIUM_APP_ACCOUNT_NAMESPACE,
  );
}

export async function isBusinessCardPremiumBillingSupported() {
  if (!isBusinessCardPremiumPurchaseSupported()) {
    return false;
  }

  const { isBillingSupported } = await NativePurchases.isBillingSupported();
  return isBillingSupported;
}

export async function getBusinessCardPremiumProduct() {
  if (!isBusinessCardPremiumPurchaseSupported()) {
    return null;
  }

  const { product } = await NativePurchases.getProduct({
    productIdentifier: BUSINESS_CARD_PREMIUM_PRODUCT_ID,
    productType: PURCHASE_TYPE.INAPP,
  });

  return product;
}

function isEligiblePremiumTransaction(transaction: Transaction) {
  if (transaction.productIdentifier !== BUSINESS_CARD_PREMIUM_PRODUCT_ID) {
    return false;
  }

  if (getPlatform() === 'android') {
    return transaction.purchaseState === '1';
  }

  return true;
}

function dedupeTransactions(transactions: Transaction[]) {
  const transactionMap = new Map<string, Transaction>();

  for (const transaction of transactions) {
    transactionMap.set(transaction.transactionId, transaction);
  }

  return [...transactionMap.values()];
}

async function getPremiumTransactions(appAccountToken?: string) {
  if (!isBusinessCardPremiumPurchaseSupported()) {
    return [];
  }

  const baseOptions = {
    onlyCurrentEntitlements: true,
    productType: PURCHASE_TYPE.INAPP,
  };

  const transactions: Transaction[] = [];

  if (appAccountToken) {
    try {
      const { purchases } = await NativePurchases.getPurchases({
        ...baseOptions,
        appAccountToken,
      });
      transactions.push(...purchases);
    } catch (error) {
      console.warn(
        '按账号查询专业版权益失败，改为查询当前设备购买记录:',
        error,
      );
    }
  }

  const { purchases } = await NativePurchases.getPurchases(baseOptions);
  transactions.push(...purchases);

  return dedupeTransactions(transactions);
}

export async function getBusinessCardPremiumEntitlement(
  appAccountToken?: string,
) {
  const transactions = await getPremiumTransactions(appAccountToken);
  const transaction =
    transactions.find((item) => isEligiblePremiumTransaction(item)) || null;

  return {
    transaction,
    unlocked: !!transaction,
  };
}

export async function purchaseBusinessCardPremium(appAccountToken?: string) {
  if (!isBusinessCardPremiumPurchaseSupported()) {
    throw new Error('当前环境不支持应用内购买');
  }

  return NativePurchases.purchaseProduct({
    appAccountToken,
    isConsumable: false,
    productIdentifier: BUSINESS_CARD_PREMIUM_PRODUCT_ID,
    productType: PURCHASE_TYPE.INAPP,
    quantity: 1,
  });
}

export async function restoreBusinessCardPremium(appAccountToken?: string) {
  if (!isBusinessCardPremiumPurchaseSupported()) {
    throw new Error('当前环境不支持恢复购买');
  }

  await NativePurchases.restorePurchases();
  return getBusinessCardPremiumEntitlement(appAccountToken);
}

export type BusinessCardPremiumProduct = Product;
