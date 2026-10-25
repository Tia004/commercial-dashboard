const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const ts = require('typescript');
const {createClient} = require('@libsql/client');
function load(file, mocks = {}) {
 const exports = {};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText,{exports,require:name=>mocks[name]||require(name),Date,Map,Set,console});
 return exports;
}
test('additive migration and contact backfill preserve existing users, economic data, notes and timestamps',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'commercial-migration-'));
 const db=createClient({url:'file:'+path.join(dir,'old.sqlite')});
 try{
  await db.execute('CREATE TABLE users(id TEXT PRIMARY KEY,workspace_id TEXT,role TEXT,created_at TEXT)');
  await db.execute("INSERT INTO users VALUES ('owner','workspace','owner','2026-10-01T12:00:00.000Z')");
  await db.execute('CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at TEXT)');
  await db.execute('CREATE TABLE crm_data(user_id TEXT PRIMARY KEY,payload TEXT,revision INTEGER)');
  const original=JSON.stringify({opportunities:[{id:'old-1',company:'Azienda storica',name:'Referente',stage:'Venduta',brand:'NoLimits',notes:'Nota esistente',entryDate:'2026-10-20',history:[{id:'event-1',title:'Chiamata originaria',timestamp:'2026-10-21T10:15:00.000Z',author:'Commerciale'}]},{id:'old-2',company:'Azienda storica',stage:'Nuovo lead',history:[]}],tasks:[],brands:['NoLimits'],salesReps:[]});
  await db.execute({sql:'INSERT INTO crm_data VALUES (?,?,?)',args:['workspace',original,8]});
  const {migrateCollaboration,backfillMemberships}=load('src/lib/migrations/20261025-collaboration.ts');
  for(let attempt=0;attempt<2;attempt++){const tx=await db.transaction('write');try{await migrateCollaboration(tx);await backfillMemberships(tx);await tx.commit();}finally{tx.close();}}
  assert.equal((await db.execute('SELECT role FROM workspace_memberships')).rows[0].role,'owner');
  const types=load('src/types/contacts.ts');
  const {ensureWorkspaceContacts}=load('src/lib/contactRepository.ts',{'./serverDb':{getServerDb:async()=>db},'@/types/contacts':types});
  await ensureWorkspaceContacts('workspace');await ensureWorkspaceContacts('workspace');
  const contacts=await db.execute('SELECT * FROM contacts');assert.equal(contacts.rows.length,1);assert.equal(JSON.parse(contacts.rows[0].data).type,'Cliente effettivo');
  const activities=await db.execute('SELECT text,created_at FROM contact_activities');assert.equal(activities.rows.length,2);assert.ok(activities.rows.some(row=>row.text==='Chiamata originaria'&&row.created_at==='2026-10-21T10:15:00.000Z'));
  assert.equal((await db.execute('SELECT payload,revision FROM crm_data')).rows[0].payload,original);assert.equal((await db.execute('SELECT revision FROM crm_data')).rows[0].revision,8);
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
