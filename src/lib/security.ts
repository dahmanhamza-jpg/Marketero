const enc = new TextEncoder();
const RECOVERY_HASH = '41c991eb6a66242c0454191244278183ce58cf4a6bcd372f799e4b9cc01886af';
export async function sha256(v:string){ const b=await crypto.subtle.digest('SHA-256',enc.encode(v)); return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''); }
export async function verifyPin(pin:string, hash?:string){ return !!hash && (await sha256(pin))===hash; }
export async function verifyRecoveryCode(code:string){ return (await sha256(code))===RECOVERY_HASH; }
export async function makePinHash(pin:string){ if(!/^\d{4}$/.test(pin)) throw new Error('Il PIN deve contenere 4 cifre.'); return sha256(pin); }
