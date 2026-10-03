/* Our Planet — soothing generative music and soft ambient sounds, all synthesised with the Web Audio API.
   Music swells while you drive and fades to a whisper when you stop; night brings slower, dreamier chords. */
(function(){
const OP=window.OurPlanet=window.OurPlanet||{};
const S={ctx:null,music:true,sfx:true,moving:0,speed:0,night:0,day:1,zone:'',bar:0,step:0,next:0,mel:4,mood:'day'};
const mtof=m=>440*Math.pow(2,(m-69)/12);

// chord: [bass note, pad notes...] (MIDI numbers)
const MOODS={
  day:{bpm:72,prob:0.42,chords:[[48,60,64,67,71],[45,57,60,64,67],[41,57,60,64,65],[43,55,59,62,67]],scale:[72,74,76,79,81,84,86,88],cut:1500},
  night:{bpm:58,prob:0.28,chords:[[45,57,60,64,71],[41,53,57,60,64],[48,55,59,64,67],[40,55,59,62,64]],scale:[69,72,74,76,79,81,84],cut:900}
};

function impulse(ctx,secs,decay){
  const len=Math.floor(ctx.sampleRate*secs),b=ctx.createBuffer(2,len,ctx.sampleRate);
  for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay);}
  return b;
}
function noiseBuffer(ctx){const len=ctx.sampleRate*2,b=ctx.createBuffer(1,len,ctx.sampleRate),d=b.getChannelData(0);let last=0;
  for(let i=0;i<len;i++){const w=Math.random()*2-1;last=(last+0.02*w)/1.02;d[i]=last*3.5+w*0.15;}return b;}   // soft brown-ish noise

function start(){
  if(S.ctx){if(S.ctx.state==='suspended')S.ctx.resume();return;}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  const ctx=S.ctx=new AC();
  const master=ctx.createGain();master.gain.value=0.85;
  const comp=ctx.createDynamicsCompressor();comp.threshold.value=-20;comp.ratio.value=3;comp.attack.value=0.02;comp.release.value=0.4;
  master.connect(comp).connect(ctx.destination);
  const rev=ctx.createConvolver();rev.buffer=impulse(ctx,4,2.4);
  const revOut=ctx.createGain();revOut.gain.value=0.6;rev.connect(revOut).connect(master);
  S.musicBus=ctx.createGain();S.musicBus.gain.value=0;S.musicBus.connect(master);
  const send=ctx.createGain();send.gain.value=0.7;S.musicBus.connect(send).connect(rev);
  S.padFilter=ctx.createBiquadFilter();S.padFilter.type='lowpass';S.padFilter.frequency.value=1500;S.padFilter.Q.value=0.4;
  S.padBus=ctx.createGain();S.padBus.gain.value=0.9;S.padBus.connect(S.padFilter).connect(S.musicBus);
  S.melBus=ctx.createGain();S.melBus.gain.value=0.8;S.melBus.connect(S.musicBus);
  const delay=ctx.createDelay(2),fb=ctx.createGain(),dlp=ctx.createBiquadFilter();
  delay.delayTime.value=60/72*0.75;fb.gain.value=0.34;dlp.type='lowpass';dlp.frequency.value=2400;
  S.melBus.connect(delay);delay.connect(dlp).connect(fb).connect(delay);dlp.connect(S.musicBus);S.delay=delay;
  S.bassBus=ctx.createGain();S.bassBus.gain.value=0.75;S.bassBus.connect(S.musicBus);
  S.sfxBus=ctx.createGain();S.sfxBus.gain.value=0;S.sfxBus.connect(master);
  const sfxRev=ctx.createGain();sfxRev.gain.value=0.25;S.sfxBus.connect(sfxRev).connect(rev);
  S.noise=noiseBuffer(ctx);
  // engine purr: two soft oscillators through a low-pass
  S.eng1=ctx.createOscillator();S.eng1.type='sawtooth';S.eng2=ctx.createOscillator();S.eng2.type='sine';
  S.engLP=ctx.createBiquadFilter();S.engLP.type='lowpass';S.engLP.frequency.value=220;S.engLP.Q.value=0.7;
  S.engGain=ctx.createGain();S.engGain.gain.value=0;
  const e2g=ctx.createGain();e2g.gain.value=0.6;
  S.eng1.connect(S.engLP);S.eng2.connect(e2g).connect(S.engLP);S.engLP.connect(S.engGain).connect(S.sfxBus);
  S.eng1.start();S.eng2.start();
  // road rush and wind: looping noise through filters
  const loop=(type,f,q)=>{const src=ctx.createBufferSource();src.buffer=S.noise;src.loop=true;const fl=ctx.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;const g=ctx.createGain();g.gain.value=0;src.connect(fl).connect(g).connect(S.sfxBus);src.start();return{fl,g};};
  S.rush=loop('lowpass',500,0.5);S.wind=loop('bandpass',420,0.6);
  S.next=ctx.currentTime+0.2;
  S.timer=setInterval(schedule,50);
}

