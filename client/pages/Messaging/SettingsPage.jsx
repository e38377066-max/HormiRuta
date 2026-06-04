import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMessaging } from '../../contexts/MessagingContext'
import './MessagingPages.css'

const parseProducts = (products) => {
  if (!products) return 'Tarjetas,Magneticos,Post Cards,Playeras'
  if (typeof products === 'string') {
    try {
      const parsed = JSON.parse(products)
      if (Array.isArray(parsed)) {
        return parsed.map(p => typeof p === 'object' ? p.name : p).join(',')
      }
    } catch {
      return products
    }
    return products
  }
  if (Array.isArray(products)) {
    return products.map(p => typeof p === 'object' ? p.name : p).join(',')
  }
  return 'Tarjetas,Magneticos,Post Cards,Playeras'
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { fetchSettings, updateSettings, testConnection, testOpenAI, resetTest, startPolling, stopPolling, getPollingStatus, syncContacts, validateZip, fetchAgents, createAgent, updateAgent, deleteAgent } = useMessaging()
  
  const [saving, setSaving] = useState(false)
  const [agents, setAgents] = useState([])
  const [showAgentForm, setShowAgentForm] = useState(false)
  const [editingAgent, setEditingAgent] = useState(null)
  const [agentForm, setAgentForm] = useState({
    agent_id: '',
    agent_name: '',
    agent_email: '',
    service_name: '',
    products: [],
    is_default: false
  })
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
  const [testingOpenAI, setTestingOpenAI] = useState(false)
  const [openAIStatus, setOpenAIStatus] = useState(null)
  const [showOpenAIKey, setShowOpenAIKey] = useState(false)
  const [hasOpenAIKey, setHasOpenAIKey] = useState(false)

  const pollingIntervals = [
    { label: t('settings.intervals.15s'), value: 15 },
    { label: t('settings.intervals.30s'), value: 30 },
    { label: t('settings.intervals.1m'), value: 60 },
    { label: `2 ${t('common.minutes', 'minutos')}`, value: 120 },
    { label: `5 ${t('common.minutes', 'minutos')}`, value: 300 }
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
    catalog_link: '',
    products: 'Tarjetas,Magneticos,Post Cards,Playeras',
    products_list: [],
    excluded_tags: 'Personal,IprintPOS,ClientesArea,Area862Designers',
    default_agent_id: '',
    default_agent_name: '',
    message_history_limit: 50,
    followup_enabled: false,
    followup_timeout_minutes: 5,
    followup_message: '',
    followup_message_2: '',
    test_mode: false,
    test_contact_id: '',
    ai_enabled: false,
    openai_api_key: '',
    conversational_mode: false
  })
  const [hasExistingToken, setHasExistingToken] = useState(false)

  const attentionModes = [
    { label: t('settings.attention.modes.automatic'), value: 'automatic' },
    { label: t('settings.attention.modes.assisted'), value: 'assisted' },
    { label: t('settings.attention.modes.manual'), value: 'manual' }
  ]

  const weekDays = [
    { label: t('common.days.mon'), value: '1' },
    { label: t('common.days.tue'), value: '2' },
    { label: t('common.days.wed'), value: '3' },
    { label: t('common.days.thu'), value: '4' },
    { label: t('common.days.fri'), value: '5' },
    { label: t('common.days.sat'), value: '6' },
    { label: t('common.days.sun'), value: '0' }
  ]

  const timezones = [
    { label: 'Central - Dallas/Chicago (CST)', value: 'America/Chicago' },
    { label: 'Este - New York/Miami (EST)', value: 'America/New_York' },
    { label: 'Montaña - Denver/Phoenix (MST)', value: 'America/Denver' },
    { label: 'Pacifico - Los Angeles (PST)', value: 'America/Los_Angeles' },
    { label: 'Mexico - Ciudad de Mexico (CST)', value: 'America/Mexico_City' },
    { label: 'Cuba - La Habana (CST)', value: 'America/Havana' },
    { label: 'Colombia - Bogota (COT)', value: 'America/Bogota' },
    { label: 'Venezuela - Caracas (VET)', value: 'America/Caracas' },
    { label: 'Argentina - Buenos Aires (ART)', value: 'America/Argentina/Buenos_Aires' },
    { label: 'Chile - Santiago (CLT)', value: 'America/Santiago' },
    { label: 'Peru - Lima (PET)', value: 'America/Lima' },
    { label: 'Ecuador - Quito (ECT)', value: 'America/Guayaquil' },
    { label: 'Panama - Ciudad de Panama (EST)', value: 'America/Panama' },
    { label: 'Republica Dominicana - Santo Domingo (AST)', value: 'America/Santo_Domingo' },
    { label: 'Puerto Rico (AST)', value: 'America/Puerto_Rico' },
    { label: 'España - Madrid (CET)', value: 'Europe/Madrid' },
    { label: 'Brasil - Sao Paulo (BRT)', value: 'America/Sao_Paulo' },
    { label: 'Honduras - Tegucigalpa (CST)', value: 'America/Tegucigalpa' },
    { label: 'Guatemala (CST)', value: 'America/Guatemala' },
    { label: 'El Salvador (CST)', value: 'America/El_Salvador' },
    { label: 'Costa Rica (CST)', value: 'America/Costa_Rica' },
    { label: 'Nicaragua - Managua (CST)', value: 'America/Managua' },
    { label: 'Bolivia - La Paz (BOT)', value: 'America/La_Paz' },
    { label: 'Paraguay - Asuncion (PYT)', value: 'America/Asuncion' },
    { label: 'Uruguay - Montevideo (UYT)', value: 'America/Montevideo' }
  ]

  useEffect(() => {
    loadSettings()
    loadPollingStatus()
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      const data = await fetchAgents()
      setAgents(data || [])
    } catch (err) {
      console.error('Error loading agents:', err)
    }
  }

  const handleSaveAgent = async () => {
    try {
      const data = {
        ...agentForm,
        products: agentForm.products.length > 0 ? agentForm.products : []
      }
      
      if (editingAgent) {
        await updateAgent(editingAgent.id, data)
      } else {
        await createAgent(data)
      }
      
      await loadAgents()
      setShowAgentForm(false)
      setEditingAgent(null)
      setAgentForm({ agent_id: '', agent_name: '', agent_email: '', service_name: '', products: [], is_default: false })
    } catch (err) {
      console.error('Error saving agent:', err)
      alert(t('settings.agents.saveError', 'Error al guardar agente'))
    }
  }

  const handleEditAgent = (agent) => {
    setEditingAgent(agent)
    setAgentForm({
      agent_id: agent.agent_id || '',
      agent_name: agent.agent_name,
      agent_email: agent.agent_email || '',
      service_name: agent.service_name,
      products: agent.products || [],
      is_default: agent.is_default
    })
    setShowAgentForm(true)
  }

  const handleDeleteAgent = async (id) => {
    if (!window.confirm(t('settings.agents.confirmDelete', '¿Eliminar este agente?'))) return
    try {
      await deleteAgent(id)
      await loadAgents()
    } catch (err) {
      console.error('Error deleting agent:', err)
    }
  }

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
          catalog_link: settings.catalog_link || '',
          products: parseProducts(settings.products),
          products_list: settings.products_list ? (typeof settings.products_list === 'string' ? JSON.parse(settings.products_list) : settings.products_list) : [],
          excluded_tags: settings.excluded_tags || 'Personal,IprintPOS,ClientesArea,Area862Designers',
          default_agent_id: settings.default_agent_id || '',
          default_agent_name: settings.default_agent_name || '',
          message_history_limit: settings.message_history_limit || 50,
          followup_enabled: settings.followup_enabled || false,
          followup_timeout_minutes: settings.followup_timeout_minutes || 5,
          followup_message: settings.followup_message || '',
          followup_message_2: settings.followup_message_2 || '',
          test_mode: settings.test_mode || false,
          test_contact_id: settings.test_contact_id || '',
          ai_enabled: settings.ai_enabled || false,
          openai_api_key: '',
          conversational_mode: settings.conversational_mode || false
        })
        setHasOpenAIKey(settings.has_openai_key || settings.has_openai_env_key || false)
        if (settings.has_openai_env_key && !settings.ai_enabled) {
          setForm(prev => ({ ...prev, ai_enabled: true }))
        }
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
      if (!dataToSave.openai_api_key) {
        delete dataToSave.openai_api_key
      } else {
        setHasOpenAIKey(true)
      }
      if (dataToSave.products_list) {
        dataToSave.products_list = JSON.stringify(dataToSave.products_list)
      }
      await updateSettings(dataToSave)
      setForm(prev => ({ ...prev, respond_api_token: '', openai_api_key: '' }))
      alert(t('settings.alerts.savedSuccess'))
    } catch (err) {
      alert(t('settings.alerts.saveError', 'Error al guardar'))
    } finally {
      setSaving(false)
    }
  }

  const handleTestOpenAI = async () => {
    setTestingOpenAI(true)
    setOpenAIStatus(null)
    try {
      const result = await testOpenAI(form.openai_api_key)
      setOpenAIStatus(result?.success ? 'ok' : 'error')
    } catch (err) {
      setOpenAIStatus('error')
    } finally {
      setTestingOpenAI(false)
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
      setValidationResult({ valid: false, message: t('orders.revalidateError') })
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
      alert(t('orders.copyError'))
    }
  }

  const tabs = [
    { id: 'connection', label: t('settings.tabs.connection'), icon: 'link' },
    { id: 'chatbot', label: t('settings.tabs.chatbot'), icon: 'smart_toy' },
    { id: 'messages', label: t('settings.tabs.messages'), icon: 'chat' },
    { id: 'automation', label: t('settings.tabs.automation'), icon: 'auto_fix_high' },
    { id: 'ia', label: t('settings.tabs.ai'), icon: 'psychology' }
  ]

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1>{t('settings.title')}</h1>
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
              <h3>{t('settings.connection.title')}</h3>
              
              <div className="field-group">
                <label>{t('settings.connection.tokenLabel')}</label>
                <div className="input-row">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={form.respond_api_token}
                    onChange={(e) => handleInputChange('respond_api_token', e.target.value)}
                    placeholder={hasExistingToken ? `••••••••••••••••• ${t('settings.connection.tokenSavedHint')}` : t('settings.connection.tokenPlaceholder')}
                  />
                  <button className="icon-button" onClick={() => setShowToken(!showToken)}>
                    <span className="material-icons">{showToken ? 'visibility_off' : 'visibility'}</span>
                  </button>
                  {hasExistingToken && !form.respond_api_token && (
                    <span className="token-saved-indicator">{t('settings.connection.tokenSavedIndicator')}</span>
                  )}
                </div>
              </div>

              <div className="button-row">
                <button
                  className="btn-secondary"
                  onClick={handleTestConnection}
                  disabled={testing || (!form.respond_api_token && !hasExistingToken)}
                >
                  {testing ? t('settings.connection.testing') : t('settings.connection.testAction')}
                </button>
                {connectionStatus !== null && (
                  <span className={`status-badge ${connectionStatus ? 'success' : 'error'}`}>
                    {connectionStatus ? t('settings.connection.statusOk') : t('settings.connection.statusError')}
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
                  <span>{t('settings.connection.enableIntegration')}</span>
                </label>
              </div>
            </div>

            <div className="settings-card">
              <h3>{t('settings.attention.title')}</h3>
              <p className="description">{t('settings.attention.description')}</p>
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
                  <span>{t('settings.attention.automaticInfo')}</span>
                </div>
              )}
            </div>

            <div className="settings-card">
              <h3>{t('settings.sync.title')}</h3>
              <p className="description">{t('settings.sync.description')}</p>
              
              <div className="sync-status">
                <span className={`status-indicator ${pollingStatus.active ? 'active' : ''}`}></span>
                <span>{pollingStatus.active ? t('settings.sync.statusActive') : t('settings.sync.statusStopped')}</span>
              </div>

              <div className="field-group">
                <label>{t('settings.sync.intervalLabel')}</label>
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
                <label>{t('settings.sync.historyLimitLabel')}</label>
                <input
                  type="number"
                  min="10"
                  max="500"
                  value={form.message_history_limit}
                  onChange={(e) => handleInputChange('message_history_limit', parseInt(e.target.value) || 50)}
                />
                <p className="field-hint">{t('settings.sync.historyLimitHint')}</p>
              </div>

              <div className="button-row">
                {!pollingStatus.active ? (
                  <button className="btn-success" onClick={handleStartPolling} disabled={pollingLoading || !form.is_active}>
                    {t('settings.sync.startAction')}
                  </button>
                ) : (
                  <button className="btn-danger" onClick={handleStopPolling} disabled={pollingLoading}>
                    {t('settings.sync.stopAction')}
                  </button>
                )}
                
                <button className="btn-secondary" onClick={handleSyncNow} disabled={syncing || !form.is_active}>
                  {syncing ? t('common.searching') : t('settings.sync.syncNow')}
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
                {t('settings.flow.title')}
              </h3>
              <p className="description">{t('settings.flow.description')}</p>
              
              <div className="flow-diagram">
                <div className="flow-step">
                  <div className="flow-number">1</div>
                  <div className="flow-content">
                    <strong>{t('settings.flow.steps.hoursCheck')}</strong>
                    <span>{t('settings.flow.steps.hoursCheckDesc')}</span>
                  </div>
                </div>
                <div className="flow-arrow">
                  <span className="material-icons">arrow_downward</span>
                </div>
                <div className="flow-step">
                  <div className="flow-number">2</div>
                  <div className="flow-content">
                    <strong>{t('settings.flow.steps.clientIdentification', 'Identificacion de Cliente')}</strong>
                    <span>{t('settings.flow.steps.clientIdentificationDesc', 'Verifica tags (Personal, IprintPOS, etc.) para excluir del flujo')}</span>
                  </div>
                </div>
                <div className="flow-arrow">
                  <span className="material-icons">arrow_downward</span>
                </div>
                <div className="flow-step">
                  <div className="flow-number">3</div>
                  <div className="flow-content">
                    <strong>{t('settings.flow.steps.existingVsNew', 'Cliente Existente vs Nuevo')}</strong>
                    <span>{t('settings.flow.steps.existingVsNewDesc', 'Si existe en BD, saluda y asigna agente. Si es nuevo, continua flujo')}</span>
                  </div>
                </div>
                <div className="flow-arrow">
                  <span className="material-icons">arrow_downward</span>
                </div>
                <div className="flow-step">
                  <div className="flow-number">4</div>
                  <div className="flow-content">
                    <strong>{t('settings.flow.steps.previousInfo', 'Verificar Informacion Previa')}</strong>
                    <span>{t('settings.flow.steps.previousInfoDesc', 'Pregunta si ya le dieron precios. Si = asigna agente, No = pide ZIP')}</span>
                  </div>
                </div>
                <div className="flow-arrow">
                  <span className="material-icons">arrow_downward</span>
                </div>
                <div className="flow-step">
                  <div className="flow-number">5</div>
                  <div className="flow-content">
                    <strong>{t('settings.flow.steps.coverageValidation', 'Validacion de Cobertura')}</strong>
                    <span>{t('settings.flow.steps.coverageValidationDesc', 'Valida ZIP/ciudad y responde con cobertura o sin cobertura')}</span>
                  </div>
                </div>
                <div className="flow-arrow">
                  <span className="material-icons">arrow_downward</span>
                </div>
                <div className="flow-step">
                  <div className="flow-number">6</div>
                  <div className="flow-content">
                    <strong>{t('settings.flow.steps.productMenu', 'Menu de Productos')}</strong>
                    <span>{t('settings.flow.steps.productMenuDesc', 'Si hay cobertura, muestra productos disponibles')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-card">
              <h3>
                <span className="material-icons">schedule</span>
                {t('settings.flow.businessHoursTitle', 'Horario de Atencion')}
              </h3>
              <p className="description">{t('settings.flow.businessHoursDesc', 'Configura cuando el chatbot responde automaticamente')}</p>
              
              <div className="checkbox-row">
                <label>
                  <input
                    type="checkbox"
                    checked={form.business_hours_enabled}
                    onChange={(e) => handleInputChange('business_hours_enabled', e.target.checked)}
                  />
                  <span>{t('settings.flow.enableBusinessHours', 'Activar verificacion de horario')}</span>
                </label>
              </div>

              {form.business_hours_enabled && (
                <>
                  <div className="field-row">
                    <div className="field-group">
                      <label>{t('settings.flow.startTime', 'Hora inicio')}</label>
                      <input
                        type="time"
                        value={form.business_hours_start}
                        onChange={(e) => handleInputChange('business_hours_start', e.target.value)}
                      />
                    </div>
                    <div className="field-group">
                      <label>{t('settings.flow.endTime', 'Hora fin')}</label>
                      <input
                        type="time"
                        value={form.business_hours_end}
                        onChange={(e) => handleInputChange('business_hours_end', e.target.value)}
                      />
                    </div>
                    <div className="field-group">
                      <label>{t('account.languageLabel')}</label>
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
                    <label>{t('settings.flow.businessDays', 'Dias de atencion')}</label>
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
                    <label>{t('settings.flow.outOfHoursMessage', 'Mensaje fuera de horario')}</label>
                    <textarea
                      rows={3}
                      value={form.out_of_hours_message}
                      onChange={(e) => handleInputChange('out_of_hours_message', e.target.value)}
                      placeholder={t('settings.flow.outOfHoursPlaceholder', 'Gracias por contactarnos. Nuestro horario de atencion es de Lunes a Viernes de 9am a 6pm...')}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="settings-card">
              <h3>
                <span className="material-icons">people</span>
                {t('settings.agents.title', 'Agentes por Servicio')}
              </h3>
              <p className="description">{t('settings.agents.description', 'Configura agentes para diferentes servicios (Area 862, IprintPOS, etc.)')}</p>
              
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setEditingAgent(null)
                  setAgentForm({ agent_id: '', agent_name: '', agent_email: '', service_name: '', products: [], is_default: false })
                  setShowAgentForm(true)
                }}
                style={{ marginBottom: '1rem' }}
              >
                <span className="material-icons">add</span>
                {t('settings.agents.addAction', 'Agregar Agente')}
              </button>

              {showAgentForm && (
                <div className="agent-form-modal" style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                  <h4>{editingAgent ? t('settings.agents.editTitle', 'Editar Agente') : t('settings.agents.newTitle', 'Nuevo Agente')}</h4>
                  <div className="field-row">
                    <div className="field-group">
                      <label>{t('settings.agents.nameLabel', 'Nombre del Agente *')}</label>
                      <input
                        type="text"
                        value={agentForm.agent_name}
                        onChange={(e) => setAgentForm({...agentForm, agent_name: e.target.value})}
                        placeholder={t('settings.agents.namePlaceholder', 'Ej: Felipe Delgado')}
                      />
                    </div>
                    <div className="field-group">
                      <label>{t('settings.agents.serviceLabel', 'Servicio *')}</label>
                      <input
                        type="text"
                        value={agentForm.service_name}
                        onChange={(e) => setAgentForm({...agentForm, service_name: e.target.value})}
                        placeholder={t('settings.agents.servicePlaceholder', 'Ej: Area 862, IprintPOS')}
                      />
                    </div>
                  </div>
                  <div className="field-row">
                    <div className="field-group">
                      <label>{t('wholesale.form.respondId', 'ID de Contacto en Respond.io (opcional)')}</label>
                      <input
                        type="text"
                        value={agentForm.agent_id}
                        onChange={(e) => setAgentForm({...agentForm, agent_id: e.target.value})}
                        placeholder="Ej: 123456"
                      />
                    </div>
                    <div className="field-group">
                      <label>{t('common.email')}</label>
                      <input
                        type="email"
                        value={agentForm.agent_email}
                        onChange={(e) => setAgentForm({...agentForm, agent_email: e.target.value})}
                        placeholder="agente@email.com"
                      />
                    </div>
                  </div>
                  <div className="field-group">
                    <label>{t('settings.agents.productsLabel', 'Productos que maneja (separados por coma)')}</label>
                    <input
                      type="text"
                      value={agentForm.products.join(',')}
                      onChange={(e) => setAgentForm({...agentForm, products: e.target.value.split(',').map(p => p.trim()).filter(p => p)})}
                      placeholder="Tarjetas, Magneticos, Playeras"
                    />
                  </div>
                  <div className="checkbox-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={agentForm.is_default}
                        onChange={(e) => setAgentForm({...agentForm, is_default: e.target.checked})}
                      />
                      <span>{t('settings.agents.defaultAgentLabel', 'Agente por defecto para este servicio')}</span>
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button className="btn btn-primary" onClick={handleSaveAgent}>
                      {editingAgent ? t('common.saveChanges') : t('common.add')}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowAgentForm(false)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              )}

              {agents.length > 0 ? (
                <div className="agents-list">
                  {Object.entries(agents.reduce((acc, agent) => {
                    if (!acc[agent.service_name]) acc[agent.service_name] = []
                    acc[agent.service_name].push(agent)
                    return acc
                  }, {})).map(([serviceName, serviceAgents]) => (
                    <div key={serviceName} className="service-group" style={{ marginBottom: '1rem' }}>
                      <h4 style={{ color: '#1976d2', marginBottom: '0.5rem' }}>{serviceName}</h4>
                      {serviceAgents.map(agent => (
                        <div key={agent.id} className="agent-item" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem', background: '#fff', borderRadius: '4px', marginBottom: '0.25rem' }}>
                          <span className="material-icons" style={{ color: agent.is_default ? '#4caf50' : '#9e9e9e' }}>
                            {agent.is_default ? 'star' : 'person'}
                          </span>
                          <div style={{ flex: 1 }}>
                            <strong>{agent.agent_name}</strong>
                            {agent.products?.length > 0 && (
                              <span style={{ fontSize: '0.85rem', color: '#666', marginLeft: '0.5rem' }}>
                                ({agent.products.join(', ')})
                              </span>
                            )}
                          </div>
                          <button className="btn-icon" onClick={() => handleEditAgent(agent)} title={t('common.edit')}>
                            <span className="material-icons">edit</span>
                          </button>
                          <button className="btn-icon" onClick={() => handleDeleteAgent(agent.id)} title={t('common.delete')}>
                            <span className="material-icons">delete</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#666', fontStyle: 'italic' }}>{t('settings.agents.empty', 'No hay agentes configurados. Agrega uno para asignar conversaciones automaticamente.')}</p>
              )}
            </div>

            <div className="settings-card">
              <h3>
                <span className="material-icons">label_off</span>
                {t('settings.flow.excludedTagsTitle', 'Tags Excluidos')}
              </h3>
              <p className="description">{t('settings.flow.excludedTagsDesc', 'Contactos con estos tags no seran atendidos por el chatbot')}</p>
              
              <div className="field-group">
                <label>{t('settings.flow.tagsLabel', 'Tags (separados por coma)')}</label>
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
                <span className="material-icons">science</span>
                {t('settings.flow.testModeTitle', 'Modo de Prueba')}
              </h3>
              <p className="description">{t('settings.flow.testModeDesc', 'Prueba el chatbot con un solo contacto especifico')}</p>
              
              <div className="toggle-row">
                <label>
                  <input
                    type="checkbox"
                    checked={form.test_mode}
                    onChange={(e) => handleInputChange('test_mode', e.target.checked)}
                  />
                  {t('settings.flow.enableTestMode', 'Activar modo de prueba')}
                </label>
              </div>

              {form.test_mode && (
                <div className="field-group">
                  <label>{t('settings.flow.testContactId', 'ID del Contacto de Prueba')}</label>
                  <input
                    type="text"
                    value={form.test_contact_id}
                    onChange={(e) => handleInputChange('test_contact_id', e.target.value)}
                    placeholder="Ej: 12345678 o id:12345678"
                  />
                  <small className="hint">
                    {t('settings.flow.testContactHint', 'Solo este contacto sera procesado por el chatbot. Obten el ID desde Respond.io.')}
                  </small>
                </div>
              )}

              {form.test_mode && form.test_contact_id && (
                <div className="test-mode-section">
                  <div className="test-mode-active">
                    <span className="material-icons">warning</span>
                    {t('settings.flow.testModeActive', 'MODO PRUEBA ACTIVO - Solo contacto: {{id}}', { id: form.test_contact_id })}
                  </div>
                  <button
                    type="button"
                    className="btn-reset-test"
                    onClick={async () => {
                      if (confirm(t('settings.flow.resetTestConfirm', 'Esto reiniciara el historial de conversacion del contacto de prueba. El flujo iniciara cuando envies un nuevo mensaje. ¿Continuar?'))) {
                        try {
                          const result = await resetTest();
                          alert(result.message || t('settings.flow.resetTestSuccess', 'Historial reiniciado correctamente'));
                        } catch (err) {
                          alert(t('common.error') + ': ' + (err.response?.data?.error || err.message));
                        }
                      }
                    }}
                  >
                    <span className="material-icons">refresh</span>
                    {t('settings.flow.resetTestAction', 'Reiniciar Prueba')}
                  </button>
                </div>
              )}
            </div>

            <div className="settings-card">
              <h3>
                <span className="material-icons">inventory_2</span>
                {t('settings.flow.productMenuTitle', 'Menu de Productos')}
              </h3>
              <p className="description">{t('settings.flow.productMenuDescription', 'Productos que el chatbot ofrece a los clientes')}</p>

              <div className="field-group">
                <label>{t('settings.flow.addProductLabel', 'Agregar nuevo producto')}</label>
                <div className="add-product-row">
                  <input
                    type="text"
                    id="new-product-name"
                    placeholder={t('settings.flow.productNamePlaceholder', 'Nombre del producto (ej: Tarjetas)')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const name = e.target.value.trim();
                        if (name) {
                          const currentProducts = form.products_list || [];
                          handleInputChange('products_list', [...currentProducts, { name, message: '' }]);
                          e.target.value = '';
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-add-product"
                    onClick={() => {
                      const input = document.getElementById('new-product-name');
                      const name = input.value.trim();
                      if (name) {
                        const currentProducts = form.products_list || [];
                        handleInputChange('products_list', [...currentProducts, { name, message: '' }]);
                        input.value = '';
                      }
                    }}
                  >
                    <span className="material-icons">add</span>
                    Agregar
                  </button>
                </div>
              </div>

              {form.products_list && form.products_list.length > 0 && (
                <div className="products-config-list">
                  {form.products_list.map((product, index) => (
                    <div key={index} className="product-config-item">
                      <div className="product-header">
                        <span className="product-number">{index + 1}</span>
                        <span className="product-name">{product.name}</span>
                        <button
                          type="button"
                          className="btn-remove-product"
                          onClick={() => {
                            const newList = form.products_list.filter((_, i) => i !== index);
                            handleInputChange('products_list', newList);
                          }}
                        >
                          <span className="material-icons">delete</span>
                        </button>
                      </div>
                      <div className="product-message-field">
                        <label>{t('settings.flow.productInfoMsg', {name: product.name})}</label>
                        <textarea
                          rows={3}
                          value={product.message || ''}
                          onChange={(e) => {
                            const newList = [...form.products_list];
                            newList[index] = { ...newList[index], message: e.target.value };
                            handleInputChange('products_list', newList);
                          }}
                          placeholder={`Informacion sobre ${product.name}...\nPrecios, caracteristicas, etc.`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {form.products_list && form.products_list.length > 0 && (
                <div className="menu-preview" style={{ marginTop: '16px' }}>
                  <label>{t('settings.flow.productMenuMsg')}</label>
                  <div className="preview-box">
                    {form.products_list.map((p, i) => `${i + 1}. ${p.name}`).join('\n')}
                  </div>
                </div>
              )}

            </div>
          </>
        )}

        {activeTab === 'messages' && (
          <>
            <div className="settings-card">
              <h3>
                <span className="material-icons">waving_hand</span>
                {t('settings.messages.welcomeTitle')}
              </h3>
              
              <div className="field-group">
                <label>{t('settings.messages.welcomeExisting')}</label>
                <textarea
                  rows={3}
                  value={form.welcome_existing_customer}
                  onChange={(e) => handleInputChange('welcome_existing_customer', e.target.value)}
                  placeholder="Hola! Que gusto verte de nuevo. Un agente te atendera en breve..."
                />
              </div>

              <div className="field-group">
                <label>{t('settings.messages.welcomeNew')}</label>
                <textarea
                  rows={3}
                  value={form.welcome_new_customer}
                  onChange={(e) => handleInputChange('welcome_new_customer', e.target.value)}
                  placeholder="Hola! Bienvenido. Antes de continuar, ¿ya le brindaron informacion sobre precios?"
                />
              </div>

              <div className="field-group">
                <label>{t('settings.messages.hasInfoResponse')}</label>
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
                {t('settings.messages.zipTitle')}
              </h3>
              
              <div className="field-group">
                <label>{t('settings.messages.requestZip')}</label>
                <textarea
                  rows={3}
                  value={form.request_zip_message}
                  onChange={(e) => handleInputChange('request_zip_message', e.target.value)}
                  placeholder="Por favor proporcioname tu codigo postal para verificar cobertura..."
                />
              </div>

              <div className="field-group">
                <label>{t('settings.messages.remindZip')}</label>
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
                {t('settings.messages.coverageTitle')}
              </h3>
              
              <div className="field-group">
                <label>{t('settings.messages.coverageConfirmed')}</label>
                <textarea
                  rows={3}
                  value={form.coverage_message}
                  onChange={(e) => handleInputChange('coverage_message', e.target.value)}
                  placeholder="Excelente! Tenemos cobertura en tu zona..."
                />
              </div>

              <div className="field-group">
                <label>{t('settings.messages.noCoverage')}</label>
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
                {t('settings.messages.ordersTitle')}
              </h3>
              
              <div className="field-group">
                <label>{t('settings.messages.orderConfirmed')}</label>
                <textarea
                  rows={3}
                  value={form.order_confirmed_message}
                  onChange={(e) => handleInputChange('order_confirmed_message', e.target.value)}
                />
              </div>

              <div className="field-group">
                <label>{t('settings.messages.driverAssigned')}</label>
                <textarea
                  rows={3}
                  value={form.driver_assigned_message}
                  onChange={(e) => handleInputChange('driver_assigned_message', e.target.value)}
                />
              </div>

              <div className="field-group">
                <label>{t('settings.messages.orderCompleted')}</label>
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
                <span className="material-icons">timer</span>
                {t('settings.automation.followupTitle')}
              </h3>
              <p className="description">{t('settings.automation.followupDesc')}</p>
              
              <div className="checkbox-row">
                <label>
                  <input
                    type="checkbox"
                    checked={form.followup_enabled}
                    onChange={(e) => handleInputChange('followup_enabled', e.target.checked)}
                  />
                  <span>{t('settings.automation.enableFollowup')}</span>
                </label>
              </div>

              {form.followup_enabled && (
                <>
                  <div className="field-group">
                    <label>{t('settings.automation.timeoutLabel')}</label>
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      value={form.followup_timeout_minutes}
                      onChange={(e) => handleInputChange('followup_timeout_minutes', parseInt(e.target.value) || 5)}
                    />
                    <small style={{color: '#aaa', marginTop: '4px', display: 'block'}}>
                      {t('settings.automation.timeoutHint')}
                    </small>
                  </div>

                  <div className="field-group">
                    <label>{t('settings.automation.firstFollowup')}</label>
                    <textarea
                      rows={3}
                      value={form.followup_message}
                      onChange={(e) => handleInputChange('followup_message', e.target.value)}
                      placeholder="Hola! Sigues ahi? Quedamos pendientes de nuestra conversacion..."
                    />
                    <small style={{color: '#aaa', marginTop: '4px', display: 'block'}}>
                      {t('settings.automation.firstFollowupHint')}
                    </small>
                  </div>

                  <div className="field-group">
                    <label>{t('settings.automation.secondFollowup')}</label>
                    <textarea
                      rows={3}
                      value={form.followup_message_2}
                      onChange={(e) => handleInputChange('followup_message_2', e.target.value)}
                      placeholder="Hola de nuevo! Como no recibimos respuesta, pausaremos la conversacion..."
                    />
                    <small style={{color: '#aaa', marginTop: '4px', display: 'block'}}>
                      {t('settings.automation.secondFollowupHint')}
                    </small>
                  </div>
                </>
              )}
            </div>

            <div className="settings-card">
              <h3>
                <span className="material-icons">auto_fix_high</span>
                {t('settings.automation.automationTitle')}
              </h3>
              
              <div className="checkbox-row">
                <label>
                  <input
                    type="checkbox"
                    checked={form.auto_validate_addresses}
                    onChange={(e) => handleInputChange('auto_validate_addresses', e.target.checked)}
                  />
                  <span>{t('settings.automation.validateAddresses')}</span>
                </label>
              </div>
              
              <div className="checkbox-row">
                <label>
                  <input
                    type="checkbox"
                    checked={form.auto_respond_coverage}
                    onChange={(e) => handleInputChange('auto_respond_coverage', e.target.checked)}
                  />
                  <span>{t('settings.automation.autoRespondCoverage')}</span>
                </label>
              </div>
              
              <div className="checkbox-row">
                <label>
                  <input
                    type="checkbox"
                    checked={form.auto_respond_no_coverage}
                    onChange={(e) => handleInputChange('auto_respond_no_coverage', e.target.checked)}
                  />
                  <span>{t('settings.automation.autoRespondNoCoverage')}</span>
                </label>
              </div>
            </div>
          </>
        )}
        {activeTab === 'ia' && (
          <>
            <div className="settings-card">
              <h3>
                <span className="material-icons" style={{color: '#a78bfa'}}>psychology</span>
                {t('settings.ai.title')}
              </h3>
              <p className="description">
                {t('settings.ai.description')}
              </p>

              <div className="checkbox-row" style={{marginBottom: '20px'}}>
                <label>
                  <input
                    type="checkbox"
                    checked={form.ai_enabled}
                    onChange={(e) => handleInputChange('ai_enabled', e.target.checked)}
                  />
                  <span style={{fontWeight: 600}}>{t('settings.ai.enable')}</span>
                </label>
              </div>

              {form.ai_enabled && (
                <>
                  {hasOpenAIKey && (
                    <div style={{background: '#052e16', border: '1px solid #16a34a', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <span className="material-icons" style={{color: '#4ade80'}}>verified</span>
                      <div>
                        <strong style={{color: '#4ade80'}}>{t('settings.ai.apiKeyConfigured')}</strong>
                        <p style={{color: '#86efac', margin: '2px 0 0', fontSize: '13px'}}>{t('settings.ai.apiKeyActive')}</p>
                      </div>
                    </div>
                  )}
                  <div className="field-group">
                    <label>{t('settings.ai.apiKeyLabel')} {hasOpenAIKey ? t('settings.ai.apiKeyOptional') : ''}</label>
                    <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                      <input
                        type={showOpenAIKey ? 'text' : 'password'}
                        value={form.openai_api_key}
                        onChange={(e) => handleInputChange('openai_api_key', e.target.value)}
                        placeholder={hasOpenAIKey ? '••••••••••••••••••••••• (ya configurada)' : 'sk-proj-...'}
                        style={{flex: 1}}
                      />
                      <button
                        type="button"
                        onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                        style={{padding: '8px', background: '#2d2d2d', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer', color: '#fff'}}
                      >
                        <span className="material-icons" style={{fontSize: '18px'}}>
                          {showOpenAIKey ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                    {!hasOpenAIKey && (
                      <small style={{color: '#aaa', marginTop: '4px', display: 'block'}}>
                        {t('settings.ai.apiKeyHint')}
                      </small>
                    )}
                  </div>

                  <div style={{display: 'flex', gap: '12px', alignItems: 'center', marginTop: '16px'}}>
                    <button
                      className="btn-secondary"
                      onClick={handleTestOpenAI}
                      disabled={testingOpenAI || (!form.openai_api_key && !hasOpenAIKey)}
                    >
                      <span className="material-icons">bolt</span>
                      {testingOpenAI ? t('settings.ai.testing') : t('settings.ai.testAction')}
                    </button>
                    {openAIStatus === 'ok' && (
                      <span style={{color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px'}}>
                        <span className="material-icons">check_circle</span>
                        {t('settings.ai.testOk')}
                      </span>
                    )}
                    {openAIStatus === 'error' && (
                      <span style={{color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px'}}>
                        <span className="material-icons">error</span>
                        {t('settings.ai.testError')}
                      </span>
                    )}
                  </div>

                  <div style={{marginTop: '24px', padding: '16px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px'}}>
                    <div className="checkbox-row" style={{marginBottom: '8px'}}>
                      <label>
                        <input
                          type="checkbox"
                          checked={form.conversational_mode}
                          onChange={(e) => handleInputChange('conversational_mode', e.target.checked)}
                        />
                        <span style={{fontWeight: 600, color: '#fbbf24'}}>{t('settings.ai.conversationalTitle')}</span>
                      </label>
                    </div>
                    <p style={{color: '#cbd5e1', fontSize: '13px', margin: '4px 0 0 26px', lineHeight: '1.5'}}>
                      {t('settings.ai.conversationalDesc')}
                    </p>
                  </div>
                </>
              )}
            </div>

            {form.ai_enabled && (
              <>
                <div className="settings-card">
                  <h3>
                    <span className="material-icons" style={{color: '#60a5fa'}}>auto_awesome</span>
                    {t('settings.ai.capabilitiesTitle')}
                  </h3>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px'}}>
                    <div style={{display: 'flex', gap: '12px', alignItems: 'flex-start'}}>
                      <span className="material-icons" style={{color: '#4ade80', flexShrink: 0}}>check_circle</span>
                      <div>
                        <strong>{t('settings.ai.cap1Title')}</strong>
                        <p style={{color: '#aaa', margin: '2px 0 0', fontSize: '13px'}}>{t('settings.ai.cap1Desc')}</p>
                      </div>
                    </div>
                    <div style={{display: 'flex', gap: '12px', alignItems: 'flex-start'}}>
                      <span className="material-icons" style={{color: '#4ade80', flexShrink: 0}}>check_circle</span>
                      <div>
                        <strong>{t('settings.ai.cap2Title')}</strong>
                        <p style={{color: '#aaa', margin: '2px 0 0', fontSize: '13px'}}>{t('settings.ai.cap2Desc')}</p>
                      </div>
                    </div>
                    <div style={{display: 'flex', gap: '12px', alignItems: 'flex-start'}}>
                      <span className="material-icons" style={{color: '#4ade80', flexShrink: 0}}>check_circle</span>
                      <div>
                        <strong>{t('settings.ai.cap3Title')}</strong>
                        <p style={{color: '#aaa', margin: '2px 0 0', fontSize: '13px'}}>{t('settings.ai.cap3Desc')}</p>
                      </div>
                    </div>
                    <div style={{display: 'flex', gap: '12px', alignItems: 'flex-start'}}>
                      <span className="material-icons" style={{color: '#4ade80', flexShrink: 0}}>check_circle</span>
                      <div>
                        <strong>{t('settings.ai.cap4Title')}</strong>
                        <p style={{color: '#aaa', margin: '2px 0 0', fontSize: '13px'}}>{t('settings.ai.cap4Desc')}</p>
                      </div>
                    </div>
                    <div style={{display: 'flex', gap: '12px', alignItems: 'flex-start'}}>
                      <span className="material-icons" style={{color: '#f59e0b', flexShrink: 0}}>info</span>
                      <div>
                        <strong>{t('settings.ai.cap5Title')}</strong>
                        <p style={{color: '#aaa', margin: '2px 0 0', fontSize: '13px'}}>{t('settings.ai.cap5Desc')}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="settings-card">
                  <h3>
                    <span className="material-icons" style={{color: '#f59e0b'}}>attach_money</span>
                    {t('settings.ai.costTitle')}
                  </h3>
                  <p className="description">{t('settings.ai.costDesc')}</p>
                  <div style={{background: '#1a1a1a', borderRadius: '8px', padding: '16px', marginTop: '12px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                      <span style={{color: '#aaa'}}>{t('settings.ai.cost1k')}</span>
                      <span style={{color: '#4ade80', fontWeight: 600}}>~$0.50 USD</span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                      <span style={{color: '#aaa'}}>{t('settings.ai.costMonthlyLow')}</span>
                      <span style={{color: '#4ade80', fontWeight: 600}}>$1 - $5 USD</span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span style={{color: '#aaa'}}>{t('settings.ai.costMonthlyHigh')}</span>
                      <span style={{color: '#f59e0b', fontWeight: 600}}>$10 - $30 USD</span>
                    </div>
                  </div>
                  <small style={{color: '#666', marginTop: '8px', display: 'block'}}>
                    {t('settings.ai.costNote')}
                  </small>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="settings-footer">
        <button className="btn-primary btn-large" onClick={handleSave} disabled={saving}>
          <span className="material-icons">save</span>
          {saving ? t('settings.saving') : t('settings.save')}
        </button>
      </div>
    </div>
  )
}
