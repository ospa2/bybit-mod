import { filterRemark } from '../utils/formatters.js';
import { openTradingModal } from './TradingModal.js';
import { paymentNames, paymentColors } from '../config.js';

export function createRowFromTemplate(ad) {

    function getPaymentStyle(paymentId) {
        const color = paymentColors[paymentId];
        return color ? `background-color: ${color}; color: white;` : '';
    }

    const filteredRemark = filterRemark(ad.remark);

    const rowHTML = `
            <div class="dynamic-row" style="display: contents;">
                <div class="table-row" style="display: table-row;">
                    <div class="table-cell" style="display: table-cell; width: 800px; padding: 16px; vertical-align: middle;">
                        <div class="moly-space flex items-center" style="gap: 16px;">
                            <div class="moly-space-item moly-space-item-first moly-space-item-last">
                                <div class="moly-space flex-col inline-flex moly-space-vertical items-start" style="gap: 0px;">
                                    <div class="moly-space-item moly-space-item-first">
                                        <div class="moly-space flex items-center" style="gap: 0px;">
                                            <div class="moly-space-item moly-space-item-first">
                                                <div class="by-avatar by-avatar--${ad.isOnline ? 'online' : 'offline'} small">
                                                    <div class="by-avatar__container">
                                                        <div class="by-avatar__container__letter">${ad.nickName ? ad.nickName.charAt(0).toUpperCase() : 'U'}</div>
                                                        <div class="by-avatar__container__status"></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="moly-space-item">
                                                <div class="inline-block">
                                                    <div class="advertiser-name">
                                                        <span>${ad.nickName || 'Unknown'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="moly-space-item moly-space-item-last">
                                                <div class="inline-block">
                                                    ${ad.authTag && ad.authTag.length > 0 ? ad.authTag.map(tag => `<img src="/fiat/trade/gw/static/media/vaSilverIcon.8a83d2497a7eccc3612a.png" class="advertiser-auth-tag pointer">`).join('') : ''}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="moly-space-item">
                                        <div class="advertiser-info">
                                            <span>${ad.finishNum || 0}&nbsp;исполнено</span>
                                            <span class="delimiter">|</span>
                                            <div class="inline-block">
                                                <span class="execute-rate">${ad.recentExecuteRate || 0}&nbsp;% | ${ad.paymentPeriod || 15} мин.</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="moly-space-item moly-space-item-last">
                                        <div class="moly-space flex items-baseline" style="gap: 16px;">
                                            <div class="moly-space-item moly-space-item-first" style="margin-top: 6px;">
                                                <div class="inline-block">
                                                    <span class="moly-text text-[var(--bds-gray-t2)] font-[400] inline pointer">
                                                        <img src="/fiat/trade/gw/static/media/clock.8fb8bc6c6fe17cf175ba8a0abda873f5.svg" alt="" width="14" style="vertical-align: -2px;">
                                                        ${filteredRemark}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="table-cell" style="display: table-cell; min-width: 120px; max-width: 180px; padding: 16px; vertical-align: middle;">
                        <span class="price-amount">
                            ${parseFloat(ad.price).toFixed(2)} <span class="price-unit">${ad.currencyId || 'RUB'}</span>
                        </span>
                    </div>
                    <div class="table-cell" style="display: table-cell; min-width: 220px; padding: 16px; vertical-align: middle;">                     
                        <div class="ql-value">${parseFloat(ad.minAmount || 0).toLocaleString('ru-RU', {minimumFractionDigits: 2})}&nbsp;~&nbsp;${parseFloat(ad.maxAmount || 0).toLocaleString('ru-RU', {minimumFractionDigits: 2})} ${ad.currencyId || 'RUB'}</div>
                    </div>
                    <div class="table-cell" style="display: table-cell; width: 196px; padding: 16px; vertical-align: middle;">
                        ${ad.payments?.slice(0, 3).map(paymentId =>
                            `<div class="inline-block"><div class="trade-list-tag" style="${getPaymentStyle(paymentId)}">${paymentNames[paymentId] || paymentId}</div></div>`
                        ).join('') || '<div class="inline-block"><div class="trade-list-tag">Не указано</div></div>'}
                    </div>
                    <div class="table-cell trade-list-action-button" style="display: table-cell; padding: 16px; vertical-align: middle;">
                        <button class="moly-btn ${ad.side === 1 ? 'bg-greenColor-bds-green-700-normal' : 'bg-redColor-bds-red-700-normal'} text-base-bds-static-white px-[16px] py-[8px] rounded">
                            <span>${ad.side === 1 ? 'Купить' : 'Продать'} ${ad.tokenId || 'USDT'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rowHTML.trim();
    const newRow = tempDiv.firstChild;

    newRow.querySelector('button')?.addEventListener('click', async () => {
        const payload = { item_id: ad.id, shareCode: null };

        try {
            const res = await fetch("https://www.bybit.com/x-api/fiat/otc/item/simple", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            openTradingModal(result, ad, paymentNames);
        } catch (e) {
            console.error('Ошибка при подгрузке:', e);
        }
    });

    return newRow;
}
