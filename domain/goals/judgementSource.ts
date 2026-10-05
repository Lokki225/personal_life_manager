import type { SourceAnswer, Subject } from './engine'

// The JUDGEMENT source (mechanism §3): the person's own verdict on a
// condition that cannot be measured, for one subject. The latest judgement
// counts: MET is 1, GAP is 0, UNKNOWN (or none yet) is not known. A judgement
// older than 90 days is due for review.

export type Judgement = {
  conditionId: string
  subjectType: Subject['type']
  subjectId: string | null
  result: 'MET' | 'GAP' | 'UNKNOWN'
  judgedAt: Date
}

export const JUDGEMENT_STALE_DAYS = 90

const sameSubject = (judgement: Judgement, subject: Subject) =>
  judgement.subjectType === subject.type && (subject.type === 'SELF' ? judgement.subjectId === null : judgement.subjectId === subject.id)

export function latestJudgement(judgements: Judgement[], conditionId: string, subject: Subject): Judgement | null {
  return (
    judgements
      .filter((j) => j.conditionId === conditionId && sameSubject(j, subject))
      .sort((a, b) => b.judgedAt.getTime() - a.judgedAt.getTime())[0] ?? null
  )
}

export function judgementAnswer(judgements: Judgement[], conditionId: string, subject: Subject): SourceAnswer {
  const latest = latestJudgement(judgements, conditionId, subject)
  const known = latest !== null && latest.result !== 'UNKNOWN'
  return {
    points: known ? [{ at: latest.judgedAt, value: latest.result === 'MET' ? 1 : 0 }] : [],
    emptyMeans: 'unknown',
    asOf: latest?.judgedAt ?? null,
    staleAfterDays: JUDGEMENT_STALE_DAYS,
  }
}
