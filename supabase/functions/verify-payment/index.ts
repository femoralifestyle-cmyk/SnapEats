import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  const auth=req.headers.get('Authorization')||'';const userClient=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});
  const {data:{user}}=await userClient.auth.getUser();if(!user)throw new Error('Sign in required');
  const {order_id,razorpay_order_id,razorpay_payment_id,razorpay_signature}=await req.json();
  const secret=Deno.env.get('RAZORPAY_KEY_SECRET')!;const msg=`${razorpay_order_id}|${razorpay_payment_id}`;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(msg)));const hex=[...digest].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(hex!==razorpay_signature)throw new Error('Payment signature verification failed');
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {data:order}=await admin.from('orders').select('id,customer_id').eq('id',order_id).single();if(!order||order.customer_id!==user.id)throw new Error('Order ownership check failed');
  const {error}=await admin.from('payment_transactions').update({provider_payment_id:razorpay_payment_id,status:'captured'}).eq('provider_order_id',razorpay_order_id).eq('order_id',order_id);if(error)throw error;
  await admin.from('orders').update({payment_status:'paid',payment_method:'razorpay'}).eq('id',order_id);
  return new Response(JSON.stringify({verified:true}),{headers:{...cors,'Content-Type':'application/json'}});
 }catch(e){return new Response(JSON.stringify({error:e.message}),{status:400,headers:{...cors,'Content-Type':'application/json'}})}
});
