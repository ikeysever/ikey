'use strict';
const {createHash}=require('node:crypto');
const TOKEN=/^[A-Za-z0-9_-]{32}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function createInvitationRedemptionHandler(store){
 return async(req,res)=>{
  res.set('Cache-Control','no-store');
  const actor=String(req.projectUser?.user_id||''),token=req.body?.invitation_token;
  if(!UUID.test(actor)||typeof token!=='string'||!TOKEN.test(token))
   return res.status(400).json({success:false,code:'INVALID_INVITATION_TOKEN'});
  const tokenHash=createHash('sha256').update(token).digest('hex');
  try{
   // This is a script-lock protected, resumable GAS operation (not a cross-sheet ACID transaction). Never simulate with db.select + db.update.
   const result=await store.projectCall('project.invitation.redeem',{actor_user_id:actor,token_hash:tokenHash});
   if(result?.redeemed!==true||!UUID.test(String(result.project_id||''))||!UUID.test(String(result.membership_id||''))||result.role!=='member')
    return res.status(503).json({success:false,code:'INVITATION_REDEMPTION_UNVERIFIED'});
   return res.json({success:true,project_id:result.project_id,membership_id:result.membership_id,role:'member'});
  }catch(error){console.warn('Invitation redemption unavailable',error.name||'Error');return res.status(503).json({success:false,code:'INVITATION_REDEMPTION_UNAVAILABLE'});}
 };
}
module.exports={createInvitationRedemptionHandler};
