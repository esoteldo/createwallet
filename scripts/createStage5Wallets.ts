/**
 * Genera las 5 wallets de Etapa 5 e imprime los comandos SSM listos
 * para copiar/pegar.
 *
 *   1. lottery   - recibe pagos de tickets
 *   2. winners   - paga premios a ganadores
 *   3. referrals - paga comisiones a referrers
 *   4. servers   - cubre gastos de infra
 *   5. devs      - paga al equipo de desarrollo
 *
 * Cada wallet:
 *   - Mnemonic 24 palabras (NUEVO, independiente de las otras)
 *   - subwalletId = 239 (default HighloadV3)
 *   - timeout = 86400s (24h)
 *
 * NO escribe a disco. NO loguea private keys mas de lo necesario para
 * que el operador las copie. NO toca red.
 *
 * Uso:
 *   npm run create-stage5-wallets
 *
 *   o
 *
 *   npx ts-node scripts/createStage5Wallets.ts
 *
 * Opciones via env:
 *   STAGE=testnet (default) | mainnet  -> nombra parameters como /createwallet/<role>/<stage>/...
 *   ROLES=lottery,winners,referrals,servers,devs (default todas)
 *
 * Output:
 *   - Para cada wallet: mnemonic, addresses (bounceable, testnet, raw)
 *   - Bloque final con TODOS los comandos `aws ssm put-parameter` listos
 *
 * IMPORTANTE:
 *   - Tras correr, BACKUP OFFLINE de los 5 mnemonics ANTES de cerrar terminal.
 *   - Si perdes un mnemonic, perdes acceso a esa wallet on-chain (irrecuperable).
 *   - Despues de subir a SSM, fondea cada wallet con el buffer minimo
 *     (lottery: 1 TON, resto: 0.1 TON cada una. Total ~1.4 TON).
 *   - En testnet, fondea desde https://t.me/testgiver_ton_bot.
 *   - En mainnet, transferi desde tu wallet personal o exchange.
 */

import {
    generateMnemonic,
    loadWallet,
    DEFAULT_SUBWALLET_ID,
    DEFAULT_TIMEOUT_SECONDS
} from '../src';

type Role = 'lottery' | 'winners' | 'referrals' | 'servers' | 'devs';

const ALL_ROLES: Role[] = ['lottery', 'winners', 'referrals', 'servers', 'devs'];

interface GeneratedWallet {
    role: Role;
    mnemonic: string[];
    address: string;
    addressTestnet: string;
    addressRaw: string;
    subwalletId: number;
    timeout: number;
}

async function generateOne(role: Role): Promise<GeneratedWallet> {
    const mnemonic = await generateMnemonic();
    const w = await loadWallet({
        mnemonic,
        subwalletId: DEFAULT_SUBWALLET_ID,
        timeout: DEFAULT_TIMEOUT_SECONDS
    });
    return {
        role,
        mnemonic,
        address: w.address,
        addressTestnet: w.addressTestnet,
        addressRaw: w.addressRaw,
        subwalletId: w.subwalletId,
        timeout: w.timeout
    };
}

function printWallet(w: GeneratedWallet) {
    console.log('================================================================');
    console.log(` WALLET: ${w.role.toUpperCase()}`);
    console.log('================================================================');
    console.log('');
    console.log('Mnemonic (24 palabras) -- BACKUP OFFLINE Y SUBIR A SSM:');
    console.log('  ' + w.mnemonic.join(' '));
    console.log('');
    console.log('Address bounceable (mainnet format):');
    console.log('  ' + w.address);
    console.log('');
    console.log('Address non-bounceable testnet (para faucet testnet):');
    console.log('  ' + w.addressTestnet);
    console.log('');
    console.log('Address raw:');
    console.log('  ' + w.addressRaw);
    console.log('');
    console.log(`subwalletId: ${w.subwalletId}   timeout: ${w.timeout}s`);
    console.log('');
}

