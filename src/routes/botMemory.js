import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import BotMemory from '../models/BotMemory.js';
import BotKnowledge from '../models/BotKnowledge.js';
import MessagingSettings from '../models/MessagingSettings.js';
import RespondioService from '../services/respondio.js';
import AIService from '../services/aiService.js';
import { Op } from 'sequelize';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Solo se permiten archivos .txt o .md'));
  }
});

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'No autenticado' });
  next();
}

// GET /api/bot-memory — listar todas las memorias
router.get('/', requireAuth, async (req, res) => {
  try {
    const { source, is_approved, context_type } = req.query;
    const where = { user_id: req.session.userId };
    if (source) where.source = source;
    if (is_approved !== undefined) where.is_approved = is_approved === 'true';
    if (context_type) where.context_type = context_type;

    const memories = await BotMemory.findAll({
      where,
      order: [['created_at', 'DESC']]
    });
    res.json(memories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bot-memory/pending — lecciones auto-detectadas pendientes de revisión
router.get('/pending', requireAuth, async (req, res) => {
  try {
    const memories = await BotMemory.findAll({
      where: {
        user_id: req.session.userId,
        source: 'auto_detected',
        is_approved: false,
        is_active: true
      },
      order: [['created_at', 'DESC']]
    });
    res.json(memories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bot-memory/stats
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const total = await BotMemory.count({ where: { user_id: userId, is_active: true } });
    const active = await BotMemory.count({ where: { user_id: userId, is_active: true, is_approved: true } });
    const pending = await BotMemory.count({ where: { user_id: userId, source: 'auto_detected', is_approved: false, is_active: true } });
    const manual = await BotMemory.count({ where: { user_id: userId, source: 'manual', is_active: true } });
    res.json({ total, active, pending, manual });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bot-memory/analyze-history — analiza el historial completo de Respond.io
router.post('/analyze-history', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  try {
    const settings = await MessagingSettings.findOne({
      where: { user_id: userId }
    }) || await MessagingSettings.findOne({ order: [['created_at', 'ASC']] });

    if (!settings?.respond_api_token) {
      return res.status(400).json({ error: 'No hay token de Respond.io configurado' });
    }

    const aiKey = settings.openai_api_key || process.env.OPENAI_API_KEY;
    if (!aiKey) {
      return res.status(400).json({ error: 'No hay clave de OpenAI configurada. Agrégala en Ajustes.' });
    }

    const respondio = new RespondioService(settings.respond_api_token);
    const ai = new AIService(aiKey, settings, userId);

    console.log(`[Bot-Memoria] Iniciando análisis de historial para usuario ${userId}...`);

    // --- 1. Obtener todos los contactos (paginated, max 200) ---
    let allContacts = [];
    let cursorId = null;
    let pageCount = 0;
    const maxContacts = 200;

    while (allContacts.length < maxContacts) {
      const result = await respondio.listContacts({ limit: 99, cursorId });
      if (!result.success || !result.items?.length) break;
      allContacts = [...allContacts, ...result.items];
      pageCount++;
      if (!result.pagination?.nextCursor || result.items.length < 99) break;
      cursorId = result.pagination.nextCursor;
    }

    console.log(`[Bot-Memoria] ${allContacts.length} contactos obtenidos para análisis`);

    if (allContacts.length === 0) {
      return res.json({ lessons_created: 0, contacts_analyzed: 0, message: 'No se encontraron contactos en Respond.io' });
    }

    // --- 2. Para cada contacto, obtener su historial ---
    const conversationSnippets = [];
    let contactsWithHistory = 0;

    for (const contact of allContacts) {
      try {
        const msgResult = await respondio.listMessages(contact.id, { limit: 30 });
        if (!msgResult.success || !msgResult.items?.length) continue;

        const msgs = msgResult.items;
        const clientName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Cliente';

        // Filtrar y clasificar mensajes
        const conversationLines = [];
        for (const msg of [...msgs].reverse()) {
          const text = msg.message?.text || '';
          if (!text.trim()) continue;

          const traffic = msg.traffic || '';
          const senderSource = msg.sender?.source || '';

          if (traffic === 'incoming') {
            // Mensaje del cliente
            conversationLines.push(`CLIENTE: ${text.substring(0, 200)}`);
          } else if (traffic === 'outgoing' && senderSource === 'user') {
            // Respuesta del agente humano
            conversationLines.push(`AGENTE: ${text.substring(0, 200)}`);
          }
          // Ignorar mensajes del bot/automáticos
        }

        if (conversationLines.length >= 2) {
          conversationSnippets.push({
            contact: clientName,
            lines: conversationLines
          });
          contactsWithHistory++;
        }
      } catch (e) {
        // Continúa con el siguiente contacto
      }
    }

    console.log(`[Bot-Memoria] ${contactsWithHistory} conversaciones con historial relevante`);

    if (conversationSnippets.length === 0) {
      return res.json({ lessons_created: 0, contacts_analyzed: contactsWithHistory, message: 'No se encontraron conversaciones con suficiente historial' });
    }

    // --- 3. Agrupar conversaciones en lotes y analizar con IA ---
    const BATCH_SIZE = 5; // Procesar 5 conversaciones por llamada a OpenAI
    const batches = [];
    for (let i = 0; i < conversationSnippets.length; i += BATCH_SIZE) {
      batches.push(conversationSnippets.slice(i, i + BATCH_SIZE));
    }

    let totalLessonsCreated = 0;
    const lessonsToSave = [];

    for (const batch of batches) {
      try {
        const transcriptText = batch.map((c, i) => {
          return `--- Conversación ${i + 1} (${c.contact}) ---\n${c.lines.join('\n')}`;
        }).join('\n\n');

        const analysisPrompt = `Eres un experto en análisis de conversaciones de ventas para Area 862 Graphics LLC, una empresa de impresión y diseño gráfico en Dallas, Texas que atiende clientes hispanohablantes.

Analiza estas conversaciones reales entre clientes y agentes de ventas:

${transcriptText}

Extrae EXACTAMENTE entre 3 y 6 lecciones concretas y accionables para mejorar el bot de atención automática. Enfócate en:
1. Cómo preguntan los diferentes tipos de clientes (patrones de lenguaje, expresiones coloquiales)
2. Qué respuestas de los agentes funcionaron mejor (¿qué decían para cerrar o avanzar?)
3. Qué confusiones o errores surgieron y cómo se resolvieron
4. Cuándo los clientes necesitan más información específica antes de continuar
5. Patrones de clientes indecisos vs clientes con pedido directo

Responde SOLO con un JSON válido (sin markdown, sin explicaciones).
Para "context_type" elige UNO SOLO de estos valores exactos: general, greeting, product, zip, design, frustration, correction, pattern

{
  "lessons": [
    {
      "lesson": "texto de la lección clara y accionable para el bot (en español)",
      "context_type": "general",
      "trigger_example": "ejemplo del mensaje del cliente que generó esta lección (opcional)"
    }
  ]
}`;

        const messages = [
          { role: 'system', content: 'Eres un experto en análisis de conversaciones de ventas. Respondes SOLO con JSON válido.' },
          { role: 'user', content: analysisPrompt }
        ];

        const response = await ai.callOpenAI(messages, 1000);
        if (!response.success || !response.content) continue;

        // Parsear JSON de respuesta
        let parsed;
        try {
          const jsonStr = response.content.trim().replace(/^```json?\s*/, '').replace(/\s*```$/, '');
          parsed = JSON.parse(jsonStr);
        } catch (parseErr) {
          console.error('[Bot-Memoria] Error parseando respuesta de IA:', parseErr.message);
          continue;
        }

        if (!parsed?.lessons?.length) continue;

        const validContextTypes = ['general', 'greeting', 'product', 'zip', 'design', 'frustration', 'correction', 'pattern'];

        for (const lesson of parsed.lessons) {
          if (!lesson.lesson?.trim()) continue;

          // Sanitizar context_type: tomar solo el primer valor si viene con pipes, y validar que sea válido
          let contextType = (lesson.context_type || 'general').split('|')[0].trim().toLowerCase();
          if (!validContextTypes.includes(contextType)) contextType = 'general';

          // Evitar duplicados exactos
          const exists = await BotMemory.findOne({
            where: {
              user_id: userId,
              lesson: lesson.lesson.trim().substring(0, 100)
            }
          });
          if (exists) continue;

          lessonsToSave.push({
            user_id: userId,
            lesson: lesson.lesson.trim(),
            context_type: contextType,
            trigger_example: lesson.trigger_example?.trim() || null,
            source: 'auto_detected',
            is_approved: false,
            is_active: true
          });
        }
      } catch (batchErr) {
        console.error('[Bot-Memoria] Error procesando lote:', batchErr.message);
      }
    }

    // Guardar todas las lecciones
    if (lessonsToSave.length > 0) {
      await BotMemory.bulkCreate(lessonsToSave);
      totalLessonsCreated = lessonsToSave.length;
    }

    console.log(`[Bot-Memoria] Análisis completado: ${contactsWithHistory} conversaciones → ${totalLessonsCreated} lecciones extraídas`);

    res.json({
      lessons_created: totalLessonsCreated,
      contacts_analyzed: contactsWithHistory,
      total_contacts: allContacts.length,
      message: `Análisis completado. Se extrajeron ${totalLessonsCreated} lecciones de ${contactsWithHistory} conversaciones.`
    });

  } catch (err) {
    console.error('[Bot-Memoria] Error en análisis de historial:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bot-memory — crear lección manual
router.post('/', requireAuth, async (req, res) => {
  try {
    const { lesson, context_type, trigger_example } = req.body;
    if (!lesson?.trim()) return res.status(400).json({ error: 'La lección no puede estar vacía' });

    const memory = await BotMemory.create({
      user_id: req.session.userId,
      lesson: lesson.trim(),
      context_type: context_type || 'general',
      trigger_example: trigger_example?.trim() || null,
      source: 'manual',
      is_approved: true,
      is_active: true
    });
    res.json(memory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/bot-memory/:id — editar o aprobar/rechazar
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const memory = await BotMemory.findOne({
      where: { id: req.params.id, user_id: req.session.userId }
    });
    if (!memory) return res.status(404).json({ error: 'No encontrado' });

    const { lesson, context_type, trigger_example, is_approved, is_active } = req.body;
    const updates = {};
    if (lesson !== undefined) updates.lesson = lesson.trim();
    if (context_type !== undefined) updates.context_type = context_type;
    if (trigger_example !== undefined) updates.trigger_example = trigger_example?.trim() || null;
    if (is_approved !== undefined) updates.is_approved = is_approved;
    if (is_active !== undefined) updates.is_active = is_active;

    await memory.update(updates);
    res.json(memory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bot-memory/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const memory = await BotMemory.findOne({
      where: { id: req.params.id, user_id: req.session.userId }
    });
    if (!memory) return res.status(404).json({ error: 'No encontrado' });
    await memory.destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== KNOWLEDGE (Documentos y Prompts) ====================

// GET /api/bot-memory/knowledge
router.get('/knowledge', requireAuth, async (req, res) => {
  try {
    const docs = await BotKnowledge.findAll({
      where: { user_id: req.session.userId },
      order: [['created_at', 'DESC']]
    });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bot-memory/knowledge — crear desde texto
router.post('/knowledge', requireAuth, async (req, res) => {
  try {
    const { title, content, knowledge_type } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'El título es obligatorio' });
    if (!content?.trim()) return res.status(400).json({ error: 'El contenido es obligatorio' });

    const doc = await BotKnowledge.create({
      user_id: req.session.userId,
      title: title.trim(),
      content: content.trim(),
      knowledge_type: knowledge_type || 'document',
      is_active: true
    });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bot-memory/knowledge/upload — subir archivo .txt
router.post('/knowledge/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

    const content = req.file.buffer.toString('utf8');
    if (!content.trim()) return res.status(400).json({ error: 'El archivo está vacío' });

    const title = req.body.title?.trim() || path.basename(req.file.originalname, path.extname(req.file.originalname));

    const doc = await BotKnowledge.create({
      user_id: req.session.userId,
      title,
      content: content.trim(),
      knowledge_type: req.body.knowledge_type || 'document',
      file_name: req.file.originalname,
      is_active: true
    });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/bot-memory/knowledge/:id
router.put('/knowledge/:id', requireAuth, async (req, res) => {
  try {
    const doc = await BotKnowledge.findOne({ where: { id: req.params.id, user_id: req.session.userId } });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });

    const { title, content, knowledge_type, is_active } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (content !== undefined) updates.content = content.trim();
    if (knowledge_type !== undefined) updates.knowledge_type = knowledge_type;
    if (is_active !== undefined) updates.is_active = is_active;

    await doc.update(updates);
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bot-memory/knowledge/:id
router.delete('/knowledge/:id', requireAuth, async (req, res) => {
  try {
    const doc = await BotKnowledge.findOne({ where: { id: req.params.id, user_id: req.session.userId } });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    await doc.destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
