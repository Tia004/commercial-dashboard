import AxeBuilder from '@axe-core/playwright';
import {test,expect,request,type APIRequestContext} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
let owner:APIRequestContext,second:APIRequestContext,outsider:APIRequestContext;
let ownerEmail='',outsiderEmail='',ownerId='',ownerWorkspace='',outsideWorkspace='';
const password='WorkspaceTest!2026';
const baseURL='http://127.0.0.1:3101';
function emailToken(email:string,purpose='verify'){
 const rows=readFileSync(join(process.env.TEST_DATA_DIR!,'mail.jsonl'),'utf8').trim().split('\n').map((line)=>JSON.parse(line)).filter((row)=>row.to===email);
 const message=rows.at(-1)?.message||'';const pattern=purpose==='invite'?/[?&]invite=([A-Za-z0-9_-]+)/:purpose==='reset'?/[?&]reset=([A-Za-z0-9_-]+)/:/[?&]token=([A-Za-z0-9_-]+)/;
 return message.match(pattern)?.[1] as string;
}
async function register(api:APIRequestContext,email:string,name:string,inviteToken?:string){
 const result=await api.post('/api/auth',{data:{action:'register',email,name,password,company:'Azienda QA',inviteToken}});expect(result.status()).toBe(201);
 const token=emailToken(email);expect(token).toBeTruthy();
 const preview=await api.get('/api/auth/verify?token='+token,{maxRedirects:0});expect(preview.status()).toBe(307);
 const denied=await api.post('/api/auth',{data:{action:'login',email,password}});expect(denied.status()).toBe(403);
 const verified=await api.post('/api/auth/verify',{data:{token}});expect(verified.ok()).toBeTruthy();return (await verified.json()).user;
}
const contactData=(company:string)=>({id:randomUUID(),company,person:'Referente QA',email:'info@example.test',phone:'+39 010 000000',address:'Via Test 1',city:'Padova',postalCode:'35100',province:'PD',zone:'Veneto',brand:'QA',type:'Contatto',statuses:[],archived:false});
test.beforeAll(async()=>{
 owner=await request.newContext({baseURL,extraHTTPHeaders:{'x-forwarded-for':'127.2.0.1'}});
 second=await request.newContext({baseURL});
 outsider=await request.newContext({baseURL,extraHTTPHeaders:{'x-forwarded-for':'127.2.0.2'}});
 ownerEmail='owner-'+Date.now()+'@example.test';outsiderEmail='outside-'+Date.now()+'@example.test';
 const user=await register(owner,ownerEmail,'Owner QA');ownerId=user.id;ownerWorkspace=user.workspaceId;
 const other=await register(outsider,outsiderEmail,'Collega QA');outsideWorkspace=other.workspaceId;
 expect((await second.post('/api/auth',{data:{action:'login',email:ownerEmail,password}})).status()).toBe(200);
});
test.afterAll(async()=>{await owner.dispose();await second.dispose();await outsider.dispose();});

test('independent sessions share contacts, append activities concurrently, preserve edits and reject other tenants',async()=>{
 const created=await owner.post('/api/contacts',{data:contactData('Azienda concorrente')});expect(created.status()).toBe(201);const contact=(await created.json()).contact;
 const fromOther=await second.get('/api/contacts');expect((await fromOther.json()).contacts.some((item:any)=>item.id===contact.id)).toBeTruthy();
 const notes=await Promise.all([owner,second].map((api,index)=>api.post('/api/contacts/'+contact.id+'/activities',{data:{id:randomUUID(),text:'Nota libera sessione '+index}})));
 notes.forEach((result)=>expect(result.status()).toBe(201));
 const activities=(await (await owner.get('/api/contacts/'+contact.id+'/activities')).json()).activities;expect(activities).toHaveLength(2);expect(Date.parse(activities[0].createdAt)).toBeGreaterThan(0);
 const edit=await second.patch('/api/contacts/'+contact.id+'/activities',{data:{activityId:activities[0].id,text:'Testo aggiornato',baseRevision:activities[0].revision}});expect(edit.status()).toBe(200);
 expect((await (await owner.get('/api/contacts/'+contact.id+'/activities')).json()).activities).toHaveLength(2);
 const toggle=await owner.patch('/api/contacts/'+contact.id,{data:{action:'toggle-status',status:'Richiama'}});expect((await toggle.json()).contact.statuses).toContain('Richiama');
 expect((await owner.patch('/api/contacts/'+contact.id,{data:{type:'Qualificato'}})).status()).toBe(400);
 expect((await outsider.patch('/api/contacts/'+contact.id,{data:{company:'Intruso'}})).status()).toBe(404);
 expect((await (await outsider.get('/api/contacts')).json()).contacts.some((item:any)=>item.id===contact.id)).toBeFalsy();
});

