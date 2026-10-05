import { z } from 'zod'

import { LEVELS, NUMBER_DIMENSIONS, CHOICE_DIMENSIONS, type Criterion } from '../../domain/career/criteria'
import { OPPORTUNITY_KINDS, OPPORTUNITY_STATUSES, OUTCOMES } from '../../domain/career/opportunities'
import { CONTRACT_TYPES, FACT_KINDS, WORK_ARRANGEMENTS, type FactInput } from '../../domain/career/situation'
import { startOfDay } from '../../domain/career/week'
import { now } from '../../lib/clock'
import { addCriterion, createCareerGoal, judge, listCareerGoals } from '../career/goals'
import { writeLog } from '../career/log'
import { getRunway } from '../career/money'
import { addOpportunity, listOpportunities, moveOpportunity } from '../career/opportunities'
import { addEvidence, addFact, endFact, getSituation } from '../career/situation'
import { addFocus, getWeek, setFocusDone } from '../career/week'
import { dayField, idField, localTime, noInput, operation, text, type ApiUser } from './operation'

// What a program or the assistant can do in Career (spec §13): read the
// situation, goals, opportunities and week; record facts, evidence, goals and
// criteria, judgements, opportunities and their steps, focus items and log
// lines. "I passed AWS SAA today" becomes a fact and a log line.

const toDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const optionalText = (name: string, max: number) => z.string().trim().max(max, `Keep "${name}" under ${max} characters.`).optional()
const pay = z.number({ error: 'Give the pay as a number.' }).min(0).max(999_999_999_999).optional()

const terms = {
  monthlyPay: pay,
  workArrangement: z.enum(WORK_ARRANGEMENTS, { error: `Use ${WORK_ARRANGEMENTS.join(', ')}.` }).optional(),
  contractType: z.enum(CONTRACT_TYPES, { error: `Use ${CONTRACT_TYPES.join(', ')}.` }).optional(),
  weeklyHours: z.number().int().min(0).max(168).optional(),
  place: optionalText('place', 60),
}

async function situation(user: ApiUser) {
  const s = await getSituation(user.id, now())
  return {
    mainPosition: s.primary ? { id: s.primary.fact.id, title: s.primary.fact.title, chosen: s.primary.chosen } : null,
    facts: FACT_KINDS.flatMap((kind) =>
      s.byKind[kind].map((f) => ({
        id: f.id,
        kind: f.kind,
        title: f.title,
        since: localTime(f.validFrom),
        // SELF (said), DOCUMENTED (evidence linked) or CONFIRMED.
        source: f.source,
        reviewDue: f.reviewDue,
        organisation: f.organisation,
        monthlyPay: f.income ? Math.round(f.income.perMonth) : f.monthlyCompensation,
        payFromIncome: f.income?.source ?? null,
        workArrangement: f.workArrangement,
        contractType: f.contractType,
        weeklyHours: f.weeklyHours,
        place: f.location,
        level: f.level,
        issuer: f.issuer,
        evidence: f.evidenceIds.length,
      })),
    ),
    places: s.locations,
  }
}

async function goals(user: ApiUser) {
  return (await listCareerGoals(user.id, now())).map((goal) => ({
    id: goal.id,
    name: goal.name,
    // CRITERIA_MET means every required criterion holds and the person may mark it achieved.
    status: goal.evaluation.status,
    deadline: localTime(goal.deadline),
    // Counts per level, never a percentage.
    summary: goal.evaluation.summary,
    criteria: goal.evaluation.results.map((r) => ({
      id: r.condition.id,
      level: r.condition.level ?? 'REQUIRED',
      source: r.condition.source,
      label: r.condition.label ?? null,
      // MET, EXCEEDS, GAP or UNKNOWN.
      result: r.result,
      value: r.value,
      reviewDue: r.reviewDue,
    })),
  }))
}

async function opportunities(user: ApiUser) {
  return (await listOpportunities(user.id)).map((o) => ({
    id: o.id,
    title: o.title,
    organisation: o.organisation,
    kind: o.kind,
    status: o.status,
    outcome: o.outcome,
    deadline: localTime(o.deadline),
    monthlyPay: o.monthlyCompensation,
    workArrangement: o.workArrangement,
    contractType: o.contractType,
    weeklyHours: o.weeklyHours,
    place: o.location,
    goals: o.goals.map((g) => ({ id: g.goalId, name: g.goal.name })),
  }))
}

