import { Op } from 'sequelize';
import AgentStyleProfile from '../models/AgentStyleProfile.js';
import MessageLog from '../models/MessageLog.js';
import MessagingSettings from '../models/MessagingSettings.js';
import AIService from './aiService.js';

class StyleLearningService {
  // Carga el perfil de estilo activo (uno por user_id)
  static async getActive(userId) {
    if (!userId) return null;
    try {
      return await AgentStyleProfile.findOne({ where: { user_id: userId, is_active: true } });
    } catch (e) {
      return null;
    }
  }

  // Analiza los mensajes recientes de los agentes humanos para extraer su estilo
  // Se ejecuta periódicamente (1 vez al día) o bajo demanda desde admin
  static async refreshStyleProfile(userId) {
    if (!userId) return null;
    try {
      const settings = await MessagingSettings.findOne({ where: { user_id: userId } });
      if (!settings?.ai_enabled || !settings?.openai_api_key) return null;

      const existing = await AgentStyleProfile.findOne({ where: { user_id: userId } });

      // Solo re-analizar si pasaron al menos 12 horas desde el último análisis
      if (existing?.last_analyzed_at) {
        const hours = (Date.now() - new Date(existing.last_analyzed_at).getTime()) / 3600000;
        if (hours < 12) return existing;
      }

      // Trae los últimos mensajes salientes que NO son del bot (es decir, agentes humanos)
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // últimos 30 días
      const agentMessages = await MessageLog.findAll({
        where: {
          user_id: userId,
          direction: 'outgoing',
          message_type: 'agent',
          created_at: { [Op.gte]: since },
          message_content: { [Op.ne]: null }
        },
        order: [['created_at', 'DESC']],
        limit: 200
      });

      if (agentMessages.length < 10) {
        console.log(`[StyleLearning] Solo ${agentMessages.length} mensajes de agentes; se necesitan al menos 10 para extraer estilo`);
        return existing;
      }

      const sample = agentMessages
        .map(m => `- ${(m.message_content || '').slice(0, 200)}`)
        .join('\n')
        .slice(-7000);

      const ai = new AIService(settings.openai_api_key, settings, userId);
      const analysis = await ai.analyzeAgentStyle(sample);
      if (!analysis) return existing;

      const data = {
        user_id: userId,
        style_summary: analysis.style_summary || existing?.style_summary || null,
        common_phrases: analysis.common_phrases || existing?.common_phrases || [],
        emoji_usage: analysis.emoji_usage || existing?.emoji_usage || null,
        closing_techniques: analysis.closing_techniques || existing?.closing_techniques || null,
        do_phrases: analysis.do_phrases || existing?.do_phrases || [],
        dont_phrases: analysis.dont_phrases || existing?.dont_phrases || [],
        is_active: existing?.is_active !== false,
        messages_analyzed: agentMessages.length,
        last_analyzed_at: new Date()
      };

      if (existing) {
        await existing.update(data);
        console.log(`[StyleLearning] Perfil de estilo actualizado para user ${userId} (${agentMessages.length} msgs analizados)`);
        return existing;
      } else {
        const created = await AgentStyleProfile.create(data);
        console.log(`[StyleLearning] Perfil de estilo creado para user ${userId} (${agentMessages.length} msgs analizados)`);
        return created;
      }
    } catch (e) {
      console.error('[StyleLearning] refresh error:', e.message);
      return null;
    }
  }

  // Schedule diario que recorre todos los users activos y refresca su perfil
  static startScheduler() {
    const ONE_HOUR = 60 * 60 * 1000;
    const run = async () => {
      try {
        const settingsList = await MessagingSettings.findAll({
          where: { is_active: true, ai_enabled: true }
        });
        for (const s of settingsList) {
          if (s.openai_api_key) {
            await this.refreshStyleProfile(s.user_id);
          }
        }
      } catch (e) {
        console.error('[StyleLearning] scheduler error:', e.message);
      }
    };
    // Primera ejecución a los 5 min de arrancar, luego cada hora (cada perfil verifica internamente si toca re-analizar)
    setTimeout(run, 5 * 60 * 1000);
    setInterval(run, ONE_HOUR);
  }
}

export default StyleLearningService;
