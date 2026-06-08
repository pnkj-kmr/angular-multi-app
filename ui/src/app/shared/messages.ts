/**
 * Shell <-> v2 iframe message contract (docs/app1.md Phase 5).
 *
 * This file is intentionally framework-free and is DUPLICATED verbatim in the
 * v2 app (ui_oss/src/app/shared/messages.ts). In production this should become a
 * single shared package imported by both apps. Keep the two copies in sync and
 * bump PROTOCOL_VERSION on any breaking change.
 */
export const PROTOCOL_VERSION = 1;

export type Feature = string;

/** Messages the shell sends down into the v2 iframe. */
export type ShellToV2 = {
  v: number;
  type: 'shell:navigate';
  feature: Feature;
};

/** Messages the v2 app sends up to the shell. */
export type V2ToShell =
  | { v: number; type: 'v2:ready'; protocolVersion: number }
  | { v: number; type: 'v2:navigated'; feature: Feature }
  | { v: number; type: 'v2:auth-expired' };

export function isShellToV2(data: unknown): data is ShellToV2 {
  return (
    !!data &&
    typeof data === 'object' &&
    (data as any).type === 'shell:navigate' &&
    typeof (data as any).feature === 'string'
  );
}

export function isV2ToShell(data: unknown): data is V2ToShell {
  if (!data || typeof data !== 'object') return false;
  const t = (data as any).type;
  return t === 'v2:ready' || t === 'v2:navigated' || t === 'v2:auth-expired';
}
