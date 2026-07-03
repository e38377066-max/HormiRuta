import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'

const POLL_MS = 60_000

export default function OpenAIQuotaBanner() {
  const { isAuthenticated, isAdmin } = useAuth()
  const [exhausted, setExhausted] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return

    const check = async () => {
      try {
        const res = await fetch('/api/health')
        if (!res.ok) return
        const data = await res.json()
        setExhausted(!!data.openaiQuotaExhausted)
      } catch {
      }
    }

    check()
    timerRef.current = setInterval(check, POLL_MS)
    return () => clearInterval(timerRef.current)
  }, [isAuthenticated, isAdmin])

  if (!exhausted) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: '#b91c1c',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: '10px 20px',
      fontSize: 14,
      fontWeight: 500,
      boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
    }}>
      <span style={{ fontSize: 20 }}>⚠️</span>
      <span>
        <strong>Créditos de OpenAI agotados.</strong>{' '}
        El chatbot funciona sin IA hasta que recargues tu cuenta en{' '}
        <a
          href="https://platform.openai.com/settings/organization/billing"
          target="_blank"
          rel="noreferrer"
          style={{ color: '#fde68a', textDecoration: 'underline' }}
        >
          platform.openai.com
        </a>
        . Esta alerta desaparece sola cuando se restauren los créditos.
      </span>
    </div>
  )
}
