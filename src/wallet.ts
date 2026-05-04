/**
 * Carga de wallet a partir del mnemonic.
 *
 * No lee de disco, no escribe nada. Todo entra por parametro y todo
 * sale por valor. Esto es lo que la Lambda invoca con el mnemonic
 * traido de SSM.
 */

import { OpenedContract } from '@ton/core';
import { mnemonicToPrivateKey, mnemonicNew, KeyPair } from '@ton/crypto';
import { TonClient } from '@ton/ton';
import { HighloadWalletV3 } from '../wrappers/HighloadWalletV3';
import { getHighloadWalletV3Code } from './compiled';
import { DEFAULT_SUBWALLET_ID, DEFAULT_TIMEOUT_SECONDS } from './constants';
import { DEFAULT_WORKCHAIN } from './config';

export interface LoadWalletOptions {
    mnemonic: string[];        // 24 palabras
    subwalletId?: number;      // default 239
    timeout?: number;          // segundos, default 86400 (24h)
    workchain?: number;        // default 0 (basechain)
}

export interface LoadedWallet {
    keyPair: KeyPair;
    contract: HighloadWalletV3;
    address: string;           // user-friendly bounceable
    addressTestnet: string;    // user-friendly non-bounceable testnet
    addressRaw: string;        // raw 0:abcd... (para querys)
    subwalletId: number;
    timeout: number;
}

/**
 * Deriva keypair, recompone el contrato y devuelve un objeto inmutable
 * con todo lo que el caller necesita para firmar y enviar.
 *
 * NO firma, NO envia, NO toca red. Solo deriva.
 */
export async function loadWallet(opts: LoadWalletOptions): Promise<LoadedWallet> {
    if (!Array.isArray(opts.mnemonic) || opts.mnemonic.length !== 24) {
        throw new Error('mnemonic must be an array of 24 words');
    }
    const subwalletId = opts.subwalletId ?? DEFAULT_SUBWALLET_ID;
    const timeout = opts.timeout ?? DEFAULT_TIMEOUT_SECONDS;
    const workchain = opts.workchain ?? DEFAULT_WORKCHAIN;

    const keyPair = await mnemonicToPrivateKey(opts.mnemonic);
    const contract = HighloadWalletV3.createFromConfig(
        {
            publicKey: keyPair.publicKey,
            subwalletId,
            timeout
        },
        getHighloadWalletV3Code(),
        workchain
    );

    return {
        keyPair,
        contract,
        address: contract.address.toString({ bounceable: true, testOnly: false }),
        addressTestnet: contract.address.toString({ bounceable: false, testOnly: true }),
        addressRaw: contract.address.toRawString(),
        subwalletId,
        timeout
    };
}

/**
 * Helper para abrir el contrato con un TonClient ya creado.
 * Devuelve el OpenedContract listo para getters / sendBatch.
 */
export function openWallet(client: TonClient, wallet: LoadedWallet): OpenedContract<HighloadWalletV3> {
    return client.open(wallet.contract);
}

/**
 * Genera un nuevo mnemonic de 24 palabras. Usado SOLO por el script
 * de generacion. La library en runtime nunca llama esto.
 */
export async function generateMnemonic(): Promise<string[]> {
    return mnemonicNew(24);
}
