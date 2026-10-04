/* Soft Pickup Planet — a cute truck on a tiny planet.
   World space: planet centred at the origin, radius R metres. Positions on the surface are
   unit vectors p (direction) plus a height h above the sea-level sphere. */
(function(){
const $=s=>document.querySelector(s);
const msg=t=>{const m=$('#msg');m.textContent=t;m.hidden=!t;};
if(!window.THREE||!THREE.GLTFLoader){msg('The 3D library could not load. Check your connection and reload.');return;}

/* ================================================================ utils */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rand=rng(7);
const pick=a=>a[Math.floor(rand()*a.length)];
const range=(a,b)=>a+rand()*(b-a);
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const N=(x,y,z)=>V(x,y,z).normalize();
const lin=hex=>new THREE.Color(hex).convertSRGBToLinear();

// 3D simplex noise (after Stefan Gustavson, public domain)
const SN=(()=>{
  const g=[1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1];
  const p=new Uint8Array(256),r=rng(42);for(let i=0;i<256;i++)p[i]=i;
  for(let i=255;i>0;i--){const j=Math.floor(r()*(i+1));const t=p[i];p[i]=p[j];p[j]=t;}
  const perm=new Uint8Array(512),pm=new Uint8Array(512);for(let i=0;i<512;i++){perm[i]=p[i&255];pm[i]=perm[i]%12;}
  const F3=1/3,G3=1/6;
  const c=(x,y,z,gi)=>{let t=0.6-x*x-y*y-z*z;if(t<0)return 0;t*=t;gi*=3;return t*t*(g[gi]*x+g[gi+1]*y+g[gi+2]*z);};
  return(xin,yin,zin)=>{
    const s=(xin+yin+zin)*F3,i=Math.floor(xin+s),j=Math.floor(yin+s),k=Math.floor(zin+s),t=(i+j+k)*G3;
    const x0=xin-(i-t),y0=yin-(j-t),z0=zin-(k-t);let i1,j1,k1,i2,j2,k2;
    if(x0>=y0){if(y0>=z0){i1=1;j1=0;k1=0;i2=1;j2=1;k2=0;}else if(x0>=z0){i1=1;j1=0;k1=0;i2=1;j2=0;k2=1;}else{i1=0;j1=0;k1=1;i2=1;j2=0;k2=1;}}
    else{if(y0<z0){i1=0;j1=0;k1=1;i2=0;j2=1;k2=1;}else if(x0<z0){i1=0;j1=1;k1=0;i2=0;j2=1;k2=1;}else{i1=0;j1=1;k1=0;i2=1;j2=1;k2=0;}}
    const ii=i&255,jj=j&255,kk=k&255;
    return 32*(c(x0,y0,z0,pm[ii+perm[jj+perm[kk]]])+c(x0-i1+G3,y0-j1+G3,z0-k1+G3,pm[ii+i1+perm[jj+j1+perm[kk+k1]]])
      +c(x0-i2+2*G3,y0-j2+2*G3,z0-k2+2*G3,pm[ii+i2+perm[jj+j2+perm[kk+k2]]])+c(x0-1+3*G3,y0-1+3*G3,z0-1+3*G3,pm[ii+1+perm[jj+1+perm[kk+1]]]));
  };
})();

/* ================================================================ renderer */
const canvas=$('#c');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true});}catch(e){msg('This browser could not start WebGL, so the game cannot run here.');return;}
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
scene.background=lin(0xCFE6F5);
const camera=new THREE.PerspectiveCamera(45,1,0.5,4000);
const ambient=new THREE.AmbientLight(lin(0xFFF6EE),0.5);scene.add(ambient);
const hemiFill=new THREE.DirectionalLight(lin(0xDDE8FF),0.18);scene.add(hemiFill,hemiFill.target);
const sun=new THREE.DirectionalLight(lin(0xFFF1DE),0.95);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.04;
scene.add(sun,sun.target);

/* ================================================================ planet geometry helpers */
const R=110;
const angD=(x,y,z,p)=>Math.acos(clamp(x*p.x+y*p.y+z*p.z,-1,1))*R;
const angTo=(a,b)=>Math.acos(clamp(a.dot(b),-1,1));
const offsetP=(p,dir,m)=>p.clone().multiplyScalar(Math.cos(m/R)).addScaledVector(dir,Math.sin(m/R)).normalize();
const tangentToward=(p,t)=>t.clone().addScaledVector(p,-t.dot(p)).normalize();
function randomUnit(){const z=range(-1,1),a=range(0,Math.PI*2),s=Math.sqrt(1-z*z);return V(s*Math.cos(a),z,s*Math.sin(a));}
const randomTangent=p=>V(0,0,0).crossVectors(p,randomUnit()).normalize();
const _m=new THREE.Matrix4(),_m2=new THREE.Matrix4(),_q=new THREE.Quaternion(),_s=V(1,1,1),_v=V(0,0,0);
function quatUpFront(up,front){const y=up.clone().normalize(),z=tangentToward(y,front),x=V(0,0,0).crossVectors(y,z);return new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(x,y,z));}
function quatUpFwdX(up,fwd){const y=up.clone().normalize(),x=tangentToward(y,fwd),z=V(0,0,0).crossVectors(x,y);return new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(x,y,z));}

/* ================================================================ roads */
// A road is a great circle (full) or an arc of one (segment from a to b).
function fullRoad(n,rh=3.5,walk=2){n=n.clone().normalize();const a=Math.abs(n.y)<0.9?V(0,1,0):V(1,0,0);const u=V(0,0,0).crossVectors(n,a).normalize();return{n,u,v:V(0,0,0).crossVectors(n,u),len:Math.PI*2,full:true,rh,walk};}
function segRoad(a,b,rh,walk){const n=V(0,0,0).crossVectors(a,b).normalize(),u=a.clone().normalize();return{n,u,v:V(0,0,0).crossVectors(n,u),len:angTo(a,b),full:false,rh,walk,a:u,b:b.clone().normalize()};}
const pointOn=(r,t)=>r.u.clone().multiplyScalar(Math.cos(t)).addScaledVector(r.v,Math.sin(t));
const tangentOn=(r,t)=>r.u.clone().multiplyScalar(-Math.sin(t)).addScaledVector(r.v,Math.cos(t));
function tOf(r,p){let t=Math.atan2(p.dot(r.v),p.dot(r.u));if(r.full&&t<0)t+=Math.PI*2;return t;}
const ROAD_A=fullRoad(V(0,1,0)),ROAD_B=fullRoad(V(1,0,0)),ROAD_C=fullRoad(V(0,0.3,1));
const MAIN=[ROAD_A,ROAD_B,ROAD_C];
const ROADS=[...MAIN];

// City: centred on the A/B crossing at +Z. Gnomonic coordinates make every great circle a straight line,
// so the street grid is exact: lon = atan2(x,z)*R, lat = atan2(y,z)*R.
const CITY=V(0,0,1),CITY_HALF=53;
const fromCity=(lon,lat)=>N(Math.tan(lon/R),Math.tan(lat/R),1);
const cityLocal=p=>p.z>0.2?{lon:Math.atan2(p.x,p.z)*R,lat:Math.atan2(p.y,p.z)*R}:null;
const CITY_OFF=[-48,-24,24,48];
for(const o of CITY_OFF){
  ROADS.push(segRoad(fromCity(-48,o),fromCity(48,o),3,1.8));   // east-west
  ROADS.push(segRoad(fromCity(o,-48),fromCity(o,48),3,1.8));   // north-south
}
function roadDistOne(r,x,y,z){
  const off=Math.asin(clamp(x*r.n.x+y*r.n.y+z*r.n.z,-1,1))*R;
  if(r.full)return Math.abs(off);
  const t=Math.atan2(x*r.v.x+y*r.v.y+z*r.v.z,x*r.u.x+y*r.u.y+z*r.u.z);
  if(t>=0&&t<=r.len)return Math.abs(off);
  return Math.min(angD(x,y,z,r.a),angD(x,y,z,r.b));
}
function roadEdge(x,y,z){let e=1e9;for(const r of ROADS){const d=roadDistOne(r,x,y,z)-r.rh-r.walk;if(d<e)e=d;}return e;}
const onRoadArc=(r,p,tol=0.6)=>{if(r.full)return true;const t=Math.atan2(p.dot(r.v),p.dot(r.u));return t>=-tol/R&&t<=r.len+tol/R;};
const crossings=[];
for(let i=0;i<ROADS.length;i++)for(let j=i+1;j<ROADS.length;j++){
  const c=V(0,0,0).crossVectors(ROADS[i].n,ROADS[j].n);if(c.lengthSq()<1e-10)continue;c.normalize();
  for(const p of [c,c.clone().negate()])if(onRoadArc(ROADS[i],p)&&onRoadArc(ROADS[j],p))crossings.push({p,a:ROADS[i],b:ROADS[j]});
}
const crossOther=(c,r)=>c.a===r?c.b:c.a;
// traffic signals: A green, A amber, all red, B green, B amber, all red
const SIG_T=[11,2.5,1.2,11,2.5,1.2],SIG_CYCLE=SIG_T.reduce((a,b)=>a+b,0);
const SIGS=crossings.filter(c=>MAIN.includes(c.a)&&MAIN.includes(c.b)).map((c,i)=>({c,time:i*7.3,t:new Map([[c.a,tOf(c.a,c.p)],[c.b,tOf(c.b,c.p)]]),city:angTo(c.p,CITY)<0.1}));
function sigState(sg,road){
  const ph=sg.time%SIG_CYCLE,A=road===sg.c.a;
  if(A)return ph<11?'g':ph<13.5?'y':'r';
  return ph<14.7?'r':ph<25.7?'g':ph<28.2?'y':'r';
}
function sigRedLeft(sg,road){const ph=sg.time%SIG_CYCLE;if(road===sg.c.a)return ph>=13.5?SIG_CYCLE-ph:0;return ph<14.7?14.7-ph:ph>=28.2?SIG_CYCLE-ph+14.7:0;}
const stopDist=(other)=>other.rh+other.walk+3.3;      // stop line, measured from the crossing centre
function nearCrossing(p,pad=0){for(const c of crossings){const o1=c.a,o2=c.b;const cl=Math.hypot(o1.rh+o1.walk,o2.rh+o2.walk)+pad;if(angTo(p,c.p)*R<cl)return true;}return false;}

/* ================================================================ landscape plan */
const tAlpsBase=tOf(ROAD_C,V(1,0,0));
const ALPS=(()=>{const a=pointOn(ROAD_C,tAlpsBase+0.55),b=pointOn(ROAD_C,tAlpsBase-0.55);return a.y>0?a:b;})();
const ALPS_R=88;
const alpsAlong=tangentOn(ROAD_C,tOf(ROAD_C,ALPS)),alpsSide=ROAD_C.n.clone();
const alpsPoint=(along,side)=>offsetP(offsetP(ALPS,alpsAlong,along),alpsSide,side);
const PEAKS=[
  {p:alpsPoint(10,-46),H:76,rad:38,k:1.2,facet:0.62,name:'Sugarhorn'},
  {p:alpsPoint(-26,-42),H:54,rad:32,k:1.35,facet:0.3},{p:alpsPoint(44,-40),H:52,rad:32,k:1.35,facet:0.35},
  {p:alpsPoint(42,44),H:58,rad:34,k:1.3,facet:0.4},{p:alpsPoint(-36,46),H:50,rad:32,k:1.4,facet:0.3},
  {p:alpsPoint(-6,66),H:44,rad:28,k:1.45,facet:0.25},{p:alpsPoint(70,6),H:38,rad:26,k:1.5,facet:0.2},{p:alpsPoint(-64,-16),H:34,rad:24,k:1.6,facet:0.2}
];
PEAKS.forEach((P,i)=>{const t=tangentToward(P.p,alpsAlong);const a=0.4+i*0.7;const t2=V(0,0,0).crossVectors(P.p,t);P.e1=t.clone().multiplyScalar(Math.cos(a)).addScaledVector(t2,Math.sin(a));P.e2=V(0,0,0).crossVectors(P.p,P.e1);});
const ALPINE={p:alpsPoint(0,36),r:9,level:14};
const BIGLAKE={p:N(0.55,-0.55,0.63),r:22,level:-1.6,depth:2.8,slope:0.3,seed:3.1,name:'Lake Lull',
  water:[0xA6E5DD,0x6DB6D9]};
const MAPLE={p:N(-0.5,-0.6,-0.35),r:20,level:-1.3,depth:2.5,slope:0.32,seed:5.3,name:'Maple Lake',water:[0xB0E6D6,0x74B9D2]};
const LAKES=[BIGLAKE,MAPLE];
for(const L of LAKES){const t=V(0,0,0).crossVectors(L.p,V(0.3,1,0.2).normalize()).normalize();L.island={p:offsetP(L.p,t,L.r*0.38),r:L===BIGLAKE?4.2:3.4,h:L.level+1.1};}
const FARM=N(0,0.18,-1),MEADOW=N(-0.72,-0.45,0.5);

// farm fields (striped colour patches on flat ground)
const CROP_COLS=[0xD9DE8E,0xE8D690,0xB9D486,0xE2C99A,0xC8DC92];
const fields=[];
for(let i=0;i<500&&fields.length<9;i++){
  const p=offsetP(FARM,randomTangent(FARM),range(8,52)),r=range(7,10.5);
  const e=roadEdge(p.x,p.y,p.z);if(e<r+1.5)continue;
  if(fields.some(f=>angTo(f.p,p)*R<f.r+r+3))continue;
  const c=lin(pick(CROP_COLS));fields.push({p,r,c,d:c.clone().multiplyScalar(0.84),dir:randomTangent(p)});
}

// river: from the alpine lake, through the foothills, under the main road, into the big lake
const river=(()=>{
  const ctrl=[ALPINE.p.clone(),offsetP(ALPINE.p,alpsSide,11),N(0.87,0.33,0.37),N(0.85,0.16,0.5),N(0.815,0,0.58),N(0.74,-0.17,0.65),N(0.66,-0.36,0.66),offsetP(BIGLAKE.p,N(0.7,0.4,0.2),8)];
  const pts=[];
  for(let i=0;i<ctrl.length-1;i++){
    const p0=ctrl[Math.max(0,i-1)],p1=ctrl[i],p2=ctrl[i+1],p3=ctrl[Math.min(ctrl.length-1,i+2)];
    for(let k=0;k<60;k++){
      const t=k/60,t2=t*t,t3=t2*t;
      const v=V(0,0,0).addScaledVector(p0,-0.5*t3+t2-0.5*t).addScaledVector(p1,1.5*t3-2.5*t2+1).addScaledVector(p2,-1.5*t3+2*t2+0.5*t).addScaledVector(p3,0.5*t3-0.5*t2);
      pts.push(v.normalize());
    }
  }
  pts.push(ctrl[ctrl.length-1].clone());
  let s=0;const S=[0];for(let i=1;i<pts.length;i++){s+=angTo(pts[i-1],pts[i])*R;S.push(s);}
  const L=s;
  // gentle meanders in the lowlands only
  const out=pts.map((p,i)=>{
    const tg=tangentToward(p,(pts[Math.min(i+1,pts.length-1)].clone().sub(pts[Math.max(i-1,0)]))),rt=V(0,0,0).crossVectors(tg,p).normalize();
    const m=(Math.sin(S[i]*0.07)*4.5+Math.sin(S[i]*0.17+1)*1.6)*smooth(0.3,0.42,S[i]/L)*smooth(1,0.9,S[i]/L);
    return offsetP(p,rt,m);
  });
  const SS=[0];s=0;for(let i=1;i<out.length;i++){s+=angTo(out[i-1],out[i])*R;SS.push(s);}
  let sx=0;for(let i=1;i<out.length;i++)if(out[i-1].y>0&&out[i].y<=0){sx=SS[i];break;}
  const level=sv=>sv<sx?-1.2+(ALPINE.level+1.2)*Math.pow(1-sv/sx,2.1):lerp(-1.2,BIGLAKE.level+0.05,(sv-sx)/(s-sx));
  const width=sv=>lerp(3.2,8,sv/s);
  const mid=out[Math.floor(out.length/2)].clone(),ext=Math.max(...out.map(p=>angTo(p,mid)))*R+70;
  return{pts:out,S:SS,L:s,sx,level,width,mid,ext};
})();
let lastRiver={d:1e9,s:0};
function riverNearest(x,y,z){
  if(angD(x,y,z,river.mid)>river.ext)return lastRiver={d:1e9,s:0};
  const P=river.pts;let best=1e9,bs=0;
  for(let i=0;i<P.length-1;i+=6){const a=P[i];const dx=x-a.x,dy=y-a.y,dz=z-a.z,d=dx*dx+dy*dy+dz*dz;if(d<best){best=d;bs=i;}}
  best=1e9;let s=0;
  for(let i=Math.max(0,bs-8);i<Math.min(P.length-1,bs+8);i++){
    const a=P[i],b=P[i+1],ex=b.x-a.x,ey=b.y-a.y,ez=b.z-a.z,l2=ex*ex+ey*ey+ez*ez;
    let t=((x-a.x)*ex+(y-a.y)*ey+(z-a.z)*ez)/l2;t=clamp(t,0,1);
    const qx=a.x+ex*t-x,qy=a.y+ey*t-y,qz=a.z+ez*t-z,d=qx*qx+qy*qy+qz*qz;
    if(d<best){best=d;s=lerp(river.S[i],river.S[i+1],t);}
  }
  return lastRiver={d:Math.sqrt(best)*R,s};
}

