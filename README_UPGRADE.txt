SnapEats - Advanced full project source (without Meta WhatsApp or Maps)
=========================================================================

Included
--------
main.jsx                         Customer/staff/admin application
style.css                        Responsive website styling
supabase.js                      Supabase browser client
integrations.js                  Razorpay checkout, GPS coordinate subscription, coupons, reviews and referrals
AdvancedAdmin.jsx                Admin logo, analytics, coupon, inventory, branch, partner, reviews and kitchen-ticket screens
0001_momosip.sql                 Original base schema
0002_snapeats_features.sql       Customer accounts and loyalty (₹350 threshold)
0005_snapeats_advanced_features.sql Advanced database tables, RLS and logo storage bucket (no WhatsApp table)
0006_remove_whatsapp_and_map_dependencies.sql Cleanup for an existing database
supabase/functions/*             Secure Razorpay Edge Functions only
.env.example                     Frontend env template and server-secret names

Removed integrations
--------------------
- Meta WhatsApp Business API notifications and related Edge Function are removed.
- No Google Maps, Mapbox, Maps SDK, Maps API key, or map-rendering dependency is included.
- Live delivery coordinate tracking remains: delivery partner GPS coordinates can be stored and streamed in realtime. Customers can see coordinate/status data, but no map is rendered.

Database
--------
Fresh database: run 0001, then 0002, then 0005. Do not run 0006 on a fresh database.
Existing database: if 0001, 0002 and older 0005 were already applied, back up first, then run 0006 to drop the obsolete WhatsApp log table.
Do not rerun base migrations on a live database.

Install frontend dependencies
-----------------------------
npm install react react-dom @supabase/supabase-js lucide-react
npm install -D vite

Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env. Never put a service-role
key or Razorpay secret in Vite/frontend variables.

Deploy Edge Functions
---------------------
supabase functions deploy create-payment-order
supabase functions deploy verify-payment

Set function secrets in Supabase:
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET.

Load Razorpay checkout.js in index.html:
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
Use startRazorpayCheckout(orderId, customer) from integrations.js after creating
an order. Verify successful and failed payment flows in Razorpay test mode.

Delivery tracking without Maps
------------------------------
The database stores latitude, longitude, accuracy and recorded time in delivery_locations.
Delivery partner app must send GPS updates only after partner authentication. Customer
tracking screens can subscribe using subscribeToDelivery(orderId, callback). No map SDK,
map tile service, or Maps API credential is required or bundled.

Security / operational notes
----------------------------
- Razorpay secrets are used only by Edge Functions. Payment signatures are verified server-side.
- Never mark an order paid from the browser. Use verify-payment.
- Admin logo files go to the public snapeats-assets Storage bucket; only super-admins can upload.
- Delivery partner profiles are created in the admin screen; create/link a Supabase Auth user
  and set delivery_partners.user_id before allowing partner login. Do not expose service-role keys.
- Admin screen includes sales overview, coupons, stock list, branches, partner profiles,
  review moderation, printable kitchen tickets and logo upload.
- Referral code generation is included; referral attribution and reward issuance require a
  verified first paid order policy before enabling monetary/points rewards.
- Inventory is managed as stock records; automatic recipe-level deduction requires recipes/BOMs.
- Branch table and order.branch_id are present; pass branch_id when creating an order to route it.
- GPS tracking needs a delivery partner app and customer tracking UI; map rendering is intentionally removed.

Business rules retained
-----------------------
- On-Site Delivery minimum order: ₹150.
- Every completed customer order with total >= ₹350 earns exactly 1 point AND 1 stamp.
- Orders below ₹350 earn neither. 10 qualifying stamps unlock one free Momos portion.

This is source code, not a deployed service. External Razorpay credentials, partner authentication
and end-to-end testing are required before production use.
