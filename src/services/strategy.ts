import type { Client, ContentFormat, Platform, Strategy } from '../types/models';
import { now, uid } from '../lib/db';

const libraries: Record<string,{pillars:string[], ideas:string[]}> = {
  ristorante:{pillars:['Prodotto','Dietro le quinte','Social proof','Intrattenimento','Local'],ideas:['Il piatto che racconta il locale','Dietro il bancone','Errore comune sul prodotto','Cliente racconta perché torna','POV: una sera nel locale','Come nasce il prodotto','3 motivi per provarlo','FAQ rapida','Team e personalità','Invito alla prenotazione']},
  abbigliamento:{pillars:['Prodotto','Styling','UGC','Novità','Social proof'],ideas:['3 modi per indossarlo','Try-on rapido','Dettagli che fanno la differenza','Nuovi arrivi','Outfit per occasione','POV cliente','Errore di styling','Prima/dopo look','Top 3 della settimana','CTA prodotto']},
  concessionaria:{pillars:['Showcase','Educazione','Confronti','FAQ','Social proof'],ideas:['Auto della settimana','3 funzioni da conoscere','Confronto modelli','FAQ acquisto','Consegna cliente','POV guida','Errore comune','Dettaglio premium','Per chi è questo modello','CTA preventivo']}
};
const fallback={pillars:['Valore','Educazione','Social proof','Dietro le quinte','Azione'],ideas:['Presenta il valore principale','FAQ frequente','Dietro le quinte','Caso cliente','Errore comune','Consiglio pratico','Dimostrazione','Obiezione e risposta','Format ricorrente','CTA obiettivo']};
export function buildStrategy(client:Client, target=client.contentTarget||10):Strategy{
  const key=client.niche.toLowerCase(); const lib=Object.entries(libraries).find(([k])=>key.includes(k))?.[1]||fallback;
  const ideas=Array.from({length:target},(_,i)=>({
    title:lib.ideas[i%lib.ideas.length], pillar:lib.pillars[i%lib.pillars.length], platform:(client.platforms[0]||'Entrambi') as Platform,
    format:((client.platforms.includes('TikTok')?'TikTok Video':'Reel') as ContentFormat), hook:`Apri subito con il punto più interessante di “${lib.ideas[i%lib.ideas.length]}”.`,
    cta: client.objective?.toLowerCase().includes('prenot')?'Prenota / contatta':'Scopri di più', funnel:(i%3===0?'Discovery':i%3===1?'Trust':'Action') as 'Discovery'|'Trust'|'Action'
  }));
  const pillars=lib.pillars.map((name,i)=>({name,count:ideas.filter(x=>x.pillar===name).length})).filter(x=>x.count);
  return {id:uid(),clientId:client.id,objective:client.objective||'Aumentare la presenza e generare azioni utili',summary:`Piano mensile per ${client.name}: alterna scoperta, fiducia e azione con format coerenti alla nicchia ${client.niche}.`,target,pillars,ideas,approved:false,createdAt:now(),updatedAt:now()};
}
