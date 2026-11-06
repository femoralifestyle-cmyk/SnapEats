import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  supabase, configured
} from "../supabase";
import {
  ShoppingBag, LayoutDashboard, Utensils, Image as ImageIcon, Users,
  ClipboardList, LogOut, Plus, Minus, Trash2, RefreshCw, Search,
  ChefHat, Waves, CheckCircle2, Clock3, X, Menu, Upload, ShieldCheck, Pencil, Award, Gift, PackageCheck, UserPlus
} from "lucide-react";
import "./style.css";
import AdvancedAdmin from "../AdvancedAdmin";

const money = (n) => `₹${Number(n || 0).toFixed(2)}`;
const statusList = ["pending", "preparing", "ready", "completed", "cancelled"];

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState("menu");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [brandLogo, setBrandLogo] = useState("");

  useEffect(() => {
    if (!configured) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) setProfile(null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) { setProfile(null); return; }
    supabase.from("profiles").select("*").eq("id", session.user.id).single()
      .then(({ data, error: e }) => {
        if (e) setError(e.message);
        else if (!data?.is_active) {
          setError("This account is disabled. Please contact the café administrator.");
          supabase.auth.signOut();
        } else setProfile(data);
      });
  }, [session]);

  useEffect(() => {
    if (profile?.role === "customer" && view === "login") setView("account");
    if (profile?.role === "customer" && view === "signup") setView("account");
  }, [profile, view]);

  useEffect(() => {
    if (!configured) return;
    supabase.from("site_settings").select("value").eq("key","brand").maybeSingle().then(({data}) => setBrandLogo(data?.value?.logo_url || ""));
  }, []);

  useEffect(() => {
    if (notice) { const t = setTimeout(() => setNotice(""), 3500); return () => clearTimeout(t); }
  }, [notice]);

  if (!configured) return <SetupScreen />;
  if (loading || (session && !profile && !error)) return <div className="center-screen"><div className="spinner"/>Loading SnapEats…</div>;

  const isAdmin = profile?.role === "super_admin";
  const isStaff = profile?.role === "staff";
  const isCustomer = profile?.role === "customer";
  const logout = async () => { await supabase.auth.signOut(); setView("menu"); setError(""); };

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={e => {e.preventDefault(); setView("menu");}}>
        <span className="brand-mark">{brandLogo ? <img src={brandLogo} alt="SnapEats" style={{width:"100%",height:"100%",objectFit:"contain",borderRadius:12}}/> : <Waves size={22}/>}</span>
        <span><b>SnapEats</b><small>UNNIYAL BEACH</small></span>
      </a>
      <div className="top-actions">
        <span className="location-pill">☀ Beachside café</span>
        {profile ? <>
          <span className="user-pill">{profile.full_name || session.user.email} · {isAdmin ? "Admin" : isStaff ? "Staff" : "Customer"}</span>
          {isCustomer && <button className="btn btn-outline btn-small" onClick={() => setView("account")}>My account</button>}
          <button className="icon-btn" onClick={logout} title="Log out"><LogOut size={18}/></button>
        </> : <>
          <button className="btn btn-outline btn-small" onClick={() => setView("login")}>Customer / Staff login</button>
          <button className="btn btn-dark btn-small" onClick={() => setView("signup")}>Create account</button>
        </>}
      </div>
    </header>

    {notice && <div className="toast"><CheckCircle2 size={17}/>{notice}</div>}
    {error && <div className="alert"><span>{error}</span><button onClick={() => setError("")}><X size={16}/></button></div>}

    {(!profile || isCustomer) && view !== "login" && view !== "signup" && view !== "account" && <PublicMenu profile={isCustomer ? profile : null} onLogin={() => setView("login")} onAccount={() => setView("account")} setNotice={setNotice}/>}
    {!profile && view === "login" && <Login onBack={() => setView("menu")} onSignup={() => setView("signup")} setError={setError}/>}
    {!profile && view === "signup" && <CustomerSignup onBack={() => setView("menu")} onLogin={() => setView("login")} setError={setError} setNotice={setNotice}/>}
    {isCustomer && view === "account" && <CustomerPortal profile={profile} setNotice={setNotice} setError={setError} onMenu={() => setView("menu")}/>}
    {isStaff && <StaffPortal profile={profile} setNotice={setNotice} setError={setError}/>}
    {isAdmin && <AdminPortal profile={profile} setNotice={setNotice} setError={setError}/>}
    <footer className="footer">© {new Date().getFullYear()} SnapEats · Unniyal Beach</footer>
  </div>;
}

function SetupScreen() {
  return <div className="setup-wrap"><div className="setup-card">
    <div className="brand-mark large"><Waves size={30}/></div><p className="eyebrow">UNNIYAL BEACH</p>
    <h1>Connect your SnapEats workspace</h1>
    <p>Add your Supabase project URL and public anon key to a <code>.env</code> file, then restart the app.</p>
    <pre>VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co{"\n"}VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY</pre>
    <p className="muted">Setup instructions are included in README.md. Do not put your Supabase service-role key in this frontend.</p>
  </div></div>;
}

