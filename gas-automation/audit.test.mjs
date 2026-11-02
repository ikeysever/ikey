import test from 'node:test';
import assert from 'node:assert/strict';
import {inventory,compare,hash} from './audit.mjs';
const files=[{name:'appsscript',type:'JSON',source:'{}'},{name:'程式碼',type:'SERVER_JS',source:'function f() {}'}];
test('complete inventory includes Unicode names and manifest',()=>assert.equal(inventory(files).length,2));
test('missing manifest and duplicates fail closed',()=>{assert.throws(()=>inventory(files.slice(1)));assert.throws(()=>inventory([...files,files[0]]));});
test('unmapped remote files are never treated as Code.gs',()=>assert.ok(compare(inventory(files),{},()=>null).every(r=>r.status==='unmapped')));
test('all mapped difference categories',()=>{
 const rows=inventory(files), mapping={'appsscript:JSON':'gen3-auth/appsscript.json','程式碼:SERVER_JS':'gen3-auth/Code.gs','old:SERVER_JS':'gen3-auth/old.gs'};
 assert.deepEqual(compare(rows,mapping,p=>p.endsWith('json')?'{}':'different').map(r=>r.status).sort(),['deleted','modified','same']);
 assert.ok(compare(rows,mapping,()=>null).some(r=>r.status==='added'));
});
test('hash uses exact bytes and rejects mapping traversal',()=>{assert.notEqual(hash('a\n'),hash('a\r\n'));assert.throws(()=>compare(inventory(files),{'appsscript:JSON':'../secret'},()=>''));});
