const API_KEY = "K8CPRLuqD302ftIfua";
const API_SECRET = "E86RybeO4tLjoXiR5YYtbVStHC9qXCHDBeOI";

async function getAuthParams() {
  const expires = Date.now() + 60_000;
  const encoder = new TextEncoder();

  // Импортируем секретный ключ
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(API_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Подписываем строку (apiKey + expires)
  const signatureBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(API_KEY + expires)
  );

  // Преобразуем ArrayBuffer → hex строку
  const signature = Array.from(new Uint8Array(signatureBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { api_key: API_KEY, expires, signature };
}

export function connectPrivateWs() {
  const ws = new WebSocket("wss://stream.bybit.com/v5/private");
  const pingInterval = setInterval(() => {
    ws.send(JSON.stringify({ op: "ping", ts: Date.now() }));
  }, 20_000);;

  ws.onopen = async () => {
    console.log("✅ WS connected");

    const { api_key, expires, signature } = await getAuthParams();

    ws.send(
      JSON.stringify({
        op: "auth",
        args: [api_key, expires, signature],
      })
    );

  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    console.log("📩 MSG:", msg);

    if (msg.op === "auth" && msg.success) {
      console.log("✅ Auth success, подписываемся на ордера...");
      ws.send(JSON.stringify({ op: "subscribe", args: ["order"] }));
    }

    // Отвечаем на ping сервера
    if (msg.op === "ping") {
      ws.send(JSON.stringify({ op: "pong", ts: msg.ts }));
    }

    if (msg.topic === "order" && msg.data) {
      msg.data.forEach((order: { orderId: any; orderStatus: any; }) => {
        console.log(`➡️ Ордер ${order.orderId} → статус: ${order.orderStatus}`);
      });
    }
  };

  ws.onclose = () => {
    console.warn("⚠️ WS disconnected");
    clearInterval(pingInterval);
  };

  ws.onerror = (err) => {
    console.error("❌ WS error", err);
  };
}
