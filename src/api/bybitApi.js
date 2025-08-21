import { createRowFromTemplate } from "../components/AdRow.js";
import { adShouldBeFiltered } from "../logic/adFilter.js";
import { isLoading, shouldStopLoading } from "../state.js";

export async function fetchAndAppendPage(pageNum, USER_ID) {
    if (isLoading.value || shouldStopLoading.value) return;
    isLoading.value = true;

    let side = "1";
    const currentUrl = window.location.href;
    if (currentUrl.includes("/sell/USDT/RUB")) side = "0";
    else if (currentUrl.includes("/buy/USDT/RUB")) side = "1";

    const payload = {
        userId: USER_ID,
        tokenId: "USDT",
        currencyId: "RUB",
        payment: [],
        side: side,
        size: "10",
        page: String(pageNum),
        amount: "",
        vaMaker: false,
        bulkMaker: false,
        canTrade: true,
        verificationFilter: 0,
        sortType: "OVERALL_RANKING",
        paymentPeriod: [],
        itemRegion: 1
    };

    try {
        const res = await fetch("https://www.bybit.com/x-api/fiat/otc/item/online", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        const ads = json.result || json.data || [];

        const tbody = document.querySelector(".trade-table__tbody");
        if (!tbody) return console.log("Tbody не найден");

        let addedCount = 0;

        ads.items.forEach(ad => {
            if (!adShouldBeFiltered(ad)) {
                const newRow = createRowFromTemplate(ad);
                if (newRow) {
                    tbody.appendChild(newRow);
                    addedCount++;
                }
            }
        });
    } catch (e) {
        console.error("Ошибка при подгрузке:", e);
    }

    isLoading.value = false;
}
