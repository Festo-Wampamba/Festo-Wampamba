import {readFile,writeFile} from 'node:fs/promises';
import {PacmanRenderer} from 'pacman-contribution-graph';
import {palettes,themeCss} from '../../scripts/palette.mjs';
const root=new URL('./',import.meta.url);
const xml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[char]);
let raw,meta;
if(process.argv.includes('--saved')){
 raw=await readFile(new URL('raw.svg',root),'utf8');meta=JSON.parse(await readFile(new URL('data.json',root),'utf8'));
}else{
 const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
 if(!token)throw new Error('Set GH_TOKEN or GITHUB_TOKEN for the read-only GitHub calendar request.');
 const nativeFetch=globalThis.fetch;
 // Limit this selected upstream renderer to its documented GitHub provider.
 globalThis.fetch=(input,options)=>{
  const url=typeof input==='string'?input:input.url;
  if(url!=='https://api.github.com/graphql')throw new Error('Unexpected renderer network destination.');
  return nativeFetch(input,{...options,signal:AbortSignal.timeout(30000)});
 };
 let store,gameStats;
 try{
  const renderer=new PacmanRenderer({platform:'github',username:'Festo-Wampamba',gameTheme:'github-dark',githubSettings:{accessToken:token},showMonthLabels:true,svgCallback:svg=>{raw=svg;},gameStatsCallback:stats=>{gameStats=stats;}});
  store=await renderer.start();
 }finally{globalThis.fetch=nativeFetch;}
 if(!raw||raw.includes(token)||/<script\b/i.test(raw))throw new Error('Invalid renderer output.');
 const days=store.contributions.map(day=>({date:new Date(day.date).toISOString().slice(0,10),count:day.count,level:day.level})).sort((a,b)=>a.date.localeCompare(b.date));
 if(days.length<365||days.some(day=>!Number.isSafeInteger(day.count)||day.count<0))throw new Error('Incomplete contribution data.');
 meta={username:'Festo-Wampamba',updatedAt:new Date().toISOString(),engine:'pacman-contribution-graph',version:'5.3.1',from:days[0].date,to:days.at(-1).date,total:days.reduce((sum,day)=>sum+day.count,0),active:days.filter(day=>day.count>0).length,frames:store.gameHistory.length,duration:Math.max(store.gameHistory.length*.2,.2),gameStats,days};
 await writeFile(new URL('raw.svg',root),raw);await writeFile(new URL('data.json',root),JSON.stringify(meta,null,2)+'\n');
}
const dimensions=raw.match(/<svg[^>]*width="(\d+)"[^>]*height="(\d+)"/);
if(!dimensions)throw new Error('Missing SVG dimensions.');
const [width,height]=dimensions.slice(1).map(Number);
const originalColors=['#161b22','#0e4429','#006d32','#26a641','#39d353'];
for(const mode of ['dark','light']){
 const palette=palettes[mode];
 const mapping=Object.fromEntries(originalColors.map((color,index)=>[color,palette[`tile-${index}`]]));
 Object.assign(mapping,{'#0d1117':palette.canvas,'#8b949e':palette.muted,'#ffffff':mode==='dark'?'#71623c':'#b3a16a'});
 let svg=raw.replace(/#[a-f0-9]{6}\b/gi,color=>mapping[color.toLowerCase()]||color);
 svg=svg.replace(`height="${height}"`,`height="${height+4}"`);
 svg=svg.replace('<svg ',`<svg viewBox="0 -4 ${width} ${height+4}" style="background:${palette.canvas}" role="img" aria-labelledby="pacman-title pacman-description" `).replace(/(<svg[^>]*>)/,`$1<title id="pacman-title">${xml(meta.username)} — Pac-Man contribution animation</title><desc id="pacman-description">${meta.total.toLocaleString('en-US')} actual contributions from ${meta.from} to ${meta.to}. Pac-Man and four ghosts play through your contribution calendar. This is an animated replay, not keyboard-controlled gameplay.</desc>`);
 // Keep the recognizable character colours; adapt the board to the profile palette.
 svg=svg.replace(/font-size="10"/g,'font-size="13"').replace('</svg>','<style>text{font-family:Geist,system-ui,sans-serif}</style></svg>');
 // A short first week can put two month labels too close together.
 const labels=[...svg.matchAll(/<text\b[^>]*\bx="([\d.]+)"[^>]*>[A-Za-z]{3}<\/text>/g)];
 for(let index=0;index<labels.length-1;index++)if(Number(labels[index+1][1])-Number(labels[index][1])<40)svg=svg.replace(labels[index][0],'');
 await writeFile(new URL(`pacman-${mode}.svg`,root),svg);
}
await writeFile(new URL('theme.css',root),themeCss(':root',':root[data-theme="light"]',':root[data-theme="dark"]'));
const template=await readFile(new URL('template.html',root),'utf8');
const replacements={REPLAY:Date.parse(meta.updatedAt),TOTAL:meta.total.toLocaleString('en-US'),ACTIVE:String(meta.active),FROM:meta.from,TO:meta.to,DURATION:String(meta.duration),UPDATED:new Date(meta.updatedAt).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Africa/Kampala'})+' EAT'};
await writeFile(new URL('index.html',root),template.replace(/<!-- (\w+) -->/g,(match,key)=>xml(replacements[key]??key)));
console.log(`Pac-Man generated: ${meta.total} real contributions; ${meta.frames} animation frames; ${Math.round(meta.duration)} seconds.`);
