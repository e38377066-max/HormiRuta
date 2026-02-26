import { CoverageZone } from '../models/index.js';
import { Op } from 'sequelize';

class AddressValidationService {
  constructor(userId) {
    this.userId = userId;
  }

  extractZipCode(text) {
    if (!text) return null;
    
    const patterns = [
      /zip\s*(?:code)?\s*[:\-]?\s*(\d{5})/i,
      /postal\s*[:\-]?\s*(\d{5})/i,
      /\bcp\s*[:\-]?\s*(\d{5})/i,
      /codigo\s*(?:postal)?\s*[:\-]?\s*(\d{5})/i,
      /^(\d{5})$/,
      /\b(\d{5})(?:-\d{4})?\b/
    ];
    
    for (const pattern of patterns) {
      const match = text.trim().match(pattern);
      if (match) {
        return match[1] || match[0].substring(0, 5);
      }
    }
    
    return null;
  }

  extractCityName(text) {
    if (!text) return null;
    
    const cleanText = text.trim().toLowerCase();
    
    for (const city of this.knownCities) {
      if (cleanText === city) {
        return city;
      }
      const cityRegex = new RegExp(`\\b${city}\\b`, 'i');
      if (cityRegex.test(cleanText)) {
        return city;
      }
    }
    
    const cityPatterns = [
      /(?:city|ciudad)\s*[:\-]?\s*([a-zA-Z\s]+)/i,
      /(?:from|en|de)\s+([a-zA-Z\s]+)(?:\s*,|\s*tx|\s*texas)?/i
    ];
    
    for (const pattern of cityPatterns) {
      const match = text.match(pattern);
      if (match) {
        const candidate = match[1].trim().toLowerCase();
        for (const city of this.knownCities) {
          if (candidate === city || candidate.includes(city)) {
            return city;
          }
        }
      }
    }
    
    return null;
  }

  async findZoneByCity(cityName) {
    if (!cityName || cityName.length < 3) return null;
    
    const zone = await CoverageZone.findOne({
      where: {
        city: {
          [Op.iLike]: `%${cityName}%`
        },
        is_active: true
      }
    });
    
    return zone;
  }

  isZipCodeMessage(text) {
    if (!text) return false;
    
    const cleanText = text.trim();
    
    if (/^\d{5}$/.test(cleanText)) return true;
    
    if (/zip\s*(?:code)?/i.test(cleanText) && /\d{5}/.test(cleanText)) return true;
    if (/codigo\s*(?:postal)?/i.test(cleanText) && /\d{5}/.test(cleanText)) return true;
    if (/\bcp\b/i.test(cleanText) && /\d{5}/.test(cleanText)) return true;
    if (/postal/i.test(cleanText) && /\d{5}/.test(cleanText)) return true;
    
    return false;
  }

  knownCities = [
    'dallas', 'fort worth', 'arlington', 'garland', 'irving', 'plano', 
    'mesquite', 'richardson', 'carrollton', 'grand prairie', 'denton',
    'mckinney', 'frisco', 'lewisville', 'flower mound', 'cedar hill',
    'desoto', 'duncanville', 'lancaster', 'rowlett', 'sachse', 'wylie',
    'murphy', 'forney', 'rockwall', 'terrell', 'seagoville', 'balch springs',
    'hutchins', 'wilmer', 'allen', 'the colony', 'coppell', 'farmers branch',
    'addison', 'university park', 'highland park', 'sunnyvale', 'heath',
    'fate', 'royse city', 'waxahachie', 'midlothian', 'mansfield', 'euless',
    'bedford', 'hurst', 'grapevine', 'colleyville', 'southlake', 'keller'
  ];

