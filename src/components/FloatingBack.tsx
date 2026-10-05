import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../i18n'

/** How long the button stays after the last scroll or touch. */
const IDLE_MS = 3500
/** Near the top the page's own back button is in view — no need for a second. */
const SHOW_BELOW_PX = 160

/**
 * A back button that comes up whenever the screen moves. A lecture is a long
 * scroll of slides, and the page's own back button is left behind at the top —
 * so the way out appears with any scroll or touch, in thumb reach, and steps
 * aside again once the reader settles on a slide.
 *
 * Rendered into <body>: a transformed ancestor would otherwise pin a
 * position:fixed child to itself and scroll it away with the page.
 */
export function FloatingBack({ onBack }: { onBack: () => void }) {
  const [shown, setShown] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    const wake = () => {
      if (window.scrollY < SHOW_BELOW_PX) {
        setShown(false)
        return
      }
      setShown(true)
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setShown(false), IDLE_MS)
    }
    window.addEventListener('scroll', wake, { passive: true })
    window.addEventListener('touchstart', wake, { passive: true })
    window.addEventListener('pointermove', wake, { passive: true })
    return () => {
      window.removeEventListener('scroll', wake)
      window.removeEventListener('touchstart', wake)
      window.removeEventListener('pointermove', wake)
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  return createPortal(
    <button
      type="button"
      className={`floating-back${shown ? ' floating-back-shown' : ''}`}
      onClick={onBack}
      // Hidden, it must not catch a tap meant for the slide underneath — but a
      // keyboard user tabbing to it still gets it.
      onFocus={() => setShown(true)}
      onBlur={() => setShown(false)}
    >
      {t('back')}
    </button>,
    document.body,
  )
}
