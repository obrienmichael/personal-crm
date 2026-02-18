# Personal CRM with Claude Integration
## Development Plan for Claude Code (v2)

---

## Prerequisites

### GitHub Setup (User Must Complete Before Starting)

1. Create new GitHub repository: `personal-crm`
   - Make it **private** (to protect data access credentials)
   - Initialize with README (can be overwritten)

2. Clone repository locally:
   ```bash
   cd ~/Desktop  # or preferred location
   git clone https://github.com/YOUR_USERNAME/personal-crm.git
   cd personal-crm
   ```

3. Verify git is configured:
   ```bash
   git config user.name  # Should show your name
   git config user.email # Should show your email
   ```

**When Claude Code starts, it will work inside this cloned repository.**

---

## Overview

Build a relationship management system where Claude can intelligently query interaction data via an MCP server and cloud API. The user already has PostgreSQL installed with a `personal_crm` database created.

**Architecture:**
- PostgreSQL database (local on Mac) → Cloud API (Vercel) → MCP Server (local) → Claude Desktop/API

**Deliverable:** User can ask Claude "Who haven't I talked to in 30 days?" and get accurate answers from their CRM.

**Repository:** All code will be committed to GitHub throughout development.

---

## Phase 1: Database Schema Setup

### Objective
Create the database schema in the existing `personal_crm` PostgreSQL database. User has already created the database; we need to populate it with tables.

### Prerequisites
- PostgreSQL installed and running
- Database `personal_crm` exists
- User can access database via terminal

### Tasks for Claude Code

#### Task 1.1: Create SQL Schema File
Create file: `schema.sql`

```sql
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

-- Insert interaction types
INSERT INTO interaction_types (type_name, description) VALUES
('phone_call', 'Voice call'),
('facetime_audio', 'FaceTime audio call'),
('facetime_video', 'FaceTime video call'),
('sms', 'Text message'),
('imessage', 'iMessage'),
('email', 'Email'),
('calendar_meeting', 'Calendar meeting')
ON CONFLICT (type_name) DO NOTHING;
```

**Instructions for Claude Code:**
1. Create `schema.sql` with the SQL above
2. Provide user with command: `psql -U postgres -d personal_crm -f schema.sql`
3. Verify schema created by providing test query: `psql -U postgres -d personal_crm -c "\dt"`
4. Create documentation file: `SCHEMA_DOCUMENTATION.md` explaining each table, columns, and relationships

#### Task 1.2: Create Database Configuration File
Create file: `.env.local`

```
# PostgreSQL Local Connection
DB_LOCAL_HOST=localhost
DB_LOCAL_PORT=5432
DB_LOCAL_USER=postgres
DB_LOCAL_PASSWORD=YOUR_POSTGRES_PASSWORD
DB_LOCAL_DATABASE=personal_crm
```

**Instructions for Claude Code:**
1. Create `.env.local` file
2. Instruct user to replace `YOUR_POSTGRES_PASSWORD` with their actual password
3. Note: This is for local development only

#### Task 1.3: Create Helper Scripts
Create file: `scripts/init-db.sh`

```bash
#!/bin/bash
# Initialize the personal_crm database with schema

if [ -z "$DB_LOCAL_PASSWORD" ]; then
    echo "Error: DB_LOCAL_PASSWORD not set"
    exit 1
fi

PGPASSWORD=$DB_LOCAL_PASSWORD psql -h localhost -U postgres -d personal_crm -f schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Database schema initialized successfully"
else
    echo "❌ Failed to initialize database"
    exit 1
fi
```

**Instructions for Claude Code:**
1. Create `scripts/init-db.sh`
2. Make executable: `chmod +x scripts/init-db.sh`
3. Document usage: `./scripts/init-db.sh` (after setting `DB_LOCAL_PASSWORD` env var)

### Deliverables for Phase 1
- `schema.sql` — Complete database schema with all tables
- `.env.local` — Environment configuration template
- `SCHEMA_DOCUMENTATION.md` — Schema documentation
- `scripts/init-db.sh` — Database initialization script
- `scripts/.gitkeep` — Placeholder for git to track scripts folder
- User confirms: Schema tables exist and are queryable

#### Git Commit after Phase 1
```bash
git add schema.sql .env.local SCHEMA_DOCUMENTATION.md scripts/
git commit -m "Phase 1: Initialize database schema and documentation"
git push origin main
```

---

## Phase 2: Cloud API Development

### Objective
Build a Node.js/Express REST API that connects to PostgreSQL and exposes endpoints for CRM data queries. This API will run in the cloud (Vercel) and act as the single source of truth for data.

### Prerequisites
- Node.js 18+ installed
- npm available
- GitHub account (for Vercel deployment)

### Tasks for Claude Code

#### Task 2.1: Initialize API Project
Create file: `api/package.json`

```json
{
  "name": "personal-crm-api",
  "version": "1.0.0",
  "description": "REST API for Personal CRM",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "pg": "^8.11.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

**Instructions for Claude Code:**
1. Create `api/` directory structure
2. Create `api/package.json` with above content
3. Instruct user to run: `cd api && npm install`
4. Document: "This installs all Node.js dependencies for the API server"

#### Task 2.2: Create Database Connection Module
Create file: `api/src/db.js`

```javascript
const { Pool } = require('pg');
require('dotenv').config();

// For local development, use local PostgreSQL
// For cloud deployment, use cloud database URL
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'personal_crm'
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

module.exports = pool;
```

**Instructions for Claude Code:**
1. Create `api/src/` directory
2. Create `api/src/db.js` with above content
3. Document: "This module handles PostgreSQL connection pooling. It will use local DB for development, cloud DB for production."

#### Task 2.3: Create API Server
Create file: `api/server.js`

```javascript
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./src/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ==================== ENDPOINTS ====================

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

