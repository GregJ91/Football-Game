declare const __APP_VERSION__: string;
declare const __APP_BUILD__: string;
declare const __APP_BUILT_AT__: string;

/** e.g. "1.0", from package.json. */
export const APP_VERSION = __APP_VERSION__.replace(/\.0$/, '');
/** Goes up with every update. */
export const APP_BUILD = __APP_BUILD__;
/** When this version was built. */
export const APP_BUILT_AT = new Date(__APP_BUILT_AT__);
