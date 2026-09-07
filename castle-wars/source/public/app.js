import { WORLD, WEAPONS, DEFAULT_WEAPONS } from '/shared/content.js';
import { createGame, snapshotGame, validateBuild, snapBuild, getBuildBounds } from '/shared/game.js';
import { ArenaRenderer, weaponIcon } from './renderer.js';
import { GameAudio } from './audio.js';
import { bindAimInput } from './aim-input.js';
import { resultPresentationActive } from '/shared/presentation.js';

const standalone = typeof __CW_STANDALONE__ !== 'undefined' && __CW_STANDALONE__;
const Socket = standalone ? (await import('./solo-transport.js')).SoloSocket : WebSocket;
const storageKey = key => standalone ? `cw-pages:${key}` : key;
const $ = id => document.getElementById(id);
const clean = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const readStore=(key,fallback,session=false)=>{try{return JSON.parse((session?sessionStorage:localStorage).getItem(storageKey(key)))??fallback;}catch{return fallback;}};
const saveStore=(key,value,session=false)=>{try{(session?sessionStorage:localStorage).setItem(storageKey(key),JSON.stringify(value));}catch{}};
const removeStore=(key,session=false)=>{try{(session?sessionStorage:localStorage).removeItem(storageKey(key));}catch{}};
const errors={OUTSIDE_BATTLEFIELD:'Place the barricade inside the battlefield.',OUTSIDE_BUILD_REGION:'Build inside your own castle’s area.',UNDERWATER:'That spot is under water.',OCCUPIED:'That spot is occupied. Find an open space.',NEEDS_ANCHOR:'Connect the cover to solid ground or your castle.',OFF_GRID:'Move the cover onto the grid.',NOT_YOUR_TURN:'Your opponent is taking their turn.',TURN_EXPIRED:'Time’s up. Your next shooter is on the way.',NO_AMMO:'That weapon is out of ammo.',WEAPON_LOCKED:'That weapon hasn’t unlocked yet.',NOT_AIMING:'Wait for the current action to finish.',WRONG_SHOOTER:'Use the glowing shooter this turn.',INVALID_POSITION:'Choose a position inside the battlefield.'};
const audio=new GameAudio();
const renderer=new ArenaRenderer($('arena'),audio);
const preview=snapshotGame(createGame({id:'menu-preview',seed:712,now:0}));
let state=null,room=null,side=0,screen='menu',socket=null,connectPromise=null,pendingAction=null,sequence=0,selected='basic',snapshotAt=performance.now(),paletteSignature='',turnSignature='',matchId=null;
let pointerInput=null,aim=null,keyboardHeld=false,lastToast=null,toastTimer=null,hostOrigin=location.origin,desiredAction=null,reconnectTimer=null,reconnectStarted=0,reconnecting=false;
let session=standalone?null:readStore('cw-seat',null,true),settings=readStore('cw-settings',{sound:true,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,shake:true});
let lastUnlock=0,lastWater=0,revealedResultMatch=null,drowningSoundMatch=null;

