import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMessaging } from '../../contexts/MessagingContext'
import './MessagingPages.css'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { fetchSettings, updateSettings, testConnection, startPolling, stopPolling, getPollingStatus, syncContacts } = useMessaging()
  
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [pollingLoading, setPollingLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [pollingInterval, setPollingInterval] = useState({ label: '30 segundos', value: 30 })
  const [pollingStatus, setPollingStatus] = useState({ active: false, lastPoll: null })

  const pollingIntervals = [
    { label: '15 segundos', value: 15 },
    { label: '30 segundos', value: 30 },
    { label: '1 minuto', value: 60 },
    { label: '2 minutos', value: 120 },
    { label: '5 minutos', value: 300 }
  ]

  const [form, setForm] = useState({
    respond_api_token: '',
    is_active: false,
    attention_mode: 'assisted',
    auto_validate_addresses: true,
    auto_respond_coverage: true,
    auto_respond_no_coverage: true,
    coverage_message: '',
    no_coverage_message: '',
    order_confirmed_message: '',
    driver_assigned_message: '',
    order_completed_message: ''
  })

  const attentionModes = [
    { label: 'Automatico - Validacion y respuesta sin intervencion', value: 'automatic' },
    { label: 'Asistido - El sistema valida y el agente confirma', value: 'assisted' },
    { label: 'Manual - El agente controla todo', value: 'manual' }
  ]

  useEffect(() => {
    loadSettings()
    loadPollingStatus()
  }, [])

  const loadSettings = async () => {
    try {
      const settings = await fetchSettings()
      if (settings) {
        setForm({
          respond_api_token: '',
          is_active: settings.is_active || false,
          attention_mode: settings.attention_mode || 'assisted',
          auto_validate_addresses: settings.auto_validate_addresses !== false,
          auto_respond_coverage: settings.auto_respond_coverage !== false,
          auto_respond_no_coverage: settings.auto_respond_no_coverage !== false,
          coverage_message: settings.coverage_message || '',
          no_coverage_message: settings.no_coverage_message || '',
          order_confirmed_message: settings.order_confirmed_message || '',
          driver_assigned_message: settings.driver_assigned_message || '',
          order_completed_message: settings.order_completed_message || ''
        })
      }
    } catch (err) {
      console.error('Error loading settings:', err)
    }
  }

  const loadPollingStatus = async () => {
    try {
      const status = await getPollingStatus()
      if (status) {
        setPollingStatus({ active: status.active, lastPoll: status.lastPoll })
      }
    } catch (err) {
      console.error('Error loading polling status:', err)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setConnectionStatus(null)
    try {
      if (form.respond_api_token) {
        await updateSettings({ respond_api_token: form.respond_api_token })
      }
      const result = await testConnection()
      setConnectionStatus(result?.success)
    } catch (err) {
      setConnectionStatus(false)
    } finally {
      setTesting(false)
    }
  }

  const handleStartPolling = async () => {
    setPollingLoading(true)
    try {
      await startPolling(pollingInterval.value)
      setPollingStatus({ ...pollingStatus, active: true })
    } catch (err) {
      alert('Error al iniciar sincronizacion')
    } finally {
      setPollingLoading(false)
    }
  }

  const handleStopPolling = async () => {
    setPollingLoading(true)
    try {
      await stopPolling()
      setPollingStatus({ ...pollingStatus, active: false })
    } catch (err) {
      alert('Error al detener sincronizacion')
    } finally {
      setPollingLoading(false)
    }
  }

  const handleSyncNow = async () => {
    setSyncing(true)
    try {
      await syncContacts()
      setPollingStatus({ ...pollingStatus, lastPoll: new Date().toISOString() })
    } catch (err) {
      alert('Error al sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings(form)
      alert('Configuracion guardada exitosamente')
    } catch (err) {
      alert('Error al guardar configuracion')
    } finally {
      setSaving(false)
    }
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="q-page q-pa-md">
      <div className="page-title-row">
        <button className="q-btn-icon" onClick={() => navigate(-1)}>
          <span className="material-icons">arrow_back</span>
        </button>
        <div className="page-title">
          <span className="material-icons">settings</span>
          Configuracion de Mensajeria
        </div>
      </div>

      <div className="settings-grid">
        <div className="settings-column">
          <div className="q-card q-mb-md">
            <div className="card-section">
              <h4>Conexion con Respond.io</h4>
              
              <div className="form-group">
                <label>API Token de Respond.io</label>
                <div className="input-with-icon">
                  <input
                    type={showToken ? 'text' : 'password'}
                    className="q-input"
                    value={form.respond_api_token}
                    onChange={(e) => setForm({ ...form, respond_api_token: e.target.value })}
                    placeholder="Ingresa tu token"
                  />
                  <button className="q-btn-icon" onClick={() => setShowToken(!showToken)}>
                    <span className="material-icons">{showToken ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              <div className="row-buttons q-mt-md">
                <button
                  className="q-btn secondary"
                  onClick={handleTestConnection}
                  disabled={testing || !form.respond_api_token}
                >
                  {testing ? 'Probando...' : 'Probar Conexion'}
                </button>
                {connectionStatus !== null && (
                  <span className={`q-chip ${connectionStatus ? 'positive' : 'negative'}`}>
                    {connectionStatus ? 'Conectado' : 'Error de conexion'}
                  </span>
                )}
              </div>

              <div className="toggle-row q-mt-md">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                  Activar integracion con Respond.io
                </label>
              </div>
            </div>
          </div>

          <div className="q-card q-mb-md">
            <div className="card-section">
              <h4>Modo de Atencion</h4>
              
              <div className="radio-group">
                {attentionModes.map(mode => (
                  <label key={mode.value} className="radio-option">
                    <input
                      type="radio"
                      name="attention_mode"
                      value={mode.value}
                      checked={form.attention_mode === mode.value}
                      onChange={(e) => setForm({ ...form, attention_mode: e.target.value })}
                    />
                    <span>{mode.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="q-card q-mb-md">
            <div className="card-section">
              <h4>Sincronizacion de Mensajes</h4>
              <p className="hint-text">El sistema consulta Respond.io periodicamente para obtener mensajes nuevos.</p>
              
              <div className="row-buttons q-mt-md">
                <span className={`q-chip ${pollingStatus.active ? 'positive' : ''}`}>
                  <span className="material-icons">sync</span>
                  {pollingStatus.active ? 'Sincronizando' : 'Detenido'}
                </span>
                {pollingStatus.lastPoll && (
                  <span className="hint-text">Ultima: {formatTime(pollingStatus.lastPoll)}</span>
                )}
              </div>

              <div className="row-buttons q-mt-md">
                <select
                  className="q-input"
                  value={pollingInterval.value}
                  onChange={(e) => {
                    const val = parseInt(e.target.value)
                    const opt = pollingIntervals.find(p => p.value === val)
                    setPollingInterval(opt || pollingIntervals[1])
                  }}
                  disabled={pollingStatus.active}
                  style={{ width: 150 }}
                >
                  {pollingIntervals.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                
                {!pollingStatus.active ? (
                  <button className="q-btn positive" onClick={handleStartPolling} disabled={pollingLoading || !form.is_active}>
                    <span className="material-icons">play_arrow</span>
                    Iniciar
                  </button>
                ) : (
                  <button className="q-btn negative" onClick={handleStopPolling} disabled={pollingLoading}>
                    <span className="material-icons">stop</span>
                    Detener
                  </button>
                )}
                
                <button className="q-btn secondary" onClick={handleSyncNow} disabled={syncing || !form.is_active}>
                  <span className="material-icons">refresh</span>
                  {syncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
                </button>
              </div>
            </div>
          </div>

          <div className="q-card q-mb-md">
            <div className="card-section">
              <h4>Automatizacion</h4>
              
              <div className="toggle-row">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={form.auto_validate_addresses}
                    onChange={(e) => setForm({ ...form, auto_validate_addresses: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                  Validar direcciones automaticamente
                </label>
              </div>
              
              <div className="toggle-row">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={form.auto_respond_coverage}
                    onChange={(e) => setForm({ ...form, auto_respond_coverage: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                  Responder automaticamente si hay cobertura
                </label>
              </div>
              
              <div className="toggle-row">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={form.auto_respond_no_coverage}
                    onChange={(e) => setForm({ ...form, auto_respond_no_coverage: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                  Responder automaticamente si NO hay cobertura
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-column">
          <div className="q-card">
            <div className="card-section">
              <h4>Mensajes Automaticos</h4>
              
              <div className="form-group">
                <label>Mensaje de cobertura confirmada</label>
                <textarea
                  className="q-input"
                  rows={3}
                  value={form.coverage_message}
                  onChange={(e) => setForm({ ...form, coverage_message: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Mensaje sin cobertura</label>
                <textarea
                  className="q-input"
                  rows={3}
                  value={form.no_coverage_message}
                  onChange={(e) => setForm({ ...form, no_coverage_message: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Mensaje de orden confirmada</label>
                <textarea
                  className="q-input"
                  rows={3}
                  value={form.order_confirmed_message}
                  onChange={(e) => setForm({ ...form, order_confirmed_message: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Mensaje de repartidor asignado</label>
                <textarea
                  className="q-input"
                  rows={3}
                  value={form.driver_assigned_message}
                  onChange={(e) => setForm({ ...form, driver_assigned_message: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Mensaje de orden completada</label>
                <textarea
                  className="q-input"
                  rows={3}
                  value={form.order_completed_message}
                  onChange={(e) => setForm({ ...form, order_completed_message: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="q-mt-md">
        <button className="q-btn primary btn-large" onClick={handleSave} disabled={saving}>
          <span className="material-icons">save</span>
          {saving ? 'Guardando...' : 'Guardar Configuracion'}
        </button>
      </div>
    </div>
  )
}