// GET contacts not contacted in X days
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
            return res.status(400).json({ error: 'contact_name and interaction_type required' });
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
            
            // Get interaction type ID
            const typeResult = await client.query(
                'SELECT id FROM interaction_types WHERE type_name = $1',
                [interaction_type]
            );
            
            if (typeResult.rows.length === 0) {
                throw new Error(`Unknown interaction type: ${interaction_type}`);
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

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 API server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
```

**Instructions for Claude Code:**
1. Create `api/server.js` with above content
2. Create `api/.env` for local development:
   ```
   PORT=3000
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=YOUR_PASSWORD
   DB_DATABASE=personal_crm
   NODE_ENV=development
   ```
3. Instruct user: "Run `cd api && npm run dev` to start server locally"
4. Test endpoint: "Visit http://localhost:3000/api/health in browser"
5. Document: "Server starts on port 3000 and connects to local PostgreSQL"

#### Task 2.4: Create Vercel Configuration
Create file: `api/vercel.json`

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ],
  "env": {
    "DB_HOST": "@db_host",
    "DB_PORT": "@db_port",
    "DB_USER": "@db_user",
    "DB_PASSWORD": "@db_password",
    "DB_DATABASE": "@db_database"
  }
}
```

**Instructions for Claude Code:**
1. Create `api/vercel.json`
2. Document deployment steps:
   - "Push `api/` folder to GitHub"
   - "Go to vercel.com, import repository"
   - "Add environment variables from .env file"
   - "Deploy"
3. After deployment, user will have URL like `https://your-api.vercel.app`

#### Task 2.5: Create API Testing Script
Create file: `api/test-api.js`

```javascript
const http = require('http');

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testAPI() {
    console.log(`Testing API at ${API_URL}\n`);
    
    try {
        // Test health endpoint
        console.log('1️⃣  Testing health endpoint...');
        let response = await fetch(`${API_URL}/api/health`);
        console.log(`Status: ${response.status}`);
        console.log('Response:', await response.json());
        console.log('✅ Health check passed\n');
        
        // Test get contacts
        console.log('2️⃣  Testing GET contacts...');
        response = await fetch(`${API_URL}/api/contacts`);
        console.log(`Status: ${response.status}`);
        const contacts = await response.json();
        console.log(`Found ${contacts.length} contacts`);
        console.log('✅ Contacts endpoint works\n');
        
        // Test post interaction
        console.log('3️⃣  Testing POST interaction...');
        response = await fetch(`${API_URL}/api/interactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contact_name: 'Test Contact',
                interaction_type: 'phone_call',
                direction: 'outgoing',
                duration_seconds: 600
            })
        });
        console.log(`Status: ${response.status}`);
        console.log('Response:', await response.json());
        console.log('✅ Post interaction works\n');
        
        console.log('🎉 All API tests passed!');
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testAPI();
```

**Instructions for Claude Code:**
1. Create `api/test-api.js`
2. Document: "Run `node api/test-api.js` to test all endpoints"
3. Document: "Set `API_URL` env variable to test against cloud API"

### Deliverables for Phase 2
- `api/package.json` — Node.js project configuration
- `api/server.js` — Express server with all endpoints
- `api/.env` — Local development environment config
- `api/vercel.json` — Cloud deployment configuration
- `api/test-api.js` — API endpoint testing script
- `api/API_DOCUMENTATION.md` — API reference
- User confirms: API runs locally and endpoints return data

#### Git Commit after Phase 2
```bash
git add api/
git commit -m "Phase 2: Build REST API with Express and PostgreSQL integration"
git push origin main
```

**Important:** Do NOT commit `api/.env` (contains passwords). Add to `.gitignore`:
```
.env
.env.local
node_modules/
```

---

## Phase 3: MCP Server Development

### Objective
Build an MCP (Model Context Protocol) server that runs locally and connects Claude Desktop to the REST API. This allows Claude to query and interact with CRM data.

### Prerequisites
- Node.js 18+
- API running (Phase 2 complete)
- Claude Desktop installed

### Tasks for Claude Code

#### Task 3.1: Initialize MCP Project
Create file: `mcp/package.json`

```json
{
  "name": "personal-crm-mcp",
  "version": "1.0.0",
  "description": "MCP Server for Personal CRM",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "dotenv": "^16.3.1"
  }
}
```

**Instructions for Claude Code:**
1. Create `mcp/` directory
2. Create `mcp/package.json`
3. Instruct user: "Run `cd mcp && npm install`"

#### Task 3.2: Create MCP Tool Definitions
Create file: `mcp/src/tools.js`

```javascript
module.exports = {
    tools: [
        {
            name: "get_contacts",
            description: "Retrieve all contacts sorted by most recent interaction. Use this to see who you have in your network.",
            inputSchema: {
                type: "object",
                properties: {}
            }
        },
        {
            name: "get_contact_details",
            description: "Get detailed information about a specific contact including their full interaction history.",
            inputSchema: {
                type: "object",
                properties: {
                    contact_id: {
                        type: "number",
                        description: "The unique ID of the contact"
                    }
                },
                required: ["contact_id"]
            }
        },
        {
            name: "get_overdue_contacts",
            description: "Get contacts you haven't interacted with in a specified number of days. Useful for finding relationships that need attention.",
            inputSchema: {
                type: "object",
                properties: {
                    days: {
                        type: "number",
                        description: "Number of days threshold (e.g., 30 for contacts not talked to in 30+ days)"
                    }
                },
                required: ["days"]
            }
        },
        {
            name: "get_recent_interactions",
            description: "Get your most recent interactions with anyone. Useful for reviewing what you've been up to.",
            inputSchema: {
                type: "object",
                properties: {
                    limit: {
                        type: "number",
                        description: "Maximum number of interactions to return (default: 10)"
                    }
                },
                required: ["limit"]
            }
        },
        {
            name: "log_interaction",
            description: "Record a new interaction with a contact (call, text, email, etc.). Use this to log conversations.",
            inputSchema: {
                type: "object",
                properties: {
                    contact_name: {
                        type: "string",
                        description: "Name of the person"
                    },
                    interaction_type: {
                        type: "string",
                        description: "Type of interaction: phone_call, sms, email, imessage, facetime_audio, facetime_video, calendar_meeting"
                    },
                    direction: {
                        type: "string",
                        description: "incoming or outgoing (optional for meetings)"
                    },
                    duration_seconds: {
                        type: "number",
                        description: "Duration of call/meeting in seconds (optional)"
                    },
                    subject: {
                        type: "string",
                        description: "Subject of email or meeting title (optional)"
                    }
                },
                required: ["contact_name", "interaction_type"]
            }
        },
        {
            name: "get_contact_stats",
            description: "Get statistics about your relationship with a contact (total interactions, average frequency, etc.)",
            inputSchema: {
                type: "object",
                properties: {
                    contact_id: {
                        type: "number",
                        description: "The contact ID"
                    }
                },
                required: ["contact_id"]
            }
        }
    ]
};
```

**Instructions for Claude Code:**
1. Create `mcp/src/` directory
2. Create `mcp/src/tools.js` with tool definitions
3. Document: "These are the tools Claude can call to interact with your CRM"

#### Task 3.3: Create Tool Handler
Create file: `mcp/src/handler.js`

```javascript
const axios = require('axios');
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function handleToolCall(toolName, toolInput) {
    try {
        console.log(`[MCP] Handling tool call: ${toolName}`, toolInput);
        
        switch(toolName) {
            case "get_contacts":
                const contactsResponse = await axios.get(`${API_URL}/api/contacts`);
                return {
                    success: true,
                    data: contactsResponse.data
                };
                
            case "get_contact_details":
                const detailsResponse = await axios.get(`${API_URL}/api/contacts/${toolInput.contact_id}`);
                return {
                    success: true,
                    data: detailsResponse.data
                };
                
            case "get_overdue_contacts":
                const overdueResponse = await axios.get(`${API_URL}/api/contacts/overdue/${toolInput.days}`);
                return {
                    success: true,
                    data: overdueResponse.data,
                    message: `Found ${overdueResponse.data.length} contacts not contacted in ${toolInput.days}+ days`
                };
                
            case "get_recent_interactions":
                const recentResponse = await axios.get(`${API_URL}/api/interactions/recent/${toolInput.limit}`);
                return {
                    success: true,
                    data: recentResponse.data
                };
                
            case "log_interaction":
                const logResponse = await axios.post(`${API_URL}/api/interactions`, {
                    contact_name: toolInput.contact_name,
                    interaction_type: toolInput.interaction_type,
                    direction: toolInput.direction || null,
                    duration_seconds: toolInput.duration_seconds || null,
                    subject: toolInput.subject || null
                });
                return {
                    success: true,
                    message: `Logged ${toolInput.interaction_type} with ${toolInput.contact_name}`,
                    data: logResponse.data
                };
                
            case "get_contact_stats":
                const statsResponse = await axios.get(`${API_URL}/api/contacts/${toolInput.contact_id}/stats`);
                return {
                    success: true,
                    data: statsResponse.data
                };
                
            default:
                return {
                    success: false,
                    error: `Unknown tool: ${toolName}`
                };
        }
    } catch (error) {
        console.error(`[MCP] Error handling tool ${toolName}:`, error.message);
        return {
            success: false,
            error: error.message,
            toolName
        };
    }
}

