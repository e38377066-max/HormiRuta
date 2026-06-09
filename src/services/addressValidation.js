/**
 * @fileoverview Servicio para la validación de direcciones y comprobación de cobertura.
 * Proporciona métodos para extraer códigos postales y nombres de ciudades de textos,
 * validar si una dirección está dentro de las zonas de cobertura y detectar el tipo de vivienda.
 */

import { CoverageZone } from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Clase AddressValidationService para gestionar la lógica de validación de direcciones.
 * @description Utiliza patrones de expresiones regulares y búsquedas en base de datos para validar cobertura.
 */
class AddressValidationService {
  /**
   * Crea una instancia de AddressValidationService.
   * @param {number|string} [userId] - ID del usuario para filtrar zonas de cobertura (opcional).
   */
  constructor(userId) {
    this.userId = userId;
  }

  /**
   * Extrae un código postal (5 dígitos) de un texto dado.
   * @description Prueba varios patrones comunes de mención de código postal (ZIP, CP, etc.).
   * @param {string} text - El texto a analizar.
   * @returns {string|null} El código postal de 5 dígitos o null si no se encuentra.
   */
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

  /**
   * Extrae el nombre de una ciudad conocida de un texto.
   * @description Compara el texto con una lista predefinida de ciudades del área de DFW.
   * @param {string} text - El texto a analizar.
   * @returns {string|null} El nombre de la ciudad encontrada o null.
   */
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

  /**
   * Busca una zona de cobertura por el nombre de la ciudad.
   * @description Realiza una búsqueda insensible a mayúsculas en la tabla CoverageZone.
   * @param {string} cityName - Nombre de la ciudad.
   * @returns {Promise<Object|null>} El modelo de la zona encontrada o null.
   */
  async findZoneByCity(cityName) {
    if (!cityName || cityName.length < 3) return null;
    
    const where = {
      city: {
        [Op.iLike]: `%${cityName}%`
      },
      is_active: true
    };
    if (this.userId) where.user_id = this.userId;

    let zone = await CoverageZone.findOne({ where });

    if (!zone && this.userId) {
      zone = await CoverageZone.findOne({
        where: { city: { [Op.iLike]: `%${cityName}%` }, is_active: true }
      });
    }
    
    return zone;
  }

  /**
   * Determina si un mensaje contiene predominantemente un código postal.
   * @param {string} text - El texto a analizar.
   * @returns {boolean} True si parece ser un mensaje de código postal.
   */
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

  /**
   * Lista de ciudades conocidas en el área de Dallas-Fort Worth.
   * @type {string[]}
   */
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

  /**
   * Determina si un mensaje contiene el nombre de una ciudad conocida.
   * @param {string} text - El texto a analizar.
   * @returns {boolean} True si contiene una ciudad conocida.
   */
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

  /**
   * Valida si un texto contiene un código postal o ciudad con cobertura.
   * @param {string} text - El texto a validar.
   * @returns {Promise<Object>} Resultado de la validación con estado, tipo y mensaje.
   */
  async validateZipOrCity(text) {
    const zipCode = this.extractZipCode(text);
    
    if (zipCode) {
      const zipWhere = { zip_code: zipCode, is_active: true };
      if (this.userId) zipWhere.user_id = this.userId;
      let zone = await CoverageZone.findOne({ where: zipWhere });

      if (!zone && this.userId) {
        zone = await CoverageZone.findOne({ where: { zip_code: zipCode, is_active: true } });
      }
      
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
          // Ciudad conocida en DFW pero no en la base de datos de cobertura:
          // No decir "no llegamos" — pedir ZIP para confirmar
          return {
            valid: false,
            type: 'city_needs_zip',
            value: cityName,
            zone: null,
            message: `Ciudad conocida pero sin ZIP registrado: ${cityName}`
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

  /**
   * Detecta si una dirección parece ser un apartamento o una casa.
   * @param {string} address - La dirección a analizar.
   * @returns {string} 'apartment' o 'house'.
   */
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

  /**
   * Verifica si una dirección contiene un número de unidad o apartamento.
   * @param {string} address - La dirección a analizar.
   * @returns {boolean} True si tiene número de apartamento.
   */
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

  /**
   * Comprueba si un código postal tiene cobertura activa.
   * @param {string} zipCode - El código postal.
   * @returns {Promise<Object>} Resultado con hasCoverage, zone y reason.
   */
  async checkCoverage(zipCode) {
    if (!zipCode) {
      return {
        hasCoverage: false,
        zone: null,
        reason: 'No se pudo extraer el codigo postal de la direccion'
      };
    }

    const coverageWhere = { zip_code: zipCode, is_active: true };
    if (this.userId) coverageWhere.user_id = this.userId;
    let zone = await CoverageZone.findOne({ where: coverageWhere });

    if (!zone && this.userId) {
      zone = await CoverageZone.findOne({ where: { zip_code: zipCode, is_active: true } });
    }

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

  /**
   * Evalúa si un texto parece ser una dirección física.
   * @param {string} text - El texto a evaluar.
   * @returns {boolean} True si es probable que sea una dirección.
   */
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

  /**
   * Realiza una validación completa de una dirección.
   * @description Valida si es dirección, extrae ZIP, determina tipo y comprueba cobertura.
   * @param {string} address - La dirección a validar.
   * @returns {Promise<Object>} Resultado detallado de la validación.
   */
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

