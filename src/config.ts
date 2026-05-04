/**
 * Configuracion de red para la library.
 *
 * Sin valores hardcoded de wallets ni keys. Todos los secretos llegan por
 * parametro al momento de invocar (cargados desde SSM / env por el caller).
 */

export type Network = 'mainnet' | 'testnet';

const ENDPOINTS: Record<Network, string> = {
    mainnet: 'https://toncenter.com/api/v2/jsonRPC',
    testnet: 'https://testnet.toncenter.com/api/v2/jsonRPC'
};

export function getEndpoint(network: Network): string {
    return ENDPOINTS[network];
}

// Workchain por default. 0 = basechain (lo normal). -1 seria masterchain.
export const DEFAULT_WORKCHAIN = 0;

// Valor por default para el internal-transfer del wallet a si mismo cuando
// hace el batch. Cubre la fee de compute interno. Conservador.
export const DEFAULT_BATCH_INTERNAL_VALUE = 0.0007024; // TON

// Margen de tiempo (segundos) que se resta al createdAt para evitar
// rechazos por clock skew entre el cliente y los nodos TON.
export const CREATED_AT_OFFSET_SECONDS = 30;
