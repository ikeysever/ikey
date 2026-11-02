'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createDeviceCommandGateway}=require('../lib/device-command-gateway');
const {signCommandAssertion,commandPayloadDigest}=require('../lib/command-trust-assertion');
const PROJECT='00000000-0000-4000-8000-000000000001';
const USER='00000000-0000-4000-8000-000000000002';
const DEVICE='Y8R69EXB';
const actor={user_id:USER};
const device={device_id:DEVICE,authenticated:true};
test('signed assertion has payload integrity, expiry, unique nonce (offline only)',()=>{
 const secret=crypto.randomBytes(32).toString('base64');
 const payload={project_id:PROJECT,device_id:DEVICE,actor_user_id:USER,command_id:crypto.randomUUID()};
 const token=signCommandAssertion({secret,action:'deviceCommandGet',...payload,payload});
 const [body,mac]=token.split('.');
 const claims=JSON.parse(Buffer.from(body,'base64url'));
 assert.equal(crypto.createHmac('sha256',secret).update(body).digest('base64url'),mac);
 assert.equal(claims.payload_sha256,commandPayloadDigest(payload));
 assert.equal(claims.exp-claims.iat,30000);
 const second=signCommandAssertion({secret,action:'deviceCommandGet',...payload,payload});
 assert.notEqual(JSON.parse(Buffer.from(second.split('.')[0],'base64url')).nonce,claims.nonce);
 assert.notEqual(commandPayloadDigest({...payload,command_id:'modified'}),claims.payload_sha256);
});
test('gateway rejects unauthorized actor, unbound device and unauthenticated claim',async()=>{
 const calls=[];
 const gateway=createDeviceCommandGateway({
  call:async(action,payload)=>{calls.push({action,payload});return null;},
  verifyActor:async(a)=>a.user_id===USER,
  verifyDeviceBinding:async(_,id)=>id===DEVICE,
 });
 await assert.rejects(gateway.create({actor:{user_id:'wrong'},project_id:PROJECT,device_id:DEVICE,idempotency_key:'test-key-1'}),/PROJECT_ADMIN_REQUIRED/);
 await assert.rejects(gateway.create({actor,project_id:PROJECT,device_id:'NOTBOUND',idempotency_key:'test-key-2'}),/DEVICE_BINDING_REQUIRED/);
 await assert.rejects(gateway.claim({device:{device_id:DEVICE,authenticated:false},project_id:PROJECT}),/DEVICE_NOT_VERIFIED/);
 assert.equal(calls.length,0,'no command reaches GAS when authorization fails');
});
test('mocked command lifecycle: create, idempotency, claim, report, expiry',async()=>{
 let now=1000000;
 const commands=new Map(),byKey=new Map(),usedClaims=new Set();
 const call=async(action,p)=>{
  for(const cmd of commands.values())if(['pending','claimed'].includes(cmd.status)&&now>=cmd.deadline_at)cmd.status='timed_out';
  if(action==='deviceCommandCreateAtomic'){
   const key=p.device_id+':'+p.idempotency_key;
   if(byKey.has(key))return {duplicate:true,command:commands.get(byKey.get(key))};
   const cmd={command_id:crypto.randomUUID(),action:'unlock',status:'pending',deadline_at:now+p.timeout_ms};
   commands.set(cmd.command_id,cmd);byKey.set(key,cmd.command_id);
   return {duplicate:false,command:cmd};
  }
  if(action==='deviceCommandClaimAtomic'){
   const cmd=[...commands.values()].find(x=>x.status==='pending'&&x.deadline_at>now);
   if(!cmd)return null;
   if(usedClaims.has(p.claim_token))throw Error('CLAIM_REPLAY');
   usedClaims.add(p.claim_token);cmd.status='claimed';cmd.claim_token=p.claim_token;
   return {command:{command_id:cmd.command_id,action:cmd.action,status:cmd.status,deadline_at:cmd.deadline_at}};
  }
  if(action==='deviceCommandReportAtomic'){
   const cmd=commands.get(p.command_id);
   if(!cmd||cmd.claim_token!==p.claim_token)throw Error('INVALID_CLAIM');
   if(cmd.status===p.status)return {duplicate:true,status:p.status};
   if(cmd.status!=='claimed'||now>=cmd.deadline_at)throw Error('INVALID_TRANSITION');
   cmd.status=p.status;return {duplicate:false,status:p.status};
  }
  if(action==='deviceCommandGet')return commands.get(p.command_id)||null;
  throw Error('UNKNOWN_ACTION');
 };
 const gateway=createDeviceCommandGateway({call,verifyActor:async()=>true,verifyDeviceBinding:async()=>true});
 const base={actor,project_id:PROJECT,device_id:DEVICE,idempotency_key:'test-idem-001',timeout_ms:15000};
 const first=await gateway.create(base);
 const duplicate=await gateway.create(base);
 assert.equal(first.command_id,duplicate.command_id);assert.equal(duplicate.duplicate,true);
 const claim=await gateway.claim({device,project_id:PROJECT});
 assert.equal(claim.command_id,first.command_id);
 assert.equal(await gateway.claim({device,project_id:PROJECT}),null);
 const report=await gateway.report({device,project_id:PROJECT,command_id:first.command_id,claim_token:claim.claim_token,status:'succeeded',feedback_observed:true});
 assert.equal(report.duplicate,false);
 const again=await gateway.report({device,project_id:PROJECT,command_id:first.command_id,claim_token:claim.claim_token,status:'succeeded',feedback_observed:true});
 assert.equal(again.duplicate,true);
 const next=await gateway.create({...base,idempotency_key:'test-idem-002',timeout_ms:1000});
 now+=1001;
 assert.equal(await gateway.claim({device,project_id:PROJECT}),null);
 assert.equal((await gateway.get({actor,project_id:PROJECT,device_id:DEVICE,command_id:next.command_id})).status,'timed_out');
});
// NOTE: mock tests do not establish GAS nonce replay safety or live Render/GAS integration.
