import { useState } from 'react'
import { useTranslation } from '../i18n'

const STORAGE_KEY = 'tm_onboarding_dismissed'

export function Onboarding() {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  if (dismissed) return null

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch { /* ignore */ }
    setDismissed(true)
  }

  return (
    <div className="fixed inset-0 bg-[rgba(20,20,19,0.5)] flex items-center justify-center z-50">
      <div className="bg-white border border-[#f0eee6] rounded-2xl w-full max-w-lg p-6 shadow-[rgba(0,0,0,0.08)_0px_8px_32px]">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#f5f4ed] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 512 512" fill="none">
              <circle cx="256" cy="256" r="160" stroke="#c96442" strokeWidth="40"/>
              <line x1="256" y1="256" x2="256" y2="160" stroke="#c96442" strokeWidth="40" strokeLinecap="round"/>
              <line x1="256" y1="256" x2="336" y2="256" stroke="#c96442" strokeWidth="40" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-medium text-[#141413]">{t('welcome')}</h2>
            <p className="text-sm text-[#87867f]">{t('timeFirstProjectManagement')}</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <Step
            number={1}
            title={t('step1Title')}
            description={t('step1Desc')}
          />
          <Step
            number={2}
            title={t('step2Title')}
            description={t('step2Desc')}
          />
          <Step
            number={3}
            title={t('step3Title')}
            description={t('step3Desc')}
          />
          <Step
            number={4}
            title={t('step4Title')}
            description={t('step4Desc')}
          />
          <Step
            number={5}
            title={t('step5Title')}
            description={t('step5Desc')}
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-[#f0eee6]">
          <p className="text-xs text-[#b0aea5]">
            {t('onboardingTip')}
          </p>
          <button
            onClick={handleDismiss}
            className="px-5 py-2 text-sm bg-[#c96442] text-[#faf9f5] rounded-lg hover:bg-[#d97757] transition-colors font-medium"
          >
            {t('getStarted')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full bg-[#f5f4ed] flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-xs font-medium text-[#c96442]">{number}</span>
      </div>
      <div>
        <h3 className="text-sm font-medium text-[#141413]">{title}</h3>
        <p className="text-sm text-[#87867f] leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
