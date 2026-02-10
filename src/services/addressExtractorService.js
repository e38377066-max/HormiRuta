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
      /^https?:\/\//i,
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
  }

  extractAddressFromMessage(messageText) {
    if (!messageText || messageText.length < 8 || messageText.length > 300) return null;

    const cleanText = messageText.trim();

    for (const pattern of this.nonAddressPatterns) {
      if (pattern.test(cleanText)) return null;
    }

    const hasStreetNumber = /^\d+\s+\w/.test(cleanText) || /\b\d+\s+[A-Za-z]/.test(cleanText);
    if (!hasStreetNumber) return null;

    const suffixPattern = this.streetSuffixes.map(s => s.replace('.', '\\.')).join('|');
    const streetRegex = new RegExp(`\\b(${suffixPattern})\\b\\.?`, 'i');
    const hasStreetSuffix = streetRegex.test(cleanText);

    if (!hasStreetSuffix) return null;

    const address = this.cleanAddress(cleanText);

    if (this.validateAddressFormat(address)) {
      return address;
    }

    return null;
  }

  extractAddressFromConversation(messages) {
    const incomingMessages = messages
      .filter(msg => msg.traffic === 'incoming')
      .filter(msg => msg.message?.type === 'text' && msg.message?.text);

    for (let i = incomingMessages.length - 1; i >= 0; i--) {
      const text = incomingMessages[i].message.text;
      const address = this.extractAddressFromMessage(text);
      if (address) {
        return {
          address,
          messageId: incomingMessages[i].messageId,
          timestamp: incomingMessages[i].createdAt || incomingMessages[i].timestamp
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
