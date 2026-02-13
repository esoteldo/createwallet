import {
    Address,
    beginCell,
    Cell,
    Contract,
    ContractABI,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode
} from '@ton/core';

export type WalletContractConfig = {};

export function walletContractConfigToCell(config: WalletContractConfig): Cell {
    return beginCell().endCell();
}

export class WalletContract implements Contract {
    abi: ContractABI = { name: 'WalletContract' }

    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new WalletContract(address);
    }

    static createFromConfig(config: WalletContractConfig, code: Cell, workchain = 0) {
        const data = walletContractConfigToCell(config);
        const init = { code, data };
        return new WalletContract(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}
