const KEY = 'oral-palace-v1'

const empty = () => ({ sessions: [], toReview: {} })

export function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const data = JSON.parse(raw)
    return { ...empty(), ...data }
  } catch {
    return empty()
  }
}

export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // Stockage indisponible (navigation privée…) : l'app fonctionne quand même.
  }
}

// Enregistre une session terminée et met à jour la liste des questions à retravailler :
// une erreur l'ajoute, une bonne réponse l'enlève.
export function recordSession(data, session) {
  const toReview = { ...data.toReview }
  for (const a of session.answers) {
    if (a.correct) delete toReview[a.qid]
    else toReview[a.qid] = (toReview[a.qid] || 0) + 1
  }
  return { sessions: [session, ...data.sessions].slice(0, 200), toReview }
}
