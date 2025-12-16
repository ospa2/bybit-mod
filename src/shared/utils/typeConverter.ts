import type { OrderPayload, Ad, CurrencyInfo, TokenInfo, SymbolInfo, TradingPreferenceSet } from "../types/ads";

export function payloadToAd(
   payload: OrderPayload,
   userId: string = 'USER_12345',
   remark: string = 'Тестовая заявка',
): Ad {
   // 1. Создание фиктивных вспомогательных структур
   const DUMMY_CURRENCY_INFO: CurrencyInfo = {
      id: payload.currencyId,
      exchangeId: 'EX001',
      orgId: 'ORG001',
      currencyId: payload.currencyId,
      scale: 2, // 2 знака после запятой
   };

   const DUMMY_TOKEN_INFO: TokenInfo = {
      id: payload.tokenId,
      exchangeId: 'EX001',
      orgId: 'ORG001',
      tokenId: payload.tokenId,
      scale: 8, // 8 знаков после запятой
      sequence: 1,
   };

   const DUMMY_SYMBOL_INFO: SymbolInfo = {
      id: `${payload.tokenId}_${payload.currencyId}`,
      exchangeId: 'EX001',
      orgId: 'ORG001',
      tokenId: payload.tokenId,
      currencyId: payload.currencyId,
      status: 1, // Активен
      lowerLimitAlarm: 0,
      upperLimitAlarm: 0,
      itemDownRange: '0.01',
      itemUpRange: '0.01',
      currencyMinQuote: '1',
      currencyMaxQuote: '1000000',
      currencyLowerMaxQuote: '1000',
      tokenMinQuote: '0.00000001',
      tokenMaxQuote: '1000000000',
      kycCurrencyLimit: '100000',
      itemSideLimit: 1,
      buyFeeRate: '0.001',
      sellFeeRate: '0.001',
      orderAutoCancelMinute: 30,
      orderFinishMinute: 15,
      tradeSide: 3,
      currency: DUMMY_CURRENCY_INFO,
      token: DUMMY_TOKEN_INFO,
      buyAd: null,
      sellAd: null,
   };

   const DUMMY_TRADING_PREFERENCE_SET: TradingPreferenceSet = {
      hasUnPostAd: 0,
      isKyc: 1,
      isEmail: 1,
      isMobile: 1,
      hasRegisterTime: 1,
      registerTimeThreshold: 30, // Более 30 дней
      orderFinishNumberDay30: 50,
      completeRateDay30: '0.95',
      nationalLimit: 'ALL',
      hasOrderFinishNumberDay30: 1,
      hasCompleteRateDay30: 1,
      hasNationalLimit: 1,
      hasSingleUserOrderLimit: 0,
      singleUserOrderLimit: 0,
   };

   // 2. Создание объекта Ad
   const ad: Ad = {
      // Поля, требующие уникальных ID или информации о пользователе (фиктивные)
      id: payload.itemId,
      accountId: `ACC_${userId}`,
      userId: userId,
      nickName: 'AdMakerName',
      createDate: new Date().toISOString(),

      // Поля, взятые из OrderPayload
      tokenId: payload.tokenId,
      tokenName: payload.itemId, // Используем itemId как TokenName
      currencyId: payload.currencyId,
      side: payload.side === 'BUY' ? 0 : 1, // 1: Покупка (Buy), 2: Продажа (Sell)
      price: String(payload.curPrice),
      quantity: payload.quantity,
      maxAmount: payload.amount, // В данном случае, используем amount как minAmount

      // Поля, требующие значений по умолчанию/заглушек
      priceType: 1, // Фиксированная цена (предположительно)
      premium: '0.00',
      lastQuantity: payload.quantity, // Предполагаем, что остаток равен общему количеству
      frozenQuantity: '0',
      executedQuantity: '0',
      minAmount: (parseFloat(payload.quantity) * parseFloat(String(payload.curPrice))).toFixed(2), // Расчет максимальной суммы
      remark: remark,
      status: 1, // Активно
      payments: ['VISA', 'MASTERCARD'], // Платежные системы
      orderNum: 0,
      finishNum: 0,
      recentOrderNum: 0,
      recentExecuteRate: 0,
      fee: '0.00',
      isOnline: true,
      lastLogoutTime: new Date().toISOString(),
      blocked: '',
      makerContact: false,
      version: 1,
      authStatus: 3, // Полная аутентификация (фиктивно)
      recommend: false,
      recommendTag: '',
      authTag: ['KYC', 'EMAIL', 'MOBILE'],
      userType: 'COMMON',
      itemType: 'P2P',
      paymentPeriod: 15, // 15 минут
      userMaskId: '*****',
      verificationOrderSwitch: false,
      verificationOrderLabels: [],
      verificationOrderAmount: '0',
      ban: false,
      baned: false,

      // Встроенные структуры (используем фиктивные данные)
      symbolInfo: DUMMY_SYMBOL_INFO,
      tradingPreferenceSet: DUMMY_TRADING_PREFERENCE_SET,
   };

   return ad;
}