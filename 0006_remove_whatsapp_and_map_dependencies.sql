-- SnapEats: remove Meta WhatsApp integration remnants from existing databases.
-- GPS coordinate tracking remains available without any Maps provider or map SDK.
drop table if exists public.whatsapp_notification_log cascade;