/* ================================================================ terrain height */
function ridged(x,y,z){
  let sum=0,amp=0.5,f=3.1,w=1;
  for(let o=0;o<5;o++){let n=1-Math.abs(SN(x*f+o*7.3,y*f+o*1.9,z*f+o*4.1));n*=n;n*=w;w=clamp(n*2,0,1);sum+=n*amp;f*=2.03;amp*=0.5;}
  return sum;
}
function alpsH(x,y,z,da){
  const m=smooth(ALPS_R,ALPS_R*0.25,da),r=ridged(x,y,z);
  let h=Math.pow(m,1.3)*(Math.pow(r,1.35)*46+3);
  let pk=0;
  for(const P of PEAKS){
    const dx=x-P.p.x,dy=y-P.p.y,dz=z-P.p.z;
    const lx=(dx*P.e1.x+dy*P.e1.y+dz*P.e1.z)*R,lz=(dx*P.e2.x+dy*P.e2.y+dz*P.e2.z)*R;
    const dr=Math.hypot(lx,lz);if(dr>P.rad)continue;
    const dEff=lerp(dr,(Math.abs(lx)+Math.abs(lz))*0.7071,P.facet);   // pyramid faces + sharp aretes
    if(dEff<P.rad)pk=Math.max(pk,P.H*Math.pow(1-dEff/P.rad,P.k)*(0.78+0.3*r));
  }
  return Math.max(h,pk*Math.pow(m,0.35));
}
function bowl(x,y,z,h,L){
  const d=angD(x,y,z,L.p);if(d>L.r*1.45+12)return h;
  // bays and points: two octaves of noise on the shoreline radius
  const de=d/(1+0.17*SN(x*5+L.seed,y*5,z*5)+0.07*SN(x*14,y*14+L.seed,z*14));
  let b=de<L.r?L.level-L.depth*(1-(de/L.r)**2)*(0.75+0.25*SN(x*9,y*9,z*9+L.seed)):L.level+(de-L.r)*L.slope;
  if(L.island){const di=angD(x,y,z,L.island.p);if(di<L.island.r*1.6)b=Math.max(b,L.island.h-(L.island.h-L.level+1)*Math.pow(di/(L.island.r*1.6),1.6));}
  return Math.min(h,b);
}
function alpineLake(x,y,z,h){
  const d=angD(x,y,z,ALPINE.p);if(d>ALPINE.r+14)return h;
  if(d<ALPINE.r)return ALPINE.level-2.6*(1-(d/ALPINE.r)**2);
  const rim=ALPINE.level+0.4+(d-ALPINE.r)*0.75;
  return lerp(h,Math.max(h,rim),smooth(ALPINE.r+14,ALPINE.r+5,d));
}
function riverCarve(x,y,z,h){
  const rv=riverNearest(x,y,z);if(rv.d>70)return h;
  const lv=river.level(rv.s),w=river.width(rv.s);
  const t=lv-0.9+Math.max(0,rv.d-w*0.5)*0.85;
  return t<h?t:h;
}
// flat building pads, blended into the terrain around each house / barn / chalet
const PADS=[];
function addPad(p,r,h,fall=5){PADS.push({p:p.clone(),r,fall,h,cos:Math.cos((r+fall)/R)});}
function applyPads(x,y,z,h,e){
  const rm=smooth(0.3,3.5,e);if(rm<=0)return h;
  for(const P of PADS){const dt=x*P.p.x+y*P.p.y+z*P.p.z;if(dt<P.cos)continue;const d=Math.acos(Math.min(1,dt))*R;h=lerp(h,P.h,smooth(P.r+P.fall,P.r,d)*rm);}
  return h;
}
function cityDist(x,y,z){if(z<0.3)return 1e9;return Math.max(Math.abs(Math.atan2(x,z)*R),Math.abs(Math.atan2(y,z)*R))-CITY_HALF;}
function terrainH(x,y,z){
  const e=roadEdge(x,y,z);
  let h=0,hm=smooth(1,12,e);
  hm*=smooth(0,16,cityDist(x,y,z));
  const df=angD(x,y,z,FARM);if(df<64)hm*=lerp(0.2,1,smooth(46,64,df));
  for(const f of fields){const d=angD(x,y,z,f.p);if(d<f.r+7)hm*=smooth(f.r+1,f.r+7,d);}
  if(hm>0.001){
    const n1=SN(x*3.1+11,y*3.1,z*3.1),n2=SN(x*7.7,y*7.7+5,z*7.7);
    h+=hm*(Math.pow(Math.max(0,n1*0.5+0.5),2)*8.5+(n2*0.5+0.5)*1.3);
  }
  const da=angD(x,y,z,ALPS);
  if(da<ALPS_R)h+=alpsH(x,y,z,da)*smooth(10,26,e);
  if(PADS.length)h=applyPads(x,y,z,h,e);
  if(e<1.8)h=Math.min(h,lerp(-0.06,h,smooth(0,1.8,e)));   // ground under roads always sits below the paint
  for(const L of LAKES)h=bowl(x,y,z,h,L);
  h=alpineLake(x,y,z,h);
  return riverCarve(x,y,z,h);
}
const hAt=p=>terrainH(p.x,p.y,p.z);
function slopeAt(p){ // 1 = flat, lower = steeper
  const t1=randomTangent(p),t2=V(0,0,0).crossVectors(p,t1),h0=hAt(p),d=1.5;
  const gx=(hAt(offsetP(p,t1,d))-h0)/d,gz=(hAt(offsetP(p,t2,d))-h0)/d;
  return 1/Math.sqrt(1+gx*gx+gz*gz);
}
function waterLevelAt(p){
  for(const L of LAKES)if(angTo(p,L.p)*R<L.r*1.4)return L.level;
  if(angTo(p,ALPINE.p)*R<ALPINE.r+1)return ALPINE.level;
  const rv=riverNearest(p.x,p.y,p.z);
  if(rv.d<river.width(rv.s)*0.5+1.2)return river.level(rv.s);
  return -1e9;
}
function zoneName(p){
  if(angTo(p,ALPINE.p)*R<ALPINE.r+6)return'Alpine lake';
  if(angTo(p,ALPS)*R<ALPS_R*0.85)return'Sugarcrest Alps';
  const cl=cityLocal(p);if(cl&&Math.max(Math.abs(cl.lon),Math.abs(cl.lat))<CITY_HALF+4)return'Pastel City';
  for(const L of LAKES)if(angTo(p,L.p)*R<L.r+10)return L.name;
  if(riverNearest(p.x,p.y,p.z).d<10)return'Ribbon River';
  if(p.y>0.74)return'Snowy North';
  if(p.y<-0.66)return'Autumn Woods';
  if(angTo(p,MEADOW)*R<26)return'Petal Meadow';
  if(angTo(p,FARM)*R<60)return'Butter Farms';
  if(angTo(p,CITY)*R<135)return'Suburbs';
  return'Countryside';
}

/* ================================================================ terrain mesh */
const C={grassA:lin(0x9CCB81),grassB:lin(0xB0D68E),meadow:lin(0xBCDD8F),autumn:lin(0xC9C17E),sand:lin(0xEFDDB2),wetsand:lin(0xC9C3A6),
  pebble:lin(0xD9D2C2),paving:lin(0xE2DDD4),plaza:lin(0xEDE7DC),alpgrass:lin(0x8FC27C),rock:lin(0xB7AFBF),rockdark:lin(0x948DA3),
  snow:lin(0xF6F8FC),snowshade:lin(0xE4ECF6),farm:lin(0xB7D58C),forest:lin(0x8BBE76)};
function buildTerrain(){
  const NF=168,half=NF/2,K=NF+3;
  const map=new Map(),pos=[],idx=[],dirs=[];
  const faces=[[V(1,0,0),V(0,0,-1),V(0,1,0)],[V(-1,0,0),V(0,0,1),V(0,1,0)],[V(0,1,0),V(1,0,0),V(0,0,-1)],[V(0,-1,0),V(1,0,0),V(0,0,1)],[V(0,0,1),V(1,0,0),V(0,1,0)],[V(0,0,-1),V(-1,0,0),V(0,1,0)]];
  const vid=(X,Y,Z)=>{
    const key=((X+half)*K+(Y+half))*K+(Z+half);
    let id=map.get(key);if(id!==undefined)return id;
    const w=c=>Math.tan(c/half*Math.PI/4);
    const d=N(w(X),w(Y),w(Z));id=dirs.length;dirs.push(d);map.set(key,id);return id;
  };
  for(const [n,u,v] of faces){
    const grid=[];
    for(let j=0;j<=NF;j++){const row=[];for(let i=0;i<=NF;i++){
      const c=n.clone().multiplyScalar(half).addScaledVector(u,i-half).addScaledVector(v,j-half);
      row.push(vid(Math.round(c.x),Math.round(c.y),Math.round(c.z)));}grid.push(row);}
    for(let j=0;j<NF;j++)for(let i=0;i<NF;i++){const a=grid[j][i],b=grid[j][i+1],c=grid[j+1][i+1],d=grid[j+1][i];idx.push(a,b,c,a,c,d);}
  }
  const n=dirs.length,P=new Float32Array(n*3),H=new Float32Array(n),RD=new Float32Array(n);
  for(let i=0;i<n;i++){
    const d=dirs[i],h=terrainH(d.x,d.y,d.z);H[i]=h;RD[i]=lastRiver.d;
    P[i*3]=d.x*(R+h);P[i*3+1]=d.y*(R+h);P[i*3+2]=d.z*(R+h);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setIndex(idx);g.computeVertexNormals();
  const NR=g.attributes.normal,col=new Float32Array(n*3),c=new THREE.Color();
  for(let i=0;i<n;i++){
    const d=dirs[i],x=d.x,y=d.y,z=d.z,h=H[i];
    const slope=NR.getX(i)*x+NR.getY(i)*y+NR.getZ(i)*z;
    const nz=SN(x*9,y*9,z*9),nz2=SN(x*31,y*31,z*31);
    c.copy(C.grassA).lerp(C.grassB,clamp(0.5+0.5*nz,0,1)*0.85);
    c.lerp(C.meadow,1-smooth(16,28,angD(x,y,z,MEADOW)));
    c.lerp(C.farm,(1-smooth(40,62,angD(x,y,z,FARM)))*0.6);
    c.lerp(C.autumn,smooth(-0.6,-0.72,y)*0.75);
    for(const f of fields){const df=angD(x,y,z,f.p);if(df<f.r+0.6){
      const tx=(x*f.dir.x+y*f.dir.y+z*f.dir.z)*R;const row=Math.floor(tx/1.4)&1;
      c.copy(row?f.c:f.d);if(df>f.r-0.6)c.lerp(C.grassA,0.4);}}
    const cd=cityDist(x,y,z);
    if(cd<0){
      const lon=Math.atan2(x,z)*R,lat=Math.atan2(y,z)*R;
      const inBlock=(cx,cy)=>Math.abs(lon-cx)<6.6&&Math.abs(lat-cy)<6.6;
      if(inBlock(-36,36)||inBlock(36,36))c.copy(C.grassB).lerp(C.grassA,0.3+0.2*nz);
      else if(inBlock(12,-12))c.copy(C.plaza).lerp(C.paving,((Math.floor(lon/1.5)+Math.floor(lat/1.5))&1)*0.6);
      else c.copy(C.paving).lerp(C.plaza,0.25+0.2*nz2);
    }
    // water edges
    for(const L of LAKES){const dl=angD(x,y,z,L.p);if(dl<L.r*1.6+8){c.lerp(C.sand,smooth(L.level+0.95,L.level+0.3,h)*0.9);c.lerp(C.wetsand,smooth(L.level+0.1,L.level-0.4,h));}}
    if(RD[i]<12){const w=0.5*river.width(0)+3;c.lerp(C.pebble,smooth(w+3.5,w,RD[i])*0.85);}
    // mountains: alpine grass, rock on steep faces, snow on high gentle ground
    const da=angD(x,y,z,ALPS);
    if(da<ALPS_R+4&&h>1.5){
      c.lerp(C.alpgrass,smooth(1.5,6,h)*0.8);
      const steep=smooth(0.88,0.6,slope)*smooth(2,8,h);
      c.lerp(nz2>0.15?C.rock:C.rockdark,steep);
      c.lerp(C.rockdark,smooth(0.62,0.42,slope)*0.6*smooth(4,10,h));
      const sl=33+nz*5;
      const snow=smooth(sl-4,sl+3,h)*smooth(0.55,0.8,slope);
      c.lerp(slope>0.84?C.snow:C.snowshade,Math.max(snow,smooth(sl+18,sl+28,h)*smooth(0.35,0.6,slope)));
    }
    c.lerp(C.snow,smooth(0.73,0.79,y+0.012*nz2));
    if(angD(x,y,z,ALPINE.p)<ALPINE.r+3)c.lerp(C.pebble,smooth(ALPINE.level+1.2,ALPINE.level+0.3,h));
    col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;
  }
  g.setAttribute('color',new THREE.BufferAttribute(col,3));
  g.computeBoundingSphere();
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0}));
  m.receiveShadow=true;m.castShadow=true;scene.add(m);
}

/* ================================================================ flat paint: roads, lines, water */
const acc={};
const A=k=>acc[k]||(acc[k]={pos:[],nor:[],col:[],idx:[]});
const FLATMAT={road:[0x7A7F8C,0.95],line:[0xF6F3EA,0.9],walk:[0xD8D3CA,1],river:[0xFFFFFF,0.1]};
const Y_ROAD=0.04,Y_WALK=0.09,Y_LINE=0.05;
function strip(r,t0,t1,o0,o1,h,mk,segLen=1.2){
  const n=Math.max(1,Math.ceil(Math.abs(t1-t0)*R/segLen)),k=Math.max(1,Math.ceil((o1-o0)/1.2)),a=A(mk),base=a.pos.length/3;
  for(let i=0;i<=n;i++){
    const p=pointOn(r,t0+(t1-t0)*i/n);
    for(let j=0;j<=k;j++){
      const o=o0+(o1-o0)*j/k,q=p.clone().multiplyScalar(Math.cos(o/R)).addScaledVector(r.n,Math.sin(o/R)),rr=R+h;
      a.pos.push(q.x*rr,q.y*rr,q.z*rr);a.nor.push(q.x,q.y,q.z);
    }
  }
  for(let i=0;i<n;i++)for(let j=0;j<k;j++){const a0=base+i*(k+1)+j,b0=a0+1,a1=a0+k+1,b1=a1+1;a.idx.push(a0,a1,b1,a0,b1,b0);}
}
function intervals(r,clearFn){
  const out=[],step=0.5/R,n=Math.ceil(r.len/step);let start=null;
  for(let i=0;i<=n;i++){
    const t=Math.min(i*step,r.len),p=pointOn(r,t);
    let ok=i<n;
    if(ok)for(const c of crossings){if(c.a!==r&&c.b!==r)continue;if(angTo(p,c.p)*R<clearFn(crossOther(c,r))){ok=false;break;}}
    if(ok&&start===null)start=t;
    if(!ok&&start!==null){out.push([start,t]);start=null;}
  }
  return out;
}
function paintRoads(){
  for(const r of ROADS){
    const hw=r.rh+r.walk;
    strip(r,0,r.len,-r.rh,r.rh,Y_ROAD,'road',1.5);
    for(const [a,b] of intervals(r,o=>Math.hypot(o.rh+o.walk+0.3,hw))){strip(r,a,b,r.rh,hw,Y_WALK,'walk');strip(r,a,b,-hw,-r.rh,Y_WALK,'walk');}
    for(const [a,b] of intervals(r,o=>Math.hypot(o.rh+o.walk+0.3,r.rh)))
      {strip(r,a,b,r.rh-0.45,r.rh-0.3,Y_LINE,'line');strip(r,a,b,-r.rh+0.3,-r.rh+0.45,Y_LINE,'line');}
    for(const [a,b] of intervals(r,o=>o.rh+o.walk+0.6))for(let t=a+1/R;t<b-2/R;t+=4/R)strip(r,t,t+2/R,-0.09,0.09,Y_LINE,'line',1);
    for(const c of crossings){
      if(c.a!==r&&c.b!==r)continue;
      const o=crossOther(c,r),tx=tOf(r,c.p),dz=o.rh+o.walk+0.7;
      for(const s of [1,-1]){
        const t0=tx+s*dz/R,t1=tx+s*(dz+2.1)/R;
        if(!r.full&&(Math.min(t0,t1)<-0.01||Math.max(t0,t1)>r.len+0.01))continue;
        for(let u=-r.rh+0.7;u<=r.rh-0.6;u+=1.1)strip(r,Math.min(t0,t1),Math.max(t0,t1),u-0.28,u+0.28,Y_LINE,'line',1);
      }
    }
  }
}
function paintStopLines(){
  for(const sg of SIGS)for(const r of [sg.c.a,sg.c.b]){
    const o=crossOther(sg.c,r),tc=sg.t.get(r),dz=stopDist(o);
    for(const dir of [1,-1]){
      const t0=tc-dir*(dz+0.45)/R,t1=tc-dir*dz/R;
      const [a,b]=dir>0?[-r.rh+0.3,-0.12]:[0.12,r.rh-0.3];
      strip(r,Math.min(t0,t1),Math.max(t0,t1),a,b,Y_LINE,'line',0.5);
    }
  }
}
const sigLamps=[];
function placeSignals(){
  const L=[[3.38,0],[3.05,1],[2.72,2]];
  for(const sg of SIGS)for(const r of [sg.c.a,sg.c.b]){
    const o=crossOther(sg.c,r),tc=sg.t.get(r);
    for(const dir of [1,-1]){
      const p0=pointOn(r,tc-dir*(stopDist(o)+0.2)/R),d=tangentOn(r,tc).multiplyScalar(dir),rt=V(0,0,0).crossVectors(d,p0).normalize();
      const pp=offsetP(p0,rt,r.rh+r.walk*0.55),front=d.clone().negate();
      place('TrafficLight',pp,front,{abs:Y_WALK});colCircle(pp,0.22);occupy(pp,0.8);
      const q=quatUpFront(pp,front),base=pp.clone().multiplyScalar(R+Y_WALK);
      for(const [y,k] of L)sigLamps.push({pos:V(-2.05,y,0.2).applyQuaternion(q).add(base),q,sg,road:r,k});
    }
  }
}
function paintRiver(){
  const P=river.pts,a=A('river'),base=a.pos.length/3,water=lin(0x92D3E6),foam=lin(0xF4FBFF);
  let first=-1;
  for(let i=0;i<P.length;i++){
    if(angTo(P[i],ALPINE.p)*R<ALPINE.r-1.5)continue;
    if(first<0)first=i;
    const p=P[i],tg=tangentToward(p,P[Math.min(i+1,P.length-1)].clone().sub(P[Math.max(i-1,0)])),rt=V(0,0,0).crossVectors(tg,p).normalize();
    const s=river.S[i],lv=river.level(s),hw=river.width(s)*0.5+1.35;
    const grad=(river.level(Math.max(0,s-1))-river.level(s+1))/2;
    const f=smooth(0.05,0.35,grad);
    for(const o of [-hw,hw]){const q=offsetP(p,rt,o),rr=R+lv;a.pos.push(q.x*rr,q.y*rr,q.z*rr);a.nor.push(q.x,q.y,q.z);const c=water.clone().lerp(foam,f*0.85);a.col.push(c.r,c.g,c.b);}
  }
  const cnt=(a.pos.length/3-base)/2;
  for(let i=0;i<cnt-1;i++){const a0=base+2*i,b0=a0+1,a1=a0+2,b1=a0+3;a.idx.push(a0,b1,a1,a0,b0,b1);}
}
function flatMat(k){
  const [c,r]=FLATMAT[k];
  const m=new THREE.MeshStandardMaterial({color:lin(c),roughness:r,metalness:0,vertexColors:k==='river',polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
  if(k==='river')shimmer(m,1.6);
  return m;
}
// animated ripples: wobble the normal with a few travelling sine waves and add small glints
const waterTime={value:0};
function shimmer(mat,speed=1){
  mat.onBeforeCompile=sh=>{
    sh.uniforms.uTime=waterTime;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;')
      .replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uTime;\nvarying vec3 vWP;')
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        float t=uTime*${speed.toFixed(2)};vec3 q=vWP*0.85;
        float w1=sin(q.x*1.7+t*1.3)+sin(q.z*1.3-t*1.1)+0.5*sin((q.x+q.y+q.z)*2.6+t*1.9);
        float w2=cos(q.y*1.5+t*1.2)+cos((q.x-q.z)*1.9-t*0.9)+0.5*cos((q.y-q.x)*3.1-t*1.6);
        normal=normalize(normal+vec3(w1,w2,0.0)*0.045);`)
      .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        totalEmissiveRadiance+=vec3(pow(clamp(w1*w2*0.22,0.0,1.0),5.0))*0.5;`);
  };
  mat.customProgramCacheKey=()=>'shimmer'+speed;
  return mat;
}
// lake surface: turquoise shallows, blue depths and a soft foam line where the water meets the shore
function waterSurface(center,radius,level,shallowHex,deepHex){
  const rings=Math.max(10,Math.ceil(radius/0.8));
  const g=new THREE.SphereGeometry(R+level,112,rings,0,Math.PI*2,0,radius/R);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,1,0),center)));
  const pos=g.attributes.position,col=new Float32Array(pos.count*3),c=new THREE.Color();
  const shallow=lin(shallowHex),deep=lin(deepHex),foam=lin(0xF6FCFF),d=V(0,0,0);
  for(let i=0;i<pos.count;i++){
    d.set(pos.getX(i),pos.getY(i),pos.getZ(i)).normalize();
    const depth=level-terrainH(d.x,d.y,d.z);
    c.copy(shallow).lerp(deep,smooth(0.25,2.4,depth)).lerp(foam,smooth(0.32,0.02,depth)*0.85);
    col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;
  }
  g.setAttribute('color',new THREE.BufferAttribute(col,3));
  const m=new THREE.Mesh(g,shimmer(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.1,metalness:0.05,transparent:true,opacity:0.94})));
  m.receiveShadow=true;scene.add(m);return m;
}
function flushFlat(){
  for(const [k,a] of Object.entries(acc)){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(a.pos,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(a.nor,3));
    if(a.col.length)g.setAttribute('color',new THREE.Float32BufferAttribute(a.col,3));
    g.setIndex(a.idx);g.computeBoundingSphere();
    const m=new THREE.Mesh(g,flatMat(k));m.receiveShadow=true;scene.add(m);
  }
}

