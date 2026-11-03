const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/contactFiles.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText,{exports:exportsObject,TextDecoder});const {validateContactFile,CONTACT_FILE_LIMIT}=exportsObject;
test('attachments use validated signatures and safe filenames',()=>{
 const result=validateContactFile('../../chiamata.pdf',Buffer.from('%PDF-1.4\nTest\n%%EOF'));assert.equal(result.name,'chiamata.pdf');assert.equal(result.mime,'application/pdf');
 assert.throws(()=>validateContactFile('falso.pdf',Buffer.from('<script>test</script>')),/contenuto/);
 assert.throws(()=>validateContactFile('pagina.html',Buffer.from('test')),/Formato/);
 assert.throws(()=>validateContactFile('audio.mp3',Buffer.from('not audio')),/contenuto/);
});
test('attachment size and UTF-8 text limits are enforced',()=>{
 assert.throws(()=>validateContactFile('vuoto.txt',Buffer.alloc(0)),/non vuoto/);
 assert.throws(()=>validateContactFile('grande.txt',Buffer.alloc(CONTACT_FILE_LIMIT+1)),/2 MB/);
 assert.throws(()=>validateContactFile('binario.txt',Buffer.from([0xff,0xfe,0])),/UTF-8/);
 assert.equal(validateContactFile('resoconto.txt',Buffer.from('Nota della chiamata.')).mime,'text/plain');
});
