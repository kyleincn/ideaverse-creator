import { useState } from 'react'
import { useMediaQuery } from '../hooks/useMediaQuery.js'
import './MobileNav.css'

export default function MobileNav({ activeTab, onTabChange }) {
  const isMobile = useMediaQuery('(max-width: 767px)')

  if (!isMobile) return null

  return (
    <div className="mobile-nav">
      <button
        className={`mobile-nav-btn ${activeTab === 'intent' ? 'active' : ''}`}
        onClick={() => onTabChange('intent')}
      >
        <span className="mobile-nav-btn-icon">✏️</span>
        <span>Intent</span>
      </button>
      <button
        className={`mobile-nav-btn ${activeTab === 'scenes' ? 'active' : ''}`}
        onClick={() => onTabChange('scenes')}
      >
        <span className="mobile-nav-btn-icon">📁</span>
        <span>Scenes</span>
      </button>
      <button
        className="mobile-nav-btn"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <span className="mobile-nav-btn-icon">🎮</span>
        <span>Preview</span>
      </button>
      <button
        className="mobile-nav-btn"
        onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
      >
        <span className="mobile-nav-btn-icon">⚙️</span>
        <span>Logic</span>
      </button>
    </div>
  )
}