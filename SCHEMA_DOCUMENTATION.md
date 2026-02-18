# Schema Documentation

## Overview

The `personal_crm` database stores contacts, a log of every interaction, interaction type definitions, and relationship goals. All four tables are defined in `schema.sql`.

---

## Tables

### `contacts`

The central table. One row per person you want to track.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL (auto-increment integer) | Primary key |
| `name` | VARCHAR(255) | Required. Full name of the contact |
| `phone_number` | VARCHAR(20) | Optional |
| `email` | VARCHAR(255) | Optional |
| `relationship_type` | VARCHAR(50) | e.g. `friend`, `family`, `colleague` |
| `last_interaction_date` | TIMESTAMP | Updated automatically when an interaction is logged |
| `created_at` | TIMESTAMP | Set on insert, never changes |
| `updated_at` | TIMESTAMP | Updated whenever the row changes |

---

### `interaction_types`

Reference/lookup table. Defines the allowed categories of interaction.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL | Primary key |
| `type_name` | VARCHAR(50) UNIQUE | Machine-readable identifier |
| `description` | TEXT | Human-readable label |

**Seeded values:**

| type_name | description |
|-----------|-------------|
| `phone_call` | Voice call |
| `facetime_audio` | FaceTime audio call |
| `facetime_video` | FaceTime video call |
| `sms` | Text message |
| `imessage` | iMessage |
| `email` | Email |
| `calendar_meeting` | Calendar meeting |

---

### `interactions`

Every logged interaction between you and a contact. Referenced by the API for all date-based queries ("who haven't I talked to in X days?").

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL | Primary key |
| `contact_id` | INTEGER | FK → `contacts.id` (cascades on delete) |
| `interaction_type_id` | INTEGER | FK → `interaction_types.id` |
| `direction` | VARCHAR(20) | `incoming` or `outgoing` (optional) |
| `timestamp` | TIMESTAMP | When the interaction occurred (required) |
| `duration_seconds` | INTEGER | For calls/meetings (optional) |
| `subject` | VARCHAR(255) | For emails/meetings (optional) |
| `notes` | TEXT | Free-form notes (optional) |
| `created_at` | TIMESTAMP | When the row was inserted |

---

### `relationship_goals`

Optional per-contact goals: how often you want to stay in touch.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL | Primary key |
| `contact_id` | INTEGER | FK → `contacts.id` (cascades on delete) |
| `goal_description` | TEXT | e.g. "Call mom every week" |
| `frequency_days` | INTEGER | Target interval in days |
| `last_reached_out_date` | TIMESTAMP | Updated when a goal is marked complete |
| `created_at` | TIMESTAMP | When the goal was set |

---

## Indexes

| Index | Table | Column | Purpose |
|-------|-------|--------|---------|
| `idx_interactions_contact_id` | interactions | contact_id | Fast join from contacts → interactions |
| `idx_interactions_timestamp` | interactions | timestamp | Fast time-range queries (overdue contacts) |
| `idx_contacts_name` | contacts | name | Fast name lookup when logging by name |

---

## Relationships

```
contacts (1) ──< interactions (many)         via contact_id
contacts (1) ──< relationship_goals (many)   via contact_id
interaction_types (1) ──< interactions (many) via interaction_type_id
```

Deleting a contact cascades to delete all their interactions and goals.
