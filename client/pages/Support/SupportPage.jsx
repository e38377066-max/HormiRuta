import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './SupportPage.css'

export default function SupportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="support-page">
      <header className="support-header">
        <h1>{t('support.title')}</h1>
        <p>Area 862 System</p>
      </header>

      <main className="support-main">
        <button className="support-back-btn" onClick={() => navigate(-1)}>
          <span className="material-icons" style={{ fontSize: 16 }}>arrow_back</span>
          {t('legal.backToApp')}
        </button>

        <section className="support-section">
          <h2 className="support-section-title">
            <span className="material-icons">contact_support</span>
            {t('support.contactTitle')}
          </h2>
          <div className="support-grid">
            <a className="support-card support-whatsapp" href="https://wa.me/18622862862" target="_blank" rel="noopener noreferrer">
              <span className="support-card-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" width="30" height="30">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </span>
              <div className="support-card-text">
                <h3>WhatsApp</h3>
                <p>+1 (862) 286-2862</p>
                <span className="support-card-action">{t('support.openChat')}</span>
              </div>
              <span className="material-icons support-card-arrow">chevron_right</span>
            </a>

            <a className="support-card support-email" href="mailto:admin@area862system.com">
              <span className="support-card-icon">
                <span className="material-icons" style={{ fontSize: 30 }}>email</span>
              </span>
              <div className="support-card-text">
                <h3>{t('support.emailTitle')}</h3>
                <p>admin@area862system.com</p>
                <span className="support-card-action">{t('support.sendEmail')}</span>
              </div>
              <span className="material-icons support-card-arrow">chevron_right</span>
            </a>

            <a className="support-card support-web" href="https://area862system.com" target="_blank" rel="noopener noreferrer">
              <span className="support-card-icon">
                <span className="material-icons" style={{ fontSize: 30 }}>language</span>
              </span>
              <div className="support-card-text">
                <h3>{t('support.webTitle')}</h3>
                <p>area862system.com</p>
                <span className="support-card-action">{t('support.visitSite')}</span>
              </div>
              <span className="material-icons support-card-arrow">chevron_right</span>
            </a>
          </div>

          <div className="support-info-card">
            <span className="material-icons">schedule</span>
            <p>{t('support.hours')}</p>
          </div>
        </section>

        <section className="support-section">
          <h2 className="support-section-title">
            <span className="material-icons">gavel</span>
            {t('support.legalTitle')}
          </h2>
          <div className="support-legal-links">
            <Link to="/privacy" className="support-legal-card">
              <span className="support-legal-icon">
                <span className="material-icons">lock</span>
              </span>
              <div className="support-legal-text">
                <h3>{t('support.privacyTitle')}</h3>
                <p>{t('support.privacyDesc')}</p>
              </div>
              <span className="material-icons support-card-arrow">chevron_right</span>
            </Link>

            <Link to="/terms" className="support-legal-card">
              <span className="support-legal-icon">
                <span className="material-icons">description</span>
              </span>
              <div className="support-legal-text">
                <h3>{t('support.termsTitle')}</h3>
                <p>{t('support.termsDesc')}</p>
              </div>
              <span className="material-icons support-card-arrow">chevron_right</span>
            </Link>
          </div>
        </section>

        <section className="support-section">
          <h2 className="support-section-title">
            <span className="material-icons">help_outline</span>
            {t('support.faqTitle')}
          </h2>
          <div className="support-faq">
            {[1, 2, 3, 4, 5].map(n => (
              <details key={n} className="support-faq-item">
                <summary>{t(`support.faq${n}Q`)}</summary>
                <p>{t(`support.faq${n}A`)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="support-section">
          <h2 className="support-section-title">
            <span className="material-icons">info</span>
            {t('support.aboutTitle')}
          </h2>
          <div className="support-about-card">
            <div className="support-about-row">
              <span>{t('support.appName')}</span>
              <span>Area 862 System</span>
            </div>
            <div className="support-about-row">
              <span>{t('support.company')}</span>
              <span>Area 862 · Dallas, TX</span>
            </div>
            <div className="support-about-row">
              <span>{t('support.contact')}</span>
              <span>admin@area862system.com</span>
            </div>
            <div className="support-about-row">
              <span>{t('support.website')}</span>
              <a href="https://area862system.com" target="_blank" rel="noopener noreferrer">area862system.com</a>
            </div>
          </div>
        </section>

        <p className="support-footer">{t('legal.lastUpdated')}</p>
      </main>
    </div>
  )
}
