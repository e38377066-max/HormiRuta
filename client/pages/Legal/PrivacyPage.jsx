import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './LegalPage.css'

export default function PrivacyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="legal-page">
      <header className="legal-header">
        <h1>{t('legal.privacy.title')}</h1>
        <p>{t('legal.privacy.subtitle')}</p>
      </header>

      <main className="legal-main">
        <button className="legal-back-btn" onClick={() => navigate(-1)}>
          <span className="material-icons" style={{ fontSize: 16 }}>arrow_back</span>
          {t('legal.backToApp')}
        </button>

        <div className="legal-card">
          <div className="legal-section">
            <h2>{t('legal.privacy.s1Title')}</h2>
            <p>{t('legal.privacy.s1Body')}</p>
          </div>

          <div className="legal-section">
            <h2>{t('legal.privacy.s2Title')}</h2>
            <ul>
              <li dangerouslySetInnerHTML={{ __html: t('legal.privacy.s2i1') }} />
              <li dangerouslySetInnerHTML={{ __html: t('legal.privacy.s2i2') }} />
              <li dangerouslySetInnerHTML={{ __html: t('legal.privacy.s2i3') }} />
              <li dangerouslySetInnerHTML={{ __html: t('legal.privacy.s2i4') }} />
              <li dangerouslySetInnerHTML={{ __html: t('legal.privacy.s2i5') }} />
            </ul>
          </div>

          <div className="legal-section">
            <h2>{t('legal.privacy.s3Title')}</h2>
            <ul>
              <li>{t('legal.privacy.s3i1')}</li>
              <li>{t('legal.privacy.s3i2')}</li>
              <li>{t('legal.privacy.s3i3')}</li>
              <li>{t('legal.privacy.s3i4')}</li>
              <li>{t('legal.privacy.s3i5')}</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>{t('legal.privacy.s4Title')}</h2>
            <p>{t('legal.privacy.s4Body')}</p>
            <ul>
              <li dangerouslySetInnerHTML={{ __html: t('legal.privacy.s4i1') }} />
              <li dangerouslySetInnerHTML={{ __html: t('legal.privacy.s4i2') }} />
              <li dangerouslySetInnerHTML={{ __html: t('legal.privacy.s4i3') }} />
              <li dangerouslySetInnerHTML={{ __html: t('legal.privacy.s4i4') }} />
            </ul>
            <p>{t('legal.privacy.s4Footer')}</p>
          </div>

          <div className="legal-section">
            <h2>{t('legal.privacy.s5Title')}</h2>
            <ul>
              <li>{t('legal.privacy.s5i1')}</li>
              <li>{t('legal.privacy.s5i2')}</li>
              <li>{t('legal.privacy.s5i3')}</li>
              <li>{t('legal.privacy.s5i4')}</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>{t('legal.privacy.s6Title')}</h2>
            <p>{t('legal.privacy.s6Body')}</p>
          </div>

          <div className="legal-section">
            <h2>{t('legal.privacy.s7Title')}</h2>
            <p>{t('legal.privacy.s7Intro')}</p>
            <ul>
              <li>{t('legal.privacy.s7i1')}</li>
              <li>{t('legal.privacy.s7i2')}</li>
              <li>{t('legal.privacy.s7i3')}</li>
              <li>{t('legal.privacy.s7i4')}</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>{t('legal.privacy.s8Title')}</h2>
            <ul>
              <li dangerouslySetInnerHTML={{ __html: t('legal.privacy.s8i1') }} />
              <li dangerouslySetInnerHTML={{ __html: t('legal.privacy.s8i2') }} />
              <li dangerouslySetInnerHTML={{ __html: t('legal.privacy.s8i3') }} />
            </ul>
          </div>

          <div className="legal-section">
            <h2>{t('legal.privacy.s9Title')}</h2>
            <p>{t('legal.privacy.s9Body')}</p>
          </div>

          <div className="legal-section">
            <h2>{t('legal.privacy.s10Title')}</h2>
            <p>{t('legal.privacy.s10Body')}</p>
          </div>

          <div className="legal-section">
            <h2>{t('legal.privacy.s11Title')}</h2>
            <p>
              {t('legal.privacy.s11Body')}<br />
              <a href="mailto:felipedelgado2006@gmail.com">felipedelgado2006@gmail.com</a><br />
              <a href="https://area862system.com" target="_blank" rel="noopener noreferrer">area862system.com</a>
            </p>
          </div>
        </div>

        <p className="legal-footer">{t('legal.lastUpdated')}</p>
      </main>
    </div>
  )
}
