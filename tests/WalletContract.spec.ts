import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { WalletContract } from '../wrappers/WalletContract';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('WalletContract', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('WalletContract');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let walletContract: SandboxContract<WalletContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        walletContract = blockchain.openContract(WalletContract.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await walletContract.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: walletContract.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and walletContract are ready to use
    });
});
