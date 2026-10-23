import {z} from 'zod';
import {projectSchema} from './design';
import {conversationSchema} from './conversation';

export const companionSchema=z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{8,100}$/),project:projectSchema,messages:conversationSchema.default([])});
export type WorkCompanion=z.infer<typeof companionSchema>;
export const workBundleSchema=z.object({project:projectSchema,messages:conversationSchema.default([]),companion:companionSchema.optional()}).refine(b=>!b.companion||b.project.mode!==b.companion.project.mode,'关联画面必须分别为直播包装与暖场');
