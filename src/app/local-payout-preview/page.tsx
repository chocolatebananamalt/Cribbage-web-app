import{headers}from"next/headers";
import{notFound}from"next/navigation";
import{isLoopbackPlannerUrl}from"../../lib/api/local-seating-planner";
import Preview from"../../components/local-payout-preview";
export default async function Page(){if(process.env.CRIBBAGE_LOCAL_PAYOUT_PREVIEW!=="1"||!["development","test"].includes(process.env.NODE_ENV??"")||(process.env.VERCEL_ENV!==undefined&&process.env.VERCEL_ENV!=="development"))notFound();const host=(await headers()).get("host");if(!host||!isLoopbackPlannerUrl(`http://${host}`))notFound();return<main className="auth-shell"><section className="auth-card corrections-card"><h1>Local payout comparison</h1><Preview/></section></main>;}
