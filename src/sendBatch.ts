/**
 * Envio de batch de payouts on-chain.
 *
 * Esta es la funcion que la Lambda payReferral va a llamar.
 *
 * Contrato:
 *   - Recibe items + opciones (incluyendo queryId monotonico desde DB).
 *   - Firma y envia el external message al HighloadWalletV3.
 *   - Devuelve { queryId, createdAt, externalMessageHash } para que la
 *     fila de ReferralPayout los persista y `verifyPayout` los use despues.
 *   - NO bloquea esperando confirmacion. La verificacion es trabajo de
 *     verifyPayout (puede tardar 30s-2min).
 */

import { internal, toNano, comment } from '@ton/ton';
import { OutActionSendMsg, SendMode } from '@ton/core';
import { createTonClient } from './client';
import { loadWallet, openWallet } from './wallet';
import { HighloadQueryId } from '../wrappers/HighloadQuery';
import { Network, DEFAULT_BATCH_INTERNAL_VALUE, CREATED_AT_OFFSET_SECONDS } from './config';

export interface PayoutItem {
    /** Address destino (bounceable o no, formato amigable). */
    toAddress: string;
    /** Monto en nano-TON (1 TON = 10^9). bigint para precision exacta. */
    amountNano: bigint;
    /** Comentario opcional adjunto al mensaje (visible en explorer). */
    comment?: string;
    /** Si bounce el mensaje cuando el destino no existe. Default false (sender no recupera). */
    bounce?: boolean;
}

export interface SendBatchOptions {
    network: Network;
    apiKey?: string;
    /** 24 palabras. Cargadas desde SSM por el caller. */
    mnemonic: string[];
    /** queryId monotonico. La DB lo asigna con $inc atomico. */
    queryId: bigint;
    /** Override opcional. Si no se pasa, se calcula como now - 30s. */
    createdAt?: number;
    /** Override opcional. Si no se pasa, usa default 239. */
    subwalletId?: number;
    /** Override opcional del timeout del wallet (segundos). Default 24h. */
    timeout?: number;
    /** Valor (en TON) que se envia al internal-transfer del wallet a si mismo
     *  para cubrir compute fee del receiver. Default 0.0007024. */
    internalValue?: number;
}

export interface SendBatchResult {
    queryId: bigint;
    createdAt: number;
    senderAddress: string;
}

/**
 * Empaqueta items, firma y envia.
 *
 * Idempotencia: si el mismo queryId ya fue procesado por el contrato,
 * el envio fallara con error 36 (already_executed). El caller (Lambda)
 * debe interpretar eso como "ya se pago, marcar como paid" y NO como un
 * error fatal.
 *
 * Concurrencia: el queryId DEBE ser unico por envio. Reusarlo dentro de la
 * ventana de timeout (24h) es double-spend. La DB es la fuente de verdad
 * del counter.
 */
export async function sendReferralBatch(
    items: PayoutItem[],
    opts: SendBatchOptions
): Promise<SendBatchResult> {
    if (items.length === 0) throw new Error('items must not be empty');
    if (items.length > 254) {
        // sendBatch del wrapper soporta recursion, pero por seguridad cortamos.
        // En produccion la Lambda chunkea desde antes.
        throw new Error('items must not exceed 254 per batch');
    }

    // 1. Cargar wallet
    const wallet = await loadWallet({
        mnemonic: opts.mnemonic,
        subwalletId: opts.subwalletId,
        timeout: opts.timeout
    });

    // 2. Cliente TON + abrir contrato
    const client = createTonClient({ network: opts.network, apiKey: opts.apiKey });
    const opened = openWallet(client, wallet);

    // 3. Construir mensajes internos
    const messages: OutActionSendMsg[] = items.map(item => ({
        type: 'sendMsg' as const,
        mode: SendMode.PAY_GAS_SEPARATELY,
        outMsg: internal({
            to: item.toAddress,
            value: item.amountNano,
            body: item.comment ? comment(item.comment) : undefined,
            bounce: item.bounce ?? false
        })
    }));

    // 4. Construir queryId + createdAt
    const queryId = HighloadQueryId.fromQueryId(opts.queryId);
    const createdAt = opts.createdAt ?? Math.floor(Date.now() / 1000) - CREATED_AT_OFFSET_SECONDS;
    const internalValue = toNano((opts.internalValue ?? DEFAULT_BATCH_INTERNAL_VALUE).toString());

    // 5. Enviar
    await opened.sendBatch(
        wallet.keyPair.secretKey,
        messages,
        wallet.subwalletId,
        queryId,
        wallet.timeout,
        createdAt,
        internalValue
    );

    return {
        queryId: queryId.getQueryId(),
        createdAt,
        senderAddress: wallet.address
    };
}