function Login({ onBack, onSignup, setError }) {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [busy,setBusy]=useState(false);
  const submit=async e=>{e.preventDefault();setBusy(true);setError("");const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setError(error.message);setBusy(false);};
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}>
    <div className="brand-mark large"><ShieldCheck size={28}/></div><p className="eyebrow">SECURE ACCESS</p><h1>Portal login</h1>
    <p className="muted">Sign in with your individual staff or administrator account.</p>
    <label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
    <label>Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password"/></label>
    <button className="btn btn-dark full" disabled={busy}>{busy?"Signing in…":"Sign in securely"}</button>
    <button type="button" className="text-btn" onClick={onSignup}>Create a customer account</button>
    <button type="button" className="text-btn" onClick={onBack}>← Back to menu</button>
  </form></main>;
}

function CustomerSignup({onBack,onLogin,setError,setNotice}) {
  const [name,setName]=useState(""); const [phone,setPhone]=useState("");
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [busy,setBusy]=useState(false);
  const submit=async e=>{
    e.preventDefault();setBusy(true);setError("");
    const {error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name.trim(),phone:phone.trim(),account_type:"customer"}}});
    if(error)setError(error.message);
    else setNotice("Account created. Check your email if confirmation is enabled, then sign in.");
    setBusy(false);
  };
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}>
    <div className="brand-mark large"><UserPlus size={28}/></div><p className="eyebrow">JOIN SNAP EATS</p><h1>Create account</h1>
    <p className="muted">Only your name, mobile number, email and password are required.</p>
    <label>Full name<input required maxLength="80" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>
    <label>Mobile number<input required type="tel" minLength="8" maxLength="15" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Mobile number"/></label>
    <label>Email address<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
    <label>Password<input required type="password" minLength="8" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></label>
    <button className="btn btn-dark full" disabled={busy}>{busy?"Creating account…":"Create account"}</button>
    <button type="button" className="text-btn" onClick={onLogin}>Already registered? Sign in</button>
    <button type="button" className="text-btn" onClick={onBack}>← Back to menu</button>
  </form></main>;
}

function useCatalog(includeInactive = false) {
  const [products,setProducts]=useState([]); const [categories,setCategories]=useState([]); const [banners,setBanners]=useState([]);
  const [busy,setBusy]=useState(true);
  const load=async()=>{
    setBusy(true);
    const [p,c,b]=await Promise.all([
      supabase.from("products").select("*, categories(name)").order("created_at",{ascending:false}),
      supabase.from("categories").select("*").order("sort_order"),
      includeInactive ? supabase.from("banners").select("*").order("sort_order") : supabase.from("banners").select("*").eq("is_active",true).order("sort_order")
    ]);
    setProducts(p.data||[]);setCategories(c.data||[]);setBanners(b.data||[]);setBusy(false);
  };
  useEffect(()=>{load();},[]);
  return {products,categories,banners,busy,load};
}

