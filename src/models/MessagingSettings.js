import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const MessagingSettings = sequelize.define('MessagingSettings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  respond_api_token: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  auto_validate_addresses: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  auto_respond_coverage: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  auto_respond_no_coverage: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  no_coverage_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Lo sentimos, actualmente no tenemos cobertura en tu zona. Te notificaremos cuando ampliemos nuestra area de servicio.'
  },
  coverage_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Tu direccion esta dentro de nuestra zona de cobertura. Tu pedido ha sido registrado y pronto sera asignado a un repartidor.'
  },
  order_confirmed_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Tu pedido ha sido confirmado. Te avisaremos cuando el repartidor este en camino.'
  },
  driver_assigned_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Un repartidor ha sido asignado a tu pedido y esta en camino.'
  },
  order_completed_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Tu pedido ha sido entregado. Gracias por tu preferencia!'
  },
  webhook_secret: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  default_channel_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  attention_mode: {
    type: DataTypes.STRING(20),
    defaultValue: 'assisted'
  },
  // Horario de atención
  business_hours_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  business_hours_start: {
    type: DataTypes.STRING(5),
    defaultValue: '09:00'
  },
  business_hours_end: {
    type: DataTypes.STRING(5),
    defaultValue: '18:00'
  },
  business_days: {
    type: DataTypes.JSON,
    defaultValue: [1, 2, 3, 4, 5]  // Lunes a Viernes
  },
  timezone: {
    type: DataTypes.STRING(50),
    defaultValue: 'America/Chicago'
  },
  out_of_hours_message: {
    type: DataTypes.TEXT,
    defaultValue: '🌙 ¡Hola hola! 😊\n\nGracias por comunicarte con nosotros 😊 Ahorita estamos fuera de horario 🕒 pero puedes dejar tu mensaje sin problema 💬\n\nEscríbenos lo que necesitas 🙌 y en cuanto estemos de regreso en horario laboral lo leemos y te respondemos lo más pronto posible 💛📲'
  },
  // Agente por defecto para asignación
  default_agent_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  default_agent_name: {
    type: DataTypes.STRING(100),
    defaultValue: 'Felipe Delgado'
  },
  // Mensajes del flujo de conversación
  welcome_existing_customer: {
    type: DataTypes.TEXT,
    defaultValue: '👋 ¡Hola! Qué gusto volver a tener noticias suyas 😊 Espero que todo esté yendo muy bien.\n\nPor favor, cuéntame en qué puedo ayudarle esta vez 🤔✨'
  },
  welcome_new_customer: {
    type: DataTypes.TEXT,
    defaultValue: '¡Hola! 🙌 Somos de Area 862 Graphics.\n\n📩😊 Cuéntanos, ¿ya uno de nuestros agentes le brindó información sobre nuestros servicios y precios?'
  },
  welcome_from_ads: {
    type: DataTypes.TEXT,
    defaultValue: '¡Hola! 👋 Gracias por tu interés.\n\nPara verificar si tenemos cobertura en tu zona, por favor envíame tu código postal (ZIP) 📍\n\nPor ejemplo: 75208'
  },
  has_info_response: {
    type: DataTypes.TEXT,
    defaultValue: 'Perfecto ✅ Por acá puede ver algunos diseños que tenemos disponibles 🎨'
  },
  catalog_link: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  request_zip_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Vi que te interesan algunos de nuestros productos y quiero ayudarte a encontrar las mejores opciones 😄\n\n📍 Por favor, envíame solo el número de tu código postal (ZIP), por ejemplo 75208 ✉️\n\nCon eso confirmo si llegamos a tu zona y te paso los precios enseguida 🚚✨'
  },
  remind_zip_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Para poder continuar, necesito que me envíes tu código postal (ZIP) ✅\n\nPor ejemplo: 75208'
  },
  product_menu_message: {
    type: DataTypes.TEXT,
    defaultValue: '¿En cuál de estos productos está interesado? (Indica el número del producto)\n\n1. Tarjetas\n2. Magnéticos\n3. Post Cards\n4. Playeras'
  },
  products_list: {
    type: DataTypes.TEXT,
    defaultValue: '[]'
  },
  has_info_request_zip: {
    type: DataTypes.TEXT,
    defaultValue: '¡Qué bien! 😊 Me alegra que ya tengas los detalles.\n\nPara continuar con tu pedido, necesito confirmar tu zona de entrega.\n\n¿Me compartes tu código postal (ZIP)? 📍'
  },
  remind_product_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Disculpa, no entendí tu selección 😅\n\nPor favor responde con el número del producto:'
  },
  remind_yes_no_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Por favor, responde Sí o No: ¿Ya te brindaron información sobre nuestros servicios y precios? 😊'
  },
  abandoned_message: {
    type: DataTypes.TEXT,
    defaultValue: '¡Hola! 👋 Noté que quedamos pendientes.\n\n¿Sigues interesado en continuar con tu pedido?\n¿Hay algo más en lo que pueda ayudarte?'
  },
  frustrated_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Entiendo tu frustración y lamento mucho cualquier inconveniente 😔\n\nDéjame pasarte de inmediato con uno de nuestros agentes para resolver tu situación de la mejor manera posible.'
  },
  product_selected_message: {
    type: DataTypes.TEXT,
    defaultValue: '¡Perfecto! Te interesan {{product}} 👍\n\nDame un momento, te paso con uno de nuestros especialistas que te dará toda la información sobre precios, diseños y tiempos de entrega 📋✨'
  },
  abandonment_minutes: {
    type: DataTypes.INTEGER,
    defaultValue: 30
  },
  passing_to_agent_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Un momento, te conecto con uno de nuestros agentes 👨‍💼'
  },
  // Tags para filtrar contactos
  excluded_tags: {
    type: DataTypes.JSON,
    defaultValue: ['Personal', 'IprintPOS', 'ClientesArea', 'Area862Designers']
  },
  // Lista de productos
  products: {
    type: DataTypes.JSON,
    defaultValue: [
      { id: 1, name: 'Tarjetas', keywords: ['tarjetas', 'tarjeta', 'cards', 'card', 'business cards'] },
      { id: 2, name: 'Magnéticos', keywords: ['magneticos', 'magnetico', 'magnets', 'magnet', 'iman', 'imanes'] },
      { id: 3, name: 'Post Cards', keywords: ['postcards', 'postcard', 'post cards', 'post card', 'postal', 'postales'] },
      { id: 4, name: 'Playeras', keywords: ['playeras', 'playera', 'camisetas', 'camiseta', 'shirts', 'shirt', 't-shirt'] }
    ]
  },
  // Modo de prueba - solo procesar un contacto específico
  test_mode: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  test_contact_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  // Límite de mensajes a revisar por contacto
  message_history_limit: {
    type: DataTypes.INTEGER,
    defaultValue: 50
  }
}, {
  tableName: 'messaging_settings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

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
    created_at: this.created_at,
    updated_at: this.updated_at
  };
};

export default MessagingSettings;
