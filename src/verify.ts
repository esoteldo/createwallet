/**
 * Verificacion on-chain de que un payout (queryId+createdAt) fue procesado.
 *
 * La Lambda payReferral llama esto despues de N segundos del envio para
 * mover ReferralPayout de 'processing' a 'paid' o 'failed'.
 */

import { Address, Cell, Transaction } from '@ton/core';
import { TonClient } from '@ton/ton';
import { createTonClient } from './client';
import { HighloadWalletV3 } from '../wrappers/HighloadWalletV3';
import { HighloadQueryId } from '../wrappers/HighloadQuery';
import { Network } from './config';

export type PayoutStatus = 'paid' | 'failed' | 'pending' | 'expired';

export interface VerifyResult {
    status: PayoutStatus;
    txHash?: string;
    lt?: string;
    /** Codigo de salida de la VM si fallo (0 = ok, otro = error). */
    exitCode?: number;
    /** Razon human-readable cuando status='failed'. */
    failureReason?: string;
}

export interface VerifyOptions {
    network: Network;
    apiKey?: string;
    /** Address del HighloadWalletV3 que envio el batch (formato amigable). */
    walletAddress: string;
    queryId: bigint;
    createdAt: number;
    /** Si pasaron mas de timeout segundos sin verificar, consideramos expirado.
     *  Default 24h (mismo timeout del contrato). */
    expiryTimeoutSeconds?: number;
}

// Helpers ------------------------------------------------------------------

async function retry<T>(fn: () => Promise<T>, retries: number, delayMs: number): Promise<T> {
    let lastError: Error | undefined;
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (e) {
            if (e instanceof Error) lastError = e;
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    throw lastError ?? new Error('retry exhausted');
}

/**
 * Parsea el body de un external message del HighloadWalletV3 para extraer
 * queryId y createdAt. Layout (despues de la signature en ref[0]):
 *   subwalletId(32) + ref[messageCell] + mode(8) + queryId(23) + createdAt(64) + timeout(22)
 */
function parseExternalMessageBody(body: Cell): { queryId: bigint; createdAt: number } | null {
    try {
        const inner = body.refs[0]!.beginParse();
        inner.skip(32);          // subwalletId
        inner.loadRef();         // messageCell ref
        inner.skip(8);           // mode
        const queryId = inner.loadUintBig(23);
        const createdAt = inner.loadUint(64);
        return { queryId, createdAt };
    } catch {
        return null;
    }
}

async function findTransaction(
    client: TonClient,
    address: Address,
    predicate: (tx: Transaction) => boolean,
    maxPages = 10
): Promise<Transaction | null> {
    let lt: string | undefined = undefined;
    let hash: string | undefined = undefined;

    for (let page = 0; page < maxPages; page++) {
        const txs = await retry(
            () => client.getTransactions(address, {
                hash,
                lt,
                limit: 20,
                archival: true
            }),
            3, 1000
        );
        if (txs.length === 0) return null;

        const found = txs.find(predicate);
        if (found) return found;

        const last = txs.at(-1)!;
        lt = last.lt.toString();
        hash = last.hash().toString('base64');
    }
    return null;
}

// Main ---------------------------------------------------------------------

/**
 * Verifica el estado del payout siguiendo este orden:
 *   1. Pregunta al contrato si processed?(queryId). Si no -> 'pending' o 'expired'.
 *   2. Busca la external transaction por (queryId, createdAt). Verifica que
 *      compute phase exitio con success.
 *   3. Encuentra la internal transaction asociada (prevTransactionLt) y
 *      verifica compute + action phase exitosos.
 *   4. Solo si todo lo anterior pasa -> 'paid'.
 */
export async function verifyPayout(opts: VerifyOptions): Promise<VerifyResult> {
    const expiry = opts.expiryTimeoutSeconds ?? 60 * 60 * 24;
    const now = Math.floor(Date.now() / 1000);

    const client = createTonClient({ network: opts.network, apiKey: opts.apiKey });
    const address = Address.parse(opts.walletAddress);
    const wallet = client.open(HighloadWalletV3.createFromAddress(address));

    const queryId = HighloadQueryId.fromQueryId(opts.queryId);

    // 1. processed?
    let isProcessed: boolean;
    try {
        isProcessed = await wallet.getProcessed(queryId);
    } catch (e) {
        return { status: 'pending', failureReason: `getProcessed error: ${(e as Error).message}` };
    }

    if (!isProcessed) {
        // Si la ventana del contrato (timeout) ya paso, no se va a procesar mas.
        if (now > opts.createdAt + expiry) {
            return { status: 'expired', failureReason: 'queryId not processed within timeout window' };
        }
        return { status: 'pending' };
    }

    // 2. Buscar external tx
    const targetQueryId = queryId.getQueryId();
    const externalTx = await findTransaction(client, address, tx => {
        if (tx.inMessage?.info.type !== 'external-in') return false;
        if (!tx.inMessage.body) return false;
        const parsed = parseExternalMessageBody(tx.inMessage.body);
        if (!parsed) return false;
        return parsed.queryId === targetQueryId && parsed.createdAt === opts.createdAt;
    });

    if (!externalTx) {
        return { status: 'failed', failureReason: 'external transaction not found' };
    }

    if (externalTx.description.type !== 'generic') {
        return { status: 'failed', failureReason: 'external tx description not generic' };
    }

    const externalCompute = externalTx.description.computePhase;
    if (externalCompute.type !== 'vm') {
        return { status: 'failed', failureReason: 'external compute phase skipped' };
    }
    if (!externalCompute.success || externalCompute.exitCode !== 0) {
        return {
            status: 'failed',
            failureReason: `external compute failed exit=${externalCompute.exitCode}`,
            exitCode: externalCompute.exitCode
        };
    }

    // 3. Buscar internal tx asociada
    if (externalTx.outMessagesCount === 0) {
        return { status: 'failed', failureReason: 'no outgoing messages from external tx' };
    }

    const internalTx = await findTransaction(client, address, tx =>
        tx.prevTransactionLt.toString() === externalTx.lt.toString()
    );

    if (!internalTx || internalTx.description.type !== 'generic') {
        return { status: 'failed', failureReason: 'internal transaction not found' };
    }

    if (internalTx.description.computePhase.type !== 'vm') {
        return { status: 'failed', failureReason: 'internal compute phase skipped' };
    }

    const internalCompute = internalTx.description.computePhase;
    if (!internalCompute.success || internalCompute.exitCode !== 0) {
        return {
            status: 'failed',
            failureReason: `internal compute failed exit=${internalCompute.exitCode}`,
            exitCode: internalCompute.exitCode
        };
    }

    if (!internalTx.description.actionPhase) {
        return { status: 'failed', failureReason: 'no action phase' };
    }

    if (!internalTx.description.actionPhase.success) {
        return {
            status: 'failed',
            failureReason: `action phase failed code=${internalTx.description.actionPhase.resultCode}`
        };
    }

    return {
        status: 'paid',
        txHash: externalTx.hash().toString('base64'),
        lt: externalTx.lt.toString()
    };
}
