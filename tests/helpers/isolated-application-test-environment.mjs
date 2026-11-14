/** Unit fixtures select their own fictional targets. Build/deployment bindings
 * remain in the parent process and cannot silently open default-off tests. */
export function isolatedApplicationTestEnvironment(environment) {
  return Object.fromEntries(Object.entries(environment).filter(([name])=>
    !/^(?:SUPABASE|NEXT_PUBLIC_SUPABASE|NEXT_PUBLIC_CRIBBAGE_TEST|CRIBBAGE_TEST|VERCEL)/i.test(name)
    && name !== 'CRIBBAGE_FICTIONAL_DRAW_BOUNDARY'
    && !/^EVENT_PRIZE_SETUP_(?:TEST|PRODUCTION)(?:_|$)/i.test(name)));
}
