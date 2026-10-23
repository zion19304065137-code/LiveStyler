import {sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const polyvConnections=sqliteTable('polyv_connections',{
  ownerId:text('owner_id').primaryKey().notNull(),
  payload:text('payload').notNull(),
  verifiedChannel:text('verified_channel').notNull(),
  updatedAt:text('updated_at').notNull(),
});
export const aiTasks=sqliteTable('ai_tasks',{id:text('id').primaryKey().notNull(),owner:text('owner').notNull(),state:text('state').notNull(),created:text('created').notNull(),updated:text('updated').notNull(),message:text('message').notNull(),resultKey:text('result_key')});
export const cloudProjects=sqliteTable('cloud_projects',{id:text('id').primaryKey().notNull(),owner:text('owner').notNull(),name:text('name').notNull(),updated:text('updated').notNull(),objectKey:text('object_key').notNull()});
export const channelSnapshots=sqliteTable('channel_snapshots',{id:text('id').primaryKey().notNull(),owner:text('owner').notNull(),channel:text('channel').notNull(),created:text('created').notNull(),beforeImage:text('before_image').notNull(),afterImage:text('after_image').notNull(),state:text('state').notNull()});
