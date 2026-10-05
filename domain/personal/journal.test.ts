import { describe, expect, it } from 'vitest'

import { excerpt, isScale, linkToken, parseLinks, plainText, splitBody } from './journal'

const body = 'Paused the course. @[Learn Japanese](goal:g1) can wait, and @[Call Awa](task:t9) too. @[Learn Japanese](goal:g1) again.'

describe('journal links', () => {
  it('reads Career links too, from the Career log', () => {
    expect(parseLinks('Passed @[AWS SAA](careerFact:f1) for @[A better job](careerGoal:g1) after @[Beta](careerOpportunity:o1)')).toEqual([
      { targetType: 'careerFact', targetId: 'f1', label: 'AWS SAA' },
      { targetType: 'careerGoal', targetId: 'g1', label: 'A better job' },
      { targetType: 'careerOpportunity', targetId: 'o1', label: 'Beta' },
    ])
  })

  it('finds each link once', () => {
    expect(parseLinks(body)).toEqual([
      { targetType: 'goal', targetId: 'g1', label: 'Learn Japanese' },
      { targetType: 'task', targetId: 't9', label: 'Call Awa' },
    ])
  })

  it('ignores what only looks like a link', () => {
    expect(parseLinks('@[x](planet:p1) @[y](goal:) [z](goal:g2) @[](goal:g3)')).toEqual([])
  })

  it('writes a token that reads back as the same link, without brackets in the label', () => {
    const token = linkToken({ targetType: 'goal', targetId: 'g7', label: 'Japanese [N5]' })
    expect(token).toBe('@[Japanese  N5](goal:g7)')
    expect(parseLinks(token)).toEqual([{ targetType: 'goal', targetId: 'g7', label: 'Japanese  N5' }])
  })

  it('splits the text into words and links, and shows links as labels in previews', () => {
    const parts = splitBody('See @[Chess](goal:c) today')
    expect(parts).toEqual([
      { kind: 'text', text: 'See ' },
      { kind: 'link', link: { targetType: 'goal', targetId: 'c', label: 'Chess' } },
      { kind: 'text', text: ' today' },
    ])
    expect(plainText('See @[Chess](goal:c) today')).toBe('See Chess today')
  })

  it('shortens a preview on one line', () => {
    expect(excerpt('One\n\ntwo   three')).toBe('One two three')
    expect(excerpt('a'.repeat(200), 10)).toBe(`${'a'.repeat(9)}…`)
  })

  it('accepts mood and energy from 1 to 5, or none', () => {
    expect([null, undefined, 1, 5].every(isScale)).toBe(true)
    expect([0, 6, 2.5].some(isScale)).toBe(false)
  })
})
