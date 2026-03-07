import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  handleGoBack = () => {
    this.setState({ hasError: false, error: null })
    window.history.back()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', background: '#1a1a2e', color: '#e0e0e0', fontFamily: 'sans-serif', padding: 20, textAlign: 'center'
        }}>
          <span className="material-icons" style={{ fontSize: 64, color: '#ff5252', marginBottom: 16 }}>error_outline</span>
          <h2 style={{ margin: '0 0 8px', color: '#fff' }}>Algo salió mal</h2>
          <p style={{ margin: '0 0 24px', color: '#aaa', maxWidth: 400 }}>
            Ocurrió un error inesperado. Intenta recargar la página.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={this.handleGoBack} style={{
              padding: '10px 24px', borderRadius: 8, border: '1px solid #555', background: 'transparent',
              color: '#e0e0e0', cursor: 'pointer', fontSize: 14
            }}>Volver</button>
            <button onClick={this.handleReload} style={{
              padding: '10px 24px', borderRadius: 8, border: 'none', background: '#4285F4',
              color: '#fff', cursor: 'pointer', fontSize: 14
            }}>Recargar</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
