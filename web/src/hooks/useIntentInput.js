import { useState, useCallback } from 'react'

export function useIntentInput() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const parse = useCallback(async (text, options) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: text, ...options })
      })
      if (!response.ok) throw new Error(`API error: ${response.status}`)
      return response.json()
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { parse, loading, error }
}