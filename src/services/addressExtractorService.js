/**
 * @fileoverview Servicio de extracción de direcciones.
 * Este servicio se encarga de identificar y extraer direcciones de envío en EE. UU. (Texas/DFW) 
 * a partir de mensajes de texto, enlaces de Google Maps y coordenadas GPS.
 * Utiliza patrones de expresiones regulares para validar y limpiar las direcciones.
 */

class AddressExtractorService {
  constructor() {
    /**
     * Sufijos comunes de calles para identificar direcciones.
     * @type {string[]}
     */
    this.streetSuffixes = [
      'street', 'st', 'avenue', 'ave', 'av', 'road', 'rd', 'drive', 'dr',
      'lane', 'ln', 'boulevard', 'blvd', 'way', 'court', 'ct',
      'place', 'pl', 'circle', 'cir', 'highway', 'hwy', 'pkwy', 'parkway',
      'trail', 'trl', 'terrace', 'ter', 'loop', 'crossing', 'xing',
      'run', 'path', 'pass', 'pike', 'square', 'sq', 'crescent', 'cres'
    ];

    /**
     * Indicadores de unidades (apartamentos, suites, etc.).
     * @type {string[]}
     */
    this.unitIndicators = [
      'apt', 'apartment', 'unit', 'suite', 'ste', '#',
      'floor', 'fl', 'building', 'bldg', 'room', 'rm',
      'space', 'spc', 'lot', 'trlr', 'trailer'
    ];

    /**
     * Abreviaturas de estados de EE. UU.
     * @type {Object<string, string>}
     */
    this.stateAbbreviations = {
      'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
      'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
      'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
      'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
      'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
      'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
      'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
      'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
      'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
      'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
      'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
      'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
      'wisconsin': 'WI', 'wyoming': 'WY'
    };

    /**
     * Set de abreviaturas de estados para búsqueda rápida.
     * @type {Set<string>}
     */
    this.stateAbbrSet = new Set(Object.values(this.stateAbbreviations));

    /**
     * Lista de ciudades conocidas, principalmente en Texas.
     * @type {string[]}
     */
    this.knownCities = [
      'dallas', 'fort worth', 'arlington', 'garland', 'irving', 'plano',
      'mesquite', 'richardson', 'carrollton', 'grand prairie', 'denton',
      'mckinney', 'frisco', 'lewisville', 'flower mound', 'cedar hill',
      'desoto', 'duncanville', 'lancaster', 'rowlett', 'sachse', 'wylie',
      'murphy', 'forney', 'rockwall', 'terrell', 'seagoville', 'balch springs',
      'hutchins', 'wilmer', 'allen', 'the colony', 'coppell', 'farmers branch',
      'addison', 'university park', 'highland park', 'sunnyvale', 'heath',
      'fate', 'royse city', 'waxahachie', 'midlothian', 'mansfield', 'euless',
      'bedford', 'hurst', 'grapevine', 'colleyville', 'southlake', 'keller',
      'houston', 'san antonio', 'austin', 'el paso', 'corpus christi',
      'laredo', 'lubbock', 'amarillo', 'brownsville', 'mcallen',
      'pasadena', 'killeen', 'midland', 'odessa', 'beaumont',
      'round rock', 'abilene', 'pearland', 'sugar land', 'waco',
      'dover', 'miami', 'orlando', 'tampa', 'jacksonville',
      'atlanta', 'chicago', 'los angeles', 'new york', 'phoenix'
    ];

    // Patrones que SIEMPRE descartan el mensaje (anclados — nunca contienen direcciones)
    /**
     * Patrones de rechazo estricto que descartan mensajes sin dirección.
     * @type {RegExp[]}
     */
    this.hardRejectPatterns = [
      /^(ok|si|no|yes|gracias|listo|perfecto|bueno|bien|hola|claro|que|como|cuando|donde|por|para|dale|va|genial|excelente|entendido)$/i,
      /^(quiero|necesito|tengo|puedo|puede|cuanto|cuesta|precio|pago|cobro|deposito|transferencia|zelle|venmo|cash|tarjeta)$/i,
      /^\d{1,4}$/,
      /^@/,
      /whatsapp/i,
      /^\?+$/,
      /^\.+$/,
      /facebook/i,
      /instagram/i,
      /^(buenos dias|buenas tardes|buenas noches)/i,
      /^(me puede|me pueden|me interesa|estoy interesad)/i,
      /^gracias por/i,
      // Nombres de país/lugar genérico — nunca son direcciones
      /^(estados\s+unidos|united\s+states|m[eé]xico|mexico|canada|usa|u\.s\.a\.?)$/i,
      /^(casa|home|trabajo|work|oficina|office|aqui|ahi|alla|here|there)$/i,
      // Listas de precios: números separados por "y" con palabras de servicio
      /\d+\s+y\s+(full|clean|detail|wash|super|basico|completo|estandar)/i,
      /\b(super\s+clean|full\s+detail|bofeado?|bofear)\b/i,
      // Mensajes de marketing con emojis y listas de productos/precios
      /(paquetes\s+disponibles|incluye\s+dise[ñn]o|proceso\s+de\s+\d+\s+d[ií]as|disponible\s+en\s+el\s+[aá]rea)/i,
      // Precio con cantidad: "500 por $60", "1000 por $70"
      /\b\d{3,}\s+por\s+\$?\d+/i,
      // Múltiples precios: "50 y 160 y 250" o "150, 250, 350"
      /\b\d+\s*[y,]\s*\d+\s*[y,]\s*\d+/,
    ];

    // Patrones "suaves" — solo se aplican cuando NO hay señal clara de dirección
    // (número de calle + sufijo/ciudad). Un mensaje con "pedido" Y "219 curtiss st"
    // es una dirección válida y no debe descartarse.
    /**
     * Patrones de rechazo suave para mensajes que podrían contener direcciones.
     * @type {RegExp[]}
     */
    this.softRejectPatterns = [
      /orden|pedido|servicio|producto|cotizacion/i,
      /descuento|promocion|oferta|especial/i,
      /recordatorio/i,
      /presupuesto/i,
    ];

    // Mantener nonAddressPatterns como alias para compatibilidad interna
    this.nonAddressPatterns = this.hardRejectPatterns;

    /**
     * Patrones conversacionales que indican mensajes comunes.
     * @type {RegExp[]}
     */
    this.conversationalPatterns = [
      /\bpero\b/i, /\baunque\b/i, /\bsin embargo\b/i,
      /\btrabajo cerca\b/i, /\btrabajo en\b/i, /\bvoy a\b/i,
      /\bpuedo pasar\b/i, /\btambien puedo\b/i,
      /\bsi no\b/i, /\byo tambien\b/i, /\bsi quiere\b/i,
      /\bme queda\b/i, /\bcerca de\b/i, /\bcerca aqui\b/i
    ];

    /**
     * Patrones para identificar enlaces de Google Maps.
     * @type {RegExp[]}
     */
    this.googleMapsPatterns = [
      /maps\.app\.goo\.gl\/\S+/i,
      /maps\.google\.com\/\S+/i,
      /google\.com\/maps\/\S+/i,
      /goo\.gl\/maps\/\S+/i
    ];
  }

