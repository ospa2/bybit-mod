import type { Card } from "../types/reviews";

export async function fetchAndStoreCards() {
   try {
      const response = await fetch('https://orders-finances.vercel.app/api/cards');

      if (!response.ok) {
         throw new Error(`Ошибка запроса: ${response.status}`);
      }

      const cards: Card[] = await response.json();

      // Сохраняем в localStorage
      localStorage.setItem('!cards', JSON.stringify(cards));

      console.log('Карты успешно сохранены в localStorage:', cards);
   } catch (error) {
      console.error('Не удалось получить или сохранить карты:', error);
   }
}

export async function sendCardsToServer(cards: Card[]) {
   try {
      const response = await fetch(
         'https://orders-finances.vercel.app/api/cards',
         {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
            },
            body: JSON.stringify(cards),
         }
      );

      if (!response.ok) {
         throw new Error(`Ошибка запроса: ${response.status}`);
      }

      const result = await response.json();
      console.log('Данные успешно отправлены на сервер:', result);
      return result;
   } catch (error) {
      console.error('Не удалось отправить данные на сервер:', error);
   }
}
