import { TonClient } from '@ton/ton';
import { Cell, Transaction, Address } from '@ton/core';

// Retry helper for network requests
async function retry<T>(fn: () => Promise<T>, options: { retries: number; delay: number }): Promise<T> {
    let lastError: Error | undefined;
    for (let i = 0; i < options.retries; i++) {
        try {
            return await fn();
        } catch (e) {
            if (e instanceof Error) lastError = e;
            await new Promise((resolve) => setTimeout(resolve, options.delay));
        }
    }
    throw lastError;
}

// Parse external message to extract query_id and created_at
export function parseExternalMessageBody(body: Cell) {
    try {
        const inner = body.refs[0]!.beginParse();
        inner.skip(32 + 8); // Skip subwalletId and mode
        const queryId = inner.loadUintBig(23);
        const createdAt = inner.loadUint(64);
        
        return { queryId, createdAt };
    } catch (e) {
        return null;
    }
}

// Generic transaction finder with pagination
export async function findTransaction(
    client: TonClient,
    address: Address,
    predicate: (tx: Transaction) => boolean
): Promise<Transaction | null> {
    let lt: string | undefined = undefined;
    let hash: string | undefined = undefined;
    
    while (true) {
        const transactions = await retry(
            () => client.getTransactions(address, {
                hash,
                lt,
                limit: 20,
                archival: true,
            }),
            { delay: 1000, retries: 3 }
        );
        
        if (transactions.length === 0) return null;
        
        const found = transactions.find(predicate);
        if (found) return found;
        
        const last = transactions.at(-1)!;
        lt = last.lt.toString();
        hash = last.hash().toString('base64');
    }
}