/* ================================================================ occupancy + colliders */
const OCC=new Map(),CELL=8;
const ckey=(x,y,z)=>(Math.floor(x*R/CELL)+512)*1048576+(Math.floor(y*R/CELL)+512)*1024+(Math.floor(z*R/CELL)+512);
function occupy(p,r){const k=ckey(p.x,p.y,p.z);let a=OCC.get(k);if(!a)OCC.set(k,a=[]);a.push({p:p.clone(),r});}
function occFree(p,r){
  const bx=Math.floor(p.x*R/CELL),by=Math.floor(p.y*R/CELL),bz=Math.floor(p.z*R/CELL),span=Math.ceil((r+12)/CELL);
  for(let i=-span;i<=span;i++)for(let j=-span;j<=span;j++)for(let k=-span;k<=span;k++){
    const a=OCC.get((bx+i+512)*1048576+(by+j+512)*1024+(bz+k+512));if(!a)continue;
    for(const o of a)if(angTo(p,o.p)*R<r+o.r)return false;
  }
  return true;
}
function free(p,r,roadClear=0.6){return roadEdge(p.x,p.y,p.z)>r+roadClear&&occFree(p,r);}
const colliders=[];
function colCircle(p,r,h=0){colliders.push({type:0,c:p.clone().multiplyScalar(R+h),r,br:r});}
function colBox(p,front,hx,hz,h=0){
  const ez=tangentToward(p,front),ex=V(0,0,0).crossVectors(p,ez).normalize();
  colliders.push({type:1,c:p.clone().multiplyScalar(R+h),ex,ez,hx,hz,br:Math.hypot(hx,hz)});
}

/* ================================================================ kit instancing */
let kit;
const placements={};
function place(name,p,front,o={}){
  const h=o.abs!=null?o.abs:hAt(p)+(o.h||0);
  const sc=Array.isArray(o.s)?o.s:[o.s||1,o.s||1,o.s||1];
  const q=o.fwdX?quatUpFwdX(p,front):quatUpFront(p,front);
  (placements[name]||(placements[name]=[])).push({pos:p.clone().multiplyScalar(R+h),q,s:sc,colors:o.colors||null,dir:p.clone()});
  return h;
}
const TINT=new Set(OurPlanet.TINT);
function partsOf(name){
  const root=kit.getObjectByName(name);if(!root){console.warn('missing asset',name);return[];}
  root.updateMatrixWorld(true);
  const inv=root.matrixWorld.clone().invert(),out=[];
  root.traverse(o=>{if(o.isMesh)out.push({geo:o.geometry,mat:o.material,local:new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld)});});
  return out;
}
function sectorOf(d){const ax=Math.abs(d.x),ay=Math.abs(d.y),az=Math.abs(d.z);let f,u,v;
  if(ax>=ay&&ax>=az){f=d.x>0?0:1;u=d.y/ax;v=d.z/ax;}else if(ay>=az){f=d.y>0?2:3;u=d.x/ay;v=d.z/ay;}else{f=d.z>0?4:5;u=d.x/az;v=d.y/az;}
  return f*36+Math.min(5,Math.floor((u+1)*3))*6+Math.min(5,Math.floor((v+1)*3));}
function buildInstances(){
  for(const [name,list] of Object.entries(placements)){
    const parts=partsOf(name);if(!parts.length)continue;
    const groups=new Map();for(const p of list){const s=sectorOf(p.dir);if(!groups.has(s))groups.set(s,[]);groups.get(s).push(p);}
    for(const part of parts){
      if(!part.geo.boundingSphere)part.geo.computeBoundingSphere();
      const tint=TINT.has(part.mat.name),mat=tint?part.mat.clone():part.mat,base=part.mat.color.clone();
      if(tint)mat.color.set(0xFFFFFF);
      for(const items of groups.values()){
        const geo=new THREE.BufferGeometry();geo.index=part.geo.index;geo.attributes=part.geo.attributes;
        const im=new THREE.InstancedMesh(geo,mat,items.length);
        im.castShadow=true;im.receiveShadow=true;
        const ctr=V(0,0,0);items.forEach(p=>ctr.add(p.pos));ctr.divideScalar(items.length);
        let rad=0;
        items.forEach((p,i)=>{
          _m.compose(p.pos,p.q,_s.set(p.s[0],p.s[1],p.s[2])).multiply(part.local);im.setMatrixAt(i,_m);
          rad=Math.max(rad,p.pos.distanceTo(ctr)+part.geo.boundingSphere.radius*Math.max(...p.s)+part.local.elements[13]*0+20);
          if(tint){const hex=p.colors&&p.colors[part.mat.name];im.setColorAt(i,hex!=null?lin(hex):base);}
        });
        geo.boundingSphere=new THREE.Sphere(ctr,rad);
        if(im.instanceColor)im.instanceColor.needsUpdate=true;
        scene.add(im);
      }
    }
  }
}
// dynamic (moving) instances: people, traffic, boats, ducks
function dynamic(name,n,colorFn){
  const parts=partsOf(name).map(part=>{
    const tint=TINT.has(part.mat.name),mat=tint?part.mat.clone():part.mat,base=part.mat.color.clone();if(tint)mat.color.set(0xFFFFFF);
    const im=new THREE.InstancedMesh(part.geo,mat,n);im.castShadow=true;im.receiveShadow=true;im.frustumCulled=false;
    if(tint)for(let i=0;i<n;i++){const hex=colorFn&&colorFn(i)[part.mat.name];im.setColorAt(i,hex!=null?lin(hex):base);}
    scene.add(im);return{im,local:part.local};
  });
  return{set(i,pos,q,s=1){_m2.compose(pos,q,_s.set(s,s,s));for(const p of parts){_m.multiplyMatrices(_m2,p.local);p.im.setMatrixAt(i,_m);}},
    commit(){for(const p of parts)p.im.instanceMatrix.needsUpdate=true;}};
}
function cloneAsset(name,tints){
  const o=kit.getObjectByName(name).clone(true);
  o.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;if(tints&&tints[m.material.name]!=null){m.material=m.material.clone();m.material.color.copy(lin(tints[m.material.name]));}}});
  o.position.set(0,0,0);o.quaternion.identity();
  return o;
}

/* ================================================================ palettes */
const PAL={
  cherry:{label:'Soft cherry',Body:0xEE8E86,Accent:0xFFC98A},peach:{label:'Peach',Body:0xF6AE9E,Accent:0xFFE2B8},
  butter:{label:'Butter',Body:0xFFD88F,Accent:0xF5A99F},mint:{label:'Mint',Body:0x9FD8C4,Accent:0xFFF0C2},
  sky:{label:'Sky',Body:0xA2CBEF,Accent:0xFFE3A3},lavender:{label:'Lavender',Body:0xC4B5F0,Accent:0xFFE0EA}
};
const lighten=(hex,t)=>new THREE.Color(hex).lerp(new THREE.Color(0xFFFFFF),t).getHex();
const carColors=k=>({Body:PAL[k].Body,Accent:PAL[k].Accent,Fender:lighten(PAL[k].Body,0.25)});
const WALLS=[0xF6EBDD,0xE6EFE2,0xE3ECF6,0xF7E0DA,0xFBF0CF,0xEDE4F4];
const CITYWALLS=[0xF4D9CF,0xF1E6CF,0xDCE8F0,0xE5EEDD,0xEADFF2,0xF7E7D2,0xFFF1E0];
const ROOFS=[0xD98C7A,0x8E9CB5,0xB58A73,0x7FA39A,0xC98F9E,0x9C8FB8];
const LEAVES=[0x8BC27A,0x9ACB7F,0x7DB86F,0xA6D08A,0x86BD80,0x8BC27A,0xF2BACB];
const PINES=[0x6FA68C,0x7DB59A,0x679E86,0x5F9A80];
const FROST=[0xA9CBBF,0xB9D6CC,0x9CC2B4];
const AUTUMN=[0xF2B880,0xE9A07A,0xF5CE8A,0xE7A3B0,0xEFC07C,0xE58F72];
const BIRCH=[0xC9DB86,0xF3D27C,0xB7D584];
const AWNINGS=[0x9FD8C4,0xF4A99B,0xA2CBEF,0xFFD88F,0xC4B5F0];
const SHIRTS=[0x9FD8C4,0xF4A99B,0xA2CBEF,0xFFD88F,0xC4B5F0,0xF29A9A,0xFFFFFF,0x8FB8DE];
const PANTS=[0x6F7BA3,0x5E5A70,0x8C7A6B,0x7FA39A,0x3F4A6B];
const SKINS=[0xF6D2B8,0xE8B896,0xC98F6B,0x9A6A4F,0xFBE0CC];
const HAIRS=[0x7A5A48,0x3A3550,0xE8C27A,0xB0603F,0x2E2A33,0xD9CFC6];
const PETALS=[0xFFB3C7,0xFFE08A,0xFFFFFF,0xC9B8F5,0xFFC4A3];
const SAILS=[0xFFFDF7,0xF4A99B,0xA2CBEF,0xFFD88F];

/* ================================================================ world population */
function tree(p,kind,s,leaf,sink=0.25){place(kind,p,randomTangent(p),{s,h:-sink,colors:{Leaf:leaf}});occupy(p,1.5*s);colCircle(p,0.35*s,hAt(p));}

function buildCity(){
  const blocks=[];
  for(const lon of [-36,-12,12,36])for(const lat of [-36,-12,12,36])blocks.push({lon,lat,p:fromCity(lon,lat)});
  const towers=['City_Tower','City_Office','City_Tower'];let ti=0;
  for(const b of blocks){
    const {lon,lat,p}=b,ring=Math.max(Math.abs(lon),Math.abs(lat));
    // face the building toward the closer main road
    const front=Math.abs(lon)<Math.abs(lat)?tangentToward(p,fromCity(0,lat).sub(p)):tangentToward(p,fromCity(lon,0).sub(p));
    if(lon===12&&lat===-12){plaza(p,front);continue;}
    if(lon===-36&&lat===36){ferrisPark(p,front);continue;}
    if(lon===36&&lat===36){greenSquare(p);continue;}
    let name;
    if(ring===12)name=towers[ti++%3];
    else name=pick(['City_Parisian','City_Apartment','City_Parisian','City_Apartment','City_Cafe','Shop']);
    place(name,p,front,{abs:0,colors:{Wall:pick(CITYWALLS),ShopWall:pick(CITYWALLS),Awning:pick(AWNINGS),Umbrella:pick([0xFFD88F,0xF4A99B,0xFFFFFF])}});
    occupy(p,8);colBox(p,front,name==='City_Cafe'?5.2:5.7,name==='City_Cafe'?5.8:6.0);
  }
  // street lamps + little trees along city streets
  for(const r of ROADS){
    if(r.full)continue;
    let flip=1;
    for(let t=6/R;t<r.len-6/R;t+=9/R){
      const p0=pointOn(r,t);if(crossings.some(c=>angTo(p0,c.p)*R<7))continue;
      flip=-flip;const side=r.n.clone().multiplyScalar(flip),pl=offsetP(p0,side,r.rh+0.45);
      place('Lamp',pl,side.clone().negate(),{abs:Y_WALK});colCircle(pl,0.2);
    }
  }
  for(const r of [ROAD_A,ROAD_B]){
    const t0=tOf(r,CITY);
    let flip=1;
    for(let a=-48;a<=48;a+=12){const p0=pointOn(r,t0+a/R);if(crossings.some(c=>angTo(p0,c.p)*R<8))continue;flip=-flip;const side=r.n.clone().multiplyScalar(flip),pl=offsetP(p0,side,r.rh+0.45);place('Lamp',pl,side.clone().negate(),{abs:Y_WALK});colCircle(pl,0.2);}
  }
}
let fountainSpot,ferris=null,parkSpot;
const benches=[];
function plaza(p,front){
  fountainSpot=p.clone();
  place('Fountain',p,front,{abs:0});occupy(p,7);colCircle(p,3.5);
  const right=V(0,0,0).crossVectors(p,front).normalize();
  for(const [a,b] of [[1,1],[1,-1],[-1,1],[-1,-1]]){
    const q=offsetP(offsetP(p,front,a*5.4),right,b*5.4);
    place('Planter',q,front,{abs:0});place('Tree_Round',q,randomTangent(q),{abs:0.5,s:0.62,colors:{Leaf:pick(LEAVES)}});colBox(q,front,0.75,0.75);
    const bq=offsetP(offsetP(p,front,a*5.4),right,b*2.2),bf=front.clone().multiplyScalar(-a);place('Bench',bq,bf,{abs:0});colBox(bq,front,0.95,0.35);benches.push({p:bq,front:bf,h:0,name:'Fountain plaza'});
  }
}
function ferrisPark(p,front){
  parkSpot=p.clone();
  ferris={p,front};occupy(p,8);
  colBox(p,front,5.5,2.4);
  const right=V(0,0,0).crossVectors(p,front).normalize();
  for(const [a,b] of [[-5.2,-5.2],[5.2,-5.2],[-5.4,5.4]]){const q=offsetP(offsetP(p,front,a),right,b);tree(q,'Tree_Round',0.75,pick(LEAVES),0);}
  const bq=offsetP(p,front,-5.2);place('Bench',bq,front,{abs:0});colBox(bq,front,0.95,0.35);benches.push({p:bq,front:front.clone(),h:0,name:'Ferris wheel park'});
}
function greenSquare(p){
  const f=randomTangent(p),r=V(0,0,0).crossVectors(p,f);
  for(const [a,b] of [[-4,-4],[4,-4],[-4,4],[4,4],[0,0]]){const q=offsetP(offsetP(p,f,a),r,b);tree(q,a===0?'Tree_Birch':'Tree_Round',range(0.75,0.95),pick(LEAVES),0);}
  for(const [a,b,dir] of [[0,-5.5,1],[0,5.5,-1]]){const q=offsetP(offsetP(p,f,a),r,b);place('Bench',q,r.clone().multiplyScalar(dir),{abs:0});colBox(q,r,0.95,0.35);benches.push({p:q,front:r.clone().multiplyScalar(dir),h:0,name:'Green square'});}
  occupy(p,8);
}

