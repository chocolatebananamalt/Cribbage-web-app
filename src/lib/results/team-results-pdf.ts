import { PDFDocument,StandardFonts,rgb,type PDFPage } from "pdf-lib";
import type { TeamResults } from "../api/team-results.ts";

export async function buildTeamResultsPdf(tournamentName:string,report:TeamResults){
 const document=await PDFDocument.create();const regular=await document.embedFont(StandardFonts.Helvetica);const bold=await document.embedFont(StandardFonts.HelveticaBold);let page:PDFPage=document.addPage([612,792]);let y=748;
 const footer=()=>page.drawText("Director-reviewed team report · verify all awards before ACC submission",{x:36,y:24,size:8,font:regular,color:rgb(.35,.38,.42)});
 const line=(text:string,strong=false)=>{if(y<52){footer();page=document.addPage([612,792]);y=748;}page.drawText(text.slice(0,105),{x:36,y,size:strong?14:10,font:strong?bold:regular,color:rgb(.08,.12,.18)});y-=strong?22:15;};
 line("Team Event Results",true);line(tournamentName,true);line(`${report.eventName} · ${report.format.replaceAll("_"," ")}`);line(report.mrps==="not_applicable_satellite"?"MRPs: Not applicable—Satellite event":`${report.qualificationCount} team qualifier${report.qualificationCount===1?"":"s"}`);if(report.qualificationBlocked)line("Qualification cutoff tied — official head-to-head/playoff review required.",true);
 for(const entry of report.entries){line(`${entry.rank}. ${entry.teamName}${entry.qualifies?" · Qualifier":entry.qualificationStatus==="tie_review_required"?" · Tie review required":""}`,true);line(`   ${entry.members.map((member)=>member.accNumber?`${member.name} (${member.accNumber})`:member.name).join(" / ")}`);line(`   ${entry.gamePoints} game points · ${entry.gamesWon} won · +${entry.plusSpreadPoints} / -${entry.minusSpreadPoints} · net ${entry.netSpreadPoints>=0?"+":""}${entry.netSpreadPoints}`);}
 footer();return document.save();
}
