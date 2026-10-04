/* Our Planet — things to do: a photo journal, a wildlife field guide, hidden wonders, deliveries, tidying up,
   kite flying, fishing, a snowball fort and balloon rides. Progress is kept in this browser (localStorage). */
(function(){
const OP=window.OurPlanet=window.OurPlanet||{};
const $=s=>document.querySelector(s);
let W=null,V,R;
const SAVE='ourplanet-progress-v1',ALBUM='ourplanet-album-v1';
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'null');}catch(e){return null;}};
const prog=Object.assign({moments:{},guide:{},wonders:{},litter:{},jobs:{},hearts:0,fish:{},kiteBest:0,fortBest:0,balloon:0},read(SAVE)||{});
let album=read(ALBUM)||[];
const save=()=>{try{localStorage.setItem(SAVE,JSON.stringify(prog));}catch(e){}};
function saveAlbum(){album=album.slice(-24);for(let n=album.length;n>=0;n-=4){try{localStorage.setItem(ALBUM,JSON.stringify(album.slice(-n)));return;}catch(e){}}}
const sfx=n=>{if(OP.audio&&OP.audio.sfx)OP.audio.sfx(n);};
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd=rng(2024),range=(a,b)=>a+rnd()*(b-a),pick=a=>a[Math.floor(rnd()*a.length)];
const toast=(h,s)=>W.toast(h,s);
const dirOf=pl=>pl.dir?pl.dir.clone():pl.pos.clone().normalize();
const fwdOf=pl=>V(0,0,1).applyQuaternion(pl.q);

/* ================================================================ shared helpers */
let up,around;
function anchor(obj,p,front,h){obj.position.copy(p).multiplyScalar(R+h);obj.quaternion.copy(W.quatUpFront(p,front));W.scene.add(obj);return obj;}
function findSpot(gen,r,{tries=200,clear=1.5,slope=0.85,dry=true}={}){
  for(let i=0;i<tries;i++){const p=gen();if(!p)continue;
    if(W.roadEdge(p.x,p.y,p.z)<r+clear)continue;
    if(!W.occFree(p,r))continue;
    const h=W.hAt(p);if(dry&&h<W.waterLevelAt(p)+0.3)continue;
    if(slope&&W.slopeAt(p)<slope)continue;
    W.occupy(p,r);return p;}
  return null;
}
const distTo=(p)=>W.angTo(W.focusP(),p)*R;
function inFrame(v,maxD,minD=0){
  const d=W.camera.position.distanceTo(v);if(d>maxD||d<minD)return false;
  const s=v.clone().project(W.camera);return s.z<1&&Math.abs(s.x)<0.8&&Math.abs(s.y)<0.8;
}
// little particle bursts: sparkles, snow puffs and splashes
const parts=[];
function burst(pos,upv,{color=0xFFE08A,n=10,speed=2.5,size=0.07,life=0.8,grav=4}={}){
  for(let i=0;i<n;i++){
    const m=new THREE.Mesh(new THREE.OctahedronGeometry(size*(0.6+Math.random()*0.8),0),new THREE.MeshBasicMaterial({color:OP.lin(color),transparent:true,opacity:1}));
    m.position.copy(pos);W.scene.add(m);
    const v=new THREE.Vector3(Math.random()-0.5,Math.random()-0.5,Math.random()-0.5).normalize().multiplyScalar(speed*(0.5+Math.random()*0.5)).addScaledVector(upv,speed*0.8);
    parts.push({m,v,life,t:0,grav,up:upv.clone()});
  }
}
function ring(pos,upv,color=0xEFFBFF,r1=1.4){
  const m=new THREE.Mesh(new THREE.TorusGeometry(0.3,0.04,6,24),new THREE.MeshBasicMaterial({color:OP.lin(color),transparent:true,opacity:0.8,depthWrite:false}));
  m.position.copy(pos);m.quaternion.setFromUnitVectors(V(0,0,1),upv);W.scene.add(m);parts.push({m,ring:true,r1,life:1,t:0});
}
function updateParts(dt){
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.t+=dt;const k=p.t/p.life;
    if(p.ring){p.m.scale.setScalar(1+k*p.r1*3);p.m.material.opacity=0.8*(1-k);}
    else{p.v.addScaledVector(p.up,-p.grav*dt);p.m.position.addScaledVector(p.v,dt);p.m.material.opacity=1-k;p.m.rotation.x+=dt*5;}
    if(k>=1){W.scene.remove(p.m);p.m.geometry.dispose();p.m.material.dispose();parts.splice(i,1);}
  }
}
const model=(name,...a)=>{const o=OP.models[name](...a);o.traverse(c=>{if(c.isMesh){if(!c.geometry.boundingSphere)c.geometry.computeBoundingSphere();c.castShadow=c.geometry.boundingSphere.radius>=0.16;c.receiveShadow=true;}});return o;};

