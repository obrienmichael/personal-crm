const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./src/db');

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// GET all contacts sorted by last interaction
app.get('/api/contacts', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, phone_number, email, relationship_type, last_interaction_date FROM contacts ORDER BY last_interaction_date DESC NULLS LAST'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET contacts not contacted in X days
// NOTE: must be registered before /api/contacts/:id to avoid Express matching "overdue" as an id
app.get('/api/contacts/overdue/:days', async (req, res) => {
    try {
        const days = parseInt(req.params.days);

        const result = await pool.query(
            `SELECT id, name, phone_number, email, relationship_type, last_interaction_date,
                    EXTRACT(DAY FROM NOW() - last_interaction_date) as days_since_contact
             FROM contacts
             WHERE last_interaction_date IS NULL OR last_interaction_date < NOW() - INTERVAL '1 day' * $1
             ORDER BY last_interaction_date ASC NULLS FIRST`,
            [days]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching overdue contacts:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET single contact with all interactions
app.get('/api/contacts/:id', async (req, res) => {
    try {
        const contactId = req.params.id;

        const contact = await pool.query(
            'SELECT * FROM contacts WHERE id = $1',
            [contactId]
        );

        if (contact.rows.length === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        const interactions = await pool.query(
            `SELECT i.id, i.timestamp, i.direction, i.duration_seconds, i.subject, i.notes, it.type_name
             FROM interactions i
             JOIN interaction_types it ON i.interaction_type_id = it.id
             WHERE i.contact_id = $1
             ORDER BY i.timestamp DESC`,
            [contactId]
        );

        res.json({
            contact: contact.rows[0],
            interactions: interactions.rows
        });
    } catch (error) {
        console.error('Error fetching contact details:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET relationship statistics for a contact
app.get('/api/contacts/:id/stats', async (req, res) => {
    try {
        const contactId = req.params.id;

        const result = await pool.query(
            `SELECT
                c.name,
                COUNT(i.id) as total_interactions,
                COUNT(CASE WHEN i.direction = 'outgoing' THEN 1 END) as outgoing_count,
                COUNT(CASE WHEN i.direction = 'incoming' THEN 1 END) as incoming_count,
                MAX(i.timestamp) as last_interaction,
                MIN(i.timestamp) as first_interaction,
                ROUND(AVG(EXTRACT(DAY FROM (MAX(i.timestamp) - MIN(i.timestamp)))
                    / NULLIF(COUNT(i.id) - 1, 0))) as avg_days_between_interactions
             FROM contacts c
             LEFT JOIN interactions i ON c.id = i.contact_id
             WHERE c.id = $1
             GROUP BY c.name`,
            [contactId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching contact stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET recent interactions
app.get('/api/interactions/recent/:limit', async (req, res) => {
    try {
        const limit = parseInt(req.params.limit) || 10;

        const result = await pool.query(
            `SELECT i.id, i.timestamp, i.direction, i.duration_seconds, i.subject,
                    c.name as contact_name, it.type_name
             FROM interactions i
             JOIN contacts c ON i.contact_id = c.id
             JOIN interaction_types it ON i.interaction_type_id = it.id
             ORDER BY i.timestamp DESC
             LIMIT $1`,
            [limit]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching recent interactions:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST new interaction
app.post('/api/interactions', async (req, res) => {
    try {
        const { contact_name, interaction_type, direction, duration_seconds, subject } = req.body;

        if (!contact_name || !interaction_type) {
            return res.status(400).json({ error: 'contact_name and interaction_type are required' });
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Get or create contact
            let contactId;
            const existing = await client.query(
                'SELECT id FROM contacts WHERE name = $1',
                [contact_name]
            );

            if (existing.rows.length > 0) {
                contactId = existing.rows[0].id;
            } else {
                const newContact = await client.query(
                    'INSERT INTO contacts (name, relationship_type) VALUES ($1, $2) RETURNING id',
                    [contact_name, 'unknown']
                );
                contactId = newContact.rows[0].id;
            }

            // Look up interaction type
            const typeResult = await client.query(
                'SELECT id FROM interaction_types WHERE type_name = $1',
                [interaction_type]
            );

            if (typeResult.rows.length === 0) {
                throw new Error(`Unknown interaction type: ${interaction_type}. Valid types: phone_call, sms, email, imessage, facetime_audio, facetime_video, calendar_meeting`);
            }

            const typeId = typeResult.rows[0].id;

            // Insert interaction
            const interaction = await client.query(
                `INSERT INTO interactions
                 (contact_id, interaction_type_id, direction, timestamp, duration_seconds, subject)
                 VALUES ($1, $2, $3, NOW(), $4, $5)
                 RETURNING *`,
                [contactId, typeId, direction || null, duration_seconds || null, subject || null]
            );

            // Update contact's last interaction date
            await client.query(
                'UPDATE contacts SET last_interaction_date = NOW(), updated_at = NOW() WHERE id = $1',
                [contactId]
            );

            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                interaction: interaction.rows[0]
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error creating interaction:', error);
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
