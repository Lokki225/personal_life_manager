import { z } from 'zod'

import { AREA_COLORS, AREA_ICONS, isLifeAreaRuleError } from '@/domain/lifeAreas/areas'
import { FormHandler } from '@/lib/forms/FormHandler'
import { requiredText } from '@/lib/forms/fields'

export const areaSchema = z.object({
  id: z.string().trim().optional(),
  name: requiredText('Name the area.', 40),
  statement: z.string().trim().max(500, 'Keep it under 500 characters.').optional(),
  color: z.union([z.literal(''), z.enum(AREA_COLORS)]).optional(),
  icon: z.union([z.literal(''), z.enum(AREA_ICONS)]).optional(),
})

export const areaForm = new FormHandler(areaSchema, { isRuleError: isLifeAreaRuleError })