async function week(user: ApiUser) {
  const [w, runway] = await Promise.all([getWeek(user.id, now()), getRunway(user.id, now())])
  return {
    weekOf: localTime(w.start),
    focus: w.focus.map((f) => ({ id: f.id, title: f.title, done: f.status === 'DONE' })),
    leftFromEarlierWeeks: w.leftOver.map((f) => ({ id: f.id, title: f.title })),
    log: w.log.map((e) => ({ id: e.id, date: localTime(e.entryDate), title: e.title, text: e.body })),
    deadlines: w.deadlines.map((d) => ({ kind: d.kind, id: d.id, title: d.title, date: localTime(d.date) })),
    // A calculation: months the money at hand covers the plan without its savings.
    runway: runway.hasPlan ? { months: runway.months, available: runway.available, monthlyNeed: runway.monthlyNeed } : null,
  }
}

const factInput = (input: {
  kind: FactInput['kind']
  title: string
  since?: string
  details?: string
  organisation?: string
  issuer?: string
  level?: string
} & { [K in keyof typeof terms]?: z.output<(typeof terms)[K]> }): FactInput => ({
  kind: input.kind,
  title: input.title,
  details: input.details || null,
  validFrom: input.since ? toDay(input.since) : startOfDay(now()),
  validTo: null,
  organisation: input.organisation || null,
  monthlyCompensation: input.monthlyPay ?? null,
  workArrangement: input.workArrangement ?? null,
  contractType: input.contractType ?? null,
  weeklyHours: input.weeklyHours ?? null,
  location: input.place || null,
  issuer: input.issuer || null,
  obtainedAt: null,
  expiresAt: null,
  level: input.level || null,
  positionId: null,
})

const criterionInput = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('number'),
    level: z.enum(LEVELS).default('REQUIRED'),
    dimension: z.enum(NUMBER_DIMENSIONS),
    operator: z.enum(['GTE', 'LTE', 'EQ']),
    target: z.number().min(0),
  }),
  z.object({ kind: z.literal('choice'), level: z.enum(LEVELS).default('REQUIRED'), dimension: z.enum(CHOICE_DIMENSIONS), accepted: z.array(z.string()).min(1).max(30) }),
  z.object({ kind: z.literal('evidence'), level: z.enum(LEVELS).default('REQUIRED'), factKind: z.enum(FACT_KINDS), match: text('match', 120) }),
  z.object({ kind: z.literal('judgement'), level: z.enum(LEVELS).default('PREFERRED'), label: text('label', 160) }),
])