function PublicMenu({ profile, onLogin, onAccount, setNotice }) {
  const {products,categories,banners,busy}=useCatalog();
  const [category,setCategory]=useState("All"); const [cart,setCart]=useState({});
  const [customer,setCustomer]=useState(profile?.full_name||""); const [phone,setPhone]=useState(profile?.phone||""); const [orderType,setOrderType]=useState("takeaway");
  const [notes,setNotes]=useState(""); const [submitting,setSubmitting]=useState(false);
  const visible=products.filter(p=>p.is_available && (category==="All" || p.category_id===category));
  const items=products.filter(p=>cart[p.id]).map(p=>({...p,qty:cart[p.id]}));
  const total=items.reduce((s,p)=>s+Number(p.price)*p.qty,0);
  const add=(id)=>setCart(v=>({...v,[id]:(v[id]||0)+1}));
  const change=(id,n)=>setCart(v=>{const x={...v};if(n<=0)delete x[id];else x[id]=n;return x;});
  const place=async e=>{
    e.preventDefault(); if(!items.length)return;
    if(!profile){setNotice("Please create an account or sign in before placing an order.");onLogin();return;}
    if(orderType==="on_site_delivery" && total<150){setNotice("On-Site Delivery requires a minimum order value of ₹150. Please add more items.");return;}
    setSubmitting(true);
    const payload={customer_name:customer,customer_phone:phone,order_type:orderType,notes,items:items.map(i=>({product_id:i.id,quantity:i.qty}))};
    const {data,error}=await supabase.rpc("place_order",{order_data:payload});
    if(error){setNotice("Order could not be placed: "+error.message);}
    else {setCart({});setCustomer("");setPhone("");setNotes("");setNotice(`Order ${data?.order_number || ""} placed successfully. Thank you!`);}
    setSubmitting(false);
  };
  return <main>
    <section className="hero">
      {banners[0]?.image_url && <img className="hero-image" src={banners[0].image_url} alt="SnapEats café banner"/>}
      <div className="hero-content"><p className="eyebrow light">A LITTLE TASTE OF THE COAST</p><h1>{banners[0]?.title || "Good food. Great beach days."}</h1>
        <p>{banners[0]?.subtitle || "Freshly prepared favourites, served by the shore at Unniyal Beach."}</p>
        <a className="btn btn-cream" href="#menu">Explore menu <span>↓</span></a>
      </div><div className="hero-tag">MOMENTS BY THE SEA</div>
    </section>
    <section className="section" id="menu">
      <div className="section-head"><div><p className="eyebrow">MADE FRESH FOR YOU</p><h2>Our menu</h2><p className="muted">Choose your favourites and place an order.</p></div><div className="menu-tools"><span className="menu-count">{visible.length} items</span><button className="btn btn-outline btn-small" onClick={()=>document.getElementById("order-cart")?.scrollIntoView({behavior:"smooth"})}><ShoppingBag size={15}/> Cart ({items.reduce((n,i)=>n+i.qty,0)})</button></div></div>
      {profile && <div className="rewards-strip"><Award size={22}/><div><b>Your SnapRewards</b><small>Earn points and stamps on completed orders of ₹350 or more.</small></div><button className="text-btn" onClick={onAccount}>View rewards</button></div>}
      <div className="chips"><button className={category==="All"?"chip active":"chip"} onClick={()=>setCategory("All")}>All</button>{categories.map(c=><button key={c.id} className={category===c.id?"chip active":"chip"} onClick={()=>setCategory(c.id)}>{c.name}</button>)}</div>
      {busy?<div className="empty">Loading menu…</div>:visible.length===0?<div className="empty">No products available right now. Please check back soon.</div>:
      <div className="product-grid">{visible.map(p=><article className="product-card" key={p.id}>
        <div className="product-photo">{p.image_url?<img src={p.image_url} alt={p.name}/>:<div className="photo-placeholder"><Utensils size={32}/></div>}
          <span className={`food-tag ${p.is_vegetarian?"veg":"nonveg"}`}>{p.is_vegetarian?"VEG":"NON-VEG"}</span></div>
        <div className="product-info"><div><h3>{p.name}</h3><p>{p.description||"Freshly prepared at SnapEats."}</p></div>
          <div className="product-bottom"><b>{money(p.price)}</b><button className="add-btn" onClick={()=>add(p.id)}><Plus size={15}/> Add</button></div></div>
      </article>)}</div>}
    </section>
    <section className="order-section" id="order-cart"><form className="order-card" onSubmit={place}>
      <div className="order-title"><div><p className="eyebrow">YOUR SELECTION</p><h2>Your order</h2></div><ShoppingBag size={23}/></div>
      {items.length===0?<p className="muted">Your basket is empty. Add something delicious from the menu.</p>:items.map(i=><div className="cart-row" key={i.id}><div><b>{i.name}</b><small>{money(i.price)} each</small></div><div className="qty"><button type="button" onClick={()=>change(i.id,i.qty-1)}><Minus size={14}/></button><b>{i.qty}</b><button type="button" onClick={()=>change(i.id,i.qty+1)}><Plus size={14}/></button></div><strong>{money(i.price*i.qty)}</strong></div>)}
      <div className="total-row"><span>Total</span><strong>{money(total)}</strong></div>
      {profile ? <p className="muted">Ordering as <b>{profile.full_name}</b> · {profile.phone}</p> : <p className="muted">Sign in or create a free account to place an order and collect rewards.</p>}
      <label>Order type<select value={orderType} onChange={e=>setOrderType(e.target.value)}><option value="takeaway">Takeaway</option><option value="dine_in">Dine-in</option><option value="on_site_delivery">On-Site Delivery</option></select></label>
      {orderType==="on_site_delivery"&&<p className={`tiny ${total<150?"delivery-min-warning":"muted"}`}>On-Site Delivery minimum order: ₹150. {total<150?`Add ${money(150-total)} more to continue.`:"Minimum order reached."}</p>}
      <label>Special instructions<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any preferences? (optional)"/></label>
      <button className="btn btn-dark full" disabled={!items.length||submitting||(orderType==="on_site_delivery"&&total<150)}>{submitting?"Placing order…":profile?`Place order · ${money(total)}`:"Sign in to place order"}</button>
      <p className="tiny muted">Earn 1 reward point and 1 stamp on each completed order of ₹350 or more. 10 stamps (10 points) unlock a free Momos portion.</p>
    </form></section>
    <div className="staff-entry"><span>Already a member?</span><button className="text-btn" onClick={onLogin}>Sign in / Staff login →</button></div>
  </main>;
}

