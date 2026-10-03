import { describe, expect, it, vi } from 'vitest'

import { getFeedbackInbox, markFeedbackRead, MAX_FEEDBACK_LENGTH, sendFeedback } from './feedback'

const depsOf = (allowed = true) => ({
  feedback: { addFeedback: vi.fn(), setWantsNews: vi.fn() },
  security: { allowAttempt: vi.fn().mockResolvedValue(allowed) },
})

describe('sendFeedback', () => {
  it('keeps the opinion and the wish to hear the news', async () => {
    const deps = depsOf()

    await sendFeedback('user-1', { rating: 4, kind: 'idea', message: '  Add a dark chart.  ', wantsNews: true }, deps)

    expect(deps.feedback.addFeedback).toHaveBeenCalledWith('user-1', { rating: 4, kind: 'idea', message: 'Add a dark chart.' })
    expect(deps.feedback.setWantsNews).toHaveBeenCalledWith('user-1', true)
    expect(deps.security.allowAttempt).toHaveBeenCalledWith('feedback:user-1', 10, 24 * 60 * 60 * 1000)
  })

  it('drops a rating out of 1 to 5, and cuts a very long message', async () => {
    const deps = depsOf()

    await sendFeedback('user-1', { rating: 9, kind: 'other', message: 'x'.repeat(5000), wantsNews: false }, deps)

    expect(deps.feedback.addFeedback).toHaveBeenCalledWith('user-1', {
      rating: null,
      kind: 'other',
      message: 'x'.repeat(MAX_FEEDBACK_LENGTH),
    })
  })

  it('needs words, and stops a flood', async () => {
    await expect(sendFeedback('user-1', { kind: 'idea', message: '   ', wantsNews: false }, depsOf())).rejects.toThrow(
      'Write a few words.',
    )

    const flooded = depsOf(false)
    await expect(sendFeedback('user-1', { kind: 'idea', message: 'Again', wantsNews: false }, flooded)).rejects.toThrow(
      /send the rest tomorrow/,
    )
    expect(flooded.feedback.addFeedback).not.toHaveBeenCalled()
  })
})

describe('the feedback inbox', () => {
  const repository = {
    listFeedback: vi.fn().mockResolvedValue([]),
    summary: vi.fn().mockResolvedValue({ count: 0, averageRating: null, unread: 0 }),
    listNewsReaders: vi.fn().mockResolvedValue([]),
    markAllRead: vi.fn(),
  }

  it('is for administrators only', async () => {
    await expect(getFeedbackInbox({ role: 'USER' }, repository)).rejects.toThrow('Only an administrator can see this.')
    await expect(markFeedbackRead({ role: 'USER' }, repository)).rejects.toThrow('Only an administrator can see this.')
    expect(repository.listFeedback).not.toHaveBeenCalled()
    expect(repository.markAllRead).not.toHaveBeenCalled()

    await expect(getFeedbackInbox({ role: 'ADMIN' }, repository)).resolves.toMatchObject({ items: [] })
  })
})
