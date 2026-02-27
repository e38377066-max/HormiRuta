class AddressExtractorService {
  constructor() {
    this.streetSuffixes = [
      'street', 'st', 'avenue', 'ave', 'road', 'rd', 'drive', 'dr',
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

    this.nonAddressPatterns = [
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
      /orden|pedido|servicio|producto|cotizacion/i,
      /descuento|promocion|oferta|especial/i,
      /^gracias por/i,
      /recordatorio/i,
      /presupuesto/i
    ];

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
    const hasNumber = /^\d+\s+\w/.test(text);
    if (!hasNumber) return false;

    const hasCity = this.knownCities.some(city => {
      const cityRegex = new RegExp(`\\b${city}\\b`, 'i');
      return cityRegex.test(lowerText);
    });

    const hasState = /\b[A-Z]{2}\b/.test(text) && [...this.stateAbbrSet].some(abbr => {
      const stateRegex = new RegExp(`\\b${abbr}\\b`);
      return stateRegex.test(text);
    });

    return hasCity || hasState;
  }

  extractAddressFromMessage(messageText) {
    if (!messageText || messageText.length < 8 || messageText.length > 300) return null;

    const cleanText = messageText.trim();

    for (const pattern of this.nonAddressPatterns) {
      if (pattern.test(cleanText)) return null;
    }

    if (this.isConversationalMessage(cleanText)) return null;

    const hasStreetNumber = /^\d+\s+\w/.test(cleanText) || /\b\d+\s+[A-Za-z]/.test(cleanText);
    if (!hasStreetNumber) return null;

    const suffixPattern = this.streetSuffixes.map(s => s.replace('.', '\\.')).join('|');
    const streetRegex = new RegExp(`\\b(${suffixPattern})\\b\\.?`, 'i');
    const hasStreetSuffix = streetRegex.test(cleanText);

    if (!hasStreetSuffix && !this.hasAddressWithCity(cleanText)) return null;

    const address = this.cleanAddress(cleanText);

    if (this.validateAddressFormat(address) || this.hasAddressWithCity(cleanText)) {
      return address;
    }

    return null;
  }

  extractAddressFromConversation(messages) {
    const incomingMessages = messages.filter(msg => msg.traffic === 'incoming');

    for (let i = incomingMessages.length - 1; i >= 0; i--) {
      const msg = incomingMessages[i];

      if (msg.message?.type === 'location' && msg.message?.latitude && msg.message?.longitude) {
        return {
          address: null,
          googleMapsCoords: { lat: msg.message.latitude, lng: msg.message.longitude },
          messageId: msg.messageId,
          timestamp: msg.createdAt || msg.timestamp
        };
      }

      const text = msg.message?.text;
      if (!text) continue;

      const mapsLink = this.extractGoogleMapsLink(text);
      if (mapsLink) {
        return {
          address: null,
          googleMapsLink: mapsLink,
          messageId: msg.messageId,
          timestamp: msg.createdAt || msg.timestamp
        };
      }

      if (msg.message?.type !== 'text') continue;

      const address = this.extractAddressFromMessage(text);
      if (address) {
        return {
          address,
          messageId: msg.messageId,
          timestamp: msg.createdAt || msg.timestamp
        };
      }
    }

    const confirmPatterns = [
      /(?:esta|esta es|tu|su|la)\s+(?:direccion|dir|address)/i,
      /(?:confirm|verific|correct|bien)\s+.*(?:direccion|dir|address)/i,
      /(?:direccion|address)\s+(?:es|seria|correcta|confirmada)/i,
      /(?:te|le)\s+(?:mando|envio|confirmo)\s+(?:la|tu|su)?\s*(?:direccion|dir|address)/i,
      /(?:entrega|delivery|envio)\s+(?:a|en|para)\s*:?\s*/i
    ];
    const outgoingMessages = messages.filter(msg => msg.traffic === 'outgoing');
    for (let i = outgoingMessages.length - 1; i >= 0; i--) {
      const msg = outgoingMessages[i];
      const text = msg.message?.text;
      if (!text || text.length < 10) continue;
      const isConfirmation = confirmPatterns.some(p => p.test(text));
      if (!isConfirmation) continue;
      const mapsLink = this.extractGoogleMapsLink(text);
      if (mapsLink) {
        return {
          address: null,
          googleMapsLink: mapsLink,
          messageId: msg.messageId,
          timestamp: msg.createdAt || msg.timestamp
        };
      }
      const address = this.extractAddressFromMessage(text);
      if (address) {
        return {
          address,
          messageId: msg.messageId,
          timestamp: msg.createdAt || msg.timestamp,
          source: 'agent_confirmation'
        };
      }
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
