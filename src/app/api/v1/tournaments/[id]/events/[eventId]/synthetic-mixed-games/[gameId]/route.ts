import {createMixedProductionHandlers}from'../../../../../../../../../lib/api/synthetic-mixed-production';
const handlers=createMixedProductionHandlers();
export const GET=handlers.ownGET;
export const POST=handlers.ownPOST;
