import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
export const SCRIPT_ID='16Oa3hrtSP7YMGWMoS1gW_RBFFV_CKIRN0Hp_OTIZ6IFkliNZl5AclFBy';
export const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
export function inventory(files){
  if(!Array.isArray(files)||!files.length) throw Error('invalid inventory');
  const seen=new Set();
  const rows=files.map(f=>{
    if(!['SERVER_JS','HTML','JSON'].includes(f.type)||typeof f.name!=='string'||typeof f.source!=='string') throw Error('invalid file');
    const key=f.name+':'+f.type;
    if(seen.has(key)) throw Error('duplicate file'); seen.add(key);
    return {name:f.name,type:f.type,sha256:hash(f.source)};
  });
  if(!files.some(f=>f.name==='appsscript'&&f.type==='JSON')) throw Error('manifest missing');
  return rows.sort((a,b)=>(a.name+':'+a.type).localeCompare(b.name+':'+b.type,'en'));
}
export function compare(rows,mapping,read){
  const used=new Set();
  const results=rows.map(r=>{
    const key=r.name+':'+r.type, path=mapping[key]; used.add(key);
    if(!path) return {...r,status:'unmapped'};
    if(!/^gen3-auth\/[A-Za-z0-9_.-]+$/.test(path)) throw Error('invalid mapping');
    const local=read(path);
    return {...r,path,status:local===null?'added':hash(local)===r.sha256?'same':'modified'};
  });
  for(const key of Object.keys(mapping)) if(!used.has(key)) results.push({key,path:mapping[key],status:'deleted'});
  return results;
}
async function main(){
  const dir=mkdtempSync(join(tmpdir(),'ikey-gas-audit-'));
  try {
    const raw=process.env.GAS_AUDIT_CREDENTIALS; delete process.env.GAS_AUDIT_CREDENTIALS;
    const credentials=JSON.parse(raw); const c=credentials.tokens?.default;
    if(!c?.refresh_token||!c.client_id||!c.client_secret) throw Error('credentials unavailable');
    const auth=await fetch('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.client_id,client_secret:c.client_secret,refresh_token:c.refresh_token,grant_type:'refresh_token'})});
    if(!auth.ok) throw Error('OAuth failed');
    const token=(await auth.json()).access_token;
    if(!token) throw Error('OAuth failed');
    // This is the ONLY Apps Script request: read HEAD, never execute or update.
    const response=await fetch(`https://script.googleapis.com/v1/projects/${SCRIPT_ID}/content`,{method:'GET',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${token}`}});
    if(!response.ok) throw Error('GAS read failed');
    const project=await response.json();
    if(project.scriptId!==SCRIPT_ID) throw Error('project mismatch');
    writeFileSync(join(dir,'snapshot.json'),JSON.stringify(project),{mode:0o600});
    const rows=inventory(project.files);
    const mapping=JSON.parse(readFileSync(new URL('./mapping.json',import.meta.url),'utf8'));
    const results=compare(rows,mapping,p=>{try{return readFileSync(p,'utf8')}catch(e){if(e.code==='ENOENT')return null;throw e}});
    // Only metadata and hashes leave the temporary directory. Never source or tokens.
    const report={scriptId:SCRIPT_ID,commit:process.env.GITHUB_SHA||null,files:results,inventorySha256:hash(JSON.stringify(rows)),mappingComplete:results.every(r=>r.status!=='unmapped'),writebackEnabled:false};
    const output=JSON.stringify(report,null,2);
    if(process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY,'```json\n'+output+'\n```\n',{flag:'a'});
    console.log('Read-only audit completed; metadata and hashes are in the job summary.');
  } finally {rmSync(dir,{recursive:true,force:true});}
}
if(process.argv[1]===fileURLToPath(import.meta.url)) main().catch(()=>{console.error('Audit failed; credentials, response bodies and source are suppressed.');process.exitCode=1});
