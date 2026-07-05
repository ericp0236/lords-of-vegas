"use client";

import { useSyncExternalStore } from "react";
import { soundSettings, type SoundSettings } from "./SoundManager";

const getServerSnapshot = (): SoundSettings => soundSettings.get();

/** Reactive sound settings (mute state etc.) for UI controls. */
export function useSoundSettings(): SoundSettings {
  return useSyncExternalStore(
    (cb) => soundSettings.subscribe(cb),
    () => soundSettings.get(),
    getServerSnapshot,
  );
}
