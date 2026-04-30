-- Migration 09: Connect quiz 9d32959f-1971-4cb5-bda1-282590f40356 to icreate-campaign affiliate network
-- The affiliate endpoint expects application/x-www-form-urlencoded (HTML form POST)
-- field_mapping: { affiliate_field: our_internal_field }
-- static_fields: fixed values sent with every submission

UPDATE quiz_configs
SET affiliate_config = '{
  "enabled": true,
  "url": "https://icreate-campaign.com/Admin/WS/InsertLeadCRM",
  "method": "POST",
  "content_type": "form",
  "field_mapping": {
    "full_name": "name",
    "phone": "phone"
  },
  "static_fields": {
    "public_key_token": "8248dbfc-daf8-43ff-b859-5e89b75473a4",
    "camp_id": "643418cf-aba6-41ee-9b42-173596b38a55",
    "emedia": "c433102",
    "eid": "VqYmQgTPuwTJj0U_1FDrZYeSfpFZNDY_TsVqYmQgTPuwTJj0UtS"
  }
}'::jsonb
WHERE id = '9d32959f-1971-4cb5-bda1-282590f40356';