/* ================================================================ wildlife */
const animals=[],fishJumps=[];
function setupWildlife(){
  const L=W.LAKES;
  // deer herds at quiet forest edges
  for(let hN=0;hN<3;hN++){
    const home=findSpot(()=>{const p=W.randomUnit();if(Math.abs(p.y)>0.62||W.angTo(p,W.CITY)*R<95||W.angTo(p,W.ALPS)*R<W.ALPS_R*0.7)return null;return p;},6,{clear:10,slope:0.88});
    if(!home)continue;
    for(let k=0;k<4;k++){const o=model(k===3?'Fawn':'Deer',k===0);addAnimal('deer',o,W.offsetP(home,W.randomTangent(home),range(1,4)),home,{wander:9,speed:0.7,flee:9,fleeSpeed:6});}
  }
  // foxes in the snow
  for(let k=0;k<3;k++){const home=findSpot(()=>{const p=W.randomUnit();return p.y>0.8&&W.angTo(p,W.ALPS)*R>W.ALPS_R?p:null;},3,{slope:0.85});if(home)addAnimal('fox',model('Fox'),home,home,{wander:12,speed:1.3,flee:7,fleeSpeed:5.5});}
  // rabbits round the meadow and the farm
  for(let k=0;k<8;k++){const c=k<5?W.MEADOW:W.FARM;const home=findSpot(()=>W.offsetP(c,W.randomTangent(c),range(10,28)),1,{slope:0.8});if(home)addAnimal('rabbit',model('Rabbit'),home,home,{wander:6,hop:true,flee:5});}
  // chickens by the barn
  const barn=W.placements.Barn&&W.placements.Barn[0];
  if(barn){const bp=dirOf(barn);for(let k=0;k<7;k++){const p=findSpot(()=>W.offsetP(bp,W.randomTangent(bp),range(7,12)),0.4,{slope:0.7,clear:0.5});if(p)addAnimal('chicken',model('Chicken'),p,p,{wander:3,speed:0.5,peck:true,flee:2.2,fleeSpeed:2.4});}}
  // butterflies over the flowers and the green square
  const BC=[[0xFFB3C7,0xFFE08A],[0xC9B8F5,0xFFFFFF],[0xFFE08A,0xF4A99B],[0xA2CBEF,0xFFF4D6],[0xF4A99B,0xFFE08A]];
  for(let k=0;k<18;k++){const c=k<14?W.MEADOW:(W.parkSpot||W.MEADOW);const p=W.offsetP(c,W.randomTangent(c),range(2,k<14?22:6));const cc=BC[k%5];addAnimal('butterfly',model('Butterfly',cc[0],cc[1]),p,p,{fly:true,day:true});}
  // owls on treetops near the woods, out at night
  const trees=(W.placements.Tree_Round||[]).filter(t=>{const d=dirOf(t);return Math.abs(d.y)<0.66&&W.angTo(d,W.CITY)*R>90;});
  for(let k=0;k<5&&trees.length;k++){const t=trees[Math.floor(rnd()*trees.length)],d=dirOf(t),o=model('Owl');
    const topH=t.pos.length()-R+4.4*t.s[0];addAnimal('owl',o,d,d,{perch:topH,night:true});}
  // fish that leap now and then
  for(const lk of [...L,{p:W.ALPINE.p,level:W.ALPINE.level,r:W.ALPINE.r,name:'Alpine lake',alp:true}])
    for(let k=0;k<2;k++){const cols=[[0x9FC7E8,0xF4F7FB],[0xF6A86A,0xFFF4E6],[0xC9B8F5,0xFFFFFF]][k%3],f=model('Fish',cols[0],cols[1]);f.visible=false;W.scene.add(f);fishJumps.push({lk,f,t:range(2,8),air:-1});}
}
function addAnimal(kind,o,p,home,opt){
  const a=Object.assign({kind,o,p:p.clone(),home:home.clone(),f:W.randomTangent(p),target:null,state:'idle',timer:range(1,4),ph:range(0,6),h:W.hAt(p),flee:0,hopT:0},opt);
  W.scene.add(o);animals.push(a);return a;
}
function updateWildlife(dt,t){
  const F=W.focusP(),night=W.TOD.night,day=W.TOD.day;
  for(const a of animals){
    const d=W.angTo(F,a.p)*R;
    if(d>120&&!a.fly){a.o.visible=false;continue;}
    if(a.kind==='owl'){
      a.o.visible=night>0.3;if(!a.o.visible)continue;
      a.o.position.copy(a.p).multiplyScalar(R+a.perch);a.o.quaternion.copy(W.quatUpFront(a.p,W.tangentToward(a.p,F.clone().sub(a.p))));
      a.o.userData.head.rotation.y=Math.sin(t*0.6+a.ph)*0.9;a.o.scale.setScalar(Math.min(1,night*2));continue;
    }
    if(a.kind==='butterfly'){
      a.o.visible=day>0.4&&d<120;if(!a.o.visible)continue;
      a.ph+=dt;const off=W.offsetP(a.home,W.randomTangent(a.home),0);
      const q=a.home,tt=t*0.35+a.ph*0.1;
      const t1=V(0,0,0).crossVectors(q,Math.abs(q.y)<0.9?V(0,1,0):V(1,0,0)).normalize(),t2=V(0,0,0).crossVectors(q,t1);
      const dir=t1.clone().multiplyScalar(Math.sin(tt*1.3+a.ph)).addScaledVector(t2,Math.cos(tt*0.9+a.ph*2)).normalize();
      const p=W.offsetP(q,dir,2.2+1.6*Math.sin(tt*0.7+a.ph));
      const hgt=W.hAt(p)+0.7+0.5*Math.sin(t*1.7+a.ph);
      const fwd=W.tangentToward(p,p.clone().sub(a.p));a.p.copy(p);void off;
      a.o.position.copy(p).multiplyScalar(R+hgt);a.o.quaternion.copy(W.quatUpFront(p,fwd.lengthSq()>0?fwd:a.f));
      const fl=Math.sin(t*22+a.ph)*0.9;a.o.userData.wings[0].rotation.z=fl;a.o.userData.wings[1].rotation.z=-fl;continue;
    }
    a.o.visible=true;
    // flee from the explorer or the truck
    if(d<a.flee&&a.kind!=='owl'){a.state='flee';a.timer=2.5;a.f=W.tangentToward(a.p,a.p.clone().sub(F));}
    a.timer-=dt;
    let speed=0;
    if(a.state==='flee'){speed=a.fleeSpeed||4;if(a.timer<=0)a.state='idle';}
    else if(a.state==='walk'){
      speed=a.speed||0.6;
      const toT=a.target?W.angTo(a.p,a.target)*R:0;
      if(!a.target||toT<0.6||a.timer<=0){a.state='idle';a.timer=range(2,6);}
      else a.f.lerp(W.tangentToward(a.p,a.target.clone().sub(a.p)),Math.min(1,dt*3));
    }else if(a.timer<=0){
      a.state='walk';a.timer=range(4,9);a.target=W.offsetP(a.home,W.randomTangent(a.home),range(0,a.wander));
    }
    a.f.addScaledVector(a.p,-a.f.dot(a.p)).normalize();
    if(a.hop){ // rabbits move in little hops
      if(speed>0){a.hopT+=dt*(a.state==='flee'?4:2.4);}
      const k=a.hopT%1,airborne=speed>0&&k<0.55;
      if(airborne)a.p.copy(W.offsetP(a.p,a.f,(a.state==='flee'?3.2:1.2)*dt*2));
      a.h+=(W.hAt(a.p)-a.h)*Math.min(1,dt*12);
      a.o.position.copy(a.p).multiplyScalar(R+a.h+(airborne?Math.sin(k/0.55*Math.PI)*0.25:0));
    }else{
      if(speed>0){const np=W.offsetP(a.p,a.f,speed*dt);if(W.waterLevelAt(np)<W.hAt(np)&&W.roadEdge(np.x,np.y,np.z)>-1)a.p.copy(np);else{a.f.negate();a.state='idle';a.timer=1;}}
      a.h+=(W.hAt(a.p)-a.h)*Math.min(1,dt*10);
      a.o.position.copy(a.p).multiplyScalar(R+a.h);
      a.ph+=dt*speed*4;
      const u=a.o.userData;
      if(u.legs)u.legs.forEach((l,i)=>{l.rotation.x=speed>0?Math.sin(a.ph+(i%2?Math.PI:0)+(i>1?Math.PI/2:0))*Math.min(0.6,speed*0.25):0;});
      if(a.kind==='deer'&&u.head)u.head.rotation.x=a.state==='idle'?lerpN(u.head.rotation.x,0.9,dt*2):lerpN(u.head.rotation.x,0,dt*4);   // graze
      if(a.peck&&u.head)u.head.rotation.x=a.state==='idle'?Math.max(0,Math.sin(t*5+a.ph))*0.9:0;
      if(u.tail)u.tail.rotation.y=Math.sin(t*3+a.ph)*0.3;
    }
    a.o.quaternion.copy(W.quatUpFront(a.p,a.f));
  }
  for(const j of fishJumps){
    j.t-=dt;
    if(j.air<0&&j.t<=0){
      const lk=j.lk,dir=W.randomTangent(lk.p);
      let r=lk.alp?range(1,lk.r-2):W.laneR(lk,Math.random()*6.28,range(3,lk.r*0.8),3);
      j.p=W.offsetP(lk.p,dir,r);j.dir=W.randomTangent(j.p);j.air=0;j.f.visible=true;
      if(distTo(j.p)<40){ring(j.p.clone().multiplyScalar(R+lk.level+0.03),j.p,0xEFFBFF,1);sfx('splash');}
    }
    if(j.air>=0){
      j.air+=dt/0.9;const k=j.air,lk=j.lk;
      const p=W.offsetP(j.p,j.dir,(k-0.5)*1.4),hgt=lk.level+Math.sin(k*Math.PI)*1.1-0.1;
      j.f.position.copy(p).multiplyScalar(R+hgt);
      const q=W.quatUpFront(p,j.dir);q.multiply(new THREE.Quaternion().setFromAxisAngle(V(1,0,0),(k-0.5)*2.4));j.f.quaternion.copy(q);
      if(k>=1){j.air=-1;j.f.visible=false;j.t=range(4,10);if(distTo(p)<40)ring(p.clone().multiplyScalar(R+lk.level+0.03),p,0xEFFBFF,0.8);}
      if(distTo(p)<26)spot('fish');
    }
  }
}
const lerpN=(a,b,t)=>a+(b-a)*Math.min(1,t);