const HOUSES={House_Cottage:{w:8.4,d:7.2},House_TwoStory:{w:8.8,d:7.6},House_Bungalow:{w:9.6,d:7.0,garage:true}};
function flatEnough(p,front,hx,hz,tol=1.2){
  // pick a pad height for this footprint; refuse only wildly uneven or wet ground
  const right=V(0,0,0).crossVectors(p,front).normalize();let lo=1e9,hi=-1e9;
  for(const [a,b] of [[0,0],[hx,hz],[-hx,hz],[hx,-hz],[-hx,-hz]]){const h=hAt(offsetP(offsetP(p,front,b),right,a));lo=Math.min(lo,h);hi=Math.max(hi,h);}
  if(hi-lo>Math.max(tol*4,6))return null;
  const wl=waterLevelAt(p);if(lo<wl+0.6)return null;
  const base=(lo+hi)/2;addPad(p,Math.hypot(hx,hz)+0.6,base,Math.min(7,2+(hi-lo)*1.2));
  return base;
}
function buildSuburbs(){
  for(const r of MAIN){
    for(let t=0;t<Math.PI*2;t+=17/R){
      const p0=pointOn(r,t),dc=angTo(p0,CITY)*R;
      if(dc<62||dc>140)continue;
      const cl=cityLocal(p0);if(cl&&Math.max(Math.abs(cl.lon),Math.abs(cl.lat))<CITY_HALF+10)continue;
      if(angTo(p0,ALPS)*R<ALPS_R+10||nearCrossing(p0,10))continue;
      for(const s of [1,-1]){
        
        const name=pick(Object.keys(HOUSES)),H=HOUSES[name],side=r.n.clone().multiplyScalar(s);
        const ph=offsetP(p0,side,r.rh+r.walk+4.5+H.d/2),front=side.clone().negate();
        if(roadEdge(ph.x,ph.y,ph.z)<H.d/2+2){continue;}
        if(!occFree(ph,7)){continue;}
        const base=flatEnough(ph,front,H.w/2+1,H.d/2+1);if(base==null){continue;}
        place(name,ph,front,{abs:base-0.2,colors:{Wall:pick(WALLS),Roof:pick(ROOFS)}});
        occupy(ph,7);colBox(ph,front,H.w/2+0.2,H.d/2+0.2,base);
        if(H.garage){const right=V(0,0,0).crossVectors(ph,front).normalize();colBox(offsetP(ph,right,6.5),front,1.8,3,base);}
        const tan=tangentOn(r,t);
        if(rand()<0.5){
          const pc=offsetP(offsetP(p0,side,r.rh+r.walk+2.2),tan,s*6);
          if(occFree(pc,1.6)&&roadEdge(pc.x,pc.y,pc.z)>-0.3){
            const fr=rand()<0.5?front:side;place(rand()<0.6?'Car_Pickup_Static':'Car_Bubble_Static',pc,fr,{fwdX:true,colors:carColors(pick(Object.keys(PAL)))});
            occupy(pc,1.7);colBox(pc,V(0,0,0).crossVectors(fr,pc),0.85,1.5,hAt(pc));
          }
        }
        const pm=offsetP(offsetP(p0,side,r.rh+r.walk+0.7),tan,-s*3.2);place('Mailbox',pm,front);colCircle(pm,0.2);
        const pt=offsetP(offsetP(ph,side,H.d/2+3.6),tan,range(-4,4));
        if(free(pt,1.6,1))tree(pt,rand()<0.7?'Tree_Round':'Tree_Birch',range(0.85,1.15),pick(LEAVES));
        for(const k of [-1,1]){const pb=offsetP(offsetP(ph,front,H.d/2-0.2),tan,k*s*(H.w/2+0.9));if(!H.garage||k*s<0)place('Bush',pb,front,{s:range(0.8,1.1),colors:{Leaf:pick(LEAVES)}});}
      }
    }
  }
}
function buildChalets(){
  for(const r of [ROAD_C,ROAD_A]){
    for(let t=0;t<Math.PI*2;t+=15/R){
      const p0=pointOn(r,t),da=angTo(p0,ALPS)*R;
      if(da>ALPS_R*0.85||nearCrossing(p0,12))continue;
      for(const s of [1,-1]){
        if(rand()<0.45)continue;
        const side=r.n.clone().multiplyScalar(s),ph=offsetP(p0,side,r.rh+r.walk+5.8),front=side.clone().negate();
        if(!occFree(ph,6.5))continue;
        const base=flatEnough(ph,front,5,4.6,1.6);if(base==null)continue;
        place('Chalet',ph,front,{abs:base-0.15,colors:{Roof:pick([0x8E7A86,0x7C8296,0x9A7F70,0xB2766B,0x6F8A84,0xA88C6E])}});
        occupy(ph,6.8);colBox(ph,front,5.3,4.7,base);
      }
    }
  }
}
let bridgeAt=null;
function buildBridge(){
  const P=river.pts;
  for(let i=1;i<P.length;i++){
    const a=P[i-1].dot(ROAD_A.n),b=P[i].dot(ROAD_A.n);
    if(a>0&&b<=0){
      const x=P[i-1].clone().lerp(P[i],a/(a-b)).normalize();
      const t=tOf(ROAD_A,x),p=pointOn(ROAD_A,t),fr=tangentOn(ROAD_A,t);
      place('Bridge',p,fr,{abs:-(R-Math.sqrt(R*R-8.6*8.6))-0.02});/* flat deck vs curved road: sink by the sag */occupy(p,10);bridgeAt=p;
      const side=ROAD_A.n;
      for(const s of [1,-1])colBox(offsetP(p,side,s*5.95),fr,0.35,8.8);
      break;
    }
  }
}
const windmills=[];
function buildFarm(){
  const items=[['Barn',8.5,[4.6,6.3]],['Silo',2.6,null],['Barn',8.5,[4.6,6.3]],['Silo',2.6,null],['Windmill_Body',3.5,null],['Windmill_Body',3.5,null],['Windmill_Body',3.5,null]];
  for(const [name,r,box] of items){
    for(let i=0;i<400;i++){
      const p=offsetP(FARM,randomTangent(FARM),range(6,58));
      if(!free(p,r,1.5))continue;
      if(fields.some(f=>angTo(f.p,p)*R<f.r+r))continue;
      const fr=randomTangent(p),base=flatEnough(p,fr,r*0.7,r*0.7,1.5);if(base==null)continue;
      place(name,p,fr,{abs:base-0.2});occupy(p,r+1);
      if(box)colBox(p,fr,box[0],box[1],base);else colCircle(p,name==='Silo'?1.9:2.2,base);
      if(name==='Windmill_Body')windmills.push({p,fr,base:base-0.2});
      break;
    }
  }
  for(const f of fields)occupy(f.p,f.r);
}
const boats=[],ducks=[],lighthouse={};
function buildLakes(){
  for(const L of LAKES)waterSurface(L.p,L.r*1.4+3,L.level,L.water[0],L.water[1]);
  waterSurface(ALPINE.p,ALPINE.r+2.5,ALPINE.level,0x9EE8D8,0x5EC3C9);
  // walk around each lake and find the shoreline
  for(const L of LAKES){
    const t0=randomTangentFixed(L.p),t1=V(0,0,0).crossVectors(L.p,t0);L.shore=[];
    for(let k=0;k<180;k++){
      const a=k/180*Math.PI*2,dir=t0.clone().multiplyScalar(Math.cos(a)).addScaledVector(t1,Math.sin(a));
      let dist=L.r*0.6;while(dist<L.r*1.6&&hAt(offsetP(L.p,dir,dist))<L.level)dist+=0.25;
      L.shore.push({a,dir,dist});
    }
    L.meanShore=L.shore.reduce((s,o)=>s+o.dist,0)/L.shore.length;
  }
  for(const L of LAKES)occupy(L.p,L.r*1.15);
  occupy(ALPINE.p,ALPINE.r+3);
  // lighthouse on the shore facing the open water
  for(let k=0;k<40;k++){
    const dir=randomTangent(BIGLAKE.p);
    for(let dist=BIGLAKE.r*0.95;dist<BIGLAKE.r*1.5;dist+=0.6){
      const p=offsetP(BIGLAKE.p,dir,dist),h=hAt(p);
      if(h>BIGLAKE.level+0.5){
        if(!free(p,4,3)||flatEnough(p,dir,2.5,2.5,1.6)==null)break;
        place('Lighthouse',p,dir.clone().negate(),{abs:h-0.3});occupy(p,6);colCircle(p,2.9,h);
        Object.assign(lighthouse,{p,h:h-0.3,front:dir.clone().negate()});k=99;break;
      }
    }
  }
  for(const L of LAKES){
    // island with a couple of trees
    const I=L.island;
    tree(I.p,L===BIGLAKE?'Tree_Round':'Tree_Round',1.15,L===MAPLE?pick(AUTUMN):pick(LEAVES),0.2);
    tree(offsetP(I.p,randomTangent(I.p),1.8),L===MAPLE?'Tree_Birch':'Tree_Pine',0.85,L===MAPLE?pick(BIRCH):pick(PINES),0.2);
    place('Boulder',offsetP(I.p,randomTangent(I.p),2.6),randomTangent(I.p),{s:0.5,h:-0.2});
    // a pier with a rowboat, away from the lighthouse
    let pier=null;
    for(const o of L.shore){
      if(o.dist>L.r*1.3)continue;
      const p=offsetP(L.p,o.dir,o.dist+0.6);
      if(lighthouse.p&&angTo(p,lighthouse.p)*R<16)continue;
      if(roadEdge(p.x,p.y,p.z)<4||!occFree(p,3))continue;
      if(angTo(offsetP(L.p,o.dir,o.dist-6),I.p)*R<I.r*1.6+3)continue;
      pier={p,o};break;
    }
    if(pier){
      const inward=pier.o.dir.clone().negate();
      place('Pier',pier.p,inward,{abs:L.level+0.15});occupy(pier.p,3.5);
      const right=V(0,0,0).crossVectors(pier.p,inward).normalize();
      const bp=offsetP(offsetP(pier.p,inward,6.2),right,1.9);
      place('Rowboat',bp,inward,{abs:L.level+0.02,fwdX:true,colors:{}});
      colBox(offsetP(pier.p,inward,4.5),inward,1.2,4.6,L.level);
    }
    // reeds, lily pads and stones along the shore
    for(const o of L.shore){
      const r=rand();
      if(r<0.36){
        const p=offsetP(L.p,o.dir,o.dist-range(0.2,0.9));
        if(pier&&angTo(p,pier.p)*R<4)continue;
        place('Reeds',p,randomTangent(p),{abs:L.level,s:range(0.8,1.25)});
        if(rand()<0.5)place('Reeds',offsetP(p,randomTangent(p),0.7),randomTangent(p),{abs:L.level,s:range(0.7,1.1)});
      }else if(r<0.52){
        const base=offsetP(L.p,o.dir,o.dist-range(1.6,4.2));
        for(let j=0,n=2+Math.floor(rand()*3);j<n;j++){
          const p=offsetP(base,randomTangent(base),range(0,1.1));
          place(rand()<0.3?'LilyFlower':'LilyPad',p,randomTangent(p),{abs:L.level+0.01,s:range(0.7,1.2)});
        }
      }else if(r<0.6){
        const p=offsetP(L.p,o.dir,o.dist+range(0.2,1.2));
        if(occFree(p,0.6))place('Boulder',p,randomTangent(p),{s:range(0.3,0.6),h:-0.15});
      }
    }
  }
  for(let k=0;k<3;k++)boats.push({L:BIGLAKE,model:0,r:range(7,BIGLAKE.meanShore*0.62),a:range(0,6.28),w:range(0.03,0.05)*(rand()<0.5?1:-1),c:pick(SAILS)});
  boats.push({L:MAPLE,model:1,r:MAPLE.meanShore*0.55,a:1,w:0.025,c:0xA2CBEF});
  // duck families: a mother leading a line of ducklings near the shore
  for(const L of LAKES)for(let f=0;f<2;f++){
    const r=L.meanShore*range(0.62,0.78),a=range(0,6.28),w=range(0.08,0.12)*(f?1:-1),ph=range(0,6);
    for(let k=0;k<5;k++)ducks.push({L,r:r+(k?range(-0.25,0.25):0),a,lag:k*0.95,w,ph:ph+k,s:k?0.55:1.0});
  }
  // keep the river corridor clear
  for(let i=0;i<river.pts.length;i+=4)occupy(river.pts[i],river.width(river.S[i])*0.5+2.5);
}
// scenic viewpoints: a bench, flattened ground and a view worth sitting for
function viewBench(p,look,name){
  if(!p)return false;
  const front=tangentToward(p,look.clone().sub(p));
  if(!occFree(p,1.4)||roadEdge(p.x,p.y,p.z)<1.2)return false;
  const h0=hAt(p);if(h0<waterLevelAt(p)+0.35)return false;
  addPad(p,1.3,h0,2.5);
  place('Bench',p,front,{abs:h0});occupy(p,1.8);colBox(p,front,0.95,0.35,h0);
  benches.push({p:p.clone(),front,h:h0,name});
  return true;
}
function buildViewpoints(){
  // across each lake toward its island
  for(const L of LAKES){
    const toIsland=tangentToward(L.p,L.island.p.clone().sub(L.p));
    const order=[...L.shore].sort((a,b)=>a.dir.dot(toIsland)-b.dir.dot(toIsland));
    let made=0;
    for(const o of order){if(made>=2)break;if(made===1&&order.indexOf(o)<14)continue;
      if(viewBench(offsetP(L.p,o.dir,o.dist+3),L.island.p,L.name))made++;}
  }
  // the alpine lake, looking up at the Sugarhorn
  const away=tangentToward(ALPINE.p,ALPINE.p.clone().sub(PEAKS[0].p));
  for(let k=0;k<12;k++){const d=away.clone().applyAxisAngle(ALPINE.p,(k%2?1:-1)*Math.ceil(k/2)*0.3);if(viewBench(offsetP(ALPINE.p,d,ALPINE.r+3.2),PEAKS[0].p,'Alpine lake'))break;}
  // the river bank, just downstream of the stone bridge
  {let i=river.pts.findIndex((p,j)=>river.S[j]>river.sx+15);
   for(let k=0;k<20&&i>0&&i<river.pts.length-1;k++,i+=3){
     const p=river.pts[i],tg=tangentToward(p,river.pts[i+1].clone().sub(river.pts[i-1])),rt=V(0,0,0).crossVectors(tg,p).normalize();
     const w=river.width(river.S[i])*0.5+4.5;
     if(viewBench(offsetP(p,rt,w),p,'Ribbon River')||viewBench(offsetP(p,rt,-w),p,'Ribbon River'))break;}}
  // the meadow, looking over the flowers
  for(let k=0,m=0;k<24&&m<2;k++){const d=randomTangent(MEADOW);if(viewBench(offsetP(MEADOW,d,15),MEADOW,'Petal Meadow'))m++;}
  // a hill overlooking the city skyline
  {let best=null;for(let k=0;k<160;k++){const d=randomTangent(CITY),p=offsetP(CITY,d,range(78,100));if(angTo(p,ALPS)*R<ALPS_R+10||roadEdge(p.x,p.y,p.z)<6)continue;const h=hAt(p);if(!best||h>best.h)best={p,h};}
   if(best)viewBench(best.p,CITY,'City overlook');}
  // the snowy north, facing the Alps
  for(let k=0;k<80;k++){const p=randomUnit();if(p.y<0.82||angTo(p,ALPS)*R<ALPS_R)continue;if(slopeAt(p)<0.92)continue;if(viewBench(p,ALPS,'Snowy North'))break;}
  // the farm, facing the windmills
  if(windmills.length)for(let k=0;k<20;k++){const w=windmills[0].p,p=offsetP(w,randomTangent(w),14);if(viewBench(p,w,'Butter Farms'))break;}
}
function buildPoles(){
  let men=0;
  for(let i=0;i<500&&men<7;i++){
    const p=randomUnit();if(p.y<0.8||angTo(p,ALPS)*R<ALPS_R*0.8)continue;
    if(!free(p,1.3)||slopeAt(p)<0.9)continue;
    place('Snowman',p,randomTangent(p),{h:-0.1});occupy(p,1.6);colCircle(p,0.6,hAt(p));men++;
  }
  for(let i=0;i<900;i++){
    const p=randomUnit();
    const south=p.y<-0.66,alps=angTo(p,ALPS)*R<ALPS_R*0.9;
    if(!south&&!alps)continue;
    if(rand()>(alps?0.25:0.12))continue;
    if(!free(p,1.5,1.5))continue;
    const h=hAt(p);if(h<waterLevelAt(p)+0.3)continue;
    place('Boulder',p,randomTangent(p),{s:range(0.7,1.8),h:-0.25});occupy(p,1.8);colCircle(p,1.1,h);
  }
}
function buildForests(){
  let n=0;
  for(let i=0;i<16000&&n<1250;i++){
    const p=randomUnit();
    if(cityDist(p.x,p.y,p.z)<4)continue;
    if(angTo(p,MEADOW)*R<20&&rand()<0.85)continue;
    if(angTo(p,FARM)*R<55&&rand()<0.8)continue;
    const dc=angTo(p,CITY)*R;if(dc<140&&rand()<0.6)continue;
    if(!free(p,1.6,1.2))continue;
    const h=hAt(p);if(h<waterLevelAt(p)+0.4)continue;
    const da=angTo(p,ALPS)*R,s=range(0.85,1.35);
    if(da<ALPS_R+6){
      const sl=slopeAt(p);if(h>26||sl<0.62)continue;
      if(h>17&&rand()<0.45)continue;
      const tall=rand()<0.7;
      if(h>12||p.y>0.7)tree(p,tall?'Tree_PineTallSnow':'Tree_PineSnow',s,pick(PINES),0.35);
      else tree(p,tall?'Tree_PineTall':'Tree_Pine',s,h>8?pick(FROST):pick(PINES),0.35);
      n++;continue;
    }
    if(p.y>0.7){tree(p,rand()<0.6?'Tree_PineTallSnow':'Tree_PineSnow',s,pick(PINES),0.3);n++;
      if(rand()<0.35){const q=offsetP(p,randomTangent(p),range(1.8,3));place('SnowMound',q,randomTangent(q),{s:range(0.6,1.1),h:-0.12});}
      continue;}
    if(p.y>0.64){tree(p,rand()<0.6?'Tree_PineTall':'Tree_Pine',s,pick(FROST),0.3);n++;continue;}
    if(p.y<-0.6){const k=rand();tree(p,k<0.55?'Tree_Round':k<0.8?'Tree_Birch':'Tree_Pine',s,k<0.55?pick(AUTUMN):k<0.8?pick(BIRCH):pick(PINES));n++;continue;}
    const k=rand();tree(p,k<0.6?'Tree_Round':k<0.8?'Tree_Pine':'Tree_Birch',s,k<0.6?pick(LEAVES):k<0.8?pick(PINES):pick(BIRCH));n++;
  }
}
function buildMeadow(){
  for(let i=0;i<420;i++){
    const p=offsetP(MEADOW,randomTangent(MEADOW),Math.sqrt(rand())*25);
    if(roadEdge(p.x,p.y,p.z)<0.5||!occFree(p,0.1))continue;
    place('Flower',p,randomTangent(p),{s:range(0.8,1.3),colors:{Petal:pick(PETALS)}});
  }
}

/* ================================================================ extra kit objects made in code */
function extraKit(){for(const g of OurPlanet.extraModels())kit.add(g);}