function printSsmCommands(wallets: GeneratedWallet[], stage: string, region: string) {
    console.log('================================================================');
    console.log(' COMANDOS SSM (copy/paste manualmente, en orden)');
    console.log(`  stage = ${stage}`);
    console.log(`  region = ${region}`);
    console.log('================================================================');
    console.log('');
    console.log('# Cada wallet expone 3 parameters:');
    console.log('#   /createwallet/<role>/<stage>/MNEMONIC       SecureString');
    console.log('#   /createwallet/<role>/<stage>/WALLET_ADDRESS String');
    console.log('#   /createwallet/<role>/<stage>/SUBWALLET_ID   String');
    console.log('');

    for (const w of wallets) {
        const base = `/createwallet/${w.role}/${stage}`;
        console.log(`# ---- ${w.role} ----`);
        console.log(
            `aws ssm put-parameter --name "${base}/MNEMONIC" ` +
            `--value "${w.mnemonic.join(' ')}" ` +
            `--type SecureString --overwrite --region ${region}`
        );
        console.log(
            `aws ssm put-parameter --name "${base}/WALLET_ADDRESS" ` +
            `--value "${w.address}" ` +
            `--type String --overwrite --region ${region}`
        );
        console.log(
            `aws ssm put-parameter --name "${base}/SUBWALLET_ID" ` +
            `--value "${w.subwalletId}" ` +
            `--type String --overwrite --region ${region}`
        );
        console.log('');
    }
}

function printFundingChecklist(wallets: GeneratedWallet[], stage: string) {
    console.log('================================================================');
    console.log(' CHECKLIST DE FONDEO');
    console.log('================================================================');
    console.log('');
    if (stage === 'testnet') {
        console.log('Testnet faucet: https://t.me/testgiver_ton_bot');
        console.log('Pedile 2 TON al bot por cada wallet (manda la address NON-BOUNCEABLE).');
    } else {
        console.log('Mainnet: transferi desde tu wallet personal o exchange.');
        console.log('Total inicial recomendado: ~1.4 TON.');
    }
    console.log('');
    console.log('Buffers minimos (alarma reconciliation si bajan de esto):');
    for (const w of wallets) {
        const buffer = w.role === 'lottery' ? '1.0' : '0.1';
        const fundAddr = stage === 'testnet' ? w.addressTestnet : w.address;
        console.log(`  [${w.role.padEnd(10)}] ${buffer} TON  ->  ${fundAddr}`);
    }
    console.log('');
}

function printNextSteps(stage: string) {
    console.log('================================================================');
    console.log(' PROXIMOS PASOS');
    console.log('================================================================');
    console.log('');
    console.log('1. BACKUP OFFLINE de los 5 mnemonics (papel + caja fuerte).');
    console.log('   Si perdes un mnemonic, perdes acceso a esa wallet PARA SIEMPRE.');
    console.log('');
    console.log('2. Corre los comandos SSM de arriba.');
    console.log('   Verifica con:');
    console.log(`     aws ssm get-parameters-by-path --path /createwallet --recursive --region us-east-1 --query "Parameters[].Name"`);
    console.log('');
    console.log('3. Fondea cada wallet con el buffer minimo de la checklist.');
    console.log('');
    console.log('4. Despues de Etapa 5.2 desplegada, las wallets se activan');
    console.log('   automaticamente cuando reciben el primer mensaje (HighloadV3');
    console.log('   se auto-deploya en su primer send).');
    console.log('');
    console.log(`5. NO compartas el output de este comando. NO lo subas a git.`);
    console.log(`   Cierra esta terminal apenas hagas el backup.`);
    console.log('');
}

async function main() {
    const stage = (process.env.STAGE || 'testnet').toLowerCase();
    const region = process.env.AWS_REGION || 'us-east-1';
    const rolesEnv = process.env.ROLES;

    let roles: Role[] = ALL_ROLES;
    if (rolesEnv) {
        const requested = rolesEnv.split(',').map(s => s.trim().toLowerCase()) as Role[];
        for (const r of requested) {
            if (!ALL_ROLES.includes(r)) {
                console.error(`Role invalido: ${r}. Validas: ${ALL_ROLES.join(', ')}`);
                process.exit(1);
            }
        }
        roles = requested;
    }

    if (stage !== 'testnet' && stage !== 'mainnet') {
        console.error(`STAGE invalido: ${stage}. Debe ser testnet o mainnet.`);
        process.exit(1);
    }

    console.log('');
    console.log(`Generando ${roles.length} wallet(s) para stage="${stage}"...`);
    console.log(`Roles: ${roles.join(', ')}`);
    console.log('');

    const wallets: GeneratedWallet[] = [];
    for (const role of roles) {
        const w = await generateOne(role);
        wallets.push(w);
        printWallet(w);
    }

    printSsmCommands(wallets, stage, region);
    printFundingChecklist(wallets, stage);
    printNextSteps(stage);
}

main().catch(err => {
    console.error('Error generando wallets:', err);
    process.exit(1);
});