/* ================================================================ field guide */
const GUIDE=[
  {id:'duck',name:'Duck',note:'Families paddle near the lake shores.'},
  {id:'songbird',name:'Songbirds',note:'Flocks fly in V formation overhead.'},
  {id:'deer',name:'Deer',note:'Graze at quiet forest edges. Approach slowly.'},
  {id:'fox',name:'Fox',note:'Trots through the Snowy North.'},
  {id:'rabbit',name:'Rabbit',note:'Hops around the meadow and the farm.'},
  {id:'butterfly',name:'Butterfly',note:'Flutters over flowers on sunny days.'},
  {id:'fish',name:'Leaping fish',note:'Watch the lakes for a splash.'},
  {id:'owl',name:'Owl',note:'Perches on treetops after dark.'},
  {id:'chicken',name:'Chicken',note:'Pecks around the barn at Butter Farms.'}
];
function spot(id){
  if(prog.guide[id])return;prog.guide[id]=Date.now();save();
  const g=GUIDE.find(x=>x.id===id);toast('Field guide: you spotted a <b>'+g.name+'</b>! ('+Object.keys(prog.guide).length+'/'+GUIDE.length+')',3.2);sfx('chime');renderJournal();
}
function checkSpotting(){
  if(!W.me.on&&Math.abs(W.car.vf)>9)return;
  const F=W.focusP(),pw=F.clone().multiplyScalar(R);
  for(const a of animals){if(!a.o.visible)continue;const d=W.angTo(F,a.p)*R;
    const lim={deer:20,fox:16,rabbit:11,butterfly:8,owl:24,chicken:10}[a.kind];if(d<lim)spot(a.kind);}
  for(const d of W.ducks)if(d.wp&&d.wp.distanceTo(pw)<16)spot('duck');
  if(W.anim.birds)for(const f of W.anim.birds.flocks){const cp=f.u.clone().multiplyScalar(Math.cos(f.a)).addScaledVector(f.v,Math.sin(f.a));if(W.angTo(cp,F)*R<26)spot('songbird');}
}

/* ================================================================ hidden wonders */
const WONDERS=[];
function setupWonders(){
  const add=(id,name,hint,p,obj,h,front,radius=8)=>{if(!p)return;if(obj)anchor(obj,p,front||W.randomTangent(p),h==null?W.hAt(p)-0.05:h);WONDERS.push({id,name,hint,p,obj,radius});};
  // 1 waterfall where Ribbon River drops steepest
  {const rv=W.river;let best=0,bi=0;for(let i=8;i<rv.pts.length-8&&rv.S[i]<rv.sx*0.75;i++){const g=rv.level(rv.S[i-6])-rv.level(rv.S[i+6]);if(g>best){best=g;bi=i;}}
   const p=rv.pts[bi],tg=W.tangentToward(p,rv.pts[bi+1].clone().sub(rv.pts[bi-1]));
   add('waterfall','The hidden waterfall','Where Ribbon River tumbles down out of the mountains.',p,model('Waterfall'),rv.level(rv.S[bi])-0.3,tg.clone().negate(),20);}
  // 2 message in a bottle on the Lake Lull beach
  {const L=W.LAKES[0],o=L.shore[Math.floor(L.shore.length*0.62)];add('bottle','Message in a bottle','Washed up on a sandy beach of Lake Lull.',W.offsetP(L.p,o.dir,o.dist+0.9),model('Bottle'),null,null,5);}
  // 3 giant sunflower in the meadow
  add('sunflower','The giant sunflower','Taller than anyone, smiling over Petal Meadow.',findSpot(()=>W.offsetP(W.MEADOW,W.randomTangent(W.MEADOW),range(4,10)),1.2,{slope:0.7}),model('Sunflower'),null,null,7);
  // 4 fairy ring in the autumn woods
  add('fairyring','The fairy ring','A circle of mushrooms deep in the Autumn Woods. It glows at night.',findSpot(()=>{const p=W.randomUnit();return p.y<-0.74?p:null;},2.4,{slope:0.85,clear:4}),model('FairyRing'),null,null,7);
  // 5 wishing well near the farm
  add('well','The wishing well','An old stone well among the fields of Butter Farms.',findSpot(()=>W.offsetP(W.FARM,W.randomTangent(W.FARM),range(25,48)),1.6,{slope:0.85}),model('WishingWell'),null,null,7);
  // 6 treehouse by Maple Lake
  {const M=W.LAKES[1];add('treehouse','The treehouse','Up in a big tree beside Maple Lake.',findSpot(()=>W.offsetP(M.p,W.randomTangent(M.p),M.r*1.4+range(5,10)),3.2,{slope:0.8}),model('Treehouse'),null,null,9);}
  // 7 standing stones on a high hill
  {let best=null;for(let i=0;i<260;i++){const p=W.randomUnit();if(Math.abs(p.y)>0.6||W.angTo(p,W.CITY)*R<90||W.angTo(p,W.ALPS)*R<W.ALPS_R+8||W.roadEdge(p.x,p.y,p.z)<10)continue;
     if(!W.occFree(p,4.6)||W.slopeAt(p)<0.86)continue;const h=W.hAt(p);if(h<W.waterLevelAt(p)+1)continue;if(!best||h>best.h)best={p,h};}
   if(best){W.occupy(best.p,4.6);add('stones','The standing stones','An ancient ring of stones on the highest grassy hill.',best.p,model('StandingStones'),null,null,9);}}
  // 8 igloo in the snowy north (and a snow fort beside it)
  {const p=findSpot(()=>{const q=W.randomUnit();return q.y>0.84&&W.angTo(q,W.ALPS)*R>W.ALPS_R?q:null;},3,{slope:0.9,clear:5});
   add('igloo','The igloo','A snug little home in the Snowy North.',p,model('Igloo'),null,null,8);
   if(p)iglooP=p;}
  // 9 rainbow over the river by the bridge
  {const rv=W.river,i=rv.pts.findIndex((p,j)=>rv.S[j]>rv.sx+26);if(i>0){const p=rv.pts[i],tg=W.tangentToward(p,rv.pts[i+1].clone().sub(rv.pts[i-1]));
    add('rainbow','The river rainbow','Hangs over Ribbon River, just downstream of the stone bridge.',p,model('Rainbow'),rv.level(rv.S[i]),tg,26);}}
  // 10 secret garden outside the city
  add('garden','The secret garden','A flower arch hidden on the edge of Pastel City.',findSpot(()=>W.offsetP(W.CITY,W.randomTangent(W.CITY),range(70,92)),3.6,{slope:0.85,clear:5}),model('SecretGarden'),null,null,8);
}
let iglooP=null;
function checkWonders(){
  for(const w of WONDERS){if(prog.wonders[w.id])continue;if(distTo(w.p)<w.radius){prog.wonders[w.id]=Date.now();save();
    toast('Wonder found: <b>'+w.name+'</b> ('+Object.keys(prog.wonders).length+'/'+WONDERS.length+')',4);sfx('success');renderJournal();}}
}
function updateWonders(t){
  const n=W.TOD.night;
  for(const w of WONDERS){if(!w.obj)continue;const u=w.obj.userData;
    if(u.glows){u.glow.emissiveIntensity=0.2+n*2.2;u.glows.forEach((g,i)=>{g.position.y=0.6+(i%4)*0.15+Math.sin(t*1.5+i)*0.12;});}
    if(u.warm)u.warm.emissiveIntensity=0.4+n*1.8;
    if(u.sheets)u.sheets.forEach((s,i)=>{s.material.emissiveIntensity=0.12+0.08*Math.sin(t*6+i);});
  }
}

