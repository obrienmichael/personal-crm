# Personal CRM with Claude Integration
## Development Plan (v3 — iOS-First Architecture)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                     iPhone                           │
│                                                      │
│  CallKit (calls + FaceTime) ──┐                     │
│  Messages framework ──────────┼──→ iOS App (Swift)  │
│  CNContactStore (Contacts) ───┘         │            │
└─────────────────────────────────────────┼────────────┘
                                          │ HTTPS sync
                               ┌──────────▼──────────┐
                               │   Neon (cloud        │
                               │   PostgreSQL)         │
                               └──────────┬───────────┘
                                          │
                               ┌──────────▼──────────┐
                               │  Vercel REST API     │
                               │  (Node.js/Express)   │
                               └──────────┬───────────┘
                                          │
                    ┌─────────────────────┼──────────────────┐
                    ▼                     ▼                  ▼
           Claude Desktop           Claude iOS          Future: Web
           (local MCP server)    (direct API calls)    Dashboard
```

**Why iOS-first:**
- iPhone is the only device with access to full call history (CallKit), FaceTime metadata, phone call duration/direction, and iMessage thread metadata
- macOS has no call history database; `chat.db` requires fragile Full Disk Access and misses all phone/FaceTime calls
- Manual logging is unsustainable — passive automatic capture is the only path to reliable data
- The cloud DB + API layer already built in Phases 1–3 is correct and reusable regardless of ingestion method

---

## What Has Already Been Built (Phases 1–3 ✅)

### Phase 1 — Database Schema ✅
- Local PostgreSQL `personal_crm` with 4 tables: `contacts`, `interactions`, `interaction_types`, `relationship_goals`
- `schema.sql`, `scripts/init-db.sh`, `SCHEMA_DOCUMENTATION.md`
- **Status:** Complete. Schema is correct and will be migrated to Neon cloud DB in Phase 5.

### Phase 2 — REST API ✅
- Express server at `api/` running on port 3001 (locally), to be deployed on Vercel
- 7 endpoints: contacts CRUD, overdue queries, interaction logging, stats
- **Status:** Complete. No changes needed — this is the API the iOS app and MCP server will both use.

### Phase 3 — MCP Server ✅
- Local MCP server at `mcp/` using `@modelcontextprotocol/sdk`
- 6 tools registered in Claude Desktop: `get_contacts`, `get_overdue_contacts`, `get_recent_interactions`, `log_interaction`, `get_contact_details`, `get_contact_stats`
- Claude Desktop config updated at `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Status:** Complete. Currently points to local API (port 3001). Will be updated to Vercel URL in Phase 5.

---

## Remaining Phases

---

## Phase 4: iOS App — Passive Data Capture

### Objective
Build a native Swift iOS app that automatically captures call metadata, iMessage thread activity, and contacts — syncing to the cloud database without any manual input from the user.

### Prerequisites
- Xcode installed on Mac
- Apple Developer account ($99/year) — required to run on a real device
- Neon cloud database provisioned (Phase 5 can be done in parallel)

### What the iOS App Captures

| Data Source | iOS Framework | What We Get |
|---|---|---|
| Phone calls | CallKit (CXCallObserver) | Timestamp, duration, direction (in/out), contact identity |
| FaceTime Audio | CallKit | Same as phone calls |
| FaceTime Video | CallKit | Same as phone calls |
| iMessage / SMS | Messages framework (read-only) | Thread participant, last message timestamp (not content) |
| Contacts | CNContactStore | Name, phone, email — for matching and import |

**What we do NOT capture:** Message content, voicemail, third-party apps (WhatsApp, Signal, etc.)

### App Architecture

