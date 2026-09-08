import type { WifiAuthType } from '@/types/config';

export function escapeWifiField(value: string): string {
  return value.replace(/([\\;,":])/g, '\\$1');
}

export function buildWifiString(ssid: string, password: string, authType: WifiAuthType, hidden: boolean): string {
  const t = authType === 'nopass' ? 'nopass' : authType;
  const s = escapeWifiField(ssid);
  const p = authType === 'nopass' ? '' : escapeWifiField(password);
  const h = hidden ? 'true' : 'false';
  return `WIFI:T:${t};S:${s};P:${p};H:${h};;`;
}
