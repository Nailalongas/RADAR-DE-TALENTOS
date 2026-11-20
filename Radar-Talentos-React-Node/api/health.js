// O frontend de preview não deve criar bancos temporários nem aceitar gravações.
export default function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.statusCode=503;
  res.end(req.method==='HEAD'?undefined:JSON.stringify({ok:false,error:'Backend persistente ainda não conectado. Utilize o servidor oficial do Radar.'}));
}
