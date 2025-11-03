// src/lib/emergency.ts
import { useEffect, useState } from "react";

const KEY = "GIFTERRA_EMERGENCY_STOP";
const EVT = "gifterra:emergency";

export function setEmergencyFlag(on: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, on ? "1" : "0");
  // 同一タブにも即時反映
  window.dispatchEvent(new Event(EVT));
}

export function readEmergencyFlag(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}

export function useEmergency(): boolean {
  const [flag, setFlag] = useState(false);

  useEffect(() => {
    // 初期値
    setFlag(readEmergencyFlag());

    // 他タブ（storage）＋同一タブ（カスタムイベント）を購読
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setFlag(readEmergencyFlag());
    };
    const onLocal = () => setFlag(readEmergencyFlag());

    window.addEventListener("storage", onStorage);
    window.addEventListener(EVT, onLocal);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVT, onLocal);
    };
  }, []);

  return flag;
}