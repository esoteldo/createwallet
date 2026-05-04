/**
 * Constantes del HighloadWalletV3.
 *
 * Movido desde tests/imports/const.ts para que la library no dependa de
 * la carpeta de tests en runtime.
 */

// Subwallet ID por default. Coincide con el valor estandar del HighloadWalletV3.
// Cambiarlo cambia la address derivada del mismo mnemonic.
export const DEFAULT_SUBWALLET_ID = 239;

// Timeout del wallet en segundos. Default conservador (24h) para tener margen
// de retry sin caducidad excesiva. El contrato rechaza external messages cuyo
// createdAt + timeout < now.
export const DEFAULT_TIMEOUT_SECONDS = 60 * 60 * 24;

// Operation codes del contrato.
export enum OP {
    InternalTransfer = 0xae42e5a4
}

// Codigos de error del contrato (para mapeo amigable de fallos en verify).
export abstract class Errors {
    static readonly invalid_signature = 33;
    static readonly invalid_subwallet = 34;
    static readonly invalid_creation_time = 35;
    static readonly already_executed = 36;
}

// Limites del espacio de queryId (23 bits).
export const MAX_KEY_COUNT = 1 << 13;
export const MAX_SHIFT = MAX_KEY_COUNT - 1;
export const MAX_QUERY_COUNT = MAX_KEY_COUNT * 1023;
export const MAX_QUERY_ID = (MAX_SHIFT << 10) + 1022;
