import "server-only";
import { notFound } from "next/navigation";
import { isPaymentConfiguration } from "../api/payment-configuration.ts";
import { createClient } from "../supabase/server.ts";
export async function getPaymentConfiguration(tournamentId:string){const client=await createClient();const{data,error}=await client.rpc("get_tournament_payment_method_configuration",{p_tournament_id:tournamentId});if(error||!isPaymentConfiguration(data,tournamentId))notFound();return data;}
