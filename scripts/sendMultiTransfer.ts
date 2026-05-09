/**
 * Envia un batch de transferencias a mano desde el HighloadWalletV3.
 *
 * Wrapper fino sobre src/sendBatch. Toma inputs por env vars para que sea
 * scriptable. NO usa Blueprint (es standalone).
 *
 * Uso:
 *   $env:WALLET_MNEMONIC = "palabra1 ... palabra24"
 *   $env:TON_API_KEY = "..."
 *   $env:WALLET_NETWORK = "testnet"
 *   $env:PAYOUT_TO = "0Q...recipient"
 *   $env:PAYOUT_AMOUNT_TON = "0.05"
 *   $env:WALLET_QUERY_ID = "1"
 *   npm run send-batch
 */

import { toNano } from '@ton/core';
import { sendReferralBatch, Network } from '../src';

async function main() {
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

    console.log(`Network:    ${network}`);
    console.log(`Recipient:  ${to}`);
    console.log(`Amount:     ${amount} TON`);
    console.log(`Query ID:   ${queryIdStr}`);
    console.log('Enviando...');

    const result = await sendReferralBatch(
        [
            { toAddress: to, amountNano: toNano(amount), comment: `manual-${queryIdStr}` }
        ],
        { network, apiKey, mnemonic, queryId }
    );

    console.log('');
    console.log('Batch enviado.');
    console.log('  queryId:        ', result.queryId.toString());
    console.log('  createdAt:      ', result.createdAt);
    console.log('  senderAddress:  ', result.senderAddress);
    console.log('');
    console.log('Para verificar en ~30s corre:');
    console.log(`  $env:WALLET_QUERY_ID="${result.queryId}"; $env:WALLET_CREATED_AT="${result.createdAt}"; npm run verify-payout`);
}

main().catch(err => {
    console.error('Error en send batch:', err);
    process.exit(1);
});
