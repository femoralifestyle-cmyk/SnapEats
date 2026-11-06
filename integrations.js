import { supabase } from './supabase';

// Call from the authenticated customer checkout after creating an order.
export async function startRazorpayCheckout(orderId, customer) {
  const {data,error}=await supabase.functions.invoke('create-payment-order',{body:{order_id:orderId}});
  if(error||data?.error)throw new Error(data?.error||error?.message||'Could not start payment');
  if(!window.Razorpay)throw new Error('Load https://checkout.razorpay.com/v1/checkout.js before using online payments');
  return new Promise((resolve,reject)=>{
    const checkout=new window.Razorpay({key:data.key_id,order_id:data.razorpay_order_id,amount:data.amount,currency:data.currency,name:'SnapEats',description:`Order ${orderId}`,prefill:{name:customer?.name||'',contact:customer?.phone||'',email:customer?.email||''},theme:{color:'#21483e'},handler:async response=>{
      const verified=await supabase.functions.invoke('verify-payment',{body:{order_id:orderId,razorpay_order_id:response.razorpay_order_id,razorpay_payment_id:response.razorpay_payment_id,razorpay_signature:response.razorpay_signature}});
      if(verified.error||verified.data?.error)reject(new Error(verified.data?.error||verified.error?.message||'Payment verification failed'));else resolve(verified.data);
    },modal:{ondismiss:()=>reject(new Error('Payment window closed'))}});
    checkout.open();
  });
}

export function subscribeToDelivery(orderId,onLocation){
  const channel=supabase.channel(`delivery-${orderId}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'delivery_locations',filter:`order_id=eq.${orderId}`},payload=>onLocation(payload.new)).subscribe();
  return ()=>supabase.removeChannel(channel);
}


export async function validateCoupon(code,subtotal){
  const {data,error}=await supabase.from('coupons').select('*').eq('code',String(code).trim().toUpperCase()).eq('is_active',true).maybeSingle();
  if(error)throw error;if(!data)throw new Error('Coupon not found');
  const now=Date.now();if(data.starts_at&&new Date(data.starts_at).getTime()>now)throw new Error('Coupon is not active yet');
  if(data.expires_at&&new Date(data.expires_at).getTime()<now)throw new Error('Coupon has expired');
  if(data.usage_limit&&data.used_count>=data.usage_limit)throw new Error('Coupon usage limit reached');
  if(Number(subtotal)<Number(data.min_order))throw new Error(`Minimum order for this coupon is ₹${data.min_order}`);
  const discount=data.discount_type==='percent'?Math.min(Number(data.max_discount)||Infinity,Number(subtotal)*Number(data.discount_value)/100):Number(data.discount_value);
  return {coupon:data,discount:Math.min(Number(subtotal),discount)};
}

export async function submitProductReview({product_id,order_id,rating,review}){
  const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Sign in to review');
  const {error}=await supabase.from('product_reviews').insert({product_id,order_id,rating,review,customer_id:user.id});if(error)throw error;
}

export async function getOrCreateReferralCode(){
  const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Sign in required');
  const existing=await supabase.from('referral_codes').select('code').eq('customer_id',user.id).maybeSingle();if(existing.data)return existing.data.code;
  const created=await supabase.from('referral_codes').insert({customer_id:user.id}).select('code').single();if(created.error)throw created.error;return created.data.code;
}
