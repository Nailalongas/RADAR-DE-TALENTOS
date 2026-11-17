async function eventMapApi(request, env) {
  const url = new URL(request.url);
  const person = url.searchParams.get('talent') || '';
  if (!/^[a-f0-9]{64}$/.test(person)) return json({error:'Perfil inválido.'},400);
  const key = 'event-map/audience/' + person + '.json';
  if (request.method === 'GET') {
    const stored = await env.BUCKET.get(key);
    return json({rows: stored ? await stored.json() : []});
  }
  if (request.method !== 'POST') return json({error:'Método não permitido.'},405);
  if (!request.headers.get('oai-authenticated-user-id')) return json({error:'Entre na sua conta para importar.'},401);
  const {rows} = await request.json();
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  const metrics = {Instagram:['seguidores'],YouTube:['visualizacoes','minutos_assistidos']};
  if (!Array.isArray(rows) || !rows.length || rows.length > 500 || rows.some(r => !r || !/^\d{7}$/.test(r.ibge) ||
      !Object.hasOwn(metrics,r.rede) || !metrics[r.rede].includes(r.metrica) ||
      !Number.isSafeInteger(r.valor) || r.valor < 0 || !date(r.inicio) || !date(r.fim) || r.inicio > r.fim ||
      !['todos','inscritos'].includes(r.publico) || (r.rede === 'Instagram' && r.publico !== 'todos') ||
      typeof r.parcial !== 'boolean' || typeof r.fonte !== 'string' || !r.fonte.trim() || r.fonte.length > 240)) {
    return json({error:'Confira códigos IBGE, métricas, valores, datas, público e fonte do relatório.'},400);
  }
  const identity = r => [r.ibge,r.rede,r.metrica,r.inicio,r.fim,r.publico].join('|');
  for (let attempt=0; attempt<3; attempt++) {
    const stored = await env.BUCKET.get(key);
    const merged = new Map((stored ? await stored.json() : []).map(r => [identity(r),r]));
    for (const {ibge,rede,metrica,valor,inicio,fim,publico,parcial,fonte} of rows) {
      const record = {ibge,rede,metrica,valor,inicio,fim,publico,parcial,fonte};
      merged.set(identity(record),record);
    }
    if (merged.size > 10000) return json({error:'Limite de registros por perfil atingido.'},409);
    const onlyIf = stored ? {etagMatches:stored.etag} : {etagDoesNotMatch:'*'};
    if (await env.BUCKET.put(key,JSON.stringify([...merged.values()]),{onlyIf})) return json({rows:[...merged.values()]});
  }
  return json({error:'Houve outra importação simultânea. Tente novamente.'},409);
}

async function eventMapIbge(request) {
  if (request.method !== 'GET') return json({error:'Método não permitido.'},405);
  const params = new URL(request.url).searchParams;
  const city = params.get('city');
  let path;
  switch (params.get('kind')) {
    case 'cities': path='v1/localidades/municipios'; break;
    case 'shapes': path='v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=UF'; break;
    case 'municipal': {
      const states={AC:12,AL:27,AP:16,AM:13,BA:29,CE:23,DF:53,ES:32,GO:52,MA:21,MT:51,MS:50,MG:31,PA:15,PB:25,PR:41,PE:26,PI:22,RJ:33,RN:24,RS:43,RO:11,RR:14,SC:42,SP:35,SE:28,TO:17};
      const uf=params.get('uf');
      if(!Object.hasOwn(states,uf)) return json({error:'UF inválida.'},400);
      path='v3/malhas/estados/'+states[uf]+'?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=municipio';
      break;
    }
    case '4714':
    case '5938': {
      if (!/^\d{7}$/.test(city||'')) return json({error:'Código IBGE inválido.'},400);
      const table = params.get('kind');
      path = table==='4714' ? 'v3/agregados/4714/periodos/2022/variaveis/93' : 'v3/agregados/5938/periodos/-1/variaveis/37%7C513';
      path += '?localidades=N6%5B'+city+'%5D';
      break;
    }
    default: return json({error:'Consulta IBGE inválida.'},400);
  }
  try {
    const response = await fetch('https://servicodados.ibge.gov.br/api/'+path,{signal:AbortSignal.timeout(10000),cf:{cacheEverything:true,cacheTtl:86400}});
    if (!response.ok) return json({error:'Fonte do IBGE indisponível.'},502);
    return new Response(response.body,{headers:{'Content-Type':'application/json','Cache-Control':'private, max-age=86400'}});
  } catch {
    return json({error:'Fonte do IBGE indisponível.'},502);
  }
}
