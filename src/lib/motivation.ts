export type MotivationItem={type:'Motivazione'|'Corano'|'Hadith';text:string;reference?:string};
const items:MotivationItem[]=[
  {type:'Motivazione',text:'La costanza batte l’intensità occasionale. Completa la prossima azione, poi la successiva.'},
  {type:'Motivazione',text:'Non aspettare la giornata perfetta: costruisci progresso con il tempo che hai oggi.'},
  {type:'Motivazione',text:'Il lavoro profondo di oggi riduce il caos di domani.'},
  {type:'Motivazione',text:'Fai prima ciò che sposta davvero il risultato, non ciò che fa solo sentire occupati.'},
  {type:'Corano',text:'In verità per ogni difficoltà c’è una facilità.',reference:'Corano 94:5'},
  {type:'Corano',text:'L’uomo non ottiene che il frutto dei suoi sforzi.',reference:'Corano 53:39'},
  {type:'Corano',text:'Allah non impone a nessun’anima un carico al di là delle sue capacità.',reference:'Corano 2:286'},
  {type:'Hadith',text:'Le opere più amate da Allah sono quelle più costanti, anche se piccole.',reference:'Sahih al-Bukhari 6464'},
  {type:'Hadith',text:'Abbi cura di ciò che ti giova, chiedi aiuto ad Allah e non perderti d’animo.',reference:'Sahih Muslim 2664'}
];
function dayNumber(d=new Date()){ return Math.floor(new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()/86400000); }
export function dailyMotivation(date=new Date()){
  const n=dayNumber(date);
  const first=items[n%items.length];
  let second=items[(n*3+2)%items.length];
  if(second===first) second=items[(n+1)%items.length];
  return [first,second];
}
