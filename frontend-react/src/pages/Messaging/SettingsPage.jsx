import { useEffect, useState } from 'react'
import { useMessaging } from '../../contexts/MessagingContext'
import './MessagingPages.css'

export default function SettingsPage() {
  const { settings, fetchSettings, updateSettings, testConnection } = useMessaging()
  const [formData, setFormData] = useState({
    respondioToken: '',
    attentionMode: 'assisted',
    autoResponseCoverage: '',
    autoResponseNoCoverage: '',
    pollingInterval: 30
  })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await fetchSettings()
      if (data) {
        setFormData({
          respondioToken: data.respondioToken || '',
          attentionMode: data.attentionMode || 'assisted',
          autoResponseCoverage: data.autoResponseCoverage || '',
          autoResponseNoCoverage: data.autoResponseNoCoverage || '',
          pollingInterval: data.pollingInterval || 30
        })
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setSaved(false)
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testConnection()
      setTestResult({ success: true, message: result.message || 'Conexion exitosa' })
    } catch (error) {
      setTestResult({ success: false, message: error.response?.data?.error || 'Error de conexion' })
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateSettings(formData)
      setSaved(true)
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="messaging-page">
      <div className="page-header">
        <h1>Configuracion de Mensajeria</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card p-3 mb-3">
          <h3>Conexion Respond.io</h3>
          
          <div className="form-group mt-2">
            <label>API Token</label>
            <input
              type="password"
              name="respondioToken"
              className="input"
              value={formData.respondioToken}
              onChange={handleChange}
              placeholder="Ingresa tu token de Respond.io"
            />
          </div>

          <div className="flex gap-2 mt-2">
            <button 
              type="button" 
              className="btn btn-outline"
              onClick={handleTestConnection}
              disabled={testing || !formData.respondioToken}
            >
              {testing ? 'Probando...' : 'Probar Conexion'}
            </button>
          </div>

          {testResult && (
            <div className={`alert mt-2 ${testResult.success ? 'alert-success' : 'alert-error'}`}>
              {testResult.message}
            </div>
          )}
        </div>

        <div className="card p-3 mb-3">
          <h3>Modo de Atencion</h3>
          
          <div className="form-group mt-2">
            <label>Modo</label>
            <select
              name="attentionMode"
              className="input"
              value={formData.attentionMode}
              onChange={handleChange}
            >
              <option value="automatic">Automatico - Responde automaticamente</option>
              <option value="assisted">Asistido - Sugiere respuestas</option>
              <option value="manual">Manual - Sin automatizacion</option>
            </select>
          </div>

          <div className="form-group mt-2">
            <label>Intervalo de Polling (segundos)</label>
            <input
              type="number"
              name="pollingInterval"
              className="input"
              value={formData.pollingInterval}
              onChange={handleChange}
              min="10"
              max="300"
            />
          </div>
        </div>

        <div className="card p-3 mb-3">
          <h3>Respuestas Automaticas</h3>
          
          <div className="form-group mt-2">
            <label>Mensaje cuando HAY cobertura</label>
            <textarea
              name="autoResponseCoverage"
              className="input"
              rows={3}
              value={formData.autoResponseCoverage}
              onChange={handleChange}
              placeholder="Ej: Excelente! Tu direccion esta dentro de nuestra zona de cobertura..."
            />
          </div>

          <div className="form-group mt-2">
            <label>Mensaje cuando NO hay cobertura</label>
            <textarea
              name="autoResponseNoCoverage"
              className="input"
              rows={3}
              value={formData.autoResponseNoCoverage}
              onChange={handleChange}
              placeholder="Ej: Lo sentimos, actualmente no tenemos cobertura en tu zona..."
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar Configuracion'}
        </button>
      </form>
    </div>
  )
}
