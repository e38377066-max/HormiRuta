import https from 'https';
import axios from 'axios';
import FormData from 'form-data';
import BotMemory from '../models/BotMemory.js';
import BotKnowledge from '../models/BotKnowledge.js';

class AIService {
  constructor(apiKey, settings, userId = null) {
    this.apiKey = apiKey;
    this.settings = settings || {};
    this.isAvailable = !!apiKey;
    this.model = 'gpt-4o-mini';
    this.userId = userId;
    this._memoriesCache = null;
    this._memoriesCacheAt = 0;
    this._knowledgeCache = null;
    this._knowledgeCacheAt = 0;
  }

  // Carga las lecciones activas y aprobadas (con cache de 5 min para no abusar la DB)
  async loadActiveMemories(userId) {
    const now = Date.now();
    if (this._memoriesCache && (now - this._memoriesCacheAt) < 5 * 60 * 1000) {
      return this._memoriesCache;
    }
    try {
      const where = { is_active: true, is_approved: true };
      if (userId) where.user_id = userId;
      const memories = await BotMemory.findAll({ where, order: [['created_at', 'ASC']] });
      this._memoriesCache = memories;
      this._memoriesCacheAt = now;
      if (memories.length > 0) {
        await BotMemory.increment('times_applied', { by: 0, where }); // no-op to keep reference
      }
      return memories;
    } catch (e) {
      return [];
    }
  }

  invalidateMemoryCache() {
    this._memoriesCache = null;
    this._memoriesCacheAt = 0;
  }

  // Carga documentos de conocimiento activos (cache 5 min)
  async loadKnowledge(userId) {
    const now = Date.now();
    if (this._knowledgeCache && (now - this._knowledgeCacheAt) < 5 * 60 * 1000) {
      return this._knowledgeCache;
    }
    try {
      const where = { is_active: true };
      if (userId) where.user_id = userId;
      const docs = await BotKnowledge.findAll({ where, order: [['created_at', 'ASC']] });
      this._knowledgeCache = docs;
      this._knowledgeCacheAt = now;
      return docs;
    } catch (e) {
      return [];
    }
  }

  // Transcribe audio de WhatsApp usando OpenAI Whisper
  async transcribeAudio(audioUrl) {
    if (!this.isAvailable) return null;
    try {
      const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 15000 });
      const buffer = Buffer.from(audioResponse.data);

      const form = new FormData();
      form.append('file', buffer, { filename: 'audio.ogg', contentType: audioResponse.headers['content-type'] || 'audio/ogg' });
      form.append('model', 'whisper-1');
      form.append('language', 'es');

