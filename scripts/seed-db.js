// Seed the personal_crm database with realistic test data
// Usage: node scripts/seed-db.js

const { Pool } = require('pg')

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: process.env.DB_LOCAL_PASSWORD,
  database: 'personal_crm'
})

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

const contacts = [
  { name: 'Mom',          relationship_type: 'family',     phone: '555-0101' },
  { name: 'Dad',          relationship_type: 'family',     phone: '555-0102' },
  { name: 'Jake Sullivan',relationship_type: 'friend',     phone: '555-0201' },
  { name: 'Priya Nair',   relationship_type: 'friend',     phone: '555-0202' },
  { name: 'Tom Reyes',    relationship_type: 'friend',     phone: '555-0203' },
  { name: 'Sarah Chen',   relationship_type: 'colleague',  email: 'sarah.chen@work.com' },
  { name: 'Marcus Webb',  relationship_type: 'colleague',  email: 'marcus@work.com' },
  { name: 'Dana Park',    relationship_type: 'friend',     phone: '555-0204' },
  { name: 'Uncle Rob',    relationship_type: 'family',     phone: '555-0103' },
  { name: 'Lisa Tran',    relationship_type: 'friend',     phone: '555-0205' },
]

// [contact_index, type, direction, days_ago, duration_seconds]
const interactions = [
  // Mom — talked recently (3 days ago) and regularly
  [0, 'phone_call',    'incoming',  3,  900],
  [0, 'phone_call',    'outgoing', 10, 1200],
  [0, 'imessage',      'incoming', 12,  null],
  [0, 'phone_call',    'outgoing', 24,  600],

  // Dad — talked 8 days ago
  [1, 'phone_call',    'outgoing',  8,  480],
  [1, 'facetime_video','outgoing', 35, 1800],
  [1, 'phone_call',    'incoming', 62,  300],

  // Jake — talked 2 days ago
  [2, 'phone_call',    'outgoing',  2, 1500],
  [2, 'sms',           'outgoing',  5,  null],
  [2, 'phone_call',    'incoming', 15,  900],
  [2, 'phone_call',    'outgoing', 45,  600],

  // Priya — talked 18 days ago (getting close to 30)
  [3, 'imessage',      'incoming', 18,  null],
  [3, 'phone_call',    'outgoing', 32,  750],
  [3, 'calendar_meeting','outgoing',55, 3600],

  // Tom — 47 days ago (overdue)
  [4, 'phone_call',    'outgoing', 47,  420],
  [4, 'sms',           'incoming', 60,  null],
  [4, 'phone_call',    'incoming', 90,  900],

  // Sarah (colleague) — email 5 days ago
  [5, 'email',         'outgoing',  5,  null],
  [5, 'calendar_meeting','outgoing',12, 3600],
  [5, 'email',         'incoming', 20,  null],

  // Marcus (colleague) — 38 days ago (overdue)
  [6, 'email',         'incoming', 38,  null],
  [6, 'calendar_meeting','outgoing',50, 5400],

  // Dana — 55 days ago (overdue)
  [7, 'phone_call',    'incoming', 55,  600],
  [7, 'imessage',      'outgoing', 70,  null],

  // Uncle Rob — 80 days ago (very overdue)
  [8, 'phone_call',    'outgoing', 80, 1200],
  [8, 'phone_call',    'outgoing',120,  900],

  // Lisa — never contacted (null last_interaction_date)
  // (no interactions — she'll show up in overdue queries)
]

async function seed() {
  console.log('Seeding personal_crm database...\n')

  // Get interaction type IDs
  const typesResult = await pool.query('SELECT id, type_name FROM interaction_types')
  const typeMap = {}
  for (const row of typesResult.rows) {
    typeMap[row.type_name] = row.id
  }

  const contactIds = []

  // Insert contacts
  for (const c of contacts) {
    const result = await pool.query(
      `INSERT INTO contacts (name, relationship_type, phone_number, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [c.name, c.relationship_type, c.phone || null, c.email || null]
    )
    if (result.rows.length > 0) {
      contactIds.push(result.rows[0].id)
      console.log(`  + Contact: ${c.name} (id ${result.rows[0].id})`)
    } else {
      const existing = await pool.query('SELECT id FROM contacts WHERE name = $1', [c.name])
      contactIds.push(existing.rows[0].id)
      console.log(`  ~ Contact already exists: ${c.name}`)
    }
  }

  console.log()

  // Insert interactions
  for (const [ci, type, direction, days, duration] of interactions) {
    const contactId = contactIds[ci]
    const typeId = typeMap[type]
    const ts = daysAgo(days)

    await pool.query(
      `INSERT INTO interactions (contact_id, interaction_type_id, direction, timestamp, duration_seconds)
       VALUES ($1, $2, $3, $4, $5)`,
      [contactId, typeId, direction, ts, duration || null]
    )
  }

  // Update last_interaction_date on each contact
  await pool.query(`
    UPDATE contacts c
    SET last_interaction_date = (
      SELECT MAX(timestamp) FROM interactions WHERE contact_id = c.id
    ),
    updated_at = NOW()
  `)

  console.log(`  + Inserted ${interactions.length} interactions\n`)

  // Summary
  const summary = await pool.query(`
    SELECT c.name, c.relationship_type,
           COUNT(i.id) as interaction_count,
           MAX(i.timestamp) as last_contact,
           EXTRACT(DAY FROM NOW() - MAX(i.timestamp)) as days_since
    FROM contacts c
    LEFT JOIN interactions i ON c.id = i.contact_id
    GROUP BY c.id, c.name, c.relationship_type
    ORDER BY MAX(i.timestamp) DESC NULLS LAST
  `)

  console.log('Current state of contacts:')
  console.log('─'.repeat(70))
  for (const row of summary.rows) {
    const days = row.days_since ? `${Math.round(row.days_since)}d ago` : 'never'
    console.log(`  ${row.name.padEnd(20)} ${row.relationship_type.padEnd(12)} ${row.interaction_count} interactions  last: ${days}`)
  }
  console.log()
  console.log('Done.')

  await pool.end()
}

seed().catch(err => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
