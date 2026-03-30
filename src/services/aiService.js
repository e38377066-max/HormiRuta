import https from 'https';

class AIService {
  constructor(apiKey, settings) {
    this.apiKey = apiKey;
    this.settings = settings || {};
    this.isAvailable = !!apiKey;
    this.model = 'gpt-4o-mini';
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

  getSystemPrompt() {
    const products = this.getProductsList();
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
- El negocio atiende a la comunidad hispana de DFW`;
  }

  async callOpenAI(messages, maxTokens = 300) {
    if (!this.isAvailable) {
      return { success: false, error: 'No API key configured' };
    }

    return new Promise((resolve) => {
      const body = JSON.stringify({
        model: this.model,
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

El cliente puede referirse al producto por número, nombre, sinónimo o descripción.
Responde SOLO con el número de la opción (1, 2, 3...) o "null" si no se puede determinar.`
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