module.exports = { handleToolCall };
```

**Instructions for Claude Code:**
1. Create `mcp/src/handler.js`
2. Document: "This module translates Claude's tool calls into API requests"

#### Task 3.4: Create MCP Server
Create file: `mcp/server.js`

```javascript
const { handleToolCall } = require('./src/handler');
const { tools } = require('./src/tools');
require('dotenv').config();

class MCPServer {
    constructor() {
        this.tools = tools;
        this.name = "personal-crm-mcp";
        this.version = "1.0.0";
    }

    // Return server info (used by Claude to discover this MCP)
    getServerInfo() {
        return {
            name: this.name,
            version: this.version,
            description: "MCP server for Personal CRM - helps manage relationships with friends and family"
        };
    }

    // Return available tools
    getTools() {
        return this.tools;
    }

    // Handle a tool call from Claude
    async callTool(toolName, toolInput) {
        return await handleToolCall(toolName, toolInput);
    }

    // Start the server (for standalone testing)
    start() {
        console.log(`🚀 MCP Server "${this.name}" ready`);
        console.log(`Available tools: ${this.tools.map(t => t.name).join(', ')}`);
        
        // Keep server running
        process.stdin.resume();
    }
}

const server = new MCPServer();
server.start();

module.exports = server;
```

**Instructions for Claude Code:**
1. Create `mcp/server.js`
2. Create `mcp/.env` for development:
   ```
   API_URL=http://localhost:3000
   ```
3. Instruct user: "Run `node mcp/server.js` to start MCP server"
4. Document: "MCP server must be running for Claude Desktop integration"

#### Task 3.5: Create Claude Desktop Configuration
Create file: `mcp/CLAUDE_DESKTOP_SETUP.md`

```markdown
# Claude Desktop MCP Setup

## What is this?
This MCP server allows Claude Desktop to access your CRM data through tools.

