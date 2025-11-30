// Этот код должен работать в контексте Tampermonkey на странице Bybit.
// Вам не нужно импортировать axios, используйте встроенный fetch.

/**
 * 🔑 Функция получения свежего JWT токена.
 * Браузер автоматически прикрепит все необходимые Cookies.
 */
export async function fetchFreshBybitToken() {
   const url = 'https://www.bybit.com/x-api/user/private/ott';

   try {
      const response = await fetch(url, {
         method: 'POST',
         // Никаких данных не отправляем (content-length: 0), как в вашем cURL
         body: null,
         headers: {
            // Достаточно минимального набора заголовков, чтобы походить на браузер
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            // 'Cookie' не нужен, fetch прикрепит его сам!
         }
      });

      if (!response.ok) {
         throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();

      const { ret_code, ret_msg, result } = data;

      if (ret_code === 0 && ret_msg === 'success' && result) {
         return result; // 'result' содержит JWT токен
      } else {
         throw new Error(`Token API failed. Code: ${ret_code}, Message: ${ret_msg}`);
      }

   } catch (error) {
      console.error('❌ Error during token fetching:', error);
      // Очень важно вызвать this.connectionRejector в случае ошибки
      throw new Error('Failed to retrieve authentication token automatically.');
   }
}