test('parallel passkey ceremonies have distinct server challenges for the same account',async()=>{
 const options=await Promise.all([owner,second].map(api=>api.post('/api/auth/passkey',{data:{action:'register-options'}})));
 options.forEach(response=>expect(response.status()).toBe(200));const data=await Promise.all(options.map(response=>response.json()));
 expect(data[0].ceremonyId).toBeTruthy();expect(data[0].ceremonyId).not.toBe(data[1].ceremonyId);expect(data[0].options.challenge).not.toBe(data[1].options.challenge);
 expect((await owner.post('/api/auth/passkey',{data:{action:'register-verify',response:{}}})).status()).toBe(400);
});

test('two stale CRM snapshots merge different fields instead of blocking the second device',async()=>{
 const initial=(await (await owner.get('/api/crm')).json());const base=initial.data||{opportunities:[],tasks:[],brands:[],salesReps:[]};
 const deal={id:randomUUID(),company:'Legacy QA',name:'Persona QA',value:100,history:[],phone:'',email:'',brand:'QA',stage:'Nuovo lead',service:'Consulenza',salesRep:'Owner QA',leadSource:'Test',entryDate:'2026-10-25',notes:'',whatsapp:'',valueType:'One Shot'};
 const saved=await owner.put('/api/crm',{data:{workspaceId:ownerWorkspace,...base,opportunities:[...base.opportunities,deal],baseRevision:initial.revision,baseData:base}});expect(saved.status()).toBe(200);const start=await saved.json();
 const first={...start.data,opportunities:start.data.opportunities.map((item:any)=>item.id===deal.id?{...item,phone:'111'}:item)};
 const last={...start.data,opportunities:start.data.opportunities.map((item:any)=>item.id===deal.id?{...item,email:'team@example.test'}:item)};
 const writes=await Promise.all([owner.put('/api/crm',{data:{workspaceId:ownerWorkspace,...first,baseData:start.data,baseRevision:start.revision}}),second.put('/api/crm',{data:{workspaceId:ownerWorkspace,...last,baseData:start.data,baseRevision:start.revision}})]);
 writes.forEach((result)=>expect(result.status()).toBe(200));
 const final=(await (await owner.get('/api/crm')).json()).data.opportunities.find((item:any)=>item.id===deal.id);expect(final.phone).toBe('111');expect(final.email).toBe('team@example.test');
});

test('presence distinguishes devices without exposing cookies and chat remains personal',async()=>{
 await owner.post('/api/presence',{data:{tabId:randomUUID(),view:'contacts',targetId:'',focus:'Nuova attività'}});
 const presence=await second.post('/api/presence',{data:{tabId:randomUUID(),view:'chat',targetId:'',focus:'Messaggio chat'}});
 const sessions=(await presence.json()).sessions;expect(sessions.length).toBeGreaterThanOrEqual(2);expect(new Set(sessions.map((item:any)=>item.number)).size).toBe(sessions.length);expect(JSON.stringify(sessions)).not.toContain('session_hash');
 const chat=await owner.post('/api/chat',{data:{requestId:randomUUID(),model:'workspace-local',text:'Riepilogo contatti'}});expect(chat.status()).toBe(200);const data=await chat.json();expect(data.reply).toContain('aziende');
 expect((await (await second.get('/api/chat?threadId='+data.threadId)).json()).messages).toHaveLength(2);
 expect((await outsider.get('/api/chat?threadId='+data.threadId)).status()).toBe(404);
});

