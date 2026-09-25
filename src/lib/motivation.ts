export type MotivationItem={type:'Spinta'|'Corano'|'Hadith';text:string;reference?:string;author?:string};

const items:MotivationItem[]=[
  {type:'Spinta',text:'La costanza batte l’intensità occasionale. Completa la prossima azione, poi la successiva.'},
  {type:'Corano',text:'In verità per ogni difficoltà c’è una facilità.',reference:'Corano 94:5'},
  {type:'Spinta',text:'Non aspettare la giornata perfetta: costruisci progresso con il tempo che hai oggi.'},
  {type:'Hadith',text:'Le opere più amate da Allah sono quelle più costanti, anche se piccole.',reference:'Sahih al-Bukhari 6464'},
  {type:'Spinta',text:'Il lavoro profondo di oggi riduce il caos di domani.'},
  {type:'Corano',text:'L’uomo non ottiene che il frutto dei suoi sforzi.',reference:'Corano 53:39'},
  {type:'Spinta',text:'Fai prima ciò che sposta davvero il risultato, non ciò che fa solo sentire occupati.'},
  {type:'Hadith',text:'Abbi cura di ciò che ti giova, chiedi aiuto ad Allah e non perderti d’animo.',reference:'Sahih Muslim 2664'},
  {type:'Spinta',text:'Riduci il campo: una cosa importante, fatta bene, vale più di dieci iniziate.'},
  {type:'Corano',text:'Allah non impone a nessun’anima un carico al di là delle sue capacità.',reference:'Corano 2:286'}
];

function dayNumber(d=new Date()){
  return Math.floor(new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()/86400000);
}

export function hourlyMotivation(date=new Date()){
  const seed=dayNumber(date)*24+date.getHours();
  return items[seed%items.length];
}