/* ---------------- instruments ---------------- */
function pad(freq,t,dur){
  const c=S.ctx;
  for(const [type,mul,det,vol] of [['triangle',1,-7,0.05],['triangle',1,7,0.05],['sine',0.5,0,0.04]]){
    const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=freq*mul;o.detune.value=det;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+1.6);g.gain.setValueAtTime(vol,t+dur);g.gain.linearRampToValueAtTime(0,t+dur+2.6);
    o.connect(g).connect(S.padBus);o.start(t);o.stop(t+dur+2.8);
  }
}
function pluck(freq,t,vel){
  const c=S.ctx;
  for(const [type,mul,vol,dec] of [['sine',1,0.16,1.8],['triangle',2,0.035,0.6],['sine',3,0.015,0.35]]){
    const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=freq*mul;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol*vel,t+0.006);g.gain.exponentialRampToValueAtTime(0.0001,t+dec);
    o.connect(g).connect(S.melBus);o.start(t);o.stop(t+dec+0.05);
  }
}
function bass(freq,t,dur){
  const c=S.ctx,o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=freq;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.16,t+0.08);g.gain.exponentialRampToValueAtTime(0.07,t+dur*0.6);g.gain.linearRampToValueAtTime(0,t+dur+0.4);
  o.connect(g).connect(S.bassBus);o.start(t);o.stop(t+dur+0.5);
}
function shaker(t,vel){
  const c=S.ctx,src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
  src.buffer=S.noise;f.type='highpass';f.frequency.value=5500;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.05*vel,t+0.01);g.gain.exponentialRampToValueAtTime(0.0001,t+0.09);
  src.connect(f).connect(g).connect(S.musicBus);src.start(t,Math.random()*1.5);src.stop(t+0.12);
}
function chirp(t){   // a little songbird phrase
  const c=S.ctx,n=2+Math.floor(Math.random()*4),base=2600+Math.random()*1400;
  for(let i=0;i<n;i++){
    const o=c.createOscillator(),g=c.createGain(),s=t+i*(0.07+Math.random()*0.05);o.type='sine';
    o.frequency.setValueAtTime(base*(0.9+Math.random()*0.2),s);o.frequency.exponentialRampToValueAtTime(base*(1.25+Math.random()*0.4),s+0.06);
    g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(0.022,s+0.01);g.gain.exponentialRampToValueAtTime(0.0001,s+0.07);
    o.connect(g).connect(S.sfxBus);o.start(s);o.stop(s+0.08);
  }
}
// soft footsteps: grass is a hush, road a tap, snow a crunch
function step(surface){
  const c=S.ctx;if(!c||!S.sfx||c.state!=='running')return;
  const t=c.currentTime+0.01,src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
  const cfg={grass:['lowpass',700,0.09,0.09],road:['bandpass',1500,0.07,0.06],snow:['bandpass',2600,0.08,0.14],water:['lowpass',500,0.12,0.22]}[surface]||['lowpass',800,0.08,0.08];
  src.buffer=S.noise;f.type=cfg[0];f.frequency.value=cfg[1]*(0.9+Math.random()*0.2);f.Q.value=0.8;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(cfg[2],t+0.008);g.gain.exponentialRampToValueAtTime(0.0001,t+cfg[3]);
  src.connect(f).connect(g).connect(S.sfxBus);src.start(t,Math.random()*1.5);src.stop(t+cfg[3]+0.05);
}
function cricket(t){
  const c=S.ctx;
  for(let i=0;i<3;i++){
    const o=c.createOscillator(),g=c.createGain(),s=t+i*0.055;o.type='sine';o.frequency.value=4300+Math.random()*200;
    g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(0.009,s+0.008);g.gain.linearRampToValueAtTime(0,s+0.035);
    o.connect(g).connect(S.sfxBus);o.start(s);o.stop(s+0.04);
  }
}

