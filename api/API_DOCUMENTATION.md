# Personal CRM REST API Documentation

## Base URL
- Development: `http://localhost:3001`
- Production: `https://your-api.vercel.app` (set after Phase 6 deployment)

---

## Endpoints

### Health Check
**GET** `/api/health`

Returns server status.

```json
{ "status": "ok", "timestamp": "2026-02-17T10:30:00.000Z" }
```

---

### Get All Contacts
**GET** `/api/contacts`

Returns all contacts sorted by most recent interaction (NULL last).

```json
[
  {
    "id": 1,
    "name": "Alice Johnson",
    "phone_number": "555-0123",
    "email": "alice@example.com",
    "relationship_type": "friend",
    "last_interaction_date": "2026-02-15T14:30:00.000Z"
  }
]
```

---

### Get Overdue Contacts
**GET** `/api/contacts/overdue/:days`

Returns contacts not interacted with in at least `:days` days, plus contacts with no interactions at all.

**Parameters:** `days` — integer threshold

```json
[
  {
    "id": 3,
    "name": "Carol Davis",
    "phone_number": null,
    "email": null,
    "relationship_type": "colleague",
    "last_interaction_date": "2025-12-01T10:00:00.000Z",
    "days_since_contact": 78
  }
]
```

---

### Get Contact Details
**GET** `/api/contacts/:id`

Returns full contact record plus complete interaction history.

```json
{
  "contact": {
    "id": 1,
    "name": "Alice Johnson",
    "phone_number": "555-0123",
    "email": "alice@example.com",
    "relationship_type": "friend",
    "last_interaction_date": "2026-02-15T14:30:00.000Z",
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-02-15T14:30:00.000Z"
  },
  "interactions": [
    {
      "id": 5,
      "timestamp": "2026-02-15T14:30:00.000Z",
      "direction": "outgoing",
      "duration_seconds": 600,
      "subject": null,
      "notes": null,
      "type_name": "phone_call"
    }
  ]
}
```

---

### Get Contact Statistics
**GET** `/api/contacts/:id/stats`

Returns relationship statistics for a contact.

```json
{
  "name": "Alice Johnson",
  "total_interactions": 12,
  "outgoing_count": 7,
  "incoming_count": 5,
  "last_interaction": "2026-02-15T14:30:00.000Z",
  "first_interaction": "2025-06-01T10:00:00.000Z",
  "avg_days_between_interactions": 22
}
```

---

### Get Recent Interactions
**GET** `/api/interactions/recent/:limit`

Returns the most recent `:limit` interactions across all contacts.

**Parameters:** `limit` — integer, max results to return

```json
[
  {
    "id": 5,
    "timestamp": "2026-02-15T14:30:00.000Z",
    "direction": "outgoing",
    "duration_seconds": 600,
    "subject": null,
    "contact_name": "Alice Johnson",
    "type_name": "phone_call"
  }
]
```

---

### Log New Interaction
**POST** `/api/interactions`

Records a new interaction. Creates the contact if they don't exist yet.

**Request body:**
```json
{
  "contact_name": "Alice Johnson",
  "interaction_type": "phone_call",
  "direction": "outgoing",
  "duration_seconds": 600,
  "subject": null
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `contact_name` | Yes | Matched by exact name; creates contact if not found |
| `interaction_type` | Yes | One of: `phone_call`, `sms`, `email`, `imessage`, `facetime_audio`, `facetime_video`, `calendar_meeting` |
| `direction` | No | `incoming` or `outgoing` |
| `duration_seconds` | No | Integer, for calls/meetings |
| `subject` | No | For emails or meeting titles |

**Response (201):**
```json
{
  "success": true,
  "interaction": {
    "id": 6,
    "contact_id": 1,
    "interaction_type_id": 1,
    "direction": "outgoing",
    "timestamp": "2026-02-17T10:00:00.000Z",
    "duration_seconds": 600,
    "subject": null,
    "notes": null,
    "created_at": "2026-02-17T10:00:00.000Z"
  }
}
```

---

## Error Responses

All errors return JSON with an `error` field:

```json
{ "error": "Contact not found" }
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request (missing required fields) |
| 404 | Resource not found |
| 500 | Server error (check server logs) |
