/**
 * Verifica si un payout (queryId+createdAt) fue procesado on-chain.
 *
 * Wrapper fino sobre src/verify. NO usa Blueprint (es standalone).
 *
 * Uso:
 *   $env:WALLET_ADDRESS = "EQ..."
 *   $env:WALLET_NETWORK = "testnet"
 *   $env:TON_API_KEY = "..."
 *   $env:WALLET_QUERY_ID = "1"
 *   $env:WALLET_CREATED_AT = "1700000000"
 *   npm run verify-payout
 */

import { verifyPayout, Network } from '../src';

async function main() {
    const walletAddress = process.env.WALLET_ADDRESS;
    const network = (process.env.WALLET_NETWORK || 'testnet') as Network;
    const apiKey = process.env.TON_API_KEY;
    const queryIdStr = process.env.WALLET_QUERY_ID;
    const createdAtStr = process.env.WALLET_CREATED_AT;

    if (!walletAddress) throw new Error('WALLET_ADDRESS env var required');
    if (!queryIdStr) throw new Error('WALLET_QUERY_ID env var required');
    if (!createdAtStr) throw new Error('WALLET_CREATED_AT env var required');

    const result = await verifyPayout({
        walletAddress,
        network,
        apiKey,
        queryId: BigInt(queryIdStr),
        createdAt: parseInt(createdAtStr, 10)
    });

    console.log('Verificacion:');
    console.log('  status:        ', result.status);
    if (result.txHash) console.log('  txHash:        ', result.txHash);
    if (result.lt) console.log('  lt:            ', result.lt);
    if (result.exitCode !== undefined) console.log('  exitCode:      ', result.exitCode);
    if (result.failureReason) console.log('  failureReason: ', result.failureReason);
}

main().catch(err => {
    console.error('Error verificando:', err);
    process.exit(1);
});
