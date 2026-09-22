const enc = new TextEncoder();
export async function sha256(v:string){ const b=await crypto.subtle.digest('SHA-256',enc.encode(v)); return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''); }
export async function verifyPin(pin:string, hash?:string){ return !!hash && (await sha256(pin))===hash; }
export async function makePinHash(pin:string){ if(!/^\d{4}$/.test(pin)) throw new Error('Il PIN deve contenere 4 cifre.'); return sha256(pin); }
// User-requested recovery code. It resets app lock only; it is intentionally not used as an encryption key.
export const RECOVERY_CODE = '0000';