/* ================================================================ litter */
const LITTER=[];
function setupLitter(){
  const kinds=['LitterCan','LitterBottle','LitterPaper'];
  const spots=[];
  for(const L of W.LAKES)for(let k=0;k<(L===W.LAKES[0]?5:3);k++){const o=L.shore[Math.floor(rnd()*L.shore.length)];spots.push(W.offsetP(L.p,o.dir,o.dist+range(1,3)));}
  for(let k=0;k<4;k++)spots.push(W.offsetP(W.MEADOW,W.randomTangent(W.MEADOW),range(4,20)));
  for(let k=0;k<6;k++){const r=W.MAIN[k%3],t=rnd()*Math.PI*2,p=W.pointOn(r,t);if(W.angTo(p,W.CITY)*R<70){k--;continue;}spots.push(W.offsetP(p,r.n,(rnd()<0.5?1:-1)*(r.rh+r.walk+range(0.8,2))));}
  if(W.parkSpot)for(let k=0;k<2;k++)spots.push(W.offsetP(W.parkSpot,W.randomTangent(W.parkSpot),range(2,5)));
  for(let k=0;k<2;k++){const p=W.randomUnit();if(p.y<0.8){k--;continue;}spots.push(p);}
  for(let k=0;k<2;k++)spots.push(W.offsetP(W.FARM,W.randomTangent(W.FARM),range(8,30)));
  spots.forEach((p,i)=>{const id='L'+i,o=model(kinds[i%3]);
    if(prog.litter[id])return;
    const h=W.groundH(p);
    anchor(o,p,W.randomTangent(p),h);LITTER.push({id,p,o});});
}
function checkLitter(){
  if(!W.me.on)return;
  for(let i=LITTER.length-1;i>=0;i--){const l=LITTER[i];if(W.angTo(W.me.p,l.p)*R<1.5){
    W.scene.remove(l.o);LITTER.splice(i,1);prog.litter[l.id]=1;save();
    const n=Object.keys(prog.litter).length,total=24;
    burst(l.o.position.clone().addScaledVector(l.p,0.3),l.p,{color:0x9FE0A0,n:12});sfx('chime');
    toast(n>=total?'<b>The planet is spotless!</b> Thank you for looking after it.':'Litter picked up <b>'+n+'/'+total+'</b>. The planet thanks you',3);renderJournal();}}
}

/* ================================================================ deliveries */
let JOBS=[],job=null,marker=null,cargoObj=null;
function nearestRoadP(p,off=0){let best=null;for(const r of W.MAIN)for(let i=0;i<720;i++){const t=i/720*Math.PI*2,q=W.pointOn(r,t),d=W.angTo(q,p);if(!best||d<best.d)best={d,q,r};}return best?W.offsetP(best.q,W.tangentToward(best.q,p.clone().sub(best.q)),best.r.rh+best.r.walk+off):p;}
function setupJobs(){
  const P=W.placements,first=n=>P[n]&&P[n][0]?dirOf(P[n][0]):null;
  const cafe=first('City_Cafe')||first('Shop')||W.CITY,barn=first('Barn')||W.FARM,chalet=first('Chalet')||W.ALPS,shop=first('Shop')||first('City_Apartment')||W.CITY;
  const house=first('House_Cottage')||first('House_TwoStory')||W.CITY;
  const piers=(P.Pier||[]).map(dirOf),maplePier=piers.sort((a,b)=>W.angTo(a,W.LAKES[1].p)-W.angTo(b,W.LAKES[1].p))[0]||W.LAKES[1].p;
  const lh=W.lighthouse.p||W.LAKES[0].p,plaza=W.fountainSpot||W.CITY,meadowPick=nearestRoadP(W.MEADOW,2),igloo=iglooP||V(0,1,0);
  JOBS=[
    {id:'flowers',title:'Flowers for the café',cargo:'CargoFlowers',from:{name:'Petal Meadow',p:meadowPick},to:{name:'the café',p:cafe},thanks:'The café owner puts them on every table.'},
    {id:'firewood',title:'Firewood for a chalet',cargo:'CargoLogs',from:{name:'the barn at Butter Farms',p:barn},to:{name:'a chalet in the Alps',p:chalet},thanks:'The fire is crackling. Cocoa, anyone?'},
    {id:'letter',title:'A letter for the lighthouse keeper',cargo:'CargoLetter',from:{name:'the fountain plaza',p:plaza},to:{name:'the lighthouse',p:lh},thanks:'The keeper reads it twice and smiles.'},
    {id:'picnic',title:'A picnic for Maple Lake',cargo:'CargoBasket',from:{name:'a cottage in the suburbs',p:house},to:{name:'the Maple Lake pier',p:maplePier},thanks:'A perfect afternoon by the water.'},
    {id:'apples',title:'Apples for the city',cargo:'CargoCrates',from:{name:'Butter Farms',p:barn},to:{name:'a city shop',p:shop},thanks:'Fresh apples, straight from the farm!'},
    {id:'cocoa',title:'Hot cocoa for the snow builders',cargo:'CargoFlask',from:{name:'the café',p:cafe},to:{name:'the igloo in the Snowy North',p:igloo},thanks:'Warm hands and happy faces.'}
  ];
  marker=model('Marker');marker.visible=false;marker.traverse(c=>{c.castShadow=false;});W.scene.add(marker);
}
function startJob(id){job={j:JOBS.find(x=>x.id===id),stage:'pickup'};if(W.me.on&&!W.me.sit){}toast('Pick up <b>'+job.j.title.toLowerCase()+'</b> at '+job.j.from.name,3);openJournal(false);renderJournal();}
function jobTarget(){return job?(job.stage==='pickup'?job.j.from:job.j.to):null;}
function updateJob(dt,t){
  if(!job){marker.visible=false;return;}
  const tg=jobTarget();marker.visible=true;
  const h=W.hAt(tg.p);marker.position.copy(tg.p).multiplyScalar(R+Math.max(h,0)+5+Math.sin(t*2)*0.4);
  marker.quaternion.copy(W.quatUpFront(tg.p,W.randomTangent(tg.p)));marker.userData.ring.rotation.z=t;
  const dCar=W.angTo(W.car.p,tg.p)*R,dMe=W.angTo(W.me.p,tg.p)*R;
  const arrived=(!W.me.on&&dCar<20)||(W.me.on&&dMe<6&&dCar<70);
  if(!arrived)return;
  if(job.stage==='pickup'){
    job.stage='deliver';sfx('chime');
    cargoObj=model(job.j.cargo);cargoObj.position.set(-0.85,1.08,0);W.truckBody.add(cargoObj);
    toast('Loaded! Now take it to <b>'+job.j.to.name+'</b>',3);
  }else{
    if(cargoObj){W.truckBody.remove(cargoObj);cargoObj=null;}
    prog.jobs[job.j.id]=(prog.jobs[job.j.id]||0)+1;prog.hearts++;save();
    burst(marker.position.clone(),tg.p,{color:0xF4A99B,n:16,speed:3});sfx('success');
    toast('Delivered! '+job.j.thanks+' <b>+1 heart</b>',4);job=null;renderJournal();
  }
}

