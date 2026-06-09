/**
 * @fileoverview Definición del modelo de Configuración de Mensajería (MessagingSettings).
 * Almacena los tokens, mensajes automáticos y reglas del bot para cada usuario administrador.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Modelo MessagingSettings para controlar el comportamiento de los bots y notificaciones.
 */
const MessagingSettings = sequelize.define('MessagingSettings', {
  /** ID único autoincremental */
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  /** ID del usuario (admin) al que pertenecen estas configuraciones */
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  /** Token de acceso a la API de Respond.io */
  respond_api_token: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  /** Indica si el sistema de mensajería está activo para este usuario */
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  /** Indica si se deben validar las direcciones automáticamente */
  auto_validate_addresses: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  /** Indica si el bot responde automáticamente en zonas con cobertura */
  auto_respond_coverage: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  /** Indica si el bot responde automáticamente en zonas sin cobertura */
  auto_respond_no_coverage: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  /** Mensaje enviado cuando no hay cobertura en el código postal */
  no_coverage_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Lo sentimos, actualmente no tenemos cobertura en tu zona. Te notificaremos cuando ampliemos nuestra area de servicio.'
  },
  /** Mensaje enviado cuando se confirma cobertura */
  coverage_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Tu direccion esta dentro de nuestra zona de cobertura. Tu pedido ha sido registrado y pronto sera asignado a un repartidor.'
  },
  /** Mensaje al confirmar el pedido */
  order_confirmed_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Tu pedido ha sido confirmado. Te avisaremos cuando el repartidor este en camino.'
  },
  /** Mensaje al asignar un conductor */
  driver_assigned_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Un repartidor ha sido asignado a tu pedido y esta en camino.'
  },
  /** Mensaje al completar la entrega */
  order_completed_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Tu pedido ha sido entregado. Gracias por tu preferencia!'
  },
  /** Secreto para validar webhooks entrantes */
  webhook_secret: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** ID del canal de mensajería por defecto en Respond.io */
  default_channel_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Modo de atención (ej: 'assisted', 'manual', 'automated') */
  attention_mode: {
    type: DataTypes.STRING(20),
    defaultValue: 'assisted'
  },
  /** Indica si se aplica el horario de atención */
  business_hours_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  /** Hora de inicio de atención (HH:mm) */
  business_hours_start: {
    type: DataTypes.STRING(5),
    defaultValue: '09:00'
  },
  /** Hora de fin de atención (HH:mm) */
  business_hours_end: {
    type: DataTypes.STRING(5),
    defaultValue: '18:00'
  },
  /** Días de atención (array de números, 1=Lunes, 7=Domingo) */
  business_days: {
    type: DataTypes.JSON,
    defaultValue: [1, 2, 3, 4, 5]
  },
  /** Zona horaria para los cálculos de horario comercial */
  timezone: {
    type: DataTypes.STRING(50),
    defaultValue: 'America/Chicago'
  },
  /** Mensaje enviado fuera del horario de atención */
  out_of_hours_message: {
    type: DataTypes.TEXT,
    defaultValue: '🌙 ¡Hola hola! 😊\n\nGracias por comunicarte con nosotros 😊 Ahorita estamos fuera de horario 🕒 pero puedes dejar tu mensaje sin problema 💬\n\nEscríbenos lo que necesitas 🙌 y en cuanto estemos de regreso en horario laboral lo leemos y te respondemos lo más pronto posible 💛📲'
  },
  /** ID del agente por defecto para asignaciones */
  default_agent_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Nombre del agente por defecto */
  default_agent_name: {
    type: DataTypes.STRING(100),
    defaultValue: 'Felipe Delgado'
  },
  /** Mensaje de bienvenida para clientes recurrentes */
  welcome_existing_customer: {
    type: DataTypes.TEXT,
    defaultValue: '👋 ¡Hola! Qué gusto volver a tener noticias suyas 😊 Espero que todo esté yendo muy bien.\n\nPor favor, cuéntame en qué puedo ayudarle esta vez 🤔✨'
  },
  /** Mensaje de bienvenida para clientes nuevos */
  welcome_new_customer: {
    type: DataTypes.TEXT,
    defaultValue: '¡Hola! 🙌 Somos de Area 862 Graphics.\n\n📩😊 Cuéntanos, ¿ya uno de nuestros agentes le brindó información sobre nuestros servicios y precios?'
  },
  /** Mensaje de bienvenida para contactos provenientes de anuncios */
  welcome_from_ads: {
    type: DataTypes.TEXT,
    defaultValue: '¡Hola! 👋 Gracias por tu interés.\n\nPara verificar si tenemos cobertura en tu zona, por favor envíame tu código postal (ZIP) 📍\n\nPor ejemplo: 75208'
  },
  /** Respuesta cuando el cliente ya tiene información */
  has_info_response: {
    type: DataTypes.TEXT,
    defaultValue: 'Perfecto ✅ Por acá puede ver algunos diseños que tenemos disponibles 🎨'
  },
  /** Enlace al catálogo de productos */
  catalog_link: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  /** Mensaje solicitando el código postal */
  request_zip_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Vi que te interesan algunos de nuestros productos y quiero ayudarte a encontrar las mejores opciones 😄\n\n📍 Por favor, envíame solo el número de tu código postal (ZIP), por ejemplo 75208 ✉️\n\nCon eso confirmo si llegamos a tu zona y te paso los precios enseguida 🚚✨'
  },
  /** Recordatorio para enviar el código postal */
  remind_zip_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Para poder continuar, necesito que me envíes tu código postal (ZIP) ✅\n\nPor ejemplo: 75208'
  },
  /** Mensaje del menú de selección de productos */
  product_menu_message: {
    type: DataTypes.TEXT,
    defaultValue: '¿En cuál de estos productos está interesado? (Indica el número del producto)\n\n1. Tarjetas\n2. Magnéticos\n3. Post Cards\n4. Playeras'
  },
  /** Lista interna de productos disponibles para el bot */
  products_list: {
    type: DataTypes.TEXT,
    defaultValue: '[]'
  },
  /** Solicitud de ZIP cuando el cliente confirma que ya tiene info previa */
  has_info_request_zip: {
    type: DataTypes.TEXT,
    defaultValue: '¡Qué bien! 😊 Me alegra que ya tengas los detalles.\n\nPara continuar con tu pedido, necesito confirmar tu zona de entrega.\n\n¿Me compartes tu código postal (ZIP)? 📍'
  },
  /** Recordatorio para seleccionar un producto */
  remind_product_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Disculpa, no entendí tu selección 😅\n\nPor favor responde con el número del producto:'
  },
  /** Recordatorio para respuestas de Sí/No */
  remind_yes_no_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Por favor, responde Sí o No: ¿Ya te brindaron información sobre nuestros servicios y precios? 😊'
  },
  /** Mensaje enviado tras detectar abandono de conversación */
  abandoned_message: {
    type: DataTypes.TEXT,
    defaultValue: '¡Hola! 👋 Noté que quedamos pendientes.\n\n¿Sigues interesado en continuar con tu pedido?\n¿Hay algo más en lo que pueda ayudarte?'
  },
  /** Mensaje enviado cuando el cliente detecta frustración en el chat */
  frustrated_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Entiendo tu frustración y lamento mucho cualquier inconveniente 😔\n\nDéjame pasarte de inmediato con uno de nuestros agentes para resolver tu situación de la mejor manera posible.'
  },
  /** Mensaje de confirmación de producto seleccionado */
  product_selected_message: {
    type: DataTypes.TEXT,
    defaultValue: '¡Perfecto! Te interesan {{product}} 👍\n\nDame un momento, te paso con uno de nuestros especialistas que te dará toda la información sobre precios, diseños y tiempos de entrega 📋✨'
  },
  /** Minutos de inactividad para considerar una conversación como abandonada */
  abandonment_minutes: {
    type: DataTypes.INTEGER,
    defaultValue: 30
  },
  /** Mensaje avisando que se transfiere a un agente humano */
  passing_to_agent_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Un momento, te conecto con uno de nuestros agentes 👨‍💼'
  },
  /** Etiquetas (tags) de Respond.io que deben ser ignoradas por el bot */
  excluded_tags: {
    type: DataTypes.JSON,
    defaultValue: ['Personal', 'Personales', 'IprintPOS', 'ClientesArea', 'Area862Designers']
  },
  /** Listado de productos con sus palabras clave para detección por IA/Bot */
  products: {
    type: DataTypes.JSON,
    defaultValue: [
      { id: 1, name: 'Tarjetas', keywords: ['tarjetas', 'tarjeta', 'cards', 'card', 'business cards'] },
      { id: 2, name: 'Magnéticos', keywords: ['magneticos', 'magnetico', 'magnets', 'magnet', 'iman', 'imanes'] },
      { id: 3, name: 'Post Cards', keywords: ['postcards', 'postcard', 'post cards', 'post card', 'postal', 'postales'] },
      { id: 4, name: 'Playeras', keywords: ['playeras', 'playera', 'camisetas', 'camiseta', 'shirts', 'shirt', 't-shirt'] }
    ]
  },
  /** Indica si está en modo de prueba (solo procesa un contacto específico) */
  test_mode: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  /** ID del contacto de Respond.io autorizado para pruebas */
  test_contact_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Límite de mensajes históricos a revisar para análisis de contexto */
  message_history_limit: {
    type: DataTypes.INTEGER,
    defaultValue: 50
  },
  /** Indica si el seguimiento automático (followup) está habilitado */
  followup_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  /** Minutos para enviar el primer mensaje de seguimiento */
  followup_timeout_minutes: {
    type: DataTypes.INTEGER,
    defaultValue: 5
  },
  /** Contenido del primer mensaje de seguimiento */
  followup_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Hola! Sigues ahi? Quedamos pendientes de nuestra conversacion. Puedo ayudarte en algo mas?'
  },
  /** Contenido del segundo mensaje de seguimiento (cierre por inactividad) */
  followup_message_2: {
    type: DataTypes.TEXT,
    defaultValue: 'Hola de nuevo! Como no recibimos respuesta, pausaremos la conversacion. Cuando gustes, escribenos y con gusto te atendemos!'
  },
  /** Indica si la integración con OpenAI está habilitada */
  ai_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  /** Clave de API de OpenAI (encriptada o texto plano según despliegue) */
  openai_api_key: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  /** Si true, la IA actúa como vendedor humano fluido en vez del state machine rígido */
  conversational_mode: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  /** Tabla de precios de productos compartida con la IA */
  product_prices: {
    type: DataTypes.JSON,
    defaultValue: []
  }
}, {
  tableName: 'messaging_settings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

/**
 * @description Convierte la instancia de configuración a un objeto plano, anonimizando el token API.
 * @returns {Object} Diccionario con los parámetros de configuración.
 */
MessagingSettings.prototype.toDict = function() {
  return {
    id: this.id,
    user_id: this.user_id,
    is_active: this.is_active,
    auto_validate_addresses: this.auto_validate_addresses,
    auto_respond_coverage: this.auto_respond_coverage,
    auto_respond_no_coverage: this.auto_respond_no_coverage,
    no_coverage_message: this.no_coverage_message,
    coverage_message: this.coverage_message,
    order_confirmed_message: this.order_confirmed_message,
    driver_assigned_message: this.driver_assigned_message,
    order_completed_message: this.order_completed_message,
    default_channel_id: this.default_channel_id,
    attention_mode: this.attention_mode,
    has_api_token: !!this.respond_api_token,
    business_hours_enabled: this.business_hours_enabled,
    business_hours_start: this.business_hours_start,
    business_hours_end: this.business_hours_end,
    business_days: this.business_days,
    timezone: this.timezone,
    out_of_hours_message: this.out_of_hours_message,
    default_agent_id: this.default_agent_id,
    default_agent_name: this.default_agent_name,
    welcome_existing_customer: this.welcome_existing_customer,
    welcome_new_customer: this.welcome_new_customer,
    has_info_response: this.has_info_response,
    catalog_link: this.catalog_link,
    request_zip_message: this.request_zip_message,
    remind_zip_message: this.remind_zip_message,
    product_menu_message: this.product_menu_message,
    has_info_request_zip: this.has_info_request_zip,
    remind_product_message: this.remind_product_message,
    remind_yes_no_message: this.remind_yes_no_message,
    abandoned_message: this.abandoned_message,
    frustrated_message: this.frustrated_message,
    product_selected_message: this.product_selected_message,
    abandonment_minutes: this.abandonment_minutes,
    passing_to_agent_message: this.passing_to_agent_message,
    excluded_tags: this.excluded_tags,
    products: this.products,
    products_list: this.products_list,
    test_mode: this.test_mode,
    test_contact_id: this.test_contact_id,
    message_history_limit: this.message_history_limit,
    followup_enabled: this.followup_enabled,
    followup_timeout_minutes: this.followup_timeout_minutes,
    followup_message: this.followup_message,
    followup_message_2: this.followup_message_2,
    ai_enabled: this.ai_enabled,
    has_openai_key: !!this.openai_api_key,
    conversational_mode: this.conversational_mode,
    product_prices: this.product_prices || [],
    created_at: this.created_at,
    updated_at: this.updated_at
  };
};

export default MessagingSettings;
