# Privacy and Data Retention Policy — Javas Bot WA

This document outlines the privacy modes, GDPR compliance features, and data retention guidelines in Javas Bot WA.

## Privacy Modes

Admin can configure the group privacy setting via `/privacymode [strict|balanced|off]`:

1. **Strict Mode**:
   - Usage logs redact user JIDs into masked hashes.
   - Command logging only prints the category feature key (e.g. `sticker` instead of `/brat hello`).
   - Message contents are completely discarded from logs.
2. **Balanced Mode**:
   - Logging tracks JID metrics but drops detailed arguments/body.
3. **Off Mode**:
   - Tracks metrics and raw command names.

---

## GDPR Compliance

* **Consent (/consent)**: Users can explicitly opt-out of AI integrations or analytics tracking.
* **My Data (/mydata)**: Users can retrieve all stored telemetry linked to their ID.
* **Delete My Data (/deletemydata)**: Permadeletes the user profile, achievements, and economy records.

---

## Log Redaction

The logging utility (`logger.ts`) automatically intercepts and sanitizes sensitive tokens, credit numbers, private URLs, and JIDs prior to outputting logs.