  /**
   * Extrae un enlace de Google Maps del texto del mensaje.
   * @description Busca patrones conocidos de URLs de Google Maps.
   * @param {string} messageText - El texto del mensaje.
   * @returns {string|null} El enlace encontrado o null.
   */
  extractGoogleMapsLink(messageText) {
    if (!messageText) return null;
    for (const pattern of this.googleMapsPatterns) {
      const match = messageText.match(pattern);
      if (match) return match[0];
    }
    return null;
  }

  /**
   * Determina si un mensaje es predominantemente conversacional.
   * @description Evalúa la longitud y la presencia de patrones conversacionales.
   * @param {string} text - El texto a evaluar.
   * @returns {boolean} Verdadero si es conversacional.
   */
  isConversationalMessage(text) {
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 8) return false;

    let conversationalHits = 0;
    for (const pattern of this.conversationalPatterns) {
      if (pattern.test(text)) conversationalHits++;
    }
    if (conversationalHits >= 1) return true;

    return false;
  }

  /**
   * Verifica si el texto contiene una dirección con una ciudad o estado conocido.
   * @description Busca un número seguido de una ciudad de la lista o una abreviatura de estado.
   * @param {string} text - El texto a evaluar.
   * @returns {boolean} Verdadero si contiene ciudad o estado.
   */
  hasAddressWithCity(text) {
    const lowerText = text.toLowerCase();
    // Acepta número al inicio O después de un prefijo de unidad (Apt X, Unit X, #X)
    const hasNumber = /^\d+\s+\w/.test(text) ||
      /^(?:apt|apartment|unit|suite|ste|#)\s*[\w\d]+\s+\d+\s+\w/i.test(text) ||
      /\b\d{3,5}\s+[A-Za-z]/.test(text);
    if (!hasNumber) return false;

    const hasCity = this.knownCities.some(city => {
      const cityRegex = new RegExp(`\\b${city}\\b`, 'i');
      return cityRegex.test(lowerText);
    });

    const hasState = [...this.stateAbbrSet].some(abbr => {
      const stateRegex = new RegExp(`\\b${abbr}\\b`, 'i');
      return stateRegex.test(text);
    });

    return hasCity || hasState;
  }

  /**
   * Normaliza prefijos de unidad al inicio del texto.
   * @description Reubica el prefijo de unidad al final si aparece antes del número de calle.
   * @param {string} text - El texto a normalizar.
   * @returns {string} El texto normalizado.
   * @private
   */
  _normalizeUnitPrefix(text) {
    // Patrón: (Apt|Unit|Suite|#) <identificador> <número_calle> <resto>
    const m = text.match(/^(apt|apartment|unit|suite|ste|#)\s*([\w\d]+)\s+(\d{2,5}\s+.+)/i);
    if (!m) return text;
    const unitLabel = m[1];
    const unitNum = m[2];
    const rest = m[3].trim();
    // Reescribir como "<número_calle> <calle>, <Apt X>"
    return `${rest}, ${unitLabel} ${unitNum}`;
  }

  /**
   * Extrae una dirección de un mensaje individual.
   * @description Aplica filtros de rechazo, normalización y validación de formato.
   * @param {string} messageText - El texto del mensaje.
   * @returns {string|null} La dirección extraída o null.
   */
  extractAddressFromMessage(messageText) {
    if (!messageText || messageText.length < 8 || messageText.length > 300) return null;

    const cleanText = messageText.trim();

    // Rechazo duro: patrones que nunca contienen direcciones
    for (const pattern of this.hardRejectPatterns) {
      if (pattern.test(cleanText)) return null;
    }

    // Rechazar mensajes con muchos emojis (mensajes de marketing/publicidad)
    const emojiCount = (cleanText.match(/\p{Emoji_Presentation}/gu) || []).length;
    if (emojiCount >= 3) return null;

    // Intentar también con el prefijo de unidad normalizado (Apt X 4608 St → 4608 St, Apt X)
    const normalizedText = this._normalizeUnitPrefix(cleanText);
    const textToCheck = normalizedText !== cleanText ? normalizedText : cleanText;

    const hasStreetNumber = /^\d+\s+\w/.test(textToCheck) || /\b\d+\s+[A-Za-z]/.test(cleanText);
    if (!hasStreetNumber) return null;

    const suffixPattern = this.streetSuffixes.map(s => s.replace('.', '\\.')).join('|');
    const streetRegex = new RegExp(`\\b(${suffixPattern})\\b\\.?`, 'i');
    const hasStreetSuffix = streetRegex.test(textToCheck);

    const hasCity = this.hasAddressWithCity(textToCheck) || this.hasAddressWithCity(cleanText);

    // Señal de dirección fuerte (número + sufijo O número + ciudad conocida):
    // ignorar filtros suaves — el mensaje contiene una dirección real aunque hable de otras cosas.
    const strongAddressSignal = hasStreetNumber && (hasStreetSuffix || hasCity);

    if (!strongAddressSignal) {
      // Señal débil: aplicar filtros suaves y conversacional
      for (const pattern of this.softRejectPatterns) {
        if (pattern.test(cleanText)) return null;
      }
      if (this.isConversationalMessage(cleanText)) return null;
      if (!hasStreetSuffix && !hasCity) return null;
    }

    const address = this.cleanAddress(textToCheck);

    if (this.validateAddressFormat(address) || hasCity) {
      return address;
    }

    return null;
  }

  /**
   * Extrae una dirección combinando mensajes consecutivos.
   * @description Utiliza una ventana deslizante para encontrar direcciones fragmentadas.
   * @param {Object[]} incomingMessages - Lista de mensajes entrantes.
   * @param {number} [windowSize=4] - Tamaño de la ventana de mensajes.
   * @returns {Object|null} Objeto con la dirección y los índices de los fragmentos, o null.
   */
  extractAddressFromMessageSlices(incomingMessages, windowSize = 4) {
    // Respond.io devuelve mensajes más recientes primero — invertir para orden cronológico
    const chronological = [...incomingMessages].reverse();
    const texts = chronological
      .map(m => (m.message?.text || '').trim())
      .filter(t => t.length >= 2);

    for (let i = 0; i < texts.length; i++) {
      // El primer fragmento debe tener un número de calle para ser candidato
      const firstHasNumber = /^\d+\s+\w/.test(texts[i]) || /\b\d+\s+[A-Za-z]/.test(texts[i]);
      if (!firstHasNumber) continue;

      for (let size = 2; size <= Math.min(windowSize, texts.length - i); size++) {
        const combined = texts.slice(i, i + size).join(' ');
        if (combined.length > 300) break;
        const addr = this.extractAddressFromMessage(combined);
        if (addr) return { address: addr, sliceStart: i, sliceEnd: i + size - 1 };
      }
    }
    return null;
  }

  /**
   * Identifica referencias a "la misma dirección" en el texto.
   * @param {string} text - El texto a evaluar.
   * @returns {boolean} Verdadero si es una referencia a la misma dirección.
   */
  isSameAddressReference(text) {
    if (!text) return false;
    return /\b(la misma|misma dir(?:eccion)?|same address|igual direcci[oó]n|la misma de|la misma que|same as|misma de las|misma que las|misma que antes|la de siempre|usa la misma|use the same)\b/i.test(text);
  }

  /**
   * Extrae una dirección de mensajes de clientes mayoristas.
   * @description Similar a extractAddressFromMessage pero permite mayor longitud y no usa filtros suaves.
   * @param {string} text - El texto del mensaje.
   * @returns {string|null} La dirección extraída o null.
   */
  extractAddressFromWholesaleMessage(text) {
    if (!text || text.length < 8 || text.length > 600) return null;

    const cleanText = text.trim();

    // Solo rechazo duro (nunca contienen direcciones)
    for (const pattern of this.hardRejectPatterns) {
      if (pattern.test(cleanText)) return null;
    }

    const normalizedText = this._normalizeUnitPrefix(cleanText);
    const textToCheck = normalizedText !== cleanText ? normalizedText : cleanText;

    const hasStreetNumber = /^\d+\s+\w/.test(textToCheck) || /\b\d{3,5}\s+[A-Za-z]/.test(cleanText);
    if (!hasStreetNumber) return null;

    const suffixPattern = this.streetSuffixes.map(s => s.replace('.', '\\.')).join('|');
    const streetRegex = new RegExp(`\\b(${suffixPattern})\\b\\.?`, 'i');
    const hasStreetSuffix = streetRegex.test(textToCheck);
    const hasCity = this.hasAddressWithCity(textToCheck) || this.hasAddressWithCity(cleanText);

    // Para mayoristas no se aplican softRejectPatterns — el pedido puede decir
    // "quiero 50 tarjetas, la dirección es 2918 S Jupiter Rd Suite A-28 Garland TX"
    if (!hasStreetSuffix && !hasCity) return null;

    // Intentar extraer solo la parte que parece dirección (después de "dirección:", "address:", etc.)
    const addressPrefixMatch = cleanText.match(/(?:direcci[oó]n(?:\s+de\s+entrega)?|address|dir)[:\s]+(.{10,200})/i);
    const candidate = addressPrefixMatch ? addressPrefixMatch[1].trim() : textToCheck;

    const address = this.cleanAddress(candidate);
    if (this.validateAddressFormat(address) || hasCity) {
      return address;
    }

    return null;
  }

  /**
   * Escanea una conversación mayorista para extraer la dirección más reciente.
   * @description Detecta referencias a "la misma dirección", ubicaciones GPS y enlaces de Google Maps.
   * @param {Object[]} messages - Lista de mensajes de la conversación.
   * @param {string} [existingAddress=null] - Dirección guardada previamente.
   * @returns {Object|null} Objeto con la dirección o datos de ubicación encontrados, o null.
   */
  extractAddressFromWholesaleConversation(messages, existingAddress = null) {
    const tsOf = (msg) => {
      const raw = msg.createdAt || msg.timestamp || 0;
      return typeof raw === 'number' ? raw : new Date(raw).getTime();
    };

    // Primero: revisar los mensajes más recientes del cliente por referencia "la misma dirección"
    const sortedIncoming = messages
      .filter(m => m.traffic === 'incoming' || !m.traffic)
      .sort((a, b) => tsOf(b) - tsOf(a));

    for (const msg of sortedIncoming.slice(0, 6)) {
      const text = msg.message?.text || '';
      if (this.isSameAddressReference(text)) {
        if (existingAddress) {
          return { address: existingAddress, isSameReference: true };
        }
      }
    }

    const candidates = [];

    for (const msg of messages) {
      const isOutgoing = msg.traffic === 'outgoing';
      if (isOutgoing && this.isBusinessOwnAddress(msg.message?.text || '')) continue;

      const ts = tsOf(msg);

      // Ubicación GPS (solo entrantes)
      if (!isOutgoing && msg.message?.type === 'location' && msg.message?.latitude && msg.message?.longitude) {
        candidates.push({ ts, result: { address: null, googleMapsCoords: { lat: msg.message.latitude, lng: msg.message.longitude } } });
        continue;
      }

      const text = msg.message?.text;
      if (!text || msg.message?.type === 'image') continue;

      const mapsLink = this.extractGoogleMapsLink(text);
      if (mapsLink) {
        candidates.push({ ts, result: { address: null, googleMapsLink: mapsLink } });
        continue;
      }

      if (msg.message?.type && msg.message.type !== 'text') continue;

      // Mensajes del cliente: extractor mayorista (sin softRejectPatterns)
      // Mensajes del agente: extractor estricto normal
      const address = isOutgoing
        ? this.extractAddressFromMessage(text)
        : this.extractAddressFromWholesaleMessage(text);

      if (address) {
        candidates.push({ ts, result: { address } });
      }
    }

    if (candidates.length > 0) {
      // La más reciente gana (el cliente puede cambiar dirección en el último mensaje)
      candidates.sort((a, b) => b.ts - a.ts);
      return candidates[0].result;
    }

    // Fallback: ventana deslizante sobre mensajes entrantes
    const incomingMessages = messages.filter(m => m.traffic === 'incoming' || !m.traffic);
    const sliceResult = this.extractAddressFromMessageSlices(incomingMessages);
    if (sliceResult?.address) {
      return { address: sliceResult.address };
    }

    return null;
  }

  /**
   * Detecta si un texto describe la dirección propia del negocio.
   * @description Evita confundir la ubicación del local con la dirección de entrega del cliente.
   * @param {string} text - El texto a evaluar.
   * @returns {boolean} Verdadero si es la dirección del negocio.
   */
  isBusinessOwnAddress(text) {
    if (!text) return false;
    const businessAddressPattern = /(?:nuestro|nuestra)\s+(?:negocio|empresa|tienda|local|oficina|domicilio)|(?:estamos|somos|nos\s+encontramos)\s+ubicados?|de\s+nuestro|del\s+negocio|de\s+la\s+empresa|atendemos\s+de|nuestras?\s+instalaciones|direcci[oó]n\s+de\s+nuestro/i;
    return businessAddressPattern.test(text);
  }

  /**
   * Extrae una dirección de una conversación completa.
   * @description Analiza mensajes entrantes y salientes para encontrar la dirección más reciente.
   * @param {Object[]} messages - Lista de mensajes de la conversación.
   * @returns {Object|null} Objeto con la dirección, messageId y timestamp, o null.
   */
  extractAddressFromConversation(messages) {
    // Recoger todos los candidatos con su timestamp para que gane el más reciente.
    // Se analizan mensajes entrantes (cliente) Y salientes (agente confirmando
    // dirección del cliente) — sin bloquear una dirección por ser saliente.
    const candidates = [];
    const tsOf = (msg) => {
      const raw = msg.createdAt || msg.timestamp || 0;
      return typeof raw === 'number' ? raw : new Date(raw).getTime();
    };

    for (const msg of messages) {
      const isOutgoing = msg.traffic === 'outgoing';

      // Excluir mensajes salientes que hablen de la dirección del negocio.
      if (isOutgoing && this.isBusinessOwnAddress(msg.message?.text || '')) continue;

      const ts = tsOf(msg);

      // Ubicación GPS (solo entrantes)
      if (!isOutgoing && msg.message?.type === 'location' && msg.message?.latitude && msg.message?.longitude) {
        candidates.push({ ts, result: { address: null, googleMapsCoords: { lat: msg.message.latitude, lng: msg.message.longitude }, messageId: msg.messageId, timestamp: msg.createdAt || msg.timestamp } });
        continue;
      }

      const text = msg.message?.text;
      if (!text || msg.message?.type === 'image') continue;

      // Google Maps link
      const mapsLink = this.extractGoogleMapsLink(text);
      if (mapsLink) {
        candidates.push({ ts, result: { address: null, googleMapsLink: mapsLink, messageId: msg.messageId, timestamp: msg.createdAt || msg.timestamp } });
        continue;
      }

      if (msg.message?.type && msg.message.type !== 'text') continue;

      // Dirección en texto
      const address = this.extractAddressFromMessage(text);
      if (address) {
        candidates.push({ ts, result: { address, messageId: msg.messageId, timestamp: msg.createdAt || msg.timestamp } });
      }
    }

    // Ordenar por timestamp descendente (más reciente primero) y devolver el primero.
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.ts - a.ts);
      return candidates[0].result;
    }

    // Fallback: ventana deslizante sobre mensajes entrantes (dirección en partes).
    const incomingMessages = messages.filter(msg => msg.traffic === 'incoming');
    const sliceResult = this.extractAddressFromMessageSlices(incomingMessages);
    if (sliceResult?.address) {
      return { address: sliceResult.address, messageId: null, timestamp: null };
    }

    return null;
  }

  /**
   * Limpia el texto de la dirección eliminando prefijos comunes.
   * @param {string} text - El texto de la dirección.
   * @returns {string} La dirección limpia.
   */
  cleanAddress(text) {
    let address = text.trim();

    address = address.replace(/^(mi direccion es|mi dir es|la direccion es|direccion|dir)[:\s]*/i, '');
    address = address.replace(/^(my address is|address)[:\s]*/i, '');
    address = address.replace(/^(estoy en|vivo en|queda en|es en)[:\s]*/i, '');
    address = address.replace(/^(i live at|i'm at|im at|located at)[:\s]*/i, '');

    address = address.replace(/[.!?]+$/, '').trim();

    address = address.replace(/\s+/g, ' ');

    return address;
  }

  /**
   * Valida el formato de una dirección.
   * @description Verifica la presencia de un número de calle y un sufijo válido.
   * @param {string} address - La dirección a validar.
   * @returns {boolean} Verdadero si el formato es válido.
   */
  validateAddressFormat(address) {
    if (!address || address.length < 8) return false;

    const streetNumberMatch = address.match(/^\d+\s+/) || address.match(/\b\d+\s+[A-Za-z]/);
    if (!streetNumberMatch) return false;

    const suffixPattern = this.streetSuffixes.map(s => s.replace('.', '\\.')).join('|');
    const streetRegex = new RegExp(`\\b(${suffixPattern})\\b\\.?`, 'i');
    if (!streetRegex.test(address)) return false;

    const wordCount = address.split(/\s+/).length;
    if (wordCount < 3) return false;

    return true;
  }

  /**
   * Extrae el código ZIP de una dirección.
   * @param {string} address - La dirección.
   * @returns {string|null} El código ZIP de 5 dígitos o null.
   */
  extractZipFromAddress(address) {
    if (!address) return null;

    const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
    return zipMatch ? zipMatch[1] : null;
  }

  /**
   * Extrae los componentes completos de una dirección (ZIP, ciudad, estado).
   * @param {string} address - La dirección completa.
   * @returns {Object} Objeto con fullAddress, zip, city y state.
   */
  extractFullAddressComponents(address) {
    const zip = this.extractZipFromAddress(address);

    let city = null;
    const lowerAddr = address.toLowerCase();
    for (const c of this.knownCities) {
      const cityRegex = new RegExp(`\\b${c}\\b`, 'i');
      if (cityRegex.test(lowerAddr)) {
        city = c;
        break;
      }
    }

    let state = null;
    for (const [fullName, abbr] of Object.entries(this.stateAbbreviations)) {
      const stateRegex = new RegExp(`\\b${fullName}\\b`, 'i');
      if (stateRegex.test(lowerAddr)) {
        state = abbr;
        break;
      }
    }
    if (!state) {
      const abbrMatch = address.match(/\b([A-Z]{2})\b/);
      if (abbrMatch && this.stateAbbrSet.has(abbrMatch[1])) {
        state = abbrMatch[1];
      }
    }

    return {
      fullAddress: address,
      zip,
      city,
      state
    };
  }
}

export default AddressExtractorService;
