const API_BASE = '/api'

export async function parseIntent(text, options = {}) {
  const response = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent: text, ...options })
  })
  if (!response.ok) throw new Error(`API error: ${response.status}`)
  return response.json()
}

export async function getAssets(intentId) {
  const response = await fetch(`${API_BASE}/assets/${intentId}`)
  if (!response.ok) throw new Error(`API error: ${response.status}`)
  return response.json()
}

export async function getWorkspaceStatus() {
  const response = await fetch(`${API_BASE}/status`)
  if (!response.ok) throw new Error(`API error: ${response.status}`)
  return response.json()
}