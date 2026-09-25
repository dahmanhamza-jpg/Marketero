import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureSettings, now } from '../lib/db';
import { isRecoveryCode, makePinHash, verifyPin } from '../lib/security';
import { queueSync } from '../services/sync';

export function LockGate({children}:{children:any}){
 const settings=useLiveQuery(()=>db.settings.get('settings'),[]);const [unlocked,setUnlocked]=useState(false);const [mode,setMode]=useState<'unlock'|'setup'|'confirm'|'reset'>('unlock');const [pin,setPin]=useState('');const [firstPin,setFirstPin]=useState('');const [msg,setMsg]=useState('');
 useEffect(()=>{ensureSettings().then(s=>setMode(s.pinHash?'unlock':'setup'))},[]);
 useEffect(()=>{if(pin.length===4)void submit(pin)},[pin]);
 if(unlocked)return children;
 async function submit(value:string){setMsg('');if(mode==='setup'||mode==='reset'){setFirstPin(value);setPin('');setMode('confirm');return}if(mode==='confirm'){if(value!==firstPin){setMsg('I PIN non coincidono. Riprova.');setPin('');setMode(settings?.pinHash?'reset':'setup');return}const hash=await makePinHash(value);await db.settings.update('settings',{pinHash:hash,firstRunDone:true,updatedAt:now()});queueSync();setUnlocked(true);return}if(await isRecoveryCode(value)){setMode('reset');setPin('');setMsg('Recupero accettato. Imposta un nuovo PIN.');return}if(await verifyPin(value,settings?.pinHash)){setUnlocked(true);return}setMsg('PIN non corretto.');setPin('');}
 const title=mode==='unlock'?'Bentornato':mode==='confirm'?'Conferma PIN':mode==='setup'?'Crea il tuo PIN':'Reimposta PIN';
 return <div className="lock"><div className="lock-card"><div className="logo">M</div><h1>{title}</h1><p>{mode==='unlock'?'Inserisci il PIN di 4 cifre.':'Usa il tastierino per impostare il PIN.'}</p><div className={`pin-dots ${msg&&mode==='unlock'?'shake':''}`}>{[0,1,2,3].map(i=><span className={pin.length>i?'filled':''} key={i}/>)}</div>{msg&&<p className="error">{msg}</p>}<div className="keypad">{[1,2,3,4,5,6,7,8,9].map(n=><button key={n} onClick={()=>pin.length<4&&setPin(pin+String(n))}>{n}</button>)}<span/><button onClick={()=>pin.length<4&&setPin(pin+'0')}>0</button><button className="delete-key" onClick={()=>setPin(pin.slice(0,-1))}>⌫</button></div></div></div>;
}
