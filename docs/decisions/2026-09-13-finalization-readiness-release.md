# Event finalization readiness release

Date: 2026-09-13  
Status: accepted for the October Standard Singles pilot

The event-finalization readiness reader is an October-critical protected
workflow. It is available by default and no longer depends on the
`ACC_EVENT_FINALIZATION_READINESS_ENABLED` deployment variable.

This change removes configuration drift; it does not broaden authority. The
route still requires a verified session, the database reader still checks the
actor's director or co-director role, private data remains behind the
service-only adapter, and an incomplete evidence set continues to return a
fail-closed readiness report rather than finalization authority.

Optional external providers—online payments, SMS, and OCR—remain separately
default-off and are unaffected.