```
ios/PersonalCRM/
├── App/
│   ├── PersonalCRMApp.swift      — Entry point, background task registration
│   └── AppDelegate.swift
├── Services/
│   ├── CallObserver.swift        — CXCallObserver delegate, captures call events
│   ├── ContactsSync.swift        — CNContactStore import on first launch + incremental
│   ├── MessageScanner.swift      — Reads Messages DB for recent thread activity
│   └── SyncService.swift         — Batches and POSTs to Vercel API
├── Models/
│   ├── CapturedCall.swift        — Local model for a captured call event
│   └── CapturedInteraction.swift — Normalized interaction before sync
├── Storage/
│   └── LocalQueue.swift          — CoreData queue for offline buffering
└── Settings/
    └── SettingsView.swift         — API URL, API key config, sync status, manual trigger
```

### Task 4.1: Project Setup

1. Create new Xcode project: `PersonalCRM` (Swift, SwiftUI, iOS 17+)
2. Add to repo at `ios/` directory
3. Set bundle ID: `com.yourdomain.personalcrm`
4. Add to `ios/` in the existing git repo
5. Enable capabilities in Xcode:
   - Background Modes → Background fetch, Background processing
   - Add to Info.plist: `NSContactsUsageDescription`, `NSMotionUsageDescription`
6. No special entitlement needed for CallKit observer — available to any app

### Task 4.2: CallKit Call Observer

`CXCallObserver` fires delegate callbacks for every call on the device — phone, FaceTime audio, FaceTime video. No permissions required beyond being installed.

```swift
import CallKit
import Contacts

class CallObserver: NSObject, CXCallObserverDelegate, ObservableObject {
    private let callObserver = CXCallObserver()
    private var callStartTimes: [UUID: Date] = [:]
    private var callContacts: [UUID: String] = [:]  // uuid → resolved contact name

    override init() {
        super.init()
        callObserver.setDelegate(self, queue: .main)
    }

    func callObserver(_ callObserver: CXCallObserver, callChanged call: CXCall) {
        switch (call.hasConnected, call.hasEnded) {
        case (false, false):
            // Ringing / connecting
            callStartTimes[call.uuid] = Date()
            resolveContactName(for: call.uuid)

        case (true, false):
            // Connected — call is in progress
            break

        case (_, true):
            // Call ended
            guard let startTime = callStartTimes[call.uuid] else { return }
            let duration = Int(Date().timeIntervalSince(startTime))
            let direction: String = call.isOutgoing ? "outgoing" : "incoming"
            let contactName = callContacts[call.uuid] ?? "Unknown"
            let interactionType = call.isEqualToCall(call) ? "phone_call" : "phone_call"
            // Determine FaceTime vs phone call via CXHandle if available

            let interaction = CapturedInteraction(
                contactName: contactName,
                type: interactionType,
                direction: direction,
                timestamp: startTime,
                durationSeconds: duration
            )

            SyncService.shared.enqueue(interaction)
            callStartTimes.removeValue(forKey: call.uuid)
            callContacts.removeValue(forKey: call.uuid)

        default:
            break
        }
    }

    private func resolveContactName(for uuid: UUID) {
        // Look up the number from system call log via CNContactStore
        // Match phone number to contact name
    }
}
```

### Task 4.3: Contacts Import (One-Time + Incremental)

On first launch, request Contacts permission and bulk-import to CRM. Run incrementally on subsequent launches to catch new contacts.

```swift
import Contacts

class ContactsSync {
    func importAll(apiClient: APIClient) async {
        let store = CNContactStore()
        guard (try? await store.requestAccess(for: .contacts)) == true else { return }

        let keys: [CNKeyDescriptor] = [
            CNContactGivenNameKey as CNKeyDescriptor,
            CNContactFamilyNameKey as CNKeyDescriptor,
            CNContactPhoneNumbersKey as CNKeyDescriptor,
            CNContactEmailAddressesKey as CNKeyDescriptor
        ]

        let request = CNContactFetchRequest(keysToFetch: keys)
        try? store.enumerateContacts(with: request) { contact, _ in
            let name = [contact.givenName, contact.familyName]
                .filter { !$0.isEmpty }.joined(separator: " ")
            let phone = contact.phoneNumbers.first?.value.stringValue
            let email = contact.emailAddresses.first?.value as String?

            Task {
                await apiClient.upsertContact(name: name, phone: phone, email: email)
            }
        }
    }
}
```

