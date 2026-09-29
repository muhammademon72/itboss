# Security Specification - IT Equipment Requisition System

This document outlines the security invariants, structural payloads, and tests designed to protect the Firestore database of the Equipment Requisition application against unauthorised access or exploitation.

## 1. Data Invariants

- **Ownership Integrity**: Requisitions must always belong to the user who created them (`createdBy` matches `request.auth.uid`).
- **Immutable Metadata**: Fields like `createdAt` and `createdBy` must not be changed once written.
- **Workflow State Constraints**: The form status changes must follow normal progression: `Submitted` -> `Manager_Approved` -> `Recommended` -> `Fully_Approved`, or `Rejected`.
- **String Sanitization**: Avoid unbounded string inputs; apply strict sizing constraints to all comments, address details, and contact numbers.
- **Predefined Size Caps**: Line items inside a single requisition document cannot exceed 40 entries to prevent memory exhaustion and "Denial of Wallet" costs.

## 2. The "Dirty Dozen" Threat Scenarios

1. **Privilege Escalation**: Non-owner tries to update another user's requisition details.
2. **Impersonation**: Writing a requisition payload where `createdBy` is initialized to a random victim's UID.
3. **Creation Time Spoof**: Forcing a vintage `createdAt` value in the past instead of a true server timestamp.
4. **Update-Gap Injection**: Adding unapproved ghost keys to the document during updating.
5. **State Skipping**: Trying to mark a brand-new requisition as `Fully_Approved` on creation, skipping all manager signs.
6. **Denial of Wallet ID**: Creating documents using huge, multi-megabyte keys.
7. **Bypassing Signature Checks**: Tampering with or altering someone else's digital signing payload.
8. **PII Scraping via Blanket List**: Scanning other users' private requisitions without authentication.
9. **No-SQL Query Injection**: Evading owner filters during search queries.
10. **Malicious Content Swamping**: Injecting a massive string into description or reason fields.
11. **Negative Value Poisoning**: Setting negative prices or negative quantities for equipment.
12. **Double Sign Attempt**: Attempting to overwrite existing signatures or rollback a signed state.

## 3. Recommended Production Rules Configuration

The `firestore.rules` is configured incorporating absolute path protection and type validations on all incoming fields.