/* ================================================================ kite */
const K={on:false};
function startKite(){
  const me=W.me;Object.assign(K,{on:true,t:45,score:0,theta:0,phi:0.6,low:0,wind:me.f.clone(),stars:[]});
  me.frozen=true;
  K.kite=model('Kite');W.scene.add(K.kite);
  K.line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0,0,0),V(0,0,1)]),new THREE.LineBasicMaterial({color:0xFFFFFF,transparent:true,opacity:0.8}));K.line.frustumCulled=false;W.scene.add(K.line);
  for(let i=0;i<3;i++)K.stars.push(newStar());
  toast('Kite up! <kbd>A</kbd><kbd>D</kbd> steer, <kbd>W</kbd><kbd>S</kbd> climb and dive. Catch the stars. <kbd>F</kbd> to stop',4);
}
function newStar(){const s=new THREE.Mesh(new THREE.OctahedronGeometry(0.45,0),new THREE.MeshBasicMaterial({color:OP.lin(0xFFE08A)}));W.scene.add(s);s.userData={theta:range(-0.9,0.9),phi:range(0.35,1.15)};return s;}
function kitePos(theta,phi,L=18){const me=W.me,upv=me.p,side=V(0,0,0).crossVectors(K.wind,upv).normalize();
  const hand=me.p.clone().multiplyScalar(R+me.h+1.1);
  return hand.clone().addScaledVector(K.wind,L*Math.cos(phi)*Math.cos(theta)).addScaledVector(side,L*Math.cos(phi)*Math.sin(theta)).addScaledVector(upv,L*Math.sin(phi));}
function updateKite(dt,t){
  if(!K.on)return;
  const k=W.keys;K.t-=dt;
  K.theta+=((k.d?1:0)-(k.a?1:0))*1.1*dt+Math.sin(t*0.8)*0.12*dt;K.theta=Math.max(-1.25,Math.min(1.25,K.theta));
  K.phi+=((k.w?1:0)-(k.s?1:0))*0.8*dt-0.06*dt+Math.sin(t*1.3)*0.05*dt;K.phi=Math.max(0.05,Math.min(1.35,K.phi));
  if(K.phi<0.14){K.low+=dt;if(K.low>1)return endKite('The kite dipped into the grass!');}else K.low=0;
  const kp=kitePos(K.theta,K.phi),me=W.me,hand=me.p.clone().multiplyScalar(R+me.h+1.1);
  K.kite.position.copy(kp);K.kite.up.copy(me.p);K.kite.lookAt(hand);K.kite.rotateZ(Math.sin(t*2)*0.2);
  K.kite.userData.tail.forEach((b,i)=>{b.position.x=Math.sin(t*4-i)*0.12*i;});
  const pos=K.line.geometry.attributes.position;pos.setXYZ(0,hand.x,hand.y,hand.z);pos.setXYZ(1,kp.x,kp.y,kp.z);pos.needsUpdate=true;
  me.lookTarget=hand.clone().lerp(kp,0.55);
  me.f.copy(W.tangentToward(me.p,kp.clone().normalize().sub(me.p)));
  for(let i=0;i<K.stars.length;i++){const s=K.stars[i],sp=kitePos(s.userData.theta,s.userData.phi);s.position.copy(sp);s.rotation.y+=dt*2;
    if(sp.distanceTo(kp)<1.6){K.score++;sfx('chime');burst(sp,me.p,{color:0xFFE08A,n:10,grav:0});W.scene.remove(s);K.stars[i]=newStar();}}
  if(K.t<=0)endKite('Time! The wind settles.');
}
function endKite(why){
  if(!K.on)return;K.on=false;W.scene.remove(K.kite);W.scene.remove(K.line);K.stars.forEach(s=>W.scene.remove(s));
  W.me.frozen=false;W.me.lookTarget=null;
  const best=K.score>prog.kiteBest;if(best){prog.kiteBest=K.score;save();}
  toast(why+' You caught <b>'+K.score+'</b> star'+(K.score===1?'':'s')+(best?'. A new best!':''),4);renderJournal();
}

/* ================================================================ fishing */
const FISHES={
  'Lake Lull':[['Sunny perch',12,24,5],['Bluegill',12,22,4],['Rainbow trout',25,48,2,'day'],['Golden koi',30,55,0.6],['Moonfish',20,40,1.6,'night']],
  'Maple Lake':[['Maple carp',20,45,5],['Rosy minnow',6,12,4],['Autumn pike',35,70,1.4],['Moonfish',20,40,1.6,'night']],
  'Ribbon River':[['River trout',20,40,5],['Pebble loach',8,15,4],['Silver dace',12,22,3]],
  'Alpine lake':[['Alpine char',20,38,4],['Glacier trout',25,45,1.5]]
};
const FS={on:false};
function waterAhead(){
  const me=W.me;for(const d of [2.5,3.5,4.5]){const p=W.offsetP(me.p,me.f,d),wl=W.waterLevelAt(p);if(wl>-1e8&&wl-W.hAt(p)>0.25)return{p,wl};}
  return null;
}
function waterName(p){for(const L of W.LAKES)if(W.angTo(p,L.p)*R<L.r*1.4)return L.name;if(W.angTo(p,W.ALPINE.p)*R<W.ALPINE.r+2)return'Alpine lake';return'Ribbon River';}
function startFishing(wa){
  const me=W.me;Object.assign(FS,{on:true,state:'wait',t:range(2.5,6.5)+(W.TOD.night>0.5?1.5:0),p:wa.p,wl:wa.wl,lake:waterName(wa.p)});
  me.frozen=true;me.f.copy(W.tangentToward(me.p,wa.p.clone().sub(me.p)));
  FS.rod=model('FishingRod');const arm=me.model.userData.arms[1];FS.rod.position.set(0,-0.38,0.05);FS.rod.rotation.x=1.1;arm.add(FS.rod);arm.rotation.x=-0.9;
  FS.bob=model('Bobber');W.scene.add(FS.bob);
  FS.line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0,0,0),V(0,0,1)]),new THREE.LineBasicMaterial({color:0xFFFFFF,transparent:true,opacity:0.7}));FS.line.frustumCulled=false;W.scene.add(FS.line);
  ring(wa.p.clone().multiplyScalar(R+wa.wl+0.02),wa.p,0xEFFBFF,0.6);sfx('splash');
  toast('Cast! Wait for the bobber to dip, then press <kbd>F</kbd>',3);
}
function updateFishing(dt,t){
  if(!FS.on)return;FS.t-=dt;
  let dip=0;
  if(FS.state==='wait'&&FS.t<=0){FS.state='bite';FS.t=1.0;sfx('bite');toast('<b>A bite!</b> Press <kbd>F</kbd>!',1);}
  else if(FS.state==='bite'){dip=-0.09-Math.abs(Math.sin(t*18))*0.05;if(FS.t<=0)return endFishing('It got away. Press <kbd>F</kbd> to cast again.');}
  const bp=FS.p.clone().multiplyScalar(R+FS.wl+0.02+Math.sin(t*2.2)*0.012+dip);
  FS.bob.position.copy(bp);FS.bob.quaternion.copy(W.quatUpFront(FS.p,W.randomTangent(FS.p)));
  const tip=new THREE.Vector3();FS.rod.updateMatrixWorld(true);FS.rod.localToWorld(tip.set(0,1.6,0));
  const pos=FS.line.geometry.attributes.position;pos.setXYZ(0,tip.x,tip.y,tip.z);pos.setXYZ(1,bp.x,bp.y,bp.z);pos.needsUpdate=true;
}
function reel(){
  if(FS.state!=='bite')return endFishing('You reel in. Press <kbd>F</kbd> to cast again.');
  const list=FISHES[FS.lake]||FISHES['Lake Lull'],night=W.TOD.night>0.5;
  const ok=list.filter(f=>!f[4]||(f[4]==='night'?night:!night));let tot=ok.reduce((s,f)=>s+f[3],0),r=Math.random()*tot,c=ok[0];
  for(const f of ok){r-=f[3];if(r<=0){c=f;break;}}
  const size=Math.round(c[1]+Math.random()*(c[2]-c[1])),key=c[0],best=!prog.fish[key]||size>prog.fish[key];
  if(best){prog.fish[key]=size;save();}
  sfx('success');burst(FS.bob.position.clone(),FS.p,{color:0x9ED8EA,n:14});
  endFishing('You caught a <b>'+key+'</b> ('+size+' cm)'+(best?', a new record':'')+'! Released back into the water.');
}
function endFishing(msg){
  if(!FS.on)return;FS.on=false;W.scene.remove(FS.bob);W.scene.remove(FS.line);
  const arm=W.me.model.userData.arms[1];arm.remove(FS.rod);arm.rotation.x=0;W.me.frozen=false;
  if(msg)toast(msg,4);renderJournal();
}

