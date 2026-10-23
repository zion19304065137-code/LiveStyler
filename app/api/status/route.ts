import { runtimeEnv } from "../../../lib/server";
import {languageRuntime} from '../../../lib/ai-provider';
export async function GET() {
  const e = languageRuntime(await runtimeEnv());
  return Response.json(
    {
      text: !!(e.TEXT_AI_API_KEY && e.TEXT_AI_MODEL && e.TEXT_AI_BASE_URL),
      image: !!(e.IMAGE_AI_API_KEY && e.IMAGE_AI_MODEL && e.IMAGE_AI_BASE_URL),
      polyv: !!(e.POLYV_VAULT_KEY),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