test('existing accounts accept company invites, retain their old workspace and receive member permissions',async()=>{
 const invite=await owner.post('/api/team',{data:{email:outsiderEmail,role:'member'}});expect(invite.status()).toBe(200);const token=emailToken(outsiderEmail,'invite');expect(token).toBeTruthy();
 expect((await outsider.post('/api/team/invite',{data:{token}})).status()).toBe(200);
 const user=(await (await outsider.get('/api/auth')).json()).user;expect(user.workspaceId).toBe(ownerWorkspace);expect(user.role).toBe('member');
 expect((await outsider.post('/api/team',{data:{email:'another@example.test'}})).status()).toBe(403);
 const memberships=(await (await outsider.get('/api/team/workspace')).json()).workspaces;expect(memberships).toHaveLength(2);
 expect((await outsider.post('/api/team/workspace',{data:{workspaceId:outsideWorkspace}})).status()).toBe(200);
 expect((await (await outsider.get('/api/auth')).json()).user.workspaceId).toBe(outsideWorkspace);
 expect((await outsider.post('/api/team',{data:{email:ownerEmail,role:'member'}})).status()).toBe(200);const reverseToken=emailToken(ownerEmail,'invite');
 expect((await owner.post('/api/team/invite',{data:{token:reverseToken}})).status()).toBe(200);
 expect((await (await owner.get('/api/auth')).json()).user.workspaceId).toBe(outsideWorkspace);
 expect((await (await second.get('/api/auth')).json()).user.workspaceId).toBe(ownerWorkspace);
 expect((await owner.put('/api/crm',{data:{workspaceId:ownerWorkspace,opportunities:[],tasks:[],brands:[],salesReps:[],baseRevision:0}})).status()).toBe(409);
 expect((await owner.post('/api/team/workspace',{data:{workspaceId:ownerWorkspace}})).status()).toBe(200);

});

test('re-registering an unverified email cannot replace its password; repeated verification is safe',async()=>{
 const api=await request.newContext({baseURL,extraHTTPHeaders:{'x-forwarded-for':'127.2.0.3'}});const email='pending-'+Date.now()+'@example.test';
 expect((await api.post('/api/auth',{data:{action:'register',email,name:'Pending QA',password,company:'QA'}})).status()).toBe(201);const token=emailToken(email);
 expect((await api.post('/api/auth',{data:{action:'register',email,name:'Attacker',password:'DifferentPassword!2026'}})).status()).toBe(202);
 expect((await api.post('/api/auth/verify',{data:{token}})).status()).toBe(200);
 const repeated=await api.post('/api/auth/verify',{data:{token}});expect((await repeated.json()).alreadyVerified).toBeTruthy();expect(repeated.headers()['set-cookie']).toBeUndefined();
 expect((await api.post('/api/auth',{data:{action:'login',email,password}})).status()).toBe(200);
 expect((await api.post('/api/auth',{data:{action:'login',email,password:'DifferentPassword!2026'}})).status()).toBe(401);await api.dispose();
});

test('unauthenticated and cross-site callers cannot use protected or diagnostic endpoints',async()=>{
 const api=await request.newContext({baseURL});
 expect((await api.get('/api/admin/purge-user')).status()).toBe(404);
 expect((await api.get('/api/contacts')).status()).toBe(401);
 expect((await api.post('/api/tts',{data:{text:'test'}})).status()).toBe(401);
 expect((await owner.post('/api/contacts',{headers:{origin:'https://attacker.example'},data:contactData('Cross site')})).status()).toBe(403);
 await api.dispose();
});

