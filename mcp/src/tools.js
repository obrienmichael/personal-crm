const tools = [
  {
    name: 'get_contacts',
    description: 'Retrieve all contacts sorted by most recent interaction. Use this to see who is in the CRM network.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  {
    name: 'get_contact_details',
    description: 'Get detailed information about a specific contact including their full interaction history.',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: {
          type: 'number',
          description: 'The unique ID of the contact'
        }
      },
      required: ['contact_id']
    }
  },

  {
    name: 'get_overdue_contacts',
    description: 'Get contacts not interacted with in a specified number of days. Use this to answer questions like "Who haven\'t I talked to in 30 days?"',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days threshold (e.g., 30 for contacts not talked to in 30+ days)'
        }
      },
      required: ['days']
    }
  },

  {
    name: 'get_recent_interactions',
    description: 'Get the most recent interactions across all contacts. Useful for reviewing activity.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of interactions to return (e.g., 10)'
        }
      },
      required: ['limit']
    }
  },

  {
    name: 'log_interaction',
    description: 'Record a new interaction with a contact (call, text, email, meeting, etc.). Creates the contact automatically if they don\'t exist yet.',
    inputSchema: {
      type: 'object',
      properties: {
        contact_name: {
          type: 'string',
          description: 'Full name of the person'
        },
        interaction_type: {
          type: 'string',
          description: 'Type of interaction. Must be one of: phone_call, sms, email, imessage, facetime_audio, facetime_video, calendar_meeting'
        },
        direction: {
          type: 'string',
          description: 'Direction of the interaction: incoming or outgoing (optional)'
        },
        duration_seconds: {
          type: 'number',
          description: 'Duration in seconds for calls or meetings (optional)'
        },
        subject: {
          type: 'string',
          description: 'Subject line for emails or meeting title (optional)'
        }
      },
      required: ['contact_name', 'interaction_type']
    }
  },

  {
    name: 'get_contact_stats',
    description: 'Get relationship statistics for a contact: total interactions, outgoing vs incoming counts, first and last interaction dates, and average frequency.',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: {
          type: 'number',
          description: 'The unique ID of the contact'
        }
      },
      required: ['contact_id']
    }
  }
]

module.exports = tools
