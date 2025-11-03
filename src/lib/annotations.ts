// src/lib/annotations.ts

/** =========================
 *  設定
 * ========================= */
 export const ANNO_ENDPOINT: string =
 (import.meta as any)?.env?.VITE_ANNOTATIONS_URL ||
 "https://gifterra-annotations.masaki-mataro24.workers.dev";

/** =========================
*  型
* ========================= */
export interface Annotation {
 /** ニックネーム（任意） */
 name?: string;
 /** 一言メッセージ（任意） */
 message?: string;
 /** 保存タイムスタンプ（秒） */
 ts?: number;
}

export type AnnotationMap = Map<string, Annotation | null>;

/** =========================
*  ユーティリティ
* ========================= */
export const shortAddr = (addr: string) =>
 addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";

function normAddr(a?: string): string {
 return (a || "").toLowerCase();
}

/** 簡易メモリキャッシュ（同一セッション内での重複 fetch を回避） */
const memCache: AnnotationMap = new Map();

/** ローカルキャッシュ（5分 TTL） */
const LS_KEY = "gifterra:annotations";
const TTL_SEC = 5 * 60;

type LsBox = Record<string, { v: Annotation | null; t: number }>;

function loadLS(): LsBox {
 try {
   const raw = localStorage.getItem(LS_KEY);
   return raw ? (JSON.parse(raw) as LsBox) : {};
 } catch {
   return {};
 }
}

function saveLS(obj: LsBox) {
 try {
   localStorage.setItem(LS_KEY, JSON.stringify(obj));
 } catch {
   // ignore
 }
}

/** =========================
*  取得系
* ========================= */

/** 単一ユーザー */
export async function fetchAnnotation(address: string): Promise<Annotation | null> {
 const addr = normAddr(address);
 if (!addr) return null;

 if (memCache.has(addr)) return memCache.get(addr)!;

 const box = loadLS();
 const rec = box[addr];
 const now = Math.floor(Date.now() / 1000);
 if (rec && now - rec.t < TTL_SEC) {
   memCache.set(addr, rec.v);
   return rec.v;
 }

 try {
   const u = `${ANNO_ENDPOINT}/v1/annotation?user=${addr}`;
   const r = await fetch(u, { method: "GET" });
   const j = await r.json().catch(() => ({} as any));
   const val: Annotation | null = j?.data ?? null;

   memCache.set(addr, val);
   box[addr] = { v: val, t: now };
   saveLS(box);
   return val;
 } catch {
   return null;
 }
}

/** 複数ユーザーまとめて */
export async function fetchAnnotations(addresses: string[]): Promise<AnnotationMap> {
 const addrs = Array.from(new Set(addresses.map(normAddr).filter(Boolean)));
 const out: AnnotationMap = new Map();
 const need: string[] = [];
 const now = Math.floor(Date.now() / 1000);
 const box = loadLS();

 for (const a of addrs) {
   if (memCache.has(a)) {
     out.set(a, memCache.get(a)!);
   } else if (box[a] && now - box[a].t < TTL_SEC) {
     const v = box[a].v;
     memCache.set(a, v);
     out.set(a, v);
   } else {
     need.push(a);
   }
 }

 if (need.length === 0) return out;

 // まとめて取得エンドポイント
 try {
   const u = `${ANNO_ENDPOINT}/v1/annotations?users=${need.join(",")}`;
   const r = await fetch(u, { method: "GET" });
   if (r.ok) {
     const j = await r.json().catch(() => ({} as any));
     const arr: Array<{ user: string; data: Annotation | null }> = j?.data ?? [];
     for (const row of arr) {
       const a = normAddr(row.user);
       memCache.set(a, row.data);
       out.set(a, row.data);
       box[a] = { v: row.data, t: now };
     }
     saveLS(box);
     return out;
   }
 } catch {
   // フォールバック（下で個別取得）
 }

 await Promise.all(
   need.map(async (a) => {
     const v = await fetchAnnotation(a);
     out.set(a, v);
   })
 );
 return out;
}

/** 先読み（結果はメモリ & LS に入る） */
export async function prefetchAnnotations(addresses: string[]): Promise<void> {
 await fetchAnnotations(addresses);
}

/** =========================
*  保存系
* ========================= */
export interface SaveAnnotationInput {
 address?: string;
 from?: string;
 displayName?: string;
 name?: string;
 message?: string;
 signature?: string;
 timestamp?: number;
}

/** 表示名＋一言メッセージを保存（サーバへPOSTしつつローカル即時反映） */
export async function saveAnnotation(input: SaveAnnotationInput): Promise<{
 ok: boolean;
 saved?: Annotation;
 error?: string;
}> {
 const addr = normAddr(input.address || input.from);
 if (!addr) return { ok: false, error: "address required" };

 const now = Math.floor(Date.now() / 1000);
 const ann: Annotation = {
   name: (input.displayName ?? input.name ?? "").trim() || undefined,
   message: (input.message ?? "").trim() || undefined,
   ts: input.timestamp ?? now,
 };

 // サーバ保存（失敗してもローカル更新は続行）
 try {
   await fetch(`${ANNO_ENDPOINT}/v1/annotation`, {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({
       address: addr,
       name: ann.name ?? "",
       message: ann.message ?? "",
       signature: input.signature ?? "",
     }),
   }).then((r) => r.json().catch(() => ({})));
 } catch {
   // ignore
 }

 // ローカル即時反映
 memCache.set(addr, ann);
 const box = loadLS();
 box[addr] = { v: ann, t: now };
 saveLS(box);

 return { ok: true, saved: ann };
}

/** =========================
*  表示用ヘルパ
* ========================= */

/** 表示名の優先順位: 注釈 > on-chain名 > アドレス短縮 */
export function pickDisplayName(address: string, anno?: Annotation | null, onchainName?: string): string {
 const a = normAddr(address);
 const nick = (anno?.name || "").trim();
 const ens = (onchainName || "").trim();
 if (nick) return nick;
 if (ens) return ens;
 return shortAddr(a);
}

/** 一言メッセージ（なければ空） */
export function pickMessage(anno?: Annotation | null): string {
 return (anno?.message || "").trim();
}

/** 簡易分析（メッセージ率/ユニーク投稿者数） */
export function computeEngagement(
 map: AnnotationMap
): { withMessageRate: number; uniqueAuthors: number } {
 const entries = Array.from(map.values()).filter((v) => v != null) as Annotation[];
 const total = entries.length || 1;
 const withMsg = entries.filter((a) => (a.message || "").trim().length > 0).length;
 return {
   withMessageRate: withMsg / total,
   uniqueAuthors: total,
 };
}

/** =========================
*  互換用（古い import 名を生かす）
* ========================= */
export { fetchAnnotations as fetchAnnotationsCached };
export { shortAddr as _shortAddrCompat };