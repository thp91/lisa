import { useEffect, useMemo, useState } from 'react'
import { MODULES, QUESTION_BY_ID, questionsOf } from './questions.js'
import { load, save, recordSession } from './storage.js'

const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const pct = (s, t) => (t ? Math.round((s / t) * 100) : 0)

const starsFor = (p) => (p >= 90 ? 3 : p >= 70 ? 2 : p >= 50 ? 1 : 0)

const formatDate = (iso) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

const moduleById = Object.fromEntries(MODULES.map((m) => [m.id, m]))

function Stars({ n, size = 'md' }) {
  return (
    <span className={`stars stars-${size}`} aria-label={`${n} étoile${n > 1 ? 's' : ''} sur 3`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? 'star on' : 'star'}>★</span>
      ))}
    </span>
  )
}

export default function App() {
  const [data, setData] = useState(load)
  const [view, setView] = useState({ name: 'home' })

  useEffect(() => {
    save(data)
  }, [data])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [view.name])

  const start = (moduleId, mode = 'full') => {
    const qs = questionsOf(moduleId)
    const ids = mode === 'errors' ? qs.filter((q) => data.toReview[q.id]).map((q) => q.id) : qs.map((q) => q.id)
    if (!ids.length) return
    setView({ name: 'quiz', moduleId, mode, ids, key: Date.now() })
  }

  const finish = (session) => {
    setData((d) => recordSession(d, session))
    setView({ name: 'results', session })
  }

  const resetAll = () => {
    if (window.confirm("Effacer tout l'historique et toutes les erreurs enregistrées ?")) {
      setData({ sessions: [], toReview: {} })
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setView({ name: 'home' })}>
          <span className="brand-mark">P</span>
          <span className="brand-text">
            <strong>Révision oral</strong>
            <small>Le label Palace</small>
          </span>
        </button>
        <nav className="topnav">
          <button className={view.name === 'home' ? 'active' : ''} onClick={() => setView({ name: 'home' })}>
            Modules
          </button>
          <button className={view.name === 'history' ? 'active' : ''} onClick={() => setView({ name: 'history' })}>
            Historique
            {Object.keys(data.toReview).length > 0 && (
              <span className="badge">{Object.keys(data.toReview).length}</span>
            )}
          </button>
        </nav>
      </header>

      <main className="container">
        {view.name === 'home' && <Home data={data} onStart={start} />}
        {view.name === 'quiz' && (
          <Quiz
            key={view.key}
            module={moduleById[view.moduleId]}
            mode={view.mode}
            ids={view.ids}
            onFinish={finish}
            onQuit={(session) => {
              if (session) setData((d) => recordSession(d, session))
              setView({ name: 'home' })
            }}
          />
        )}
        {view.name === 'results' && (
          <Results
            session={view.session}
            data={data}
            onRestart={() => start(view.session.moduleId, 'full')}
            onErrors={() => start(view.session.moduleId, 'errors')}
            onNext={(id) => start(id, 'full')}
            onHome={() => setView({ name: 'home' })}
          />
        )}
        {view.name === 'history' && <History data={data} onStart={start} onReset={resetAll} />}
      </main>
    </div>
  )
}

/* ---------------------------------- Accueil --------------------------------- */

function moduleStats(data, moduleId) {
  const full = data.sessions.filter((s) => s.moduleId === moduleId && s.mode === 'full' && !s.partial)
  const best = full.reduce((b, s) => Math.max(b, pct(s.score, s.total)), 0)
  const errors = questionsOf(moduleId).filter((q) => data.toReview[q.id]).length
  return { attempts: full.length, best, errors, last: full[0] }
}