/* ================================================================ snowballs + snow fort */
const balls=[],fort={targets:[],on:false,t:0,hits:0};
function setupFort(){
  if(!iglooP)return;
  const p=findSpot(()=>W.offsetP(iglooP,W.randomTangent(iglooP),range(10,16)),6,{slope:0.85,clear:3});if(!p)return;
  fort.p=p;const front=W.randomTangent(p);anchor(model('SnowFort'),p,front,W.hAt(p)-0.05);
  const right=V(0,0,0).crossVectors(p,front).normalize();
  for(let k=0;k<6;k++){const q=W.offsetP(W.offsetP(p,front,-5.5-(k%2)*2),right,(k-2.5)*1.6);const o=W.cloneAsset('Snowman');anchor(o,q,front,W.hAt(q)-0.05);fort.targets.push({o,p:q,down:0,front,base:o.quaternion.clone()});}
}
function throwBall(){
  const me=W.me,fp=W.state.cam==='driver';
  const dir=fp?W.camera.getWorldDirection(new THREE.Vector3()):me.f.clone().addScaledVector(me.p,0.35).normalize();
  const o=model('Snowball');const start=me.p.clone().multiplyScalar(R+me.h+1.45).addScaledVector(me.f,0.4);o.position.copy(start);W.scene.add(o);
  balls.push({o,v:dir.multiplyScalar(15).addScaledVector(me.p,fp?2.5:3.5),t:0});
  const arm=me.model.userData.arms[1];arm.rotation.x=-2.6;setTimeout(()=>{arm.rotation.x=0;},250);
  sfx('whoosh');
  if(fort.p&&!fort.on&&W.angTo(me.p,fort.p)*R<30){fort.on=true;fort.t=0;fort.hits=0;fort.targets.forEach(x=>x.down=0);toast('Snow fort challenge! Knock over all six snowmen',3);}
}
function updateSnow(dt){
  if(fort.on){fort.t+=dt;if(fort.t>120){fort.on=false;toast('The snowmen win this time. Throw again to retry',3);}}
  for(let i=balls.length-1;i>=0;i--){const b=balls[i];b.t+=dt;
    const upv=b.o.position.clone().normalize();b.v.addScaledVector(upv,-9.8*dt);b.o.position.addScaledVector(b.v,dt);
    const dir=b.o.position.clone().normalize(),alt=b.o.position.length()-R,g=W.hAt(dir);
    let hit=false;
    for(const tg of fort.targets){if(tg.down>0)continue;const c=tg.p.clone().multiplyScalar(R+W.hAt(tg.p)+1.1);
      if(b.o.position.distanceTo(c)<0.9){tg.down=0.01;hit=true;burst(c,tg.p,{color:0xFFFFFF,n:14,speed:3});sfx('pop');
        if(fort.on){fort.hits++;if(fort.hits>=6){fort.on=false;const tm=fort.t;const best=!prog.fortBest||tm<prog.fortBest;if(best){prog.fortBest=Math.round(tm*10)/10;save();}
          toast('All six down in <b>'+tm.toFixed(1)+' s</b>'+(best?', a new record!':'!'),4);sfx('success');renderJournal();}}}}
    if(hit||alt<g+0.05||b.t>4){if(!hit)burst(b.o.position.clone(),dir,{color:0xFFFFFF,n:6,speed:1.5,size:0.05});W.scene.remove(b.o);balls.splice(i,1);}
  }
  for(const tg of fort.targets){
    if(tg.down>0){tg.down+=dt;const k=Math.min(1,tg.down/0.35);
      tg.o.quaternion.copy(tg.base).multiply(new THREE.Quaternion().setFromAxisAngle(V(1,0,0),-k*1.45));
      if(tg.down>4.5){tg.down=0;tg.o.quaternion.copy(tg.base);}}
  }
}

/* ================================================================ balloon ride */
const BR={on:false};
function setupBalloon(){
  const p=findSpot(()=>W.offsetP(W.FARM,W.randomTangent(W.FARM),range(18,40)),4,{slope:0.9});if(!p)return;
  BR.pad=p;BR.front=W.randomTangent(p);BR.h=W.hAt(p);
  anchor(model('BalloonPad'),p,BR.front,BR.h-0.05);
  BR.obj=W.cloneAsset('Balloon',{Balloon:0xFFB3C7,BalloonStripe:0xFFF4D6});anchor(BR.obj,p,BR.front,BR.h+0.15);
}
function startRide(){
  const me=W.me;Object.assign(BR,{on:true,phase:'up',t:0,alt:0,a:0,dir0:BR.pad.clone(),heading:me.f.clone()});
  me.frozen=true;me.p.copy(BR.pad);me.h=BR.h+0.35;BR.n=V(0,0,0).crossVectors(BR.pad,BR.heading).normalize();
  toast('Up, up and away! A slow loop around the planet. Press <kbd>E</kbd> to come back down early',4);sfx('whoosh');
}
function updateRide(dt,t){
  if(!BR.on)return;const me=W.me;BR.t+=dt;
  const ALT=40,LOOP=2*Math.PI*(R+ALT)/7;
  if(BR.phase==='up'){BR.alt=ALT*smooth01(BR.t/12);if(BR.t>12){BR.phase='cruise';BR.t=0;}}
  else if(BR.phase==='cruise'){BR.a=BR.t/LOOP*Math.PI*2;if(BR.t>LOOP){BR.phase='down';BR.t=0;BR.a=0;}}
  else if(BR.phase==='down'){BR.alt=ALT*(1-smooth01(BR.t/10));if(BR.t>10)return endRide();}
  const p=BR.dir0.clone().applyAxisAngle(BR.n,BR.a).normalize();
  BR.obj.position.copy(p).multiplyScalar(R+BR.h+0.15+BR.alt+Math.sin(t*0.6)*0.3*(BR.alt>2?1:0));
  BR.obj.quaternion.copy(W.quatUpFront(p,BR.front));
  me.p.copy(p);me.h=BR.h+0.35+BR.alt+(BR.alt>2?Math.sin(t*0.6)*0.3:0);
}
const smooth01=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
function endRide(){
  BR.on=false;const me=W.me;me.frozen=false;me.p.copy(W.offsetP(BR.pad,BR.front,3.2));me.h=W.groundH(me.p);
  BR.obj.position.copy(BR.pad).multiplyScalar(R+BR.h+0.15);BR.obj.quaternion.copy(W.quatUpFront(BR.pad,BR.front));
  prog.balloon++;save();toast('Gentle landing. What a view!',3);renderJournal();
}