### Task 4.4: Sync Service

Queues interactions locally (survives offline / app kills) and syncs to Vercel API when connectivity is available.

```swift
class SyncService {
    static let shared = SyncService()
    private var queue: [CapturedInteraction] = []  // backed by CoreData in production

    func enqueue(_ interaction: CapturedInteraction) {
        queue.append(interaction)
        Task { await syncPending() }
    }

    func syncPending() async {
        for interaction in queue {
            let success = await APIClient.shared.logInteraction(interaction)
            if success { queue.removeAll { $0.id == interaction.id } }
        }
    }
}
```

Background sync registered as `BGAppRefreshTask` — iOS will fire it periodically when on WiFi and charging.

### Task 4.5: API Client (iOS)

Simple `URLSession`-based client pointing at the Vercel API:

```swift
struct APIClient {
    let baseURL: String   // https://personal-crm-api.vercel.app
    let apiKey: String    // stored in Keychain

    func logInteraction(_ interaction: CapturedInteraction) async -> Bool {
        // POST /api/interactions with x-api-key header
    }

    func upsertContact(name: String, phone: String?, email: String?) async {
        // POST /api/contacts/upsert
    }
}
```

### Task 4.6: New API Endpoint — Contact Upsert

Add to `api/server.js`:

```javascript
// POST /api/contacts/upsert — create or update contact by name, matched by phone if available
app.post('/api/contacts/upsert', async (req, res) => {
    const { name, phone_number, email, relationship_type } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })

    const result = await pool.query(
        `INSERT INTO contacts (name, phone_number, email, relationship_type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (name) DO UPDATE
         SET phone_number = COALESCE(EXCLUDED.phone_number, contacts.phone_number),
             email = COALESCE(EXCLUDED.email, contacts.email),
             updated_at = NOW()
         RETURNING *`,
        [name, phone_number || null, email || null, relationship_type || 'unknown']
    )
    res.json(result.rows[0])
})
```

Note: requires `UNIQUE` constraint on `contacts.name` — add to `schema.sql`.

### Task 4.7: Settings UI

Minimal SwiftUI settings screen:
- API URL field (default: Vercel URL)
- API Key field (stored in Keychain)
- Last sync timestamp
- Manual "Sync Now" button
- "Import Contacts" button (re-runs the one-time import)

### Deliverables for Phase 4
- `ios/PersonalCRM.xcodeproj` — full Xcode project in repo
- CallKit observer capturing all calls passively
- Contacts import on first launch
- Local queue with background sync to Vercel API
- New `POST /api/contacts/upsert` endpoint

---

## Phase 5: Cloud Database + Vercel Deployment

### Objective
Move the database to the cloud (Neon) and deploy the API to Vercel so the iOS app, Claude Desktop MCP, and Claude iOS can all access the same data from anywhere.

### Task 5.1: Provision Neon PostgreSQL

1. Go to [neon.tech](https://neon.tech), sign up with GitHub
2. Create project: `personal-crm`
3. Copy the connection string
4. Apply existing schema:
   ```bash
   psql "YOUR_NEON_CONNECTION_STRING" -f schema.sql
   ```
5. Verify: `psql "CONNECTION_STRING" -c "\dt"` — should show 4 tables

### Task 5.2: Add API Key Auth to Express Server

Before deploying publicly, add authentication middleware to `api/server.js`:

```javascript
function requireApiKey(req, res, next) {
    const key = req.headers['x-api-key']
    if (!key || key !== process.env.API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' })
    }
    next()
}

// Apply to all /api routes (after health check)
app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api', requireApiKey)
```

### Task 5.3: Deploy to Vercel

1. Push code to GitHub
2. Import repo at [vercel.com](https://vercel.com), set root directory to `api/`
3. Set environment variables:
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` — from Neon
   - `API_KEY` — generate a strong random string: `openssl rand -hex 32`
   - `NODE_ENV=production`
4. Deploy → note production URL

### Task 5.4: Update MCP Config

In `~/Library/Application Support/Claude/claude_desktop_config.json`, update `personalcrm` env:
```json
"env": {
  "API_URL": "https://your-crm-api.vercel.app",
  "API_KEY": "your-api-key"
}
```

Update `mcp/src/apiClient.js` to pass `x-api-key` header:
```javascript
headers: { 'x-api-key': process.env.API_KEY }
```

### Deliverables for Phase 5
- Neon PostgreSQL live with schema
- Vercel API deployed with API key auth
- MCP server pointed at Vercel, auth working
- iOS app configured with Vercel URL + API key

---

## Phase 6: Mac iMessage Sync Script

### Objective
Capture iMessage/SMS history from the Mac. The iOS app sandbox can't read the Messages database, but a Mac script with Full Disk Access can — giving historical data going back years.

### Prerequisites
- Grant Full Disk Access to Terminal: System Settings → Privacy & Security → Full Disk Access → add Terminal

### Task 6.1: iMessage Sync Script

Create `scripts/imessage-sync.js`:

Reads `~/Library/Messages/chat.db` (SQLite), extracts recent message thread metadata (who you messaged, when), deduplicates against existing interactions, and POSTs to the Vercel API.

Key query — recent thread activity per contact:
```sql
SELECT
  h.id as handle,           -- phone number or email
  MAX(datetime(m.date/1000000000 + 978307200, 'unixepoch', 'localtime')) as last_message,
  COUNT(m.rowid) as message_count,
  m.is_from_me
FROM message m
JOIN chat_message_join cmj ON m.rowid = cmj.message_id
JOIN chat c ON cmj.chat_id = c.rowid
JOIN chat_handle_join chj ON c.rowid = chj.chat_id
JOIN handle h ON chj.handle_id = h.rowid
WHERE m.date > (strftime('%s','now') - 90*86400 - 978307200) * 1000000000
GROUP BY h.id
ORDER BY last_message DESC
```

Dependency: `better-sqlite3` npm package (synchronous SQLite reader, no server needed).

### Task 6.2: Deduplication Column

Add `external_id VARCHAR(255) UNIQUE` to `interactions` table to prevent double-logging:
- iMessage sync generates: `imessage_{handle}_{date}`
- iOS app generates: `call_{uuid}`
- API uses `ON CONFLICT (external_id) DO NOTHING`

Migration:
```sql
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS idx_interactions_external_id ON interactions(external_id) WHERE external_id IS NOT NULL;
```

### Task 6.3: Launchd Schedule

`scripts/com.personalcrm.imessage-sync.plist` — runs the sync script daily via macOS launchd (more reliable than cron).

Install: `launchctl load ~/Library/LaunchAgents/com.personalcrm.imessage-sync.plist`

### Deliverables for Phase 6
- `scripts/imessage-sync.js` — reads chat.db, syncs to Vercel API
- `external_id` deduplication on `interactions` table
- `scripts/com.personalcrm.imessage-sync.plist` — daily launchd schedule
- Historical iMessage data imported

---

## Phase 7: iOS Shortcuts Bridge (Quick Win, Do Before Phase 4)

### Objective
While the iOS app is being built (Phase 4 takes time), use iOS Shortcuts as a faster bridge to start capturing real call data. Requires Phase 5 (Vercel) to be live.

### Task 7.1: "Log Call" Shortcut

A Shortcut that takes ~10 seconds to use after a call:
1. Ask: "Who did you call?" → text input or contact picker
2. Ask: "How long? (minutes)" → number input
3. Ask: "Incoming or outgoing?" → menu
4. POST to Vercel `/api/interactions` with `x-api-key` header
5. Show confirmation

### Task 7.2: Home Screen Widget / Action Button

Add the shortcut to iPhone home screen or assign to Action Button (iPhone 15 Pro+) for one-tap access immediately after a call.

### Deliverables for Phase 7
- Exported `.shortcut` files in `shortcuts/` directory
- Instructions for installation and configuration

---

## Phase 8: Polish and Reliability

### Task 8.1: Contact Matching by Phone Number

Improve `POST /api/interactions` to match contacts by phone number before falling back to name — prevents duplicate contacts when the iOS app and iMessage sync both create the same person.

```javascript
// In POST /api/interactions:
// 1. If phone_number provided → look up by phone
// 2. Else → look up by name
// 3. Else → create new
```

### Task 8.2: Relationship Goals via Claude

The `relationship_goals` table is already in the schema. Add MCP tools and API endpoints to use it:
- `set_contact_goal` — "Remind me to call Mom every 7 days"
- `get_goal_violations` — contacts where frequency_days has elapsed since last contact
- Claude can proactively surface: "You set a goal to call Uncle Rob weekly — it's been 11 days"

### Task 8.3: Claude iOS Integration

Once Vercel API is live with auth, Claude iOS can query it directly using the Anthropic API with tool definitions matching the MCP tools — no MCP protocol needed on mobile.

---

## Revised Execution Order

| Phase | What | Dependency |
|---|---|---|
| ✅ 1 | Database schema | — |
| ✅ 2 | REST API (local) | Phase 1 |
| ✅ 3 | MCP Server | Phase 2 |
| **4** | iOS App | Phase 5 (Vercel URL needed) |
| **5** | Cloud DB + Vercel deployment | Phase 2 |
| **6** | iMessage sync script | Phase 5 |
| **7** | iOS Shortcuts bridge | Phase 5 |
| **8** | Polish | Phases 4–6 |

**Recommended next step:** Phase 5 (cloud deployment) before Phase 4, since the iOS app needs the Vercel URL to sync to. Phases 6 and 7 can be done in any order after Phase 5.

---

## Success Criteria

The system is complete when:
1. User makes a phone call → iOS app captures it automatically → syncs to Neon → queryable via Claude within minutes, with zero manual input
2. Claude Desktop: "Who haven't I talked to in 30 days?" → accurate answer from real call history
3. Claude iOS: same question → same answer via Vercel API
4. New contact added to iPhone → appears in CRM on next sync
5. iMessage history going back 90+ days imported from Mac

---

## Directory Structure (Final)

```
personal-crm/
├── schema.sql                    # Database schema (local + Neon)
├── SCHEMA_DOCUMENTATION.md       # Table reference
├── crm_mcp_dev_plan.md           # This file
├── api/                          # REST API → Vercel
│   ├── server.js
│   ├── src/db.js
│   ├── package.json
│   ├── vercel.json
│   └── API_DOCUMENTATION.md
├── mcp/                          # MCP server → runs locally on Mac
│   ├── src/
│   │   ├── index.js
│   │   ├── tools.js
│   │   └── apiClient.js
│   ├── package.json
│   └── CLAUDE_DESKTOP_SETUP.md
├── ios/                          # iOS app (Phase 4)
│   └── PersonalCRM.xcodeproj/
├── scripts/
│   ├── init-db.sh                # Apply schema to any postgres DB
│   ├── seed-db.js                # Test data
│   ├── imessage-sync.js          # Phase 6: chat.db → API
│   └── com.personalcrm.imessage-sync.plist
└── shortcuts/                    # Phase 7: iOS Shortcut exports
    └── log-call.shortcut
```

---

## Key Architecture Decisions

| Decision | Rationale |
|---|---|
| iOS app as primary ingestion | Only device with CallKit (full call metadata). Mac has no equivalent. |
| Neon over local PostgreSQL | Single cloud DB accessible from iOS app, Vercel, and Mac simultaneously |
| Vercel for API | Serverless, free tier, zero-config GitHub deployment |
| API key auth (not JWT) | Single-user personal app — no session management needed |
| MCP stays local on Mac | Claude Desktop MCP runs on Mac; MCP protocol doesn't need to be public |
| iMessage via Mac script | iOS app sandbox can't read Messages DB; Mac Terminal with Full Disk Access can |
| Deduplication via external_id | Prevents double-logging when multiple ingestion sources capture the same event |
