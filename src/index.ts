/**
 * @cryptolottery/wallet - public exports.
 *
 * Esta es toda la superficie consumible por la Lambda.
 * No exportar nada que no sea explicitamente parte del contrato publico.
 */

// Tipos
export type { Network } from './config';
export type { PayoutItem, SendBatchOptions, SendBatchResult } from './sendBatch';
export type { VerifyResult, VerifyOptions, PayoutStatus } from './verify';
export type { LoadWalletOptions, LoadedWallet } from './wallet';

// Funciones principales
export { sendReferralBatch } from './sendBatch';
export { verifyPayout } from './verify';
export { loadWallet, generateMnemonic, openWallet } from './wallet';
export { createTonClient } from './client';

// Constantes utiles para el caller
export {
    DEFAULT_SUBWALLET_ID,
    DEFAULT_TIMEOUT_SECONDS,
    OP,
    Errors
} from './constants';

export {
    DEFAULT_WORKCHAIN,
    DEFAULT_BATCH_INTERNAL_VALUE,
    CREATED_AT_OFFSET_SECONDS,
    getEndpoint
} from './config';
