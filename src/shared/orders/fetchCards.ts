import type { Card } from "../types/reviews";

function isValidBank(bank: string): bank is Card['bank'] {
   return ['tbank', 'sber'].includes(bank);
}

export async function fetchAndStoreCards(): Promise<void> {
   try {
      const response = await fetch('https://orders-finances.vercel.app/api/cards');

      if (!response.ok) {
         throw new Error(`Ошибка запроса: ${response.status}`);
      }

      const rawData: unknown = await response.json();

      if (!Array.isArray(rawData)) {
         throw new Error('Ожидался массив данных');
      }

      // Маппинг и очистка данных
      const cards: Card[] = rawData.reduce((acc: Card[], item: any) => {
         if (
            typeof item.id === 'string' &&
            isValidBank(item.bank) &&
            typeof item.balance === 'number' &&
            typeof item.turnover === 'number'
         ) {
            acc.push({
               id: item.id,
               bank: item.bank,
               balance: item.balance,
               turnover: item.turnover,
            });
         } else {
            console.warn('Некорректный формат карточки пропущен:', item);
         }
         return acc;
      }, []);

      localStorage.setItem('!cards', JSON.stringify(cards));

      console.log('Карты успешно сохранены:', cards);
   } catch (error) {
      console.error('Ошибка в fetchAndStoreCards:', error instanceof Error ? error.message : error);
   }
}

export async function sendCardsToServer(
   id: string,
   amount: number,
   reason: 'order_create' | 'order_cancel' | 'manual'
) {
   try {
      const response = await fetch(
         'https://orders-finances.vercel.app/api/cards',
         {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
            },
            // Передаем is_system для SQL триггера
            body: JSON.stringify({ id: id, amount, reason }),
         }
      );

      if (!response.ok) {
         const errorData = await response.json().catch(() => ({}));
         throw new Error(`Ошибка ${response.status}: ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();
      console.log(`✅ Данные карты ${id} обновлены (System: ${reason})`);
      return result;
   } catch (error) {
      console.error('❌ Ошибка отправки на сервер:', error);
      throw error;
   }
}