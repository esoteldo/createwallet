/**
 * Genera un nuevo HighloadWalletV3 e imprime mnemonic + addresses a stdout.
 *
 * NO escribe a disco. NO loguea la private key. El user copia la salida y
 * la sube a SSM SecureString manualmente:
 *
 *   aws ssm put-parameter --name /createwallet/testnet/MNEMONIC \
 *     --value "<mnemonic>" --type SecureString --region us-east-1
 *   aws ssm put-parameter --name /createwallet/testnet/WALLET_ADDRESS \
 *     --value "<address>" --type String --region us-east-1
 *
 * Uso:
 *   npx blueprint run createWallet
 */

import { NetworkProvider } from '@ton/blueprint';
import { generateMnemonic, loadWallet, DEFAULT_SUBWALLET_ID, DEFAULT_TIMEOUT_SECONDS } from '../src';

export async function run(_provider: NetworkProvider) {
    const mnemonic = await generateMnemonic();
    const wallet = await loadWallet({
        mnemonic,
        subwalletId: DEFAULT_SUBWALLET_ID,
        timeout: DEFAULT_TIMEOUT_SECONDS
    });

    console.log('================================================================');
    console.log(' NUEVO WALLET HighloadWalletV3 GENERADO');
    console.log('================================================================');
    console.log('');
    console.log('Mnemonic (24 palabras) -- COPIAR Y SUBIR A SSM AHORA:');
    console.log('  ' + mnemonic.join(' '));
    console.log('');
    console.log('Address bounceable (mainnet format):');
    console.log('  ' + wallet.address);
    console.log('');
    console.log('Address non-bounceable testnet (para fondear desde faucet):');
    console.log('  ' + wallet.addressTestnet);
    console.log('');
    console.log('Address raw:');
    console.log('  ' + wallet.addressRaw);
    console.log('');
    console.log('subwalletId: ' + wallet.subwalletId);
    console.log('timeout (s): ' + wallet.timeout);
    console.log('');
    console.log('Comandos para subir a SSM (ajusta network y nombres):');
    console.log('');
    console.log(`  aws ssm put-parameter --name "/createwallet/testnet/MNEMONIC" --value "${mnemonic.join(' ')}" --type SecureString --region us-east-1`);
    console.log(`  aws ssm put-parameter --name "/createwallet/testnet/WALLET_ADDRESS" --value "${wallet.address}" --type String --region us-east-1`);
    console.log('');
    console.log('Despues fondea la wallet con TON de testnet:');
    console.log('  https://t.me/testgiver_ton_bot');
    console.log('================================================================');
}
