import { securityRepository } from '../repositories/securityRepository'

// Limits on how often one person may do something
// (Ressources/security-codebase-plan.md, step 5). Counted in the database, so
// they hold across every server instance.

const MINUTE = 60_000

// Changes made through the forms and one-tap buttons.
export const writesAllowed = (userId: string) => securityRepository.allowAttempt(`write:${userId}`, 120, MINUTE)

// The live lines of the life graph.
export const badgesAllowed = (userId: string) => securityRepository.allowAttempt(`badges:${userId}`, 30, MINUTE)

// Reading a rating from chess.com on demand.
export const chessSyncAllowed = (userId: string) => securityRepository.allowAttempt(`chessSync:${userId}`, 1, MINUTE)

export const TOO_MANY_WRITES = 'Too many changes in a minute. Wait a moment and try again.'