test('new colleagues join the existing company, verify email and cannot export an administrator backup',async()=>{
 const email='invited-'+Date.now()+'@example.test';
 expect((await owner.post('/api/team',{data:{email,role:'member'}})).status()).toBe(200);
 const oldToken=emailToken(email,'invite');
 expect((await owner.post('/api/team',{data:{email,role:'member',resend:true}})).status()).toBe(200);
 const token=emailToken(email,'invite');expect(token).not.toBe(oldToken);
 expect((await owner.get('/api/team/invite?token='+oldToken)).status()).toBe(404);
 const colleague=await request.newContext({baseURL,extraHTTPHeaders:{'x-forwarded-for':'127.2.0.4'}});
 const user=await register(colleague,email,'Nuovo collega',token);expect(user.workspaceId).toBe(ownerWorkspace);expect(user.role).toBe('member');
 expect((await colleague.get('/api/contacts/export')).status()).toBe(403);
 const backup=await owner.get('/api/contacts/export');expect(backup.status()).toBe(200);const data=await backup.json();expect(data.contacts.length).toBeGreaterThan(0);expect(data.activities.length).toBe(2);expect(data.activityRevisions.length).toBe(1);expect(JSON.stringify(data)).not.toContain('password_hash');
 await colleague.dispose();
});

test('password recovery consumes a link once, changes the password and invalidates old sessions',async()=>{
 expect((await outsider.post('/api/auth/reset',{data:{action:'request',email:outsiderEmail}})).status()).toBe(200);const token=emailToken(outsiderEmail,'reset');expect(token).toBeTruthy();
 const recovery=await request.newContext({baseURL});
 expect((await recovery.post('/api/auth/reset',{data:{action:'confirm',token,password:'NewPassword!2026'}})).status()).toBe(200);
 expect((await recovery.post('/api/auth/reset',{data:{action:'confirm',token,password:'AnotherPassword!2026'}})).status()).toBe(400);
 expect((await (await outsider.get('/api/auth')).json()).user).toBeNull();
 expect((await recovery.post('/api/auth',{data:{action:'login',email:outsiderEmail,password}})).status()).toBe(401);
 expect((await recovery.post('/api/auth',{data:{action:'login',email:outsiderEmail,password:'NewPassword!2026'}})).status()).toBe(200);await recovery.dispose();
});