function showScreen(name){if(name!=='game')setFinale(false);screen=name;$('app').dataset.screen=name;for(const key of ['menu','lan','lobby','game','result'])$(`${key}-screen`).classList.toggle('hidden',key!==name);renderer.setState(['menu','lan','lobby'].includes(name)?preview:state,{side,screen:name});}
function toast(message,duration=3600){if(message===lastToast&&!$('toast').classList.contains('hidden'))return;lastToast=message;$('toast').textContent=message;$('toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),duration);}
function settingsApply(){audio.setEnabled(settings.sound);renderer.reduced=settings.reduced;renderer.shakeEnabled=settings.shake;$('sound-toggle').checked=settings.sound;$('motion-toggle').checked=settings.reduced;$('shake-toggle').checked=settings.shake;$('sound-button').setAttribute('aria-pressed',String(settings.sound));$('sound-button').setAttribute('aria-label',settings.sound?'Mute sound':'Enable sound');$('sound-button').title=settings.sound?'Mute sound':'Enable sound';$('sound-button').querySelector('.sound-slash').classList.toggle('hidden',settings.sound);document.body.classList.toggle('reduced-motion',settings.reduced);saveStore('cw-settings',settings);}
settingsApply();showScreen('menu');
$('player-name').value=readStore('cw-name','Captain');
function playerName(){const name=$('player-name').value.trim()||'Captain';saveStore('cw-name',name);return name;}
function connectionStatus(online){$('connection').classList.toggle('offline',!online);$('connection').innerHTML=`<i></i>${online?(standalone?'SOLO PLAY':'LOCAL PLAY'):(standalone?'SOLO PLAY UNAVAILABLE':'HOST OFFLINE')}`;}
function setReconnecting(value){if(value)renderer.resetEventStream();reconnecting=value;$('reconnecting').classList.toggle('hidden',!value);if(value)cancelAim();}
function failedReconnect(message){clearTimeout(reconnectTimer);session=null;removeStore('cw-seat',true);setReconnecting(false);pendingAction=null;state=null;room=null;showScreen('menu');toast(message||'Couldn’t reconnect in time. Start a new battle.',6000);}
function connect(){if(socket?.readyState===Socket.OPEN)return Promise.resolve(socket);if(connectPromise)return connectPromise;
  connectPromise=new Promise((resolve,reject)=>{
    const ws=new Socket(standalone ? undefined : `${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);socket=ws;const timeout=setTimeout(()=>{if(ws.readyState!==Socket.OPEN){ws.close();reject(new Error('The host is unreachable. Check that Node.js is running.'));}},5000);
    ws.addEventListener('open',()=>{clearTimeout(timeout);connectPromise=null;connectionStatus(true);resolve(ws);if(session){ws.send(JSON.stringify({type:'resume',code:session.code,token:session.token}));}else if(desiredAction){ws.send(JSON.stringify(desiredAction));desiredAction=null;}});
    ws.addEventListener('message',event=>{let data;try{data=JSON.parse(event.data);}catch{return;}receive(data);});
    ws.addEventListener('error',()=>{clearTimeout(timeout);connectPromise=null;connectionStatus(false);reject(new Error('The host is unreachable. Check that Node.js is running.'));});
    ws.addEventListener('close',event=>{clearTimeout(timeout);connectPromise=null;connectionStatus(false);if(socket!==ws)return;if(event.code===4001){failedReconnect('This castle was opened in another tab. Start a new game here.');return;}if(session){if(!reconnecting){reconnectStarted=performance.now();setReconnecting(true);}if(performance.now()-reconnectStarted>=10000){failedReconnect();return;}clearTimeout(reconnectTimer);reconnectTimer=setTimeout(()=>connect().catch(()=>{}),550);}else{pendingAction=null;}});
  });return connectPromise;
}
async function send(data){try{const ws=await connect();ws.send(JSON.stringify(data));return true;}catch(error){toast(error.message,6000);return false;}}
async function begin(mode){if(standalone&&mode!=='ai'){showScreen('lan');return;}audio.unlock();cancelAim();$('play-ai').disabled=true;$('host-room').disabled=true;try{await send({type:'create',mode,name:playerName()});}finally{$('play-ai').disabled=false;$('host-room').disabled=false;}}
function receive(message){
  if(message.type==='joined'){renderer.resetEventStream();session={code:message.roomCode,token:message.resumeToken};side=message.side;sequence=0;if(!standalone)saveStore('cw-seat',session,true);setReconnecting(false);clearTimeout(reconnectTimer);$('lobby-code').textContent=message.roomCode;updateInvite();return;}
  if(message.type==='state'){
    room=message.room;side=message.you;if(!message.state){state=null;updateLobby();showScreen('lobby');return;}
    const previous=state;state=message.state;snapshotAt=performance.now();if(matchId!==state.matchId){matchId=state.matchId;sequence=0;selected='basic';revealedResultMatch=null;lastUnlock=0;lastWater=0;paletteSignature='';pendingAction=null;turnSignature='';cancelAim();}
    if(pendingAction&&(state.turnId!==pendingAction.turnId||state.phase!=='aim'))pendingAction=null;
    const nextTurn=`${state.turnId}:${state.phase}:${state.activeUnitId}`;if(turnSignature!==nextTurn){turnSignature=nextTurn;cancelAim();if(!(selected in state.teams[side].ammo)||state.teams[side].ammo[selected]===0)selected='basic';}
    if(state.unlockedCount>lastUnlock){if(previous&&previous.matchId===state.matchId)toast(`${WEAPONS[state.lineup[state.unlockedCount-1]].name} unlocked for both castles!`,3200);lastUnlock=state.unlockedCount;}
    if(state.waterRise>lastWater){lastWater=state.waterRise;toast(`Tide ${state.waterRise} of 6. Keep your head above water.`,2600);}
    updateMatchPresentation();
    updateHUD();updatePalette();renderer.setState(state,{side,screen});return;
  }
  if(message.type==='error'){pendingAction=null;cancelAim();if(message.code==='RESUME_FAILED'){failedReconnect(message.message);return;}toast(errors[message.message]||message.message||'Something went wrong. Try again.',4500);return;}
  if(message.type==='ack'){if(pendingAction?.commandId===message.commandId)pendingAction.acknowledged=true;return;}
  if(message.type==='left'){session=null;removeStore('cw-seat',true);room=null;state=null;pendingAction=null;matchId=null;showScreen('menu');return;}
}
async function loadHost(){if(standalone)return;try{const response=await fetch('/api/host');if(response.ok){const data=await response.json();const isLocal=['localhost','127.0.0.1','[::1]'].includes(location.hostname);hostOrigin=isLocal?(data.urls[0]||location.origin):location.origin;updateInvite();}}catch{}}
function updateInvite(){if(standalone||!session)return;const url=`${hostOrigin}/?room=${encodeURIComponent(session.code)}`;$('room-qr').src=`/api/qr?code=${encodeURIComponent(session.code)}&origin=${encodeURIComponent(hostOrigin)}`;$('lan-address').textContent=hostOrigin;$('lan-address').href=hostOrigin;$('copy-link').dataset.url=url;}
function updateLobby(){if(!room)return;$('lobby-code').textContent=room.code;$('lobby-players').innerHTML=room.players.map((p,i)=>`<div class="lobby-player"><span class="player-avatar">♜</span><div><b>${clean(p.connected?p.name:'Waiting for a rival')}${i===side?' · YOU':''}</b><small>${i===0?'THE MOSS GUARD':'THE CINDER CREW'}</small></div><span class="player-ready">${p.ready?'READY ✓':p.connected?'NOT READY':'…'}</span></div>`).join('');const ready=room.players[side]?.ready;$('ready-button').innerHTML=ready?'Ready! Waiting for a rival… <span>✓</span>':"I’m ready <span>✓</span>";$('ready-button').classList.toggle('secondary',ready);$('lobby-status').textContent=room.players.every(p=>p.connected)?'Both captains are here. Ready up to start.':'Your opponent can scan the code or enter the room code.';}
function currentUnit(){return state?.teams.flatMap(t=>t.units).find(u=>u.id===state.activeUnitId);}
function canAct(){return state&&state.phase==='aim'&&state.activeSide===side&&!state.result&&!pendingAction&&!reconnecting&&socket?.readyState===Socket.OPEN&&serverNow()<state.turnDeadline;}
function serverNow(){return state?(standalone?(socket?.currentTime??state.now):state.now+Math.max(0,performance.now()-snapshotAt)):0;}
const formatTime=seconds=>{const n=Math.max(0,Math.ceil(seconds));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;};
function setFinale(active){
  const wasActive=$('app').dataset.finale==='true';
  $('app').dataset.finale=String(active);
  document.querySelector('.arsenal').inert=active;
  for(const id of ['help-button','settings-button'])$(id).disabled=active;
  if(active&&!wasActive){
    for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
    clearTimeout(toastTimer);$('toast').classList.add('hidden');
  }
}
function updateMatchPresentation(){
  if(!state)return;
  const presenting=revealedResultMatch!==state.matchId&&resultPresentationActive(state.result,serverNow());
  setFinale(presenting);
  if(!state.result){if(screen!=='game')showScreen('game');return;}
  cancelAim();
  if(presenting){
    const drowning=state.result.presentation.drowning;
    if(drowning&&drowningSoundMatch!==state.matchId&&serverNow()<drowning.endsAt){
      drowningSoundMatch=state.matchId;
      audio.event({type:'drowning-finale',ageMs:Math.max(0,serverNow()-drowning.at)});
    }
    if(screen!=='game')showScreen('game');
    return;
  }
  // An authoritative result freezes play immediately. Its presentation deadline
  // gates only the overlay and fanfare, and also works without another snapshot.
  if(screen!=='result')showScreen('result');
  updateResult();
  if(revealedResultMatch!==state.matchId){revealedResultMatch=state.matchId;audio.event({type:'result'});}
}

function updateHUD(){
  if(!state)return;
  state.teams.forEach((team,i)=>{
    const panel=$(`team-${i}`);
    const name=i===side?'YOUR CASTLE':(room?.mode==='ai'?'CAPTAIN CINDER':room?.players[i]?.name.toUpperCase()||'RIVAL CASTLE');
    panel.querySelector('.team-name').textContent=name;
    // Keep every original shooter in the denominator. Losing a shooter must
    // reduce the team bar rather than make surviving crew appear healthier.
    const crewMax=team.units.reduce((total,unit)=>total+unit.maxHp,0);
    const crewHp=team.units.reduce((total,unit)=>total+(unit.alive?Math.max(0,Math.min(unit.hp,unit.maxHp)):0),0);
    const coreHp=Math.max(0,Math.min(team.core.hp,team.core.maxHp));
    for(const [kind,hp,max,label] of [['crew',crewHp,crewMax,'Combined shooter health'],['core',coreHp,team.core.maxHp,'Castle core health']]){
      const track=panel.querySelector(`.${kind}-track`),number=panel.querySelector(`.${kind}-number`);
      track.querySelector('i').style.width=`${max>0?hp/max*100:0}%`;
      track.setAttribute('aria-label',`${name}: ${label}`);
      track.setAttribute('aria-valuemin','0');
      track.setAttribute('aria-valuemax',String(max));
      track.setAttribute('aria-valuenow',String(hp));
      track.setAttribute('aria-valuetext',`${Math.ceil(hp)} of ${max} health`);
      number.textContent=`${Math.ceil(hp)}/${max}`;
      number.title=`${label}: ${Math.ceil(hp)} of ${max}`;
    }
    const living=team.units.filter(u=>u.alive);const activeIndex=living.findIndex(u=>u.id===state.activeUnitId);const next=state.activeSide===i&&activeIndex>=0?living[(activeIndex+1)%living.length]?.id:team.units[team.cursor]?.id;panel.querySelector('.roster').innerHTML=team.units.map((u,idx)=>`<span class="roster-unit ${u.id===state.activeUnitId?'active':''} ${!u.alive?'dead':''} ${u.id===next&&u.id!==state.activeUnitId?'next':''}" aria-label="Shooter ${idx+1}: ${u.alive?Math.ceil(u.hp)+' health':'eliminated'}">${u.alive?'●':'×'} ${idx+1}<span class="tiny-hp"><i style="width:${u.hp/u.maxHp*100}%"></i></span></span>`).join('');});
  const wind=state.wind||{level:0},level=Math.abs(wind.level);
  $('wind-direction').textContent=wind.level<0?'←':wind.level>0?'→':'≈';
  $('wind-strength').textContent=level?`${level}/7`:'CALM';
  $('wind-meter').dataset.direction=wind.level<0?'left':wind.level>0?'right':'calm';
  $('wind-meter').setAttribute('aria-label',`Wind ${wind.level<0?'left':wind.level>0?'right':'calm'}${level?`, strength ${level} of 7`:''}. Changes after both players have acted.`);
  $('wind-bars').style.setProperty('--strength',`${level/7*100}%`);
  $('formation-name').textContent=state.formation?.name||'';
  $('match-clock-label').textContent=state.suddenDeath?'SUDDEN DEATH':'REGULATION';$('round-number').textContent=state.suddenDeath?`TIDE ${state.waterRise} / 6`:`ROUND ${state.round}`;document.querySelector('.match-clock').classList.toggle('sudden',state.suddenDeath);
  const own=state.activeSide===side;let label=own?'YOUR TURN':'RIVAL’S TURN',hint=own?'Pull back from your glowing shooter. Release to fire.':'Your opponent is lining up a little trouble.';
  if(state.phase==='resolve'){const lastAction=[...(state.events||[])].reverse().find(event=>event.type==='launch'||event.type==='build');const building=lastAction?.type==='build';label=building?'COVER GOING UP':'WATCH IT FLY';hint=building?'A little shelter. A whole lot of attitude.':'One shot. Plenty of consequences.';}
  if(state.phase==='countdown'){label='GET READY';hint=state.formation?.description||'Three shooters. One very important golden core.';}
  if(state.phase==='water'){label='HERE COMES THE TIDE';hint='Water ignores walls. And dignity.';}
  if(state.phase==='transition'){label=state.suddenDeath?'THE TIDE IS COMING':'WATER ON THE HORIZON';hint='The next turn starts shortly.';}
  if(own&&state.phase==='aim'&&currentUnit()?.needsArc)hint='Aim high to clear your castle. Watch the wind.';
  if(own&&state.phase==='aim'&&WEAPONS[selected]?.kind==='build')hint='Floating cover: inside your castle, up to two bricks above. Release on green.';
  if(pendingAction){label='SHOT SENT';hint=standalone?'Lining up your shot…':'Waiting for the host…';}
  if(resultPresentationActive(state.result,serverNow())){
    const {cores,finish,drowning,explosions}=state.result.presentation;
    label=cores.length>1?'BOTH CORES DESTROYED':cores.length?(cores[0].side===side?'YOUR CORE IS DESTROYED':'RIVAL CORE DESTROYED'):finish?'THE FINAL BLOW':drowning?'GLUP. GLUP.':'COSMIC FINISH';
    hint=cores.length?'One last, glorious explosion.':finish?'The last shot. Savor the blast.':drowning?'An unscheduled swim.':`${WEAPONS[explosions[0]?.weaponId]?.name||'The final shot'} goes out with a bang.`;
  }
  $('turn-label').textContent=label;$('turn-instruction').textContent=hint;$('turn-timer').style.background=own?'':'#c6745f';$('aim-hint').textContent=WEAPONS[selected]?.kind==='build'?'DRAG COVER · RELEASE TO BUILD':'DRAG BACK · RELEASE TO FIRE';updateTimers();
}
function updateTimers(){if(!state||!['game','result'].includes(screen))return;updateMatchPresentation();const now=serverNow();$('match-time').textContent=state.phase==='countdown'?'4:00':state.suddenDeath?`${Math.min(6,state.suddenTurns)} / 6`:formatTime((state.regulationEndsAt-(state.result?.endedAt??now))/1000);const left=Math.max(0,Math.ceil((state.turnDeadline-now)/1000));$('turn-timer').textContent=state.phase==='aim'?String(left):'·';$('turn-timer').classList.toggle('low',state.phase==='aim'&&left<=5);$('turn-timer').setAttribute('aria-label',`${left} seconds to act`);$('countdown').classList.toggle('hidden',state.phase!=='countdown');if(state.phase==='countdown')$('countdown').querySelector('strong').textContent=Math.max(1,Math.ceil((state.countdownEndsAt-now)/1000));if(aim&&!canAct())cancelAim();}
function updatePalette(){if(!state)return;const ids=[...DEFAULT_WEAPONS,...state.lineup];const ammo=state.teams[side].ammo;const signature=JSON.stringify([ids,ammo,selected]);if(signature===paletteSignature)return;paletteSignature=signature;
  $('weapon-palette').innerHTML=ids.map((id,idx)=>{const w=WEAPONS[id],locked=!(id in ammo),spent=ammo[id]===0;return `<button class="weapon-card ${selected===id?'selected':''} ${locked?'locked':''} ${spent?'spent':''}" data-weapon="${id}" aria-pressed="${selected===id}" aria-label="${clean(w.name)}. ${locked?'Unlocks after round '+(idx-1):spent?'Out of ammo':ammo[id]===-1?'Unlimited ammo':ammo[id]+' shots remaining'}. ${clean(w.short)}" title="${clean(w.name+': '+w.short)}"><span class="weapon-icon">${weaponIcon(id,locked)}</span><span class="weapon-copy"><b>${clean(w.name)}</b><small>${locked?'⌑ ROUND '+(idx-1):spent?'EMPTY':ammo[id]===-1?'∞ ROCKETS':ammo[id]+' '+(w.kind==='build'?'BUILD':'SHOT')+(ammo[id]>1?'S':'')}</small></span></button>`;}).join('');
  $('weapon-description').textContent=WEAPONS[selected].short;$('next-unlock').textContent=state.unlockedCount<6?`NEXT: ${WEAPONS[state.lineup[state.unlockedCount]].name} · ROUND ${state.unlockedCount+1}`:'FULL ARSENAL · MAKE IT COUNT';
}
function chooseWeapon(id){if(!state||state.result)return;const ammo=state.teams[side].ammo;if(!(id in ammo)){const i=state.lineup.indexOf(id);toast(`${WEAPONS[id].name} unlocks for both castles after round ${i+1}.`,2400);return;}if(ammo[id]===0){toast('That weapon is out of ammo. Try an infinite rocket.',2400);return;}cancelAim();selected=id;paletteSignature='';audio.click();updatePalette();updateHUD();if(WEAPONS[id].kind==='build'&&canAct()){const unit=currentUnit();const point=initialBuildPosition(id,unit);aim={build:true,weaponId:id,...point};renderer.setAim(aim);}}
function initialBuildPosition(id,unit){
  const fp=WEAPONS[id].footprint,step=WORLD.tileSize;
  const first=snapBuild(state,side,side===0?unit.x+45:unit.x-45-fp.w*step,unit.y+unit.h-fp.h*step);
  if(validateBuild(state,side,id,first.x,first.y).ok)return first;
  const region=getBuildBounds(state,side);
  for(let y=region.y+region.h-fp.h*step;y>=region.y;y-=step)
    for(let x=region.x;x+fp.w*step<=region.x+region.w;x+=step){
      const p=snapBuild(state,side,x,y);if(validateBuild(state,side,id,p.x,p.y).ok)return p;
    }
  return first;
}
function updateResult(){const result=state.result;const won=result.winner===side,draw=result.winner===null;const interrupted=result.interrupted;$('result-medal').textContent=draw?'≈':won?'♜':'⚑';$('result-title').textContent=interrupted?'Battle interrupted.':draw?'A glorious draw.':won?'Long live your castle.':'Well. That happened.';const reasonText={'Enemy core destroyed':won?'You cracked your rival’s golden core. A magnificent mess.':'Your golden core has become very expensive confetti.','Enemy crew eliminated':won?'All three rival shooters are out. Your crew gets to brag.':'Your last shooter is out. Your rival gets to brag.','Last crew above water':won?'Your crew kept their heads above water. Literally.':'Your crew went for an unscheduled swim.','Both crews drowned together':'Both crews took the same final plunge. Nobody gets to brag.'};$('result-description').textContent=reasonText[result.reason]||result.reason|| (draw?'Nobody gets to brag this time.':won?'Your rival has officially become rubble.':'Your rival has the last laugh. For now.');$('result-stats').innerHTML=`<div><b>${formatTime(state.elapsed)}</b><span>BATTLE TIME</span></div><div><b>${state.completedTurns}</b><span>TURNS PLAYED</span></div><div><b>${state.teams[side].units.filter(u=>u.alive).length}/3</b><span>CREW STANDING</span></div>`;const waiting=room?.rematch?.[side];$('rematch-button').disabled=waiting;$('rematch-button').innerHTML=waiting?'Challenge sent <span>✓</span>':'One more round <span>↻</span>';$('rematch-status').textContent=waiting?'Waiting for your rival to accept…':room?.rematch?.[1-side]?'Your rival wants a rematch. Go on, then.':'';}
function cancelAim(){pointerInput?.cancel();aim=null;keyboardHeld=false;renderer.setAim(null);$('cancel-aim').classList.add('hidden');$('power-meter').classList.add('hidden');$('cancel-aim').classList.remove('hover');}
function aimUI(){if(!aim)return;renderer.setAim(aim);$('cancel-aim').classList.remove('hidden');$('power-meter').classList.toggle('hidden',!!aim.build);if(!aim.build){const pct=Math.round(aim.power*100);$('power-meter').querySelector('i').style.width=`${pct}%`;$('power-meter').querySelector('b').textContent=`${pct}%`;}}
function inCancel(x,y){const r=$('cancel-aim').getBoundingClientRect();return x>=r.left-12&&x<=r.right+12&&y>=r.top-12&&y<=r.bottom+20;}
function commitAim(){if(!aim||!canAct()){cancelAim();return;}const unit=currentUnit();let action;if(aim.build){const valid=validateBuild(state,side,selected,aim.x,aim.y);if(!valid.ok){toast(errors[valid.reason]||valid.reason,2200);return;}action={kind:'build',unitId:unit.id,weaponId:selected,x:aim.x,y:aim.y};}else action={kind:'fire',unitId:unit.id,weaponId:selected,angle:aim.angle,power:aim.power};
  const commandId=`${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2,7)}`;pendingAction={commandId,turnId:state.turnId,started:performance.now()};const message={type:'action',protocolVersion:1,matchId:state.matchId,turnId:state.turnId,commandId,sequence,action};cancelAim();updateHUD();send(message).then(ok=>{if(!ok)pendingAction=null;});
}
pointerInput=bindAimInput($('arena'),{
  canStart(event){
    if(screen!=='game'||!canAct())return false;
    const unit=currentUnit(),u=renderer.screenPoint(unit.x+unit.w/2,unit.y+unit.h/2),rect=$('arena').getBoundingClientRect();
    if(WEAPONS[selected].kind!=='build'&&Math.hypot(event.clientX-rect.left-u.x,event.clientY-rect.top-u.y)>Math.max(34,30*renderer.scale)){
      toast('Start your pull on the glowing shooter.',2000);return false;
    }
    return true;
  },
  canContinue:canAct,
  start(event){
    audio.unlock();const unit=currentUnit();
    if(WEAPONS[selected].kind==='build'){
      const point=renderer.point(event.clientX,event.clientY),fp=WEAPONS[selected].footprint;
      aim={build:true,weaponId:selected,...snapBuild(state,side,point.x-fp.w*14,point.y-fp.h*14)};
    }else aim={build:false,weaponId:selected,angle:side===0?-.5:-Math.PI+.5,power:0,pointer:{x:unit.x+unit.w/2,y:unit.y+unit.h/2}};
    aimUI();
  },
  move(event,{dx,dy,distance}){
    if(!aim)return;
    if(aim.build){
      const p=renderer.point(event.clientX,event.clientY),fp=WEAPONS[selected].footprint;
      Object.assign(aim,snapBuild(state,side,p.x-fp.w*14,p.y-fp.h*14));
    }else{
      const unit=currentUnit(),max=Math.min(135,innerHeight*.3),cap=Math.min(1,max/Math.max(1,distance));
      aim.angle=Math.atan2(-dy,-dx);aim.power=Math.min(1,distance/max);
      aim.pointer={x:unit.x+unit.w/2+dx*cap/renderer.scale,y:unit.y+unit.h/2+dy*cap/renderer.scale};
    }
    $('cancel-aim').classList.toggle('hover',inCancel(event.clientX,event.clientY));aimUI();
  },
  finish(event,{distance}){
    if(inCancel(event.clientX,event.clientY)||(!aim?.build&&distance<6)){cancelAim();return;}
    commitAim();
  },
  cancel:cancelAim,
});
window.addEventListener('blur',cancelAim);document.addEventListener('visibilitychange',()=>{cancelAim();if(standalone&&!document.hidden&&state)renderer.resetEventStream();if(!document.hidden&&session&&socket?.readyState!==Socket.OPEN)connect().catch(()=>{});});
window.addEventListener('keydown',event=>{if(event.key==='Escape'){cancelAim();return;}if(!canAct()||screen!=='game'||document.querySelector('dialog[open]')||['INPUT','BUTTON','TEXTAREA'].includes(document.activeElement.tagName)||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(event.key))return;event.preventDefault();const unit=currentUnit();if(!aim)aim=WEAPONS[selected].kind==='build'?{build:true,weaponId:selected,...initialBuildPosition(selected,unit)}:{build:false,weaponId:selected,angle:side===0?-.5:-Math.PI+.5,power:.65};if(aim.build){const dx=event.key==='ArrowLeft'?-28:event.key==='ArrowRight'?28:0,dy=event.key==='ArrowUp'?-28:event.key==='ArrowDown'?28:0;aim.x+=dx;aim.y+=dy;}else{if(event.key==='ArrowLeft')aim.angle-=.04;if(event.key==='ArrowRight')aim.angle+=.04;if(event.key==='ArrowUp')aim.power=Math.min(1,aim.power+.03);if(event.key==='ArrowDown')aim.power=Math.max(0,aim.power-.03);aim.angle=Math.max(-Math.PI*2,Math.min(Math.PI*2,aim.angle));}if(event.key===' ')keyboardHeld=true;aimUI();});
window.addEventListener('keyup',event=>{if(event.key===' '&&keyboardHeld){event.preventDefault();keyboardHeld=false;commitAim();}});
$('weapon-palette').addEventListener('click',event=>{const button=event.target.closest('[data-weapon]');if(button)chooseWeapon(button.dataset.weapon);});
$('play-ai').addEventListener('click',()=>begin('ai'));$('play-lan').addEventListener('click',()=>{audio.unlock();showScreen('lan');});$('host-room').addEventListener('click',()=>begin(standalone?'ai':'pvp'));
$('join-room').addEventListener('click',()=>{const code=$('room-code').value.trim().toUpperCase();if(!/^[A-Z0-9]{5}$/.test(code)){toast('Enter the five-character code from your friend’s lobby.');$('room-code').focus();return;}audio.unlock();send({type:'join',code,name:playerName()});});$('room-code').addEventListener('input',event=>{event.target.value=event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');});$('room-code').addEventListener('keydown',event=>{if(event.key==='Enter')$('join-room').click();});
$('ready-button').addEventListener('click',()=>{audio.unlock();send({type:'ready',ready:!room?.players[side]?.ready});});
async function leave(){cancelAim();session=null;removeStore('cw-seat',true);setReconnecting(false);clearTimeout(reconnectTimer);if(socket?.readyState===Socket.OPEN)socket.send(JSON.stringify({type:'leave'}));room=null;state=null;matchId=null;pendingAction=null;showScreen('menu');}
$('leave-lobby').addEventListener('click',leave);$('back-menu').addEventListener('click',leave);$('leave-match').addEventListener('click',()=>{$('leave-dialog').showModal();cancelAim();});$('confirm-leave').addEventListener('click',()=>{$('leave-dialog').close();leave();});$('rematch-button').addEventListener('click',()=>send({type:'rematch'}));document.querySelectorAll('[data-back]').forEach(button=>button.addEventListener('click',()=>showScreen('menu')));
$('copy-link').addEventListener('click',async()=>{const url=$('copy-link').dataset.url;try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);}else{const input=document.createElement('textarea');input.value=url;input.style.position='fixed';input.style.opacity='0';document.body.append(input);input.select();const ok=document.execCommand('copy');input.remove();if(!ok)throw Error();}toast('Invite link copied. Send it to your Wi-Fi rival.');}catch{toast(`Invite address: ${url}`,8000);}});
for(const id of ['help-button','how-to-play'])$(id).addEventListener('click',()=>{audio.unlock();cancelAim();$('help-dialog').showModal();});$('settings-button').addEventListener('click',()=>{cancelAim();$('settings-dialog').showModal();});document.querySelectorAll('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));
$('sound-button').addEventListener('click',()=>{settings.sound=!settings.sound;settingsApply();audio.click();});for(const [id,key]of [['sound-toggle','sound'],['motion-toggle','reduced'],['shake-toggle','shake']])$(id).addEventListener('change',event=>{settings[key]=event.target.checked;settingsApply();});
setInterval(updateTimers,100);setInterval(()=>{if(socket?.readyState===Socket.OPEN)socket.send(JSON.stringify({type:'ping',sentAt:Date.now()}));if(pendingAction&&performance.now()-pendingAction.started>3000){toast('Still waiting for the host to confirm your shot…',1800);}},3000);
window.addEventListener('error',event=>{if(['renderer.js','cosmic-effects.js'].some(file=>event.filename?.endsWith(file))){$('fatal-error').classList.remove('hidden');}});
// Read-only coordinates and authoritative snapshot for diagnostics and browser checks.
Object.defineProperty(window,'CastleWars',{value:Object.freeze({getSnapshot:()=>state?structuredClone(state):null,getView:()=>({screen,side,selected,canAct:!!canAct(),scale:renderer.scale,origin:{x:renderer.ox,y:renderer.oy},activeUnit:currentUnit()?renderer.screenPoint(currentUnit().x+currentUnit().w/2,currentUnit().y+currentUnit().h/2):null})}),writable:false});
// The published solo edition keeps a useful multiplayer entry, without trying
// to create a WebSocket room on static hosting. The Node edition stays intact.
if(standalone){
  $('play-lan').querySelector('small').textContent='Requires the LAN edition';
  $('lan-title').textContent='Bring the LAN edition.';
  document.querySelector('.lan-panel > p').textContent='Multiplayer is unavailable on this hosted page. To challenge a friend, run the included Node.js version and open its address on both devices using the same Wi-Fi.';
  $('host-room').innerHTML='<span>Play the computer instead</span><span>↗</span>';
  document.querySelector('.lan-panel .or-divider').classList.add('hidden');
  document.querySelector('.lan-panel .join-row').classList.add('hidden');
  $('room-code').disabled=true;$('join-room').disabled=true;
  document.querySelector('.lan-panel .panel-note').innerHTML='<a href="https://github.com/JoygameMobileTechnology/games/tree/main/castle-wars/source#run">Open LAN hosting instructions ↗</a>';
}
loadHost();const incomingCode=standalone?null:new URLSearchParams(location.search).get('room');if(incomingCode&&!session){$('room-code').value=incomingCode.toUpperCase().slice(0,5);showScreen('lan');toast('Your rival sent a challenge. Enter your call sign and join.',5000);}if(session){setReconnecting(true);reconnectStarted=performance.now();connect().catch(error=>{toast(error.message);});}else connect().catch(()=>{});
