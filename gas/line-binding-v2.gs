// Candidate only: NOT deployed. Install with line-binding-domain.gs in existing project.
// Add the lineBindingV2 branch AFTER existing API-key validation in doPost.
function ikeyLineV2Dispatch_(envelope) {
 const props=PropertiesService.getScriptProperties();
 if(props.getProperty('IKEY_LINE_BINDING_ENABLED')!=='true')throw Error('LINE_DISABLED');
 const secret=props.getProperty('IKEY_LINE_TRUST_SECRET');
 const e=envelope||{},now=Date.now();
 if(!secret||secret.length<32||!['health','create','consume','status','unbind','notification','webhookNotification','admin'].includes(e.action)||typeof e.body!=='string'||e.body.length>10000||!/^\d{13}$/.test(e.timestamp)||Math.abs(now-Number(e.timestamp))>60000||!(/^[a-f0-9-]{36}$/.test(e.nonce||'')))throw Error('LINE_ASSERTION_INVALID');
 const bytes=Utilities.computeHmacSha256Signature(e.action+'\n'+e.timestamp+'\n'+e.nonce+'\n'+e.body,secret,Utilities.Charset.UTF_8);
 const expected=bytes.map(x=>('0'+((x+256)%256).toString(16)).slice(-2)).join('');
 let mismatch=0;const supplied=String(e.signature||'');if(!/^[a-f0-9]{64}$/.test(supplied))throw Error('LINE_ASSERTION_INVALID');
 for(let i=0;i<64;i++)mismatch|=expected.charCodeAt(i)^supplied.charCodeAt(i);
 if(mismatch)throw Error('LINE_ASSERTION_INVALID');
 const payload=JSON.parse(e.body);
 return locked(()=>IKeyLineDomain.execute(ikeyLineRepository_(),e.action,payload,now));
}
function ikeyLineRepository_(){
 const db=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('GEN3_SPREADSHEET_ID'));
 let bt,at;
 function table(name,headers){const tab=db.getSheetByName(name);if(!tab||tab.getLastColumn()<headers.length)throw Error('LINE_SCHEMA_NOT_READY');const actual=tab.getRange(1,1,1,headers.length).getValues()[0];if(headers.some((h,i)=>h!==actual[i]))throw Error('LINE_SCHEMA_MISMATCH');return tab;}
 function read(tab,headers){const n=tab.getLastRow();return n<2?[]:tab.getRange(2,1,n-1,headers.length).getValues().map(row=>Object.fromEntries(headers.map((k,i)=>[k,String(row[i]??'')])));}
 function write(tab,headers,value,key,insert){
  const all=read(tab,headers),indices=[];all.forEach((r,i)=>{if(r[key]===value[key])indices.push(i+2);});
  if(!value[key]||(insert?indices.length!==0:indices.length!==1))throw Error('LINE_ROW_CONFLICT');
  const row=insert?tab.getLastRow()+1:indices[0];
  const values=headers.map(k=>String(value[k]??''));
  if(values.some(v=>/^[=+@\-\t\r]/.test(v)))throw Error('LINE_FORMULA_DENIED');
  tab.getRange(row,1,1,headers.length).setValues([values]);SpreadsheetApp.flush();
  const result=tab.getRange(row,1,1,headers.length).getValues()[0];
  if(result.some((v,i)=>String(v)!==values[i]))throw Error('LINE_WRITE_UNCONFIRMED');
 }
 return {
  schema:(B,A)=>{bt=table('LINE_Bindings',B);at=table('LINE_Audit_Logs',A);},
  bindings:()=>read(bt,IKeyLineDomain.B),logs:()=>read(at,IKeyLineDomain.A),
  actor:hash=>execute('resolveSession',{hash}),user:id=>execute('findById',{user_id:id}),
  appendBinding:b=>write(bt,IKeyLineDomain.B,b,'binding_id',true),updateBinding:b=>write(bt,IKeyLineDomain.B,b,'binding_id',false),
  appendLog:a=>write(at,IKeyLineDomain.A,a,'audit_id',true),updateLog:a=>write(at,IKeyLineDomain.A,a,'audit_id',false)
 };
}
