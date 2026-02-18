-- Personal CRM Database Schema
-- Run with: psql -U postgres -d personal_crm -f schema.sql

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    email VARCHAR(255),
    relationship_type VARCHAR(50),
    last_interaction_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Interaction types reference table
CREATE TABLE IF NOT EXISTS interaction_types (
    id SERIAL PRIMARY KEY,
    type_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT
);

-- Interactions log table
CREATE TABLE IF NOT EXISTS interactions (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    interaction_type_id INTEGER NOT NULL REFERENCES interaction_types(id),
    direction VARCHAR(20),
    timestamp TIMESTAMP NOT NULL,
    duration_seconds INTEGER,
    subject VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Relationship goals table
CREATE TABLE IF NOT EXISTS relationship_goals (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    goal_description TEXT,
    frequency_days INTEGER,
    last_reached_out_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_interactions_contact_id ON interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);

-- Insert interaction types (idempotent)
INSERT INTO interaction_types (type_name, description) VALUES
('phone_call', 'Voice call'),
('facetime_audio', 'FaceTime audio call'),
('facetime_video', 'FaceTime video call'),
('sms', 'Text message'),
('imessage', 'iMessage'),
('email', 'Email'),
('calendar_meeting', 'Calendar meeting')
ON CONFLICT (type_name) DO NOTHING;
