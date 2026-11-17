import GeoMap from './GeoMap.jsx';
import { useEffect, useState } from 'react';
const initial={mode:'national',network:'YouTube',modality:'',submodality:'',region:'',uf:'',city:'',center:'',radius:'',start:'',end:'',source:'',quality:'verified',metric:'',order:'audience',talent:''};
const fetchJson=async(path,signal)=>{const r=await fetch(path,{signal});const j=await r.json();if(!r.ok)throw Error(j.error||'Servidor indisponível');return j;};
const fmt=n=>n==null?'—':n.toLocaleString('pt-BR',{maximumFractionDigits:2});
export default function Radar(){
 const [geo,setGeo]=useState(null),[reports,setReports]=useState([]);
 const [filters,setFilters]=useState(initial), [mods,setMods]=useState([]),[cities,setCities]=useState([]),[cityQuery,setCityQuery]=useState(''),[cityCount,setCityCount]=useState(0),[result,setResult]=useState(null),[error,setError]=useState(''),[metaError,setMetaError]=useState(''),[loading,setLoading]=useState(false),[offset,setOffset]=useState(0);
 const set=(key,value)=>{
  setFilters(f=>{
   const base={...f,[key]:value,...(key==='center'&&!value?{radius:''}:key==='center'&&!f.radius?{radius:'200'}:{}),...(key==='network'||key==='mode'?{metric:''}:{}),...(key==='modality'?{submodality:''}:{}),...(key==='mode'?{order:'audience',region:'',uf:'',city:'',center:'',radius:'',source:'',quality:'verified'}:{})};
   if(key==='mode'&&value==='regional'&&reports.length>0){
    const r=reports[0];
    return {...base,network:r.network,metric:r.metric,start:r.period_start,end:r.period_end,source:r.source,quality:r.quality};
   }
   return base;
  });
  setResult(null);setOffset(0);
 };
 useEffect(()=>{const c=new AbortController();fetchJson('/api/radar/modalities',c.signal).then(setMods).catch(e=>{if(e.name!=='AbortError')setMetaError(e.message)});return()=>c.abort();},[]);
 useEffect(()=>{const c=new AbortController();fetchJson('/api/radar/municipalities?q='+encodeURIComponent(cityQuery),c.signal).then(d=>{setCities(d.items);setCityCount(d.total)}).catch(e=>{if(e.name!=='AbortError')setMetaError(e.message)});return()=>c.abort();},[cityQuery]);
 useEffect(()=>{const c=new AbortController();Promise.all([fetchJson('/api/radar/geography',c.signal),fetchJson('/api/radar/reports',c.signal)]).then(([g,r])=>{setGeo(g);setReports(r)}).catch(e=>{if(e.name!=='AbortError')setMetaError(e.message)});return()=>c.abort();},[]);
 const regional=filters.mode==='regional';
 const query=async(next=0,customFilters=filters)=>{setLoading(true);setError('');setResult(null);try{const params=new URLSearchParams();const isReg=customFilters.mode==='regional';for(const [k,v] of Object.entries(customFilters))if(v!==''&&(isReg||!['quality','source'].includes(k)))params.set(k,v);params.set('offset',next);const r=await fetchJson('/api/radar/ranking?'+params);setResult(r);setOffset(next);}catch(e){setError(e.message);}finally{setLoading(false);}};
 useEffect(()=>{query(0,initial);},[]);
 const select=(k,label,options)=><label>{label}<select value={filters[k]} onChange={e=>set(k,e.target.value)}>{options.map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>;
 const field=(k,label,type='text')=><label>{label}<input type={type} value={filters[k]} onChange={e=>set(k,e.target.value)}/></label>;
 return <section className="radar"><h2>Radar geográfico e rankings</h2><p>Base municipal importada: {fmt(cityCount)} municípios. Nenhuma audiência é inventada.</p>{metaError&&<p role="alert">{metaError}</p>}
 <fieldset disabled={loading}><legend>Filtros de análise</legend><div className="filters">
 {select('mode','Tipo de ranking',[['national','Geral — métricas nacionais'],['regional','Audiência municipal']])}{select('network','Rede',['YouTube','Instagram','Spotify'].map(v=>[v,v]))}
 {select('modality','Modalidade',[['','Todas'],...mods.map(m=>[m.id,m.name])])}{select('submodality','Submodalidade',[['','Todas'],...mods.filter(m=>!filters.modality||m.id===filters.modality).flatMap(m=>m.submodalities.map(s=>[String(s.id),`${m.name} / ${s.name}`]))])}
 {regional&&select('metric','Métrica',[['','Padrão da rede'],...({YouTube:['views','subscribers'],Instagram:['followers','reach','views'],Spotify:['listeners','streams']}[filters.network]||[]).map(v=>[v,v])])}{field('start','Início','date')}{field('end','Fim','date')}{select('order','Classificar por',regional?[['audience','Audiência conhecida']]:[['audience','Audiência'],['growth','Crescimento absoluto'],['growth_pct','Crescimento percentual']])}{field('talent','ID do talento (opcional)')}
 {regional&&<><label>Relatório disponível<select value="" onChange={e=>{if(e.target.value==='')return;const r=reports[Number(e.target.value)];setFilters(f=>({...f,network:r.network,metric:r.metric,start:r.period_start,end:r.period_end,source:r.source,quality:r.quality}));setResult(null);setOffset(0)}}><option value="">Selecionar relatório importado</option>{reports.map((r,i)=><option key={i} value={i}>{r.network} / {r.metric} / {r.period_end} / {r.source} / {r.quality}</option>)}</select></label>{select('region','Região',[['','Brasil'],...['Norte','Nordeste','Centro-Oeste','Sudeste','Sul'].map(v=>[v,v])])}{select('uf','Estado',[['','Todos'],...['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(v=>[v,v])])}{field('source','Fonte do relatório (exata)')}{select('quality','Qualidade',[['verified','Verificado'],['estimated','Estimado']])}<label>Buscar município<input value={cityQuery} onChange={e=>setCityQuery(e.target.value)} placeholder="Nome ou código IBGE"/></label>{select('city','Município (opcional)',[['','Todos'],...cities.map(c=>[c.code,c.name+' – '+c.uf]),...(filters.city&&!cities.some(c=>c.code===filters.city)?[[filters.city,filters.city]]:[])])}{select('center','Centro do raio',[['','Sem raio'],...cities.filter(c=>c.lat!=null).map(c=>[c.code,c.name+' – '+c.uf]),...(filters.center&&!cities.some(c=>c.code===filters.center)?[[filters.center,filters.center]]:[])])}{field('radius','Raio em km (linha reta)','number')}{filters.center&&<label>Raio rápido: {filters.radius||0} km<input type="range" min="0" max="1000" step="25" value={filters.radius||0} onChange={e=>set('radius',e.target.value)}/></label>}</>}
 </div><div className="actions"><button onClick={()=>query()}>Consultar</button><button onClick={()=>{setFilters(initial);setResult(null);setError('');setOffset(0)}}>Limpar filtros</button></div></fieldset>{loading&&<p role="status">Consultando…</p>}{error&&<p role="alert">{error}</p>}
 {result&&<><p>{result.notice}</p><p>{fmt(result.total)} classificados / {fmt(result.eligible)} elegíveis. {result.excludedCoordinates>0&&`${result.excludedCoordinates} registros excluídos por falta de coordenadas.`}</p>{!result.items.length?<p>Nenhum dado compatível com os filtros. Importe dados autorizados antes de consultar.</p>:<div className="scroll"><table><thead><tr><th>Posição</th><th>Talento</th><th>{result.metric}</th><th>Crescimento</th><th>Variação %</th></tr></thead><tbody>{result.items.map(r=><tr key={r.id}><td>{r.rank}</td><td>{r.name}</td><td>{fmt(r.value)}</td><td>{fmt(r.growth)}</td><td>{fmt(r.growth_pct)}</td></tr>)}</tbody></table></div>}
 <div className="actions"><button disabled={loading||offset===0} onClick={()=>query(Math.max(0,offset-50))}>Anterior</button><button disabled={loading||offset+50>=result.total} onClick={()=>query(offset+50)}>Próxima</button></div>
 {regional&&<><h3>Distribuição municipal</h3>{['byRegion','byState'].map((k)=><div key={k}><h4>{k==='byRegion'?'Por região':'Por estado'}</h4>{result[k].map(p=><div className="bar-row" key={p.name}><span>{p.name}</span><progress max={Math.max(1,result[k][0].value)} value={p.value}/><span>{fmt(p.value)}</span></div>)}</div>)}<p>{result.places.length} municípios com dados; {result.places.filter(p=>p.lat==null).length} sem coordenadas.</p>{result.places.slice(0,20).map(p=><div className="bar-row" key={p.code}><span>{p.name} / {p.uf}</span><progress max={Math.max(1,result.places[0].value)} value={p.value}/><span>{fmt(p.value)}</span></div>)}</>}
 </>}
 {regional&&<GeoMap geo={geo} result={result} onState={uf=>{if(!loading)set('uf',uf)}} onCity={code=>{if(!loading)set('city',code)}}/>}
 {regional&&<p>Após selecionar estado ou município no mapa, clique em Consultar para atualizar os rankings.</p>}
 </section>;
}