/* ================================================================ animated things */
const anim={people:[],traffic:[],balloons:[],planes:[],birds:null,clouds:null,ferris:null,blades:[],beam:null};
function makeBanner(){
  const c=document.createElement('canvas');c.width=1024;c.height=170;
  const tex=new THREE.CanvasTexture(c);tex.encoding=THREE.sRGBEncoding;tex.anisotropy=4;
  const draw=()=>{
    const x=c.getContext('2d');
    x.fillStyle='#FFF7EE';x.fillRect(0,0,1024,170);
    const stripe=['#F4A99B','#FFD88F','#9FD8C4','#A2CBEF','#C4B5F0'];
    stripe.forEach((s,i)=>{x.fillStyle=s;x.fillRect(i*1024/5,0,1024/5+1,14);x.fillRect(i*1024/5,156,1024/5+1,14);});
    x.fillStyle='#3A3550';x.font='600 92px Fredoka, "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
    x.textAlign='center';x.textBaseline='middle';x.fillText('Our Beautiful Planet ♥',512,90);
    tex.needsUpdate=true;
  };
  draw();if(document.fonts&&document.fonts.load)document.fonts.load('600 92px Fredoka').then(draw).catch(()=>{});
  const g=new THREE.Group(),mat=new THREE.MeshStandardMaterial({map:tex,roughness:0.85});
  const geo=new THREE.PlaneGeometry(12,2,1,1);
  const a=new THREE.Mesh(geo,mat),b=new THREE.Mesh(geo,mat);b.rotation.y=Math.PI;   // readable from both sides
  a.position.set(-13.5,-0.9,0.01);b.position.set(-13.5,-0.9,-0.01);a.castShadow=b.castShadow=true;
  const ropeLen=Math.hypot(5.2,0.9),rope=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,ropeLen,5),new THREE.MeshStandardMaterial({color:lin(0x8C7A6B)}));
  rope.position.set(-4.9,-0.45,0);rope.rotation.z=Math.PI/2-Math.atan2(0.9,5.2);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,2.1,6),rope.material);pole.position.set(-7.5,-0.9,0);
  g.add(a,b,rope,pole);g.userData.sway=g;return g;
}
// birds: a body and two flapping wings per bird, flying in loose V formations
function setupBirds(){
  const BG=OurPlanet.birdGeometries(),bodyG=BG.body,headG=BG.head,wingL=BG.wingL,wingR=BG.wingR,beakG=BG.beak;
  const flocks=[],COL=[0xFFFFFF,0xF2F0F7,0x8F89A6,0xFFFFFF,0xE9E4F2,0xFFFFFF];
  for(let f=0;f<7;f++){
    const n=randomUnit(),u=randomTangent(n),birds=[];
    const k=4+Math.floor(rand()*5);
    for(let j=0;j<k;j++){const row=Math.ceil(j/2),side=j===0?0:(j%2?1:-1);birds.push({along:-row*1.5+range(-0.2,0.2),side:side*row*1.3+range(-0.2,0.2),dy:range(-0.4,0.4),ph:range(0,6)});}
    flocks.push({n,u,v:V(0,0,0).crossVectors(n,u),a:range(0,6.28),w:range(6,8.5)/(R+20),alt:range(13,24),birds,col:COL[f%COL.length]});
  }
  const total=flocks.reduce((s,f)=>s+f.birds.length,0);
  const mk=(geo,hex)=>{const m=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({color:0xFFFFFF,roughness:0.8}),total);m.frustumCulled=false;m.castShadow=true;scene.add(m);return m;};
  const body=mk(bodyG),head=mk(headG),wl=mk(wingL),wr=mk(wingR),beak=new THREE.InstancedMesh(beakG,new THREE.MeshStandardMaterial({color:lin(0xF6B26B)}),total);
  beak.frustumCulled=false;scene.add(beak);
  let i=0;for(const f of flocks)for(const b of f.birds){const c=lin(f.col);body.setColorAt(i,c);head.setColorAt(i,c);wl.setColorAt(i,c.clone().multiplyScalar(0.93));wr.setColorAt(i,c.clone().multiplyScalar(0.93));i++;}
  anim.birds={flocks,body,head,wl,wr,beak};
}
function setupLife(){
  // people on city sidewalks, around the fountain, in the park and by the lake
  const walkers=[];
  const cityRoads=ROADS.filter(r=>!r.full);
  for(let i=0;i<40;i++){
    let r,tMin,tMax;
    if(i<30){r=pick(cityRoads);tMin=2/R;tMax=r.len-2/R;}
    else{r=pick([ROAD_A,ROAD_B]);const t0=tOf(r,CITY);tMin=t0-46/R;tMax=t0+46/R;}
    walkers.push({kind:0,r,tMin,tMax,t:range(tMin,tMax),side:(rand()<0.5?1:-1)*(r.rh+r.walk*0.55+range(-0.25,0.25)),dir:rand()<0.5?1:-1,v:range(1.0,1.6)});
  }
  for(let i=0;i<9;i++)walkers.push({kind:1,c:fountainSpot,rad:range(4.3,6.2),a:range(0,6.28),v:range(0.9,1.3)*(rand()<0.5?1:-1)});
  for(let i=0;i<6;i++)walkers.push({kind:1,c:parkSpot,rad:range(3,5.5),a:range(0,6.28),v:range(0.8,1.2)*(rand()<0.5?1:-1)});
  for(let i=0;i<6;i++)walkers.push({kind:1,c:BIGLAKE.p,rad:Math.max(...BIGLAKE.shore.map(o=>o.dist))+3.5+range(-0.3,0.6),a:range(0,6.28),v:range(0.9,1.3)*(rand()<0.5?1:-1)});
  walkers.forEach(w=>{w.ph=range(0,6.28);w.jump=0;w.jv=0;});
  const look=walkers.map(()=>({Shirt:pick(SHIRTS),Pants:pick(PANTS),Skin:pick(SKINS),Hair:pick(HAIRS)}));
  anim.people={list:walkers,inst:dynamic('Person',walkers.length,i=>look[i])};
  // traffic on the three main roads
  const cars=[];
  for(let i=0;i<9;i++){const r=MAIN[i%3];cars.push({r,t:range(0,6.28),dir:rand()<0.5?1:-1,v:range(8,11),vmax:range(8,11.5),type:rand()<0.55?0:1,col:carColors(pick(Object.keys(PAL)))});}
  const pick0=cars.filter(c=>c.type===0),pick1=cars.filter(c=>c.type===1);
  anim.traffic={cars,i0:dynamic('Car_Pickup_Static',pick0.length,i=>pick0[i].col),i1:dynamic('Car_Bubble_Static',pick1.length,i=>pick1[i].col)};
  pick0.forEach((c,i)=>c.slot=i);pick1.forEach((c,i)=>c.slot=i);
  const sails=boats.filter(b=>!b.model),rows=boats.filter(b=>b.model);
  sails.forEach((b,i)=>b.slot=i);rows.forEach((b,i)=>b.slot=i);
  anim.sail=dynamic('Sailboat',sails.length,i=>({Sail:sails[i].c,Accent:sails[i].c===0xFFFDF7?0xA2CBEF:sails[i].c}));
  anim.row=dynamic('Rowboat',rows.length);
  anim.ducks=dynamic('Duck',ducks.length);
  // balloons drift on slow great circles
  const BC=[[0xF4A99B,0xFFF4D6],[0xA2CBEF,0xFFFFFF],[0xFFD88F,0xF4A99B],[0xC4B5F0,0xFFF4D6],[0x9FD8C4,0xFFE3A3],[0xF6C9D3,0xFFFFFF]];
  for(let i=0;i<6;i++){
    const o=cloneAsset('Balloon',{Balloon:BC[i][0],BalloonStripe:BC[i][1]});scene.add(o);
    const n=randomUnit(),u=randomTangent(n);
    anim.balloons.push({o,n,u,v:V(0,0,0).crossVectors(n,u),a:range(0,6.28),w:range(0.008,0.016),alt:range(30,44),ph:range(0,6)});
  }
  // little planes on long loops around the planet, the first one towing a banner
  const PC=[[0xF4A99B,0xFFF4D6],[0xA2CBEF,0xFFFFFF],[0xFFD88F,0xF4A99B],[0xC4B5F0,0xFFF4D6]];
  [36,44,58,82].forEach((alt,i)=>{
    const g=new THREE.Group();
    g.add(cloneAsset('Plane',{PlaneBody:PC[i][0],PlaneWing:PC[i][1]}));
    const prop=cloneAsset('Plane_Prop');prop.position.set(2.3,0,0);g.add(prop);
    if(i===0)g.add(makeBanner());
    scene.add(g);
    const n=randomUnit(),u=randomTangent(n);
    anim.planes.push({g,prop,n,u,v:V(0,0,0).crossVectors(n,u),a:range(0,6.28),w:(13+i*2.5)/(R+alt),alt,ph:range(0,6)});
  });
  setupBirds();
  // signal lamps: one instanced mesh, recoloured as the lights change
  {const g=new THREE.SphereGeometry(0.12,12,8);g.scale(1,1,0.5);
   const m=new THREE.InstancedMesh(g,new THREE.MeshBasicMaterial({color:0xFFFFFF}),Math.max(1,sigLamps.length));m.frustumCulled=false;
   sigLamps.forEach((l,i)=>{_m.compose(l.pos,l.q,_s.set(1,1,1));m.setMatrixAt(i,_m);m.setColorAt(i,lin(0x333333));});
   scene.add(m);anim.lamps=m;}
  // pedestrians waiting at the zebra crossings of each signal
  const cr=[];
  for(const sg of SIGS){
    const n=sg.city?6:2;
    for(let k=0;k<n;k++){
      const road=k%2?sg.c.b:sg.c.a,o=crossOther(sg.c,road),side=(Math.floor(k/2)%2)?1:-1;
      const tz=sg.t.get(road)+side*(o.rh+o.walk+1.75)/R,w=road.rh+road.walk*0.6;
      cr.push({sg,road,tz,from:rand()<0.5?-w:w,u:0,walking:false,wait:range(0,4),v:range(1.1,1.4),ph:range(0,6),off:range(-0.5,0.5)});
    }
  }
  const crLook=cr.map(()=>({Shirt:pick(SHIRTS),Pants:pick(PANTS),Skin:pick(SKINS),Hair:pick(HAIRS)}));
  anim.crossers={list:cr,inst:dynamic('Person',Math.max(1,cr.length),i=>crLook[i]||crLook[0])};
  // ferris wheel
  if(ferris){
    const g=new THREE.Group();g.position.copy(ferris.p).multiplyScalar(R);g.quaternion.copy(quatUpFront(ferris.p,ferris.front));scene.add(g);anim.ferrisG=g;
    g.add(cloneAsset('Ferris_Base'));
    const wheel=cloneAsset('Ferris_Wheel');wheel.position.set(0,9.4,0);g.add(wheel);
    const cabs=[];const CC=[0xA2CBEF,0xF4A99B,0xFFD88F,0x9FD8C4,0xC4B5F0];
    for(let k=0;k<10;k++){const c=cloneAsset('Ferris_Cab',{Cab:CC[k%5]});g.add(c);cabs.push(c);}
    anim.ferris={wheel,cabs,a:0};
  }
  for(const w of windmills){
    const g=new THREE.Group();g.position.copy(w.p).multiplyScalar(R+w.base);g.quaternion.copy(quatUpFront(w.p,w.fr));scene.add(g);
    const b=cloneAsset('Windmill_Blades');b.position.set(0,8.6,1.95);g.add(b);anim.blades.push({b,w:range(0.5,0.8)});
  }
  if(lighthouse.p){
    const beamGeo=new THREE.ConeGeometry(2.4,16,24,1,true);beamGeo.translate(0,-8,0);beamGeo.rotateZ(Math.PI/2);
    const beam=new THREE.Mesh(beamGeo,beamMat=new THREE.MeshBasicMaterial({color:lin(0xFFF2C6),transparent:true,opacity:0.16,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
    const g=new THREE.Group();g.position.copy(lighthouse.p).multiplyScalar(R+lighthouse.h);g.quaternion.copy(quatUpFront(lighthouse.p,lighthouse.front));scene.add(g);
    const pivot=new THREE.Group();pivot.position.set(0,12,0);pivot.add(beam);beam.position.set(0,0,0);g.add(pivot);anim.beam=pivot;
  }
  // clouds
  const cg=new THREE.Group(),cm=new THREE.MeshStandardMaterial({color:lin(0xFFFFFF),roughness:1,emissive:lin(0xFFFFFF),emissiveIntensity:0.32});cloudMat=cm;
  for(let i=0;i<22;i++){
    const p=randomUnit(),g=new THREE.Group();
    for(let k=0;k<5;k++){const b=new THREE.Mesh(new THREE.SphereGeometry(range(2.6,4.4),14,10),cm);b.position.set(k*3.6-7.2,range(0,1.4),range(-1.5,1.5));g.add(b);}
    g.position.copy(p).multiplyScalar(R+range(52,66));g.quaternion.copy(quatUpFront(p,randomTangent(p)));cg.add(g);
  }
  // a few low clouds snagged on the peaks
  for(const P of PEAKS.slice(0,4)){
    const p=offsetP(P.p,randomTangent(P.p),range(6,14)),g=new THREE.Group();
    for(let k=0;k<4;k++){const b=new THREE.Mesh(new THREE.SphereGeometry(range(2,3.2),14,10),cm);b.position.set(k*3-4.5,range(0,1),range(-1,1));g.add(b);}
    g.position.copy(p).multiplyScalar(R+P.H*0.8);g.quaternion.copy(quatUpFront(p,randomTangent(p)));cg.add(g);
  }
  scene.add(cg);anim.clouds=cg;
  for(const [pos,r,c] of [[V(-620,380,-760),66,0xF6D7E4],[V(820,-260,-440),40,0xFFE7B5],[V(380,620,760),26,0xCFC4F2]]){
    const m=new THREE.Mesh(new THREE.SphereGeometry(r,48,32),new THREE.MeshStandardMaterial({color:lin(c),roughness:1,emissive:lin(c),emissiveIntensity:0.55}));m.position.copy(pos);scene.add(m);
  }
}
const dynColliders=[];
function updateLife(dt,time){
  // people
  const P=anim.people,carPos=car.p.clone().multiplyScalar(R),mePos=me.p.clone().multiplyScalar(R);
  P.list.forEach((w,i)=>{
    let p,front;
    if(w.kind===0){
      w.t+=w.dir*w.v*dt/R*(w.jump>0?0:1);
      if(w.t>w.tMax){w.t=w.tMax;w.dir=-1;}if(w.t<w.tMin){w.t=w.tMin;w.dir=1;}
      const p0=pointOn(w.r,w.t);p=offsetP(p0,w.r.n,w.side+(w.dodge||0));front=tangentOn(w.r,w.t).multiplyScalar(w.dir);
    }else{
      if(!w.c)return;
      w.a+=w.v*dt/w.rad*(w.jump>0?0:1);
      const t1=randomTangentFixed(w.c),t2=V(0,0,0).crossVectors(w.c,t1);
      const dir=t1.clone().multiplyScalar(Math.cos(w.a)).addScaledVector(t2,Math.sin(w.a));
      p=offsetP(w.c,dir,w.rad+(w.dodge||0));front=t2.clone().multiplyScalar(Math.cos(w.a)).addScaledVector(t1,-Math.sin(w.a)).multiplyScalar(Math.sign(w.v));
    }
    const pw=p.clone().multiplyScalar(R);
    // step aside to pass the explorer, then drift back to their usual line
    const dMe=me.on?pw.distanceTo(mePos):1e9;
    let want=0;
    if(dMe<3.2){
      const lat=w.kind===0?w.r.n:tangentToward(p,p.clone().sub(w.c));
      const side=me.p.clone().sub(p).dot(lat)>0?-1:1;
      want=side*(1.25-Math.min(1,dMe/3.2)*0.5);
      if(dMe<2.4&&!w.greeted&&w.jump<=0){w.greeted=true;w.jump=0.01;w.jv=2.6;}   // a little hop to say hi
    }else if(dMe>6)w.greeted=false;
    w.dodge=(w.dodge||0)+(want-(w.dodge||0))*Math.min(1,dt*3);
    w.ph+=dt*w.v*6;
    if(w.jump<=0&&pw.distanceTo(carPos)<2.8&&Math.abs(car.vf)>1.5){w.jump=0.01;w.jv=4.2;}
    if(w.jump>0){w.jv-=14*dt;w.jump+=w.jv*dt;if(w.jump<=0){w.jump=0;}}
    const base=w.kind===0?Y_WALK:Math.max(hAtCached(w,p),0);
    const bob=Math.abs(Math.sin(w.ph))*0.06;
    const q=quatUpFront(p,front);
    _q.setFromAxisAngle(V(0,0,1),Math.sin(w.ph)*0.06);q.multiply(_q);
    P.inst.set(i,p.multiplyScalar(R+base+bob+w.jump),q);
  });
  P.inst.commit();
  // signals
  const LC=[[lin(0xFF5B5B),lin(0x4A2E36)],[lin(0xFFC447),lin(0x4A4030)],[lin(0x5FE39A),lin(0x26403A)]],_c=new THREE.Color();
  for(const sg of SIGS)sg.time+=dt;
  if(anim.lamps){sigLamps.forEach((l,i)=>{const st=sigState(l.sg,l.road),on=(l.k===0&&st==='r')||(l.k===1&&st==='y')||(l.k===2&&st==='g');anim.lamps.setColorAt(i,_c.copy(LC[l.k][on?0:1]));});anim.lamps.instanceColor.needsUpdate=true;}
  // people crossing on the zebra while traffic on that road has red
  const crossPos=[];
  if(anim.crossers){anim.crossers.list.forEach((c,i)=>{
    const w=c.road.rh+c.road.walk*0.6;
    if(!c.walking){c.wait-=dt;if(c.wait<=0&&sigState(c.sg,c.road)==='r'&&sigRedLeft(c.sg,c.road)>7.5){c.walking=true;c.u=0;}}
    else{c.u+=c.v*dt/(2*w);c.ph+=dt*c.v*6;if(c.u>=1){c.walking=false;c.from=-c.from;c.u=0;c.wait=range(3,9);}}
    const off=c.walking?lerp(c.from,-c.from,c.u):c.from,p=offsetP(pointOn(c.road,c.tz),c.road.n,off);
    const along=tangentOn(c.road,c.tz).multiplyScalar(c.off);
    const pp=offsetP(p,along.lengthSq()>0?along.clone().normalize():c.road.n,Math.abs(c.off));
    let front=c.walking?c.road.n.clone().multiplyScalar(-Math.sign(c.from)):tangentToward(pp,c.road.n.clone().multiplyScalar(-Math.sign(c.from)));
    if(!c.walking)front.applyAxisAngle(pp,Math.sin(time*0.45+c.ph)*0.55);
    const onRoad=Math.abs(off)<c.road.rh,bob=c.walking?Math.abs(Math.sin(c.ph))*0.06:Math.sin(time*1.6+c.ph)*0.012+0.012;
    const q=quatUpFront(pp,front);_q.setFromAxisAngle(V(0,0,1),c.walking?Math.sin(c.ph)*0.06:Math.sin(time*0.9+c.ph)*0.025);q.multiply(_q);
    if(c.walking&&onRoad)crossPos.push(pp.clone().multiplyScalar(R));
    anim.crossers.inst.set(i,pp.multiplyScalar(R+(onRoad?Y_ROAD:Y_WALK)+bob),q);
  });anim.crossers.inst.commit();}
  // traffic
  const T=anim.traffic;dynColliders.length=0;
  if(me.on){const ez=car.f.clone(),ex=V(0,0,0).crossVectors(car.p,ez).normalize();dynColliders.push({type:1,c:car.p.clone().multiplyScalar(R+car.h),ex,ez,hx:0.85,hz:1.5,br:1.8});}
  for(const c of T.cars){
    const pos=pointOn(c.r,c.t),fr=tangentOn(c.r,c.t).multiplyScalar(c.dir);
    c.lo=c.lo==null?0:c.lo;c.over=Math.max(0,(c.over||0)-dt);
    const lane=offsetP(pos,c.r.n,-c.dir*1.75+c.dir*3.5*c.lo);
    // brake for the player, the explorer or a car ahead; pull out around a parked truck
    let target=c.vmax;
    const ahead=lane.clone().multiplyScalar(R).addScaledVector(fr,6);
    if(ahead.distanceTo(carPos)<6.5){if(Math.abs(car.vf)<0.3&&(me.on||c.over>0)){c.over=3.5;target=c.vmax*0.6;}else target=0;}
    if(me.on&&ahead.distanceTo(mePos)<5.5)target=0;
    for(const cp of crossPos)if(ahead.distanceTo(cp)<5)target=0;
    // traffic lights: ease to the stop line on red, go through on amber if too close to stop
    for(const sg of SIGS){
      if(sg.c.a!==c.r&&sg.c.b!==c.r)continue;
      let d=((sg.t.get(c.r)-c.t)*c.dir)%(Math.PI*2);if(d<0)d+=Math.PI*2;d*=R;
      if(d>60)continue;
      const toStop=d-stopDist(crossOther(sg.c,c.r))-1.6;if(toStop<-0.4)continue;
      const st=sigState(sg,c.r);if(st==='g'||(st==='y'&&toStop<7))continue;
      target=Math.min(target,toStop<0.25?0:Math.sqrt(2*3.2*toStop));
    }
    c.lo+=((c.over>0?1:0)-c.lo)*Math.min(1,dt*1.2);
    for(const o of T.cars){if(o===c||o.r!==c.r||o.dir!==c.dir)continue;let d=(o.t-c.t)*c.dir;d=((d%(Math.PI*2))+Math.PI*2)%(Math.PI*2);if(d*R<9)target=0;}
    c.v+=(target-c.v)*Math.min(1,dt*(target<c.v?4:1));
    c.t+=c.dir*c.v*dt/R;
    const q=quatUpFwdX(lane,fr);
    (c.type===0?T.i0:T.i1).set(c.slot,lane.clone().multiplyScalar(R+Y_ROAD),q);
    dynColliders.push({type:0,c:lane.clone().multiplyScalar(R),r:1.5,br:1.5});
  }
  T.i0.commit();T.i1.commit();
  // boats + ducks
  // boats and ducks follow loops around the lake, easing in and out to stay clear of the shore and island
  const onLake=(L,a,rc,w)=>{
    const t1=randomTangentFixed(L.p),t2=V(0,0,0).crossVectors(L.p,t1);
    const dir=t1.clone().multiplyScalar(Math.cos(a)).addScaledVector(t2,Math.sin(a)),p=offsetP(L.p,dir,rc);
    const fr=t2.clone().multiplyScalar(Math.cos(a)).addScaledVector(t1,-Math.sin(a)).multiplyScalar(Math.sign(w));
    return{p,fr};
  };
  boats.forEach((b,i)=>{
    b.a+=b.w*dt*12/Math.max(6,b.rc||b.r);
    const want=laneR(b.L,b.a,b.r,4);b.rc=b.rc==null?want:b.rc+(want-b.rc)*Math.min(1,dt*0.8);
    const {p,fr}=onLake(b.L,b.a,b.rc,b.w);
    const q=quatUpFwdX(p,fr);_q.setFromAxisAngle(V(1,0,0),Math.sin(time*0.9+i)*0.05);q.multiply(_q);
    (b.model?anim.row:anim.sail).set(b.slot,p.multiplyScalar(R+b.L.level+0.03+Math.sin(time*1.3+i)*0.04),q);b.wp=p.clone();
  });
  anim.sail.commit();anim.row.commit();
  ducks.forEach((d,i)=>{
    if(d.lag===0)d.a+=d.w*dt;
    else{const m=ducks[i-Math.round(d.lag/0.95)];d.a=m.a-Math.sign(d.w)*d.lag/Math.max(3,m.rc||m.r)+Math.sin(time*1.7+d.ph)*0.01;}
    const want=laneR(d.L,d.a,d.r,2);d.rc=d.rc==null?want:d.rc+(want-d.rc)*Math.min(1,dt*1.2);
    const {p,fr}=onLake(d.L,d.a,d.rc,d.w);
    const up=p.clone();
    anim.ducks.set(i,p.multiplyScalar(R+d.L.level+Math.sin(time*3+d.ph)*0.025),quatUpFwdX(up,fr),d.s);d.wp=p.clone();
  });
  anim.ducks.commit();
  for(const pl of anim.planes){
    pl.a+=pl.w*dt;
    const p=pl.u.clone().multiplyScalar(Math.cos(pl.a)).addScaledVector(pl.v,Math.sin(pl.a));
    const fw=pl.u.clone().multiplyScalar(-Math.sin(pl.a)).addScaledVector(pl.v,Math.cos(pl.a));
    pl.g.position.copy(p).multiplyScalar(R+pl.alt+Math.sin(time*0.4+pl.ph)*2);
    pl.g.quaternion.copy(quatUpFwdX(p,fw));
    _q.setFromAxisAngle(V(1,0,0),Math.sin(time*0.25+pl.ph)*0.18);pl.g.quaternion.multiply(_q);
    pl.prop.rotation.x+=dt*40;
  }
  if(anim.birds){
    const B=anim.birds,M2=new THREE.Matrix4(),W=new THREE.Matrix4(),T=new THREE.Matrix4();let i=0;
    for(const f of B.flocks){
      f.a+=f.w*dt;
      const cp=f.u.clone().multiplyScalar(Math.cos(f.a)).addScaledVector(f.v,Math.sin(f.a));
      const fw=f.u.clone().multiplyScalar(-Math.sin(f.a)).addScaledVector(f.v,Math.cos(f.a)),rt=V(0,0,0).crossVectors(fw,cp);
      for(const b of f.birds){
        const p=offsetP(offsetP(cp,fw,b.along),rt,b.side);
        const glide=Math.sin(time*0.6+b.ph)>0.55;                 // birds glide now and then
        const flap=glide?0.12:Math.sin(time*10+b.ph)*0.7;
        const q=quatUpFwdX(p,fw);
        M2.compose(p.multiplyScalar(R+f.alt+b.dy+Math.sin(time*1.4+b.ph)*0.3),q,_s.set(1.5,1.5,1.5));
        B.body.setMatrixAt(i,M2);B.head.setMatrixAt(i,M2);B.beak.setMatrixAt(i,M2);
        W.multiplyMatrices(M2,T.makeTranslation(0,0.05,0.06)).multiply(T.makeRotationX(flap));B.wl.setMatrixAt(i,W);
        W.multiplyMatrices(M2,T.makeTranslation(0,0.05,-0.06)).multiply(T.makeRotationX(-flap));B.wr.setMatrixAt(i,W);
        i++;
      }
    }
    for(const m of [B.body,B.head,B.beak,B.wl,B.wr])m.instanceMatrix.needsUpdate=true;
  }
  waterTime.value=time;
  for(const b of anim.balloons){
    b.a+=b.w*dt;
    const p=b.u.clone().multiplyScalar(Math.cos(b.a)).addScaledVector(b.v,Math.sin(b.a));
    b.o.position.copy(p).multiplyScalar(R+b.alt+Math.sin(time*0.5+b.ph)*1.2);
    b.o.quaternion.copy(quatUpFront(p,b.n));
  }
  if(anim.ferris){
    const F=anim.ferris;F.a+=dt*0.12;F.wheel.rotation.z=F.a;
    F.cabs.forEach((c,k)=>{const a=F.a+k/10*Math.PI*2;c.position.set(Math.cos(a)*7.2,9.4+Math.sin(a)*7.2,0);c.rotation.z=Math.sin(time*1.2+k)*0.04;});
  }
  for(const b of anim.blades)b.b.rotation.z-=dt*b.w;
  if(anim.beam)anim.beam.rotation.y+=dt*0.8;
  if(anim.clouds)anim.clouds.rotation.y+=dt*0.004;
}
// distance from the lake centre (along heading a) closest to `want` that keeps `margin` metres of water around
function laneR(L,a,want,margin){
  const n=L.shore.length,i=((Math.round(a/(Math.PI*2)*n)%n)+n)%n,o=L.shore[i],maxS=o.dist-margin;
  let best=null;
  for(let s=2;s<=maxS;s+=0.5){
    const p=offsetP(L.p,o.dir,s);
    if(angTo(p,L.island.p)*R<L.island.r*1.6+margin*0.7)continue;
    if(best===null||Math.abs(s-want)<Math.abs(best-want))best=s;
  }
  return best===null?Math.max(2,maxS):best;
}
const tangentCache=new Map();
function randomTangentFixed(c){let t=tangentCache.get(c);if(!t){t=V(0,0,0).crossVectors(c,Math.abs(c.y)<0.9?V(0,1,0):V(1,0,0)).normalize();tangentCache.set(c,t);}return t;}
function hAtCached(w,p){if(w._hk&&w._hp.distanceToSquared(p)<1e-9)return w._h;w._hp=p.clone();w._hk=1;w._h=hAt(p);return w._h;}

/* ================================================================ player truck */
const truck=new THREE.Group();scene.add(truck);
let body,truckSrc=null,wheels=[],tintMats={},tailMat=null,cockpit=null,steerWheel=null;const truckGlass=[];
function makeTruck(){
  const src=kit.getObjectByName('Car_Pickup').clone(true);
  body=new THREE.Group();truck.add(body);
  const wn=[];src.traverse(o=>{if(/Wheel(FL|FR|RL|RR)$/.test(o.name))wn.push(o);});
  wn.forEach(w=>w.parent.remove(w));body.add(src);truckSrc=src;
  src.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;const n=o.material.name;
    if(['Body','Accent','Fender','Taillight'].includes(n)){o.material=o.material.clone();(tintMats[n]=tintMats[n]||[]).push(o.material);}});
  wheels=wn.map(w=>{w.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});w.rotation.order='YXZ';truck.add(w);return{node:w,front:/WheelF/.test(w.name)};});
  tailMat=(tintMats.Taillight||[])[0];
  src.traverse(o=>{if(o.isMesh&&(o.material.name==='Glass'||o.material.name==='Accent'))truckGlass.push(o);});   // windscreen and roof panel hide in the driver view
  // a little cockpit for the driver view: dashboard, gauges, a steering wheel and a dangling charm
  cockpit=new THREE.Group();cockpit.visible=false;
  const dashMat=new THREE.MeshStandardMaterial({color:lin(0xFFF1E2),roughness:0.7}),darkMat=new THREE.MeshStandardMaterial({color:lin(0x4A4560),roughness:0.6});
  const glowMat=new THREE.MeshStandardMaterial({color:lin(0xBFE7DA),emissive:lin(0x9FD8C4),emissiveIntensity:0.5,roughness:0.4});
  const dash=new THREE.Mesh(OurPlanet.roundedBox(0.36,0.16,1.5,0.06),dashMat);dash.position.set(0.52,1.54,0);
  const hoodStrip=new THREE.Mesh(OurPlanet.roundedBox(1.25,0.1,1.55,0.05),tintMats.Body?tintMats.Body[0]:dashMat);hoodStrip.position.set(1.15,1.42,0);hoodStrip.rotation.z=-0.06;
  const hoodNose=new THREE.Mesh(new THREE.SphereGeometry(0.05,10,8),tintMats.Accent?tintMats.Accent[0]:dashMat);hoodNose.position.set(1.72,1.42,0);
  const dashTop=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.03,1.3),tintMats.Accent?tintMats.Accent[0]:dashMat);dashTop.position.set(0.48,1.29,0);
  const gauge=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.02,20),glowMat);gauge.rotation.z=Math.PI/2+0.5;gauge.position.set(0.36,1.63,-0.3);
  const gauge2=gauge.clone();gauge2.position.z=-0.14;gauge2.scale.setScalar(0.7);
  steerWheel=new THREE.Group();steerWheel.position.set(0.12,1.66,-0.3);steerWheel.rotation.z=0.55;
  const rim=new THREE.Mesh(new THREE.TorusGeometry(0.155,0.02,10,32),darkMat);rim.rotation.y=Math.PI/2;
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.04,16),tintMats.Body?tintMats.Body[0]:darkMat);hub.rotation.z=Math.PI/2;
  const spoke=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.02,0.32),darkMat),spoke2=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.16,0.02),darkMat);spoke2.position.y=-0.08;
  steerWheel.add(rim,hub,spoke,spoke2);
  const col=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.03,0.25,8),darkMat);col.rotation.z=Math.PI/2+0.55;col.position.set(0.24,1.6,-0.3);
  const charm=new THREE.Mesh(new THREE.SphereGeometry(0.024,10,8),new THREE.MeshStandardMaterial({color:lin(0xF4A99B),roughness:0.5}));charm.position.set(0.62,1.9,0.12);
  const charmStr=new THREE.Mesh(new THREE.CylinderGeometry(0.003,0.003,0.12,4),darkMat);charmStr.position.set(0.62,1.97,0.12);
  cockpit.add(dash,hoodStrip,hoodNose,gauge,gauge2,steerWheel,col,charm,charmStr);cockpit.userData.charm=charm;
  truck.add(cockpit);
}
function paintTruck(k){const c=carColors(k);if(me.model)me.model.userData.mats.shirt.color.copy(lin(PAL[k].Body));for(const n of ['Body','Accent','Fender'])(tintMats[n]||[]).forEach(m=>m.color.copy(lin(c[n])));}

