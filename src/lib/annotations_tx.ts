// src/lib/annotations_tx.ts
const ENDPOINT =
  import.meta.env.VITE_TXMSG_ENDPOINT ||
  "https://gifterra-annotations.masaki-mataro24.workers.dev/api/txMessage";

// ---- 共通: 10秒タイムアウト用（保険） ----
function withTimeout(signal: AbortSignal, ms = 10_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  // 親 signal が中断されたらこちらも中断
  signal?.addEventListener?.("abort", () => ctrl.abort(), { once: true });
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
}

// 保存：アドレス＋txHash＋メッセージ
export async function saveTxMessage(address: string, txHash: string, message: string) {
  try {
    const addr = (address || "").toLowerCase();
    const tx = (txHash || "").toLowerCase();
    const msg = String(message ?? "").slice(0, 280); // 長さガード

    // 形式ガード（早期 return）
    if (!/^0x[a-f0-9]{40}$/.test(addr) || !/^0x[a-f0-9]{64}$/.test(tx) || !msg) {
      console.warn("saveTxMessage skip (invalid args)", { addr, tx, msgLen: msg.length });
      return;
    }

    const outer = new AbortController();
    const { signal, done } = withTimeout(outer.signal, 10_000); // 10秒保険

    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: addr, txHash: tx, message: msg }),
      signal,
    }).finally(done);

    if (!r.ok) {
      // HTTP エラー
      const bodyText = await r.text().catch(() => "");
      console.warn("saveTxMessage non-200", r.status, bodyText);
      return;
    }

    // API 仕様: { ok: true, saved: { address, txHash } } を期待
    let json: any = null;
    try {
      json = await r.clone().json();
    } catch {
      // たまに空ボディ等でも noop
    }
    if (!json?.ok) {
      console.warn("saveTxMessage api not ok", json);
    }
  } catch (err) {
    console.warn("saveTxMessage failed", err);
  }
}

// 取得：アドレスごとの txHash→message をまとめて取得
export async function fetchTxMessages(addresses: string[]) {
  try {
    if (!addresses?.length) return {};

    const uniq = Array.from(new Set(addresses.map((a) => a.toLowerCase())));
    const url = `${ENDPOINT}?a=${encodeURIComponent(uniq.join(","))}`;

    const outer = new AbortController();
    const { signal, done } = withTimeout(outer.signal, 10_000); // 10秒保険

    const res = await fetch(url, { cache: "no-store", signal }).finally(done);

    if (!res.ok) {
      console.warn("fetchTxMessages non-200", res.status, await res.text().catch(() => ""));
      return {};
    }

    const data = (await res.json()) as Record<string, Record<string, string>>;
    return data ?? {};
  } catch (err) {
    console.warn("fetchTxMessages failed", err);
    return {};
  }
}