function Home({ data, onStart }) {
  const totalStars = MODULES.reduce((n, m) => n + starsFor(moduleStats(data, m.id).best), 0)
  const mastered = MODULES.filter((m) => moduleStats(data, m.id).best === 100).length

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Soutenance · CMH 2025-2026</p>
        <h1>Le label Palace : un actif immatériel à piloter</h1>
        <p className="lead">
          Révise ton oral module par module, dans l'ordre des slides. Vise les 3 étoiles partout, puis
          retravaille tes erreurs jusqu'à ce que la liste soit vide.
        </p>
        <div className="hero-stats">
          <div>
            <strong>{totalStars}<span>/{MODULES.length * 3}</span></strong>
            <small>étoiles</small>
          </div>
          <div>
            <strong>{mastered}<span>/{MODULES.length}</span></strong>
            <small>clés d'or</small>
          </div>
          <div>
            <strong>{Object.keys(data.toReview).length}</strong>
            <small>à retravailler</small>
          </div>
        </div>
      </section>

      <section className="modules">
        {MODULES.map((m) => {
          const st = moduleStats(data, m.id)
          return (
            <article key={m.id} className={`module-card ${st.best === 100 ? 'mastered' : ''}`}>
              <div className="module-head">
                <span className="module-icon" aria-hidden>{m.icon}</span>
                <div>
                  <p className="module-num">Module {m.num} · {m.slides}</p>
                  <h2>{m.title}</h2>
                </div>
              </div>
              <p className="module-desc">{m.desc}</p>
              <div className="module-meta">
                <Stars n={starsFor(st.best)} />
                <span>{m.questions.length} questions</span>
                {st.attempts > 0 && <span>Meilleur : {st.best} %</span>}
                {st.best === 100 && <span className="gold-key" title="Clé d'or : 100 %">🔑 Clé d'or</span>}
              </div>
              <div className="progress thin" aria-hidden>
                <span style={{ width: `${st.best}%` }} />
              </div>
              <div className="module-actions">
                <button className="btn primary" onClick={() => onStart(m.id, 'full')}>
                  {st.attempts ? 'Recommencer' : 'Commencer'}
                </button>
                {st.errors > 0 && (
                  <button className="btn ghost" onClick={() => onStart(m.id, 'errors')}>
                    Revoir mes erreurs ({st.errors})
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </section>
    </>
  )
}

/* ----------------------------------- Quiz ----------------------------------- */

function Quiz({ module, mode, ids, onFinish, onQuit }) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null)
  const [answers, setAnswers] = useState([])
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)

  const question = QUESTION_BY_ID[ids[index]]
  const options = useMemo(() => shuffle([question.a, ...question.w]), [question])
  const isLast = index === ids.length - 1
  const score = answers.filter((a) => a.correct).length

  const choose = (opt) => {
    if (picked !== null) return
    const correct = opt === question.a
    setPicked(opt)
    setAnswers((prev) => [...prev, { qid: question.id, chosen: opt, correct }])
    const s = correct ? streak + 1 : 0
    setStreak(s)
    setBestStreak((b) => Math.max(b, s))
  }

  const buildSession = (partial) => ({
    id: Date.now(),
    date: new Date().toISOString(),
    moduleId: module.id,
    mode,
    score,
    total: partial ? answers.length : ids.length,
    bestStreak,
    answers,
    partial,
  })

  const quit = () => onQuit(answers.length ? buildSession(true) : null)

  const next = () => {
    if (picked === null) return
    if (isLast) {
      onFinish(buildSession(false))
      return
    }
    setIndex((i) => i + 1)
    setPicked(null)
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= options.length) choose(options[n - 1])
      if (e.key === 'Enter' && picked !== null) next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const wasCorrect = picked === question.a

  return (
    <section className="quiz">
      <div className="quiz-top">
        <button className="link" onClick={quit}>← Quitter</button>
        <span className="quiz-module">
          {module.icon} Module {module.num} · {mode === 'errors' ? 'Révision des erreurs' : module.title}
        </span>
      </div>

      <div className="quiz-status">
        <span>Question {index + 1} / {ids.length}</span>
        <span className={`streak ${streak >= 3 ? 'hot' : ''}`}>
          {streak >= 3 ? '🔥' : '✨'} Série : {streak}
        </span>
        <span>Score : {score}</span>
      </div>
      <div className="progress" aria-hidden>
        <span style={{ width: `${((index + (picked !== null ? 1 : 0)) / ids.length) * 100}%` }} />
      </div>

      <article className="card question-card">
        <p className="ref">{question.ref}</p>
        <h2 className="question">{question.q}</h2>

        <div className="options">
          {options.map((opt, i) => {
            let cls = 'option'
            if (picked !== null) {
              if (opt === question.a) cls += ' correct'
              else if (opt === picked) cls += ' wrong'
              else cls += ' dim'
            }
            return (
              <button key={opt} className={cls} onClick={() => choose(opt)} disabled={picked !== null}>
                <span className="key">{String.fromCharCode(65 + i)}</span>
                <span className="opt-text">{opt}</span>
              </button>
            )
          })}
        </div>

        {picked !== null && (
          <div className={`feedback ${wasCorrect ? 'ok' : 'ko'}`} role="status">
            <strong>{wasCorrect ? 'Bonne réponse !' : 'Pas tout à fait.'}</strong>
            {!wasCorrect && (
              <p className="answer-line">Réponse attendue : <b>{question.a}</b></p>
            )}
            <p>{question.explain}</p>
          </div>
        )}
      </article>

      <div className="quiz-footer">
        <span className="hint">Astuce clavier : 1-4 pour répondre, Entrée pour continuer</span>
        <button className="btn primary" onClick={next} disabled={picked === null}>
          {isLast ? 'Voir le résultat' : 'Question suivante →'}
        </button>
      </div>
    </section>
  )
}

/* --------------------------------- Résultats -------------------------------- */

const verdict = (p) =>
  p === 100
    ? 'Parfait ! Clé d\'or obtenue 🔑'
    : p >= 90
      ? 'Excellent, tu es prête pour ce module.'
      : p >= 70
        ? 'Très bien, encore quelques points à fixer.'
        : p >= 50
          ? 'Bonne base, revois tes erreurs puis recommence.'
          : 'Relis ces slides à voix haute, puis retente.'

function Results({ session, data, onRestart, onErrors, onNext, onHome }) {
  const m = moduleById[session.moduleId]
  const p = pct(session.score, session.total)
  const wrong = session.answers.filter((a) => !a.correct)
  const remaining = questionsOf(m.id).filter((q) => data.toReview[q.id]).length
  const nextModule = MODULES[MODULES.findIndex((x) => x.id === m.id) + 1]

  return (
    <section className="results">
      <div className={`card results-card ${p === 100 ? 'perfect' : ''}`}>
        <p className="eyebrow">{m.icon} Module {m.num} · {session.mode === 'errors' ? 'Révision des erreurs' : m.title}</p>
        <div className="score-ring" style={{ '--p': p }}>
          <div>
            <strong>{p}%</strong>
            <small>{session.score} / {session.total}</small>
          </div>
        </div>
        <Stars n={starsFor(p)} size="lg" />
        <p className="verdict">{verdict(p)}</p>
        <p className="muted">Meilleure série : {session.bestStreak} bonne{session.bestStreak > 1 ? 's' : ''} réponse{session.bestStreak > 1 ? 's' : ''} d'affilée</p>

        <div className="results-actions">
          <button className="btn primary" onClick={onRestart}>Recommencer le module</button>
          {remaining > 0 && (
            <button className="btn ghost" onClick={onErrors}>Revoir mes erreurs ({remaining})</button>
          )}
          {nextModule && p >= 70 && (
            <button className="btn ghost" onClick={() => onNext(nextModule.id)}>
              Module suivant →
            </button>
          )}
          <button className="btn link" onClick={onHome}>Retour aux modules</button>
        </div>
      </div>

      {wrong.length > 0 && (
        <div className="review">
          <h3>Tes erreurs de cette session</h3>
          {wrong.map((a) => (
            <MistakeItem key={a.qid} q={QUESTION_BY_ID[a.qid]} chosen={a.chosen} />
          ))}
        </div>
      )}
    </section>
  )
}

function MistakeItem({ q, chosen, count }) {
  if (!q) return null
  return (
    <article className="mistake">
      <p className="ref">
        {q.ref}
        {count > 1 && <span className="count">raté {count} fois</span>}
      </p>
      <p className="mistake-q">{q.q}</p>
      {chosen && <p className="mistake-wrong">✗ {chosen}</p>}
      <p className="mistake-right">✓ {q.a}</p>
      <p className="mistake-explain">{q.explain}</p>
    </article>
  )
}

/* --------------------------------- Historique ------------------------------- */

function History({ data, onStart, onReset }) {
  const [tab, setTab] = useState('review')
  const [open, setOpen] = useState(null)
  const reviewByModule = MODULES.map((m) => ({
    m,
    items: questionsOf(m.id).filter((q) => data.toReview[q.id]),
  })).filter((g) => g.items.length)

  return (
    <section className="history">
      <div className="history-head">
        <h1>Historique</h1>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'review'} className={tab === 'review' ? 'active' : ''} onClick={() => setTab('review')}>
            À retravailler ({Object.keys(data.toReview).length})
          </button>
          <button role="tab" aria-selected={tab === 'sessions'} className={tab === 'sessions' ? 'active' : ''} onClick={() => setTab('sessions')}>
            Sessions ({data.sessions.length})
          </button>
        </div>
      </div>

      {tab === 'review' && (
        <>
          {reviewByModule.length === 0 && (
            <div className="card empty">
              <p>🎉 Aucune question à retravailler.</p>
              <p className="muted">Chaque erreur apparaît ici, et disparaît dès que tu y réponds juste.</p>
            </div>
          )}
          {reviewByModule.map(({ m, items }) => (
            <div key={m.id} className="review-group">
              <div className="review-group-head">
                <h3>{m.icon} Module {m.num} · {m.title}</h3>
                <button className="btn primary small" onClick={() => onStart(m.id, 'errors')}>
                  Revoir ces {items.length} question{items.length > 1 ? 's' : ''}
                </button>
              </div>
              {items.map((q) => (
                <MistakeItem key={q.id} q={q} count={data.toReview[q.id]} />
              ))}
            </div>
          ))}
        </>
      )}

      {tab === 'sessions' && (
        <>
          {data.sessions.length === 0 && (
            <div className="card empty">
              <p>Pas encore de session.</p>
              <p className="muted">Lance un module pour commencer ton historique.</p>
            </div>
          )}
          <ul className="sessions">
            {data.sessions.map((s) => {
              const m = moduleById[s.moduleId]
              const p = pct(s.score, s.total)
              const isOpen = open === s.id
              return (
                <li key={s.id} className="session">
                  <button className="session-row" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}>
                    <span className="session-icon">{m?.icon}</span>
                    <span className="session-main">
                      <strong>Module {m?.num} · {m?.title}</strong>
                      <small>{formatDate(s.date)} · {s.mode === 'errors' ? 'Révision des erreurs' : 'Module complet'}
                        {s.partial && ' · interrompue'}</small>
                    </span>
                    <span className="session-score">
                      <Stars n={starsFor(p)} size="sm" />
                      <b>{s.score}/{s.total}</b>
                    </span>
                    <span className={`chev ${isOpen ? 'open' : ''}`}>›</span>
                  </button>
                  {isOpen && (
                    <div className="session-detail">
                      {s.answers.map((a, i) => {
                        const q = QUESTION_BY_ID[a.qid]
                        if (!q) return null
                        return (
                          <div key={i} className={`answer-row ${a.correct ? 'ok' : 'ko'}`}>
                            <span className="mark">{a.correct ? '✓' : '✗'}</span>
                            <div>
                              <p>{q.q}</p>
                              {!a.correct && (
                                <p className="small">
                                  <span className="mistake-wrong">Ta réponse : {a.chosen}</span>
                                  <br />
                                  <span className="mistake-right">Attendu : {q.a}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      <button className="btn ghost small" onClick={() => onStart(s.moduleId, 'full')}>
                        Recommencer ce module
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          {data.sessions.length > 0 && (
            <button className="btn danger small reset" onClick={onReset}>Réinitialiser tout l'historique</button>
          )}
        </>
      )}
    </section>
  )
}
