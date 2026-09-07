import { WORLD, ARENA, WEAPONS } from '/shared/content.js';
import { previewTrajectory, validateBuild, getBuildBounds } from '/shared/game.js';
import { ImpactEffects } from './cosmic-effects.js';

const COLORS = ['#418e82', '#d77761'];
const FORTS = [
  { stone:['#cbd6b8','#d8dfc4','#bfd0b0','#d0d9bf'], armor:['#869f87','#95aa90','#a3b397'], edge:'#637f68', shadow:'#456a56', accent:'#358579', dark:'#285c51', light:'#d9e9ae', trim:'#e1cc91' },
  { stone:['#d5a287','#dfb097','#c89179','#d8a68e'], armor:['#8c7970','#a28c7e','#978176'], edge:'#875f51', shadow:'#704b40', accent:'#ba594c', dark:'#723e37', light:'#ffd190', trim:'#e5bb7c' },
];
const clamp = (value,low,high) => Math.max(low,Math.min(high,value));
const TAU = Math.PI*2;
const INK = '#394c45';
const rounded = (ctx,x,y,w,h,r=4) => { ctx.beginPath();ctx.roundRect(x,y,w,h,r); };
const hash = n => { const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x); };

export class ArenaRenderer {
  constructor(canvas, audio) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.audio=audio;
    this.impacts=new ImpactEffects();this.audioSeen=new Set();this.finaleOwned=new Set();
    this.state=null;this.screen='menu';this.side=0;this.aim=null;this.particles=[];this.blasts=[];this.recoils=new Map();this.labels=[];this.seen=new Set();this.shake=0;this.reduced=false;this.shakeEnabled=true;this.scale=1;this.ox=0;this.oy=0;this.previousTime=0;
    this.resize();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);
    requestAnimationFrame(t=>this.frame(t));
  }
  resize(){const r=this.canvas.getBoundingClientRect();this.width=r.width;this.height=r.height;const dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);this.dpr=dpr;this.camera();}
  formationBounds(side=0){
    const bounds=this.state?.formation?.bounds?.[side];
    if(bounds&&[bounds.x,bounds.y,bounds.w,bounds.h].every(Number.isFinite)&&bounds.w>0&&bounds.h>0)return bounds;
    const castle=ARENA.castle;
    return {x:side===0?castle.left:WORLD.width-castle.left-castle.width,y:castle.top,w:castle.width,h:castle.bottom-castle.top};
  }
  camera(){
    const w=Math.max(1,Number(this.width)||1),h=Math.max(1,Number(this.height)||1),compact=h<580,bounds=this.formationBounds();
    if(['menu','lan','lobby'].includes(this.screen)){
      const center=bounds.x+bounds.w/2;
      this.scale=Math.min(w/(bounds.w*3.8),h*.76/(WORLD.groundY-bounds.y+87));
      this.ox=w*.73-center*this.scale;this.oy=h*.82-WORLD.groundY*this.scale;
    }else{
      const ar=document.querySelector('.arsenal')?.getBoundingClientRect();
      const bottom=ar?.height?Math.max(compact?108:151,h-ar.top+9):(compact?108:151);
      const top=compact?66:90,castleTop=Math.min(bounds.y,this.formationBounds(1).y),sceneHeight=Math.max(100,WORLD.groundY-castleTop+87);
      this.scale=Math.min(w/(WORLD.width+30),Math.max(100,h-bottom-top)/sceneHeight);
      this.ox=(w-WORLD.width*this.scale)/2;this.oy=h-bottom-WORLD.groundY*this.scale;
    }
  }
  resetEventStream(){this.skipNextEvents=true;this.audioSeen.clear();this.finaleOwned.clear();this.impacts.reset();this.particles=[];this.blasts=[];this.recoils.clear();this.labels=[];this.shake=0;}
  setState(state,{side=0,screen='game'}={}){
    if(this.state?.matchId!==state?.matchId){this.seen.clear();this.resetEventStream();}
    if(state!==this.state){this.previousState=this.state;this.snapshotAt=performance.now();this.prepareMasonry(state);}this.state=state;this.side=side;this.screen=screen;this.camera();
    if(state&&['game','result'].includes(screen)){
      const skip=this.skipNextEvents;this.skipNextEvents=false;
      // Claim fatal events before reading the ordinary stream. A final snapshot
      // must never play the fast impact first and then restart it in slow motion.
      const finale=state.result?.presentation,finish=finale?.finish,drowning=finale?.drowning;
      if(finish){
        const events=finish.events?.length?finish.events:[finish.event];
        for(const event of [...events,...(finish.deaths||[])])if(event?.id!==undefined)this.finaleOwned.add(event.id);
        this.removeEventEffects(this.finaleOwned);
        if(this.impacts.addFinish(finish,Math.max(0,state.now-finish.at)))this.shake=0;
        if(state.now-finish.at<=200)for(const event of events)if(event)this.soundEvent(event);
      }
      if(drowning){
        for(const death of drowning.deaths||[])if(death.id!==undefined)this.finaleOwned.add(death.id);
        this.removeEventEffects(this.finaleOwned);
        this.impacts.addDrowning(drowning,Math.max(0,state.now-drowning.at));
      }
      // Durable metadata also recovers core sequences after event-log trimming.
      if(finale&&state.now<finale.endsAt)for(const event of [...(finale.explosions||[]),...(finale.cores||[])]){
        if(!this.finaleOwned.has(event.id))this.presentationEvent(event,Math.max(0,state.now-event.at));
      }
      for(const event of state.events||[]){
        if(this.seen.has(event.id))continue;this.seen.add(event.id);
        if(this.finaleOwned.has(event.id))continue;
        if(!skip&&(!Number.isFinite(event.at)||state.now-event.at<=1000))this.event(event,Math.max(0,state.now-(event.at??state.now)));
      }
    }
    if(this.seen.size>1200)this.seen=new Set(Array.from(this.seen).slice(-600));
  }
  point(clientX,clientY){const r=this.canvas.getBoundingClientRect();return {x:(clientX-r.left-this.ox)/this.scale,y:(clientY-r.top-this.oy)/this.scale};}
  screenPoint(x,y){return {x:x*this.scale+this.ox,y:y*this.scale+this.oy};}
  setAim(aim){this.aim=aim;}
  prepareMasonry(state){
    // Only join actual touching bricks; open courtyards and arches stay visibly open.
    const key=(side,x,y)=>`${side}:${Math.round(x*10)}:${Math.round(y*10)}`;
    const tiles=(state?.tiles||[]).filter(tile=>tile.hp>0);
    const occupied=new Set(tiles.map(tile=>key(tile.side??0,tile.x,tile.y)));
    this.masonry=new Map(tiles.map(tile=>[tile.id,{
      left:occupied.has(key(tile.side??0,tile.x-tile.w,tile.y)),
      right:occupied.has(key(tile.side??0,tile.x+tile.w,tile.y)),
      top:occupied.has(key(tile.side??0,tile.x,tile.y-tile.h)),
      bottom:occupied.has(key(tile.side??0,tile.x,tile.y+tile.h)),
    }]));
  }
  removeEventEffects(ids){
    for(const key of ['particles','blasts','labels'])this[key]=this[key].filter(effect=>!ids.has(effect.eventId));
  }
  soundEvent(event){
    if(event.id!==undefined){if(this.audioSeen.has(event.id))return;this.audioSeen.add(event.id);}
    this.audio?.event(event);
    if(this.audioSeen.size>1200)this.audioSeen=new Set(Array.from(this.audioSeen).slice(-600));
  }
  presentationEvent(e,ageMs=0){
    if(!this.impacts.add(e,ageMs))return;
    if(ageMs<=200)this.soundEvent(e);
    if(e.type==='core-destroyed')return;
    if(ageMs<350){
      this.shake=Math.min(12,this.shake+(e.child?2:9));
      if(!e.child&&!(e.pulse>0)){
        this.labels.push({eventId:e.id,x:e.x,y:e.y-100,text:{moon:'MOONSTRUCK!',saturn:'RING IT ON!',star:'SUPERNOVA!'}[e.weaponId],life:1.35,max:1.35,color:e.weaponId==='moon'?'#e5f7fa':'#ffe7b0',size:Math.max(31,36/Math.max(.6,this.scale))});
        if(this.labels.length>7)this.labels.splice(0,this.labels.length-7);
      }
    }
  }
  event(e,ageMs=0){
    // Result music belongs to the UI reveal, after the battlefield finale.
    if(e.type==='result')return;
    if(e.type==='core-destroyed'||e.type==='explosion'&&['moon','saturn','star'].includes(e.weaponId)){this.presentationEvent(e,ageMs);return;}
    this.soundEvent(e);this.effectEventId=e.id;
    const x=e.x??WORLD.width/2,y=e.y??WORLD.height/2;
    if(e.type==='launch'){
      this.recoils.set(e.unitId,{life:.23,side:e.side});
      this.burst(x,y,this.reduced?2:7,['#ffe6a2','#fff2c9','#d7c8a0'],false);
    }
    if(e.type==='explosion'){
      const radius=clamp(Number(e.terrainRadius)||Number(e.radius)||42,20,250),strength=clamp(radius/55,.7,2.5);
      const cosmic=['star','moon','saturn'].includes(e.weaponId),pulse=Number(e.pulse)||0;
      const color=cosmic?'#fff4c7':e.weaponId==='accordion'?'#e9daff':'#ffe4a0';
      // Visual clouds extend beyond the physical blast; damage still uses the server's radius.
      const r=Math.max(65,radius*1.1);
      this.blasts.push({eventId:e.id,x,y,r,life:this.reduced ? .48 : 1.05+strength*.12,max:this.reduced ? .48 : 1.05+strength*.12,color,cosmic,seed:hash(x+y+pulse*7)});
      if(this.blasts.length>12)this.blasts.splice(0,this.blasts.length-12);
      this.shake=Math.min(12,this.shake+(e.child?1.9:3+strength*2));
      this.burst(x,y,this.reduced?5:Math.round(13+strength*7),['#ffd369','#ff9a46','#fff1b7','#e06838'],true,r);
      if(!this.reduced){
        for(let i=0;i<7;i++){
          const a=TAU*i/7+Math.random()*.4,speed=45+Math.random()*75;
          this.particles.push({eventId:e.id,kind:'smoke',x:x+Math.cos(a)*r*.3,y:y+Math.sin(a)*r*.3,vx:Math.cos(a)*speed,vy:-30-Math.random()*45,r:r*(.16+Math.random()*.15),life:1.15+Math.random()*.35,max:1.5,color:i%2?'#766d5c':'#aca184',turn:0});
        }
        for(let i=0;i<5;i++){
          const a=-Math.PI+Math.random()*Math.PI,speed=100+Math.random()*160;
          this.particles.push({eventId:e.id,kind:'chip',x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-30,r:4+Math.random()*5,life:.8+Math.random()*.3,max:1.1,color:FORTS[1-(e.side??0)].stone[i%4],turn:Math.random()*TAU,spin:(Math.random()-.5)*12});
        }
      }
      if(!e.child&&pulse===0){
        this.labels.push({eventId:e.id,x,y:y-r*.7,text:cosmic?['OH, CRUMBS!','ABSURD!','KABOOM!'][Math.floor(hash(x+y)*3)]:['BONK!','KABOOM!','KERPOW!'][Math.floor(hash(x+y)*3)],life:1.1,max:1.1,color:'#ffe5a0',size:Math.max(31,36/Math.max(.6,this.scale))});
      }
    }
    if(e.type==='collapse')this.burst(x,y,this.reduced?3:Math.min(18,7+(e.value||1)),['#b5b9a1','#a3a78f','#e5dfc3'],false);
    if(e.type==='death'){this.burst(x,y,7,['#f6eed4','#fff7df'],false);this.labels.push({eventId:e.id,x,y:y-10,text:'OOPS.',life:1.1,max:1.1,color:'#fff5d7',size:25});}
    if(e.type==='plop'){this.burst(x,y,this.reduced?3:12,['#7dc3d4','#c6f1ef','#4b9cbe'],false);this.labels.push({eventId:e.id,x,y:y-12,text:'plop.',life:1.1,max:1.1,color:'#d9f5ed',size:26});}
    if(e.type==='build'){this.burst(x,y,10,['#e0c886','#8ead75','#fff1c0'],false);this.labels.push({eventId:e.id,x,y:y-12,text:'TA-DA!',life:1,max:1,color:'#e6efa9',size:28});}
    if(this.labels.length>7)this.labels.splice(0,this.labels.length-7);
    if(this.particles.length>300)this.particles.splice(0,this.particles.length-300);
  }
  burst(x,y,n,colors,hot,radius=60){
    for(let i=0;i<n;i++){
      const a=Math.random()*TAU,speed=this.reduced?10:40+Math.random()*(hot?180+radius:90);
      this.particles.push({eventId:this.effectEventId,kind:hot?'spark':'dust',x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-30,r:hot?2+Math.random()*4:3+Math.random()*6,life:.45+Math.random()*.5,max:1,color:colors[i%colors.length]});
    }
    if(this.particles.length>300)this.particles.splice(0,this.particles.length-300);
  }
  effects(dt){
    const c=this.ctx;
    for(const [id,recoil]of this.recoils){recoil.life-=dt;if(recoil.life<=0)this.recoils.delete(id);}
    for(const p of this.particles){
      p.life-=dt;
      if(!this.reduced){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.kind==='smoke'?-10:210)*dt;}
      if(p.kind!=='smoke')continue;
      const age=1-p.life/p.max;
      c.globalAlpha=Math.max(0,Math.sin(age*Math.PI)*.46);c.fillStyle=p.color;
      c.beginPath();c.arc(p.x,p.y,p.r*(.65+age*1.5),0,TAU);c.fill();
    }
    c.globalAlpha=1;
    for(const b of this.blasts){
      b.life-=dt;const age=b.max-b.life;
      c.save();c.translate(b.x,b.y);
      if(this.reduced){
        c.globalAlpha=Math.max(0,b.life/b.max)*.65;c.fillStyle=b.color;c.beginPath();c.arc(0,0,b.r*.7,0,TAU);c.fill();c.restore();continue;
      }
      // Local impact light and a single expanding pressure ring, never a full-screen strobe.
      if(age<.42){
        const ring=clamp(age/.42,0,1),r=b.r*(.25+ring*1.5);
        c.globalAlpha=(1-ring)*.85;c.strokeStyle=b.cosmic?'#fff9d4':'#ffe8a9';c.lineWidth=3+9*(1-ring);
        c.beginPath();c.ellipse(0,0,r,r*.83,0,0,TAU);c.stroke();
      }
      if(age<.58){
        const rise=clamp(age/.08,0,1),fade=clamp(1-(age-.16)/.42,0,1),r=b.r*(.3+rise*.65);
        c.globalAlpha=fade;
        for(let i=0;i<8;i++){
          const a=TAU*i/8+b.seed,ripple=1+Math.sin(i*9+b.seed)*.14;
          c.fillStyle=i%2?'#e77937':'#d26034';c.beginPath();c.arc(Math.cos(a)*r*.53,Math.sin(a)*r*.53,r*.45*ripple,0,TAU);c.fill();
        }
        const glow=c.createRadialGradient(0,-r*.08,0,0,0,r*.96);
        glow.addColorStop(0,'#fff9d7');glow.addColorStop(.3,b.color);glow.addColorStop(.6,'#ffc05d');glow.addColorStop(1,'#f68c3e00');
        c.fillStyle=glow;c.beginPath();c.arc(0,0,r,0,TAU);c.fill();
        for(let i=0;i<6;i++){
          const a=TAU*i/6+b.seed;
          c.fillStyle=i%2?'#ffcd68':'#ffdf8b';c.beginPath();c.arc(Math.cos(a)*r*.4,Math.sin(a)*r*.4,r*.25,0,TAU);c.fill();
        }
        if(age<.09){c.globalAlpha=(1-age/.09)*.95;c.fillStyle='#fffdeb';c.beginPath();c.arc(0,0,r*.65,0,TAU);c.fill();}
      }
      c.restore();
    }
    this.blasts=this.blasts.filter(b=>b.life>0);
    for(const p of this.particles){
      if(p.kind==='smoke'||p.life<=0)continue;
      c.globalAlpha=clamp(p.life/p.max,0,1);c.fillStyle=p.color;
      if(p.kind==='spark'&&!this.reduced){
        c.strokeStyle=p.color;c.lineWidth=p.r;c.lineCap='round';c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-p.vx*.033,p.y-p.vy*.033);c.stroke();
      }else if(p.kind==='chip'){
        c.save();c.translate(p.x,p.y);p.turn+=(p.spin||0)*dt;c.rotate(p.turn);c.fillRect(-p.r,-p.r*.65,p.r*2,p.r*1.3);c.fillStyle='#fff3d766';c.fillRect(-p.r,-p.r*.65,p.r*2,2);c.restore();
      }else{c.beginPath();c.arc(p.x,p.y,Math.max(1,p.r*(.5+p.life)),0,TAU);c.fill();}
    }
    this.particles=this.particles.filter(p=>p.life>0);c.globalAlpha=1;c.lineCap='butt';
  }
  frame(t){const dt=Math.min(.04,(t-this.previousTime)/1000||.016);this.previousTime=t;this.draw(t,dt);requestAnimationFrame(tt=>this.frame(tt));}
  background(t){const c=this.ctx,w=this.width,h=this.height;c.fillStyle='#d5ebec';c.fillRect(0,0,w,h);
    const grad=c.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#c6e4eb');grad.addColorStop(.68,'#e4edce');grad.addColorStop(1,'#e6e6bc');c.fillStyle=grad;c.fillRect(0,0,w,h);
    c.fillStyle='#f9f2c9';c.beginPath();c.arc(w*.78,h*.23,Math.min(w,h)*.086,0,Math.PI*2);c.fill();c.fillStyle='#f5efce70';c.beginPath();c.arc(w*.78,h*.23,Math.min(w,h)*.11,0,Math.PI*2);c.fill();
    const drift=this.reduced?0:t*.0015;for(let i=0;i<8;i++){let x=(w*(hash(i+2)*1.5)-w*.2+drift*(.4+hash(i)))%(w*1.4);const y=h*(.09+hash(i+31)*.27);this.cloud(x,y,(.4+hash(i+72)*.8)*Math.min(w/1100,1.4));}
    this.ridge('#b7d6bd',h*.63,0.07,12);this.ridge('#a5c7a5',h*.76,.075,65);this.ridge('#93b393',h*.87,.045,32);
    const menu=['menu','lan','lobby'].includes(this.screen);const gy=menu?h*.78:this.oy+WORLD.groundY*this.scale;
    c.fillStyle='#a3b979';c.beginPath();c.moveTo(0,gy+38);for(let x=0;x<=w;x+=32)c.lineTo(x,gy+30+Math.sin(x*.005)*16);c.lineTo(w,h);c.lineTo(0,h);c.fill();
    c.fillStyle='#90a76b';for(let i=0;i<25;i++){const x=hash(i+81)*w,y=gy+55+hash(i+25)*100; c.beginPath();c.ellipse(x,y,10+hash(i)*35,2+hash(i+1)*6,0,0,Math.PI*2);c.fill();}
    for(let i=0;i<16;i++){const x=hash(i+330)*w,y=gy+35+hash(i+202)*60;c.strokeStyle='#789861';c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x-3,y-6);c.moveTo(x,y);c.lineTo(x+2,y-9);c.stroke();}
    c.fillStyle='#fff8dbb0';for(let i=0;i<8;i++){const x=w*hash(i+770),y=h*(.1+hash(i+441)*.57);c.beginPath();c.arc(x,y,1.5,0,Math.PI*2);c.fill();}
  }
  cloud(x,y,s){const c=this.ctx;c.save();c.translate(x,y);c.scale(s,s);c.fillStyle='#fffcecaa';c.beginPath();c.moveTo(-60,15);c.bezierCurveTo(-88,15,-76,-10,-54,-8);c.bezierCurveTo(-54,-43,-6,-42,2,-20);c.bezierCurveTo(25,-48,64,-18,48,-6);c.bezierCurveTo(79,-5,79,17,51,18);c.closePath();c.fill();c.restore();}
  ridge(color,base,amp,seed){const c=this.ctx,w=this.width,h=this.height;c.beginPath();c.moveTo(0,h);c.lineTo(0,base);for(let i=0;i<9;i++){const x=i*w/7;c.quadraticCurveTo(x-w/15,base-h*(amp+hash(seed+i)*amp),x+w/14,base+(hash(seed+i+20)-.5)*h*.05);}c.lineTo(w,h);c.closePath();c.fillStyle=color;c.fill();}
  draw(t,dt){const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);this.background(t);if(!this.state)return;const s=this.state;const menu=['menu','lan','lobby'].includes(this.screen);c.save();let sx=0,sy=0;const wallNow=performance.now();let impactShake=this.shake;for(const impact of this.impacts.items){const age=(wallNow-impact.started)/1000;if(impact.finish){const progress=(wallNow-impact.started)/impact.duration;if(progress<.65)impactShake=Math.max(impactShake,5*(1-progress/.65));}if(impact.kind==='core'&&age>=.58&&age<1.08)impactShake=Math.max(impactShake,12*(1-(age-.58)/.5));}if(impactShake>0&&!this.reduced&&this.shakeEnabled){sx=Math.sin(t*2.31)*impactShake*.5;sy=Math.cos(t*1.83)*impactShake*.32;}this.shake=Math.max(0,this.shake-dt*18);c.translate(this.ox+sx,this.oy+sy);c.scale(this.scale,this.scale);
    this.drawGround(menu);
    for(const side of menu?[0]:[0,1])this.castleDecor(s,side,t);
    for(const tile of s.tiles||[])if(!menu||tile.side===0)this.tile(tile);
    for(const team of s.teams||[]){if(menu&&team.side!==0)continue;this.core(team.core,team.side,t);for(const unit of team.units)if(unit.alive)this.shooter(unit,team.side,s.activeUnitId===unit.id&&!menu&&!s.result,t,menu);}
    const rebounds=[];
    if(!menu){const blend=Math.min(1,(t-(this.snapshotAt||t))/100);for(const p of s.projectiles||[]){const old=this.previousState?.matchId===s.matchId?this.previousState.projectiles?.find(v=>v.id===p.id):null;const rendered=old?{...p,x:old.x+(p.x-old.x)*blend,y:old.y+(p.y-old.y)*blend}:p;if(p.rebound)rebounds.push(rendered);else this.projectile(rendered,t);}this.aimGuide(s,t);this.water(s,t);}
    this.effects(dt);
    this.impacts.draw(c,wallNow,this.reduced);
    for(const label of this.labels){label.life-=dt;if(!this.reduced)label.y-=dt*28;c.save();c.globalAlpha=clamp(label.life*3,0,1);c.translate(label.x,label.y);c.rotate(-.1);c.font=`900 ${label.size}px ui-rounded,system-ui`;c.textAlign='center';c.lineJoin='round';c.strokeStyle=INK;c.lineWidth=5;c.strokeText(label.text,0,0);c.fillStyle=label.color;c.fillText(label.text,0,0);c.restore();}this.labels=this.labels.filter(l=>l.life>0);
    // A short anvil hop sits inside its first fireball. Keep the live rebound
    // visible above that cloud while ordinary projectiles retain their layer.
    for(const projectile of rebounds)this.projectile(projectile,t);
    c.restore();
    if(!menu)this.offscreenProjectiles(s);
  }
  offscreenProjectiles(s){
    const above=(s.projectiles||[]).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&this.screenPoint(p.x,p.y).y+Math.max((p.r||6)*this.scale,3.1)*2.6<0);
    if(!above.length)return;
    const c=this.ctx,canvas=this.canvas.getBoundingClientRect();
    const arsenal=document.querySelector('.arsenal')?.getBoundingClientRect();
    const left=arsenal?.width?arsenal.left-canvas.left+10:20,right=arsenal?.width?arsenal.right-canvas.left-10:this.width-20;
    const obstacles=['.match-hud','.utility-bar','#wind-meter','.turn-callout'].map(selector=>document.querySelector(selector)?.getBoundingClientRect()).filter(rect=>rect?.height);
    const markers=[];
    for(const p of above){
      const x=clamp(this.screenPoint(p.x,p.y).x,left,right);
      if(markers.some(marker=>Math.abs(marker-x)<25))continue;
      markers.push(x);if(markers.length>6)break;
      let y=20;
      for(const rect of obstacles)if(x>=rect.left-canvas.left-14&&x<=rect.right-canvas.left+14)y=Math.max(y,rect.bottom-canvas.top+14);
      y=Math.min(y,(arsenal?.height?arsenal.top-canvas.top:this.height)-16);
      // This marker follows a live rocket above the screen; it reveals no future path.
      c.save();c.translate(x,y);c.fillStyle='#fff8e7ee';c.strokeStyle=FORTS[p.side??0].dark;c.lineWidth=1.4;
      c.beginPath();c.arc(0,0,9.5,0,TAU);c.fill();c.stroke();
      c.fillStyle=COLORS[p.side??0];c.beginPath();c.moveTo(0,-7);c.lineTo(4,-1);c.lineTo(2,-1);c.lineTo(2,4);c.lineTo(-2,4);c.lineTo(-2,-1);c.lineTo(-4,-1);c.closePath();c.fill();
      c.fillStyle='#e6a348';c.beginPath();c.moveTo(-2,5);c.lineTo(0,8);c.lineTo(2,5);c.closePath();c.fill();c.restore();
    }
  }
  drawGround(menu){
    const c=this.ctx,gy=WORLD.groundY;
    for(const side of [0,1]){
      if(menu&&side!==0)continue;
      const bounds=this.formationBounds(side),island=this.state?.formation?.islands?.[side]||{left:bounds.x-50,right:bounds.x+bounds.w+50};
      const {left:x,right:end}=island,fort=FORTS[side];
      c.fillStyle=fort.shadow;c.beginPath();c.moveTo(x,gy+2);c.lineTo(end,gy+2);c.lineTo(end-28,gy+42);c.lineTo(end-80,gy+64);c.lineTo(x+45,gy+55);c.lineTo(x-15,gy+28);c.closePath();c.fill();
      c.fillStyle=side===0?'#c3b484':'#b89877';c.beginPath();c.moveTo(x+8,gy+10);c.lineTo(end-9,gy+10);c.lineTo(end-33,gy+35);c.lineTo(end-83,gy+53);c.lineTo(x+48,gy+46);c.lineTo(x+2,gy+27);c.closePath();c.fill();
      c.fillStyle=side===0?'#7c9b5c':'#aa8f63';rounded(c,x-5,gy-6,end-x+10,14,5);c.fill();c.fillStyle=side===0?'#b2c978':'#d2b680';rounded(c,x-3,gy-9,end-x+6,6,3);c.fill();
      for(let i=0;i<13;i++){const xx=x+hash(i+x)*(end-x),yy=gy+14+hash(i+end)*24;c.strokeStyle=fort.edge;c.lineWidth=2;c.beginPath();c.moveTo(xx,yy);c.lineTo(xx+9,yy+1);c.stroke();}
    }
  }
  crest(side,x,y,size=16){
    const c=this.ctx;c.save();c.translate(x,y);c.scale(size/16,size/16);c.fillStyle=side===0?'#e6ecc0':'#ffe2a0';c.strokeStyle=c.fillStyle;c.lineWidth=1.8;
    if(side===0){
      c.beginPath();c.moveTo(-7,8);c.bezierCurveTo(-14,-3,-3,-8,8,-11);c.bezierCurveTo(10,1,3,12,-7,8);c.fill();c.strokeStyle=FORTS[side].accent;c.lineWidth=1.4;c.beginPath();c.moveTo(-9,10);c.lineTo(5,-6);c.moveTo(-4,4);c.lineTo(-5,-3);c.moveTo(-1,0);c.lineTo(5,1);c.stroke();
    }else{
      c.beginPath();c.moveTo(0,-12);c.bezierCurveTo(1,-4,13,0,7,9);c.bezierCurveTo(4,14,-7,12,-9,7);c.bezierCurveTo(-13,0,-5,-5,-5,-7);c.lineTo(-4,3);c.bezierCurveTo(0,0,-1,-5,0,-12);c.fill();c.fillStyle=FORTS[side].accent;c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(7,8,0,10);c.quadraticCurveTo(-5,8,0,0);c.fill();
    }
    c.restore();
  }
  castleDecor(s,side,t){
    const flags=s.formation?.flags?.filter(flag=>flag.side===side)||[{side,...ARENA.flags[side]}];
    for(const flag of flags)this.flag(s,side,flag,t);
  }
  flag(s,side,flag,t){
    const c=this.ctx,fort=FORTS[side],x=flag.x;
    if(!Number.isFinite(x))return;
    const near=(s.tiles||[]).filter(v=>v.side===side&&v.hp>0&&x>=v.x-7&&x<=v.x+v.w+7);
    if(!near.length)return;
    const top=Math.min(...near.map(v=>v.y)),direction=side===0?1:-1;
    const wind=s.wind?.level||0,flutter=this.reduced?0:Math.sin(t*(.003+Math.abs(wind)*.00025)+side)*3;
    c.strokeStyle=fort.dark;c.lineWidth=4;c.beginPath();c.moveTo(x,top+4);c.lineTo(x,top-77);c.stroke();
    c.fillStyle=fort.trim;c.beginPath();c.arc(x,top-80,5,0,TAU);c.fill();
    c.save();c.translate(x,top-75);c.scale(direction,1);c.fillStyle=fort.accent;c.strokeStyle=fort.dark;c.lineWidth=1.8;
    c.beginPath();c.moveTo(2,0);c.quadraticCurveTo(32,-6+flutter,67,3);c.lineTo(58,24);c.lineTo(66,42);c.quadraticCurveTo(31,33-flutter,2,38);c.closePath();c.fill();c.stroke();
    c.strokeStyle=fort.trim;c.lineWidth=3;c.beginPath();c.moveTo(5,3);c.quadraticCurveTo(30,-2+flutter,61,6);c.stroke();c.restore();
    this.crest(side,x+direction*29,top-55,15);
  }
  tile(tile){
    if(tile.hp<=0)return;
    const c=this.ctx,{x,y,w,h}=tile,fort=FORTS[tile.side??0],side=tile.side??0;
    if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)return;
    const seed=typeof tile.id==='number'?tile.id:tile.id.split('').reduce((a,b)=>a+b.charCodeAt(0),0);
    const wood=['wood','platform','scaffold','bridge'].includes(tile.material),patched=tile.material==='terrain';
    const steel=['reinforced','armor','steel'].includes(tile.material),colors=steel?fort.armor:fort.stone;
    c.fillStyle=wood?(side===0?'#b39b68':'#b58262'):colors[Math.floor(hash(seed)*colors.length)];c.strokeStyle=wood?'#816344':fort.edge;c.lineWidth=1.7;
    const neighbors=this.masonry?.get(tile.id)||{};
    if(wood){rounded(c,x+1,y+1,w-2,h-2,2);c.fill();c.stroke();}
    else{
      const r=side===0?3:1.5;
      c.beginPath();c.roundRect(x,y,w,h,[!neighbors.top&&!neighbors.left?r:0,!neighbors.top&&!neighbors.right?r:0,!neighbors.bottom&&!neighbors.right?r:0,!neighbors.bottom&&!neighbors.left?r:0]);c.fill();
      c.strokeStyle=fort.edge+'65';c.lineWidth=.8;c.strokeRect(x+.4,y+.4,w-.8,h-.8);
      c.strokeStyle=fort.edge;c.lineWidth=2;c.beginPath();
      if(!neighbors.top){c.moveTo(x+1,y+1);c.lineTo(x+w-1,y+1);}
      if(!neighbors.bottom){c.moveTo(x+1,y+h-1);c.lineTo(x+w-1,y+h-1);}
      if(!neighbors.left){c.moveTo(x+1,y+1);c.lineTo(x+1,y+h-1);}
      if(!neighbors.right){c.moveTo(x+w-1,y+1);c.lineTo(x+w-1,y+h-1);}
      c.stroke();
    }
    c.strokeStyle=side===0?'#eff3d299':'#ffe1b299';c.lineWidth=2;c.beginPath();c.moveTo(x+5,y+4);c.lineTo(x+w-5,y+4);c.stroke();
    c.fillStyle=fort.shadow+'35';c.fillRect(x+3,y+h-5,w-6,3);
    if(steel){
      if(side===1){c.fillStyle='#665953';c.fillRect(x+3,y+h*.42,w-6,5);c.fillStyle='#d6b387';for(const dx of [6,w-6]){c.beginPath();c.arc(x+dx,y+h*.42+2.5,1.5,0,TAU);c.fill();}}
      else{c.strokeStyle='#627b62';c.lineWidth=2;c.beginPath();c.moveTo(x+6,y+5);c.lineTo(x+6,y+h-6);c.moveTo(x+w-6,y+5);c.lineTo(x+w-6,y+h-6);c.stroke();c.fillStyle='#d2d6ac';for(const dx of [6,w-6]){c.beginPath();c.arc(x+dx,y+7,1.3,0,TAU);c.fill();}}
    }else if(!wood&&!patched){
      if(neighbors.left&&neighbors.right&&neighbors.top&&neighbors.bottom&&hash(seed+24)>.79){
        // A shallow carved arrow slit on solid masonry, never painted over a firing gap.
        c.fillStyle=fort.dark+'99';rounded(c,x+w/2-2.5,y+7,5,h-13,2);c.fill();c.fillStyle=fort.light+'80';c.fillRect(x+w/2+2.5,y+9,1,h-16);
      }
      if(side===0&&hash(seed+11)>.73){
        // Moss and leaves stay within the tile silhouette and disappear with its masonry.
        c.strokeStyle='#6e935c';c.lineWidth=2;c.beginPath();c.moveTo(x+w-5,y+4);c.quadraticCurveTo(x+w-13,y+12,x+w-7,y+h-4);c.stroke();c.fillStyle='#88ab6c';
        for(let i=0;i<3;i++){c.beginPath();c.ellipse(x+w-8+(i%2?3:-2),y+7+i*6,4,2,i%2?-.5:.5,0,TAU);c.fill();}
      }
      if(side===1&&hash(seed+7)>.66){c.strokeStyle='#a5755f';c.lineWidth=1;c.beginPath();c.moveTo(x+w*.45,y+6);c.lineTo(x+w*.45,y+h-5);c.moveTo(x+4,y+h*.52);c.lineTo(x+w-5,y+h*.52);c.stroke();}
    }
    if(wood){
      c.strokeStyle='#795c424f';c.lineWidth=1.2;c.beginPath();c.moveTo(x+5,y+10);c.lineTo(x+w-6,y+11);c.moveTo(x+7,y+18);c.lineTo(x+w-4,y+17);c.stroke();c.fillStyle=fort.accent;c.fillRect(x+5,y+3,4,h-6);c.fillStyle='#e4c48c';c.fillRect(x+6,y+5,2,2);c.fillRect(x+6,y+h-7,2,2);
    }
    if(patched){c.strokeStyle=fort.accent;c.lineWidth=3;c.beginPath();c.moveTo(x+7,y+8);c.lineTo(x+w-7,y+h-8);c.moveTo(x+w-7,y+8);c.lineTo(x+7,y+h-8);c.stroke();}
    const ratio=tile.hp/tile.maxHp;
    if(ratio<.8){c.strokeStyle=fort.dark;c.lineWidth=ratio<.35?2.5:1.5;c.beginPath();c.moveTo(x+w*.6,y+3);c.lineTo(x+w*.4,y+h*.4);c.lineTo(x+w*.64,y+h*.57);c.lineTo(x+w*.4,y+h-3);if(ratio<.4){c.moveTo(x+w*.4,y+h*.4);c.lineTo(x+3,y+h*.55);}c.stroke();}
  }
  core(core,side,t){if(!core||core.hp<=0)return;const c=this.ctx;const x=core.x+core.w/2,y=core.y+core.h/2;const pulse=this.reduced?1:1+Math.sin(t*.003)*.05;c.save();c.translate(x,y);c.fillStyle='#efc86725';c.beginPath();c.arc(0,0,core.w*.8*pulse,0,7);c.fill();c.fillStyle=FORTS[side].dark;rounded(c,-core.w/2,-core.h/2,core.w,core.h,8);c.fill();c.strokeStyle=FORTS[side].trim;c.lineWidth=3;c.stroke();c.fillStyle='#f3c659';c.beginPath();c.moveTo(0,-core.h*.33);c.lineTo(core.w*.3,0);c.lineTo(0,core.h*.3);c.lineTo(-core.w*.3,0);c.closePath();c.fill();c.fillStyle='#fff0a6';c.beginPath();c.moveTo(0,-core.h*.25);c.lineTo(core.w*.19,0);c.lineTo(0,core.h*.2);c.closePath();c.fill();c.fillStyle='#dfaa41';c.beginPath();c.arc(0,0,3,0,7);c.fill();if(core.hp<core.maxHp){c.fillStyle='#334c4280';rounded(c,-core.w/2,core.h/2+5,core.w,5,2);c.fill();c.fillStyle='#f4c856';rounded(c,-core.w/2,core.h/2+5,core.w*Math.max(0,core.hp/core.maxHp),5,2);c.fill();}c.restore();}
  shooter(unit,side,active,t,menu){const c=this.ctx;const x=unit.x+unit.w/2,y=unit.y+unit.h;const facing=side===0?1:-1;const aim=active?this.aim:null;const recoil=this.recoils.get(unit.id);c.save();c.translate(x,y);if(recoil&&!this.reduced)c.translate(-facing*Math.sin(recoil.life/.23*Math.PI)*7,2*Math.sin(recoil.life/.23*Math.PI));
    if(active){const radius=Math.max(26,22/this.scale)+(this.reduced?0:Math.sin(t*.006)*2);c.strokeStyle=side===this.side?'#fff8d0':'#d8816970';c.fillStyle=side===this.side?'#ffefbd44':'#d8816918';c.lineWidth=2.5;c.beginPath();c.arc(0,-unit.h/2,radius,0,7);c.fill();c.stroke();if(side===this.side&&!aim){c.fillStyle='#f4c451';c.strokeStyle='#567061';c.lineWidth=1.8;c.beginPath();c.moveTo(-8,-unit.h-17);c.lineTo(8,-unit.h-17);c.lineTo(0,-unit.h-8);c.closePath();c.fill();c.stroke();}}
    c.fillStyle='#405f4e30';c.beginPath();c.ellipse(0,1,19,5,0,0,7);c.fill();c.fillStyle='#344e45';rounded(c,-12,-7,10,7,3);c.fill();rounded(c,2,-7,10,7,3);c.fill();c.fillStyle=COLORS[side];c.strokeStyle='#35584f';c.lineWidth=1.5;rounded(c,-12,-24,24,21,7);c.fill();c.stroke();this.crest(side,0,-15,6);c.fillStyle='#e1b27d';c.strokeStyle='#7c7054';c.lineWidth=1.2;rounded(c,-11,-35,23,19,8);c.fill();c.stroke();c.fillStyle='#2d4c42';const eye=facing===1?5:-5;c.beginPath();c.arc(eye,-27,2,0,7);c.fill();c.strokeStyle='#856444';c.lineWidth=1.3;c.beginPath();c.moveTo(eye-2,-21);c.quadraticCurveTo(eye+1,-19,eye+4,-21);c.stroke();
    c.fillStyle=side===0?'#4b8478':'#b96456';c.strokeStyle='#36574e';c.lineWidth=1.5;c.beginPath();c.ellipse(0,-36,15,11,0,Math.PI,0);c.lineTo(15,-33);c.lineTo(-15,-33);c.closePath();c.fill();c.stroke();c.strokeStyle='#efedc278';c.beginPath();c.moveTo(-9,-41);c.quadraticCurveTo(-4,-46,3,-44);c.stroke();c.fillStyle='#e7dba2';if(side===0){c.beginPath();c.ellipse(0,-46,4,9,.5,0,TAU);c.fill();}else{rounded(c,-2,-47,5,14,2);c.fill();c.fillStyle='#df9068';c.beginPath();c.moveTo(-3,-45);c.lineTo(9,-51);c.lineTo(6,-37);c.closePath();c.fill();}
    const a=aim&&!aim.build?aim.angle:(side===0?-.32:Math.PI+.32);c.save();c.translate(0,-22);c.rotate(a);c.fillStyle='#536b58';c.strokeStyle='#2f5145';c.lineWidth=1.7;rounded(c,4,-6,28,11,3);c.fill();c.stroke();c.fillStyle='#bdc3a4';c.fillRect(27,-7,7,13);c.fillStyle='#344b41';c.fillRect(32,-4,3,7);c.restore();c.fillStyle='#e5bc8c';c.beginPath();c.arc(facing*9,-20,4,0,7);c.fill();
    if(unit.hp<unit.maxHp){c.fillStyle='#4b615550';rounded(c,-16,7,32,4,2);c.fill();c.fillStyle=COLORS[side];rounded(c,-16,7,32*Math.max(0,unit.hp/unit.maxHp),4,2);c.fill();}c.restore();
  }
  projectile(p,t){
    const c=this.ctx,weapon=WEAPONS[p.weaponId]||{};
    if(p.rebound&&!this.reduced){c.save();c.strokeStyle='#49665d99';c.lineWidth=Math.max(1,1/this.scale);c.setLineDash([4,5]);c.beginPath();c.moveTo(p.rebound.x,p.rebound.y);c.lineTo(p.x,p.y);c.stroke();c.restore();}
    c.save();c.translate(p.x,p.y);c.rotate(Math.atan2(p.vy,p.vx));
    // Keep rockets legible at landscape phone scale without changing their collision body.
    const r=Math.max(p.r||6,3.1/this.scale);
    if(!this.reduced){
      for(let i=5;i>=0;i--){c.globalAlpha=.12*(1-i/7);c.fillStyle='#f8ebce';c.beginPath();c.arc(-r*(2.8+i*.85),Math.sin(i*1.3+t*.007)*r*.25,r*(.6+i*.16),0,TAU);c.fill();}c.globalAlpha=1;
    }
    c.fillStyle='#ef9651';c.beginPath();c.moveTo(-r*1.4,-r*.75);c.lineTo(-r*(this.reduced?3.2:3.8+Math.sin(t*.09)*.55),0);c.lineTo(-r*1.4,r*.75);c.closePath();c.fill();
    c.fillStyle='#fff0b3';c.beginPath();c.moveTo(-r*1.4,-r*.4);c.lineTo(-r*2.8,0);c.lineTo(-r*1.4,r*.4);c.closePath();c.fill();
    c.strokeStyle=INK;c.lineWidth=2;c.fillStyle=weapon.color||'#ce6855';
    if(p.weaponId==='star'){
      c.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,d=i%2?r*.75:r*1.6;i?c.lineTo(Math.cos(a)*d,Math.sin(a)*d):c.moveTo(Math.cos(a)*d,Math.sin(a)*d);}c.closePath();c.fill();c.stroke();
      c.fillStyle='#fff9d4';c.beginPath();c.arc(0,0,r*.5,0,TAU);c.fill();
    }else if(['moon','saturn'].includes(p.weaponId)){
      c.beginPath();c.arc(0,0,r*1.6,0,TAU);c.fill();c.stroke();c.fillStyle='#82918370';c.beginPath();c.arc(r*.25,-r*.3,r*.25,0,TAU);c.arc(r*.35,r*.6,r*.32,0,TAU);c.arc(-r*.7,-r*.4,r*.4,0,TAU);c.fill();
      if(p.weaponId==='saturn'){c.strokeStyle='#f7ddb1';c.lineWidth=r*.35;c.beginPath();c.ellipse(0,0,r*2.6,r*.7,-.35,0,TAU);c.stroke();c.strokeStyle='#7f6d57';c.lineWidth=1.6;c.stroke();}
    }else if(p.weaponId==='anvil'){
      c.beginPath();c.moveTo(-r*1.6,-r);c.lineTo(r*1.5,-r);c.lineTo(r*.7,0);c.lineTo(r*.4,0);c.lineTo(r*.4,r*.8);c.lineTo(r*1.3,r*1.2);c.lineTo(-r*1.3,r*1.2);c.lineTo(-r*.4,r*.8);c.lineTo(-r*.4,0);c.lineTo(-r,0);c.closePath();c.fill();c.stroke();
    }else{
      rounded(c,-r*1.5,-r,r*3,r*2,r*.7);c.fill();c.stroke();c.fillStyle='#f3ebc5';c.beginPath();c.moveTo(r*.7,-r);c.lineTo(r*2.1,0);c.lineTo(r*.7,r);c.closePath();c.fill();c.stroke();c.fillStyle=COLORS[p.side??0];c.fillRect(-r*.8,-r*.85,r*.65,r*1.7);
    }
    c.restore();
  }
  aimGuide(s,t){const aim=this.aim;if(!aim)return;const c=this.ctx;const unit=s.teams.flatMap(t=>t.units).find(u=>u.id===s.activeUnitId);if(!unit)return;
    if(aim.build){const w=WEAPONS[aim.weaponId];const fp=w.footprint||{w:3,h:1};const valid=validateBuild(s,this.side,aim.weaponId,aim.x,aim.y),bounds=getBuildBounds(s,this.side);c.save();c.strokeStyle='#eff6da99';c.lineWidth=Math.max(1,1/this.scale);c.setLineDash([10,8]);c.strokeRect(bounds.x,bounds.y,bounds.w,bounds.h);c.fillStyle=valid.ok?'#8dbb8b80':'#dc806f70';c.strokeStyle=valid.ok?'#337c71':'#c86552';c.lineWidth=2;c.setLineDash([6,4]);const ww=fp.w*WORLD.tileSize,hh=fp.h*WORLD.tileSize;for(let iy=0;iy<fp.h;iy++)for(let ix=0;ix<fp.w;ix++){rounded(c,aim.x+ix*WORLD.tileSize,aim.y+iy*WORLD.tileSize,WORLD.tileSize,WORLD.tileSize,3);c.fill();c.stroke();}c.setLineDash([]);c.font='800 14px system-ui';c.textAlign='center';c.fillStyle=valid.ok?'#2e6a58':'#a63e30';c.fillText(valid.ok?'RELEASE TO BUILD':({OCCUPIED:'SPOT OCCUPIED',OUTSIDE_BATTLEFIELD:'STAY INSIDE THE BATTLEFIELD',OUTSIDE_BUILD_REGION:'STAY INSIDE YOUR CASTLE',UNDERWATER:'ABOVE WATER ONLY'}[valid.reason]||'CHOOSE AN EMPTY SPOT'),aim.x+ww/2,aim.y-13);c.restore();return;}
    if(!this.guideCache||t-this.guideCache.time>40||this.guideCache.unit!==unit.id||this.guideCache.weapon!==aim.weaponId){this.guideCache={time:t,unit:unit.id,weapon:aim.weaponId,points:previewTrajectory(s,unit.id,aim.weaponId,aim.angle,aim.power)||[]};}const points=this.guideCache.points;c.fillStyle='#fffbe2';c.strokeStyle='#657e6960';c.lineWidth=1;points.forEach((p,i)=>{c.globalAlpha=1-i/Math.max(1,points.length)*.65;c.beginPath();c.arc(p.x,p.y,Math.max(2,4-i*.12),0,7);c.fill();c.stroke();});c.globalAlpha=1;
    const ux=unit.x+unit.w/2,uy=unit.y+unit.h/2;if(aim.pointer){c.strokeStyle='#fff5c9';c.lineWidth=3;c.setLineDash([6,5]);c.beginPath();c.moveTo(ux,uy);c.lineTo(aim.pointer.x,aim.pointer.y);c.stroke();c.setLineDash([]);c.fillStyle='#f5c563';c.strokeStyle='#3b6251';c.lineWidth=2;c.beginPath();c.arc(aim.pointer.x,aim.pointer.y,9,0,7);c.fill();c.stroke();}}
  water(s,t){if(!s.suddenDeath&&(!Number.isFinite(s.waterY)||s.waterY>WORLD.height))return;const c=this.ctx,y=s.waterY;if(!Number.isFinite(y))return;c.save();c.fillStyle='#5aa6b6b8';c.beginPath();c.moveTo(-500,y);for(let x=-500;x<=WORLD.width+500;x+=20)c.lineTo(x,y+Math.sin(x*.017+(this.reduced?0:t*.002))*4);c.lineTo(WORLD.width+500,WORLD.height+1000);c.lineTo(-500,WORLD.height+1000);c.closePath();c.fill();c.strokeStyle='#cfefdc';c.lineWidth=3;c.beginPath();for(let x=-500;x<=WORLD.width+500;x+=15){const yy=y+Math.sin(x*.017+(this.reduced?0:t*.002))*4;x===-500?c.moveTo(x,yy):c.lineTo(x,yy);}c.stroke();if(s.suddenDeath&&s.waterRise<6){const next=s.nextWaterY??(WORLD.groundY-(s.waterRise+1)*((WORLD.groundY-106)/6));c.setLineDash([9,9]);c.strokeStyle='#4b99ae80';c.lineWidth=2;c.beginPath();c.moveTo(10,next);c.lineTo(WORLD.width-10,next);c.stroke();c.setLineDash([]);c.fillStyle='#467d87';c.font='800 12px system-ui';c.textAlign='center';c.fillText('NEXT TIDE',WORLD.width/2,next-8);}c.restore();}
}

