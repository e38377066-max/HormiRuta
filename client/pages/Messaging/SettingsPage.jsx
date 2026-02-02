import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMessaging } from '../../contexts/MessagingContext'
import './MessagingPages.css'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { fetchSettings, updateSettings, testConnection, startPolling, stopPolling, getPollingStatus, syncContacts, validateZip } = useMessaging()
  
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [pollingLoading, setPollingLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [pollingInterval, setPollingInterval] = useState(30)
  const [pollingStatus, setPollingStatus] = useState({ active: false, lastPoll: null })
  const [activeTab, setActiveTab] = useState('connection')
  
  const [zipInput, setZipInput] = useState('')
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState(null)
  const [validationHistory, setValidationHistory] = useState([])
  const [copySuccess, setCopySuccess] = useState(false)

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
    order_completed_message: '',
    business_hours_enabled: false,
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    business_days: '1,2,3,4,5',
    timezone: 'America/Chicago',
    out_of_hours_message: '',
    welcome_existing_customer: '',
    welcome_new_customer: '',
    has_info_response: '',
    request_zip_message: '',
    remind_zip_message: '',
    product_menu_message: '',
    products: 'Tarjetas,Magneticos,Post Cards,Playeras',
    excluded_tags: 'Personal,IprintPOS,ClientesArea,Area862Designers',
    default_agent_id: '',
    default_agent_name: '',
    message_history_limit: 50
  })
  const [hasExistingToken, setHasExistingToken] = useState(false)

  const attentionModes = [
    { label: 'Automatico - Chatbot maneja conversaciones', value: 'automatic' },
    { label: 'Asistido - El sistema valida y el agente confirma', value: 'assisted' },
    { label: 'Manual - El agente controla todo', value: 'manual' }
  ]

  const weekDays = [
    { label: 'Lun', value: '1' },
    { label: 'Mar', value: '2' },
    { label: 'Mie', value: '3' },
    { label: 'Jue', value: '4' },
    { label: 'Vie', value: '5' },
    { label: 'Sab', value: '6' },
    { label: 'Dom', value: '0' }
  ]

  const timezones = [
    { label: 'Central (Chicago)', value: 'America/Chicago' },
    { label: 'Este (New York)', value: 'America/New_York' },
    { label: 'Montaña (Denver)', value: 'America/Denver' },
    { label: 'Pacifico (Los Angeles)', value: 'America/Los_Angeles' },
    { label: 'Mexico (CDMX)', value: 'America/Mexico_City' }
  ]

  useEffect(() => {
    loadSettings()
    loadPollingStatus()
  }, [])

  const loadSettings = async () => {
    try {
      const settings = await fetchSettings()
      if (settings) {
        setHasExistingToken(settings.has_api_token || false)
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
          order_completed_message: settings.order_completed_message || '',
          business_hours_enabled: settings.business_hours_enabled || false,
          business_hours_start: settings.business_hours_start || '09:00',
          business_hours_end: settings.business_hours_end || '18:00',
          business_days: settings.business_days || '1,2,3,4,5',
          timezone: settings.timezone || 'America/Chicago',
          out_of_hours_message: settings.out_of_hours_message || '',
          welcome_existing_customer: settings.welcome_existing_customer || '',
          welcome_new_customer: settings.welcome_new_customer || '',
          has_info_response: settings.has_info_response || '',
          request_zip_message: settings.request_zip_message || '',
          remind_zip_message: settings.remind_zip_message || '',
          product_menu_message: settings.product_menu_message || '',
          products: settings.products || 'Tarjetas,Magneticos,Post Cards,Playeras',
          excluded_tags: settings.excluded_tags || 'Personal,IprintPOS,ClientesArea,Area862Designers',
          default_agent_id: settings.default_agent_id || '',
          default_agent_name: settings.default_agent_name || '',
          message_history_limit: settings.message_history_limit || 50
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
      const dataToSave = { ...form }
      if (!dataToSave.respond_api_token) {
        delete dataToSave.respond_api_token
      } else {
        setHasExistingToken(true)
      }
      await updateSettings(dataToSave)
      setForm(prev => ({ ...prev, respond_api_token: '' }))
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

  const toggleDay = (dayValue) => {
    const businessDays = String(form.business_days || '')
    const currentDays = businessDays.split(',').filter(d => d)
    if (currentDays.includes(dayValue)) {
      handleInputChange('business_days', currentDays.filter(d => d !== dayValue).join(','))
    } else {
      handleInputChange('business_days', [...currentDays, dayValue].sort().join(','))
    }
  }

  const isDaySelected = (dayValue) => {
    const businessDays = String(form.business_days || '')
    return businessDays.split(',').includes(dayValue)
  }

  const handleValidateZip = async () => {
    if (!zipInput.trim()) return
    
    setValidating(true)
    setValidationResult(null)
    setCopySuccess(false)
    
    try {
      const result = await validateZip(zipInput.trim())
      setValidationResult(result)
      
      const historyItem = {
        id: Date.now(),
        zipOrCity: zipInput.trim(),
        valid: result.valid,
        message: result.message,
        copyMessage: result.copyMessage,
        timestamp: new Date().toLocaleTimeString()
      }
      setValidationHistory(prev => [historyItem, ...prev].slice(0, 20))
      setZipInput('')
    } catch (err) {
      setValidationResult({ valid: false, message: 'Error al validar' })
    } finally {
      setValidating(false)
    }
  }

  const handleCopyMessage = async (message) => {
    try {
      await navigator.clipboard.writeText(message)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      alert('Error al copiar')
    }
  }

  const tabs = [
    { id: 'connection', label: 'Conexion', icon: 'link' },
    { id: 'chatbot', label: 'Chatbot', icon: 'smart_toy' },
    { id: 'messages', label: 'Mensajes', icon: 'chat' },
    { id: 'automation', label: 'Automatizacion', icon: 'auto_fix_high' }
  ]

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1>Configuracion de Mensajeria</h1>
      </div>

      <div className="settings-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="material-icons">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="settings-content single-column">
        {activeTab === 'connection' && (
          <>
            <div className="settings-card">
              <h3>Conexion con Respond.io</h3>
              
              <div className="field-group">
                <label>API Token de Respond.io</label>
                <div className="input-row">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={form.respond_api_token}
                    onChange={(e) => handleInputChange('respond_api_token', e.target.value)}
                    placeholder={hasExistingToken ? '••••••••••••••••• (token guardado)' : 'Ingresa tu token'}
                  />
                  <button className="icon-button" onClick={() => setShowToken(!showToken)}>
                    <span className="material-icons">{showToken ? 'visibility_off' : 'visibility'}</span>
                  </button>
                  {hasExistingToken && !form.respond_api_token && (
                    <span className="token-saved-indicator">Token guardado</span>
                  )}
                </div>
              </div>

              <div className="button-row">
                <button
                  className="btn-secondary"
                  onClick={handleTestConnection}
                  disabled={testing || (!form.respond_api_token && !hasExistingToken)}
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
              <p className="description">Selecciona como el sistema manejara los mensajes entrantes</p>
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
              {form.attention_mode === 'automatic' && (
                <div className="info-box">
                  <span className="material-icons">info</span>
                  <span>En modo automatico, el chatbot maneja las conversaciones segun el flujo configurado</span>
                </div>
              )}
            </div>

            <div className="settings-card">
              <h3>Sincronizacion de Mensajes</h3>
              <p className="description">El sistema consulta Respond.io periodicamente para obtener mensajes nuevos.</p>
              
              <div className="sync-status">
                <span className={`status-indicator ${pollingStatus.active ? 'active' : ''}`}></span>
                <span>{pollingStatus.active ? 'Sincronizando' : 'Detenido'}</span>
              </div>

              <div className="field-group">
                <label>Intervalo de sincronizacion</label>
                <select
                  value={pollingInterval}
                  onChange={(e) => setPollingInterval(parseInt(e.target.value))}
                  disabled={pollingStatus.active}
                >
                  {pollingIntervals.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label>Historial de mensajes a revisar</label>
                <input
                  type="number"
                  min="10"
                  max="500"
                  value={form.message_history_limit}
                  onChange={(e) => handleInputChange('message_history_limit', parseInt(e.target.value) || 50)}
                />
                <p className="field-hint">Cuantos mensajes revisar por contacto para detectar ZIP codes (10-500)</p>
              </div>

              <div className="button-row">
                {!pollingStatus.active ? (
                  <button className="btn-success" onClick={handleStartPolling} disabled={pollingLoading || !form.is_active}>
                    Iniciar Sincronizacion
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
          </>
        )}

        {activeTab === 'chatbot' && (
          <>
            <div className="settings-card flow-overview">
              <h3>
                <span className="material-icons">account_tree</span>
                Flujo de Conversacion del Chatbot
              </h3>
              <p className="description">El chatbot sigue este flujo automatico para cada conversacion entrante</p>
              
              <div className="flow-diagram">
                <div className="flow-step">
                  <div className="flow-number">1</div>
                  <div className="flow-content">
                    <strong>Verificacion de Horario</strong>
                    <span>Si esta fuera de horario, envia mensaje automatico y finaliza</span>
                  </div>
                </div>
                <div className="flow-arrow">
                  <span className="material-icons">arrow_downward</span>
                </div>
                <div className="flow-step">
                  <div className="flow-number">2</div>
                  <div className="flow-content">
                    <strong>Identificacion de Cliente</strong>
                    <span>Verifica tags (Personal, IprintPOS, etc.) para excluir del flujo</span>
                  </div>
                </div>
                <div className="flow-arrow">
                  <span className="material-icons">arrow_downward</span>
                </div>
                <div className="flow-step">
                  <div className="flow-number">3</div>
                  <div className="flow-content">
                    <strong>Cliente Existente vs Nuevo</strong>
                    <span>Si existe en BD, saluda y asigna agente. Si es nuevo, continua flujo</span>
                  </div>
                </div>
                <div className="flow-arrow">
                  <span className="material-icons">arrow_downward</span>
                </div>
                <div className="flow-step">
                  <div className="flow-number">4</div>
                  <div className="flow-content">
                    <strong>Verificar Informacion Previa</strong>
                    <span>Pregunta si ya le dieron precios. Si = asigna agente, No = pide ZIP</span>
                  </div>
                </div>
                <div className="flow-arrow">
                  <span className="material-icons">arrow_downward</span>
                </div>
                <div className="flow-step">
                  <div className="flow-number">5</div>
                  <div className="flow-content">
                    <strong>Validacion de Cobertura</strong>
                    <span>Valida ZIP/ciudad y responde con cobertura o sin cobertura</span>
                  </div>
                </div>
                <div className="flow-arrow">
                  <span className="material-icons">arrow_downward</span>
                </div>
                <div className="flow-step">
                  <div className="flow-number">6</div>
                  <div className="flow-content">
                    <strong>Menu de Productos</strong>
                    <span>Si hay cobertura, muestra productos disponibles</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-card">
              <h3>
                <span className="material-icons">schedule</span>
                Horario de Atencion
              </h3>
              <p className="description">Configura cuando el chatbot responde automaticamente</p>
              
              <div className="checkbox-row">
                <label>
                  <input
                    type="checkbox"
                    checked={form.business_hours_enabled}
                    onChange={(e) => handleInputChange('business_hours_enabled', e.target.checked)}
                  />
                  <span>Activar verificacion de horario</span>
                </label>
              </div>

              {form.business_hours_enabled && (
                <>
                  <div className="field-row">
                    <div className="field-group">
                      <label>Hora inicio</label>
                      <input
                        type="time"
                        value={form.business_hours_start}
                        onChange={(e) => handleInputChange('business_hours_start', e.target.value)}
                      />
                    </div>
                    <div className="field-group">
                      <label>Hora fin</label>
                      <input
                        type="time"
                        value={form.business_hours_end}
                        onChange={(e) => handleInputChange('business_hours_end', e.target.value)}
                      />
                    </div>
                    <div className="field-group">
                      <label>Zona horaria</label>
                      <select
                        value={form.timezone}
                        onChange={(e) => handleInputChange('timezone', e.target.value)}
                      >
                        {timezones.map(tz => (
                          <option key={tz.value} value={tz.value}>{tz.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="field-group">
                    <label>Dias de atencion</label>
                    <div className="day-selector">
                      {weekDays.map(day => (
                        <button
                          key={day.value}
                          type="button"
                          className={`day-button ${isDaySelected(day.value) ? 'selected' : ''}`}
                          onClick={() => toggleDay(day.value)}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="field-group">
                    <label>Mensaje fuera de horario</label>
                    <textarea
                      rows={3}
                      value={form.out_of_hours_message}
                      onChange={(e) => handleInputChange('out_of_hours_message', e.target.value)}
                      placeholder="Gracias por contactarnos. Nuestro horario de atencion es de Lunes a Viernes de 9am a 6pm..."
                    />
                  </div>
                </>
              )}
            </div>

            <div className="settings-card">
              <h3>
                <span className="material-icons">person</span>
                Agente por Defecto
              </h3>
              <p className="description">Agente al que se asignan las conversaciones automaticamente</p>
              
              <div className="field-row">
                <div className="field-group">
                  <label>ID del Agente (Respond.io)</label>
                  <input
                    type="text"
                    value={form.default_agent_id}
                    onChange={(e) => handleInputChange('default_agent_id', e.target.value)}
                    placeholder="Ej: 123456"
                  />
                </div>
                <div className="field-group">
                  <label>Nombre del Agente</label>
                  <input
                    type="text"
                    value={form.default_agent_name}
                    onChange={(e) => handleInputChange('default_agent_name', e.target.value)}
                    placeholder="Ej: Felipe Delgado"
                  />
                </div>
              </div>
            </div>

            <div className="settings-card">
              <h3>
                <span className="material-icons">label_off</span>
                Tags Excluidos
              </h3>
              <p className="description">Contactos con estos tags no seran atendidos por el chatbot</p>
              
              <div className="field-group">
                <label>Tags (separados por coma)</label>
                <input
                  type="text"
                  value={form.excluded_tags}
                  onChange={(e) => handleInputChange('excluded_tags', e.target.value)}
                  placeholder="Personal,IprintPOS,ClientesArea"
                />
              </div>
              <div className="tags-preview">
                {String(form.excluded_tags || '').split(',').filter(t => t.trim()).map((tag, i) => (
                  <span key={i} className="tag outline">{tag.trim()}</span>
                ))}
              </div>
            </div>

            <div className="settings-card">
              <h3>
                <span className="material-icons">inventory_2</span>
                Menu de Productos
              </h3>
              <p className="description">Productos que el chatbot ofrece a los clientes</p>
              
              <div className="field-group">
                <label>Productos (separados por coma)</label>
                <input
                  type="text"
                  value={form.products}
                  onChange={(e) => handleInputChange('products', e.target.value)}
                  placeholder="Tarjetas,Magneticos,Post Cards,Playeras"
                />
              </div>
              <div className="products-preview">
                {String(form.products || '').split(',').filter(p => p.trim()).map((product, i) => (
                  <div key={i} className="product-item">
                    <span className="product-number">{i + 1}</span>
                    <span className="product-name">{product.trim()}</span>
                  </div>
                ))}
              </div>

              <div className="field-group">
                <label>Mensaje del menu de productos</label>
                <textarea
                  rows={4}
                  value={form.product_menu_message}
                  onChange={(e) => handleInputChange('product_menu_message', e.target.value)}
                  placeholder="Por favor seleccione el producto de su interes:&#10;1. Tarjetas&#10;2. Magneticos..."
                />
              </div>
            </div>
          </>
        )}

        {activeTab === 'messages' && (
          <>
            <div className="settings-card">
              <h3>
                <span className="material-icons">waving_hand</span>
                Mensajes de Bienvenida
              </h3>
              
              <div className="field-group">
                <label>Bienvenida para clientes existentes</label>
                <textarea
                  rows={3}
                  value={form.welcome_existing_customer}
                  onChange={(e) => handleInputChange('welcome_existing_customer', e.target.value)}
                  placeholder="Hola! Que gusto verte de nuevo. Un agente te atendera en breve..."
                />
              </div>

              <div className="field-group">
                <label>Bienvenida para clientes nuevos</label>
                <textarea
                  rows={3}
                  value={form.welcome_new_customer}
                  onChange={(e) => handleInputChange('welcome_new_customer', e.target.value)}
                  placeholder="Hola! Bienvenido. Antes de continuar, ¿ya le brindaron informacion sobre precios?"
                />
              </div>

              <div className="field-group">
                <label>Respuesta cuando ya tiene informacion previa</label>
                <textarea
                  rows={3}
                  value={form.has_info_response}
                  onChange={(e) => handleInputChange('has_info_response', e.target.value)}
                  placeholder="Perfecto! Por favor proporcionenos sus datos para preparar su diseno..."
                />
              </div>
            </div>

            <div className="settings-card">
              <h3>
                <span className="material-icons">pin_drop</span>
                Mensajes de Validacion ZIP
              </h3>
              
              <div className="field-group">
                <label>Solicitud de codigo postal</label>
                <textarea
                  rows={3}
                  value={form.request_zip_message}
                  onChange={(e) => handleInputChange('request_zip_message', e.target.value)}
                  placeholder="Por favor proporcioname tu codigo postal para verificar cobertura..."
                />
              </div>

              <div className="field-group">
                <label>Recordatorio de codigo postal</label>
                <textarea
                  rows={3}
                  value={form.remind_zip_message}
                  onChange={(e) => handleInputChange('remind_zip_message', e.target.value)}
                  placeholder="Disculpa, no pude identificar tu codigo postal. Por favor enviame solo el numero..."
                />
              </div>
            </div>

            <div className="settings-card">
              <h3>
                <span className="material-icons">local_shipping</span>
                Mensajes de Cobertura
              </h3>
              
              <div className="field-group">
                <label>Mensaje de cobertura confirmada</label>
                <textarea
                  rows={3}
                  value={form.coverage_message}
                  onChange={(e) => handleInputChange('coverage_message', e.target.value)}
                  placeholder="Excelente! Tenemos cobertura en tu zona..."
                />
              </div>

              <div className="field-group">
                <label>Mensaje sin cobertura</label>
                <textarea
                  rows={3}
                  value={form.no_coverage_message}
                  onChange={(e) => handleInputChange('no_coverage_message', e.target.value)}
                  placeholder="Lo sentimos, actualmente no tenemos cobertura en tu zona..."
                />
              </div>
            </div>

            <div className="settings-card">
              <h3>
                <span className="material-icons">receipt_long</span>
                Mensajes de Ordenes
              </h3>
              
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
          </>
        )}

        {activeTab === 'automation' && (
          <>
            <div className="settings-card">
              <h3>
                <span className="material-icons">auto_fix_high</span>
                Automatizacion
              </h3>
              
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
          </>
        )}
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
