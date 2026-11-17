import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const today = '2026-11-09';
const db = new Map();
const now = new Date().toISOString();
const bucket = {
  async get(key) {
    return db.has(key) ? {json: async () => structuredClone(db.get(key)), etag:'test'} : null;
  },
  async put(key, value, {onlyIf} = {}) {
    if (onlyIf?.has('if-none-match') && db.has(key)) return null;
    db.set(key, JSON.parse(value));
    return {};
  },
  async delete(key) { db.delete(key); }
};
const ctx = vm.createContext({Date, Request, Response, Headers});
vm.runInContext(fs.readFileSync('worker/collection-check.js','utf8') + `
const igDate = () => '${today}';
const json = (data, status=200) => Response.json(data,{status});
const spotifyPublicDailySummary = (date, attempts) => ({
  collected:attempts.filter(x=>x.outcome==='collected').length,
  failedAttempts:attempts.filter(x=>x.outcome!=='collected').length,
  pending:0
});
let recoveryCalls=0;
const youtubeKey=async()=>true;
const runDaily=async(env)=>{recoveryCalls++;await env.BUCKET.put('runs/latest.json',JSON.stringify({date:igDate(),completedAt:new Date().toISOString(),collected:50,total:500,remaining:450,failed:[]}));};
const igRead=async()=>{throw Error('Paused Instagram must not be retried');};
const spotifyPublicApi=async()=>{throw Error('A daily success should not be retried');};
globalThis.check=collectionCheckApi;
globalThis.callCount=()=>recoveryCalls;
`,ctx);
const env={BUCKET:bucket};
const get = () => ctx.check(new Request('https://radar.example/api/collection-check'),env);
const run = () => ctx.check(new Request('https://radar.example/api/collection-check',{method:'POST',body:'{"recover":true}'}),env);

assert.deepEqual(await (await get()).json(), {date:today,report:null});
db.set('ig-budget/control.json',{resumeAt:Date.now()+100000});
db.set('runs/latest.json',{date:today,completedAt:now,collected:20,total:500,remaining:480,failed:[]});
db.set('spotify/public/status.json',{date:today,completedAt:now,collected:0});
db.set('spotify/public/days/'+today+'.json',[{outcome:'collected'}]);
const result=(await (await run()).json()).report;
assert.equal(ctx.callCount(),1);
assert.equal(result.networks[0].collected,50);
assert.equal(result.networks[0].message,'');
assert.equal(result.networks[1].paused,true);
assert.ok(result.networks[1].message);
assert.equal(result.networks[2].collected,1,'A later empty batch must not erase daily Spotify progress');
assert.deepEqual((await (await run()).json()).report,result);
assert.equal(ctx.callCount(),1,'Repeat delivery must not start another recovery');
assert.deepEqual((await (await get()).json()).report,result);
console.log('Daily check persists recovery, preserves paused networks, counts Spotify by day and handles repeat delivery.');

