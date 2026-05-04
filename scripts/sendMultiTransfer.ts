/**
 * Envia un batch de transferencias a mano desde el HighloadWalletV3.
 *
 * Wrapper fino sobre src/sendBatch. Toma inputs por env vars para que sea
 * scriptable y no hardcoded como antes.
 *
 * Uso (PowerShell):
 *   $env:WALLET_MNEMONIC = "palabra1 ... palabra24"
 *   $env:TON_API_KEY = "..."
 *   $env:WALLET_NETWORK = "testnet"
 *   $env:PAYOUT_TO = "EQ...recipient"
 *   $env:PAYOUT_AMOUNT_TON = "0.01"
 *   $env:WALLET_QUERY_ID = "1"
 *   npx blueprint run sendMultiTransfer
 */

import { NetworkProvider } from '@ton/blueprint';
import { toNano } from '@ton/core';
import { sendReferralBatch, Network } from '../src';

export async function run(_provider: NetworkProvider) {
    const mnemonicStr = process.env.WALLET_MNEMONIC;
    const apiKey = process.env.TON_API_KEY;
    const network = (process.env.WALLET_NETWORK || 'testnet') as Network;
    const to = process.env.PAYOUT_TO;
    const amount = process.env.PAYOUT_AMOUNT_TON || '0.01';
    const queryIdStr = process.env.WALLET_QUERY_ID || '1';

    if (!mnemonicStr) throw new Error('WALLET_MNEMONIC env var required (24 words)');
    if (!to) throw new Error('PAYOUT_TO env var required (recipient address)');

    const mnemonic = mnemonicStr.trim().split(/\s+/);
    const queryId = BigInt(queryIdStr);

    const result = await sendReferralBatch(
        [
            { toAddress: to, amountNano: toNano(amount), comment: `manual-${queryIdStr}` }
        ],
        { network, apiKey, mnemonic, queryId }
    );

    console.log('Batch enviado.');
    console.log('  queryId:        ', result.queryId.toString());
    console.log('  createdAt:      ', result.createdAt);
    console.log('  senderAddress:  ', result.senderAddress);
    console.log('');
    console.log('Para verificar en N segundos corre:');
    console.log(`  $env:WALLET_QUERY_ID="${result.queryId}"; $env:WALLET_CREATED_AT="${result.createdAt}"; npx blueprint run verifyTransaccion`);
}
