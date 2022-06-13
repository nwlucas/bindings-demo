import { bindTo } from "$lib/bindings";

export async function handle({ event, resolve }) {
  // initialize bindings for every request so we have access to them
  bindTo(event.platform, 'KV','NODE_ENV','DOCRYPT',"WAITUNTIL","SPECIAL_ENV_VAR")
  const response = await resolve(event);
  return response
}
