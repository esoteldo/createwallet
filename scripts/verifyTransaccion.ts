import { mnemonicToPrivateKey } from '@ton/crypto';
import { HighloadWalletV3 } from '../wrappers/HighloadWalletV3';
import { HighloadQueryId } from '../wrappers/HighloadQuery';
import * as fs from 'fs';
import { NetworkProvider } from '@ton/blueprint';
import { Address, Cell, Transaction } from '@ton/core';
import { TonClient } from '@ton/ton';
import { findTransaction, parseExternalMessageBody } from '../helper/verifyMessages';


export async function run(provider: NetworkProvider) {

    // Load wallet data
const walletData = JSON.parse(fs.readFileSync('.wallet.json', 'utf-8'));
const keyPair = await mnemonicToPrivateKey(walletData.mnemonic.split(' '));

const CODE = Cell.fromBoc(Buffer.from('b5ee9c7241021001000228000114ff00f4a413f4bcf2c80b01020120020d02014803040078d020d74bc00101c060b0915be101d0d3030171b0915be0fa4030f828c705b39130e0d31f018210ae42e5a4ba9d8040d721d74cf82a01ed55fb04e030020120050a02027306070011adce76a2686b85ffc00201200809001aabb6ed44d0810122d721d70b3f0018aa3bed44d08307d721d70b1f0201200b0c001bb9a6eed44d0810162d721d70b15800e5b8bf2eda2edfb21ab09028409b0ed44d0810120d721f404f404d33fd315d1058e1bf82325a15210b99f326df82305aa0015a112b992306dde923033e2923033e25230800df40f6fa19ed021d721d70a00955f037fdb31e09130e259800df40f6fa19cd001d721d70a00937fdb31e0915be270801f6f2d48308d718d121f900ed44d0d3ffd31ff404f404d33fd315d1f82321a15220b98e12336df82324aa00a112b9926d32de58f82301de541675f910f2a106d0d31fd4d307d30cd309d33fd315d15168baf2a2515abaf2a6f8232aa15250bcf2a304f823bbf2a35304800df40f6fa199d024d721d70a00f2649130e20e01fe5309800df40f6fa18e13d05004d718d20001f264c858cf16cf8301cf168e1030c824cf40cf8384095005a1a514cf40e2f800c94039800df41704c8cbff13cb1ff40012f40012cb3f12cb15c9ed54f80f21d0d30001f265d3020171b0925f03e0fa4001d70b01c000f2a5fa4031fa0031f401fa0031fa00318060d721d300010f0020f265d2000193d431d19130e272b1fb00b585bf03', 'hex'))[0];

const client = new TonClient({ 
    endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC', // This is TESTNET endpoint
    // apiKey: 'your-api-key' // Optional: get from @tonapibot or @tontestnetapibot
});

const highloadWallet = HighloadWalletV3.createFromConfig(
    {
        publicKey: keyPair.publicKey,
        subwalletId: walletData.subwalletId,
        timeout: walletData.timeout,
    },
    CODE
);
const wallet = client.open(highloadWallet);

// The query_id and created_at from your transfer
const queryId = HighloadQueryId.fromSeqno(17n);
const createdAt = 1771443323; // Your actual created_at timestamp

// Check if processed
const isProcessed = await wallet.getProcessed(queryId);
if (!isProcessed) {
    console.log('❌ Query not processed');
    return;
}
console.log('✓ Query marked as processed')

// Find external transaction by query_id + created_at
async function findHighloadExternalTransaction(
    client: TonClient,
    walletAddress:  Address,
    queryId: HighloadQueryId,
    createdAt: number
): Promise<Transaction | null> {
    const targetQueryId = queryId.getQueryId();
    
    return findTransaction(client, walletAddress, (tx) => {
        if (tx.inMessage?.info.type !== 'external-in') return false;
        if (!tx.inMessage.body) return false;
        
        const parsed = parseExternalMessageBody(tx.inMessage.body);
        if (!parsed) return false;
        
        return parsed.queryId === targetQueryId && parsed.createdAt === createdAt;
    });
}

const externalTx = await findHighloadExternalTransaction(
    client,
    highloadWallet.address,
    queryId,
    createdAt
);

/* console.log('External transaction:', externalTx); */

if (!externalTx) {
    console.log('❌ External transaction not found');
    return;
}

// Verify external transaction compute phase
if (externalTx.description.type !== 'generic') {
    console.log('❌ Invalid transaction');
    return;
}

const externalCompute = externalTx.description.computePhase;
// @ts-ignore
if (!externalCompute.success || externalCompute.exitCode !== 0) {
    // @ts-ignore
    console.log(`❌ External transaction failed: exit code ${externalCompute.exitCode}`);
    return;
}

console.log('✓ External transaction succeeded');

//chek internal transsaccion 

// Find internal transaction by prevTransactionLt
async function findHighloadInternalTransaction(
    client: TonClient,
    walletAddress: Address,
    externalLt: string
): Promise<Transaction | null> {
    return findTransaction(client, walletAddress, (tx) => 
        tx.prevTransactionLt.toString() === externalLt
    );
}

// Check for outgoing messages
if (externalTx.outMessagesCount === 0) {
    console.log('❌ No outgoing messages from external transaction');
    return;
}

// Find the internal transaction
const internalTx = await findHighloadInternalTransaction(
    client,
    highloadWallet.address,
    externalTx.lt.toString()
);

if (!internalTx || internalTx.description.type !== 'generic') {
    console.log('❌ Internal transaction not found');
    return;
}

// Verify compute phase
if (internalTx.description.computePhase.type !== 'vm') {
    console.log('❌ Compute phase skipped');
    return;
}

const internalCompute = internalTx.description.computePhase;
if (!internalCompute.success || internalCompute.exitCode !== 0) {
    console.log(`❌ Internal transaction failed: exit code ${internalCompute.exitCode}`);
    return;
}

// Verify action phase
if (!internalTx.description.actionPhase) {
    console.log('❌ No action phase in internal transaction');
    return;
}

const action = internalTx.description.actionPhase;
if (!action.success) {
    console.log(`❌ Action phase failed: result code ${action.resultCode}`);
    return;
}

console.log('✓ Internal transaction succeeded');


}

