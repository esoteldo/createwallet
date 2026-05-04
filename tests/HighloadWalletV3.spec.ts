/**
 * Tests sandbox del HighloadWalletV3.
 *
 * Cubre los invariantes que un wallet de payouts NO puede romper:
 *   1. Deploy basico.
 *   2. Send simple: una transferencia se ejecuta.
 *   3. Replay protection: el mismo queryId no se procesa 2 veces.
 *   4. Timeout: createdAt mas viejo que (now - timeout) es rechazado.
 *   5. Firma invalida: otra keypair no puede mover fondos.
 *   6. Subwallet ID invalido: rechazado.
 *   7. Getters basicos.
 *   8. Batch: enviar varios mensajes en uno.
 */

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano, internal as internalRelaxed, SendMode, OutActionSendMsg } from '@ton/core';
import { compile } from '@ton/blueprint';
import { mnemonicNew, mnemonicToPrivateKey, KeyPair } from '@ton/crypto';
import '@ton/test-utils';

import { HighloadWalletV3 } from '../wrappers/HighloadWalletV3';
import { HighloadQueryId } from '../wrappers/HighloadQuery';
import { Errors } from '../src/constants';

const SUBWALLET_ID = 239;
const TIMEOUT = 60 * 60 * 24; // 24h

describe('HighloadWalletV3', () => {
    let code: Cell;
    let keyPair: KeyPair;

    beforeAll(async () => {
        code = await compile('HighloadWalletV3');
        keyPair = await mnemonicToPrivateKey(await mnemonicNew(24));
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let recipient: SandboxContract<TreasuryContract>;
    let wallet: SandboxContract<HighloadWalletV3>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        // Anclamos el "now" del sandbox a un valor conocido para que los
        // tests de timeout sean deterministicos.
        blockchain.now = Math.floor(Date.now() / 1000);

        deployer = await blockchain.treasury('deployer');
        recipient = await blockchain.treasury('recipient');

        wallet = blockchain.openContract(
            HighloadWalletV3.createFromConfig(
                {
                    publicKey: keyPair.publicKey,
                    subwalletId: SUBWALLET_ID,
                    timeout: TIMEOUT
                },
                code
            )
        );

        const deployResult = await wallet.sendDeploy(deployer.getSender(), toNano('10'));
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: wallet.address,
            deploy: true,
            success: true
        });
    });

    // ---------- 1. Deploy ----------
    it('debe desplegarse y exponer la publicKey configurada', async () => {
        const onChainKey = await wallet.getPublicKey();
        expect(onChainKey.toString('hex')).toBe(keyPair.publicKey.toString('hex'));
    });

    // ---------- 2. Send simple ----------
    it('debe enviar un internal message a un destinatario', async () => {
        const queryId = HighloadQueryId.fromQueryId(1n);
        const createdAt = blockchain.now! - 30;

        const message: OutActionSendMsg = {
            type: 'sendMsg',
            mode: SendMode.PAY_GAS_SEPARATELY,
            outMsg: internalRelaxed({
                to: recipient.address,
                value: toNano('0.5'),
                bounce: false
            })
        };

        const result = await wallet.sendBatch(
            keyPair.secretKey,
            [message],
            SUBWALLET_ID,
            queryId,
            TIMEOUT,
            createdAt,
            toNano('0.01')
        );

        expect(result.transactions).toHaveTransaction({
            from: wallet.address,
            to: recipient.address,
            success: true,
            value: toNano('0.5')
        });

        const processed = await wallet.getProcessed(queryId);
        expect(processed).toBe(true);
    });

    // ---------- 3. Replay protection ----------
    // En TON, los external messages que no pasan validacion ANTES de
    // accept_message no quedan persistidos como tx fallida: el sandbox
    // tira excepcion 'External message not accepted by smart contract'
    // con 'Exit code: N'. Por eso los tests negativos verifican que
    // sendBatch RECHAZA (rejects) con el exit code esperado.
    it('debe rechazar el mismo queryId enviado dos veces (already_executed)', async () => {
        const queryId = HighloadQueryId.fromQueryId(7n);
        const createdAt = blockchain.now! - 30;
        const message: OutActionSendMsg = {
            type: 'sendMsg',
            mode: SendMode.PAY_GAS_SEPARATELY,
            outMsg: internalRelaxed({
                to: recipient.address,
                value: toNano('0.1'),
                bounce: false
            })
        };

        // Primer envio: OK
        await wallet.sendBatch(
            keyPair.secretKey,
            [message],
            SUBWALLET_ID,
            queryId,
            TIMEOUT,
            createdAt,
            toNano('0.01')
        );
        expect(await wallet.getProcessed(queryId)).toBe(true);

        // Segundo envio con mismo queryId: rechazado con exit 36.
        await expect(
            wallet.sendBatch(
                keyPair.secretKey,
                [message],
                SUBWALLET_ID,
                queryId,
                TIMEOUT,
                createdAt,
                toNano('0.01')
            )
        ).rejects.toThrow(new RegExp(`Exit code: ${Errors.already_executed}`));
    });

    // ---------- 4. Timeout ----------
    it('debe rechazar createdAt mas viejo que (now - timeout) [invalid_creation_time]', async () => {
        const queryId = HighloadQueryId.fromQueryId(2n);
        const expiredCreatedAt = blockchain.now! - TIMEOUT - 60;

        const message: OutActionSendMsg = {
            type: 'sendMsg',
            mode: SendMode.PAY_GAS_SEPARATELY,
            outMsg: internalRelaxed({
                to: recipient.address,
                value: toNano('0.1'),
                bounce: false
            })
        };

        await expect(
            wallet.sendBatch(
                keyPair.secretKey,
                [message],
                SUBWALLET_ID,
                queryId,
                TIMEOUT,
                expiredCreatedAt,
                toNano('0.01')
            )
        ).rejects.toThrow(new RegExp(`Exit code: ${Errors.invalid_creation_time}`));

        expect(await wallet.getProcessed(queryId)).toBe(false);
    });

    // ---------- 5. Firma invalida ----------
    it('debe rechazar mensajes firmados con otra keypair [invalid_signature]', async () => {
        const otherKeyPair = await mnemonicToPrivateKey(await mnemonicNew(24));
        const queryId = HighloadQueryId.fromQueryId(3n);
        const createdAt = blockchain.now! - 30;

        const message: OutActionSendMsg = {
            type: 'sendMsg',
            mode: SendMode.PAY_GAS_SEPARATELY,
            outMsg: internalRelaxed({
                to: recipient.address,
                value: toNano('0.1'),
                bounce: false
            })
        };

        await expect(
            wallet.sendBatch(
                otherKeyPair.secretKey,    // <-- llave incorrecta
                [message],
                SUBWALLET_ID,
                queryId,
                TIMEOUT,
                createdAt,
                toNano('0.01')
            )
        ).rejects.toThrow(new RegExp(`Exit code: ${Errors.invalid_signature}`));

        expect(await wallet.getProcessed(queryId)).toBe(false);
    });

    // ---------- 6. Subwallet ID invalido ----------
    it('debe rechazar subwalletId distinto al configurado [invalid_subwallet]', async () => {
        const queryId = HighloadQueryId.fromQueryId(4n);
        const createdAt = blockchain.now! - 30;
        const wrongSubwallet = SUBWALLET_ID + 1;

        const message: OutActionSendMsg = {
            type: 'sendMsg',
            mode: SendMode.PAY_GAS_SEPARATELY,
            outMsg: internalRelaxed({
                to: recipient.address,
                value: toNano('0.1'),
                bounce: false
            })
        };

        await expect(
            wallet.sendBatch(
                keyPair.secretKey,
                [message],
                wrongSubwallet,             // <-- mal subwallet
                queryId,
                TIMEOUT,
                createdAt,
                toNano('0.01')
            )
        ).rejects.toThrow(new RegExp(`Exit code: ${Errors.invalid_subwallet}`));
    });

    // ---------- 7. Getters basicos ----------
    it('getters: subwalletId y timeout deben coincidir con el config', async () => {
        const sw = await wallet.getSubwalletId();
        const t = await wallet.getTimeout();
        expect(sw).toBe(SUBWALLET_ID);
        expect(t).toBe(TIMEOUT);
    });

    // ---------- 8. Batch de varios mensajes ----------
    it('debe ejecutar un batch de 5 transferencias en un solo external', async () => {
        const queryId = HighloadQueryId.fromQueryId(10n);
        const createdAt = blockchain.now! - 30;
        const recipients: SandboxContract<TreasuryContract>[] = [];
        for (let i = 0; i < 5; i++) {
            recipients.push(await blockchain.treasury(`r${i}`));
        }

        const messages: OutActionSendMsg[] = recipients.map(r => ({
            type: 'sendMsg' as const,
            mode: SendMode.PAY_GAS_SEPARATELY,
            outMsg: internalRelaxed({
                to: r.address,
                value: toNano('0.1'),
                bounce: false
            })
        }));

        const result = await wallet.sendBatch(
            keyPair.secretKey,
            messages,
            SUBWALLET_ID,
            queryId,
            TIMEOUT,
            createdAt,
            toNano('0.05')
        );

        // Cada recipient debe haber recibido su mensaje.
        for (const r of recipients) {
            expect(result.transactions).toHaveTransaction({
                from: wallet.address,
                to: r.address,
                success: true,
                value: toNano('0.1')
            });
        }
        expect(await wallet.getProcessed(queryId)).toBe(true);
    });
});
