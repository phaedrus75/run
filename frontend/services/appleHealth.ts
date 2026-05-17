/**
 * TypeScript resolution shim — Metro picks `.ios.ts` / `.android.ts`
 * at bundle time. This file satisfies the compiler for shared imports.
 */
export * from './appleHealth.ios';
