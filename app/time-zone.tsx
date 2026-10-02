'use client'

import { useEffect } from 'react'

import { reportTimeZoneAction } from './account/actions'

// The time zone this device is set to, e.g. "Africa/Abidjan".
export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

// For accounts that have no time zone yet: tells the server the one of this
// device, once. It never changes a zone the person already has.
export function TimeZoneReporter() {
  useEffect(() => {
    void reportTimeZoneAction(deviceTimeZone())
  }, [])

  return null
}
