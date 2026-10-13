import { maintainUserTrash } from '../functions/_lib/trash-storage.js';

export async function cleanupTrashForAllUsers(env, maintain = maintainUserTrash) {
  const { results } = await env.escandidor_db.prepare("SELECT DISTINCT user_id FROM deleted_poems WHERE versions_json <> '[]'").all();
  for (const { user_id } of results) await maintain(env, user_id);
}

export default {
  async scheduled(_controller, env) {
    await cleanupTrashForAllUsers(env);
  },
};
