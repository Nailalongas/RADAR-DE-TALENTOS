function spotifyComparisonChannelIndex(){
 const index=new Map();for(const entry of SPOTIFY_COMPARISON_QUEUE)for(const id of entry.channels)if(!index.has(id))index.set(id,entry);
 return index;
}
function spotifyComparisonRows(rows){
 const byArtist=new Map(),ids=new Set(SPOTIFY_COMPARISON_QUEUE.filter(p=>!p.excluded).map(p=>p.personId));
 for(const entry of SPOTIFY_COMPARISON_QUEUE)for(const link of entry.spotify||[]){
  if(!byArtist.has(link.artistId))byArtist.set(link.artistId,entry.personId);
  else if(byArtist.get(link.artistId)!==entry.personId)byArtist.set(link.artistId,null);
 }
 for(const row of rows)if(ids.has(row.comparisonPersonId)){
  if(!byArtist.has(row.artistId))byArtist.set(row.artistId,row.comparisonPersonId);
  else if(byArtist.get(row.artistId)!==row.comparisonPersonId)byArtist.set(row.artistId,null);
 }
 return rows.map(row=>{const personId=byArtist.get(row.artistId);return personId?{...row,comparisonPersonId:personId}:row.comparisonPersonId?{...row,comparisonPersonId:null}:row;});
}
function spotifyComparisonProgress(history){
 const found=new Map();for(const row of spotifyComparisonRows(history))if(row.comparisonPersonId&&Number.isSafeInteger(row.monthlyListeners)&&(!found.has(row.comparisonPersonId)||found.get(row.comparisonPersonId).date<row.date))found.set(row.comparisonPersonId,row);
 const first=SPOTIFY_COMPARISON_QUEUE.slice(0,50).map(({rank,name,personId,excluded,spotify})=>{
  const row=found.get(personId);return {rank,name,personId,status:excluded?'excluded':row?'complete':spotify?.length?'verified':'pending',...(excluded?{reason:excluded}:row?{spotifyUrl:row.url,monthlyListeners:row.monthlyListeners,date:row.date}:{})};
 });
 return {cohort:SPOTIFY_COMPARISON_QUEUE.length,firstBatch:first.length,complete:first.filter(p=>p.status==='complete').length,excluded:first.filter(p=>p.status==='excluded').length,verifiedWaiting:first.filter(p=>p.status==='verified').length,pending:first.filter(p=>p.status==='pending').length,profiles:first};
}
