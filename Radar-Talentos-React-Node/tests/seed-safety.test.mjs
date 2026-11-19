import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../server/src/database/index.mjs';
import {seedPilotDatabaseIfEmpty} from '../server/src/seed-pilot.mjs';
test('Inicialização não fabrica métricas, perfis, autorizações ou coletas',()=>{
 const db=openDatabase(':memory:');try{
 seedPilotDatabaseIfEmpty(db);
 assert.ok(db.prepare('SELECT count(*) n FROM municipalities').get().n>0);
 for(const t of ['talents','social_accounts','metric_snapshots','metric_current','commercial_accounts','commercial_snapshots','regional_audience','regional_report_authorizations','operation_runs'])assert.equal(db.prepare(`SELECT count(*) n FROM ${t}`).get().n,0,t);
 db.prepare("INSERT INTO talents(id,name,entity_type) VALUES('t-alok','Alok','person')").run();
 db.prepare("INSERT INTO regional_report_authorizations(talent_id,network,metric,period_start,period_end,source,report_ref,authorization_ref,coverage) VALUES('t-alok','YouTube','views','2026-01-01','2026-01-02','test','ref','auth','complete')").run();
 seedPilotDatabaseIfEmpty(db);
 assert.equal(db.prepare('SELECT count(*) n FROM regional_report_authorizations').get().n,1);
 }finally{db.close()}
});
