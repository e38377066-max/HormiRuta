import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api'
import './AdminPages.css'

const CONTEXT_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'greeting', label: 'Saludo' },
  { value: 'product', label: 'Producto' },
  { value: 'zip', label: 'Código Postal' },
  { value: 'design', label: 'Diseño' },
  { value: 'frustration', label: 'Frustración' },
  { value: 'correction', label: 'Corrección' },
  { value: 'pattern', label: 'Patrón' },
]

function ContextBadge({ type }) {
  const colors = {
    general: '#64748b',
    greeting: '#22c55e',
    product: '#3b82f6',
    zip: '#f59e0b',
    design: '#a855f7',
    frustration: '#ef4444',
    correction: '#f97316',
    pattern: '#06b6d4',
  }
  const labels = {
    general: 'General', greeting: 'Saludo', product: 'Producto',
    zip: 'ZIP', design: 'Diseño', frustration: 'Frustración',
    correction: 'Corrección', pattern: 'Patrón'
  }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: colors[type] + '22',
      color: colors[type],
      border: `1px solid ${colors[type]}44`
    }}>
      {labels[type] || type}
    </span>
  )
}

export default function BotMemoryPage() {
  const navigate = useNavigate()
  const [memories, setMemories] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('active')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ lesson: '', context_type: 'general', trigger_example: '' })
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState(null)
  const [analyzeError, setAnalyzeError] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [statsRes, memRes] = await Promise.all([
        api.get('/api/bot-memory/stats'),
        api.get('/api/bot-memory')
      ])
      setStats(statsRes.data)
      setMemories(memRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id) => {
    try {
      await api.put(`/api/bot-memory/${id}`, { is_approved: true })
      await loadData()
    } catch (e) { alert('Error aprobando lección') }
  }

  const handleToggleActive = async (mem) => {
    try {
      await api.put(`/api/bot-memory/${mem.id}`, { is_active: !mem.is_active })
      await loadData()
    } catch (e) { alert('Error actualizando') }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta lección?')) return
    try {
      await api.delete(`/api/bot-memory/${id}`)
      await loadData()
    } catch (e) { alert('Error eliminando') }
  }

  const handleEdit = (mem) => {
    setEditingId(mem.id)
    setForm({ lesson: mem.lesson, context_type: mem.context_type, trigger_example: mem.trigger_example || '' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.lesson.trim()) return alert('La lección no puede estar vacía')
    setSaving(true)
    try {
      if (editingId) {
        await api.put(`/api/bot-memory/${editingId}`, form)
      } else {
        await api.post('/api/bot-memory', form)
      }
      setShowForm(false)
      setEditingId(null)
      setForm({ lesson: '', context_type: 'general', trigger_example: '' })
      await loadData()
    } catch (e) {
      alert('Error guardando')
    } finally {
      setSaving(false)
    }
  }

  const handleAnalyzeHistory = async () => {
    if (!confirm('¿Analizar el historial completo de Respond.io? Esto puede tardar varios minutos dependiendo de la cantidad de contactos.')) return
    setAnalyzing(true)
    setAnalyzeResult(null)
    setAnalyzeError(null)
    try {
      const res = await api.post('/api/bot-memory/analyze-history')
      setAnalyzeResult(res.data)
      await loadData()
    } catch (e) {
      setAnalyzeError(e.response?.data?.error || 'Error al analizar historial')
    } finally {
      setAnalyzing(false)
    }
  }

  const filteredMemories = memories.filter(m => {
    if (activeTab === 'pending') return m.source === 'auto_detected' && !m.is_approved
    if (activeTab === 'active') return m.is_approved && m.is_active
    if (activeTab === 'all') return true
    return true
  })

  if (loading) return (
    <div className="page-container">
      <div className="loading-container"><div className="spinner" /></div>
    </div>
  )

  return (
    <div className="page-container">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/admin')}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1>Memoria del Bot Area862</h1>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card blue">
          <div className="stat-icon"><span className="material-icons">psychology</span></div>
          <div className="stat-value">{stats.active || 0}</div>
          <div className="stat-label">Lecciones Activas</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-icon"><span className="material-icons">pending_actions</span></div>
          <div className="stat-value">{stats.pending || 0}</div>
          <div className="stat-label">Pendientes de Revisión</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon"><span className="material-icons">edit_note</span></div>
          <div className="stat-value">{stats.manual || 0}</div>
          <div className="stat-label">Manuales</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon"><span className="material-icons">auto_fix_high</span></div>
          <div className="stat-value">{stats.total || 0}</div>
          <div className="stat-label">Total</div>
        </div>
      </div>

      {/* Botones de acción */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className="btn-primary"
          onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ lesson: '', context_type: 'general', trigger_example: '' }) }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px' }}
        >
          <span className="material-icons">{showForm ? 'close' : 'add'}</span>
          {showForm ? 'Cancelar' : 'Agregar Lección Manual'}
        </button>

        <button
          onClick={handleAnalyzeHistory}
          disabled={analyzing}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
            background: analyzing ? '#1e293b' : 'linear-gradient(135deg, #a855f7, #7c3aed)',
            color: analyzing ? '#64748b' : '#fff',
            border: analyzing ? '1px solid #334155' : 'none',
            borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: analyzing ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {analyzing ? (
            <>
              <span className="material-icons" style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}>autorenew</span>
              Analizando conversaciones...
            </>
          ) : (
            <>
              <span className="material-icons" style={{ fontSize: 18 }}>manage_search</span>
              Analizar Historial de Chats
            </>
          )}
        </button>
      </div>

      {/* Resultado del análisis */}
      {analyzing && (
        <div style={{ marginBottom: 20, background: '#1e293b', borderRadius: 12, padding: 20, border: '1px solid #a855f744', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="material-icons" style={{ color: '#a855f7', fontSize: 32, animation: 'spin 2s linear infinite' }}>psychology</span>
          <div>
            <p style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: 4 }}>Analizando historial de conversaciones con IA...</p>
            <p style={{ color: '#64748b', fontSize: 13 }}>Esto puede tardar varios minutos. No cierres esta ventana.</p>
          </div>
        </div>
      )}

      {analyzeResult && !analyzing && (
        <div style={{ marginBottom: 20, background: '#1e293b', borderRadius: 12, padding: 20, border: '1px solid #22c55e44' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span className="material-icons" style={{ color: '#22c55e' }}>check_circle</span>
            <h4 style={{ color: '#e2e8f0', margin: 0 }}>Análisis completado</h4>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div style={{ background: '#0f172a', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#a855f7' }}>{analyzeResult.lessons_created}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Lecciones extraídas</div>
            </div>
            <div style={{ background: '#0f172a', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#5b8def' }}>{analyzeResult.contacts_analyzed}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Conversaciones analizadas</div>
            </div>
            <div style={{ background: '#0f172a', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#94a3b8' }}>{analyzeResult.total_contacts}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Contactos totales</div>
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{analyzeResult.message}</p>
          {analyzeResult.lessons_created > 0 && (
            <p style={{ color: '#f59e0b', fontSize: 13, marginTop: 8 }}>
              Las lecciones nuevas están en la pestaña <strong>Pendientes</strong> para que las revises y apruebes.
            </p>
          )}
          <button onClick={() => setAnalyzeResult(null)} style={{ marginTop: 12, background: 'none', border: 'none', color: '#475569', fontSize: 12, cursor: 'pointer' }}>
            Cerrar
          </button>
        </div>
      )}

      {analyzeError && !analyzing && (
        <div style={{ marginBottom: 20, background: '#1e293b', borderRadius: 12, padding: 20, border: '1px solid #ef444444' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span className="material-icons" style={{ color: '#ef4444' }}>error</span>
            <h4 style={{ color: '#e2e8f0', margin: 0 }}>Error en el análisis</h4>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{analyzeError}</p>
          <button onClick={() => setAnalyzeError(null)} style={{ marginTop: 12, background: 'none', border: 'none', color: '#475569', fontSize: 12, cursor: 'pointer' }}>
            Cerrar
          </button>
        </div>
      )}

      {/* Formulario */}
      {showForm && (
        <div className="admin-section" style={{ marginBottom: 24 }}>
          <div className="section-header">
            <span className="material-icons">school</span>
            <h3>{editingId ? 'Editar Lección' : 'Nueva Lección'}</h3>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>
                Tipo de contexto
              </label>
              <select
                value={form.context_type}
                onChange={e => setForm(f => ({ ...f, context_type: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', fontSize: 14 }}
              >
                {CONTEXT_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>
                Lección (lo que el bot debe aprender / hacer)
              </label>
              <textarea
                value={form.lesson}
                onChange={e => setForm(f => ({ ...f, lesson: e.target.value }))}
                placeholder="Ej: Cuando el cliente menciona 'playeras', preguntar siempre por la cantidad y el color antes de pasar a precios."
                rows={4}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>
                Ejemplo de mensaje del cliente (opcional)
              </label>
              <input
                type="text"
                value={form.trigger_example}
                onChange={e => setForm(f => ({ ...f, trigger_example: e.target.value }))}
                placeholder="Ej: 'quiero unas playeras azules'"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ alignSelf: 'flex-start', background: 'linear-gradient(135deg, #5b8def, #3b70d4)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Guardando...' : 'Guardar Lección'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #1e293b', paddingBottom: 12 }}>
        {[
          { key: 'active', label: 'Activas', count: stats.active },
          { key: 'pending', label: 'Pendientes', count: stats.pending },
          { key: 'all', label: 'Todas', count: stats.total },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: activeTab === tab.key ? '#5b8def' : '#1e293b',
              color: activeTab === tab.key ? '#fff' : '#94a3b8',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{ background: activeTab === tab.key ? 'rgba(255,255,255,0.3)' : '#334155', borderRadius: 20, padding: '1px 8px', fontSize: 11 }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista de memorias */}
      {filteredMemories.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
          <span className="material-icons" style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>
            {activeTab === 'pending' ? 'check_circle' : 'psychology'}
          </span>
          <p style={{ fontSize: 16, marginBottom: 4 }}>
            {activeTab === 'pending' ? 'No hay lecciones pendientes de revisión' : 'Sin lecciones aún'}
          </p>
          {activeTab === 'active' && (
            <p style={{ fontSize: 13, color: '#475569' }}>Agrega lecciones manuales o el bot las detectará automáticamente</p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredMemories.map(mem => (
            <div key={mem.id} style={{
              background: '#1e293b',
              borderRadius: 12,
              padding: 20,
              border: mem.source === 'auto_detected' && !mem.is_approved
                ? '1px solid #f97316aa'
                : mem.is_active && mem.is_approved ? '1px solid #22c55e33' : '1px solid #334155',
              opacity: !mem.is_active ? 0.5 : 1,
              position: 'relative'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <ContextBadge type={mem.context_type} />
                  {mem.source === 'auto_detected' && (
                    <span style={{ fontSize: 11, color: '#f97316', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span className="material-icons" style={{ fontSize: 13 }}>auto_fix_high</span>
                      Auto-detectada
                    </span>
                  )}
                  {mem.is_approved && mem.is_active && (
                    <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span className="material-icons" style={{ fontSize: 13 }}>check_circle</span>
                      Activa
                    </span>
                  )}
                  {!mem.is_approved && (
                    <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span className="material-icons" style={{ fontSize: 13 }}>pending</span>
                      Pendiente aprobación
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: '#475569', flexShrink: 0 }}>
                  {new Date(mem.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>

              <p style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 1.6, marginBottom: mem.trigger_example ? 12 : 0 }}>
                {mem.lesson}
              </p>

              {mem.trigger_example && (
                <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 14px', marginBottom: 8, borderLeft: '3px solid #5b8def' }}>
                  <p style={{ color: '#64748b', fontSize: 11, marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Mensaje del cliente
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>"{mem.trigger_example}"</p>
                </div>
              )}

              {mem.agent_correction && (
                <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 14px', marginBottom: 8, borderLeft: '3px solid #22c55e' }}>
                  <p style={{ color: '#64748b', fontSize: 11, marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Respuesta del agente (referencia)
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>"{mem.agent_correction}"</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                {!mem.is_approved && (
                  <button
                    onClick={() => handleApprove(mem.id)}
                    style={{ background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <span className="material-icons" style={{ fontSize: 15 }}>check</span>
                    Aprobar y activar
                  </button>
                )}
                <button
                  onClick={() => handleEdit(mem)}
                  style={{ background: '#5b8def22', color: '#5b8def', border: '1px solid #5b8def44', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <span className="material-icons" style={{ fontSize: 15 }}>edit</span>
                  Editar
                </button>
                {mem.is_approved && (
                  <button
                    onClick={() => handleToggleActive(mem)}
                    style={{ background: mem.is_active ? '#ef444422' : '#22c55e22', color: mem.is_active ? '#ef4444' : '#22c55e', border: `1px solid ${mem.is_active ? '#ef444444' : '#22c55e44'}`, borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <span className="material-icons" style={{ fontSize: 15 }}>{mem.is_active ? 'pause' : 'play_arrow'}</span>
                    {mem.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(mem.id)}
                  style={{ background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <span className="material-icons" style={{ fontSize: 15 }}>delete</span>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div style={{ marginTop: 32, background: '#0f172a', borderRadius: 12, padding: 20, border: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span className="material-icons" style={{ color: '#5b8def' }}>info</span>
          <h4 style={{ color: '#e2e8f0', margin: 0 }}>¿Cómo funciona el auto-aprendizaje?</h4>
        </div>
        <ul style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
          <li>El bot guarda sus lecciones en la base de datos y las inyecta en su cerebro (IA) en cada conversación.</li>
          <li>Cuando un agente responde dentro de 3 minutos después del bot, el sistema detecta que posiblemente el bot cometió un error y genera una lección automática.</li>
          <li>Las lecciones auto-detectadas quedan en "Pendientes" hasta que tú las revises y apruebes.</li>
          <li>Las lecciones manuales que tú agregas se activan de inmediato.</li>
          <li>Con el tiempo, el bot se va puliendo solo basado en los patrones que van aprendiendo.</li>
        </ul>
      </div>
    </div>
  )
}
