import { toNano } from '@ton/core';
import { WalletContract } from '../wrappers/WalletContract';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const walletContract = provider.open(WalletContract.createFromConfig({}, await compile('WalletContract')));

    await walletContract.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(walletContract.address);

    // run methods on `walletContract`
}
