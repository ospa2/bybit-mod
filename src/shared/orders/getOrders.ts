import { markCardAsUsed } from "../../features/buy/automation/adFinder";
import { findBuyCard } from "../../features/buy/automation/buyCardSelector";
import { findSellCard } from "../../features/sell/automation/sellCardSelector";
import { loadCards, StorageHelper } from "../storage/storageHelper";
import type { Ad, OrderData, OrderPayload, PendingOrder } from "../types/ads";
import type { Card } from "../types/reviews";
import { payloadToAd } from "../utils/typeConverter";
import { watchOrder } from "./orderWatcher";

async function getCurrentOrders() {
   try {
      const res = await fetch(
         "https://www.bybit.com/x-api/fiat/otc/order/pending/simplifyListNotCore",
         {
            method: "POST",
            headers: {
               "Content-Type": "application/json;charset=UTF-8",
               accept: "application/json",
               origin: "https://www.bybit.com",
            },
            body: JSON.stringify({
               page: 1,
               size: 10,
            }),
            credentials: "include",
         }
      ).then((response) => response.json());
      if (res.ret_code === 0) {
         return res.result.items
      } else {
         throw new Error(res.ret_msg)
      }

   } catch (error) {
      console.error("❌❌ Ошибка в getCurrentOrders:", error);
   }
}

export async function watchNewOrders() {
   let isRunning = false;

   const interval = setInterval(async () => {
      if (isRunning) return; // предотвращает параллельные вызовы
      isRunning = true;

      try {
         const orders: PendingOrder[] = await getCurrentOrders();
         let ordersFromLS: OrderData[] = StorageHelper.getOrders() || [];

         for (const order of orders) {
            const existsInLS = ordersFromLS.some((lsOrder) => {
               return lsOrder.order["Order No."] === order.id;
            });

            if (existsInLS) continue;

            const orderData = {
               "Order No.": order.id,
               Type: order.side === 0 ? "BUY" : "SELL",
               "Fiat Amount": order.amount,
               Price: order.price,
               "Coin Amount": order.notifyTokenQuantity,
               Counterparty: order.targetNickName || order.targetUserMaskId,
               Status: order.status.toString(),
               Time: new Date().toISOString()
            };

            const orderPayload: OrderPayload = {
               itemId: order.id,
               tokenId: order.tokenId,
               currencyId: order.currencyId,
               side: order.side.toString(),
               quantity: order.notifyTokenQuantity,
               amount: order.amount,
               curPrice: order.price,
               flag: "",
               version: "",
               securityRiskToken: "",
               isFromAi: false,
               
            };
            let card: Card | null = null;
            const remark = await getRemarkByOrderID(order.id);
            const minPriceRaw = localStorage.getItem("minPrice") || orderPayload.amount;
            const minPrice = parseFloat(minPriceRaw);
            const ad: Ad = payloadToAd(orderPayload, "123", remark);

            if (orderData.Type === "BUY") {
               card = findBuyCard(ad, minPrice);
            } else {
               // SELL
               if (remark) {
                  card = findSellCard(orderPayload, remark);
               } else {
                  card = findSellCard(orderPayload);
               }
            }
            let cards = loadCards();

            if (!(window as any).manager.isActive(order.id)) {
               (window as any).manager.startForOrder(order.id);
            }

            // 🔹 Запустить наблюдение за картой только если она есть
            if (card) watchOrder(order.id, card);

            // 🔹 Обновление балансов карты
            if (card) {
               const val = orderData.Type === "BUY" ? -parseFloat(order.amount) : parseFloat(order.amount);
               cards = cards.map((c) =>
                  c.id === card.id
                     ? {
                        ...c,
                        balance: c.balance + val,
                        turnover: c.turnover + val,
                     }
                     : c
               );

               markCardAsUsed(card.id);
               localStorage.setItem("!cards", JSON.stringify(cards));
            }

            const newOrderData: OrderData = {
               order: orderData,
               card: card || null
            };

            ordersFromLS.push(newOrderData);
            StorageHelper.setOrders(ordersFromLS);
         }
      } catch (error) {
         console.error("❌ Ошибка при проверке новых ордеров", error);
      }

      isRunning = false;
   }, 5000);

   return () => {
      console.log("🛑 Остановка наблюдения за новыми ордерами");
      clearInterval(interval);
   };
}


export async function getRemarkByOrderID(orderId: string) {
   try {
      const res = await fetch(
         "https://www.bybit.com/x-api/fiat/otc/order/message/listpage",
         {
            method: "POST",
            headers: {
               "Content-Type": "application/json;charset=UTF-8",
               accept: "application/json",
               origin: "https://www.bybit.com",
            },
            body: JSON.stringify({
               orderId: orderId,
               currentPage: "1",
               size: "100",
            }),
            credentials: "include",
         }
      ).then((response) => response.json());


      const messages: string[] = res.result.result.map((m: any) => m.message);
      console.log("🚀 ~ getRemarkByOrderID ~ messages:", messages[messages.length-2])
      return messages[messages.length - 2]
   } catch (error) {
      console.error("❌❌ Ошибка в getRemarkByOrderID:", error);
   }
}  
// {
//    "ret_code": 0,
//       "ret_msg": "SUCCESS",
//          "result": {
//       "count": 1,
//          "items": [
//             {
//                "id": "1997668933118771200",
//                "side": 1,
//                "tokenId": "USDT",
//                "orderType": "ORIGIN",
//                "amount": "75000.00",
//                "currencyId": "RUB",
//                "price": "80.10",
//                "notifyTokenQuantity": "936.3296",
//                "notifyTokenId": "USDT",
//                "fee": "0",
//                "targetNickName": "Love is….❤️",
//                "targetUserId": "149696147",
//                "status": 20,
//                "selfUnreadMsgCount": "2",
//                "createDate": "1765116364000",
//                "transferLastSeconds": "0",
//                "appealLastSeconds": "599",
//                "userId": "204412940",
//                "sellerRealName": "СЕРАФИМ НИКИТИЧ ГАЛАКТИОНОВ",
//                "buyerRealName": "ДМИТРИЙ ДМИТРИЕВИЧ КИРИЛЮК",
//                "judgeInfo": {
//                   "autoJudgeUnlockTime": "0",
//                   "dissentResult": "",
//                   "preDissent": "",
//                   "postDissent": ""
//                },
//                "unreadMsgCount": "2",
//                "extension": {
//                   "isDelayWithdraw": false,
//                   "delayTime": "0",
//                   "startTime": ""
//                },
//                "bulkOrderFlag": false,
//                "targetUserMaskId": "s11596e0a818346f1aafb9780035cc690",
//                "loginUserMaskId": "sa0b09269cf104f889f4adb306e9e81ff",
//                "verificationOrderLastSeconds": "0",
//                "verificationOrder": false,
//                "expiresSoon": false
//             }
//          ]
//    },
//    "ext_code": "",
//       "ext_info": { },
//    "time_now": "1765116435.559520"
// }