import{createRosterDrawProductionHandlers}from"../../../../../../../../lib/api/roster-random-draw-production";
// Factory gate runs before constructing any auth/backend client.
const handlers=createRosterDrawProductionHandlers();
export const GET=handlers.operationGET;
