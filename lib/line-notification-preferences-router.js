'use strict';
const {randomUUID}=require('node:crypto');
const TYPES=Object.freeze([
 {id:'approval_granted',label:'審核通過',audience:'user',group:'一般通知'},
 {id:'unlock_success',label:'開鎖成功',audience:'user',group:'一般通知'},
 {id:'approval_pending',label:'等待審核',audience:'admin',group:'管理員通知'},
 {id:'unlock_activity',label:'開鎖通知',audience:'admin',group:'管理員通知'},
 {id:'battery_low',label:'低電量警示',audience:'admin',group:'管理員通知'},
 {id:'abnormal_open',label:'異常開啟',audience:'admin',group:'管理員通知'},
 {id:'device_offline',label:'離線警示',audience:'admin',group:'管理員通知'},
 {id:'inventory_low',label:'庫存警示',audience:'admin',group:'管理員通知'},
 {id:'extension_alert',label:'其他擴充功能警示',audience:'admin',group:'擴充與環境監測'},
 {id:'environment_sensor_abnormal',label:'溫濕度感測器異常警示',audience:'admin',group:'擴充與環境監測'},
 {id:'temperature_humidity_threshold',label:'溫度／濕度超過警戒值',audience:'admin',group:'擴充與環境監測'},
 {id:'fire_alert',label:'起火警示',audience:'admin',group:'擴充與環境監測'}
]);
module.exports=function mountLineNotificationPreferences(app,{store,requireUser,sameOrigin}){
 const available=new Set(TYPES.map(x=>x.id));
 async function read(userId){
  const result=await store.dbCall('db.select',{table:'LINE_Notification_Preferences',where:{user_id:userId},limit:100});
  if(result.limited)throw Error('PREFERENCE_LIMIT');
  const rows=result.rows||[];
  return TYPES.map(type=>({...type,enabled:(rows.find(x=>x.notification_type===type.id)?.enabled??'false')==='true',configured:rows.some(x=>x.notification_type===type.id)}));
 }
 app.get('/api/line/notification-preferences',requireUser,async(req,res)=>{
  res.set('Cache-Control','no-store');
  try{return res.json({success:true,types:await read(req.projectUser.user_id),delivery_active:false,message:'目前只儲存通知偏好，事件派送尚未啟用'});}
  catch(e){console.warn('LINE preferences read failed',e.message);return res.status(503).json({success:false,code:'PREFERENCES_UNAVAILABLE',message:'LINE 通知設定暫時無法讀取'});}
 });
 app.put('/api/line/notification-preferences',requireUser,async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!sameOrigin(req))return res.status(403).json({success:false,code:'INVALID_ORIGIN'});
  const type=req.body?.notification_type,enabled=req.body?.enabled;
  if(!available.has(type)||typeof enabled!=='boolean')return res.status(400).json({success:false,code:'INVALID_PREFERENCE',message:'通知類型或開關值不正確'});
  const userId=req.projectUser.user_id,now=new Date().toISOString();
  try{
   const rows=await store.dbCall('db.select',{table:'LINE_Notification_Preferences',where:{user_id:userId,notification_type:type},limit:2});
   if(rows.limited||(rows.rows||[]).length>1)throw Error('DUPLICATE_PREFERENCE');
   if(rows.rows?.length){
    const existing=rows.rows[0];
    const updated=await store.dbCall('db.update',{table:'LINE_Notification_Preferences',where:{preference_id:existing.preference_id,user_id:userId,notification_type:type},data:{enabled:String(enabled),updated_at:now}});
    if(updated.count!==1)throw Error('UPDATE_UNCONFIRMED');
   }else{
    const inserted=await store.dbCall('db.insert',{table:'LINE_Notification_Preferences',primary_key:'preference_id',data:{preference_id:randomUUID(),user_id:userId,notification_type:type,enabled:String(enabled),updated_at:now}});
    if(!inserted.inserted)throw Error('INSERT_UNCONFIRMED');
   }
   return res.json({success:true,notification_type:type,enabled,delivery_active:false});
  }catch(e){console.warn('LINE preference save failed',e.message);return res.status(503).json({success:false,code:'PREFERENCE_SAVE_UNCONFIRMED',message:'無法確認通知設定已儲存，請重新載入檢查'});}
 });
};
