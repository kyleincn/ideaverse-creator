import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '40px',
          textAlign: 'center',
          background: '#0a0a14',
          color: 'white'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            marginBottom: '20px',
            background: 'rgba(244, 67, 54, 0.2)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px'
          }}>
            !
          </div>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '600',
            marginBottom: '10px',
            color: '#F44336'
          }}>
            Something went wrong
          </h2>
          <p style={{
            fontSize: '13px',
            color: 'rgba(255, 255, 255, 0.6)',
            marginBottom: '24px',
            maxWidth: '400px'
          }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #0F9F92, #0D8579)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}