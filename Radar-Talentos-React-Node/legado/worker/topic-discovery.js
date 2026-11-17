// Search evidence is a suggestion, never a replacement for reviewed classification.
function discoveryTopicQuery(category,theme,variant=0){
  const prefixes={Palestrantes:['palestrante brasileiro','palestra completa Brasil','especialista brasileiro'],Cantores:['cantor banda brasileira','cantora brasileira show','música brasileira ao vivo'],Humoristas:['comediante brasileiro','humorista brasileiro','comédia brasileira'],Artistas:['artista brasileiro','entrevista artista Brasil','espetáculo brasileiro'],Influenciadores:['criador de conteúdo brasileiro','influenciadora brasileira','especialista brasileiro'],'Infantil e família':['espetáculo para família Brasil','companhia infantil brasileira','atração infantil ao vivo'],'Peças de teatro e musicais':['companhia teatral brasileira','teatro brasileiro no palco','espetáculo teatral Brasil'],Gastronomia:['chef brasileiro','experiência gastronômica Brasil','evento gastronômico brasileiro']};
  const choices=prefixes[category];return choices[variant%choices.length]+' '+theme;
}
async function chooseDiscoveryTopic(env,selected,channels,namespace='youtube'){
  const storageKey='discovery-topics/'+namespace+'-state.json';
  const o=await env.BUCKET.get(storageKey),state=o?await o.json():{};
  const plans=selected.flatMap(category=>(talentTaxonomy[category]||[]).map(theme=>{
    const key=category+'|'+theme,entry=state[key]||{},count=channels.filter(c=>(c.subcategorias||[]).includes(key)).length;
    return {category,theme,key,count,attempts:entry.attempts||0,lastAttempt:entry.lastAttempt||0,entry};
  }));
  plans.sort((a,b)=>a.attempts-b.attempts||a.count-b.count||a.lastAttempt-b.lastAttempt||((a.category==='Palestrantes'?0:1)-(b.category==='Palestrantes'?0:1))||a.key.localeCompare(b.key,'pt-BR'));
  const plan=plans[0];if(!plan)return null;
  plan.query=discoveryTopicQuery(plan.category,plan.theme,Math.floor(plan.attempts/4));
  plan.stateKey='base-topic-progress/'+encodeURIComponent(plan.key)+'-'+Math.floor(plan.attempts/4)+'.json';
  plan.record=async()=>{state[plan.key]={attempts:plan.attempts+1,lastAttempt:Date.now(),count:plan.count};await env.BUCKET.put(storageKey,JSON.stringify(state));};
  return plan;
}
function addSuggestedDiscoveryTopic(channel,plan,query){
  if(!plan)return channel;
  return {...channel,categorias:[...new Set([...(channel.categorias||[channel.categoria]),plan.category])],subcategorias:[...new Set([...(channel.subcategorias||[]),...suggestedBiographyTopics(channel),plan.key])],topicSuggested:true,discoveryEvidence:[...(channel.discoveryEvidence||[]).filter(e=>e.topic!==plan.key),{topic:plan.key,query,source:'YouTube search',foundAt:new Date().toISOString()}].slice(-60)};
}