export function weaponIcon(id,locked=false){const w=WEAPONS[id]||{};const color=locked?'#aab4a0':w.color||'#bb7558';let shape='';
if(w.kind==='build')shape='<path d="M4 20h28v6H4zM7 12h22v7H7zM11 5h6v7h-6zM22 5h6v7h-6z"/><path d="M10 26v7m16-7v7" fill="none"/>';
else if(['moon','saturn','star'].includes(id))shape='<circle cx="18" cy="18" r="11"/><circle cx="15" cy="13" r="2" fill="#fff0bc" stroke="none"/><circle cx="23" cy="19" r="3" fill="#fff0bc" stroke="none"/>'+(id==='saturn'?'<ellipse cx="18" cy="18" rx="19" ry="5" fill="none" transform="rotate(-25 18 18)"/>':'');
else if(id==='anvil')shape='<path d="M5 10h25l-5 8h-4v7l7 4H8l7-4v-7H9Z"/>';
else if(id==='lob'||id==='pinball')shape='<circle cx="17" cy="21" r="10"/><path d="M17 11V6l8-3" fill="none"/><path d="m25 2 2 4m-1-2 4-1" stroke="#e9a546"/>';
else shape='<g transform="rotate(38 18 18)"><path d="M12 25V12l6-10 6 10v13z"/><path d="m12 21-6 9 7-2m11-7 6 9-7-2" fill="#dfb665"/><path d="M12 14h12" fill="none"/><path d="m15 29 3 6 3-6" fill="#e79d45" stroke="none"/></g>';
return `<svg viewBox="0 0 36 38" aria-hidden="true" fill="${color}" stroke="#466051" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round">${shape}</svg>`;}