function CustomerPortal({profile,setNotice,setError,onMenu}) {
  const [orders,setOrders]=useState([]); const [rewards,setRewards]=useState({points:0,stamps:0,free_momos:0}); const [busy,setBusy]=useState(true);
  const load=async()=>{
    setBusy(true);
    const [o,r]=await Promise.all([
      supabase.from("orders").select("*, order_items(*)").eq("customer_id",profile.id).order("created_at",{ascending:false}).limit(100),
      supabase.from("customer_rewards").select("points,stamps,free_momos").eq("customer_id",profile.id).maybeSingle()
    ]);
    if(o.error)setError(o.error.message);else setOrders(o.data||[]);
    if(r.error)setError(r.error.message);else setRewards(r.data||{points:0,stamps:0,free_momos:0});
    setBusy(false);
  };
  useEffect(()=>{load();const ch=supabase.channel(`customer-orders-${profile.id}`).on("postgres_changes",{event:"*",schema:"public",table:"orders",filter:`customer_id=eq.${profile.id}`},load).subscribe();return()=>supabase.removeChannel(ch);},[profile.id]);
  const redeem=async()=>{
    const {data,error}=await supabase.rpc("redeem_free_momos");
    if(error)setError(error.message);else{setNotice(`Free Momos reward reserved! Code: ${data?.code||"Ask staff to verify your account."}`);load();}
  };
  const progress=Math.min(100,(Number(rewards.stamps||0)%10)*10);
  return <main className="portal customer-portal" id="customer-account">
    <div className="portal-heading"><div><p className="eyebrow">SNAPEATS REWARDS</p><h1>Hello, {profile.full_name||"there"}!</h1><p className="muted">Your orders, points and loyalty rewards.</p></div><button className="btn btn-outline" onClick={onMenu}>Browse menu</button></div>
    <div className="stats-grid"><Stat label="Reward points" value={rewards.points||0}/><Stat label="Stamps collected" value={`${(rewards.stamps||0)%10}/10`}/><Stat label="Free Momos available" value={rewards.free_momos||0}/><Stat label="Total orders" value={orders.length}/></div>
    <section className="panel stamp-panel"><div className="panel-head"><div><h2>Your stamp card</h2><p className="muted">Earn 10 qualifying stamps (10 points) to unlock one free Momos portion.</p></div><Gift size={25}/></div>
      <div className="stamp-track">{Array.from({length:10},(_,i)=><span key={i} className={i<((rewards.stamps||0)%10)?"stamp filled":"stamp"}>{i<((rewards.stamps||0)%10)?"✓":i+1}</span>)}</div>
      <div className="progress-line"><span style={{width:`${progress}%`}}/></div>
      {Number(rewards.free_momos||0)>0&&<button className="btn btn-dark" onClick={redeem}>Redeem free Momos portion ({rewards.free_momos})</button>}
      <p className="tiny muted">Earn 1 point and 1 stamp together for each completed order of ₹350 or more. Orders below ₹350 earn neither. 10 stamps (10 points) unlock one free Momos portion.</p>
    </section>
    <section className="panel" style={{marginTop:18}}><div className="panel-head"><h2>Your orders</h2><button className="btn btn-outline btn-small" onClick={load}><RefreshCw size={15}/> Refresh</button></div>
      {busy?<div className="empty">Loading your orders…</div>:!orders.length?<div className="empty">No orders yet. A completed order of ₹350 or more earns 1 point and 1 stamp!</div>:<div className="customer-orders">{orders.map(o=><article className="customer-order" key={o.id}><div><b>Order #{o.order_number}</b><small>{new Date(o.created_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})} · {o.order_type?.replaceAll("_"," ")}</small><small>{(o.order_items||[]).map(i=>`${i.product_name} × ${i.quantity}`).join(", ")}</small></div><div className="customer-order-right"><b>{money(o.total)}</b><span className={`order-status ${o.status}`}>{o.status}</span></div></article>)}</div>}
    </section>
  </main>;
}

function StaffPortal({profile,setNotice,setError}) {
  const [tab,setTab]=useState("orders"); const [orders,setOrders]=useState([]); const [products,setProducts]=useState([]);
  const [cart,setCart]=useState({}); const [customer,setCustomer]=useState(""); const [phone,setPhone]=useState(""); const [kind,setKind]=useState("takeaway");
  const [filter,setFilter]=useState("all"); const [search,setSearch]=useState("");
  const load=async()=>{
    const [o,p]=await Promise.all([
      supabase.from("orders").select("*, order_items(*, products(name))").order("created_at",{ascending:false}).limit(150),
      supabase.from("products").select("*").eq("is_available",true).order("name")
    ]);
    if(o.error)setError(o.error.message);else setOrders(o.data||[]);
    setProducts(p.data||[]);
  };
  useEffect(()=>{load();const ch=supabase.channel("staff-orders").on("postgres_changes",{event:"*",schema:"public",table:"orders"},load).subscribe();return()=>supabase.removeChannel(ch);},[]);
  const add=id=>setCart(v=>({...v,[id]:(v[id]||0)+1}));
  const rows=products.filter(p=>cart[p.id]).map(p=>({...p,qty:cart[p.id]}));
  const total=rows.reduce((s,p)=>s+Number(p.price)*p.qty,0);
  const create=async e=>{
    e.preventDefault();if(!rows.length)return;
    const {data,error}=await supabase.rpc("place_order",{order_data:{customer_name:customer||"Walk-in customer",customer_phone:phone,order_type:kind,items:rows.map(x=>({product_id:x.id,quantity:x.qty}))}});
    if(error)setError(error.message);else{setNotice(`Order ${data?.order_number||""} created.`);setCart({});setCustomer("");setPhone("");setTab("orders");load();}
  };
  const update=async(id,status)=>{const {error}=await supabase.from("orders").update({status}).eq("id",id);if(error)setError(error.message);else setNotice("Order updated.");load();};
  const shown=orders.filter(o=>(filter==="all"||o.status===filter)&&(`${o.order_number} ${o.customer_name} ${o.customer_phone}`.toLowerCase().includes(search.toLowerCase())));
  return <PortalLayout title="Staff workspace" subtitle={`Welcome, ${profile.full_name||"team member"}`} tabs={[
    ["orders","Orders",ClipboardList],["new","New order",Plus],["rewards","Reward claims",Gift]
  ]} tab={tab} setTab={setTab}>
    {tab==="rewards"?<RewardDesk setError={setError} setNotice={setNotice}/>:tab==="orders"?<><div className="toolbar"><div className="searchbox"><Search size={17}/><input placeholder="Search order or customer…" value={search} onChange={e=>setSearch(e.target.value)}/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All statuses</option>{statusList.map(s=><option key={s} value={s}>{s}</option>)}</select><button className="btn btn-outline btn-small" onClick={load}><RefreshCw size={15}/> Refresh</button></div>
      <OrdersTable orders={shown} onStatus={update}/></>:<div className="pos-grid"><div className="panel"><div className="panel-head"><h2>Available products</h2><span className="muted">{products.length} items</span></div><div className="pos-products">{products.map(p=><button className="pos-product" key={p.id} onClick={()=>add(p.id)}><span>{p.name}</span><b>{money(p.price)}</b><Plus size={15}/></button>)}</div></div>
      <form className="panel pos-cart" onSubmit={create}><h2>New order</h2><label>Customer name<input value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="Walk-in customer"/></label><label>Phone<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Optional"/></label><label>Order type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="takeaway">Takeaway</option><option value="dine_in">Dine-in</option><option value="on_site_delivery">On-Site Delivery</option></select></label>
      <div className="pos-cart-items">{rows.map(r=><div className="cart-row" key={r.id}><div><b>{r.name}</b><small>{money(r.price)}</small></div><div className="qty"><button type="button" onClick={()=>setCart(v=>({...v,[r.id]:Math.max(0,(v[r.id]||0)-1)}))}><Minus size={13}/></button><b>{r.qty}</b><button type="button" onClick={()=>add(r.id)}><Plus size={13}/></button></div></div>)}</div>
      <div className="total-row"><span>Total</span><strong>{money(total)}</strong></div><button className="btn btn-dark full" disabled={!rows.length}>Create order</button></form></div>}
  </PortalLayout>;
}

function RewardDesk({setError,setNotice}) {
  const [claims,setClaims]=useState([]); const [busy,setBusy]=useState(false);
  const load=async()=>{
    const {data,error}=await supabase.from("reward_redemptions").select("*").order("created_at",{ascending:false}).limit(100);
    if(error)setError(error.message);else setClaims(data||[]);
  };
  useEffect(()=>{load();},[]);
  const complete=async id=>{
    setBusy(true);
    const {error}=await supabase.rpc("mark_reward_redeemed",{redemption_id:id});
    if(error)setError(error.message);else{setNotice("Reward marked as redeemed.");load();}
    setBusy(false);
  };
  return <div className="panel"><div className="panel-head"><div><h2>Free Momos reward claims</h2><p className="muted">Match the customer's redemption code and mark the portion as handed over.</p></div><button className="btn btn-outline btn-small" onClick={load}><RefreshCw size={15}/> Refresh</button></div>
    {!claims.length?<div className="empty">No reward claims yet.</div>:<div className="table-wrap"><table><thead><tr><th>Redemption code</th><th>Customer ID</th><th>Created</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {claims.map(c=><tr key={c.id}><td><b>{c.redemption_code}</b><small>{c.reward_name}</small></td><td><small>{c.customer_id}</small></td><td>{new Date(c.created_at).toLocaleString("en-IN",{dateStyle:"short",timeStyle:"short"})}</td><td><span className={`order-status ${c.status}`}>{c.status}</span></td><td>{c.status==="reserved"&&<button className="btn btn-dark btn-small" disabled={busy} onClick={()=>complete(c.id)}>Mark redeemed</button>}</td></tr>)}
    </tbody></table></div>}
  </div>;
}

function AdminPortal({profile,setNotice,setError}) {
  const [tab,setTab]=useState("overview"); const {products,categories,banners,load}=useCatalog(true); const [orders,setOrders]=useState([]);
  const [staff,setStaff]=useState([]); const [busy,setBusy]=useState(false);
  const reload=async()=>{
    const [o,s]=await Promise.all([
      supabase.from("orders").select("*, order_items(*, products(name))").order("created_at",{ascending:false}).limit(300),
      supabase.from("profiles").select("*").order("created_at",{ascending:false})
    ]);
    if(o.error)setError(o.error.message);else setOrders(o.data||[]);
    if(s.error)setError(s.error.message);else setStaff(s.data||[]);
  };
  useEffect(()=>{reload();const ch=supabase.channel("admin-orders").on("postgres_changes",{event:"*",schema:"public",table:"orders"},reload).subscribe();return()=>supabase.removeChannel(ch);},[]);
  const refresh=()=>{load();reload();};
  const saveProduct=async(e,form,id)=>{
    e.preventDefault();setBusy(true);
    const payload={name:form.name,description:form.description,price:Number(form.price),category_id:form.category_id||null,is_vegetarian:form.is_vegetarian,is_available:form.is_available,image_url:form.image_url||null};
    const result=id?await supabase.from("products").update(payload).eq("id",id):await supabase.from("products").insert(payload);
    if(result.error){setError(result.error.message);setBusy(false);return false;}else{setNotice("Menu item saved successfully.");refresh();}
    setBusy(false);return true;
  };
  const removeProduct=async id=>{if(!confirm("Delete this product?"))return;const {error}=await supabase.from("products").delete().eq("id",id);if(error)setError(error.message);else{setNotice("Product deleted.");refresh();}};
  const saveBanner=async(e,form,id)=>{e.preventDefault();const result=id?await supabase.from("banners").update(form).eq("id",id):await supabase.from("banners").insert(form);if(result.error)setError(result.error.message);else{setNotice("Banner saved.");refresh();}};
  const saveCategory=async(name)=>{if(!name.trim())return;const {error}=await supabase.from("categories").insert({name:name.trim()});if(error)setError(error.message);else{setNotice("Category added.");refresh();}};
  const staffAction=async(action,payload)=>{setBusy(true);const {data:{session}}=await supabase.auth.getSession();const {data,error}=await supabase.functions.invoke("manage-staff",{body:{action,...payload},headers:{Authorization:`Bearer ${session.access_token}`}});if(error)setError(error.message);else if(data?.error)setError(data.error);else{setNotice(data?.message||"Staff account updated.");reload();}setBusy(false);};
  const updateOrder=async(id,status)=>{const {error}=await supabase.from("orders").update({status}).eq("id",id);if(error)setError(error.message);else setNotice("Order updated.");reload();};
  const today=new Date().toDateString();const todayOrders=orders.filter(o=>new Date(o.created_at).toDateString()===today);
  const revenue=todayOrders.filter(o=>o.status!=="cancelled").reduce((s,o)=>s+Number(o.total),0);
  return <PortalLayout title="Super Admin" subtitle="Complete SnapEats management" tabs={[
    ["overview","Overview",LayoutDashboard],["products","Menu Items",Utensils],["categories","Categories",Menu],["banners","Banners",ImageIcon],["orders","All orders",ClipboardList],["staff","Staff accounts",Users],["advanced","Advanced features",ShieldCheck]
  ]} tab={tab} setTab={setTab}>
    {tab==="overview"&&<><div className="stats-grid"><Stat label="Today's orders" value={todayOrders.length}/><Stat label="Today's sales" value={money(revenue)}/><Stat label="Active products" value={products.filter(p=>p.is_available).length}/><Stat label="Staff accounts" value={staff.filter(s=>s.role==="staff").length}/></div>
      <div className="panel"><div className="panel-head"><h2>Recent orders</h2><button className="text-btn" onClick={()=>setTab("orders")}>View all →</button></div><OrdersTable orders={orders.slice(0,6)} onStatus={updateOrder}/></div></>}
    {tab==="products"&&<ProductsManager products={products} categories={categories} onSave={saveProduct} onDelete={removeProduct} busy={busy}/>}
    {tab==="categories"&&<CategoriesManager categories={categories} onAdd={saveCategory} setError={setError} setNotice={setNotice} refresh={refresh}/>}
    {tab==="banners"&&<BannersManager banners={banners} onSave={saveBanner} setNotice={setNotice}/>}
    {tab==="orders"&&<div className="panel"><div className="panel-head"><h2>All orders</h2><button className="btn btn-outline btn-small" onClick={reload}><RefreshCw size={15}/> Refresh</button></div><OrdersTable orders={orders} onStatus={updateOrder}/></div>}
    {tab==="staff"&&<StaffManager staff={staff} onAction={staffAction} busy={busy}/>}
    {tab==="advanced"&&<AdvancedAdmin setNotice={setNotice} setError={setError}/>}
  </PortalLayout>;
}

function PortalLayout({title,subtitle,tabs,tab,setTab,children}) {
  return <main className="portal"><div className="portal-heading"><div><p className="eyebrow">SNAPEATS MANAGEMENT</p><h1>{title}</h1><p className="muted">{subtitle}</p></div><span className="live-pill"><span/> Live workspace</span></div>
    <nav className="portal-tabs">{tabs.map(([id,label,Icon])=><button key={id} className={tab===id?"portal-tab active":"portal-tab"} onClick={()=>setTab(id)}><Icon size={17}/>{label}</button>)}</nav>
    <div className="portal-content">{children}</div>
  </main>;
}
function Stat({label,value}){return <div className="stat-card"><span>{label}</span><b>{value}</b></div>}

function OrdersTable({orders,onStatus}) {
  if(!orders.length)return <div className="empty">No orders found.</div>;
  return <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Time</th><th>Status</th></tr></thead><tbody>
    {orders.map(o=><tr key={o.id}><td><b>#{o.order_number}</b><small>{o.order_type?.replaceAll("_"," ")}</small></td><td>{o.customer_name}<small>{o.customer_phone||"No phone"}</small></td><td>{(o.order_items||[]).map(i=>`${i.products?.name||"Item"} × ${i.quantity}`).join(", ")}</td><td><b>{money(o.total)}</b></td><td>{new Date(o.created_at).toLocaleString("en-IN",{dateStyle:"short",timeStyle:"short"})}</td><td><select className={`status-select ${o.status}`} value={o.status} onChange={e=>onStatus(o.id,e.target.value)}>{statusList.map(s=><option key={s} value={s}>{s}</option>)}</select></td></tr>)}
  </tbody></table></div>;
}

function ProductsManager({products,categories,onSave,onDelete,busy}) {
  const blank={name:"",description:"",price:"",category_id:"",is_vegetarian:true,is_available:true,image_url:""};
  const [form,setForm]=useState(blank);const [edit,setEdit]=useState(null);
  const [uploading,setUploading]=useState(false);
  const start=p=>{setEdit(p.id);setForm({...p,price:String(p.price),category_id:p.category_id||"",image_url:p.image_url||""});window.scrollTo({top:0,behavior:"smooth"});};
  const upload=async file=>{
    if(!file)return;setUploading(true);
    const ext=file.name.split(".").pop();const path=`products/${crypto.randomUUID()}.${ext}`;
    const {error}=await supabase.storage.from("momosip-media").upload(path,file,{upsert:false});
    if(error)alert(error.message);else{const {data}=supabase.storage.from("momosip-media").getPublicUrl(path);setForm(v=>({...v,image_url:data.publicUrl}));}
    setUploading(false);
  };
  return <><div className="panel-head"><div><h2>Menu item management</h2><p className="muted">Add new dishes, edit prices and descriptions, upload photos, or mark items unavailable.</p></div><span className="muted">{products.length} menu items</span></div><div className="manager-grid"><form className="panel manager-form" onSubmit={async e=>{const saved=await onSave(e,form,edit);if(saved){setForm(blank);setEdit(null);}}}>
    <div className="panel-head"><h2>{edit?"Edit menu item":"Add menu item"}</h2>{edit&&<button type="button" className="text-btn" onClick={()=>{setForm(blank);setEdit(null);}}>Cancel</button>}</div>
    <label>Product name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
    <label>Description<textarea value={form.description||""} onChange={e=>setForm({...form,description:e.target.value})}/></label>
    <label>Price (₹)<input type="number" min="0" step="0.01" required value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label>
    <label>Category<select value={form.category_id||""} onChange={e=>setForm({...form,category_id:e.target.value})}><option value="">No category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Product image URL<input value={form.image_url||""} onChange={e=>setForm({...form,image_url:e.target.value})} placeholder="Paste image URL or upload below"/></label>
    <label className="upload-btn"><Upload size={16}/>{uploading?"Uploading…":"Upload product image"}<input type="file" accept="image/*" onChange={e=>upload(e.target.files?.[0])}/></label>
    <div className="check-row"><label><input type="checkbox" checked={!!form.is_vegetarian} onChange={e=>setForm({...form,is_vegetarian:e.target.checked})}/> Vegetarian</label><label><input type="checkbox" checked={!!form.is_available} onChange={e=>setForm({...form,is_available:e.target.checked})}/> Available</label></div>
    <button className="btn btn-dark full" disabled={busy||uploading}>{busy?"Saving…":edit?"Save menu item":"Add menu item"}</button>
  </form><div className="panel"><div className="panel-head"><h2>Current menu items</h2><span className="muted">{products.length} products</span></div>
    <div className="admin-product-list">{products.map(p=><div className="admin-product" key={p.id}>{p.image_url?<img src={p.image_url} alt=""/>:<div className="mini-placeholder"><Utensils/></div>}<div className="grow"><b>{p.name}</b><small>{p.categories?.name||"Uncategorised"} · {p.is_available?"Available":"Unavailable"}</small></div><strong>{money(p.price)}</strong><button className="icon-btn" onClick={()=>start(p)} title="Edit"><Pencil size={16}/></button><button className="icon-btn danger" onClick={()=>onDelete(p.id)} title="Delete"><Trash2 size={16}/></button></div>)}</div>
  </div></div></>;
}

function CategoriesManager({categories,onAdd,setError,setNotice,refresh}) {
  const [name,setName]=useState("");
  const remove=async id=>{if(!confirm("Delete category? Products in it will become uncategorised."))return;const {error}=await supabase.from("categories").delete().eq("id",id);if(error)setError(error.message);else{setNotice("Category deleted.");refresh();}};
  return <div className="panel narrow-panel"><h2>Menu categories</h2><form className="inline-form" onSubmit={e=>{e.preventDefault();onAdd(name);setName("");}}><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Momos, Drinks" required/><button className="btn btn-dark"><Plus size={16}/> Add</button></form>
    <div className="category-list">{categories.map(c=><div key={c.id}><span>{c.name}</span><button className="icon-btn danger" onClick={()=>remove(c.id)}><Trash2 size={16}/></button></div>)}</div>
  </div>;
}

function BannersManager({banners,onSave,setNotice}) {
  const [form,setForm]=useState({title:"",subtitle:"",image_url:"",is_active:true,sort_order:0});const [edit,setEdit]=useState(null);
  const upload=async file=>{if(!file)return;const ext=file.name.split(".").pop();const path=`banners/${crypto.randomUUID()}.${ext}`;const {error}=await supabase.storage.from("momosip-media").upload(path,file);if(error)alert(error.message);else{const {data}=supabase.storage.from("momosip-media").getPublicUrl(path);setForm(v=>({...v,image_url:data.publicUrl}));}};
  return <div className="manager-grid"><form className="panel manager-form" onSubmit={e=>{onSave(e,form,edit);setForm({title:"",subtitle:"",image_url:"",is_active:true,sort_order:0});setEdit(null);}}>
    <h2>{edit?"Edit banner":"Add homepage banner"}</h2><label>Headline<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
    <label>Subtitle<input value={form.subtitle} onChange={e=>setForm({...form,subtitle:e.target.value})}/></label>
    <label>Image URL<input value={form.image_url} onChange={e=>setForm({...form,image_url:e.target.value})}/></label>
    <label className="upload-btn"><Upload size={16}/> Upload banner image<input type="file" accept="image/*" onChange={e=>upload(e.target.files?.[0])}/></label>
    <label>Display order<input type="number" value={form.sort_order} onChange={e=>setForm({...form,sort_order:Number(e.target.value)})}/></label>
    <label className="check-row"><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Active</label>
    <button className="btn btn-dark full">Save banner</button>
  </form><div className="panel"><h2>Homepage banners</h2>{banners.map(b=><div className="banner-row" key={b.id}>{b.image_url&&<img src={b.image_url} alt=""/>}<div className="grow"><b>{b.title}</b><small>{b.subtitle}</small></div><button className="btn btn-outline btn-small" onClick={()=>{setEdit(b.id);setForm({...b});}}>Edit</button><button className="icon-btn danger" onClick={async()=>{if(confirm("Delete banner?")){await supabase.from("banners").delete().eq("id",b.id);setNotice("Banner deleted.");location.reload();}}}><Trash2 size={16}/></button></div>)}</div></div>;
}

function StaffManager({staff,onAction,busy}) {
  const [form,setForm]=useState({full_name:"",email:"",password:""});
  return <div className="manager-grid"><form className="panel manager-form" onSubmit={e=>{e.preventDefault();onAction("create",{...form});setForm({full_name:"",email:"",password:""});}}>
    <h2>Create staff account</h2><p className="muted">Each team member gets an individual login. Staff accounts cannot access this admin portal.</p>
    <label>Staff name<input required value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></label>
    <label>Email<input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
    <label>Temporary password<input type="password" minLength="8" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
    <button className="btn btn-dark full" disabled={busy}>{busy?"Working…":"Create staff login"}</button>
  </form><div className="panel"><h2>Team accounts</h2><div className="category-list">{staff.map(s=><div className="staff-row" key={s.id}><div className="grow"><b>{s.full_name||"Staff member"}</b><small>{s.email} · {s.role}</small></div><span className={s.is_active?"active-label":"inactive-label"}>{s.is_active?"Active":"Disabled"}</span>{s.role==="staff"&&<button className="btn btn-outline btn-small" onClick={()=>onAction("toggle",{user_id:s.id,is_active:!s.is_active})}>{s.is_active?"Disable":"Enable"}</button>}</div>)}</div></div></div>;
}

createRoot(document.getElementById("root")).render(<App/>);