/* ================================================================ photo journal */
const MOMENTS=[
  {id:'ducks',name:'Duck family',hint:'A mother duck and her ducklings, close up.',test:()=>W.ducks.some(d=>d.lag===0&&d.wp&&inFrame(d.wp,32))},
  {id:'sugarsun',name:'Sugarhorn at sunset',hint:'The tallest peak in golden light.',test:()=>W.TOD.gold>0.3&&inFrame(W.PEAKS[0].p.clone().multiplyScalar(R+W.PEAKS[0].H*0.8),320)},
  {id:'banner',name:'The banner plane',hint:'"Our Beautiful Planet", written across the sky.',test:()=>W.anim.planes[0]&&inFrame(W.anim.planes[0].g.position,170)},
  {id:'lighthouse',name:'Lighthouse at night',hint:'Its beam sweeping across Lake Lull after dark.',test:()=>W.TOD.night>0.5&&W.lighthouse.p&&inFrame(W.lighthouse.p.clone().multiplyScalar(R+W.lighthouse.h+8),130)},
  {id:'balloon',name:'Hot air balloon',hint:'One of the balloons drifting overhead.',test:()=>W.anim.balloons.some(b=>inFrame(b.o.position,130))},
  {id:'ferris',name:'Ferris wheel at night',hint:'The city wheel turning under the stars.',test:()=>W.TOD.night>0.5&&W.ferrisG&&inFrame(W.ferrisG.position.clone().addScaledVector(W.ferrisG.position.clone().normalize(),9),160)},
  {id:'sail',name:'Sailboats',hint:'Sails out on Lake Lull.',test:()=>W.boats.some(b=>!b.model&&b.wp&&inFrame(b.wp,90))},
  {id:'windmill',name:'Windmills at work',hint:'The sails turning at Butter Farms.',test:()=>(W.placements.Windmill_Body||[]).some(w=>inFrame(w.pos.clone().addScaledVector(w.pos.clone().normalize(),6),90))},
  {id:'bridge',name:'The stone bridge',hint:'Ribbon River flowing under the arch.',test:()=>W.bridgeAt&&inFrame(W.bridgeAt.clone().multiplyScalar(R-1),70)},
  {id:'snowman',name:'A snowman',hint:'Someone built one in the Snowy North.',test:()=>(W.placements.Snowman||[]).some(s=>inFrame(s.pos.clone().addScaledVector(s.pos.clone().normalize(),1),40))},
  {id:'alpine',name:'The alpine lake',hint:'Turquoise water high in the mountains.',test:()=>inFrame(W.ALPINE.p.clone().multiplyScalar(R+W.ALPINE.level),100)},
  {id:'deer',name:'A deer in the wild',hint:'Get close without startling it.',test:()=>animals.some(a=>a.kind==='deer'&&a.o.visible&&inFrame(a.o.position.clone().addScaledVector(a.p,1),35))},
  {id:'citylights',name:'City lights',hint:'Pastel City glowing at night, seen from a distance.',test:()=>W.TOD.night>0.6&&inFrame(W.CITY.clone().multiplyScalar(R+10),300,45)}
];
let photoMode=false,snapPending=false;
function setPhoto(on){
  photoMode=on;document.body.classList.toggle('photo',on);$('#viewfinder').hidden=!on;
  if(on)toast('Frame your shot. Click or press <kbd>Space</kbd> to take it, <kbd>P</kbd> or <kbd>Esc</kbd> to put the camera away',3.5);
}
function snap(){snapPending=true;}
function afterRender(){
  if(!snapPending)return;snapPending=false;
  const src=W.renderer.domElement,c=document.createElement('canvas'),w=360,h=Math.round(360*src.height/src.width);c.width=w;c.height=h;
  c.getContext('2d').drawImage(src,0,0,w,h);
  const img=c.toDataURL('image/jpeg',0.78);
  const found=MOMENTS.filter(m=>{try{return m.test();}catch(e){return false;}});
  const fresh=found.filter(m=>!prog.moments[m.id]);
  fresh.forEach(m=>prog.moments[m.id]=Date.now());save();
  const hh=Math.floor(W.TOD.hour),mm=Math.floor((W.TOD.hour-hh)*60);
  album.push({img,when:Date.now(),place:W.zoneName(W.focusP()),time:String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0'),tags:found.map(m=>m.name)});saveAlbum();
  const fl=$('#flash');fl.style.opacity=1;setTimeout(()=>{fl.style.opacity=0;},90);sfx('shutter');
  toast(fresh.length?'New moment: <b>'+fresh.map(m=>m.name).join(', ')+'</b>! ('+Object.keys(prog.moments).length+'/'+MOMENTS.length+')':found.length?'Lovely shot of '+found[0].name.toLowerCase()+'. Saved to your album':'Saved to your album',3.2);
  renderJournal();
}

/* ================================================================ journal UI */
let tab='moments';
const TABS={moments:'Moments',album:'Album',guide:'Field guide',wonders:'Wonders',jobs:'Jobs',games:'Games'};
function openJournal(v){const j=$('#journal');j.hidden=!v;$('#journalBtn').setAttribute('aria-pressed',String(v));if(v)renderJournal();else W.canvas.focus({preventScroll:true});}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function renderJournal(){
  const j=$('#journal');if(!j||j.hidden)return;
  const tabs=$('#jtabs');tabs.innerHTML='';
  for(const [k,v] of Object.entries(TABS)){const b=document.createElement('button');b.type='button';b.textContent=v;b.setAttribute('aria-pressed',String(k===tab));b.onclick=()=>{tab=k;renderJournal();};tabs.appendChild(b);}
  const total=MOMENTS.length+GUIDE.length+WONDERS.length,got=Object.keys(prog.moments).length+Object.keys(prog.guide).length+Object.keys(prog.wonders).length;
  $('#jprog').innerHTML='<b>'+got+'</b> of '+total+' discoveries · <b>'+prog.hearts+'</b> hearts · <b>'+Object.keys(prog.litter).length+'</b>/24 litter picked up';
  $('#jbar').style.width=(got/total*100).toFixed(1)+'%';
  const body=$('#jbody');let h='';
  const card=(done,title,sub,extra='')=>'<li class="jc'+(done?' done':'')+'"><span class="dot" aria-hidden="true"></span><div><b>'+esc(title)+'</b><small>'+sub+'</small></div>'+extra+'</li>';
  if(tab==='moments'){h='<p class="jnote">Press <kbd>P</kbd> (or the camera button) and take a photo with the moment in frame.</p><ul class="jl">'+MOMENTS.map(m=>card(prog.moments[m.id],prog.moments[m.id]?m.name:'???',esc(m.hint))).join('')+'</ul>';}
  else if(tab==='album'){h=album.length?'<div class="alb">'+album.slice().reverse().map(a=>'<figure><img src="'+a.img+'" alt="Photo at '+esc(a.place)+'"><figcaption><b>'+esc(a.place)+'</b> · '+esc(a.time)+(a.tags.length?'<br>'+esc(a.tags.join(', ')):'')+'</figcaption></figure>').join('')+'</div>':'<p class="jnote">No photos yet. Press <kbd>P</kbd> to open the camera.</p>';}
  else if(tab==='guide'){h='<p class="jnote">Get close to animals to add them to your field guide.</p><ul class="jl">'+GUIDE.map(g=>card(prog.guide[g.id],prog.guide[g.id]?g.name:'???',esc(g.note))).join('')+'</ul>'
    +'<h3>Fish log</h3>'+(Object.keys(prog.fish).length?'<ul class="jl">'+Object.entries(prog.fish).map(([k,v])=>card(true,k,'Best: '+v+' cm')).join('')+'</ul>':'<p class="jnote">Press <kbd>F</kbd> facing the water to go fishing.</p>');}
  else if(tab==='wonders'){h='<p class="jnote">Ten hidden wonders. Each riddle points the way.</p><ul class="jl">'+WONDERS.map(w=>card(prog.wonders[w.id],prog.wonders[w.id]?w.name:'Undiscovered',esc(w.hint))).join('')+'</ul>';}
  else if(tab==='jobs'){h='<p class="jnote">Help your neighbours. Pick a job and follow the floating marker.</p><ul class="jl">'+JOBS.map(x=>{const n=prog.jobs[x.id]||0,act=job&&job.j.id===x.id;
      return card(n>0,x.title,esc(x.from.name)+' → '+esc(x.to.name)+(n?' · done '+n+'×':''),'<button type="button" class="jbtn" data-job="'+x.id+'"'+(act?' disabled':'')+'>'+(act?'In progress':'Start')+'</button>');}).join('')+'</ul>'
    +(job?'<p class="jnote">Current: '+esc(job.j.title)+' <button type="button" class="jbtn" id="cancelJob">Cancel job</button></p>':'');}
  else if(tab==='games'){h='<ul class="jl">'+[
      card(prog.kiteBest>0,'Kite flying','On open grass, press <kbd>F</kbd>. Best: '+prog.kiteBest+' stars'),
      card(Object.keys(prog.fish).length>0,'Fishing','Face a lake or the river and press <kbd>F</kbd>. Species caught: '+Object.keys(prog.fish).length),
      card(prog.fortBest>0,'Snow fort','Near the igloo in the Snowy North, press <kbd>F</kbd> to throw snowballs.'+(prog.fortBest?' Best: '+prog.fortBest+' s':'')),
      card(prog.balloon>0,'Balloon ride','Find the balloon at Butter Farms and press <kbd>E</kbd>. Rides: '+prog.balloon),
      card(Object.keys(prog.litter).length>=24,'Tidy the planet','Walk over litter to pick it up: '+Object.keys(prog.litter).length+'/24')
    ].join('')+'</ul><p class="jnote"><button type="button" class="jbtn" id="resetProg">Reset all progress</button></p>';}
  body.innerHTML=h;
  body.querySelectorAll('[data-job]').forEach(b=>b.onclick=()=>startJob(b.dataset.job));
  const cj=$('#cancelJob');if(cj)cj.onclick=()=>{if(cargoObj){W.truckBody.remove(cargoObj);cargoObj=null;}job=null;renderJournal();};
  const rp=$('#resetProg');if(rp)rp.onclick=()=>{if(rp.dataset.sure){for(const k of ['moments','guide','wonders','litter','jobs','fish'])prog[k]={};prog.hearts=0;prog.kiteBest=0;prog.fortBest=0;prog.balloon=0;album=[];save();saveAlbum();renderJournal();toast('Progress reset. Litter returns after a reload',3);}else{rp.dataset.sure=1;rp.textContent='Click again to confirm';}};
}

/* ================================================================ tracker + context prompts */
let promptT=0,lastPrompt='';
function updateTracker(){
  const el=$('#tracker');let html='';
  if(job){const tg=jobTarget(),d=Math.round(W.angTo(W.focusP(),tg.p)*R);
    const v=tg.p.clone().multiplyScalar(R).sub(W.camera.position).applyQuaternion(W.camera.quaternion.clone().invert());
    const ang=Math.atan2(v.x,-v.z);
    html='<span class="arr" style="transform:rotate('+ang.toFixed(2)+'rad)">↑</span><div><b>'+esc(job.j.title)+'</b><small>'+(job.stage==='pickup'?'Pick up at ':'Deliver to ')+esc(tg.name)+' · '+d+' m</small></div>';}
  else if(K.on)html='<span class="arr">★</span><div><b>Kite flying</b><small>'+K.score+' stars · '+Math.ceil(K.t)+' s left</small></div>';
  else if(fort.on)html='<span class="arr">❄</span><div><b>Snow fort</b><small>'+fort.hits+'/6 down · '+fort.t.toFixed(1)+' s</small></div>';
  else if(FS.on)html='<span class="arr">~</span><div><b>Fishing at '+esc(FS.lake)+'</b><small>'+(FS.state==='bite'?'A bite! Press F':'Waiting for a bite…')+'</small></div>';
  else if(BR.on)html='<span class="arr">◯</span><div><b>Balloon ride</b><small>'+(BR.phase==='cruise'?'Drifting around the planet':'Floating '+(BR.phase==='up'?'up':'down'))+'</small></div>';
  el.hidden=!html;if(html&&el.innerHTML!==html)el.innerHTML=html;
}
function contextPrompt(dt){
  promptT-=dt;if(promptT>0||!W.me.on||W.me.frozen||W.me.sit)return;
  let p='';
  if(BR.pad&&W.angTo(W.me.p,BR.pad)*R<4)p='Press <kbd>E</kbd> for a balloon ride';
  else if(W.me.p.y>0.73&&fort.p&&W.angTo(W.me.p,fort.p)*R<30)p='Press <kbd>F</kbd> to throw snowballs at the fort';
  else if(waterAhead())p='Press <kbd>F</kbd> to go fishing';
  if(p&&p!==lastPrompt){toast(p,2.2);promptT=6;lastPrompt=p;}else if(!p)lastPrompt='';
}

/* ================================================================ input */
function onAct(){
  if(BR.on){BR.phase='down';BR.t=0;BR.a=0;toast('Heading back down to the farm',2);return true;}
  if(K.on||FS.on)return true;
  if(W.me.on&&!W.me.sit&&BR.pad&&W.angTo(W.me.p,BR.pad)*R<4){startRide();return true;}
  return false;
}
function useKey(){
  const me=W.me;
  if(FS.on){reel();return;}
  if(K.on){endKite('You reel the kite in.');return;}
  if(!me.on||me.sit||me.frozen){if(!me.on)toast('Get out of the truck first (<kbd>E</kbd>)',2);return;}
  if(me.p.y>0.73){throwBall();return;}
  const wa=waterAhead();if(wa){startFishing(wa);return;}
  const z=W.zoneName(me.p);if(/City/.test(z)){toast('Too many buildings for a kite. Try a grassy hill or the meadow',2.5);return;}
  startKite();
}
function keydown(e){
  if(!W||e.target.tagName==='INPUT')return;const k=e.key.toLowerCase();
  if(photoMode){if(k===' '||k==='enter'){e.preventDefault();snap();}else if(k==='p'||k==='escape')setPhoto(false);return;}
  if(k==='p'&&!e.repeat){setPhoto(true);openJournal(false);}
  if(k==='j'&&!e.repeat)openJournal($('#journal').hidden);
  if(k==='f'&&!e.repeat)useKey();
  if(k==='escape'){openJournal(false);}
}

/* ================================================================ lifecycle */
function init(world){
  W=world;V=W.V;R=W.R;
  setupWildlife();setupWonders();setupFort();setupLitter();setupBalloon();setupJobs();
  addEventListener('keydown',keydown);
  $('#journalBtn').addEventListener('click',()=>openJournal($('#journal').hidden));
  $('#closeJournal').addEventListener('click',()=>openJournal(false));
  $('#photoBtn').addEventListener('click',()=>setPhoto(true));
  $('#viewfinder').addEventListener('click',e=>{if(e.target.closest('#vfClose'))setPhoto(false);else snap();});
  let spotT=0;OP.activities._spot=()=>{spotT=0;};
  if(/journal/.test(location.hash))setTimeout(()=>openJournal(true),50);
  OP.activities.update=(dt,t)=>{
    updateWildlife(dt,t);updateWonders(t);updateParts(dt);updateKite(dt,t);updateFishing(dt,t);updateSnow(dt);updateRide(dt,t);updateJob(dt,t);
    if((spotT-=dt)<0){spotT=0.5;checkSpotting();checkWonders();checkLitter();}
    updateTracker();contextPrompt(dt);
  };
}
OP.activities={init,onAct,afterRender,update(){},progress:prog};
})();