  isCityMessage(text) {
    if (!text) return false;
    
    const cleanText = text.trim().toLowerCase();
    
    if (cleanText.length < 4 || cleanText.length > 50) return false;
    
    const nonCityPatterns = [
      /^(ok|si|no|yes|gracias|listo|perfecto|bueno|bien|hola|claro|que|como|cuando|donde|por|para)$/i,
      /^\d+$/,
      /^https?:\/\//i,
      /[!?@#$%^&*()+=\[\]{}|\\/<>]/
    ];
    
    for (const pattern of nonCityPatterns) {
      if (pattern.test(cleanText)) return false;
    }
    
    for (const city of this.knownCities) {
      if (cleanText === city) {
        return true;
      }
      const cityRegex = new RegExp(`\\b${city}\\b`, 'i');
      if (cityRegex.test(cleanText)) {
        return true;
      }
    }
    
    return false;
  }

  async validateZipOrCity(text) {
    const zipCode = this.extractZipCode(text);
    
    if (zipCode) {
      const zone = await CoverageZone.findOne({
        where: {
          zip_code: zipCode,
          is_active: true
        }
      });
      
      if (zone) {
        return {
          valid: true,
          type: 'zip',
          value: zipCode,
          zone: zone.toDict(),
          message: `ZIP ${zipCode} validado - ${zone.city || zone.zone_name || 'Zona con cobertura'}`
        };
      } else {
        return {
          valid: false,
          type: 'zip',
          value: zipCode,
          zone: null,
          message: `No hay cobertura en ZIP ${zipCode}`
        };
      }
    }
    
    if (this.isCityMessage(text)) {
      const cityName = this.extractCityName(text);
      if (cityName) {
        const zone = await this.findZoneByCity(cityName);
        
        if (zone) {
          return {
            valid: true,
            type: 'city',
            value: cityName,
            zone: zone.toDict(),
            message: `Ciudad ${zone.city} validada - ZIP ${zone.zip_code}`
          };
        } else {
          return {
            valid: false,
            type: 'city',
            value: cityName,
            zone: null,
            message: `No hay cobertura en ${cityName}`
          };
        }
      }
    }
    
    return {
      valid: false,
      type: 'unknown',
      value: text,
      zone: null,
      message: 'No se pudo identificar ZIP code o ciudad'
    };
  }

  detectAddressType(address) {
    const lowerAddress = address.toLowerCase();
    
    const apartmentIndicators = [
      'apt', 'apartment', 'unit', 'suite', 'ste', '#',
      'floor', 'fl', 'building', 'bldg', 'room', 'rm',
      'penthouse', 'ph', 'condo', 'condominium', 'depto',
      'departamento', 'piso', 'edificio'
    ];
    
    for (const indicator of apartmentIndicators) {
      if (lowerAddress.includes(indicator)) {
        return 'apartment';
      }
    }
    
    return 'house';
  }

  hasApartmentNumber(address) {
    const patterns = [
      /apt\.?\s*#?\s*\d+/i,
      /apartment\s*#?\s*\d+/i,
      /unit\s*#?\s*\d+/i,
      /suite\s*#?\s*\d+/i,
      /ste\.?\s*#?\s*\d+/i,
      /#\s*\d+/,
      /\d+[a-zA-Z]$/,
      /depto\.?\s*\d+/i
    ];
    
    return patterns.some(pattern => pattern.test(address));
  }

  async checkCoverage(zipCode) {
    if (!zipCode) {
      return {
        hasCoverage: false,
        zone: null,
        reason: 'No se pudo extraer el codigo postal de la direccion'
      };
    }

    const zone = await CoverageZone.findOne({
      where: {
        zip_code: zipCode,
        is_active: true
      }
    });

    if (zone) {
      return {
        hasCoverage: true,
        zone: zone.toDict(),
        reason: null
      };
    }

    return {
      hasCoverage: false,
      zone: null,
      reason: `No hay cobertura en el codigo postal ${zipCode}`
    };
  }

  isLikelyAddress(text) {
    if (!text || text.length < 8) return false;
    
    const lowerText = text.toLowerCase();
    
    const nonAddressPatterns = [
      /^(ok|si|no|gracias|listo|perfecto|bueno|bien|hola|claro)/i,
      /^\?+$/,
      /^\.+$/,
      /tarjeta/i,
      /precio/i,
      /cuanto/i,
      /cuando/i,
      /pago/i,
      /zelle/i,
      /deposito/i,
      /transfer/i,
      /presupuesto/i,
      /recordatorio/i,
      /^\d+$/,
      /^https?:\/\//i,
      /^@/,
      /whatsapp/i
    ];
    
    for (const pattern of nonAddressPatterns) {
      if (pattern.test(text)) return false;
    }
    
    const streetIndicators = [
      'street', 'st', 'avenue', 'ave', 'road', 'rd', 'drive', 'dr',
      'lane', 'ln', 'boulevard', 'blvd', 'way', 'court', 'ct',
      'place', 'pl', 'circle', 'cir', 'highway', 'hwy', 'pkwy', 'parkway',
      'calle', 'avenida', 'carretera', 'camino', 'paseo',
      'apt', 'apartment', 'suite', 'unit'
    ];
    
    const cityStateIndicators = [
      'dallas', 'tx', 'texas', 'fort worth', 'arlington', 'garland',
      'irving', 'plano', 'mesquite', 'richardson', 'carrollton',
      'grand prairie', 'denton', 'mckinney', 'frisco', 'lewisville',
      'flower mound', 'cedar hill', 'desoto', 'duncanville',
      'lancaster', 'rowlett', 'sachse', 'wylie', 'murphy',
      'forney', 'rockwall', 'terrell', 'seagoville', 'balch springs',
      'hutchins', 'wilmer', 'florida', 'fl', 'dover'
    ];
    
    const hasStreetWord = streetIndicators.some(ind => {
      const regex = new RegExp(`\\b${ind}\\b`, 'i');
      return regex.test(lowerText);
    });
    
    const hasCityState = cityStateIndicators.some(ind => {
      const regex = new RegExp(`\\b${ind}\\b`, 'i');
      return regex.test(lowerText);
    });
    
    const hasStreetNumber = /^\d+\s+\w+/.test(text.trim()) || /\b\d+\s+\w+\s+(st|rd|dr|ave|ln|blvd|way|ct|pl|cir)/i.test(text);
    
    const hasZipCode = this.extractZipCode(text) !== null;
    
    if (hasZipCode && hasStreetNumber) return true;
    if (hasZipCode && hasStreetWord) return true;
    if (hasZipCode && hasCityState) return true;
    if (hasStreetNumber && hasStreetWord && hasCityState) return true;
    if (hasStreetNumber && hasStreetWord) return true;
    
    return false;
  }

  async validateAddress(address) {
    const zipCode = this.extractZipCode(address);
    const addressType = this.detectAddressType(address);
    const isAddress = this.isLikelyAddress(address);
    const coverageResult = await this.checkCoverage(zipCode);
    
    let needsApartmentNumber = false;
    if (addressType === 'apartment' && !this.hasApartmentNumber(address)) {
      needsApartmentNumber = true;
    }

    let validationMessage = '';
    if (isAddress) {
      if (coverageResult.hasCoverage) {
        validationMessage = `Direccion validada. Tipo: ${addressType === 'apartment' ? 'Apartamento' : 'Casa'}. ZIP: ${zipCode}`;
        if (needsApartmentNumber) {
          validationMessage += ' - FALTA NUMERO DE APARTAMENTO';
        }
      } else {
        validationMessage = coverageResult.reason || 'Sin cobertura';
      }
    }

    return {
      address,
      zipCode,
      addressType,
      isAddress,
      needsApartmentNumber,
      hasCoverage: coverageResult.hasCoverage,
      zone: coverageResult.zone,
      validationMessage
    };
  }
}

export default AddressValidationService;
