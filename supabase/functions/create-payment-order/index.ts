import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as b64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
const cors={ 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS' };
serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  const auth=req.headers.get('Authorization')||'';const userClient=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:ue}=await userClient.auth.getUser();if(ue||!user)throw new Error('Sign in required');
  const {order_id}=await req.json();const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {data:order,error}=await admin.from('orders').select('id,total,customer_id,status').eq('id',order_id).single();if(error||!order)throw new Error('Order not found');
  if(order.customer_id!==user.id)throw new Error('You cannot pay for this order');if(order.status==='cancelled')throw new Error('Cancelled order cannot be paid');
  const amount=Math.round(Number(order.total)*100);if(amount<100)throw new Error('Invalid payment amount');
  const key=Deno.env.get('RAZORPAY_KEY_ID')!,secret=Deno.env.get('RAZORPAY_KEY_SECRET')!;
  const basic=btoa(`${key}:${secret}`);const rp=await fetch('https://api.razorpay.com/v1/orders',{method:'POST',headers:{Authorization:`Basic ${basic}`,'Content-Type':'application/json'},body:JSON.stringify({amount,currency:'INR',receipt:order.id,notes:{snapeats_order_id:order.id}})});
  const body=await rp.json();if(!rp.ok)throw new Error(body.error?.description||'Razorpay order creation failed');
  await admin.from('payment_transactions').insert({order_id:order.id,provider_order_id:body.id,amount_paise:amount,status:'created'});
  return new Response(JSON.stringify({key_id:key,razorpay_order_id:body.id,amount:body.amount,currency:body.currency}),{headers:{...cors,'Content-Type':'application/json'}});
 }catch(e){return new Response(JSON.stringify({error:e.message}),{status:400,headers:{...cors,'Content-Type':'application/json'}})}
});
