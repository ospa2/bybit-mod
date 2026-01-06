interface CurrencyInfo {
  id: string;
  exchangeId: string;
  orgId: string;
  currencyId: string;
  scale: number;
}

interface TokenInfo {
  id: string;
  exchangeId: string;
  orgId: string;
  tokenId: string;
  scale: number;
  sequence: number;
}

interface SymbolInfo {
  id: string;
  exchangeId: string;
  orgId: string;
  tokenId: string;
  currencyId: string;
  status: number;
  lowerLimitAlarm: number;
  upperLimitAlarm: number;
  itemDownRange: string;
  itemUpRange: string;
  currencyMinQuote: string;
  currencyMaxQuote: string;
  currencyLowerMaxQuote: string;
  tokenMinQuote: string;
  tokenMaxQuote: string;
  kycCurrencyLimit: string;
  itemSideLimit: number;
  buyFeeRate: string;
  sellFeeRate: string;
  orderAutoCancelMinute: number;
  orderFinishMinute: number;
  tradeSide: number;
  currency: CurrencyInfo;
  token: TokenInfo;
  buyAd: any | null;
  sellAd: any | null;
}

interface TradingPreferenceSet {
  hasUnPostAd: number;
  isKyc: number;
  isEmail: number;
  isMobile: number;
  hasRegisterTime: number;
  registerTimeThreshold: number;
  orderFinishNumberDay30: number;
  completeRateDay30: string;
  nationalLimit: string;
  hasOrderFinishNumberDay30: number;
  hasCompleteRateDay30: number;
  hasNationalLimit: number;
  hasSingleUserOrderLimit: number;
  singleUserOrderLimit: number;
}

export interface Ad {
  id: string;
  accountId: string;
  userId: string;
  nickName: string;
  tokenId: string;
  tokenName: string;
  currencyId: string;
  side: number;
  priceType: number;
  price: string;
  premium: string;
  lastQuantity: string;
  quantity: string;
  frozenQuantity: string;
  executedQuantity: string;
  minAmount: string;
  maxAmount: string;
  remark: string;
  status: number;
  createDate: string;
  payments: string[];
  orderNum: number;
  finishNum: number;
  recentOrderNum: number;
  recentExecuteRate: number;
  fee: string;
  isOnline: boolean;
  lastLogoutTime: string;
  blocked: string;
  makerContact: boolean;
  symbolInfo: SymbolInfo;
  tradingPreferenceSet: TradingPreferenceSet;
  version: number;
  authStatus: number;
  recommend: boolean;
  recommendTag: string;
  authTag: string[];
  userType: string;
  itemType: string;
  paymentPeriod: number;
  userMaskId: string;
  verificationOrderSwitch: boolean;
  verificationOrderLabels: any[];
  verificationOrderAmount: string;
  ban: boolean;
  baned: boolean;
}

interface P2PResult {
  id: string;
  price: string;
  lastQuantity: string;
  curPrice: string;
  lastPrice: string;
  isOnline: boolean;
  lastLogoutTime: string;
  payments: string[];
  status: number;
  paymentTerms: any[];
  paymentPeriod: number;
  totalAmount: string;
  minAmount: string;
  maxAmount: string;
  minQuantity: string;
  maxQuantity: string;
  itemPriceAvailableTime: string;
  itemPriceValidTime: string;
  itemType: string;
  shareItem: boolean;
}

export interface ApiResult {
  ret_code: number;
  ret_msg: string;
  result: P2PResult;
  ext_code: string;
  ext_info: Record<string, any>;
  time_now: string;
  id: string;
  price: string;
  lastQuantity: string;
  curPrice: string;
  lastPrice: string;
  isOnline: boolean;
  lastLogoutTime: string;
  payments: string[];
  status: number;
  paymentTerms: any[];
  paymentPeriod: number;
  totalAmount: string;
  minAmount: string;
  maxAmount: string;
  minQuantity: string;
  maxQuantity: string;
  itemPriceAvailableTime: string;
  itemPriceValidTime: string;
  itemType: string;
  shareItem: boolean;
  nickName: string;
}

export type SliderOptions = {
  min: number;
  max: number;
  onUpdate?: (min: number, max: number, onChangeCallback: () => void) => void;
};

export interface CreateResponse {
  ret_code: number;
  ret_msg: string;
  result: {
    orderId: string;
    isNeedConfirm: boolean;
    confirmId: string;
    success: boolean;
    securityRiskToken: string;
    riskTokenType: string;
    riskVersion: string;
    needSecurityRisk: boolean;
    isBulkOrder: boolean;
    delayTime: string;
  };
  ext_code: string;
  ext_info: Record<string, any>;
  time_now: string;
}

export interface OrderPayload {
  itemId: string;
  tokenId: string;
  currencyId: string;
  side: string;
  quantity: string;
  amount: string;
  curPrice: string | number;
  flag: string;
  version: string;
  securityRiskToken: string;
  isFromAi: boolean;
}

export interface Order {
  "Order No.": string;
  Type: string;
  "Fiat Amount": string;
  Price: string | number;
  "Coin Amount": string;
  Counterparty: string;
  Status: string;
  Time: string;
}

export type GenericApiResponse = {
  ret_code: number;
  ret_msg: string;
  result: ApiResult;
  side: string
  nickName: string
}

export interface OrderData {
  order: Order;
  card: Card;
}

export type OrderStatus = "pending" | "completed" | "cancelled" | string;

export interface PendingOrder {
  id: string;
  side: number;
  tokenId: string;
  orderType: string;
  amount: string;
  currencyId: string;
  price: string;
  notifyTokenQuantity: string;
  notifyTokenId: string;
  fee: string;
  targetNickName: string;
  targetUserId: string;
  status: number;
  selfUnreadMsgCount: string;
  createDate: string;
  transferLastSeconds: string;
  appealLastSeconds: string;
  userId: string;
  sellerRealName: string;
  buyerRealName: string;
  judgeInfo: {
    autoJudgeUnlockTime: string;
    dissentResult: string;
    preDissent: string;
    postDissent: string;
  };
  unreadMsgCount: string;
  extension: {
    isDelayWithdraw: boolean;
    delayTime: string;
    startTime: string;
  };
  bulkOrderFlag: boolean;
  targetUserMaskId: string;
  loginUserMaskId: string;
  verificationOrderLastSeconds: string;
  verificationOrder: boolean;
  expiresSoon: boolean;
}

export interface ChatMessageData {
  userId: number | string;
  orderId: string;
  message: string;
  msgUuid: string;
  createDate: string;
  contentType: string;
  roleType: 'user' | 'admin' | 'system';
  id: number;
  msgCode: number;
  onlyForCustomer: number;
  nickName: string;
  fromP2pChat: boolean;
  autoSend: boolean;
  // Иногда API присылает альтернативные ключи
  order_id?: string;
  otcOrderId?: string;
  order?: string;
  msg_id?: string;
  msgId?: string;
  uuid?: string;
  text?: string;
}

export interface IncomingChatPayload {
  topic: 'OTC_USER_CHAT_MSG_V2';
  type: 'RECEIVE';
  data: ChatMessageData;
}