const SKN=800,skidGeo=new THREE.PlaneGeometry(0.42,0.18);skidGeo.rotateX(-Math.PI/2);
const skids=new THREE.InstancedMesh(skidGeo,new THREE.MeshBasicMaterial({color:lin(0x4A4858),transparent:true,opacity:0.3,depthWrite:false}),SKN);
skids.frustumCulled=false;{const z=new THREE.Matrix4().makeScale(0,0,0);for(let i=0;i<SKN;i++)skids.setMatrixAt(i,z);}scene.add(skids);
let skidI=0;
function addSkid(p,f,h,up){_m.compose(p.clone().multiplyScalar(R+h+0.03),quatUpFwdX(up||p,f),_s.set(1,1,1));skids.setMatrixAt(skidI,_m);skidI=(skidI+1)%SKN;skids.instanceMatrix.needsUpdate=true;}

/* ================================================================ UI */
const state={cam:'chase',color:'cherry',zoom:1,time:'auto'};
const CAMS={chase:'Chase',top:'Top down',driver:'Driver'};
function chips(el,map,key,onPick,swatch){
  for(const [k,v] of Object.entries(map)){
    const b=document.createElement('button');b.type='button';b.id=key+'-'+k;
    if(swatch){b.style.background='#'+v.Body.toString(16).padStart(6,'0');b.title=v.label;b.setAttribute('aria-label',v.label);}else b.textContent=v;
    b.addEventListener('click',()=>{state[key]=k;sync();onPick&&onPick(k);});el.appendChild(b);
  }
}
function sync(){for(const key of ['cam','color','time'])document.querySelectorAll('#'+key+' button').forEach(b=>b.setAttribute('aria-pressed',String(b.id===key+'-'+state[key])));}
chips($('#cam'),CAMS,'cam',()=>refreshHud());chips($('#color'),PAL,'color',k=>paintTruck(k),true);
const setZoom=z=>{state.zoom=clamp(z,0.55,9);};
$('#zoom-in').addEventListener('click',()=>setZoom(state.zoom<3?state.zoom/1.25:1));
$('#zoom-out').addEventListener('click',()=>setZoom(state.zoom*1.25));
$('#zoom-planet').addEventListener('click',()=>setZoom(state.zoom>3?1:9));
canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(state.zoom*Math.exp(e.deltaY*0.0012));},{passive:false});
if(/planet/.test(location.hash))state.zoom=9;
if(/clean/.test(location.hash))document.body.classList.add('clean');
if(/top/.test(location.hash))state.cam='top';
if(/driver/.test(location.hash))state.cam='driver';
if(/far/.test(location.hash))state.zoom=2.2;
if(/near/.test(location.hash))state.zoom=0.6;
if(/mid/.test(location.hash))state.zoom=3.2;
if(/high/.test(location.hash))state.zoom=5;
sync();
const keys={};
const KEYMAP={arrowup:'w',arrowdown:'s',arrowleft:'a',arrowright:'d',w:'w',a:'a',s:'s',d:'d',' ':'hb',shift:'run'};
addEventListener('keydown',e=>{
  if(e.target.closest&&e.target.closest('button')&&e.key===' ')e.target.blur();
  const k=KEYMAP[e.key.toLowerCase()];if(k){keys[k]=true;e.preventDefault();}
  const kl=e.key.toLowerCase();
  if(kl==='c'){state.cam={chase:'top',top:'driver',driver:'chase'}[state.cam];sync();refreshHud();}
  if(kl==='v'&&!e.repeat)toggleView();
  if(kl==='e'&&!e.repeat)act();
  if(kl==='escape')openSettings(false);
});
addEventListener('keyup',e=>{const k=KEYMAP[e.key.toLowerCase()];if(k)keys[k]=false;});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});
document.querySelectorAll('.pad button').forEach(b=>{const k=b.dataset.k;
  b.addEventListener('pointerdown',e=>{keys[k]=true;b.setPointerCapture(e.pointerId);e.preventDefault();});
  ['pointerup','pointercancel','lostpointercapture'].forEach(t=>b.addEventListener(t,()=>keys[k]=false));});

/* ================================================================ driving on the sphere */
const car={p:V(0,0,1),f:V(1,0,0),up:V(0,0,1),vf:0,vl:0,steer:0,h:Y_ROAD,spin:0,lastVf:0,pitch:0,roll:0,skidDist:0,wet:false};
{
  const t0=tOf(ROAD_A,CITY),cands=[t0-70/R,t0+70/R].map(t=>({t,p:pointOn(ROAD_A,t)}));
  const s=cands.find(c=>c.p.x<0)||cands[0],f=tangentOn(ROAD_A,s.t);
  const toCity=tangentToward(s.p,CITY.clone().sub(s.p));if(f.dot(toCity)<0)f.negate();
  car.f.copy(f);car.p.copy(offsetP(s.p,V(0,0,0).crossVectors(f,s.p).normalize(),1.75));car.up.copy(car.p);
}
const MAXF=17,MAXR=6,ACC=9.5,BRAKE=20,WB=1.9,G=9.8;
const right=()=>V(0,0,0).crossVectors(car.f,car.p).normalize();
function moveAlong(dir,dist){
  if(dist===0)return;
  const axis=V(0,0,0).crossVectors(car.p,dir);if(axis.lengthSq()<1e-12)return;axis.normalize();
  const q=new THREE.Quaternion().setFromAxisAngle(axis,dist/R);
  car.p.applyQuaternion(q).normalize();car.f.applyQuaternion(q);car.f.addScaledVector(car.p,-car.f.dot(car.p)).normalize();
}
function groundH(p){
  let road=null,best=1e9;
  for(const r of ROADS){const d=roadDistOne(r,p.x,p.y,p.z);if(d<r.rh+r.walk&&d-r.rh<best){best=d-r.rh;road=r;}}
  if(road){if(best<0||nearCrossing(p,0.3))return Y_ROAD;return Y_WALK;}
  return hAt(p);
}
function collide(){
  const P=car.p.clone().multiplyScalar(R+car.h),list=colliders.concat(dynColliders);
  for(const off of [0.75,-0.75]){
    const Cp=P.clone().addScaledVector(car.f,off);
    for(const o of list){
      const lim=o.br+1.2;
      if(Math.abs(Cp.x-o.c.x)>lim||Math.abs(Cp.y-o.c.y)>lim||Math.abs(Cp.z-o.c.z)>lim)continue;
      const d=Cp.clone().sub(o.c);d.addScaledVector(car.p,-d.dot(car.p));
      let n,pen;
      if(o.type===0){const dist=d.length(),m=o.r+0.85;if(dist>=m||dist<1e-6)continue;n=d.divideScalar(dist);pen=m-dist;}
      else{
        const lx=d.dot(o.ex),lz=d.dot(o.ez),cx=clamp(lx,-o.hx,o.hx),cz=clamp(lz,-o.hz,o.hz);
        const qx=lx-cx,qz=lz-cz,dist=Math.hypot(qx,qz),m=0.85;
        if(dist>=m)continue;
        if(dist>1e-6){n=o.ex.clone().multiplyScalar(qx/dist).addScaledVector(o.ez,qz/dist);pen=m-dist;}
        else{const px=o.hx-Math.abs(lx),pz=o.hz-Math.abs(lz);if(px<pz){n=o.ex.clone().multiplyScalar(Math.sign(lx)||1);pen=px+m;}else{n=o.ez.clone().multiplyScalar(Math.sign(lz)||1);pen=pz+m;}}
      }
      n.addScaledVector(car.p,-n.dot(car.p)).normalize();
      moveAlong(n,pen);
      const r=right(),v=car.f.clone().multiplyScalar(car.vf).addScaledVector(r,car.vl),vn=v.dot(n);
      if(vn<0){v.addScaledVector(n,-vn*1.3).multiplyScalar(0.8);car.vf=v.dot(car.f);car.vl=v.dot(r);}
      Cp.copy(car.p).multiplyScalar(R+car.h).addScaledVector(car.f,off);
    }
  }
}
function step(dt){
  if(me.on){stepWalker(dt);car.vf=0;car.vl=0;return;}
  const hb=!!keys.hb;let vf=car.vf;
  if(keys.w)vf+=(vf<0?BRAKE:ACC*(1-Math.max(0,vf)/(MAXF*1.15)))*dt;
  else if(keys.s)vf-=(vf>0.3?BRAKE:ACC*0.7)*dt;
  else{vf*=Math.exp(-0.6*dt);vf-=Math.sign(vf)*Math.min(Math.abs(vf),1.0*dt);}
  if(hb)vf-=Math.sign(vf)*Math.min(Math.abs(vf),7*dt);
  // slope: gravity pulls along the ground
  const r0=right(),hF=groundH(offsetP(car.p,car.f,1.2)),hB=groundH(offsetP(car.p,car.f,-1.2)),hR=groundH(offsetP(car.p,r0,0.9)),hL=groundH(offsetP(car.p,r0,-0.9));
  const gradF=(hF-hB)/2.4,gradR=(hR-hL)/1.8;
  vf-=G*gradF/Math.sqrt(1+gradF*gradF)*0.85*dt;
  car.vl-=G*gradR/Math.sqrt(1+gradR*gradR)*0.35*dt;
  const wl=waterLevelAt(car.p);car.wet=car.h<wl-0.1;
  if(car.wet)vf*=Math.exp(-2.4*dt);
  car.vf=clamp(vf,-MAXR,MAXF);
  car.vl*=Math.exp(-(hb?1.6:9)*dt);
  const target=((keys.a?1:0)-(keys.d?1:0))*0.62/(1+Math.abs(car.vf)*0.05);
  car.steer+=(target-car.steer)*Math.min(1,dt*9);
  car.f.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(car.p,car.vf*Math.tan(car.steer)/WB*dt*(hb?1.35:1))).normalize();
  const r=right(),v=car.f.clone().multiplyScalar(car.vf).addScaledVector(r,car.vl),sp=v.length();
  if(sp>1e-5)moveAlong(v.divideScalar(sp),sp*dt);
  collide();
  let gh=groundH(car.p);if(gh<wl-0.75)gh=wl-0.75;
  car.h+=(gh-car.h)*Math.min(1,dt*14);
  // tilt the truck to the ground
  const r1=right(),pf=offsetP(car.p,car.f,1.2),pb=offsetP(car.p,car.f,-1.2),pr=offsetP(car.p,r1,0.9),pl=offsetP(car.p,r1,-0.9);
  const W=(p,h)=>p.clone().multiplyScalar(R+Math.max(h,wl-0.75));
  const up=V(0,0,0).crossVectors(W(pf,hF).sub(W(pb,hB)),W(pl,hL).sub(W(pr,hR))).normalize();
  if(up.dot(car.p)>0.5)car.up.lerp(up,Math.min(1,dt*10)).normalize();
  car.spin-=car.vf*dt/0.4;
  const along=(car.vf-car.lastVf)/Math.max(dt,1e-3);car.lastVf=car.vf;
  car.pitch=lerp(car.pitch,clamp(along*0.004,-0.05,0.05),Math.min(1,dt*6));
  car.roll=lerp(car.roll,clamp(car.steer*car.vf*0.012,-0.07,0.07),Math.min(1,dt*6));
  if(tailMat)tailMat.emissiveIntensity=((keys.s&&car.vf>0.3)||hb)?2.2:0.6;
  const slip=Math.abs(car.vl)>2.2||(hb&&Math.abs(car.vf)>4)||(keys.s&&car.vf>9);
  car.skidDist+=sp*dt;
  if(slip&&car.skidDist>0.35&&!car.wet){car.skidDist=0;const r2=right();for(const s of [1,-1])addSkid(offsetP(offsetP(car.p,car.f,-0.95),r2,0.62*s),car.f,car.h,car.up);}
}

