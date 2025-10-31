// src/types/greasemonkey.d.ts

declare module "$" {
  export function GM_getValue<T = unknown>(key: string, defaultValue?: T): T;
  export function GM_setValue<T = unknown>(key: string, value: T): void;
  declare function GM_xmlhttpRequest(details: {
    method: "GET" | "POST" | "PUT" | "DELETE" | "HEAD";
    url: string;
    headers?: Record<string, string>;
    data?: string | FormData;
    binary?: boolean;
    responseType?: "arraybuffer" | "blob" | "json";
    onload?: (response: { responseText: string; status: number; responseHeaders: string; finalUrl: string }) => void;
    onerror?: (response: { error: string }) => void;
}): void;
}

declare function GM_deleteValue(key: string): void;
declare function GM_listValues(): string[];
declare function GM_addStyle(css: string): void;
declare function GM_openInTab(url: string, options?: { active?: boolean; insert?: boolean; setParent?: boolean }): void;

declare function GM_registerMenuCommand(name: string, callback: () => void, accessKey?: string): void;
declare function GM_unregisterMenuCommand(menuCmdId: number): void;
declare function GM_notification(details: string | { text: string; title?: string; image?: string; timeout?: number; onclick?: () => void }): void;
