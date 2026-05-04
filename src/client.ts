/**
 * Factory de TonClient. Encapsula la decision de network + apiKey.
 */

import { TonClient } from '@ton/ton';
import { getEndpoint, Network } from './config';

export interface ClientOptions {
    network: Network;
    apiKey?: string; // recomendado en mainnet/testnet para evitar rate-limits
}

export function createTonClient(opts: ClientOptions): TonClient {
    return new TonClient({
        endpoint: getEndpoint(opts.network),
        apiKey: opts.apiKey
    });
}
