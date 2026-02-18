const { Server } = require('@modelcontextprotocol/sdk/server/index.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')
const {
  CallToolRequestSchema,
  ListToolsRequestSchema
} = require('@modelcontextprotocol/sdk/types.js')

const apiClient = require('./apiClient')
const tools = require('./tools')

const server = new Server(
  {
    name: 'personal-crm-mcp',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'get_contacts': {
        const result = await apiClient.getContacts()
        if (!result.success) {
          return { content: [{ type: 'text', text: `Failed to get contacts: ${result.error}` }] }
        }
        const contacts = result.data
        if (contacts.length === 0) {
          return { content: [{ type: 'text', text: 'No contacts found in the CRM.' }] }
        }
        const lines = contacts.map(c => {
          const lastContact = c.last_interaction_date
            ? new Date(c.last_interaction_date).toLocaleDateString()
            : 'never'
          return `• ${c.name} (${c.relationship_type || 'unknown'}) — last contact: ${lastContact}`
        })
        return {
          content: [{
            type: 'text',
            text: `Found ${contacts.length} contacts:\n\n${lines.join('\n')}`
          }]
        }
      }

      case 'get_contact_details': {
        const result = await apiClient.getContactDetails(args.contact_id)
        if (!result.success) {
          return { content: [{ type: 'text', text: `Failed to get contact: ${result.error}` }] }
        }
        const { contact, interactions } = result.data
        const interactionLines = interactions.slice(0, 10).map(i => {
          const date = new Date(i.timestamp).toLocaleDateString()
          const duration = i.duration_seconds ? ` (${Math.round(i.duration_seconds / 60)} min)` : ''
          return `  - ${date}: ${i.type_name}${duration} [${i.direction || 'n/a'}]`
        })
        return {
          content: [{
            type: 'text',
            text: `${contact.name}\n` +
              `Type: ${contact.relationship_type || 'unknown'}\n` +
              `Email: ${contact.email || 'n/a'}\n` +
              `Phone: ${contact.phone_number || 'n/a'}\n` +
              `Last contact: ${contact.last_interaction_date ? new Date(contact.last_interaction_date).toLocaleDateString() : 'never'}\n\n` +
              `Recent interactions (${interactions.length} total):\n` +
              (interactionLines.length > 0 ? interactionLines.join('\n') : '  (none)')
          }]
        }
      }

      case 'get_overdue_contacts': {
        const result = await apiClient.getOverdueContacts(args.days)
        if (!result.success) {
          return { content: [{ type: 'text', text: `Failed to get overdue contacts: ${result.error}` }] }
        }
        const contacts = result.data
        if (contacts.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `No contacts overdue — everyone has been contacted within the last ${args.days} days.`
            }]
          }
        }
        const lines = contacts.map(c => {
          const days = c.days_since_contact ? `${Math.round(c.days_since_contact)} days ago` : 'never contacted'
          return `• ${c.name} (${c.relationship_type || 'unknown'}) — last contact: ${days}`
        })
        return {
          content: [{
            type: 'text',
            text: `Found ${contacts.length} contact${contacts.length === 1 ? '' : 's'} not contacted in ${args.days}+ days:\n\n${lines.join('\n')}`
          }]
        }
      }

      case 'get_recent_interactions': {
        const result = await apiClient.getRecentInteractions(args.limit)
        if (!result.success) {
          return { content: [{ type: 'text', text: `Failed to get recent interactions: ${result.error}` }] }
        }
        const interactions = result.data
        if (interactions.length === 0) {
          return { content: [{ type: 'text', text: 'No interactions logged yet.' }] }
        }
        const lines = interactions.map(i => {
          const date = new Date(i.timestamp).toLocaleDateString()
          const duration = i.duration_seconds ? ` (${Math.round(i.duration_seconds / 60)} min)` : ''
          return `• ${date}: ${i.type_name}${duration} with ${i.contact_name} [${i.direction || 'n/a'}]`
        })
        return {
          content: [{
            type: 'text',
            text: `Last ${interactions.length} interactions:\n\n${lines.join('\n')}`
          }]
        }
      }

      case 'log_interaction': {
        const result = await apiClient.logInteraction({
          contact_name: args.contact_name,
          interaction_type: args.interaction_type,
          direction: args.direction || null,
          duration_seconds: args.duration_seconds || null,
          subject: args.subject || null
        })
        if (!result.success) {
          return { content: [{ type: 'text', text: `Failed to log interaction: ${result.error}` }] }
        }
        const durationStr = args.duration_seconds
          ? ` (${Math.round(args.duration_seconds / 60)} min)`
          : ''
        const directionStr = args.direction ? ` [${args.direction}]` : ''
        return {
          content: [{
            type: 'text',
            text: `Logged ${args.interaction_type}${durationStr}${directionStr} with ${args.contact_name}.`
          }]
        }
      }

      case 'get_contact_stats': {
        const result = await apiClient.getContactStats(args.contact_id)
        if (!result.success) {
          return { content: [{ type: 'text', text: `Failed to get stats: ${result.error}` }] }
        }
        const s = result.data
        return {
          content: [{
            type: 'text',
            text: `Stats for ${s.name}:\n` +
              `Total interactions: ${s.total_interactions}\n` +
              `Outgoing: ${s.outgoing_count} | Incoming: ${s.incoming_count}\n` +
              `First interaction: ${s.first_interaction ? new Date(s.first_interaction).toLocaleDateString() : 'n/a'}\n` +
              `Last interaction: ${s.last_interaction ? new Date(s.last_interaction).toLocaleDateString() : 'n/a'}\n` +
              `Avg days between interactions: ${s.avg_days_between_interactions || 'n/a'}`
          }]
        }
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true
        }
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error executing tool: ${error.message}` }],
      isError: true
    }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Personal CRM MCP server running')
}

main().catch((error) => {
  console.error('Server error:', error)
  process.exit(1)
})