export const careerOperations = {
  getCareerSituation: operation({
    name: 'get_career_situation',
    method: 'GET',
    path: '/career/situation',
    needs: 'READ',
    does: 'Career situation: the facts true today (positions with their terms, qualifications, skills, experience), the main position, and the person’s places.',
    input: noInput,
    run: situation,
  }),

  getCareerGoals: operation({
    name: 'get_career_goals',
    method: 'GET',
    path: '/career/goals',
    needs: 'READ',
    does: 'Career goals: status, counts per level (never a percentage), and each criterion’s result against the current situation.',
    input: noInput,
    run: goals,
  }),

  getCareerOpportunities: operation({
    name: 'get_career_opportunities',
    method: 'GET',
    path: '/career/opportunities',
    needs: 'READ',
    does: 'Career opportunities: status in the pipeline, deadline, terms and the goals they are compared with.',
    input: noInput,
    run: opportunities,
  }),

  getCareerWeek: operation({
    name: 'get_career_week',
    method: 'GET',
    path: '/career/week',
    needs: 'READ',
    does: 'This Career week: focus items (at most 3), what is left from earlier weeks, the log, deadlines coming up and the runway.',
    input: noInput,
    run: week,
  }),

  addCareerFact: operation({
    name: 'add_career_fact',
    method: 'POST',
    path: '/career/facts',
    needs: 'WRITE',
    does: 'Records a Career fact true from "since" (today when left out): "kind" POSITION, QUALIFICATION, SKILL or EXPERIENCE and a "title", with the terms of a position, the "issuer" of a qualification or the "level" of a skill.',
    status: 201,
    input: z.object({
      kind: z.enum(FACT_KINDS, { error: `Use ${FACT_KINDS.join(', ')} for "kind".` }),
      title: text('title', 120),
      since: dayField.optional(),
      details: optionalText('details', 1000),
      organisation: optionalText('organisation', 120),
      issuer: optionalText('issuer', 120),
      level: optionalText('level', 60),
      ...terms,
    }),
    run: async (user, input) => {
      const fact = await addFact(user.id, factInput(input))
      return { id: fact.id }
    },
  }),

  endCareerFact: operation({
    name: 'end_career_fact',
    method: 'POST',
    path: '/career/facts/{id}/end',
    needs: 'WRITE',
    does: 'Says a Career fact is no longer true from "date" (today when left out). It is kept as history.',
    input: z.object({ id: idField, date: dayField.optional() }),
    run: async (user, { id, date }) => {
      await endFact(user.id, id, date ? toDay(date) : startOfDay(now()))
      return situation(user)
    },
  }),

  addCareerEvidence: operation({
    name: 'add_career_evidence',
    method: 'POST',
    path: '/career/evidence',
    needs: 'WRITE',
    does: 'Adds evidence (a "title", an optional web "url" and "description") for one or more facts ("factIds"), which makes them documented.',
    status: 201,
    input: z.object({
      title: text('title', 120),
      url: z.string().trim().max(2000).optional(),
      description: optionalText('description', 1000),
      factIds: z.array(idField).max(20).default([]),
    }),
    run: async (user, input) => {
      const evidence = await addEvidence(user.id, { title: input.title, url: input.url ?? null, description: input.description ?? null, factIds: input.factIds })
      return { id: evidence.id }
    },
  }),

  addCareerGoal: operation({
    name: 'add_career_goal',
    method: 'POST',
    path: '/career/goals',
    needs: 'WRITE',
    does: 'Creates a Career goal: what the person wants ("name"), optionally "why", a "deadline" and "importance" (LOW, MEDIUM, HIGH). Add its criteria next.',
    status: 201,
    input: z.object({
      name: text('name', 120),
      why: optionalText('why', 1000),
      deadline: dayField.optional(),
      importance: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    }),
    run: async (user, input) => {
      const goal = await createCareerGoal(user.id, { name: input.name, why: input.why ?? null, deadline: input.deadline ? toDay(input.deadline) : null, importance: input.importance ?? null })
      return { id: goal.id }
    },
  }),

  addCareerCriterion: operation({
    name: 'add_career_criterion',
    method: 'POST',
    path: '/career/goals/{id}/criteria',
    needs: 'WRITE',
    does: 'Adds a criterion to a Career goal, REQUIRED, PREFERRED or INFO: "kind" number (monthly_compensation or weekly_hours, GTE/LTE/EQ a "target"), choice (work_arrangement, contract_type or location, "accepted" values), evidence (a "factKind" and the fact title to "match") or judgement (a "label" the person judges).',
    status: 201,
    input: z.object({ id: idField, criterion: criterionInput }),
    run: async (user, { id, criterion }) => {
      await addCriterion(user.id, id, criterion as Criterion)
      return (await goals(user)).find((g) => g.id === id) ?? null
    },
  }),

  judgeCareerCriterion: operation({
    name: 'judge_career_criterion',
    method: 'POST',
    path: '/career/criteria/{id}/judgement',
    needs: 'WRITE',
    does: 'Records the person’s own verdict on a judgement criterion: "result" MET, GAP or UNKNOWN, an optional "note", about their situation or, with "opportunityId", about an opportunity.',
    input: z.object({ id: idField, result: z.enum(['MET', 'GAP', 'UNKNOWN']), note: optionalText('note', 280), opportunityId: idField.optional() }),
    run: async (user, { id, result, note, opportunityId }) => {
      await judge(user.id, id, result, note ?? null, now(), undefined, opportunityId ? { type: 'OPPORTUNITY', id: opportunityId } : undefined)
      return { ok: true }
    },
  }),

  addCareerOpportunity: operation({
    name: 'add_career_opportunity',
    method: 'POST',
    path: '/career/opportunities',
    needs: 'WRITE',
    does: 'Records an opportunity: "title", "organisation", "kind" (JOB, PROMOTION, FREELANCE, TRAINING, OTHER), a "link", a "deadline", its terms, and the "goalIds" to compare it with. Ask the person to confirm terms read from a job description.',
    status: 201,
    input: z.object({
      title: text('title', 120),
      organisation: optionalText('organisation', 120),
      kind: z.enum(OPPORTUNITY_KINDS).default('JOB'),
      link: z.string().trim().max(2000).optional(),
      notes: optionalText('notes', 2000),
      deadline: dayField.optional(),
      goalIds: z.array(idField).max(20).default([]),
      ...terms,
    }),
    run: async (user, input) => {
      const created = await addOpportunity(
        user.id,
        {
          title: input.title,
          organisation: input.organisation ?? null,
          kind: input.kind,
          sourceUrl: input.link ?? null,
          notes: input.notes ?? null,
          deadline: input.deadline ? toDay(input.deadline) : null,
          monthlyCompensation: input.monthlyPay ?? null,
          workArrangement: input.workArrangement ?? null,
          contractType: input.contractType ?? null,
          weeklyHours: input.weeklyHours ?? null,
          location: input.place ?? null,
        },
        input.goalIds,
      )
      return { id: created.id }
    },
  }),

  moveCareerOpportunity: operation({
    name: 'move_career_opportunity',
    method: 'POST',
    path: '/career/opportunities/{id}/status',
    needs: 'WRITE',
    does: 'Moves an opportunity in the pipeline: "status" FOUND, APPLIED, INTERVIEWING, OFFER or CLOSED; closing needs an "outcome" (accepted, declined, rejected, withdrawn, lapsed). Accepting an offer fully is done in the app.',
    input: z.object({ id: idField, status: z.enum(OPPORTUNITY_STATUSES), outcome: z.enum(OUTCOMES).optional() }),
    run: async (user, { id, status, outcome }) => {
      await moveOpportunity(user.id, id, status, outcome ?? null, now())
      return opportunities(user)
    },
  }),

  addCareerFocus: operation({
    name: 'add_career_focus',
    method: 'POST',
    path: '/career/focus',
    needs: 'WRITE',
    does: 'Adds a focus item to this Career week (3 at most): a "title", optionally the "goalId" and "opportunityId" it serves.',
    status: 201,
    input: z.object({ title: text('title', 120), goalId: idField.optional(), opportunityId: idField.optional() }),
    run: async (user, { title, goalId, opportunityId }) => {
      await addFocus(user.id, { title, goalId: goalId ?? null, opportunityId: opportunityId ?? null }, now())
      return week(user)
    },
  }),

  completeCareerFocus: operation({
    name: 'complete_career_focus',
    method: 'POST',
    path: '/career/focus/{id}/done',
    needs: 'WRITE',
    does: 'Ticks a Career focus item as done, or unticks it with "done": false.',
    input: z.object({ id: idField, done: z.boolean().default(true) }),
    run: async (user, { id, done }) => {
      await setFocusDone(user.id, id, done)
      return week(user)
    },
  }),

  writeCareerLog: operation({
    name: 'write_career_log',
    method: 'POST',
    path: '/career/log',
    needs: 'WRITE',
    does: 'Writes a line in the Career quick log ("text", 500 characters at most), optionally about a "goalId" or an "opportunityId". To record a fact too, call add_career_fact.',
    status: 201,
    input: z.object({ text: text('text', 500), goalId: idField.optional(), opportunityId: idField.optional() }),
    run: async (user, input) => {
      const entry = await writeLog(user.id, { body: input.text, goalId: input.goalId ?? null, opportunityId: input.opportunityId ?? null, also: { kind: 'none' } }, now())
      return { id: entry.id }
    },
  }),
}
