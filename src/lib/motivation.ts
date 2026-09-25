export type MotivationItem={type:'Motivazione'|'Corano'|'Hadith';text:string;reference?:string};

const verified:MotivationItem[]=[
  {type:'Motivazione',text:'La costanza batte l’intensità occasionale: completa la prossima azione, poi la successiva.'},
  {type:'Motivazione',text:'Non aspettare la giornata perfetta. Proteggi un blocco di tempo e porta a termine ciò che conta.'},
  {type:'Motivazione',text:'Il lavoro difficile diventa più leggero quando smetti di negoziare con la prima azione.'},
  {type:'Motivazione',text:'Fai oggi il lavoro che evita il caos di domani.'},
  {type:'Corano',text:'L’uomo non avrà altro che il frutto del suo impegno.',reference:'Corano, Sura An-Najm 53:39'},
  {type:'Corano',text:'In verità, con la difficoltà c’è la facilità.',reference:'Corano, Sura Ash-Sharh 94:5–6'},
  {type:'Hadith',text:'Le azioni valgono secondo le intenzioni.',reference:'Sahih al-Bukhari 1'},
  {type:'Hadith',text:'Cerca con impegno ciò che ti giova, chiedi aiuto ad Allah e non scoraggiarti.',reference:'Sahih Muslim 2664'}
];

function hashDay(date:Date){const key=`${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;let h=0;for(const ch of key)h=(h*31+ch.charCodeAt(0))>>>0;return h;}
export function dailyMotivation(date=new Date()){const h=hashDay(date);const first=verified[h%verified.length];let second=verified[(h*7+3)%verified.length];if(second===first)second=verified[(h+1)%verified.length];return [first,second];}
