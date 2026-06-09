import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './LegalPage.css'

export default function TermsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="legal-page">
      <header className="legal-header">
        <h1>{t('legal.terms.title')}</h1>
        <p>{t('legal.terms.subtitle')}</p>
      </header>

      <main className="legal-main">
        <button className="legal-back-btn" onClick={() => navigate(-1)}>
          <span className="material-icons" style={{ fontSize: 16 }}>arrow_back</span>
          {t('legal.backToApp')}
        </button>

        <div className="legal-card">
          <div className="legal-section">
            <h2>{t('legal.terms.s1Title')}</h2>
            <p>{t('legal.terms.s1Body')}</p>
          </div>

          <div className="legal-section">
            <h2>{t('legal.terms.s2Title')}</h2>
            <p>{t('legal.terms.s2Body')}</p>
          </div>

          <div className="legal-section">
            <h2>{t('legal.terms.s3Title')}</h2>
            <ul>
              <li>{t('legal.terms.s3i1')}</li>
              <li>{t('legal.terms.s3i2')}</li>
              <li>{t('legal.terms.s3i3')}</li>
              <li>{t('legal.terms.s3i4')}</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>{t('legal.terms.s4Title')}</h2>
            <ul>
              <li>{t('legal.terms.s4i1')}</li>
              <li>{t('legal.terms.s4i2')}</li>
              <li>{t('legal.terms.s4i3')}</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>{t('legal.terms.s5Title')}</h2>
            <p>{t('legal.terms.s5Body')}</p>
          </div>

          <div className="legal-section">
            <h2>{t('legal.terms.s6Title')}</h2>
            <p>{t('legal.terms.s6Body')}</p>
          </div>

          <div className="legal-section">
            <h2>{t('legal.terms.s7Title')}</h2>
            <p>
              {t('legal.terms.s7Body')}<br />
              <a href="mailto:felipedelgado2006@gmail.com">felipedelgado2006@gmail.com</a>
            </p>
          </div>
        </div>

        <p className="legal-footer">{t('legal.lastUpdated')}</p>
      </main>
    </div>
  )
}