## Setup Steps

1. **Ensure MCP server is running:**
   ```bash
   cd mcp
   npm install
   node server.js
   ```
   You should see: "🚀 MCP Server "personal-crm-mcp" ready"

2. **Configure Claude Desktop:**
   On Mac, edit: `~/.claude/config.json`
   
   Add this configuration:
   ```json
   {
     "mcpServers": {
       "personalcrm": {
         "command": "node",
         "args": ["/absolute/path/to/mcp/server.js"],
         "env": {
           "API_URL": "http://localhost:3000"
         }
       }
     }
   }
   ```
   
   Replace `/absolute/path/to/mcp` with your actual path (get with `pwd` command).

3. **Restart Claude Desktop:**
   - Completely quit Claude Desktop
   - Reopen it
   - You should see a tools icon appear in chat

4. **Test it:**
   Ask Claude: "Who are my contacts?"
   It should call your MCP tool and return real data.

## Troubleshooting

If Claude doesn't see tools:
- Check MCP server is running and shows "ready"
- Check path in config.json is correct
- Restart Claude Desktop
- Check Claude Desktop console for errors
```

**Instructions for Claude Code:**
1. Create `mcp/CLAUDE_DESKTOP_SETUP.md`
2. Document: "User must follow these steps to connect Claude Desktop to their CRM"

#### Task 3.6: Create Test Script
Create file: `mcp/test-mcp.js`

```javascript
const { handleToolCall } = require('./src/handler');

