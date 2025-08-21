import { disableBodyScroll, enableBodyScroll } from '../utils/domHelpers.js';
import { loadAndDisplayReviews } from './Review.js';
import { startPriceTimer } from '../utils/timers.js';
import { showNotification } from '../utils/notifications.js';

export async function openTradingModal(apiResult, originalAd, paymentNames) {
    // Удаляем существующее модальное окно
    disableBodyScroll();
    const existingModal = document.querySelector('.bybit-modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }

    const adData = apiResult?.result || originalAd;

    // Создаем оверлей и модальное окно СРАЗУ
    const overlay = document.createElement('div');
    overlay.className = 'bybit-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'bybit-modal';

    // Вставляем "скелет" модального окна с плейсхолдерами для данных
    modal.innerHTML = `
        <div class="bybit-modal-header">
            <button class="bybit-modal-close" type="button">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M12.854 3.146a.5.5 0 0 1 0 .708l-9 9a.5.5 0 0 1-.708-.708l9-9a.5.5 0 0 1 .708 0z"/>
                    <path d="M3.146 3.146a.5.5 0 0 1 .708 0l9 9a.5.5 0 0 1-.708.708l-9-9a.5.5 0 0 1 0-.708z"/>
                </svg>
            </button>
        </div>
        <div class="bybit-modal-body">
            <div class="advertiser-panel">
                <div> 
                    <div class="advertiser-header">
                        <div class="avatar-container">
                            <div class="avatar ${originalAd.isOnline ? 'online' : ''}">
                                ${(originalAd.nickName || 'U').charAt(0).toUpperCase()}
                            </div>
                        </div>
                        <div class="advertiser-info">
                            <div class="advertiser-name">${originalAd.nickName || 'Unknown'}</div>
                            <div class="advertiser-stats">
                                <span>${originalAd.finishNum || 0} исполнено</span>
                                <span class="stats-divider">|</span>
                                <span>${originalAd.recentExecuteRate || 0}%</span>
                            </div>
                            <div class="online-status">${originalAd.isOnline ? 'Онлайн' : 'Офлайн'}</div>
                        </div>
                    </div>
                    <div class="verification-tags">
                        <div class="verification-tag">Эл. почта</div>
                        <div class="verification-tag">SMS</div>
                        <div class="verification-tag">Верификация личности</div>
                    </div>
                    <div class="crypto-info-section">
                        <div class="crypto-info-item">
                            <span class="crypto-info-label">Доступно</span>
                            <span class="crypto-info-value" id="balance-value">Загрузка...</span>
                        </div>
                        <div class="crypto-info-item">
                            <span class="crypto-info-label">Лимиты</span>
                            <span class="crypto-info-value">${parseFloat(adData.minAmount || 0).toLocaleString('ru-RU')} ~ ${parseFloat(adData.maxAmount || 0).toLocaleString('ru-RU')} ${adData.currencyId || 'RUB'}</span>
                        </div>
                        <div class="crypto-info-item">
                            <span class="crypto-info-label">Длительность оплаты</span>
                            <span class="crypto-info-value">${adData.paymentPeriod || 15} мин.</span>
                        </div>
                    </div>
                </div>
                <div class="terms-section">
                    <div class="terms-title">Отзывы о мейкере</div>
                    <div class="terms-content" id="reviews-container">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>
            <div class="trading-panel">
                <div class="price-section">
                    <div class="price-header">
                        <span class="price-label">Цена</span>
                        <span class="price-timer" id="price-timer">29s</span>
                    </div>
                    <div class="price-value">${parseFloat(adData.price).toFixed(2)} ${adData.currencyId || 'RUB'}</div>
                </div>
                <div class="input-section">
                    <label class="input-label">Я ${adData.side === 1 ? 'куплю' : 'продам'}</label>
                    <div class="input-container" id="amount-container">
                        <div class="input-wrapper">
                            <img class="coin-icon" src="data:image/svg+xml;base64,...">
                            <input type="text" class="amount-input" id="amount-input" placeholder="0.0000" autocomplete="off">
                            <div class="input-suffix">
                                <span>${adData.tokenId || 'USDT'}</span>
                                <span class="input-divider">|</span>
                                <button type="button" class="max-button" id="max-button">Все</button>
                            </div>
                        </div>
                    </div>
                    <div class="balance-info" id="available-for-trade">
                        // --- Этот текст тоже обновится после загрузки баланса ---
                        Доступно для ${adData.side === 1 ? 'покупки' : 'продажи'}: Загрузка...
                        <span class="info-icon">ℹ</span>
                    </div>
                </div>
                <div class="input-section">
                    <label class="input-label">Я получу</label>
                    <div class="input-container">
                        <div class="input-wrapper">
                            <div style="width: 24px; ...">₽</div>
                            <input type="text" class="amount-input" id="receive-input" placeholder="0.00" readonly>
                            <div class="input-suffix">
                                <span>${adData.currencyId || 'RUB'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="payment-section">
                    <label class="input-label">Способ оплаты</label>
                    <div class="payment-methods">
                        ${adData.payments && adData.payments.length > 0
                            ? adData.payments.map(paymentId => `<span class="payment-method">${paymentNames[paymentId] || paymentId}</span>`).join('')
                            : '<span class="payment-method">Не указано</span>'
                        }
                    </div>
                </div>
                <div class="button-section">
                    <button type="button" class="trade-button" id="trade-button">${adData.side === 1 ? 'Купить' : 'Продать'} ${adData.tokenId || 'USDT'}</button>
                    <button type="button" class="cancel-button" id="cancel-button">Отмена</button>
                </div>
            </div>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    console.log('adData:', adData);
    console.log('originalAd:', originalAd);
    console.log('apiResult:', apiResult);
    
    
    // Настраиваем обработчики событий для уже существующих элементов
    setupHighQualityModalEvents(overlay, adData, originalAd, apiResult);
    startPriceTimer();

    // --- ЗАПУСКАЕМ АСИНХРОННУЮ ЗАГРУЗКУ ДАННЫХ ---
    loadAndDisplayReviews(originalAd);
}


export function setupHighQualityModalEvents(overlay, adData, originalAd, apiResult) {
    const amountInput = overlay.querySelector('#amount-input');
    const receiveInput = overlay.querySelector('#receive-input');
    const tradeButton = overlay.querySelector('#trade-button');
    const cancelButton = overlay.querySelector('#cancel-button');
    const maxButton = overlay.querySelector('#max-button');
    const closeButton = overlay.querySelector('.bybit-modal-close');
    // Функция валидации и активации кнопки
    function validateAndToggleButton() {
        const amount = parseFloat(amountInput.value) || 0;
        const minAmount = parseFloat(adData.minAmount) || 0;
        const maxAmount = parseFloat(adData.maxAmount) || 0;
        const balance = parseFloat(adData.availableBalance) || 0;

        const isValid = amount > 0 && 
                    amount >= minAmount && 
                    amount <= maxAmount && 
                    amount <= balance;

        tradeButton.disabled = !isValid;
        tradeButton.style.opacity = isValid ? '1' : '0.6';
        tradeButton.style.cursor = isValid ? 'pointer' : 'not-allowed';
    }

    // Функция расчета суммы к получению
    function calculateReceiveAmount() {
        const amount = parseFloat(amountInput.value) || 0;
        const price = parseFloat(adData.price) || 0;
        const receiveAmount = amount * price;
        receiveInput.value = receiveAmount.toFixed(2);
        validateAndToggleButton();
    }

    // === Покупка у продавца ===
    function createBuyPayload(adData, originalAd, apiResult) {
        return {
            itemId: adData.id,
            tokenId: originalAd.tokenId,
            currencyId: originalAd.currencyId,
            side: "0",
            quantity: adData.minQuantity,
            amount: adData.minAmount,
            curPrice: apiResult.result.curPrice,
            flag: "amount",
            version: "1.0",
            securityRiskToken: "",
            isFromAi: false
        };
    }

    // === Продажа покупателю ===
    function createSellPayload(adData, originalAd, apiResult) {
        const paymentIdMap = {
            '75':  '16627518', // Тинькофф
            '377': '17762813', // Сбербанк
            '614': '',         // ПСБ
            '382': '16627221', // SBP
            '383': '19032627', // MIR
            '616': '',         // Альфа-Банк
            '617': '',         // Райффайзен
            '581': '17201839', // Tinkoff
            '582': '16664034', // Sberbank
            '584': '',         // Sberbank
            '585': '16664050', // Sberbank
            '612': '',         // Уралсиб
            '613': ''          // Уралсиб
        };

        // Приоритетные методы оплаты
        const priorityPayments = ['75', '377', '382'];
        
        // Ищем приоритетный метод оплаты в массиве adData.payments
        let selectedPayment = adData.payments[0]; // по умолчанию первый
        let selectedPaymentId = paymentIdMap[selectedPayment] || "";
        
        for (const payment of adData.payments) {
            if (priorityPayments.includes(payment)) {
                selectedPayment = payment;
                selectedPaymentId = paymentIdMap[payment] || "";
                break;
            }
        }

        return {
            itemId: adData.id,
            tokenId: originalAd.tokenId,
            currencyId: originalAd.currencyId,
            side: "1",
            quantity: adData.maxQuantity,
            amount: adData.maxAmount,
            curPrice: apiResult.result.curPrice,
            flag: "amount",
            version: "1.0",
            securityRiskToken: "",
            isFromAi: false,
            paymentType: selectedPayment,
            paymentId: selectedPaymentId,
            online: "0"
        };
    }
        
        // Обработка ввода суммы
        amountInput.addEventListener('input', calculateReceiveAmount);
        amountInput.addEventListener('keyup', calculateReceiveAmount);

        // Кнопка "Все"
        maxButton.addEventListener('click', () => {
            const maxAmount = Math.min(
                parseFloat(adData.maxAmount) || 0,
                parseFloat(adData.availableBalance) || 0
            );
            amountInput.value = maxAmount.toFixed(4);
            calculateReceiveAmount();
        });

        // НОВАЯ ЛОГИКА: Обработчик для кнопки торговли
        tradeButton.addEventListener('click', async () => {
            

            // Отключаем кнопку и показываем состояние загрузки
            tradeButton.disabled = true;
            const originalText = tradeButton.textContent;
            tradeButton.textContent = 'Отправка заявки...';
            tradeButton.style.opacity = '0.6';
            
            try {
                if (apiResult.ret_code == 912100027) {
                    showNotification("The ad status of your P2P order has been changed. Please try another ad.", "error");
                    closeModal()
                    throw new Error("The ad status of your P2P order has been changed. Please try another ad.");
                }
                if (apiResult.ret_code == 912300001) {
                    showNotification("Insufficient ad inventory, please try other ads.", "error");
                    closeModal()
                    throw new Error("Insufficient ad inventory, please try other ads.");
                }
                // Формируем payload для создания ордера
                const orderPayload = originalAd.side == 0 ? createSellPayload(adData, originalAd, apiResult) : createBuyPayload(adData, originalAd, apiResult);

                console.log('Отправка ордера:', orderPayload);

                // Отправляем POST запрос на создание ордера
                const response = await fetch('https://www.bybit.com/x-api/fiat/otc/order/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    credentials: 'include', // Добавлено для куки авторизации
                    body: JSON.stringify(orderPayload)
                });

                const result = await response.json();
                console.log('Первый ответ:', result);                    

                // Проверяем, нужна ли верификация по риску
                if (response.ok && result.result && result.result.needSecurityRisk) {
                    let riskToken = result.result.securityRiskToken; // Используем let вместо const


                    // Получить код с клавиатуры (нужно реализовать ввод)
                    const code = prompt("Введите код аутентификтор:"); // Или другой способ получения кода
                    
                    if (!code) {
                        throw new Error("Код не введен");
                    }

                    // Отправляем verify
                    const verifyRes = await fetch("https://www.bybit.com/x-api/user/public/risk/verify", {
                        method: "POST",
                        headers: { 
                            "content-type": "application/json", 
                            "accept": "application/json" 
                        },
                        credentials: "include",
                        body: JSON.stringify({
                            risk_token: riskToken,
                            component_list: { 
                                google2fa: code // Убрал JSON.stringify, код должен быть строкой
                            }
                        })
                    });
                    
                    const verifyResult = await verifyRes.json();
                    console.log("Verify response:", verifyResult);

                    // Проверяем успешность верификации
                    if (verifyResult.ret_code === 0 && verifyResult.result) {
                        // Обновляем riskToken из результата верификации
                        riskToken = verifyResult.result.risk_token;
                        
                        // Добавляем riskToken в orderPayload
                        orderPayload.securityRiskToken = riskToken;
                        //google2fa
                        // Повторно создаём ордер с обновленным payload
                        const finalResponse = await fetch("https://www.bybit.com/x-api/fiat/otc/order/create", {
                            method: "POST",
                            headers: { 
                                "content-type": "application/json", 
                                "accept": "application/json" 
                            },
                            credentials: "include",
                            body: JSON.stringify(orderPayload)
                        });
                        
                        const finalResult = await finalResponse.json();
                        console.log("✅ Final create order:", finalResult);
                        
                        if (finalResult.ret_code === 0) {
                            console.log("🎉 Ордер на продажу успешно создан!");
                            showNotification('ордер успешно создан', 'success');
                            closeModal()
                            return finalResult;
                        } else {
                            console.error("❌ Ошибка при финальном создании ордера:", finalResult.ret_msg);
                            showNotification('The transaction limit has been exceeded', 'error');
                            throw new Error(`Order creation failed: ${finalResult.ret_msg}`);
                            
                        }
                    } else {
                        console.error("❌ Ошибка верификации:", verifyResult.ret_msg);
                        throw new Error(`Verification failed: ${verifyResult.ret_msg}`);
                    }
                    
                } else if (response.ok && result.ret_code === 0) {
                    // Ордер создан успешно без верификации
                    console.log("✅ Ордер на покупку создан успешно:", result);
                    showNotification('ордер успешно создан', 'success');
                    closeModal()
                    return result;
                    
                } else {
                    // Обработка других ошибок
                    showNotification(result.ret_msg || result, 'error');
                    closeModal()                       
                    throw new Error(`Order creation failed: ${result.ret_msg || 'Unknown error'}`);
                }

            } catch (error) {
                console.error('Ошибка при создании ордера:', error);
                throw error;
            }  finally {
                // Восстанавливаем состояние кнопки
                tradeButton.disabled = false;
                tradeButton.textContent = originalText;
                tradeButton.style.opacity = '1';
                validateAndToggleButton(); // Повторно валидируем
                }
                    });

        // Закрытие модального окна
        function closeModal() {
            overlay.remove();
            document.body.style.overflow = '';
            enableBodyScroll()
        }

        cancelButton.addEventListener('click', closeModal);
        closeButton.addEventListener('click', closeModal);
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });

        // Закрытие по Escape
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        });
}

