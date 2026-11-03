const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');const os=require('node:os');const path=require('node:path');const {createClient}=require('@libsql/client');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText,{exports,crypto:require('node:crypto'),require:name=>mocks[name]||require(name)});return exports;}
test('existing Notizie backfill once, reuse existing opportunities and preserve commercial progress',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pipeline-backfill-'));const db=createClient({url:'file:'+path.join(dir,'test.sqlite')});
 try{
  await db.execute('CREATE TABLE schema_migrations(id TEXT PRIMARY KEY,applied_at TEXT)');await db.execute('CREATE TABLE contacts(id TEXT PRIMARY KEY,workspace_id TEXT,data TEXT,revision INTEGER)');await db.execute('CREATE TABLE crm_data(user_id TEXT PRIMARY KEY,payload TEXT,updated_at TEXT,revision INTEGER)');
  const contact={company:'Azienda precedente',person:'Referente',brand:'NoLimits',phone:'123',email:'info@example.test',type:'Notizia',archived:false};
  await db.execute({sql:'INSERT INTO contacts VALUES (?,?,?,1)',args:['contact-a','workspace',JSON.stringify(contact)]});
  await db.execute({sql:'INSERT INTO contacts VALUES (?,?,?,1)',args:['contact-b','workspace',JSON.stringify({...contact,company:'Notizia senza opportunità'})]});
  await db.execute({sql:'INSERT INTO crm_data VALUES (?,?,?,4)',args:['workspace',JSON.stringify({opportunities:[{id:'originale',company:contact.company,name:'Referente precedente',brand:'NoLimits',stage:'Trattativa',value:2500,history:[]}],tasks:[],brands:['NoLimits'],salesReps:[]}),new Date().toISOString()]});
  const {ensureContactPipeline}=load('src/lib/contactPipeline.ts',{'./serverDb':{getServerDb:async()=>db},'./date':{italianDateKey:()=> '2026-11-03'},'./contactRepository':{contactFromRow:row=>({...JSON.parse(row.data),id:row.id,revision:row.revision})}});
  await ensureContactPipeline('workspace','Commerciale');const once=await db.execute('SELECT payload,revision FROM crm_data');await ensureContactPipeline('workspace','Commerciale');const twice=await db.execute('SELECT payload,revision FROM crm_data');assert.equal(once.rows[0].revision,5);assert.equal(once.rows[0].revision,twice.rows[0].revision);
  const opportunities=JSON.parse(twice.rows[0].payload).opportunities;assert.equal(opportunities.length,2);const original=opportunities.find(item=>item.id==='originale');assert.equal(original.contactId,'contact-a');assert.equal(original.stage,'Trattativa');assert.equal(original.value,2500);assert.equal(opportunities.find(item=>item.contactId==='contact-b').stage,'Nuovo lead');
  const {migrateContactFiles}=load('src/lib/migrations/20261103-contact-files.ts');for(let i=0;i<2;i++){const tx=await db.transaction('write');try{await migrateContactFiles(tx);await tx.commit();}finally{tx.close();}}
  assert.equal((await db.execute('SELECT count(*) AS count FROM contacts')).rows[0].count,2);assert.equal((await db.execute("SELECT count(*) AS count FROM schema_migrations WHERE id='20261103-contact-files'")).rows[0].count,1);
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