      const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${this.apiKey}`
        },
        timeout: 30000
      });

      const transcription = response.data?.text?.trim();
      console.log(`[AI-Audio] Transcripción: "${transcription?.substring(0, 80)}..."`);
      return transcription || null;
    } catch (e) {
      console.error('[AI-Audio] Error transcribiendo audio:', e.message);
      return null;
    }
  }

  // Analiza una imagen enviada por el cliente usando GPT-4o vision
  async describeImage(imageUrl) {
    if (!this.isAvailable) return null;
    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Describe en 1-2 líneas en español qué muestra esta imagen para una imprenta: ¿diseño/logo, producto impreso, referencia visual u otro? Sé muy breve.'
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl, detail: 'low' }
            }
          ]
        }]
      }, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      });

      const description = response.data?.choices?.[0]?.message?.content?.trim();
      console.log(`[AI-Vision] Imagen descrita: "${description?.substring(0, 80)}..."`);
      return description || null;
    } catch (e) {
      console.error('[AI-Vision] Error describiendo imagen:', e.message);
      return null;
    }
  }

  // Registra automáticamente una lección cuando el agente corrige al bot
  static async autoLearnFromCorrection(userId, contactId, botMessage, agentMessage) {
    try {
      if (!botMessage || !agentMessage) return;
      await BotMemory.create({
        user_id: userId,
        lesson: `Cuando el bot dijo: "${botMessage.substring(0, 200)}", el agente tuvo que intervenir y respondió: "${agentMessage.substring(0, 200)}". Aprende de este patrón para mejorar tu respuesta.`,
        context_type: 'correction',
        trigger_example: botMessage.substring(0, 300),
        bot_response_example: botMessage.substring(0, 500),
        agent_correction: agentMessage.substring(0, 500),
        source: 'auto_detected',
        is_approved: false,
        is_active: true,
        contact_id: contactId ? contactId.toString() : null
      });
      console.log(`[Bot-IA] Lección auto-detectada guardada para revisión (contacto ${contactId})`);
    } catch (e) {
      console.error('[Bot-IA] Error guardando lección auto-detectada:', e.message);
    }
  }

  getProductsList() {
    try {
      let products = this.settings?.products_list;
      if (typeof products === 'string') products = JSON.parse(products);
      if (Array.isArray(products) && products.length > 0) {
        return products.map(p => `- ${p.name}`).join('\n');
      }
      const fallbackProducts = this.settings?.products;
      if (Array.isArray(fallbackProducts) && fallbackProducts.length > 0) {
        return fallbackProducts.map(p => `- ${p.name}`).join('\n');
      }
    } catch (e) {}
    return `- Tarjetas de presentación (Business Cards)
- Magnéticos (Car Magnets)
- Post Cards / Postales
- Playeras (T-Shirts)
- Stickers / Calcomanías
- Banners
- Gráficos para vehículos (Vehicle Wraps / Lettering)
- Artículos promocionales (Gorras, Tazas, Sellos)
- Impresión en gran formato
- Diseño gráfico personalizado`;
  }

  getSystemPrompt(memories = [], knowledge = [], extras = {}) {
    const { customerProfile = null, agentStyle = null } = extras;
    const products = this.getProductsList();
    let memoriesSection = '';
    if (memories && memories.length > 0) {
      const lessonsText = memories.map((m, i) => `${i + 1}. [${m.context_type}] ${m.lesson}`).join('\n');
      memoriesSection = `\n\n## LECCIONES APRENDIDAS DE CONVERSACIONES REALES\nEstas son correcciones y patrones aprendidos de interacciones con clientes reales de Area 862. DEBES aplicarlos:\n${lessonsText}`;
    }
    let knowledgeSection = '';
    if (knowledge && knowledge.length > 0) {
      const MAX_DOC_CHARS = 1500;
      const MAX_TOTAL_CHARS = 6000;
      let totalChars = 0;
      const docLines = [];
      for (const k of knowledge) {
        const content = k.content.length > MAX_DOC_CHARS
          ? k.content.substring(0, MAX_DOC_CHARS) + '...[truncado]'
          : k.content;
        const entry = `### ${k.title} [${k.knowledge_type}]\n${content}`;
        if (totalChars + entry.length > MAX_TOTAL_CHARS) break;
        docLines.push(entry);
        totalChars += entry.length;
      }
      if (docLines.length > 0) {
        knowledgeSection = `\n\n## BASE DE CONOCIMIENTO DEL NEGOCIO\nUsa esta información para responder con mayor precisión:\n\n${docLines.join('\n\n')}`;
      }
    }
    return `Eres el asistente inteligente de Area 862 Graphics LLC, una empresa de diseño gráfico e impresión ubicada en Dallas, Texas.

## INFORMACIÓN DEL NEGOCIO
- Empresa: Area 862 Graphics LLC
- Slogan: "Design, Print and Ship"
- Dirección: 2121 Sylvan Ave #B, Dallas, TX 75208
- Teléfono: (469) 684-3174
- Horario: Lunes-Viernes 9AM-6PM, Sábados 9AM-4PM, Domingos cerrado
- Zona de entrega: Área metropolitana de Dallas-Fort Worth (DFW), Texas
- Idioma principal: Español (también atienden en inglés)
- ~15 años en el mercado atendiendo principalmente a empresarios hispanos

## PRODUCTOS Y SERVICIOS DISPONIBLES
${products}

## TU FUNCIÓN
Eres el cerebro del bot de WhatsApp/Facebook Messenger. Tu trabajo es:
1. Entender perfectamente lo que dice el cliente aunque escriba con errores ortográficos, abreviaciones, spanglish o lenguaje informal
2. Determinar su intención real
3. Extraer datos clave como ZIP codes, nombres de productos, respuestas de sí/no
4. Cuando hay un agente humano activo, evaluar si puedes responder algo factual sin interrumpir el flujo del agente
5. NUNCA inventar precios exactos (los agentes los dan)
6. NUNCA responder sobre temas ajenos al negocio

## REGLAS DE ORO
- Siempre en español
- Tono amigable, cálido y profesional
- Si no estás seguro, indica que un agente ayudará
- El negocio atiende a la comunidad hispana de DFW${knowledgeSection}${memoriesSection}${this._renderStyleSection(agentStyle)}${this._renderCustomerSection(customerProfile)}`;
  }

  _renderStyleSection(style) {
    if (!style) return '';
    const phrases = Array.isArray(style.do_phrases) && style.do_phrases.length
      ? `\nFrases típicas a IMITAR:\n${style.do_phrases.slice(0, 8).map(p => `  • "${p}"`).join('\n')}`
      : '';
    const avoid = Array.isArray(style.dont_phrases) && style.dont_phrases.length
      ? `\nFrases a EVITAR (suenan robóticas):\n${style.dont_phrases.slice(0, 6).map(p => `  • "${p}"`).join('\n')}`
      : '';
    const closings = style.closing_techniques ? `\nCómo cerrar ventas: ${style.closing_techniques}` : '';
    const emojis = style.emoji_usage ? `\nUso de emojis: ${style.emoji_usage}` : '';
    return `\n\n## ESTILO DE LOS AGENTES HUMANOS DE AREA 862 (imítalo)
${style.style_summary || ''}${emojis}${closings}${phrases}${avoid}`;
  }

  _renderCustomerSection(profile) {
    if (!profile) return '';
    const prefs = profile.preferences && Object.keys(profile.preferences).length
      ? `\nPreferencias: ${JSON.stringify(profile.preferences)}`
      : '';
    const past = Array.isArray(profile.past_products) && profile.past_products.length
      ? `\nProductos anteriores: ${profile.past_products.join(', ')}`
      : '';
    const loc = profile.zip_code || profile.city ? `\nUbicación: ${[profile.city, profile.zip_code].filter(Boolean).join(' ')}` : '';
    const notes = profile.notes ? `\nNotas: ${profile.notes}` : '';
    return `\n\n## QUÉ SABEMOS DE ESTE CLIENTE
Conversaciones previas: ${profile.total_conversations || 0}
${profile.summary || 'Sin resumen aún.'}${loc}${past}${prefs}${notes}`;
  }

  async callOpenAI(messages, maxTokens = 300, model = null) {
    if (!this.isAvailable) {
      return { success: false, error: 'No API key configured' };
    }

    return new Promise((resolve) => {
      const body = JSON.stringify({
        model: model || this.model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.2,
        response_format: null
      });

      const options = {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(body)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.choices && parsed.choices[0]) {
              resolve({ success: true, content: parsed.choices[0].message.content.trim() });
            } else if (parsed.error) {
              console.error('[AI] OpenAI error:', parsed.error.message);
              resolve({ success: false, error: parsed.error.message });
            } else {
              resolve({ success: false, error: 'Unexpected response format' });
            }
          } catch (e) {
            resolve({ success: false, error: 'JSON parse error: ' + data.substring(0, 200) });
          }
        });
      });

      req.on('error', (e) => {
        resolve({ success: false, error: e.message });
      });

      req.setTimeout(15000, () => {
        req.destroy();
        resolve({ success: false, error: 'Request timeout' });
      });

      req.write(body);
      req.end();
    });
  }

  parseJsonFromResponse(content) {
    try {
      const clean = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      return JSON.parse(clean);
    } catch (e) {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch (e2) {}
      }
      return null;
    }
  }

  // Classify yes/no from a message
  async classifyYesNo(messageText) {
    if (!this.isAvailable) return null;

    try {
      const messages = [
        {
          role: 'system',
          content: `Clasifica si el mensaje expresa afirmación o negación. 
Considera variantes informales en español como: simon, nel, nel pastel, ta bien, va, claro, órale, simón, nel, nope, nah, etc.
Responde SOLO con una palabra: "yes", "no", o "unknown".`
        },
        {
          role: 'user',
          content: `Mensaje: "${messageText}"`
        }
      ];

      const response = await this.callOpenAI(messages, 10);
      if (response.success) {
        const answer = response.content.toLowerCase();
        if (answer.includes('yes')) return 'yes';
        if (answer.includes('no')) return 'no';
      }
      return null;
    } catch (e) {
      console.error('[AI] classifyYesNo error:', e.message);
      return null;
    }
  }

  // Extract ZIP code or city from a message
  async extractLocationFromMessage(messageText) {
    if (!this.isAvailable) return null;

    try {
      const messages = [
        {
          role: 'system',
          content: `Extrae el código postal (ZIP code de 5 dígitos de Texas/DFW) o nombre de ciudad del mensaje.
Ejemplos: "soy de garland" → "Garland", "estoy por el 75208" → "75208", "vivo en las colinas de dallas" → "Dallas"
Si hay ZIP de 5 dígitos, devuelve solo los números. Si hay ciudad, devuelve el nombre de la ciudad. Si no hay nada, devuelve "null".
Responde SOLO con el ZIP, la ciudad, o la palabra null.`
        },
        {
          role: 'user',
          content: `Mensaje: "${messageText}"`
        }
      ];

      const response = await this.callOpenAI(messages, 20);
      if (response.success) {
        const answer = response.content.trim();
        if (answer.toLowerCase() === 'null' || answer === '') return null;
        return answer;
      }
      return null;
    } catch (e) {
      console.error('[AI] extractLocation error:', e.message);
      return null;
    }
  }

  // Detect frustration in a message
  async detectFrustration(messageText) {
    if (!this.isAvailable) return false;

    try {
      const messages = [
        {
          role: 'system',
          content: 'Detecta si el mensaje expresa frustración, enojo, molestia o impaciencia significativa hacia el negocio o servicio. Responde SOLO "true" o "false".'
        },
        {
          role: 'user',
          content: `Mensaje: "${messageText}"`
        }
      ];

      const response = await this.callOpenAI(messages, 10);
      if (response.success) {
        return response.content.toLowerCase().includes('true');
      }
      return false;
    } catch (e) {
      console.error('[AI] detectFrustration error:', e.message);
      return false;
    }
  }

  // Extract product selection from a message
  async extractProductSelection(messageText, productsList) {
    if (!this.isAvailable) return null;

    try {
      const productsText = productsList.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
      const messages = [
        {
          role: 'system',
          content: `Detecta qué producto está seleccionando el cliente de esta lista:
${productsText}
${productsList.length + 1}. Otros

REGLAS ESTRICTAS:
- Solo responde con un número si el mensaje NOMBRA EXPLÍCITAMENTE uno de los productos (o un sinónimo directo del producto, como "tarjeta de presentación" para Tarjetas, "imán" para Magnéticos, "playera/camiseta" para Playeras).
- Una pregunta GENERAL sobre el negocio NO es una selección de producto. Ejemplos que SIEMPRE deben responder null:
  · "¿Tú fabricas los diseños?" → null (pregunta sobre diseños, no pide producto)
  · "¿Hacen entregas?" → null
  · "¿Cuánto tardan?" → null
  · "¿Tienen tienda física?" → null
  · "Quiero más información" → null
  · "Hola, buenos días" → null
  · Información de contacto (nombre, teléfono, dirección, ZIP) → null
- La palabra "diseño/diseños" sola NO es un producto.
- "Cards" o "card" en inglés sin más contexto puede referirse a Tarjetas O Post Cards: si no se aclara, responde null.
- Cuando tengas la mínima duda, responde null. Es MUCHO mejor null que equivocarte.
- Responde SOLO con el número de la opción (1, 2, 3...) o exactamente la palabra "null".`
        },
        {
          role: 'user',
          content: `Mensaje del cliente: "${messageText}"`
        }
      ];

      const response = await this.callOpenAI(messages, 10);
      if (response.success) {
        const num = parseInt(response.content.trim());
        if (!isNaN(num) && num >= 1 && num <= productsList.length + 1) {
          return num;
        }
      }
      return null;
    } catch (e) {
      console.error('[AI] extractProductSelection error:', e.message);
      return null;
    }
  }

  // Analyze a full message to understand intent
  async analyzeIntent(messageText, convState, isExistingCustomer) {
    if (!this.isAvailable) return null;

    try {
      const messages = [
        {
          role: 'system',
          content: `${this.getSystemPrompt()}

Analiza el mensaje del cliente y devuelve un JSON con el siguiente formato exacto:
{
  "intent": "greeting|wants_info|wants_order|zip_code|product_selection|yes|no|question|frustration|other",
  "zip_code": "XXXXX o null",
  "city": "nombre de ciudad o null",
  "product": "nombre del producto mencionado o null",
  "sentiment": "positive|neutral|negative|frustrated",
  "summary": "resumen de 1 linea de lo que quiere el cliente"
}

Estado actual: estado=${convState?.state || 'initial'}, cliente_existente=${isExistingCustomer ? 'si' : 'no'}`
        },
        {
          role: 'user',
          content: `Mensaje del cliente: "${messageText}"`
        }
      ];

      const response = await this.callOpenAI(messages, 200);
      if (response.success) {
        const parsed = this.parseJsonFromResponse(response.content);
        if (parsed) return { success: true, ...parsed };
      }
      return null;
    } catch (e) {
      console.error('[AI] analyzeIntent error:', e.message);
      return null;
    }
  }

  // THE MOST IMPORTANT FUNCTION:
  // Decide if the AI can/should intervene when an agent is active
  async evaluateAgentIntervention(messageText, recentMessages, convState) {
    if (!this.isAvailable) return { shouldIntervene: false, reason: 'no_api_key' };

    try {
      const recentContext = (recentMessages || [])
        .slice(-8)
        .map(m => {
          const role = m.isFromAgent ? '[AGENTE]' : m.isFromBot ? '[BOT]' : '[CLIENTE]';
          return `${role}: ${m.text}`;
        })
        .join('\n');

      const messages = [
        {
          role: 'system',
          content: `${this.getSystemPrompt()}

## TAREA CRÍTICA: DECISIÓN DE INTERVENCIÓN CON AGENTE ACTIVO
Un agente humano está actualmente atendiendo a este cliente. SOLO debes intervenir si:
1. El cliente hace una pregunta simple y factual que puedes responder con certeza (ej: "¿tienen gorras?", "¿llegan a Garland?", "¿a qué hora cierran?", "¿tienen stickers?")
2. La pregunta NO es parte de la negociación activa del pedido con el agente
3. Tu respuesta sería breve, factual y no interrumpiría el flujo del agente

NO debes intervenir si:
1. El cliente está negociando precio/cantidad/diseño con el agente
2. La pregunta requiere contexto del pedido actual
3. El agente ya está manejando ese tema
4. La pregunta implica tomar alguna acción (procesar pago, confirmar pedido)
5. Hay ambigüedad sobre si tu respuesta podría contradecir al agente

Responde con JSON exacto:
{
  "should_intervene": true/false,
  "reason": "razón breve",
  "response": "tu respuesta en español si debes intervenir, o null si no"
}`
        },
        {
          role: 'user',
          content: `Historial reciente de la conversación:
${recentContext || 'Sin historial previo'}

El cliente acaba de enviar: "${messageText}"

¿Debes intervenir?`
        }
      ];

      const response = await this.callOpenAI(messages, 300);
      if (response.success) {
        const parsed = this.parseJsonFromResponse(response.content);
        if (parsed) {
          return {
            shouldIntervene: !!parsed.should_intervene,
            reason: parsed.reason || '',
            response: parsed.response || null
          };
        }
      }
      return { shouldIntervene: false, reason: 'parse_error' };
    } catch (e) {
      console.error('[AI] evaluateAgentIntervention error:', e.message);
      return { shouldIntervene: false, reason: e.message };
    }
  }

  // Generate a smart response for any state in the flow
  async generateContextualResponse(messageText, convState, contact, recentMessages) {
    if (!this.isAvailable) return null;

    try {
      const recentContext = (recentMessages || [])
        .slice(-6)
        .map(m => {
          const role = m.isFromBot ? 'Asistente' : 'Cliente';
          return `${role}: ${m.text}`;
        })
        .join('\n');

      const messages = [
        {
          role: 'system',
          content: `${this.getSystemPrompt()}

Estás en el flujo de conversación del bot. El estado actual es: ${convState?.state || 'initial'}.
Genera una respuesta apropiada para el cliente basada en el contexto.
La respuesta debe ser corta (máx 3 líneas), amigable y guiar al cliente al siguiente paso del flujo.
NO respondas preguntas de precio exacto. NO salgas del contexto del negocio.`
        },
        {
          role: 'user',
          content: `Historial:
${recentContext || 'Inicio de conversación'}

Cliente dice: "${messageText}"

Genera la respuesta más apropiada:`
        }
      ];

      const response = await this.callOpenAI(messages, 200);
      if (response.success && response.content) {
        return response.content;
      }
      return null;
    } catch (e) {
      console.error('[AI] generateContextualResponse error:', e.message);
      return null;
    }
  }

  // Generate a natural conversational message for a specific flow intent
  // The AI speaks naturally but always achieves the required goal of each step
  async generateFlowMessage(intent, params = {}) {
    if (!this.isAvailable) return null;

    const { customerName, zipCode, city, product, zone, lastMessage, outOfHours, businessHours, isExisting } = params;
    const name = customerName && customerName !== 'Sin nombre' ? customerName.split(' ')[0] : null;
    const handoffNote = outOfHours && businessHours
      ? `IMPORTANTE: El cliente escribió fuera de horario. En lugar de decir "un agente te atenderá en breve", di que en el horario de atención (${businessHours}) un agente o diseñador lo atenderá.`
      : '';

    const intentPrompts = {
      welcome_new: `El cliente acaba de escribir por primera vez. Saluda de forma cálida y amigable en nombre de Area 862 Graphics. 
Luego pregúntale de manera natural: ¿ya alguno de nuestros agentes le brindó información sobre los productos y precios?
Mensaje del cliente: "${lastMessage || 'Hola'}"
${name ? `El nombre del cliente es: ${name}` : ''}
Importante: Tu respuesta DEBE terminar con una pregunta clara de sí o no sobre si ya recibió información previa.`,

      welcome_existing: `El cliente es un cliente recurrente que ya ha ordenado antes. Salúdalo de forma cálida y personal.
${name ? `Su nombre es ${name}.` : ''}
Mensaje del cliente: "${lastMessage || 'Hola'}"
Hazle saber que es un placer volver a atenderlo y pregúntale en qué lo puedes ayudar hoy.`,

      ask_zip_no_info: `El cliente aún no tiene información sobre nuestros servicios. Dile de forma amigable que para ayudarlo necesitas verificar si tienen cobertura en su zona.
Pídele su código postal (ZIP) de 5 dígitos. Menciona un ejemplo como 75208 para que sepa el formato.
${name ? `Nombre del cliente: ${name}` : ''}
Sé breve y directo, máximo 3 líneas.`,

      ask_zip_has_info: `El cliente ya tiene información sobre los productos. Ahora necesitas su código postal (ZIP) para verificar la zona de entrega y continuar con su pedido.
${name ? `Nombre del cliente: ${name}` : ''}
Pídelo de forma natural y breve. Menciona el ejemplo 75208.`,

      zip_covered: `¡Excelente noticia! El cliente tiene cobertura en su zona.
ZIP/Ciudad: ${zipCode || city || 'su zona'}
Zona: ${zone || 'Dallas-Fort Worth'}
${name ? `Nombre: ${name}` : ''}
Dales la buena noticia de forma entusiasta. Luego diles que van a ver los productos disponibles. Sé breve (2 líneas máx).`,

      zip_no_coverage: `Informa al cliente de forma amable que por el momento no tienen cobertura en su zona (${zipCode || city || 'su área'}).
Discúlpate brevemente y hazle saber que cuando amplíen el área de servicio lo contactarán.
${name ? `Nombre: ${name}` : ''}
Sé empático pero breve.`,

      product_selected_ask_design: `El cliente seleccionó el producto: ${product}. 
${name ? `Nombre: ${name}` : ''}
Confirma su elección de forma entusiasta y pregúntale si ya tiene un diseño listo o si necesita que le ayuden a crear uno desde cero.`,

      has_design: `El cliente dice que ya tiene un diseño. 
${name ? `Nombre: ${name}` : ''}
Responde de forma positiva. Diles que envíen su diseño o la información que necesitan incluir.
${handoffNote || 'Menciona que un agente les atenderá en breve para continuar con su pedido.'}`,

      needs_design: `El cliente necesita que le hagan un diseño desde cero.
${name ? `Nombre: ${name}` : ''}
Responde con entusiasmo. Diles que cuenten qué información quieren en el diseño (nombre, teléfono, logo, etc.).
${handoffNote || 'Menciona que un agente les ayudará a crear algo profesional en breve.'}`,

      passing_to_agent: `Informa al cliente de forma amigable que lo estás conectando con uno de los agentes especializados del equipo.
${name ? `Nombre: ${name}` : ''}
Sé breve y positivo, 1-2 líneas máximo.`,

      out_of_hours: `Eres el asistente de Area 862 Graphics. El cliente acaba de escribir fuera del horario de atención.
${name ? `Nombre del cliente: ${name}` : 'El cliente no tiene nombre registrado.'}
Tipo de cliente: ${isExisting ? 'CLIENTE EXISTENTE que ya ha ordenado antes — salúdalo como a alguien conocido.' : 'CLIENTE NUEVO que escribe por primera vez.'}
Mensaje del cliente: "${lastMessage || ''}"
Horario de atención: ${businessHours || 'Lunes a Viernes de 9am a 6pm (hora de Dallas)'}.

Tu tarea: Escribe un mensaje personalizado que:
1. Reconozca lo que el cliente escribió (si mencionó algo concreto, refiérete a ello).
2. Le avise amablemente que están fuera de horario y cuál es el horario.
3. Le explique que el bot puede tomarle los datos de su pedido AHORA MISMO, y que durante el horario de atención un agente o diseñador le dará seguimiento completo.
4. Sea cálido, natural y breve (máximo 4 líneas). No uses listas ni bullet points.`,

      frustrated: `El cliente está molesto o frustrado. 
${name ? `Nombre: ${name}` : ''}
Responde con empatía genuina, discúlpate brevemente sin dramatizar. Diles que vas a conectarlos de inmediato con un agente para resolver su situación. Sé calmado y profesional.`,

      remind_yes_no: `Eres vendedor/a de Area 862 Graphics. Le acabas de preguntar al cliente si ya recibió información previa sobre los productos y precios (esperabas un sí o un no), pero respondió otra cosa.
Mensaje del cliente: "${lastMessage || ''}"
${name ? `Nombre del cliente: ${name}` : ''}

Tu tarea (en UN SOLO mensaje):
1. Si el cliente hizo una pregunta lateral (por ejemplo: "¿hacen diseños?", "¿hacen entregas?", "¿tienen tienda?"), respóndela brevemente como vendedor/a — sí, en Area 862 hacemos diseños desde cero, hacemos entregas en el área de DFW, etc. Responde solo lo que sepas con seguridad; si no sabes algo concreto (precios exactos, tiempos exactos), di que un agente le dará el detalle.
2. Inmediatamente después, vuelve a hacer la pregunta original del flujo de forma amable: si ya algún agente le brindó información previa sobre los productos y precios — esperando un sí o un no.

NO selecciones producto, NO pidas ZIP, NO te saltes pasos. Solo contesta la duda y repite la pregunta sí/no. Máximo 4 líneas.`,

      remind_zip: `El cliente no envió su código postal o lo que envió no parece ser un ZIP válido.
Mensaje del cliente: "${lastMessage || ''}"
Pídele amablemente que envíe su código postal de 5 dígitos. Usa el ejemplo 75208. Sé paciente y claro.`,

      remind_product: `El cliente no seleccionó un producto claramente.
Mensaje del cliente: "${lastMessage || ''}"
Recuérdale amablemente que responda con el número del producto que le interesa. Sé breve.`,

      abandoned: `El cliente había estado en conversación pero dejó de responder. Ahora escribe de nuevo.
${name ? `Nombre: ${name}` : ''}
Mensaje del cliente: "${lastMessage || ''}"
Retoma la conversación de forma cálida. Pregunta si quiere continuar o necesita ayuda con algo.`,

      facebook_ad_welcome: `El cliente viene de un anuncio de Facebook/Instagram. Es su primer contacto.
${name ? `Nombre: ${name}` : ''}
Mensaje del cliente: "${lastMessage || ''}"
${product ? `Producto del anuncio: ${product} — MENCIÓNALO en el saludo para confirmar que ya sabes por qué te escribió ("vi que vienes por nuestras ${product}…" o similar). NO ofrezcas un producto distinto.` : ''}
Salúdalo calurosamente, agradece su interés. Dile que para verificar si tienen cobertura en su zona necesitas su código postal (ZIP). Ejemplo: 75208.`,

      product_info_sent: `Se le envió información sobre el producto ${product} al cliente.
${name ? `Nombre: ${name}` : ''}
Ahora pregúntale brevemente si tiene alguna pregunta o si quiere continuar con ese producto. Sé natural y breve.`,

      direct_order: `El cliente llegó directamente pidiendo un producto específico sin necesitar que le expliques nada.
Producto solicitado: ${product || 'el servicio mencionado'}
Mensaje del cliente: "${lastMessage || ''}"
${name ? `Nombre: ${name}` : ''}
Confirma que lo puedes ayudar con eso.
${handoffNote || 'Dile que vas a conectarlo con uno de los especialistas del equipo que le dará todos los detalles (precio, tiempo de entrega, diseño, etc.).'}
No hagas preguntas de validación ni pidas ZIP. Sé cálido, directo y breve (2-3 líneas máximo).`
    };

    const promptForIntent = intentPrompts[intent];
    if (!promptForIntent) return null;

    try {
      const memories = await this.loadActiveMemories(this.userId || null);
      const knowledge = await this.loadKnowledge(this.userId || null);
      const messages = [
        {
          role: 'system',
          content: `${this.getSystemPrompt(memories, knowledge)}

## REGLAS PARA GENERAR MENSAJES
- Responde SOLO con el mensaje para enviar al cliente, sin explicaciones adicionales
- Usa un tono conversacional, cálido y profesional 
- Máximo 4 líneas de texto
- Usa emojis con moderación (1-3 máximo por mensaje)
- NO uses asteriscos ni formato markdown
- Siempre en español
- NO menciones precios exactos
- NO inventes información del negocio que no conozcas`
        },
        {
          role: 'user',
          content: promptForIntent
        }
      ];

      const response = await this.callOpenAI(messages, 200);
      if (response.success && response.content) {
        console.log(`[Bot-IA] Mensaje generado para intent "${intent}": ${response.content.substring(0, 60)}...`);
        return response.content;
      }
      return null;
    } catch (e) {
      console.error(`[Bot-IA] Error generando mensaje para "${intent}":`, e.message);
      return null;
    }
  }

  // Analyzes recent conversation to decide if this is a closing flow situation
  async analyzeClosingContext(recentMessages) {
    if (!this.isAvailable) return { isClosingFlow: false, hasPendingQuestion: true, reason: 'no_api_key' };

    try {
      const context = (recentMessages || [])
        .slice(-15)
        .map(m => {
          const role = m.isFromAgent ? '[AGENTE]' : m.isFromBot ? '[BOT]' : '[CLIENTE]';
          return `${role}: ${m.text}`;
        })
        .join('\n');

      const messages = [
        {
          role: 'system',
          content: `Eres un analizador de conversaciones para Area 862 Graphics, negocio de impresión en Dallas que vende tarjetas de presentación, magnéticos, post cards y playeras.

Analiza el historial y determina si el cliente ya está listo para cerrar una venta de TARJETAS y el agente terminó de atenderlo, o si el cliente tiene una pregunta nueva.

Señales de CIERRE DE VENTA:
- El agente presentó precios y el cliente mostró interés positivo
- El cliente dijo palabras como: "listo", "me interesa", "cuándo me llegan", "cómo pago", "adelante", "va", "ok", "sí quiero"
- El agente indicó algo como "ya", "perfecto", "con eso cerramos", "te mando al bot"
- La conversación llegó a un punto de acuerdo sobre tarjetas

Señales de PREGUNTA PENDIENTE:
- El cliente hizo una pregunta sin respuesta clara
- El cliente expresa duda, indecisión o pide más información
- El último mensaje del cliente es una pregunta

Responde con JSON exacto:
{
  "is_closing_flow": true/false,
  "product": "tarjetas" o null,
  "has_pending_question": true/false,
  "pending_question_summary": "resumen breve si hay pregunta",
  "confidence": "alta/media/baja",
  "reason": "razón de 1 línea"
}`
        },
        {
          role: 'user',
          content: `Historial de la conversación:\n${context || 'Sin historial previo'}\n\n¿Es momento de iniciar el proceso de cierre de venta de tarjetas, o el cliente tiene una pregunta pendiente?`
        }
      ];

      const response = await this.callOpenAI(messages, 300);
      if (response.success) {
        const parsed = this.parseJsonFromResponse(response.content);
        if (parsed) {
          console.log(`[AI] analyzeClosingContext → closing=${parsed.is_closing_flow}, confidence=${parsed.confidence}, reason=${parsed.reason}`);
          return {
            isClosingFlow: !!parsed.is_closing_flow,
            product: parsed.product || 'tarjetas',
            hasPendingQuestion: !!parsed.has_pending_question,
            pendingQuestion: parsed.pending_question_summary || null,
            confidence: parsed.confidence || 'baja',
            reason: parsed.reason || ''
          };
        }
      }
      return { isClosingFlow: false, product: null, hasPendingQuestion: true, reason: 'parse_error' };
    } catch (e) {
      console.error('[AI] analyzeClosingContext error:', e.message);
      return { isClosingFlow: false, product: null, hasPendingQuestion: true, reason: e.message };
    }
  }

  // ============================================================================
  // FASE 1 — Respuesta conversacional libre (vendedor humano)
  // En vez de máquina de estados rígida, la IA genera respuesta natural usando:
  //   - Historial completo de la conversación
  //   - Lo que ya sabemos del cliente (perfil)
  //   - Estilo de los agentes humanos
  //   - Lecciones aprobadas + base de conocimiento
  //   - Objetivo del flujo: conseguir ZIP, producto y manejar la venta
  // Devuelve JSON con el texto a enviar y datos extraídos.
  // ============================================================================
  async generateConversationalReply({ contact, messageText, recentMessages = [], convState = {}, customerProfile = null, agentStyle = null }) {
    if (!this.isAvailable) return null;

    try {
      const memories = await this.loadActiveMemories(this.userId || null);
      const knowledge = await this.loadKnowledge(this.userId || null);

      const history = (recentMessages || [])
        .slice(-20)
        .map(m => {
          const role = m.isFromAgent ? 'AGENTE' : m.isFromBot ? 'BOT' : 'CLIENTE';
          return `${role}: ${m.text || ''}`;
        })
        .join('\n');

      const customerName = `${contact?.firstName || ''} ${contact?.lastName || ''}`.trim() || 'cliente';
      const knownData = {
        zip: convState?.validated_zip || customerProfile?.zip_code || null,
        city: customerProfile?.city || null,
        product: convState?.selected_product || null,
        is_existing: !!convState?.is_existing_customer
      };

      const objectivo = `OBJETIVO DEL VENDEDOR (en orden):
1. Saludar de forma cálida y natural (mencionando lo que ya sabes del cliente).
2. Si NO hay ZIP, conseguirlo (pero respondiendo primero cualquier pregunta del cliente).
3. Si NO hay producto seleccionado, identificar qué quiere (sin inventarlo — si vino de un anuncio, ya sabes qué producto).
4. Cuando ya tengas ZIP + producto, despedirte diciendo que pasarás al especialista para precios y diseños.
5. NUNCA ofrecer un producto que el cliente no mencionó ni que no esté en el catálogo.
6. NUNCA inventar precios.`;

      const sys = this.getSystemPrompt(memories, knowledge, { customerProfile, agentStyle });

      const userBlock = `Cliente: ${customerName}
Datos que ya tenemos: ${JSON.stringify(knownData)}

${objectivo}

HISTORIAL RECIENTE:
${history || '(inicio de conversación)'}

ÚLTIMO MENSAJE DEL CLIENTE: "${messageText}"

Responde con JSON exacto (sin markdown, sin explicaciones):
{
  "reply": "el mensaje natural y cálido para enviar (máx 4 líneas, como un vendedor humano)",
  "extracted": {
    "zip_code": "5 dígitos o null",
    "city": "nombre de ciudad o null",
    "product": "nombre exacto del catálogo o null si no está claro",
    "quantity": "número o null",
    "wants_handoff": true/false
  },
  "next_action": "ask_zip|ask_product|continue|handoff_to_agent|out_of_scope",
  "intent": "saludo|pregunta|frustracion|fuera_de_tema|cierre|otro",
  "needs_human": true/false,
  "confidence": "alta|media|baja"
}`;

      const messages = [
        { role: 'system', content: sys },
        { role: 'user', content: userBlock }
      ];

      const response = await this.callOpenAI(messages, 600);
      if (response.success) {
        const parsed = this.parseJsonFromResponse(response.content);
        if (parsed && parsed.reply) {
          console.log(`[AI-Conv] reply="${parsed.reply.substring(0, 60)}..." action=${parsed.next_action}`);
          return parsed;
        }
        console.warn('[AI-Conv] No se pudo parsear respuesta JSON');
      }
      return null;
    } catch (e) {
      console.error('[AI-Conv] generateConversationalReply error:', e.message);
      return null;
    }
  }

  // ============================================================================
  // FASE 2 — Análisis del estilo de los agentes humanos
  // ============================================================================
  async analyzeAgentStyle(agentMessagesSample) {
    if (!this.isAvailable) return null;
    try {
      const messages = [
        {
          role: 'system',
          content: `Eres un analizador de estilo conversacional. Te van a dar mensajes reales que los agentes humanos de Area 862 Graphics (imprenta de Dallas) envían a clientes hispanos por WhatsApp/Messenger. Tu tarea: extraer el ESTILO de comunicación para que un bot pueda imitarlo.

Devuelve JSON exacto:
{
  "style_summary": "2-3 líneas describiendo el tono (ej: cálido, informal, usa diminutivos, mezcla español/inglés)",
  "common_phrases": ["frases típicas que repiten"],
  "emoji_usage": "descripción breve de cómo usan emojis (cuáles, frecuencia)",
  "closing_techniques": "cómo cierran ventas o invitan a la acción",
  "do_phrases": ["5-10 frases ejemplares que el bot DEBE imitar"],
  "dont_phrases": ["3-5 frases que serían demasiado robóticas o formales"]
}`
        },
        { role: 'user', content: `Muestra de mensajes de agentes:\n${agentMessagesSample}\n\nExtrae el estilo.` }
      ];
      const response = await this.callOpenAI(messages, 900);
      if (response.success) {
        const parsed = this.parseJsonFromResponse(response.content);
        return parsed || null;
      }
      return null;
    } catch (e) {
      console.error('[AI-Style] analyzeAgentStyle error:', e.message);
      return null;
    }
  }

  // ============================================================================
  // FASE 3 — Resumen del cliente para memoria persistente
  // ============================================================================
  async summarizeCustomer(contact, transcript, existing = null) {
    if (!this.isAvailable) return null;
    try {
      const previous = existing?.summary
        ? `\n\nResumen previo (actualízalo, no lo borres):\n${existing.summary}`
        : '';
      const messages = [
        {
          role: 'system',
          content: `Eres un asistente de CRM. Tu tarea es generar un perfil breve y útil de un cliente de Area 862 Graphics basado en su historial de conversación, para que un bot lo trate como ya conocido la próxima vez.

Devuelve JSON exacto:
{
  "summary": "2-4 líneas en español: quién es, qué pidió, cómo se comunica, datos relevantes",
  "preferences": { "tono": "formal|informal", "idioma_preferido": "español|inglés|mixto", "forma_pago": "..." o null },
  "past_products": ["productos que mencionó o pidió"],
  "zip_code": "5 dígitos o null",
  "city": "ciudad o null",
  "notes": "1 línea con cualquier observación especial (ej: 'siempre regatea precio', 'responde tarde') o null"
}`
        },
        {
          role: 'user',
          content: `Cliente: ${contact?.firstName || ''} ${contact?.lastName || ''}${previous}\n\nHistorial de conversación:\n${transcript}\n\nGenera el perfil.`
        }
      ];
      const response = await this.callOpenAI(messages, 500);
      if (response.success) {
        const parsed = this.parseJsonFromResponse(response.content);
        return parsed || null;
      }
      return null;
    } catch (e) {
      console.error('[AI-CustProfile] summarizeCustomer error:', e.message);
      return null;
    }
  }

  // Test if API key is valid
  async testConnection() {
    if (!this.isAvailable) {
      return { success: false, error: 'No API key provided' };
    }

    try {
      const messages = [
        { role: 'user', content: 'Responde solo con: OK' }
      ];
      const response = await this.callOpenAI(messages, 10);
      if (response.success) {
        return { success: true, message: 'Conexión con OpenAI exitosa' };
      }
      return { success: false, error: response.error };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

export default AIService;
