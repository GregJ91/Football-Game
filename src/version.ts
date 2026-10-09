declare const __APP_BUILD__: string;
declare const __APP_BUILT_AT__: string;

/** Update number 45 was version 1.00; every update since adds 0.01 (1.01, 1.02 … 1.99, then 2.00). */
const FIRST_BUILD = 45;

/** Goes up with every update (the number of commits). */
export const APP_BUILD = __APP_BUILD__;

/** e.g. "1.01". */
export function versionFor(build: number): string {
  const n = Math.max(0, build - FIRST_BUILD);
  return `${1 + Math.floor(n / 100)}.${String(n % 100).padStart(2, '0')}`;
}

export const APP_VERSION = versionFor(Number(__APP_BUILD__) || FIRST_BUILD);

/** When this version was built. */
export const APP_BUILT_AT = new Date(__APP_BUILT_AT__);
