const axios = require('axios')
require('dotenv').config()

const API_URL = process.env.API_URL || 'http://localhost:3001'

async function request(method, path, data = null) {
  try {
    const config = {
      method,
      url: `${API_URL}${path}`,
      headers: { 'Content-Type': 'application/json' }
    }
    if (data) config.data = data

    const response = await axios(config)
    return { success: true, data: response.data }
  } catch (error) {
    console.error(`API request failed [${method} ${path}]:`, error.message)
    return {
      success: false,
      error: error.response?.data?.error || error.message
    }
  }
}

async function getContacts() {
  return request('GET', '/api/contacts')
}

async function getContactDetails(contactId) {
  return request('GET', `/api/contacts/${contactId}`)
}

async function getOverdueContacts(days) {
  return request('GET', `/api/contacts/overdue/${days}`)
}

async function getRecentInteractions(limit) {
  return request('GET', `/api/interactions/recent/${limit}`)
}

async function logInteraction(data) {
  return request('POST', '/api/interactions', data)
}

async function getContactStats(contactId) {
  return request('GET', `/api/contacts/${contactId}/stats`)
}

module.exports = {
  getContacts,
  getContactDetails,
  getOverdueContacts,
  getRecentInteractions,
  logInteraction,
  getContactStats
}
