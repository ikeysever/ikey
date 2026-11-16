'use strict';
/**
 * Physical unlock command contract (staging).
 * No GPIO actuation or command dispatch is enabled by this module.
 * Atomic database claim + device execution receipts must be implemented before rollout.
 */
const {randomUUID}=require('node:crypto');
const DEVICE=/^[A-HJ-NP-Z2-9]{8}$/;
const PROJECT=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMMAND=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TTL_MS=15000;
function validateTarget({project_id,device_id,slot_number}={}){
 return typeof project_id==='string'&&PROJECT.test(project_id)&&
 typeof device_id==='string'&&DEVICE.test(device_id)&&
 Number.isSafeInteger(slot_number)&&slot_number>=1&&slot_number<=256;
}
function createCommand(target,{now=Date.now(),id=randomUUID()}={}){
 if(!validateTarget(target)||!Number.isSafeInteger(now)||!COMMAND.test(id))throw Error('INVALID_UNLOCK_TARGET');
 return Object.freeze({command_id:id,project_id:target.project_id,device_id:target.device_id,
  slot_number:target.slot_number,status:'pending',created_at:new Date(now).toISOString(),
  expires_at:new Date(now+MAX_TTL_MS).toISOString()});
}
function canExecute(command,{deviceId,now=Date.now()}={}){
 return Boolean(command&&command.status==='claimed'&&command.device_id===deviceId&&
  DEVICE.test(deviceId||'')&&Number.isSafeInteger(now)&&
  Number.isFinite(Date.parse(command.expires_at))&&Date.parse(command.expires_at)>now&&
  Number.isFinite(Date.parse(command.created_at))&&Date.parse(command.created_at)<=now&&
  Date.parse(command.expires_at)-Date.parse(command.created_at)<=MAX_TTL_MS);
}
function receiptValid(receipt,command){
 return Boolean(receipt&&command&&COMMAND.test(receipt.command_id||'')&&
 receipt.command_id===command.command_id&&receipt.device_id===command.device_id&&
 ['executed','failed'].includes(receipt.status)&&typeof receipt.executed_at==='string'&&
 Number.isFinite(Date.parse(receipt.executed_at)));
}
module.exports={MAX_TTL_MS,validateTarget,createCommand,canExecute,receiptValid};
