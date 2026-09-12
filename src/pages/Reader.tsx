import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getMaterialIndex,
  getMaterialLecture,
  materialImageUrl,
  type MaterialIndex,
  type MaterialLecture,
} from '../lib/api'
import { t } from '../i18n'

/**
 * The study materials read as a textbook: the slide on top, the explanation
 * written under it, the terms as a glossary and the questions at the end of the
 * lecture.
 *
 * The material never enters the sync snapshot — it is the same on every device
 * and 55 MB of slide renders would not fit in it — so this screen fetches one
 * lecture at a time from the server. Reading position is a per-device
 * convenience and lives in localStorage; nothing here is study state.
 */

const POS_KEY = 'studyflow-reader-pos'
const CORE_KEY = 'studyflow-reader-core'

type Positions = Record<string, number>

function readPositions(): Positions {
  try {
    const raw = localStorage.getItem(POS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Positions = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

function writePositions(positions: Positions): void {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(positions))
  } catch {
    /* private mode / quota — reading still works, only the bookmark is lost */
  }
}

export function Reader({ onBack }: { onBack: () => void }) {
  const [index, setIndex] = useState<MaterialIndex | null>(null)
  const [lecture, setLecture] = useState<MaterialLecture | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [positions, setPositions] = useState<Positions>(() => readPositions())
  const [coreOnly, setCoreOnly] = useState(() => {
    try {
      return localStorage.getItem(CORE_KEY) === '1'
    } catch {
      return false
    }
  })
  const slideRefs = useRef(new Map<number, HTMLElement>())

  useEffect(() => {
    let alive = true
    getMaterialIndex()
      .then((data) => {
        if (alive) setIndex(data)
      })
      .catch(() => {
        if (alive) setError(t('readerEmpty'))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const openLecture = useCallback((id: string) => {
    setOpenId(id)
    setLecture(null)
    setError(null)
    setLoading(true)
    getMaterialLecture(id)
      .then(setLecture)
      .catch(() => setError(t('readerError')))
      .finally(() => setLoading(false))
  }, [])

  // Remember the slide the reader is looking at, so the lecture can be resumed.
  useEffect(() => {
    if (!lecture || typeof IntersectionObserver === 'undefined') return
    const lectureId = lecture.lecture_id
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const n = Number(entry.target.getAttribute('data-n'))
          if (!Number.isFinite(n)) continue
          setPositions((prev) => {
            if (prev[lectureId] === n) return prev
            const next = { ...prev, [lectureId]: n }
            writePositions(next)
            return next
          })
        }
      },
      { rootMargin: '-40% 0px -55% 0px' },
    )
    for (const el of slideRefs.current.values()) observer.observe(el)
    return () => observer.disconnect()
  }, [lecture])

  const questions = useMemo(() => {
    if (!lecture) return []
    return lecture.slides.flatMap((slide) =>
      (slide.cards ?? [])
        .filter((card) => !coreOnly || card.priority !== 'extra')
        .map((card) => ({ card, from: slide.n })),
    )
  }, [lecture, coreOnly])

  function toggleCore(next: boolean) {
    setCoreOnly(next)
    try {
      localStorage.setItem(CORE_KEY, next ? '1' : '0')
    } catch {
      /* the filter simply does not persist */
    }
  }

  function jumpTo(n: number) {
    slideRefs.current.get(n)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ---- one lecture ----
  if (openId && lecture) {
    const resumeAt = positions[lecture.lecture_id]
    return (
      <div className="page reader">
        <div className="page-nav">
          <button
            className="btn btn-ghost btn-small"
            onClick={() => {
              setOpenId(null)
              setLecture(null)
              slideRefs.current.clear()
            }}
          >
            {t('back')}
          </button>
        </div>

        <header className="reader-head">
          <span className="reader-eyebrow">
            {lecture.course_title} · {lecture.unit}
          </span>
          <h2 className="page-title">{lecture.title}</h2>
          {resumeAt !== undefined && resumeAt > 1 && (
            <button className="btn btn-ghost btn-small" onClick={() => jumpTo(resumeAt)}>
              {t('readerContinue', resumeAt)}
            </button>
          )}
        </header>

        {lecture.slides.map((slide) => (
          <article
            key={slide.n}
            className="reader-slide"
            data-n={slide.n}
            ref={(el) => {
              if (el) slideRefs.current.set(slide.n, el)
              else slideRefs.current.delete(slide.n)
            }}
          >
            <span className="reader-num">{slide.n}</span>
            <figure className="reader-figure">
              <img
                src={materialImageUrl(slide.img)}
                alt={t('readerSlideAlt', slide.title, slide.n)}
                loading="lazy"
                decoding="async"
                width={slide.w}
                height={slide.h}
              />
            </figure>
            {slide.title && <h3 className="reader-slide-title">{slide.title}</h3>}
            {slide.text && <p className="reader-text">{slide.text}</p>}
            {slide.note && <p className="reader-note">{slide.note}</p>}
            {slide.terms && slide.terms.length > 0 && (
              <details className="reader-terms">
                <summary>{t('readerTerms', slide.terms.length)}</summary>
                <dl>
                  {slide.terms.map((term) => (
                    <div key={term.term}>
                      <dt>{term.term}</dt>
                      <dd>{term.def}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
          </article>
        ))}

        {questions.length > 0 && (
          <section className="reader-questions">
            <h3>
              {t('readerQuestions', questions.length)}
              <label className="reader-filter">
                <input
                  type="checkbox"
                  checked={coreOnly}
                  onChange={(e) => toggleCore(e.target.checked)}
                />
                {t('readerCoreOnly')}
              </label>
            </h3>
            {questions.map(({ card, from }, i) => (
              <details key={`${from}-${i}`} className="reader-card">
                <summary>
                  <span className={`reader-lvl lvl-${card.difficulty}`}>{card.difficulty}</span>
                  <span className="reader-q">{card.q}</span>
                </summary>
                <p className="reader-a">{card.a}</p>
              </details>
            ))}
          </section>
        )}
      </div>
    )
  }

  // ---- the list of lectures ----
  return (
    <div className="page reader">
      <div className="page-nav">
        <button className="btn btn-ghost btn-small" onClick={onBack}>
          {t('back')}
        </button>
      </div>
      <h2 className="page-title">{t('readerTitle')}</h2>
      <p className="muted">{t('readerLead')}</p>

      {loading && <p className="muted">{t('loading')}</p>}
      {error && !loading && <p className="muted">{error}</p>}

      {index?.courses.map((course) => (
        <section key={course.code} className="reader-course">
          <h3>
            {course.title}
            <span className="muted"> · {t('readerLectures', course.lectures.length)}</span>
          </h3>
          <div className="reader-list">
            {course.lectures.map((lec) => {
              const at = positions[lec.id]
              return (
                <button key={lec.id} className="reader-row" onClick={() => openLecture(lec.id)}>
                  <span className="reader-row-id">{lec.id}</span>
                  <span className="reader-row-main">
                    <span className="reader-row-title">{lec.title}</span>
                    <span className="muted">
                      {t('readerSlideCount', lec.slides)} · {t('readerCardCount', lec.cards)}
                      {at !== undefined && ` · ${t('readerRead', at, lec.slides)}`}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
