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
  const [pollingInterval, setPollingInterval] = useState(30)
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

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings(form)
      alert('Configuracion guardada')
    } catch (err) {
      alert('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleStartPolling = async () => {
    setPollingLoading(true)
    try {
      await startPolling(pollingInterval)
      await loadPollingStatus()
    } catch (err) {
      console.error(err)
    } finally {
      setPollingLoading(false)
    }
  }

  const handleStopPolling = async () => {
    setPollingLoading(true)
    try {
      await stopPolling()
      await loadPollingStatus()
    } catch (err) {
      console.error(err)
    } finally {
      setPollingLoading(false)
    }
  }

  const handleSyncNow = async () => {
    setSyncing(true)
    try {
      await syncContacts()
      await loadPollingStatus()
    } catch (err) {
      console.error(err)
    } finally {
      setSyncing(false)
    }
  }

  const handleInputChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1>Configuracion de Mensajeria</h1>
      </div>

      <div className="settings-content">
        <div className="settings-left">
          <div className="settings-card">
            <h3>Conexion con Respond.io</h3>
            
            <div className="field-group">
              <label>API Token de Respond.io</label>
              <div className="input-row">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={form.respond_api_token}
                  onChange={(e) => handleInputChange('respond_api_token', e.target.value)}
                  placeholder="Ingresa tu token"
                />
                <button className="icon-button" onClick={() => setShowToken(!showToken)}>
                  <span className="material-icons">{showToken ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <div className="button-row">
              <button
                className="btn-secondary"
                onClick={handleTestConnection}
                disabled={testing || !form.respond_api_token}
              >
                {testing ? 'Probando...' : 'Probar Conexion'}
              </button>
              {connectionStatus !== null && (
                <span className={`status-badge ${connectionStatus ? 'success' : 'error'}`}>
                  {connectionStatus ? 'Conectado' : 'Error'}
                </span>
              )}
            </div>

            <div className="checkbox-row">
              <label>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => handleInputChange('is_active', e.target.checked)}
                />
                <span>Activar integracion con Respond.io</span>
              </label>
            </div>
          </div>

          <div className="settings-card">
            <h3>Modo de Atencion</h3>
            <div className="radio-list">
              {attentionModes.map(mode => (
                <label key={mode.value} className="radio-item">
                  <input
                    type="radio"
                    name="attention_mode"
                    value={mode.value}
                    checked={form.attention_mode === mode.value}
                    onChange={(e) => handleInputChange('attention_mode', e.target.value)}
                  />
                  <span>{mode.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="settings-card">
            <h3>Sincronizacion de Mensajes</h3>
            <p className="description">El sistema consulta Respond.io periodicamente para obtener mensajes nuevos.</p>
            
            <div className="sync-status">
              <span className={`status-indicator ${pollingStatus.active ? 'active' : ''}`}></span>
              <span>{pollingStatus.active ? 'Sincronizando' : 'Detenido'}</span>
            </div>

            <div className="button-row">
              <select
                value={pollingInterval}
                onChange={(e) => setPollingInterval(parseInt(e.target.value))}
                disabled={pollingStatus.active}
              >
                {pollingIntervals.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              
              {!pollingStatus.active ? (
                <button className="btn-success" onClick={handleStartPolling} disabled={pollingLoading || !form.is_active}>
                  Iniciar
                </button>
              ) : (
                <button className="btn-danger" onClick={handleStopPolling} disabled={pollingLoading}>
                  Detener
                </button>
              )}
              
              <button className="btn-secondary" onClick={handleSyncNow} disabled={syncing || !form.is_active}>
                {syncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
              </button>
            </div>
          </div>

          <div className="settings-card">
            <h3>Automatizacion</h3>
            
            <div className="checkbox-row">
              <label>
                <input
                  type="checkbox"
                  checked={form.auto_validate_addresses}
                  onChange={(e) => handleInputChange('auto_validate_addresses', e.target.checked)}
                />
                <span>Validar direcciones automaticamente</span>
              </label>
            </div>
            
            <div className="checkbox-row">
              <label>
                <input
                  type="checkbox"
                  checked={form.auto_respond_coverage}
                  onChange={(e) => handleInputChange('auto_respond_coverage', e.target.checked)}
                />
                <span>Responder automaticamente si hay cobertura</span>
              </label>
            </div>
            
            <div className="checkbox-row">
              <label>
                <input
                  type="checkbox"
                  checked={form.auto_respond_no_coverage}
                  onChange={(e) => handleInputChange('auto_respond_no_coverage', e.target.checked)}
                />
                <span>Responder automaticamente si NO hay cobertura</span>
              </label>
            </div>
          </div>
        </div>

        <div className="settings-right">
          <div className="settings-card">
            <h3>Mensajes Automaticos</h3>
            
            <div className="field-group">
              <label>Mensaje de cobertura confirmada</label>
              <textarea
                rows={3}
                value={form.coverage_message}
                onChange={(e) => handleInputChange('coverage_message', e.target.value)}
              />
            </div>

            <div className="field-group">
              <label>Mensaje sin cobertura</label>
              <textarea
                rows={3}
                value={form.no_coverage_message}
                onChange={(e) => handleInputChange('no_coverage_message', e.target.value)}
              />
            </div>

            <div className="field-group">
              <label>Mensaje de orden confirmada</label>
              <textarea
                rows={3}
                value={form.order_confirmed_message}
                onChange={(e) => handleInputChange('order_confirmed_message', e.target.value)}
              />
            </div>

            <div className="field-group">
              <label>Mensaje de repartidor asignado</label>
              <textarea
                rows={3}
                value={form.driver_assigned_message}
                onChange={(e) => handleInputChange('driver_assigned_message', e.target.value)}
              />
            </div>

            <div className="field-group">
              <label>Mensaje de orden completada</label>
              <textarea
                rows={3}
                value={form.order_completed_message}
                onChange={(e) => handleInputChange('order_completed_message', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="settings-footer">
        <button className="btn-primary btn-large" onClick={handleSave} disabled={saving}>
          <span className="material-icons">save</span>
          {saving ? 'Guardando...' : 'Guardar Configuracion'}
        </button>
      </div>
    </div>
  )
}
