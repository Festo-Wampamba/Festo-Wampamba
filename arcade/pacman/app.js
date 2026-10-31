const game=document.querySelector('#game'),theme=document.querySelector('#theme'),play=document.querySelector('#play'),restart=document.querySelector('#restart'),seek=document.querySelector('#seek'),time=document.querySelector('#time'),download=document.querySelector('#download');
const system=matchMedia('(prefers-color-scheme:dark)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
let svg=null,paused=reduced.matches,onscreen=true,tick=null,position=4,ready=false;
const duration=Number(seek.max);
const stamp=value=>String(Math.floor(value/60)).padStart(2,'0')+':'+String(Math.floor(value%60)).padStart(2,'0');
function showTime(){if(!svg)return;const current=svg.getCurrentTime()%duration;seek.value=String(current);time.textContent=stamp(current);}
function motion(){clearInterval(tick);tick=null;if(!svg)return;const stop=paused||reduced.matches||document.hidden||!onscreen;stop?svg.pauseAnimations():svg.unpauseAnimations();play.textContent=reduced.matches?'Motion off':paused?'Play':'Pause';play.disabled=reduced.matches;play.setAttribute('aria-pressed',String(paused||reduced.matches));if(!stop)tick=setInterval(showTime,250);showTime();}
function appearance(){if(svg&&ready)position=svg.getCurrentTime()%duration;const mode=theme.value==='system'?(system.matches?'dark':'light'):theme.value;document.documentElement.dataset.theme=mode;ready=false;svg=null;clearInterval(tick);const asset=`pacman-${mode}.svg?v=${encodeURIComponent(game.dataset.replay)}`;game.data=asset;download.href=asset;}
game.addEventListener('load',()=>{svg=game.contentDocument?.documentElement;if(!svg?.pauseAnimations){time.textContent='Unavailable';return;}svg.setCurrentTime(position);ready=true;motion();});
theme.value='system';theme.addEventListener('change',appearance);system.addEventListener('change',()=>{if(theme.value==='system')appearance();});
play.addEventListener('click',()=>{paused=!paused;motion();});restart.addEventListener('click',()=>{position=0;if(svg){svg.setCurrentTime(0);motion();}});seek.addEventListener('input',()=>{position=Number(seek.value);if(svg){svg.setCurrentTime(position);showTime();}});
reduced.addEventListener('change',()=>{paused=reduced.matches;motion();});document.addEventListener('visibilitychange',motion);new IntersectionObserver(([entry])=>{onscreen=entry.isIntersecting;motion();}).observe(game);appearance();