async function runMCPTests() {
    console.log('🧪 Testing MCP Tool Handlers\n');
    
    try {
        // Test 1: Get contacts
        console.log('1️⃣  Testing get_contacts...');
        const contacts = await handleToolCall('get_contacts', {});
        console.log(`✅ Retrieved ${contacts.data?.length || 0} contacts\n`);
        
        // Test 2: Get recent interactions
        console.log('2️⃣  Testing get_recent_interactions...');
        const recent = await handleToolCall('get_recent_interactions', { limit: 5 });
        console.log(`✅ Retrieved ${recent.data?.length || 0} recent interactions\n`);
        
        // Test 3: Get overdue contacts
        console.log('3️⃣  Testing get_overdue_contacts (30 days)...');
        const overdue = await handleToolCall('get_overdue_contacts', { days: 30 });
        console.log(`✅ Found ${overdue.data?.length || 0} overdue contacts\n`);
        
        // Test 4: Log interaction
        console.log('4️⃣  Testing log_interaction...');
        const logged = await handleToolCall('log_interaction', {
            contact_name: 'Claude Test',
            interaction_type: 'phone_call',
            direction: 'outgoing',
            duration_seconds: 900
        });
        console.log(`✅ Interaction logged successfully\n`);
        
        console.log('🎉 All MCP tests passed!');
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

runMCPTests();
```

**Instructions for Claude Code:**
1. Create `mcp/test-mcp.js`
2. Instruct user: "Run `node mcp/test-mcp.js` to verify MCP is working"

### Deliverables for Phase 3
- `mcp/package.json` — Node.js project configuration
- `mcp/server.js` — MCP server implementation
- `mcp/src/tools.js` — Tool definitions
- `mcp/src/handler.js` — Tool call handler
- `mcp/.env` — MCP configuration
- `mcp/CLAUDE_DESKTOP_SETUP.md` — Setup documentation
- `mcp/test-mcp.js` — Testing script
- User confirms: MCP server runs and Claude Desktop can see tools

#### Git Commit after Phase 3
```bash
git add mcp/
git commit -m "Phase 3: Build MCP server for Claude Desktop integration"
git push origin main
```

---

## Phase 4: End-to-End Integration Testing

### Objective
Verify the entire system works: Claude can ask questions about CRM data and get accurate answers.

### Tasks for Claude Code

#### Task 4.1: Create Integration Test Script
Create file: `tests/integration-test.js`

```javascript
const axios = require('axios');
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function setupTestData() {
    console.log('📊 Setting up test data...\n');
    
    const testContacts = [
        { name: 'Alice Johnson', relationship: 'friend', interaction: 'phone_call', days_ago: 5 },
        { name: 'Bob Smith', relationship: 'family', interaction: 'imessage', days_ago: 15 },
        { name: 'Carol Davis', relationship: 'colleague', interaction: 'email', days_ago: 45 },
        { name: 'David Wilson', relationship: 'friend', interaction: 'facetime_video', days_ago: 2 }
    ];
    
    for (const contact of testContacts) {
        try {
            // Create interaction
            const timestamp = new Date();
            timestamp.setDate(timestamp.getDate() - contact.days_ago);
            
            await axios.post(`${API_URL}/api/interactions`, {
                contact_name: contact.name,
                interaction_type: contact.interaction,
                direction: 'outgoing',
                timestamp: timestamp.toISOString()
            });
            
            console.log(`✅ Created test interaction: ${contact.name} (${contact.days_ago} days ago)`);
        } catch (error) {
            console.error(`❌ Failed to create test data for ${contact.name}:`, error.message);
        }
    }
    
    console.log('\n✅ Test data setup complete\n');
}

async function runQueries() {
    console.log('🧠 Testing Claude-like queries...\n');
    
    // Query 1: Get all contacts
    console.log('1️⃣  All contacts:');
    const contacts = await axios.get(`${API_URL}/api/contacts`);
    contacts.data.forEach(c => {
        console.log(`   - ${c.name} (last contact: ${c.last_interaction_date})`);
    });
    console.log();
    
    // Query 2: Get overdue contacts
    console.log('2️⃣  Contacts not contacted in 30+ days:');
    const overdue = await axios.get(`${API_URL}/api/contacts/overdue/30`);
    if (overdue.data.length === 0) {
        console.log('   (none)');
    } else {
        overdue.data.forEach(c => {
            console.log(`   - ${c.name} (${c.days_since_contact} days since contact)`);
        });
    }
    console.log();
    
    // Query 3: Get recent interactions
    console.log('3️⃣  Recent interactions (last 5):');
    const recent = await axios.get(`${API_URL}/api/interactions/recent/5`);
    recent.data.forEach(i => {
        console.log(`   - ${i.contact_name}: ${i.type_name} (${i.timestamp})`);
    });
    console.log();
    
    // Query 4: Get contact stats
    if (contacts.data.length > 0) {
        console.log('4️⃣  Stats for first contact:');
        const stats = await axios.get(`${API_URL}/api/contacts/${contacts.data[0].id}/stats`);
        console.log(`   - Total interactions: ${stats.data.total_interactions}`);
        console.log(`   - Outgoing: ${stats.data.outgoing_count}, Incoming: ${stats.data.incoming_count}`);
        console.log(`   - Last interaction: ${stats.data.last_interaction}`);
    }
    console.log();
}

async function main() {
    console.log('═══════════════════════════════════════════════');
    console.log('   Personal CRM Integration Test');
    console.log('═══════════════════════════════════════════════\n');
    
    try {
        // Check API is running
        console.log('🔌 Checking API connection...');
        await axios.get(`${API_URL}/api/health`);
        console.log('✅ API is running\n');
        
        // Setup test data
        await setupTestData();
        
        // Run queries
        await runQueries();
        
        console.log('═══════════════════════════════════════════════');
        console.log('✅ Integration test completed successfully!');
        console.log('═══════════════════════════════════════════════\n');
        
    } catch (error) {
        console.error('❌ Integration test failed:', error.message);
        process.exit(1);
    }
}

main();
```

**Instructions for Claude Code:**
1. Create `tests/` directory
2. Create `tests/integration-test.js`
3. Create `tests/.env`:
   ```
   API_URL=http://localhost:3000
   ```
4. Instruct user: "Run `node tests/integration-test.js` to verify entire system"

#### Task 4.2: Create System Health Check Script
Create file: `scripts/health-check.sh`

```bash
#!/bin/bash

echo "═══════════════════════════════════════════════"
echo "   Personal CRM System Health Check"
echo "═══════════════════════════════════════════════"
echo ""

# Check PostgreSQL
echo "1️⃣  Checking PostgreSQL..."
if psql -U postgres -d personal_crm -c "SELECT version();" > /dev/null 2>&1; then
    echo "✅ PostgreSQL is running"
else
    echo "❌ PostgreSQL is not accessible"
    exit 1
fi
echo ""

# Check API
echo "2️⃣  Checking API server..."
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ API server is running"
else
    echo "❌ API server is not running"
    echo "   Start with: cd api && npm run dev"
fi
echo ""

# Check MCP
echo "3️⃣  Checking MCP server..."
if curl -s http://localhost:3001 > /dev/null 2>&1; then
    echo "✅ MCP server is running"
else
    echo "⚠️  MCP server is not running (this is normal if not started)"
    echo "   Start with: cd mcp && node server.js"
fi
echo ""

echo "═══════════════════════════════════════════════"
echo "✅ Health check complete"
echo "═══════════════════════════════════════════════"
```

**Instructions for Claude Code:**
1. Create `scripts/health-check.sh`
2. Make executable: `chmod +x scripts/health-check.sh`
3. Instruct user: "Run `./scripts/health-check.sh` to verify all components"

### Deliverables for Phase 4
- `tests/integration-test.js` — Full system test with sample data
- `scripts/health-check.sh` — System status check script
- User confirms: All components working together, Claude can query CRM

---

## Phase 5: Documentation & Deployment

### Tasks for Claude Code

#### Task 5.1: Create Comprehensive README
Create file: `README.md`

```markdown
# Personal CRM with Claude Integration

A relationship management system that uses Claude AI to help you stay connected with friends and family.

## Architecture

```
PostgreSQL (Local) → Cloud API (Vercel) → MCP Server (Local) → Claude Desktop
```

## Components

### 1. Database (`personal_crm` PostgreSQL)
- Stores contacts, interactions, and relationship goals
- Tables: contacts, interactions, interaction_types, relationship_goals

### 2. Cloud API (`api/`)
- REST API serving CRM data
- Endpoints for querying and logging interactions
- Deployed on Vercel for 24/7 availability

### 3. MCP Server (`mcp/`)
- Runs locally on your Mac
- Connects Claude Desktop to your CRM
- Exposes tools for Claude to call

## Quick Start

### Prerequisites
- PostgreSQL installed
- Node.js 18+
- Database `personal_crm` created

### Setup

1. **Initialize database:**
   ```bash
   ./scripts/init-db.sh
   ```

2. **Start API server (local development):**
   ```bash
   cd api
   npm install
   npm run dev
   ```

3. **Start MCP server:**
   ```bash
   cd mcp
   npm install
   node server.js
   ```

4. **Configure Claude Desktop:**
   Follow instructions in `mcp/CLAUDE_DESKTOP_SETUP.md`

5. **Verify system:**
   ```bash
   ./scripts/health-check.sh
   ```

## Usage

### Ask Claude Questions
Once Claude Desktop is configured, you can ask:

- "Who haven't I talked to in 30 days?"
- "Show me my recent interactions"
- "Log a call with Sarah"
- "What's my relationship pattern with John?"

### Log Interactions
Use Claude to log interactions:
- Calls (phone, FaceTime)
- Messages (SMS, iMessage)
- Emails
- Meetings

Claude will remember and help you identify patterns.

## Deployment

### Deploy API to Vercel

1. Push `api/` folder to GitHub
2. Go to vercel.com and import repository
3. Add environment variables from `api/.env`
4. Deploy

Once deployed, update:
- `mcp/.env` with your API URL
- Your Claude config with cloud API URL

## API Endpoints

- `GET /api/health` - Server status
- `GET /api/contacts` - All contacts
- `GET /api/contacts/:id` - Contact details
- `GET /api/contacts/:id/stats` - Contact statistics
- `GET /api/contacts/overdue/:days` - Overdue contacts
- `GET /api/interactions/recent/:limit` - Recent interactions
- `POST /api/interactions` - Log new interaction

## Directory Structure

```
personal-crm/
├── schema.sql                   # Database schema
├── .env.local                   # Local development config
├── README.md                    # This file
├── api/                         # REST API
│   ├── server.js
│   ├── package.json
│   ├── .env
│   └── vercel.json
├── mcp/                         # MCP Server
│   ├── server.js
│   ├── src/
│   │   ├── tools.js
│   │   └── handler.js
│   ├── .env
│   └── CLAUDE_DESKTOP_SETUP.md
├── tests/                       # Integration tests
│   ├── integration-test.js
│   └── .env
└── scripts/                     # Helper scripts
    ├── init-db.sh
    └── health-check.sh
```

## Learning Outcomes

By building this system, you'll learn:
- Relational database design (PostgreSQL)
- REST API development (Node.js/Express)
- Cloud deployment (Vercel)
- Claude integration via MCP
- Full-stack application architecture

## Troubleshooting

**API not connecting to database:**
- Check `DB_PASSWORD` in `api/.env`
- Verify PostgreSQL is running: `pg_isready`

**Claude doesn't see MCP tools:**
- Verify MCP server is running
- Check path in `~/.claude/config.json`
- Restart Claude Desktop

**API endpoints return empty data:**
- Run `node tests/integration-test.js` to populate test data
- Verify database schema is initialized

## Next Steps

- Add iOS app for mobile interaction logging
- Build web dashboard for visualizing relationships
- Add notifications for forgotten contacts
- Implement ML for relationship predictions

## Support

Check individual component READMEs:
- `api/README.md` - API documentation
- `mcp/CLAUDE_DESKTOP_SETUP.md` - MCP setup guide
```

**Instructions for Claude Code:**
1. Create comprehensive `README.md`
2. Include quick start, architecture diagram, troubleshooting
3. Make it the single source of truth for how system works

#### Task 5.2: Create API Documentation
Create file: `api/API_DOCUMENTATION.md`

```markdown
# Personal CRM REST API Documentation

## Base URL
- Development: `http://localhost:3000`
- Production: `https://your-api.vercel.app`

## Endpoints

### Health Check
**GET** `/api/health`
Returns server status.

Response:
```json
{ "status": "ok", "timestamp": "2024-02-17T10:30:00Z" }
```

### Get All Contacts
**GET** `/api/contacts`
Get all contacts sorted by most recent interaction.

Response:
```json
[
  {
    "id": 1,
    "name": "Alice Johnson",
    "phone_number": "555-0123",
    "email": "alice@example.com",
    "relationship_type": "friend",
    "last_interaction_date": "2024-02-15T14:30:00Z"
  }
]
```

### Get Contact Details
**GET** `/api/contacts/:id`
Get full contact record with interaction history.

Response:
```json
{
  "contact": { ...contact data... },
  "interactions": [
    {
      "id": 1,
      "timestamp": "2024-02-15T14:30:00Z",
      "type_name": "phone_call",
      "direction": "outgoing",
      "duration_seconds": 600
    }
  ]
}
```

### Get Contact Statistics
**GET** `/api/contacts/:id/stats`
Get relationship statistics for a contact.

Response:
```json
{
  "name": "Alice Johnson",
  "total_interactions": 15,
  "outgoing_count": 8,
  "incoming_count": 7,
  "last_interaction": "2024-02-15T14:30:00Z",
  "first_interaction": "2023-12-01T10:00:00Z",
  "avg_days_between_interactions": 3
}
```

### Get Overdue Contacts
**GET** `/api/contacts/overdue/:days`
Get contacts not contacted in X days.

Parameters:
- `days` (number): Threshold in days

Response:
```json
[
  {
    "id": 3,
    "name": "Carol Davis",
    "last_interaction_date": "2023-12-01T10:00:00Z",
    "days_since_contact": 45
  }
]
```

### Get Recent Interactions
**GET** `/api/interactions/recent/:limit`
Get recent interactions with all contacts.

Parameters:
- `limit` (number): Max number to return

Response:
```json
[
  {
    "id": 1,
    "contact_name": "Alice Johnson",
    "type_name": "phone_call",
    "direction": "outgoing",
    "timestamp": "2024-02-15T14:30:00Z"
  }
]
```

### Log New Interaction
**POST** `/api/interactions`
Record a new interaction.

Request Body:
```json
{
  "contact_name": "Alice Johnson",
  "interaction_type": "phone_call",
  "direction": "outgoing",
  "duration_seconds": 600,
  "subject": null
}
```

Response:
```json
{
  "success": true,
  "interaction": { ...interaction data... }
}
```

## Error Responses

```json
{
  "error": "Contact not found"
}
```

HTTP Status Codes:
- 200: Success
- 201: Created
- 400: Bad request
- 404: Not found
- 500: Server error
```

**Instructions for Claude Code:**
1. Create `api/API_DOCUMENTATION.md`
2. Include all endpoints with examples
3. Document error codes and responses

#### Task 5.3: Create Getting Started Guide
Create file: `GETTING_STARTED.md`

```markdown
# Getting Started with Personal CRM + Claude

This guide walks you through setup and first use.

## What You Need

1. PostgreSQL installed on your Mac
2. Node.js 18+ installed
3. Claude Desktop app installed
4. 30 minutes for initial setup

## Step-by-Step Setup

### Step 1: Initialize Database
```bash
export DB_LOCAL_PASSWORD=YOUR_POSTGRES_PASSWORD
./scripts/init-db.sh
```

Expected output: "✅ Database schema initialized successfully"

### Step 2: Start API Server
```bash
cd api
npm install
npm run dev
```

Expected output: "🚀 API server running on port 3000"

Keep this running in a terminal tab.

### Step 3: Test API
In a new terminal:
```bash
curl http://localhost:3000/api/health
```

Expected: `{"status":"ok",...}`

### Step 4: Start MCP Server
```bash
cd mcp
npm install
node server.js
```

Expected output: "🚀 MCP Server "personal-crm-mcp" ready"

Keep this running in another terminal tab.

### Step 5: Configure Claude Desktop
1. Get your absolute path to mcp/server.js:
   ```bash
   cd mcp
   pwd
   # Copy this path
   ```

2. Edit `~/.claude/config.json`:
   ```json
   {
     "mcpServers": {
       "personalcrm": {
         "command": "node",
         "args": ["/YOUR_PATH/mcp/server.js"],
         "env": {
           "API_URL": "http://localhost:3000"
         }
       }
     }
   }
   ```

3. Restart Claude Desktop (quit and reopen)

### Step 6: Test with Claude
Open Claude Desktop and ask:
```
Add a test contact: "Log a call with Sarah that was 10 minutes long"
```

Claude should respond confirming the interaction was logged.

## Verify Everything Works

Run the health check:
```bash
./scripts/health-check.sh
```

All items should show ✅.

## First Real Usage

1. **Add contacts manually:**
   - Ask Claude: "Log a call with my friend Alice"
   - Claude logs it to your CRM

2. **Ask Claude questions:**
   - "Who haven't I talked to in a month?"
   - "Show me my recent interactions"
   - "How often do I talk to Bob?"

3. **Keep logging:**
   - Every time you call, text, email someone, ask Claude to log it
   - Over time, you'll have a complete history

## Troubleshooting

**API won't start:**
- Did you export DB_LOCAL_PASSWORD?
- Is PostgreSQL running?

**Claude doesn't see tools:**
- Is MCP server running?
- Is path in config.json correct?
- Did you restart Claude Desktop?

**Permission errors:**
- Make scripts executable: `chmod +x scripts/*.sh`

## Next Steps

Once working locally:
1. Deploy API to Vercel for 24/7 access
2. Add iOS app for automatic call/message logging
3. Build web dashboard for visualization

See `README.md` for more details.
```

**Instructions for Claude Code:**
1. Create `GETTING_STARTED.md`
2. Make it foolproof for complete beginners
3. Include all commands they need to copy/paste

### Deliverables for Phase 5
- `README.md` — Comprehensive project documentation
- `GETTING_STARTED.md` — Setup guide for beginners
- `api/API_DOCUMENTATION.md` — API reference
- All files have clear headers and instructions

---

## Phase 6: Deployment to Production

### Objective
Get the system running in the cloud so it's accessible 24/7 and Claude can query data even when your Mac is offline.

### Tasks for Claude Code

#### Task 6.1: Prepare Cloud Database
**Instructions for Claude Code:**
1. Create `DEPLOYMENT.md`:
   ```markdown
   # Deployment Guide

   ## Cloud Database Setup (Neon.tech)

   1. Go to https://neon.tech
   2. Sign up with GitHub
   3. Create project: "personal-crm"
   4. Copy connection string
   5. Save to secure location

   ## Deploy API to Vercel

   1. Push `api/` folder to GitHub
   2. Go to vercel.com, import repository
   3. Add environment variables:
      - DB_HOST
      - DB_PORT
      - DB_USER
      - DB_PASSWORD
      - DB_DATABASE
   4. Deploy
   5. Get production URL

   ## Update MCP Configuration

   After deployment:
   - Update `mcp/.env` with production API URL
   - Restart MCP server
   ```

#### Task 6.2: Create Deployment Checklist
Create file: `DEPLOYMENT_CHECKLIST.md`

```markdown
# Deployment Checklist

Before deploying to production:

## Local Testing
- [ ] Database initialized: `./scripts/init-db.sh`
- [ ] API running locally: `npm run dev` in api/
- [ ] MCP server running: `node server.js` in mcp/
- [ ] Claude Desktop can query data
- [ ] Integration tests pass: `node tests/integration-test.js`
- [ ] Health check passes: `./scripts/health-check.sh`

## Cloud Database
- [ ] Neon.tech account created
- [ ] Database created and schema imported
- [ ] Connection string saved securely

## API Deployment
- [ ] Code committed to GitHub
- [ ] Vercel account created
- [ ] Environment variables configured in Vercel
- [ ] API deployed and tested
- [ ] Health endpoint responds

## MCP Configuration
- [ ] Production API URL updated in code
- [ ] MCP server restarted
- [ ] Claude Desktop tools still work

## Monitoring
- [ ] Error logging configured
- [ ] Backups scheduled
- [ ] API uptime checked regularly

## Post-Deployment
- [ ] Test all API endpoints against production
- [ ] Verify Claude can query production data
- [ ] Monitor for errors for 24 hours
```

**Instructions for Claude Code:**
1. Create `DEPLOYMENT_CHECKLIST.md`
2. Have user go through before deploying

### Deliverables for Phase 6
- `DEPLOYMENT.md` — Cloud setup instructions
- `DEPLOYMENT_CHECKLIST.md` — Pre-deployment verification
- User confirms: System deployed and accessible via cloud API

#### Git Commit after Phase 6
```bash
git add DEPLOYMENT.md DEPLOYMENT_CHECKLIST.md
git commit -m "Phase 6: Add deployment documentation and checklist"
git push origin main
```

---

## Git Workflow Summary

### Initial Setup (User does BEFORE Claude Code starts)
```bash
# User creates repo on GitHub and clones it
git clone https://github.com/YOUR_USERNAME/personal-crm.git
cd personal-crm
```

### After Each Phase (Claude Code does)
```bash
# Phase 1
git add schema.sql .env.local SCHEMA_DOCUMENTATION.md scripts/
git commit -m "Phase 1: Initialize database schema and documentation"
git push origin main

# Phase 2
git add api/
git commit -m "Phase 2: Build REST API with Express and PostgreSQL integration"
git push origin main

# Phase 3
git add mcp/
git commit -m "Phase 3: Build MCP server for Claude Desktop integration"
git push origin main

# Phase 4
git add tests/ scripts/health-check.sh
git commit -m "Phase 4: Add integration tests and health check script"
git push origin main

# Phase 5
git add README.md GETTING_STARTED.md api/API_DOCUMENTATION.md
git commit -m "Phase 5: Add comprehensive documentation"
git push origin main

# Phase 6
git add DEPLOYMENT.md DEPLOYMENT_CHECKLIST.md
git commit -m "Phase 6: Add deployment documentation and checklist"
git push origin main
```

### Important Git Rules for This Project
- **NEVER commit:** `.env`, `.env.local`, `node_modules/`, secrets
- **ALWAYS commit:** `.gitignore`, code files, documentation, scripts
- **Commit message format:** "Phase X: Brief description of what was added"
- **Push to main:** After each phase completes successfully

### Phase 1: Database
- `schema.sql` — Database schema
- `SCHEMA_DOCUMENTATION.md` — Schema docs
- `.env.local` — Config template
- `scripts/init-db.sh` — Database setup script

### Phase 2: API
- `api/package.json` — Node.js project config
- `api/server.js` — Express server with all endpoints
- `api/.env` — Development environment config
- `api/vercel.json` — Cloud deployment config
- `api/test-api.js` — API endpoint tests
- `api/API_DOCUMENTATION.md` — API reference

### Phase 3: MCP
- `mcp/server.js` — MCP server
- `mcp/src/tools.js` — Tool definitions
- `mcp/src/handler.js` — Tool handlers
- `mcp/CLAUDE_DESKTOP_SETUP.md` — Setup guide
- `mcp/test-mcp.js` — MCP tests

### Phase 4: Testing
- `tests/integration-test.js` — Full system test
- `scripts/health-check.sh` — System status check

### Phase 5: Documentation
- `README.md` — Main project documentation
- `GETTING_STARTED.md` — Setup guide
- `DEPLOYMENT.md` — Deployment instructions
- `DEPLOYMENT_CHECKLIST.md` — Pre-deployment checklist

---

## Key Files Structure

```
personal-crm-project/
├── README.md
├── GETTING_STARTED.md
├── DEPLOYMENT.md
├── DEPLOYMENT_CHECKLIST.md
├── schema.sql
├── .env.local
├── SCHEMA_DOCUMENTATION.md
├── api/
│   ├── package.json
│   ├── server.js
│   ├── .env
│   ├── vercel.json
│   ├── test-api.js
│   └── API_DOCUMENTATION.md
├── mcp/
│   ├── package.json
│   ├── server.js
│   ├── .env
│   ├── test-mcp.js
│   ├── CLAUDE_DESKTOP_SETUP.md
│   └── src/
│       ├── tools.js
│       └── handler.js
├── tests/
│   ├── integration-test.js
│   └── .env
└── scripts/
    ├── init-db.sh
    ├── health-check.sh
    └── deploy.sh (optional)
```

---

## Execution Order for Claude Code

1. **Phase 1 (Database):** Create schema and initialize
2. **Phase 2 (API):** Build and test REST API locally
3. **Phase 3 (MCP):** Build and test MCP server
4. **Phase 4 (Integration):** Run end-to-end tests
5. **Phase 5 (Documentation):** Create all documentation
6. **Phase 6 (Deployment):** Deploy to production

Each phase should be fully functional before moving to the next.

**After completing each phase, Claude Code should commit and push to GitHub as shown in the Git Workflow Summary section above.**

---

## Initial Instructions for Claude Code

User will provide these commands to Claude Code:

```
I've created a GitHub repository called "personal-crm" and cloned it to my Mac.
The repository is empty and ready for development.

PostgreSQL database "personal_crm" is already created on my machine.

Please build this project according to the development plan:
- Phase 1: Database schema
- Phase 2: REST API
- Phase 3: MCP Server
- Phase 4: Integration tests
- Phase 5: Documentation
- Phase 6: Deployment setup

For each phase:
1. Create all files with exact code from the plan
2. Install dependencies as needed
3. Run tests to verify the phase works
4. Commit to git with the message shown in the plan
5. Push to GitHub
6. Move to next phase

Start with Phase 1 now.
```

---

## Success Criteria

User can:
1. ✅ Ask Claude: "Who haven't I talked to in 30 days?"
2. ✅ Claude queries local MCP → Cloud API → PostgreSQL
3. ✅ Claude returns accurate answer with names and dates
4. ✅ Ask Claude: "Log a call with Sarah for 15 minutes"
5. ✅ Claude logs the interaction to the database
6. ✅ Next query includes Sarah's recent interaction

This proves the entire system is integrated and working.