/** Small synthesized sound bank: no downloads, with bounded voices and a soft limiter. */
export class GameAudio {
  constructor(){
    this.context=null;this.master=null;this.noiseBuffer=null;this.enabled=false;
    this.lastExplosion=-Infinity;this.lastCollapse=-Infinity;this.voices=0;
  }
  async unlock(){
    try{
      if(!this.context){
        const c=this.context=new (window.AudioContext||window.webkitAudioContext)();
        const limiter=c.createDynamicsCompressor();
        limiter.threshold.value=-13;limiter.knee.value=20;limiter.ratio.value=5;
        limiter.attack.value=.003;limiter.release.value=.16;
        this.master=c.createGain();this.master.gain.value=this.enabled ? .72 : 0;
        this.master.connect(limiter);limiter.connect(c.destination);
        this.noiseBuffer=c.createBuffer(1,Math.ceil(c.sampleRate*1.8),c.sampleRate);
        const samples=this.noiseBuffer.getChannelData(0);
        for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
      }
      if(this.context.state==='suspended')await this.context.resume();
    }catch{}
  }
  setEnabled(enabled){
    this.enabled=enabled;
    if(this.master&&this.context)this.master.gain.setTargetAtTime(enabled ? .72 : 0,this.context.currentTime,.02);
    if(enabled)this.unlock();
  }
  available(){return this.enabled&&this.context?.state==='running'&&this.voices<36;}
  playSource(source,gain,duration,delay=0){
    const t=this.context.currentTime+delay;
    this.voices++;gain.connect(this.master);
    source.onended=()=>{this.voices--;source.disconnect();gain.disconnect();};
    source.start(t);source.stop(t+duration+.03);
  }
  tone(start,end,duration,type='sine',volume=.12,delay=0){
    if(!this.available())return;
    const c=this.context,t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();
    o.type=type;o.frequency.setValueAtTime(start,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);
    g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(Math.max(.002,volume),t+.008);g.gain.exponentialRampToValueAtTime(.001,t+duration);
    o.connect(g);this.playSource(o,g,duration,delay);
  }
  noise(duration=.2,volume=.08,{delay=0,start=1100,end=180,filter='lowpass'}={}){
    if(!this.available())return;
    const c=this.context,t=c.currentTime+delay,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
    s.buffer=this.noiseBuffer;f.type=filter;f.frequency.setValueAtTime(start,t);f.frequency.exponentialRampToValueAtTime(Math.max(40,end),t+duration);
    g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(Math.max(.002,volume),t+.007);g.gain.exponentialRampToValueAtTime(.001,t+duration);
    s.connect(f);f.connect(g);this.playSource(s,g,duration,delay);
    const ended=s.onended;s.onended=()=>{ended();f.disconnect();};
  }
  click(){this.tone(420,650,.07,'sine',.045);}
  explosion(e){
    const now=performance.now();
    // Multi-pulse weapons remain audible without summing dozens of simultaneous booms.
    if(now-this.lastExplosion<60)return;
    this.lastExplosion=now;
    if(['moon','saturn','star'].includes(e.weaponId)){this.cosmicExplosion(e);return;}
    const size=Math.max(.65,Math.min(2.4,(Number(e.radius)||42)/55));
    const child=e.child ? .55 : 1,volume=child*(.12+size*.045);
    this.tone(145-size*18,28,.32+size*.12,'triangle',volume*1.15);
    this.tone(75,24,.42+size*.14,'sine',volume*.7,.018);
    this.noise(.12,.2*child,{start:4500,end:700}); // the initial crack
    this.noise(.48+size*.15,volume,{delay:.025,start:1300,end:95}); // falling body of the boom
    this.noise(.2,.05*child,{delay:.17,start:3000,end:600,filter:'highpass'});
    this.noise(.15,.035*child,{delay:.32,start:2200,end:500,filter:'highpass'});
    if(size>1.7&&!e.child)this.tone(220,48,.64,'sawtooth',.025,.05);
  }
  cosmicExplosion(e){
    if(e.child){
      this.tone(840,180,.34,'triangle',.06);
      this.noise(.2,.09,{start:2100,end:160});
      return;
    }
    if(e.weaponId==='star'){
      if(e.pulse>0){
        // Each real pulse adds a glint, not another full supernova sound stack.
        this.tone(360+e.pulse*95,150,.3,'sine',.06);
        this.noise(.2,.045,{start:1500,end:220});
        return;
      }
      this.tone(260,42,1.1,'triangle',.2);
      this.tone(65,25,1.25,'sine',.16,.02);
      this.noise(.95,.19,{start:2400,end:110});
      [660,880,1320].forEach((f,i)=>this.tone(f,f*.7,.7,'sine',.035,.08+i*.12));
    }else if(e.weaponId==='moon'){
      this.tone(110,24,.95,'triangle',.23);
      this.noise(.2,.24,{start:3900,end:370});
      this.noise(1.05,.15,{delay:.04,start:1000,end:65});
      [180,260,370].forEach((f,i)=>{
        this.tone(f,f*.4,.32,'triangle',.055,.13+i*.14);
        this.noise(.15,.035,{delay:.17+i*.14,start:2800,end:750,filter:'highpass'});
      });
    }else{
      this.tone(155,30,.85,'sine',.22);
      this.noise(.65,.17,{start:1800,end:90});
      [440,554,659,880].forEach((f,i)=>this.tone(f,f*.8,.65,'sine',.06,.055+i*.13));
      this.noise(.45,.06,{delay:.2,start:3300,end:900,filter:'highpass'});
    }
  }
  coreDestruction(){
    // The crystal winds up before its visible rupture, then leaves a glassy tail.
    this.tone(180,960,.52,'sine',.1);
    this.tone(270,1440,.5,'triangle',.035);
    this.tone(120,24,1.25,'triangle',.24,.58);
    this.noise(.16,.23,{delay:.58,start:4200,end:500});
    this.noise(1.25,.17,{delay:.61,start:1450,end:85});
    [1046,1318,1568,2093].forEach((f,i)=>this.tone(f,f*.65,.7,'sine',.045,.68+i*.17));
  }
  drowningFinale(ageMs=0){
    const age=Math.max(0,ageMs)/1000;
    // Two wet gulps followed by a small bubble, all finished inside one second.
    // Resuming mid-finale only plays the remaining sound, never restarts the pair.
    for(const [at,start,end,duration,volume] of [[0,560,75,.29,.17],[.43,460,55,.36,.18],[.80,230,50,.17,.06]]){
      const elapsed=Math.max(0,age-at),remaining=duration-elapsed;
      if(remaining<=0)continue;
      const delay=Math.max(0,at-age),pitch=start*(end/start)**(elapsed/duration);
      this.tone(pitch,end,remaining,'sine',volume,delay);
      if(at<.8)this.noise(Math.min(.12,remaining),.035,{delay,start:800,end:90});
    }
  }
  event(e){
    if(e.type==='launch'){
      this.tone(160,660,.19,'sawtooth',.045);
      this.tone(110,48,.1,'triangle',.1);
      this.noise(.19,.075,{start:1700,end:480});
    }
    if(e.type==='explosion')this.explosion(e);
    if(e.type==='core-destroyed')this.coreDestruction();
    if(e.type==='drowning-finale')this.drowningFinale(e.ageMs);
    if(e.type==='plop'){this.tone(590,80,.17,'sine',.18);this.tone(250,100,.13,'sine',.07,.05);}
    if(e.type==='collapse'&&performance.now()-this.lastCollapse>110){
      this.lastCollapse=performance.now();this.noise(.28,.075,{start:760,end:100});this.tone(130,55,.16,'triangle',.04);
    }
    if(e.type==='unlock'){this.tone(523,523,.17,'triangle',.08);this.tone(659,659,.17,'triangle',.08,.1);this.tone(784,784,.25,'triangle',.08,.2);}
    if(e.type==='build'){this.tone(290,170,.12,'triangle',.09);this.tone(390,260,.12,'triangle',.09,.09);this.noise(.09,.04,{start:1800,end:400});}
    if(e.type==='death')this.tone(480,100,.3,'triangle',.055);
    if(e.type==='result')[523,659,784,1046].forEach((f,i)=>this.tone(f,f,.3,'triangle',.075,i*.13));
  }
}
