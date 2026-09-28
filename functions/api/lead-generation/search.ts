interface Env { GOOGLE_MAPS_API_KEY?: string }

type Place = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
};

const CENTER={lat:43.6421,lng:11.0730};
const QUERIES=[
  {q:'centro estetico',type:'WEB-FIRST'},
  {q:'parrucchiere barber shop',type:'WEB-FIRST'},
  {q:'B&B hotel affittacamere',type:'WEB-FIRST'},
  {q:'studio professionale',type:'WEB-FIRST'},
  {q:'ristorante pizzeria',type:'SOCIAL-FIRST'},
  {q:'bar caffè',type:'SOCIAL-FIRST'},
  {q:'kebab',type:'SOCIAL-FIRST'},
  {q:'palestra negozio attività commerciale',type:'SOCIAL-FIRST'}
] as const;

function haversineKm(a:{lat:number;lng:number},b:{lat:number;lng:number}){
  const r=6371,toRad=(v:number)=>v*Math.PI/180;
  const dLat=toRad(b.lat-a.lat),dLng=toRad(b.lng-a.lng);
  const x=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  return 2*r*Math.asin(Math.sqrt(x));
}
function clamp(n:number){return Math.max(0,Math.min(100,Math.round(n)));}
function budgetBand(score:number){return score>=82?'MOLTO ALTA':score>=65?'ALTA':score>=45?'MEDIA':'BASSA';}
function priority(score:number){return score>=80?'HOT':score>=60?'MEDIUM':'LOW';}
function isMobile(phone?:string){if(!phone)return false;const clean=phone.replace(/[^0-9+]/g,'').replace(/^\+39/,'');return /^3\d{8,10}$/.test(clean);}
function cityFromAddress(address=''){const parts=address.split(',').map(x=>x.trim());return parts.length>1?parts[parts.length-2]:'';}

function normalize(place:Place,leadType:'WEB-FIRST'|'SOCIAL-FIRST',radius:number){
  const lat=place.location?.latitude,lng=place.location?.longitude;
  if(typeof lat!=='number'||typeof lng!=='number')return null;
  const distanceKm=haversineKm(CENTER,{lat,lng});
  if(distanceKm>radius)return null;
  const reviews=place.userRatingCount||0,rating=place.rating||0,hasWebsite=!!place.websiteUri;
  const fit=clamp(48+(rating>=4?12:0)+(reviews>=30?10:reviews>=10?5:0)+(distanceKm<=15?12:distanceKm<=30?6:0));
  const need=clamp(leadType==='WEB-FIRST'?(hasWebsite?42:78):(hasWebsite?52:62));
  const budget=clamp(30+Math.min(32,Math.log10(Math.max(1,reviews))*14)+(rating>=4.5?13:rating>=4?7:0)+(hasWebsite?8:0));
  const buying=clamp(30+(hasWebsite?18:6)+(reviews>=50?15:reviews>=20?8:0)+(rating>=4.3?10:4));
  const timing=35;
  const distanceBonus=distanceKm<=5?12:distanceKm<=10?9:distanceKm<=20?5:2;
  const opportunity=clamp(fit*.24+need*.25+budget*.18+buying*.16+timing*.09+distanceBonus);
  const recommendedService=leadType==='WEB-FIRST'?(hasWebsite?'Restyling sito':'Nuovo sito'):'Gestione Social Completa';
  const phone=place.internationalPhoneNumber||place.nationalPhoneNumber;
  const mobile=isMobile(phone)?phone:undefined;
  const fixed=mobile?undefined:phone;
  const signals=[
    `${reviews} recensioni Google`,
    rating?`valutazione ${rating.toFixed(1)}`:'valutazione non disponibile',
    hasWebsite?'sito presente da verificare':'nessun sito indicato da Google Places',
    `${distanceKm.toFixed(1)} km da Montespertoli`
  ];
  return {
    externalId:place.id,
    fingerprint:place.id||`${place.displayName?.text||''}|${place.formattedAddress||''}`.toLowerCase(),
    businessName:place.displayName?.text||'Attività',name:place.displayName?.text||'Attività',
    category:place.primaryTypeDisplayName?.text||place.primaryType||'Attività locale',leadType,
    address:place.formattedAddress||'',city:cityFromAddress(place.formattedAddress),latitude:lat,longitude:lng,distanceKm:Number(distanceKm.toFixed(1)),
    phone:fixed,mobile,website:place.websiteUri,rating:rating||undefined,reviewsCount:reviews||undefined,
    websiteStatus:hasWebsite?'Non verificato':'Assente',socialStatus:'Non verificato',advertisingStatus:'Non verificato',
    ownerName:undefined,isNewOpening:false,isOpeningSoon:false,
    fitScore:fit,needScore:need,budgetScore:budget,budgetBand:budgetBand(budget),buyingScore:buying,timingScore:timing,opportunityScore:opportunity,priority:priority(opportunity),
    recommendedService,upsellService:leadType==='WEB-FIRST'?'Gestione Social Completa':'Nuovo sito',
    aiAnalysis:`Segnali verificati: ${signals.join(', ')}. I punteggi sono preliminari e non includono ancora analisi social, titolare, advertising o segnali di nuova apertura.`,
    sourceProvider:'Google Places',sources:[{label:'Google Places',url:place.googleMapsUri,checkedAt:new Date().toISOString()}],lastCheckedAt:new Date().toISOString()
  };
}

async function searchOne(key:string,textQuery:string,leadType:'WEB-FIRST'|'SOCIAL-FIRST',radius:number){
  const response=await fetch('https://places.googleapis.com/v1/places:searchText',{
    method:'POST',
    headers:{'content-type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.primaryType,places.primaryTypeDisplayName'},
    body:JSON.stringify({textQuery,languageCode:'it',regionCode:'IT',pageSize:20,locationBias:{circle:{center:{latitude:CENTER.lat,longitude:CENTER.lng},radius:Math.min(30000,radius*1000)}}})
  });
  if(!response.ok)throw new Error(`Google Places ${response.status}`);
  const data:any=await response.json();
  return (data.places||[]).map((p:Place)=>normalize(p,leadType,radius)).filter(Boolean);
}

export const onRequestGet: PagesFunction<Env> = async ({request,env}) => {
  const key=env.GOOGLE_MAPS_API_KEY;
  if(!key)return Response.json({configured:false,provider:'Google Places',message:'Nessuna fonte Lead collegata. Configura GOOGLE_MAPS_API_KEY in Cloudflare.'});
  const url=new URL(request.url);const radius=Math.max(1,Math.min(30,Number(url.searchParams.get('radius')||30)));
  try{
    const settled=await Promise.allSettled(QUERIES.map(x=>searchOne(key,x.q,x.type,radius)));
    const all=settled.flatMap(x=>x.status==='fulfilled'?x.value:[]);
    const map=new Map<string,any>();for(const lead of all){const key=lead.externalId||lead.fingerprint;if(!map.has(key)||lead.opportunityScore>map.get(key).opportunityScore)map.set(key,lead);}
    const leads=[...map.values()].sort((a,b)=>b.opportunityScore-a.opportunityScore);
    return Response.json({configured:true,provider:'Google Places',center:'Montespertoli, Firenze',radiusKm:radius,checkedAt:new Date().toISOString(),leads,partialErrors:settled.filter(x=>x.status==='rejected').length});
  }catch(error:any){return Response.json({configured:true,error:error?.message||'Ricerca Lead non riuscita'},{status:502});}
};