/* ---------------- sequencer ---------------- */
function schedule(){
  const c=S.ctx;if(!c||c.state!=='running')return;
  while(S.next<c.currentTime+0.35){
    const M=MOODS[S.mood],eighth=60/M.bpm/2,t=S.next,chord=M.chords[S.bar%M.chords.length];
    if(S.step===0){
      const want=S.night>0.5?'night':'day';
      if(want!==S.mood){S.mood=want;}
      const MM=MOODS[S.mood],ch=MM.chords[S.bar%MM.chords.length],barLen=eighth*8;
      for(const n of ch.slice(1))pad(mtof(n),t,barLen*0.92);
      bass(mtof(ch[0]),t,barLen*0.45);
      if(S.mood==='day')bass(mtof(ch[0]+7),t+barLen*0.5,barLen*0.4);
      S.padFilter.frequency.setTargetAtTime(MM.cut,t,1.5);
      S.delay.delayTime.setTargetAtTime(60/MM.bpm*0.75,t,0.5);
    }
    // melody: a gentle random walk over the pentatonic scale, leaning on chord tones on strong beats
    const strong=S.step%4===0;
    if(Math.random()<(strong?M.prob+0.2:M.prob)*(0.55+0.45*S.moving)){
      S.mel=Math.max(0,Math.min(M.scale.length-1,S.mel+[-2,-1,-1,0,1,1,2][Math.floor(Math.random()*7)]));
      let note=M.scale[S.mel];
      if(strong){const tones=chord.slice(1).map(n=>n+12);note=tones.reduce((a,b)=>Math.abs(b-note)<Math.abs(a-note)?b:a,note);}
      pluck(mtof(note),t+(Math.random()*0.012),0.55+Math.random()*0.45);
    }
    if(S.speed>9&&S.step%2===1)shaker(t,Math.min(1,(S.speed-9)/6)*(S.mood==='day'?1:0.5));
    S.step=(S.step+1)%8;if(S.step===0)S.bar++;
    S.next+=eighth;
  }
  // nature: birds by day away from the city, crickets at night
  const t=c.currentTime+0.05,wild=!/City/.test(S.zone);
  if(S.sfx&&wild&&S.day>0.5&&Math.random()<0.012)chirp(t);
  if(S.sfx&&wild&&S.night>0.6&&Math.random()<0.05)cricket(t);
}

/* ---------------- per-frame update from the game ---------------- */
function update(o,dt){
  S.speed=Math.abs(o.speed||0);S.night=o.night||0;S.day=o.day==null?1:o.day;S.zone=o.zone||S.zone;
  const target=S.speed>0.8?1:0;S.moving+=(target-S.moving)*Math.min(1,dt*(target?0.9:0.25));   // slow fade out after stopping
  const c=S.ctx;if(!c)return;const t=c.currentTime;
  S.musicBus.gain.setTargetAtTime(S.music?0.14+0.5*S.moving:0,t,0.4);
  S.sfxBus.gain.setTargetAtTime(S.sfx?1:0,t,0.3);
  const sp=Math.min(S.speed,18);
  S.eng1.frequency.setTargetAtTime(34+sp*2.6,t,0.1);S.eng2.frequency.setTargetAtTime(68+sp*5.2,t,0.1);
  S.engLP.frequency.setTargetAtTime(180+sp*22,t,0.1);
  const eng=o.engine===false?0:1;
  S.engGain.gain.setTargetAtTime((0.018+sp/18*0.05)*eng,t,0.15);
  S.rush.fl.frequency.setTargetAtTime(350+sp*70,t,0.2);S.rush.g.gain.setTargetAtTime(sp/18*0.07*eng,t,0.2);
  const windy=/Alps|Snowy|lake/i.test(S.zone)?0.09:0.025;
  S.wind.g.gain.setTargetAtTime(windy*(0.7+0.3*Math.sin(t*0.37)*Math.sin(t*0.11)),t,0.8);
  S.wind.fl.frequency.setTargetAtTime(380+120*Math.sin(t*0.23),t,0.8);
}
OP.audio={start,update,step,setMusic:v=>{S.music=v;},setSfx:v=>{S.sfx=v;},get started(){return!!S.ctx;},state:()=>S.ctx?S.ctx.state+' bar='+S.bar+' step='+S.step+' mood='+S.mood+' moving='+S.moving.toFixed(2):'not started'};
})();