test('contacts, free diary, onboarding and Copilot work across mobile, tablet and desktop',async({browser})=>{
 const context=await browser.newContext({storageState:await owner.storageState()});const page=await context.newPage();const errors:string[]=[];page.on('pageerror',(error)=>errors.push(error.message));
 let transientAuthFailures=2;await page.route('**/api/auth',async route=>{if(route.request().method()==='GET'&&transientAuthFailures-->0)await route.fulfill({status:503,json:{error:'Temporary test outage'}});else await route.continue();});
 await page.goto('/');await expect(page.getByRole('heading',{name:'Da dove vuoi iniziare?'})).toBeVisible();await page.screenshot({path:'artifacts/qa/experience-chooser.png'});await page.keyboard.press('Shift+Tab');expect(await page.evaluate(()=>!!document.activeElement?.closest('[role=dialog]'))).toBeTruthy();await page.getByRole('button',{name:'Entra nel workspace'}).click();await expect(page.getByRole('heading',{name:'Da dove vuoi iniziare?'})).toBeHidden();
 await expect(page.getByRole('heading',{name:'Le relazioni, prima di tutto.'})).toBeVisible();
 for(const width of [375,768,1440]){
  await page.setViewportSize({width,height:950});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  mkdirSync('artifacts/qa',{recursive:true});await page.screenshot({path:'artifacts/qa/contacts-'+width+'.png',fullPage:true});
 }
 await page.setViewportSize({width:1440,height:950});
 await page.getByRole('button',{name:'Apri Azienda concorrente',exact:true}).click();await expect(page.getByRole('heading',{name:'Attività',exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'Nuova attività',exact:true}).fill('Diario E2E: nessun campo rigido, solo testo.');await page.getByRole('button',{name:'Aggiungi attività',exact:true}).click();await expect(page.getByText('Diario E2E: nessun campo rigido, solo testo.')).toBeVisible();
 const diaryAudit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(diaryAudit.violations.map(v=>v.id)).toEqual([]);await page.screenshot({path:'artifacts/qa/contact-diary.png',fullPage:true});
 await page.getByRole('button',{name:'Posiziona sulla mappa'}).click();await expect(page.locator('.leaflet-container')).toBeVisible();await page.locator('.leaflet-container').click({position:{x:180,y:140}});await expect(page.getByRole('button',{name:'Aggiorna punto mappa'})).toBeVisible();
 await page.setViewportSize({width:375,height:850});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:'artifacts/qa/contact-diary-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:950});
await page.getByRole('button',{name:'Chiudi scheda contatto',exact:true}).click();
 // Remote data becomes visible without reloading or sharing local storage.
 const remote=await second.post('/api/contacts',{data:contactData('Azienda da altro dispositivo')});expect(remote.status()).toBe(201);await expect(page.getByText('Azienda da altro dispositivo',{exact:true})).toBeVisible({timeout:12000});
 await page.getByRole('button',{name:'Profilo e Account personale'}).click();await page.getByRole('button',{name:'palette Aspetto',exact:true}).click();
 for(const theme of ['Light','OLED','Dark']){await page.getByRole('button',{name:new RegExp(theme)}).click();await expect(page.locator('.theme-choice.active')).toContainText(theme);await expect.poll(()=>page.locator('html').getAttribute('data-theme')).toBe(theme==='Light'?'light':theme==='Dark'?'slate':'oled');await page.evaluate(()=>Promise.all(document.getAnimations().filter(animation=>animation.effect instanceof KeyframeEffect&&animation.effect.getTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{}))));await page.screenshot({path:'artifacts/qa/settings-'+theme+'.png',fullPage:true});
 const settingsAudit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(settingsAudit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);
 await page.getByRole('button',{name:'Chiudi impostazioni'}).click();await page.screenshot({path:'artifacts/qa/dashboard-'+theme+'.png',fullPage:true});
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);
 await page.getByRole('button',{name:'Profilo e Account personale'}).click();await page.getByRole('button',{name:'palette Aspetto',exact:true}).click();}
 await page.getByRole('button',{name:'Chiudi impostazioni'}).click();
 await page.getByRole('button',{name:'auto_awesome Copilota',exact:true}).click();await expect(page.getByRole('textbox',{name:'Messaggio al copilota'})).toBeVisible();
 await page.getByRole('textbox',{name:'Messaggio al copilota'}).fill('Quali aziende devo richiamare?');await page.getByRole('button',{name:'Invia messaggio',exact:true}).click();await expect(page.locator('.chat-message.assistant')).toBeVisible({timeout:20000});
 const chatAudit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(chatAudit.violations.map(v=>v.id)).toEqual([]);await page.screenshot({path:'artifacts/qa/copilot-desktop.png',fullPage:true});
 let speechRequest:any;await page.route('**/api/tts',async route=>{speechRequest=route.request().postDataJSON();await route.fulfill({status:503,json:{error:'Simulated neural outage'}});});
 await page.evaluate(()=>{localStorage.setItem('hubc_crm_neural_voice_v2','Kore');localStorage.setItem('hubc_crm_voice_speed_v2','1.2');Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},getVoices(){return[];},speak(utterance:any){(window as any).__spoken={text:utterance.text,lang:utterance.lang,rate:utterance.rate};utterance.onend?.(new Event('end'));}}});});
 await page.getByRole('button',{name:'Ascolta risposta'}).click();await expect.poll(()=>page.evaluate(()=>(window as any).__spoken?.lang)).toBe('it-IT');expect(speechRequest.voice).toBe('Kore');expect(speechRequest.rate).toBe('+20%');expect(await page.evaluate(()=>(window as any).__spoken.rate)).toBeCloseTo(1.2);

 await page.setViewportSize({width:375,height:850});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();await page.screenshot({path:'artifacts/qa/copilot-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:950});
 for(const label of ['Risultati','Focus','Pipeline','Opportunità','Attività','Avvisi e stand-by','Analisi']){const button=page.locator('.sidebar-nav .nav-item').filter({has:page.getByText(label,{exact:true})});await button.click();await expect(page.locator('#main-content')).toBeVisible();await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}

 expect(errors).toEqual([]);await context.close();
});