/* ================================================================ day & night */
// The sun circles a tilted planet axis, so local time depends on where you are: drive west to chase the sunset.
const TOD={mode:'auto',phase:0,period:720,el:0.6,day:1,gold:0,night:0,sunDir:V(0,1,0),lightDir:V(0,1,0),hour:15};
const AXIS=N(0.28,1,0.12),AXIS_U=V(0,0,0).crossVectors(AXIS,V(0,0,1)).normalize(),AXIS_V=V(0,0,0).crossVectors(AXIS,AXIS_U);
const sunAt=ph=>AXIS_U.clone().multiplyScalar(Math.cos(ph*Math.PI*2)).addScaledVector(AXIS_V,Math.sin(ph*Math.PI*2)).addScaledVector(AXIS,0.12).normalize();
function localHour(p,sd){
  const pp=p.clone().addScaledVector(AXIS,-p.dot(AXIS)),sp=sd.clone().addScaledVector(AXIS,-sd.dot(AXIS));
  const ang=Math.atan2(V(0,0,0).crossVectors(sp,pp).dot(AXIS),sp.dot(pp));
  return ((12-ang/(Math.PI*2)*24)%24+24)%24;
}
// sun direction in the local sky at p for a given hour: rises in the east, high in the south at noon, sets in the west
function sunLocal(p,hour){
  let n=AXIS.clone().addScaledVector(p,-AXIS.dot(p));if(n.lengthSq()<0.03)n=AXIS_U.clone().addScaledVector(p,-AXIS_U.dot(p));n.normalize();
  const east=V(0,0,0).crossVectors(n,p).normalize(),a=(hour-12)/24*Math.PI*2;
  return p.clone().multiplyScalar(Math.cos(a)).addScaledVector(east,-Math.sin(a)).addScaledVector(n,-0.45).normalize();
}
function phaseForHour(p,hour){let best=0,bd=1e9;for(let i=0;i<1000;i++){const ph=i/1000,h=localHour(p,sunAt(ph));const d=Math.min(Math.abs(h-hour),24-Math.abs(h-hour));if(d<bd){bd=d;best=ph;}}return best;}
const FIXED={day:{el:0.95,hour:13},sunset:{el:0.05,hour:19},night:{el:-0.55,hour:0}};

// sky dome: gradient from horizon to zenith, a warm glow around the sun, sun and moon discs
const skyMat=new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,
  uniforms:{uUp:{value:V(0,1,0)},uSun:{value:V(0,1,0)},uZenith:{value:new THREE.Color()},uHorizon:{value:new THREE.Color()},
    uGlow:{value:new THREE.Color()},uGlowAmt:{value:0},uSunDisc:{value:1},uMoonDisc:{value:0},uSpace:{value:0}},
  vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`uniform vec3 uUp,uSun,uZenith,uHorizon,uGlow;uniform float uGlowAmt,uSunDisc,uMoonDisc,uSpace;varying vec3 vDir;
    void main(){vec3 d=normalize(vDir);float h=dot(d,uUp);
      vec3 c=mix(uHorizon,uZenith,smoothstep(-0.12,0.55,h));c=mix(c,uZenith,uSpace);
      float s=max(dot(d,uSun),0.0);
      c+=uGlow*(pow(s,6.0)*0.55+pow(s,40.0)*0.9)*uGlowAmt*(1.0-uSpace*0.6);
      c=mix(c,vec3(1.0,0.96,0.86),smoothstep(0.99935,0.9997,s)*uSunDisc);
      float m=max(dot(d,-uSun),0.0);c=mix(c,vec3(0.93,0.95,1.0),smoothstep(0.99955,0.9998,m)*uMoonDisc);
      gl_FragColor=linearToOutputTexel(vec4(c,1.0));}`
});
const sky=new THREE.Mesh(new THREE.SphereGeometry(1500,48,24),skyMat);sky.frustumCulled=false;sky.renderOrder=-10;scene.add(sky);
const stars=(()=>{const n=1600,pos=new Float32Array(n*3);for(let i=0;i<n;i++){const d=randomUnit().multiplyScalar(1400);pos[i*3]=d.x;pos[i*3+1]=d.y;pos[i*3+2]=d.z;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const p=new THREE.Points(g,new THREE.PointsMaterial({color:0xFFFFFF,size:2.2,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false}));
  p.frustumCulled=false;p.renderOrder=-9;scene.add(p);return p;})();
const SKY={day:{z:lin(0x9CCBEF),h:lin(0xDDEEF8)},gold:{z:lin(0x8FA8DA),h:lin(0xFFC9A8),glow:lin(0xFF9E7A)},night:{z:lin(0x141B3A),h:lin(0x2E3768)}};
const NIGHTMATS={Window:[],TowerGlass:[],LampGlow:[],Headlight:[]};
let glowPoints=null,headlight=null,cloudMat=null,beamMat=null;
function setupNight(){
  const seen=new Set();
  scene.traverse(o=>{if(!o.material)return;for(const m of [].concat(o.material)){if(seen.has(m)||!NIGHTMATS[m.name])continue;seen.add(m);
    m.emissive=m.emissive||new THREE.Color();
    m.emissive.copy(lin({Window:0xFFD58A,TowerGlass:0xFFE3A8,LampGlow:0xFFE7A6,Headlight:0xFFE9A0}[m.name]));NIGHTMATS[m.name].push(m);}});
  // soft glow sprites on every street lamp and pier lantern
  const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),gr=x.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba(255,240,200,1)');gr.addColorStop(0.35,'rgba(255,215,150,0.45)');gr.addColorStop(1,'rgba(255,200,140,0)');x.fillStyle=gr;x.fillRect(0,0,64,64);
  const pts=[];
  const add=(name,local)=>{for(const pl of placements[name]||[]){pts.push(local.clone().applyQuaternion(pl.q).add(pl.pos));}};
  add('Lamp',V(0,4.12,1.0));add('Pier',V(0.95,2.3,8.7));
  if(lighthouse.p)pts.push(lighthouse.p.clone().multiplyScalar(R+lighthouse.h+12));
  const g=new THREE.BufferGeometry().setFromPoints(pts);
  glowPoints=new THREE.Points(g,new THREE.PointsMaterial({map:new THREE.CanvasTexture(c),size:5,sizeAttenuation:true,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,color:0xFFFFFF}));
  scene.add(glowPoints);
  // truck headlights
  headlight=new THREE.SpotLight(lin(0xFFF0C8),0,34,0.55,0.6,1.2);headlight.position.set(1.3,1.0,0);headlight.target.position.set(14,-1.2,0);
  truck.add(headlight,headlight.target);
}
function updateSky(dt){
  const FP=focusP();
  if(TOD.mode==='auto'){
    TOD.hour=(TOD.hour+dt*24/TOD.period*(0.3+0.7*smooth(0,0.35,Math.abs(TOD.el))))%24;   // linger around sunrise/sunset
    TOD.sunDir.copy(sunLocal(FP,TOD.hour));
  }else{
    const F=FIXED[TOD.mode],camR=V(0,0,0).crossVectors(camF,FP);
    const H=(TOD.mode==='day'?camF.clone().multiplyScalar(0.7).addScaledVector(camR,-0.7):camF.clone().addScaledVector(camR,-0.25)).normalize();
    TOD.sunDir.copy(FP).multiplyScalar(Math.sin(F.el)).addScaledVector(H,Math.cos(F.el)).normalize();
  }
  const el=Math.asin(clamp(TOD.sunDir.dot(FP),-1,1));TOD.el=el;
  if(TOD.mode!=='auto')TOD.hour=FIXED[TOD.mode].hour;
  const day=smooth(-0.03,0.32,el),gold=smooth(-0.14,0.0,el)*(1-smooth(0.06,0.4,el)),night=smooth(0.0,-0.2,el);
  TOD.day=day;TOD.gold=gold;TOD.night=night;
  // the one shadow-casting light is the sun by day and the moon by night
  const moon=el<-0.04;TOD.lightDir.copy(moon?TOD.sunDir.clone().negate():TOD.sunDir);
  if(TOD.lightDir.dot(FP)<0.15)TOD.lightDir.addScaledVector(FP,0.15-TOD.lightDir.dot(FP)).normalize();  // keep shadows from going infinitely long
  sun.color.copy(moon?lin(0xB9C8F2):lin(0xFFF1DE).lerp(lin(0xFFAE78),gold));
  sun.intensity=moon?0.3*night:0.98*smooth(-0.04,0.3,el)+0.3*gold;
  ambient.color.copy(lin(0xFFF6EE)).lerp(lin(0xFFD6C6),gold).lerp(lin(0x5E6BAA),night);ambient.intensity=lerp(0.5,0.26,night);
  hemiFill.intensity=lerp(0.18,0.08,night);
  const zen=SKY.day.z.clone().lerp(SKY.gold.z,gold).lerp(SKY.night.z,night),hor=SKY.day.h.clone().lerp(SKY.gold.h,gold).lerp(SKY.night.h,night);
  const u=skyMat.uniforms;u.uUp.value.copy(FP);u.uSun.value.copy(TOD.sunDir);u.uZenith.value.copy(zen);u.uHorizon.value.copy(hor);
  u.uGlow.value.copy(SKY.gold.glow);u.uGlowAmt.value=0.25+gold*1.1-night*0.25;u.uSunDisc.value=smooth(-0.06,0.02,el);u.uMoonDisc.value=smooth(0.0,-0.12,el);
  u.uSpace.value=smooth(2.4,6,zoomCur);
  scene.background=zen;
  sky.position.copy(camera.position);stars.position.copy(camera.position);
  stars.material.opacity=night*0.9+smooth(2.4,6,zoomCur)*0.35*(1-day);
  for(const m of NIGHTMATS.Window)m.emissiveIntensity=night*0.6;
  for(const m of NIGHTMATS.TowerGlass)m.emissiveIntensity=night*0.4;
  for(const m of NIGHTMATS.LampGlow)m.emissiveIntensity=0.4+night*2.4;
  for(const m of NIGHTMATS.Headlight)m.emissiveIntensity=0.4+night*2.2;
  if(glowPoints)glowPoints.material.opacity=night*0.95;
  if(headlight)headlight.intensity=night*2.4;
  if(cloudMat){cloudMat.color.copy(lin(0xFFFFFF)).lerp(lin(0xFFD3C4),gold).lerp(lin(0x7D86AE),night);cloudMat.emissive.copy(cloudMat.color);cloudMat.emissiveIntensity=lerp(0.32,0.06,night);}
  if(beamMat)beamMat.opacity=0.12+night*0.4;
  const hh=Math.floor(TOD.hour),mm=Math.floor((TOD.hour-hh)*60);
  clockEl.textContent=(el>0.02?'☀ ':'☾ ')+String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');
}
const clockEl=$('#clock');
// sound: browsers only allow audio after the first click or key press
const SOUNDS={music:'Music',sfx:'Sounds'},soundOn={music:true,sfx:true};
for(const [k,label] of Object.entries(SOUNDS)){
  const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-pressed','true');
  b.addEventListener('click',()=>{soundOn[k]=!soundOn[k];b.setAttribute('aria-pressed',String(soundOn[k]));
    if(OurPlanet.audio){OurPlanet.audio.start();if(k==='music')OurPlanet.audio.setMusic(soundOn[k]);else OurPlanet.audio.setSfx(soundOn[k]);}});
  $('#sound').appendChild(b);
}
const wakeAudio=()=>{if(OurPlanet.audio)OurPlanet.audio.start();};
addEventListener('pointerdown',wakeAudio);addEventListener('keydown',wakeAudio);
const TIMES={auto:'Auto',day:'Day',sunset:'Sunset',night:'Night'};
chips($('#time'),TIMES,'time',k=>{

  TOD.mode=k;sync();
});

/* ================================================================ quick travel */
const PLACES={city:'City',alps:'Alps',lake:'Lake Lull',maple:'Maple Lake',farm:'Farm',meadow:'Meadow',north:'North pole',autumn:'Autumn'};
function nearestRoadPoint(target){
  let best=null;
  for(const r of MAIN)for(let i=0;i<1440;i++){const t=i/1440*Math.PI*2,p=pointOn(r,t),d=angTo(p,target);if(!best||d<best.d)best={r,t,d};}
  return best;
}
function travel(where){
  me.sit=null;
  if(me.on){me.on=false;me.model.visible=false;refreshHud();}
  let r,t;
  if(where==='city'){r=ROAD_A;t=tOf(ROAD_A,CITY)-70/R;}
  else if(where==='lake'&&bridgeAt){r=ROAD_A;t=tOf(ROAD_A,bridgeAt)+28/R;}
  else{const target={alps:ALPS,lake:BIGLAKE.p,maple:MAPLE.p,farm:FARM,meadow:MEADOW,north:V(0,1,0),autumn:V(0,-1,0)}[where];({r,t}=nearestRoadPoint(target));
    if(where==='alps')t+=20/R;}
  const p=pointOn(r,t),f=tangentOn(r,t);
  car.f.copy(f);car.p.copy(offsetP(p,V(0,0,0).crossVectors(f,p).normalize(),1.75));car.up.copy(car.p);
  car.vf=0;car.vl=0;car.h=groundH(car.p);camF.copy(car.f);
  if(where==='lake'&&bridgeAt){car.f.negate();camF.copy(car.f);car.p.copy(offsetP(p,V(0,0,0).crossVectors(car.f,p).normalize(),1.75));}
  updateCamera(0,true);
}
chips($('#go'),PLACES,'go',k=>{travel(k);canvas.focus({preventScroll:true});});

