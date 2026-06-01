class AddressExtractorService {
  constructor() {
    this.streetSuffixes = [
      'street', 'st', 'avenue', 'ave', 'av', 'road', 'rd', 'drive', 'dr',
      'lane', 'ln', 'boulevard', 'blvd', 'way', 'court', 'ct',
      'place', 'pl', 'circle', 'cir', 'highway', 'hwy', 'pkwy', 'parkway',
      'trail', 'trl', 'terrace', 'ter', 'loop', 'crossing', 'xing',
      'run', 'path', 'pass', 'pike', 'square', 'sq', 'crescent', 'cres'
    ];

    this.unitIndicators = [
      'apt', 'apartment', 'unit', 'suite', 'ste', '#',
      'floor', 'fl', 'building', 'bldg', 'room', 'rm',
      'space', 'spc', 'lot', 'trlr', 'trailer'
    ];

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

    this.stateAbbrSet = new Set(Object.values(this.stateAbbreviations));

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
    this.softRejectPatterns = [
      /orden|pedido|servicio|producto|cotizacion/i,
      /descuento|promocion|oferta|especial/i,
      /recordatorio/i,
      /presupuesto/i,
    ];

    // Mantener nonAddressPatterns como alias para compatibilidad interna
    this.nonAddressPatterns = this.hardRejectPatterns;

    this.conversationalPatterns = [
      /\bpero\b/i, /\baunque\b/i, /\bsin embargo\b/i,
      /\btrabajo cerca\b/i, /\btrabajo en\b/i, /\bvoy a\b/i,
      /\bpuedo pasar\b/i, /\btambien puedo\b/i,
      /\bsi no\b/i, /\byo tambien\b/i, /\bsi quiere\b/i,
      /\bme queda\b/i, /\bcerca de\b/i, /\bcerca aqui\b/i
    ];

    this.googleMapsPatterns = [
      /maps\.app\.goo\.gl\/\S+/i,
      /maps\.google\.com\/\S+/i,
      /google\.com\/maps\/\S+/i,
      /goo\.gl\/maps\/\S+/i
    ];
  }

  extractGoogleMapsLink(messageText) {
    if (!messageText) return null;
    for (const pattern of this.googleMapsPatterns) {
      const match = messageText.match(pattern);
      if (match) return match[0];
    }
    return null;
  }

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

  // Elimina prefijo de unidad al inicio si va antes del número de calle.
  // Ej: "Apt 14 4608 Columbia av" → "4608 Columbia av, Apt 14"
  // Devuelve el texto normalizado para que empiece con el número de calle.
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

  // Intenta extraer una dirección combinando mensajes consecutivos del mismo
  // remitente en una ventana deslizante. Útil cuando el cliente envía la
  // dirección en partes separadas (ej. "818 w centerville" / "Apt 140" / "Garland").
  // Los mensajes se esperan en cualquier orden; se procesan en orden cronológico.
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

  // Detecta frases como "la misma dirección", "misma dir", "same address as", etc.
  isSameAddressReference(text) {
    if (!text) return false;
    return /\b(la misma|misma dir(?:eccion)?|same address|igual direcci[oó]n|la misma de|la misma que|same as|misma de las|misma que las|misma que antes|la de siempre|usa la misma|use the same)\b/i.test(text);
  }

  // Como extractAddressFromMessage pero sin softRejectPatterns y con longitud mayor.
  // Usado para clientes mayoristas cuyos mensajes mezclan listas de productos y dirección.
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

  // Variante para mayoristas: escanea TODOS los mensajes en orden cronológico,
  // devuelve la dirección MÁS RECIENTE (el último mensaje puede cambiarla),
  // detecta referencias "la misma dirección" y las resuelve con existingAddress.
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

  // Detecta si un texto describe la dirección PROPIA del negocio (ej. "La
  // direccion de nuestro Negocio es: ...", "atendemos de 8am a 1pm"). Se usa
  // para NO confundir la ubicación del local con la dirección de entrega del
  // cliente cuando el agente la envía en un mensaje saliente.
  isBusinessOwnAddress(text) {
    if (!text) return false;
    const businessAddressPattern = /(?:nuestro|nuestra)\s+(?:negocio|empresa|tienda|local|oficina|domicilio)|(?:estamos|somos|nos\s+encontramos)\s+ubicados?|de\s+nuestro|del\s+negocio|de\s+la\s+empresa|atendemos\s+de|nuestras?\s+instalaciones|direcci[oó]n\s+de\s+nuestro/i;
    return businessAddressPattern.test(text);
  }

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

  extractZipFromAddress(address) {
    if (!address) return null;

    const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
    return zipMatch ? zipMatch[1] : null;
  }

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
