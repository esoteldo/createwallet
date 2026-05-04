/**
 * BoC hex del HighloadWalletV3 compilado.
 *
 * Centralizado aca para que la library tenga UN solo punto de verdad.
 * Antes este hex estaba duplicado inline en 4 scripts -- riesgo garantizado
 * de drift al modificar el contrato.
 *
 * En una iteracion futura conviene reemplazar la constante por:
 *
 *   import { hex as CodeHex } from '../build/HighloadWalletV3.compiled.json';
 *
 * (output de `npx blueprint build`). Por ahora el hex inline es lo que
 * ya estaba en uso y funciona; cambiarlo a build/ requiere asegurar que
 * el contrato compilado bit-a-bit produce el mismo hex.
 */

import { Cell } from '@ton/core';

const HIGHLOAD_WALLET_V3_HEX =
    'b5ee9c7241021001000228000114ff00f4a413f4bcf2c80b01020120020d02014803040078d020d74bc00101c060b0915be101d0d3030171b0915be0fa4030f828c705b39130e0d31f018210ae42e5a4ba9d8040d721d74cf82a01ed55fb04e030020120050a02027306070011adce76a2686b85ffc00201200809001aabb6ed44d0810122d721d70b3f0018aa3bed44d08307d721d70b1f0201200b0c001bb9a6eed44d0810162d721d70b15800e5b8bf2eda2edfb21ab09028409b0ed44d0810120d721f404f404d33fd315d1058e1bf82325a15210b99f326df82305aa0015a112b992306dde923033e2923033e25230800df40f6fa19ed021d721d70a00955f037fdb31e09130e259800df40f6fa19cd001d721d70a00937fdb31e0915be270801f6f2d48308d718d121f900ed44d0d3ffd31ff404f404d33fd315d1f82321a15220b98e12336df82324aa00a112b9926d32de58f82301de541675f910f2a106d0d31fd4d307d30cd309d33fd315d15168baf2a2515abaf2a6f8232aa15250bcf2a304f823bbf2a35304800df40f6fa199d024d721d70a00f2649130e20e01fe5309800df40f6fa18e13d05004d718d20001f264c858cf16cf8301cf168e1030c824cf40cf8384095005a1a514cf40e2f800c94039800df41704c8cbff13cb1ff40012f40012cb3f12cb15c9ed54f80f21d0d30001f265d3020171b0925f03e0fa4001d70b01c000f2a5fa4031fa0031f401fa0031fa00318060d721d300010f0020f265d2000193d431d19130e272b1fb00b585bf03';

// Lazy: parseamos una sola vez y cacheamos. Cell.fromBoc no es trivialmente
// barato.
let cachedCode: Cell | null = null;

export function getHighloadWalletV3Code(): Cell {
    if (cachedCode) return cachedCode;
    cachedCode = Cell.fromBoc(Buffer.from(HIGHLOAD_WALLET_V3_HEX, 'hex'))[0];
    return cachedCode;
}

export const HIGHLOAD_WALLET_V3_HEX_CODE = HIGHLOAD_WALLET_V3_HEX;
