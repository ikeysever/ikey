'use strict';
// Volatile, single-process, non-actuating bridge for end-to-end integration only.
// Never use this transport for unlock commands or production persistence.
const crypto=require('node:crypto');
const {validateDeviceLogin,validateDeviceReport,verifyBearerToken}=require('./device-bridge-contract');
function createDemoBridge({deviceId,password,now=()=>Date.now()}){
 if(!/^[A-HJ-NP-Z2-9]{8}$/.test(deviceId)||typeof password!=='string'||password.length<8)
  throw Error('DEMO_BRIDGE_CONFIG_INVALID');
 const salt=crypto.randomBytes(32);
 const expected=crypto.scryptSync(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
 const commands=new Map(),sessions=new Map();
 function login(body){
  const input=validateDeviceLogin(body);
  if(!input||input.device_id!==deviceId)return null;
  const actual=crypto.scryptSync(input.password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
  if(!crypto.timingSafeEqual(actual,expected))return null;
  const token=crypto.randomBytes(32).toString('hex');
  const hash=crypto.createHash('sha256').update(token).digest('hex');
  sessions.set(hash,now()+15*60*1000);
  return {access_token:token,expires_in:900};
 }
 function authorize(authorization){
  const match=/^Bearer ([a-f0-9]{64})$/.exec(String(authorization||''));
  if(!match)return false;
  const hash=crypto.createHash('sha256').update(match[1]).digest('hex');
  const expiry=sessions.get(hash);
  if(!expiry||expiry<=now()){sessions.delete(hash);return false}
  return verifyBearerToken(match[1],hash);
 }
 function createPing(projectId){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId))return null;
  const command={command_id:crypto.randomUUID(),project_id:projectId,device_id:deviceId,action:'ping',payload:null,status:'pending',created_at:new Date(now()).toISOString()};
  commands.set(command.command_id,command);
  return {...command};
 }
 function poll(){
  const command=[...commands.values()].find(c=>c.status==='pending');
  if(!command)return null;
  command.status='delivered';command.delivered_at=new Date(now()).toISOString();
  return {command_id:command.command_id,project_id:command.project_id,device_id:command.device_id,action:'ping',payload:null};
 }
 function report(body){
  if(!validateDeviceReport(body))return {ok:false,code:'INVALID_REPORT'};
  const command=commands.get(body.command_id);
  if(!command||command.device_id!==deviceId)return {ok:false,code:'COMMAND_NOT_FOUND'};
  if(command.status==='completed'||command.status==='failed')
   return {ok:command.status===body.result,code:command.status===body.result?'ALREADY_RECORDED':'REPORT_CONFLICT'};
  if(command.status!=='delivered'||body.result==='received')return {ok:false,code:'INVALID_TRANSITION'};
  command.status=body.result;command.reported_at=new Date(now()).toISOString();
  return {ok:true,code:'RECORDED'};
 }
 function status(projectId,commandId){
  const command=commands.get(commandId);
  return command?.project_id===projectId?{...command}:null;
 }
 return {login,authorize,createPing,poll,report,status};
}
module.exports={createDemoBridge};
