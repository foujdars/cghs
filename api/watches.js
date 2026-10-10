import {authorized,send,allow,cors,body,uuid} from '../lib/security.mjs';import {db,rpc} from '../lib/database.mjs';import {validateWatch} from '../lib/validation.mjs';
export default async function handler(req,res){if(!cors(req,res))return;if(!allow(req,res,['GET','POST','PATCH']))return;if(!authorized(req,process.env.ADMIN_TOKEN))return send(res,401,{error:'unauthorized'});try{
 if(req.method==='GET')return send(res,200,{watches:await db('slotcare_watches?select=*&order=created_at.desc&limit=50')});
 const b=body(req);if(req.method==='POST'){let data;try{data=validateWatch(b);}catch(e){return send(res,400,{error:e.message});}const created=await db('slotcare_watches',{method:'POST',data});await rpc('slotcare_enqueue_due');return send(res,201,{watch:created[0]});}
 if(!uuid(b.id)||typeof b.enabled!=='boolean')return send(res,400,{error:'invalid_update'});const row=await db('slotcare_watches?id=eq.'+b.id,{method:'PATCH',data:{enabled:b.enabled,status:b.enabled?'waiting':'paused',next_check:new Date().toISOString()}});return send(res,200,{watch:row[0]});
 }catch{return send(res,503,{error:'automation_not_ready'});}}