/* ================================================================ on foot */
const me={frozen:false,lookTarget:null,sit:null,on:false,p:V(0,0,1),f:V(1,0,0),vel:V(0,0,0),h:0,yv:0,air:false,phase:0,speed:0,model:null,camF:V(1,0,0),pitch:0.32,lastStep:0};
const focusP=()=>me.on?me.p:car.p;
const focusH=()=>me.on?me.h:car.h;
function makeMe(){me.model=OurPlanet.makeWalker({shirt:PAL[state.color].Body});me.model.visible=false;scene.add(me.model);}
const toastEl=$('#toast');let toastT=0;
function toast(html,secs=2.4){toastEl.innerHTML=html;toastEl.style.opacity=1;toastT=secs;}
function toggleFoot(){
  if(!me.on){
    if(Math.abs(car.vf)>2.2){toast('Slow down to get out');return;}
    car.vf=0;car.vl=0;
    const left=V(0,0,0).crossVectors(car.p,car.f).normalize();
    let p=offsetP(car.p,left,1.7);
    if(waterLevelAt(p)-groundH(p)>0.8)p=offsetP(car.p,left,-1.7);
    me.p.copy(p);me.f.copy(car.f);me.h=groundH(p);me.yv=0;me.air=false;me.vel.set(0,0,0);me.camF.copy(camF);me.speed=0;
    me.on=true;
    toast('Off you go! Walk back to the truck and press <kbd>E</kbd> to drive',3.4);
  }else{
    if(angTo(me.p,car.p)*R>3.6){toast('Walk back to the truck to get in');return;}
    me.on=false;camF.copy(car.f);
  }
  refreshHud();
}
function nearBench(){if(!me.on||me.sit)return null;let best=null,bd=1.9;for(const b of benches){const d=angTo(me.p,b.p)*R;if(d<bd){bd=d;best=b;}}return best;}
function sitDown(b){
  me.sit=b;me.p.copy(offsetP(b.p,b.front,0.06));me.f.copy(b.front);me.h=b.h;me.vel.set(0,0,0);me.speed=0;me.air=false;
  me.camF.copy(b.front);me.pitch=0.22;fpLook.pitch=0.02;
  toast('Take a moment. Press <kbd>E</kbd> or start walking to stand up',3.6);refreshHud();
}
function standUp(){if(!me.sit)return;me.p.copy(offsetP(me.sit.p,me.sit.front,0.95));me.h=groundH(me.p);me.sit=null;refreshHud();}
function act(){
  if(OurPlanet.activities&&OurPlanet.activities.onAct&&OurPlanet.activities.onAct())return;
  if(me.sit){standUp();return;}
  if(me.on){const b=nearBench();if(b){sitDown(b);return;}}
  toggleFoot();
}
function toggleView(){state.cam=state.cam==='driver'?'chase':'driver';sync();refreshHud();}
const viewBtn=$('#viewBtn'),exitBtn=$('#exitBtn'),setEl=$('#settings'),setBtn=$('#setBtn');
const ICON_WALK='<circle cx="13" cy="4.5" r="2"/><path d="M10 21l2-6 3 3v3M9 11l3-3 3 3 2 1M12 8l-1.5 6"/>';
const ICON_BENCH='<path d="M4 11h16M5 15h14M6 11V7.5h12V11M6 15v4M18 15v4"/>';
const ICON_STAND='<circle cx="12" cy="4.5" r="2"/><path d="M12 7v7M8 10l4-2 4 2M10 21l2-7 2 7"/>';
const ICON_CAR='<path d="M3 16v-3l2-5h9l4 5h3v3"/><circle cx="7.5" cy="16.5" r="2"/><circle cx="17" cy="16.5" r="2"/><path d="M9.5 16.5h5.5M14 8v5"/>';
let hudMode='',benchHint=0;
function refreshHud(){
  const fp=state.cam==='driver';
  viewBtn.setAttribute('aria-pressed',String(fp));$('#viewLabel').textContent=fp?'1st person':'3rd person';
  viewBtn.setAttribute('aria-label',fp?'Switch to third person view':'Switch to first person view');
  const nb=nearBench(),mode=me.sit?'stand':nb?'sit':me.on?'in':'out';hudMode=mode;
  $('#exitIcon').innerHTML={stand:ICON_STAND,sit:ICON_BENCH,in:ICON_CAR,out:ICON_WALK}[mode];
  $('#exitLabel').textContent={stand:'Stand up',sit:'Sit',in:'Get in',out:'Get out'}[mode];
  exitBtn.setAttribute('aria-label',{stand:'Stand up from the bench',sit:'Sit on the bench',in:'Get back in the truck',out:'Get out of the truck'}[mode]);
  if(me.model)me.model.visible=me.on&&!fp;
}
function openSettings(v){setEl.hidden=!v;setBtn.setAttribute('aria-expanded',String(v));setBtn.setAttribute('aria-pressed',String(v));if(!v)canvas.focus({preventScroll:true});}
viewBtn.addEventListener('click',()=>{toggleView();canvas.focus({preventScroll:true});});
exitBtn.addEventListener('click',()=>{act();canvas.focus({preventScroll:true});});
setBtn.addEventListener('click',()=>openSettings(setEl.hidden));
$('#closeSet').addEventListener('click',()=>openSettings(false));
const WALK=2.2,RUN=4.8;
function walkerCollide(){
  const r=0.32,list=colliders.concat(dynColliders);
  for(const o of list){
    const P=me.p.clone().multiplyScalar(R+me.h),lim=o.br+1;
    if(Math.abs(P.x-o.c.x)>lim||Math.abs(P.y-o.c.y)>lim||Math.abs(P.z-o.c.z)>lim)continue;
    const d=P.clone().sub(o.c);d.addScaledVector(me.p,-d.dot(me.p));
    let n,pen;
    if(o.type===0){const dist=d.length(),m=o.r+r;if(dist>=m||dist<1e-6)continue;n=d.divideScalar(dist);pen=m-dist;}
    else{
      const lx=d.dot(o.ex),lz=d.dot(o.ez),cx=clamp(lx,-o.hx,o.hx),cz=clamp(lz,-o.hz,o.hz),qx=lx-cx,qz=lz-cz,dist=Math.hypot(qx,qz);
      if(dist>=r)continue;
      if(dist>1e-6){n=o.ex.clone().multiplyScalar(qx/dist).addScaledVector(o.ez,qz/dist);pen=r-dist;}
      else{const px=o.hx-Math.abs(lx),pz=o.hz-Math.abs(lz);if(px<pz){n=o.ex.clone().multiplyScalar(Math.sign(lx)||1);pen=px+r;}else{n=o.ez.clone().multiplyScalar(Math.sign(lz)||1);pen=pz+r;}}
    }
    n.addScaledVector(me.p,-n.dot(me.p)).normalize();
    me.p.copy(offsetP(me.p,n,pen));
    const vn=me.vel.dot(n);if(vn<0)me.vel.addScaledVector(n,-vn);
  }
}
function surfaceAt(p,g){
  const wl=waterLevelAt(p);if(wl-g>0.12)return'water';
  if(g===Y_ROAD||g===Y_WALK)return'road';
  if(p.y>0.73||(angTo(p,ALPS)*R<ALPS_R&&g>30))return'snow';
  return'grass';
}
function stepWalker(dt){
  const fp=state.cam==='driver';
  if(me.sit){if(keys.w||keys.s||(!fp&&(keys.a||keys.d)))standUp();else{me.speed=0;return;}}
  if(me.frozen){me.speed=0;me.vel.set(0,0,0);return;}   // busy: flying a kite, fishing, riding a balloon
  const ix=(keys.d?1:0)-(keys.a?1:0),iz=(keys.w?1:0)-(keys.s?1:0);
  let dir=V(0,0,0);
  if(fp){   // first person: W/S walk, A/D turn (drag to look as well)
    if(ix)me.f.applyAxisAngle(me.p,-ix*2.0*dt);
    dir.copy(me.f).multiplyScalar(iz);
  }else{    // third person: move relative to the camera and turn to face the way you walk
    const fw=me.camF,rt=V(0,0,0).crossVectors(fw,me.p);
    dir.copy(fw).multiplyScalar(iz).addScaledVector(rt,ix);
  }
  const g0=groundH(me.p),depth=waterLevelAt(me.p)-g0;
  const speed=(keys.run?RUN:WALK)*(depth>0.3?0.5:1);
  const want=dir.lengthSq()>0.01?dir.normalize().multiplyScalar(speed):V(0,0,0);
  me.vel.lerp(want,1-Math.exp(-(me.air?2:10)*dt));me.vel.addScaledVector(me.p,-me.vel.dot(me.p));
  if(!fp&&want.lengthSq()>0.01){me.f.lerp(want.clone().normalize(),1-Math.exp(-10*dt));}
  me.f.addScaledVector(me.p,-me.f.dot(me.p)).normalize();
  const sp=me.vel.length();
  if(sp>0.01){
    const vd=me.vel.clone().divideScalar(sp),dist=sp*dt,cand=offsetP(me.p,vd,dist),g1=groundH(cand);
    // gentle hills and kerbs yes, cliffs no: judge the slope over a stride, and always allow small steps up
    const gA=groundH(offsetP(me.p,vd,0.6)),rise=gA-g0;
    const tooSteep=!me.air&&rise>0.35&&rise/0.6>1.15&&g1>g0;
    const tooDeep=waterLevelAt(cand)-g1>1.0;                     // wade in up to the waist
    if(!tooSteep&&!tooDeep)me.p.copy(cand);else me.vel.multiplyScalar(0.2);
  }
  walkerCollide();
  const g=groundH(me.p);
  if(keys.hb&&!me.air){me.yv=4.6;me.air=true;}
  if(me.air){me.yv-=13*dt;me.h+=me.yv*dt;if(me.h<=g){me.h=g;me.air=false;me.yv=0;OurPlanet.audio&&OurPlanet.audio.step(surfaceAt(me.p,g));}}
  else if(g<me.h-0.6){me.air=true;me.yv=0;}
  else me.h+=(g-me.h)*Math.min(1,dt*18);
  me.speed=me.air?me.speed:sp;
  const before=Math.floor(me.phase/Math.PI);me.phase+=sp*dt*3.2;
  if(!me.air&&Math.floor(me.phase/Math.PI)!==before&&sp>0.3&&OurPlanet.audio)OurPlanet.audio.step(surfaceAt(me.p,g));
}
function updateMe(t){
  if(!me.model)return;
  me.model.position.copy(me.p).multiplyScalar(R+me.h);
  me.model.quaternion.copy(quatUpFront(me.p,me.f));
  OurPlanet.animateWalker(me.model,me.phase,clamp(me.speed/2.2,0,1),t,me.air?1:0,!!me.sit);
  const nb=nearBench(),near=me.on&&angTo(me.p,car.p)*R<3.6;
  exitBtn.classList.toggle('go',!me.on||near||!!nb||!!me.sit);
  const mode=me.sit?'stand':nb?'sit':me.on?'in':'out';if(mode!==hudMode)refreshHud();
  if(nb&&(benchHint-=1/60)<0){benchHint=1.2;toast('Press <kbd>E</kbd> to sit and enjoy the view',1.3);}
}

/* ================================================================ camera */
const camF=V(1,0,0);let zoomCur=1,shadowE=0;
const fpLook={yaw:0,pitch:0,drag:false,lx:0,ly:0};
let baseFov=45,camLens='';
function updateCamera(dt,snap){
  const k=snap?1:1-Math.exp(-2.6*dt);
  const FPp=focusP();
  camF.lerp(me.on?me.camF:car.f,k).addScaledVector(FPp,-camF.dot(FPp)).normalize();
  zoomCur=snap?state.zoom:lerp(zoomCur,state.zoom,1-Math.exp(-4*dt));
  const P=FPp.clone().multiplyScalar(R+focusH()),D=30*zoomCur;
  const footView=me.on&&zoomCur<2.3,driver=!me.on&&state.cam==='driver'&&zoomCur<2.2;
  const footFP=footView&&state.cam==='driver';
  const lens=driver?'fp':footFP?'eye':footView?'foot':'far';
  if(lens!==camLens){camLens=lens;camera.fov=driver?66:footFP?75:footView?55:baseFov;camera.near=driver||footFP?0.05:footView?0.1:0.5;camera.far=lens==='far'?4000:2200;camera.updateProjectionMatrix();
    if(cockpit)cockpit.visible=driver;if(truckSrc)truckSrc.visible=!driver;}
  if(me.model)me.model.visible=me.on&&!footFP;
  if(footView){
    if(footFP){
      const pitch=fpLook.pitch,eye=me.p.clone().multiplyScalar(R+me.h+1.42).addScaledVector(me.f,0.12);
      camera.position.copy(eye);camera.up.copy(me.p);
      camera.lookAt(eye.clone().addScaledVector(me.f,10*Math.cos(pitch)).addScaledVector(me.p,10*Math.sin(pitch)));
    }else{
      // follow behind only when walking straight ahead; strafing or backing up must not swing the camera (or you walk in circles)
      if(!fpLook.drag&&me.speed>0.3&&keys.w&&!keys.a&&!keys.d&&!keys.s)me.camF.lerp(me.f,1-Math.exp(-1.3*dt));
      if(me.sit&&!fpLook.drag)me.camF.lerp(me.sit.front.clone().applyAxisAngle(me.p,Math.sin(performance.now()*0.00012)*0.35),1-Math.exp(-0.6*dt));
      me.camF.addScaledVector(me.p,-me.camF.dot(me.p)).normalize();
      const dist=6*clamp(state.zoom,0.45,2.2),head=me.p.clone().multiplyScalar(R+me.h+1.25);
      const pos=head.clone().addScaledVector(me.p,dist*Math.sin(me.pitch)).addScaledVector(me.camF,-dist*Math.cos(me.pitch));
      const cd=pos.clone().normalize(),gh=Math.max(hAt(cd),waterLevelAt(cd))+0.6;
      if(pos.length()<R+gh)pos.copy(cd).multiplyScalar(R+gh);
      camera.position.copy(pos);camera.up.copy(me.p);camera.lookAt(me.lookTarget?me.lookTarget:me.sit?head.clone().addScaledVector(me.camF,7).addScaledVector(me.p,0.6):head);
    }
  }else if(driver){
    // the driver seat: a gentle glance into turns, drag to look around, eases back to the road
    if(!fpLook.drag&&Math.abs(car.vf)>1.5){fpLook.yaw*=Math.exp(-1.6*dt);fpLook.pitch*=Math.exp(-1.6*dt);}
    const yaw=fpLook.yaw+car.steer*0.45,pitch=fpLook.pitch-0.01+Math.sin(performance.now()*0.012)*0.002*Math.min(1,Math.abs(car.vf)/8);
    const head=V(-0.3,2.0,-0.3),dir=V(Math.cos(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.sin(yaw)*Math.cos(pitch));
    truck.updateMatrixWorld(true);
    camera.position.copy(truck.localToWorld(head.clone()));
    camera.up.copy(car.up);
    camera.lookAt(truck.localToWorld(head.clone().addScaledVector(dir,10)));
  }else{
    const far=smooth(2.2,7,zoomCur),top=state.cam==='top'?1:far;
    const city=1-smooth(CITY_HALF-5,CITY_HALF+25,angTo(FPp,CITY)*R);   // steeper among tall buildings
    const back=lerp(D*lerp(0.78,0.5,city),0.01,top),up=lerp(D*lerp(0.6,0.95,city),D,top);
    const pos=P.clone().addScaledVector(FPp,up).addScaledVector(camF,-back);
    const cd=pos.clone().normalize(),gh=Math.max(hAt(cd),0)+5;   // never dip inside a mountain
    if(pos.length()<R+gh)pos.copy(cd).multiplyScalar(R+gh);
    camera.position.copy(pos);
    camera.up.copy(top>0.5?camF:FPp);
    camera.lookAt(P.clone().addScaledVector(camF,lerp(7,0,top)));
  }
  sun.position.copy(P).addScaledVector(TOD.lightDir,120);sun.target.position.copy(P);
  hemiFill.position.copy(P).addScaledVector(FPp,60).addScaledVector(TOD.lightDir,-40);hemiFill.target.position.copy(P);
  const e=driver||footView?34:Math.min(30*zoomCur+18,R*1.4);
  if(Math.abs(e-shadowE)>0.5){shadowE=e;Object.assign(sun.shadow.camera,{left:-e,right:e,top:e,bottom:-e,near:1,far:300});sun.shadow.camera.updateProjectionMatrix();}
}
canvas.addEventListener('pointerdown',e=>{if(state.cam!=='driver'&&!me.on)return;fpLook.drag=true;fpLook.lx=e.clientX;fpLook.ly=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!fpLook.drag)return;
  if(me.on){const dx=e.clientX-fpLook.lx,dy=e.clientY-fpLook.ly;fpLook.lx=e.clientX;fpLook.ly=e.clientY;
    if(state.cam==='driver'){me.f.applyAxisAngle(me.p,-dx*0.005);fpLook.pitch=clamp(fpLook.pitch-dy*0.004,-0.9,0.8);}
    else{me.camF.applyAxisAngle(me.p,-dx*0.006);me.pitch=clamp(me.pitch+dy*0.004,0.05,1.25);}return;}
  fpLook.yaw=clamp(fpLook.yaw-(e.clientX-fpLook.lx)*0.005,-2.4,2.4);fpLook.pitch=clamp(fpLook.pitch-(e.clientY-fpLook.ly)*0.004,-0.6,0.5);fpLook.lx=e.clientX;fpLook.ly=e.clientY;});
['pointerup','pointercancel'].forEach(t=>canvas.addEventListener(t,()=>{fpLook.drag=false;}));
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;baseFov=w<h?60:45;if(camLens!=='fp')camera.fov=baseFov;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();

/* ================================================================ boot */
function buildWorld(){
  extraKit();
  paintRoads();paintStopLines();paintRiver();placeSignals();
  buildLakes();buildBridge();buildCity();buildSuburbs();buildChalets();buildFarm();buildViewpoints();
  buildTerrain();
  buildMeadow();buildPoles();buildForests();
  flushFlat();buildInstances();setupLife();
  makeTruck();makeMe();paintTruck(state.color);
}
let last=performance.now(),placeT=0,time=0;
const kmh=$('#kmh'),placeEl=$('#place');
function frame(now){
  const dt=Math.min((now-last)/1000,0.05);last=now;time+=dt;
  step(dt);updateLife(dt,time);
  truck.position.copy(car.p).multiplyScalar(R+car.h);
  truck.quaternion.copy(quatUpFwdX(car.up,car.f));
  body.rotation.set(car.roll,0,car.pitch);
  body.position.y=Math.abs(car.vf)>0.5?Math.sin(now*0.02)*0.008:0;
  for(const w of wheels){w.node.rotation.y=w.front?car.steer:0;w.node.rotation.z=car.spin;}
  if(steerWheel)steerWheel.rotation.x=-car.steer*2.4;
  if(cockpit&&cockpit.visible){const ch=cockpit.userData.charm;ch.position.y=1.9;ch.position.x=0.62-clamp(car.pitch,-0.05,0.05)*0.6;ch.position.z=0.12+clamp(car.roll,-0.07,0.07)*0.5;}
  updateMe(time);
  if(OurPlanet.life)OurPlanet.life.update(dt,time);
  if(OurPlanet.activities)OurPlanet.activities.update(dt,time);
  if(toastT>0){toastT-=dt;if(toastT<=0)toastEl.style.opacity=0;}
  updateSky(dt);updateCamera(dt,false);
  sky.position.copy(camera.position);stars.position.copy(camera.position);
  kmh.textContent=Math.round((me.on?me.speed:Math.abs(car.vf))*3.6);
  if(window.OurPlanet.audio)OurPlanet.audio.update({speed:me.on?me.speed:car.vf,engine:!me.on,night:TOD.night,day:TOD.day,zone:placeEl.textContent},dt);
  if((placeT-=dt)<0){placeT=0.5;placeEl.textContent=zoneName(focusP());}
  renderer.render(scene,camera);
  if(OurPlanet.activities)OurPlanet.activities.afterRender();
  requestAnimationFrame(frame);
}
msg('Shaping mountains…');
new THREE.GLTFLoader().load('assets/kit.json',gltf=>{
  kit=gltf.scene;
  kit.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material))m.side=THREE.FrontSide;});   // Blender exports double-sided; every kit model is closed
  setTimeout(()=>{
    try{const t0=performance.now();buildWorld();console.log('world built in',Math.round(performance.now()-t0),'ms');}
    catch(e){console.error(e);msg('The planet could not be built: '+e.message);return;}
    setupNight();TOD.hour=16.2;
    for(const k of ['sunset','night','day'])if(location.hash.includes(k)){TOD.mode=k;state.time=k;sync();}
    if(/audiotest/.test(location.hash)){OurPlanet.audio.start();keys.w=true;setTimeout(()=>console.log('AUDIOTEST '+OurPlanet.audio.state()),6000);}
    updateSky(0);msg('');updateCamera(0,true);canvas.focus({preventScroll:true});
    const hp=location.hash.slice(1).split('-')[0];if(PLACES[hp])travel(hp);
    // hand the world to the life scenes and the activities
    OurPlanet.world={THREE,scene,camera,renderer,canvas,R,V,N,lin,clamp,lerp,smooth,offsetP,angTo,tangentToward,randomTangent,randomUnit,quatUpFront,quatUpFwdX,
      hAt,groundH,slopeAt,waterLevelAt,roadEdge,occFree,occupy,zoneName,focusP,me,car,keys,toast,state,TOD,anim,placements,benches,windmills,lighthouse,
      LAKES,MEADOW,FARM,ALPS,ALPS_R,ALPINE,CITY,CITY_HALF,cityLocal,fromCity,PEAKS,river,bridgeAt,ROADS,MAIN,ROAD_A,pointOn,tangentOn,tOf,fields,cloneAsset,
      truck,truckBody:body,refreshHud,Y_ROAD,Y_WALK,laneR,ducks,boats,fountainSpot,parkSpot,get ferrisG(){return anim.ferrisG;}};
    try{OurPlanet.life&&OurPlanet.life.init(OurPlanet.world);}catch(e){console.error('life',e);}
    try{OurPlanet.activities&&OurPlanet.activities.init(OurPlanet.world);}catch(e){console.error('activities',e);}
    refreshHud();if(/walk/.test(location.hash)){toggleFoot();if(/stroll/.test(location.hash))keys.w=true;}
    if(/signal/.test(location.hash)){const t=tOf(ROAD_A,CITY)-26/R,p=pointOn(ROAD_A,t),f=tangentOn(ROAD_A,t);if(f.dot(tangentToward(p,CITY.clone().sub(p)))<0)f.negate();car.f.copy(f);car.p.copy(offsetP(p,V(0,0,0).crossVectors(f,p).normalize(),1.75));car.up.copy(car.p);camF.copy(car.f);car.h=Y_ROAD;}
    if(/sitview/.test(location.hash)&&benches.length){const b=benches.find(x=>x.name==='Lake Lull')||benches[0];toggleFoot();sitDown(b);}
    requestAnimationFrame(t=>{last=t;frame(t);});
  },30);
},undefined,err=>{console.error(err);msg('The planet assets could not load. Open this page through a local web server, not as a file.');});
})();
