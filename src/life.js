/* Our Planet — everyday life: little scenes of people enjoying the world.
   Friends eating and chatting at café tables, a street musician, kids playing ball, picnics, someone fishing off a pier,
   hikers on forest trails, a campsite round a fire, kids sledding and building a snowman, a farmer at work.
   Scene people use the jointed explorer body so they can sit, eat, wave and strum. Far-away scenes are hidden. */
(function(){
const OP=window.OurPlanet=window.OurPlanet||{};
let W,V,R;
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd=rng(777),range=(a,b)=>a+rnd()*(b-a),pick=a=>a[Math.floor(rnd()*a.length)];
const SHIRTS=[0x9FD8C4,0xF4A99B,0xA2CBEF,0xFFD88F,0xC4B5F0,0xF29A9A,0xFFFFFF,0x8FB8DE,0xB9DFA0];
const PANTS=[0x6F7BA3,0x5E5A70,0x8C7A6B,0x7FA39A,0x3F4A6B,0xC9A27E];
const SKINS=[0xF6D2B8,0xE8B896,0xC98F6B,0x9A6A4F,0xFBE0CC];
const HAIRS=[0x7A5A48,0x3A3550,0xE8C27A,0xB0603F,0x2E2A33,0xD9CFC6];
const scenes=[];
const model=(n,...a)=>{const o=OP.models[n](...a);o.traverse(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true;}});return o;};
function person(opts={}){
  const w=OP.makeWalker(Object.assign({lite:true,shirt:pick(SHIRTS),pants:pick(PANTS),skin:pick(SKINS),hair:pick(HAIRS)},opts));
  if(opts.kid)w.scale.setScalar(0.72);
  w.userData.ph=range(0,6.28);return w;
}
// small details don't need to cast shadows: fewer draw calls in the shadow pass
function trimShadows(o){o.traverse(c=>{if(!c.isMesh)return;if(!c.geometry.boundingSphere)c.geometry.computeBoundingSphere();if(c.geometry.boundingSphere.radius<0.16)c.castShadow=false;});}
function scene(p,objs,update){const s={p:p.clone(),objs,update,vis:true};objs.forEach(o=>{trimShadows(o);W.scene.add(o);});scenes.push(s);return s;}
// place at a surface point facing a direction
function put(o,p,front,h){o.position.copy(p).multiplyScalar(R+(h==null?W.hAt(p):h));o.quaternion.copy(W.quatUpFront(p,front));return o;}
// place relative to a kit placement (its local frame), facing local yaw
function putLocal(o,pl,x,y,z,yaw=0){o.position.copy(pl.pos).add(V(x,y,z).applyQuaternion(pl.q));o.quaternion.copy(pl.q).multiply(new THREE.Quaternion().setFromAxisAngle(V(0,1,0),yaw));return o;}
const dirOf=pl=>pl.pos.clone().normalize();

/* ---------------- poses ---------------- */
function sit(w,t,arms=-0.55){const u=w.userData;u.legs[0].rotation.x=u.legs[1].rotation.x=-1.45;u.arms[0].rotation.x=u.arms[1].rotation.x=arms;u.torso.position.y=0;}
function talk(w,t){const u=w.userData,ph=u.ph,k=Math.max(0,Math.sin(t*1.7+ph));
  u.arms[1].rotation.x=-0.25-0.7*k*Math.max(0,Math.sin(t*5+ph));u.arms[1].rotation.z=0.1+0.3*k;
  u.head.rotation.x=Math.sin(t*3.5+ph)*0.06;u.head.rotation.y=Math.sin(t*0.7+ph)*0.35;
  u.torso.position.y=(Math.sin(t*0.9+ph)>0.93?Math.abs(Math.sin(t*14))*0.03:0);}            // the odd chuckle
function eat(w,t){const u=w.userData,ph=u.ph,c=((t*0.25+ph)%1),bite=c<0.2?Math.sin(c/0.2*Math.PI):0;
  u.arms[0].rotation.x=-0.55-1.75*bite;u.arms[0].rotation.z=-0.25*bite;u.head.rotation.x=0.08*bite+Math.sin(t*3+ph)*0.03;u.head.rotation.y=Math.sin(t*0.5+ph)*0.4;}
function stand(w,t){const u=w.userData;u.legs[0].rotation.x=u.legs[1].rotation.x=0;u.arms[0].rotation.x=u.arms[1].rotation.x=0;u.torso.position.y=Math.sin(t*2.2+u.ph)*0.008;}

/* ---------------- the scenes ---------------- */
function cafes(){
  (W.placements.City_Cafe||[]).slice(0,3).forEach(pl=>{
    const objs=[],ppl=[];
    for(const x of [-3.2,0.2,3.6])for(const s of [-1,1]){
      if(rnd()<0.2)continue;
      const w=person();putLocal(w,pl,x+s*0.78,-0.04,5.16,-s*Math.PI/2);objs.push(w);ppl.push(w);
      const cup=model('Cup');putLocal(cup,pl,x+s*0.25,0.78,5.16+range(-0.12,0.12),0);objs.push(cup);
    }
    scene(dirOf(pl),objs,t=>{ppl.forEach((w,i)=>{sit(w,t);if(i%2)talk(w,t);else eat(w,t);});});
  });
}
function plaza(){
  if(!W.fountainSpot)return;const c=W.fountainSpot,front=W.randomTangent(c);
  // two groups chatting
  for(const a of [0.9,3.3]){
    const dir=front.clone().applyAxisAngle(c,a),g=W.offsetP(c,dir,4.1),objs=[];
    for(let k=0;k<3;k++){const d=dir.clone().applyAxisAngle(g,k/3*Math.PI*2),p=W.offsetP(g,d,0.7),w=person();put(w,p,W.tangentToward(p,g.clone().sub(p)),0);objs.push(w);}
    scene(g,objs,t=>objs.forEach(w=>{stand(w,t);talk(w,t);}));
  }
  // a street musician with notes floating up
  const mp=W.offsetP(c,front.clone().applyAxisAngle(c,2.1),4.0),mus=person({hat:0xF4A99B}),g=model('Guitar');
  put(mus,mp,W.tangentToward(mp,c.clone().sub(mp)),0);g.position.set(0.02,0.8,0.24);g.rotation.set(0,0,-0.9);mus.userData.torso.add(g);
  const noteTex=(()=>{const cv=document.createElement('canvas');cv.width=cv.height=64;const x=cv.getContext('2d');x.fillStyle='#fff';x.font='bold 48px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('♪',32,34);const t=new THREE.CanvasTexture(cv);return t;})();
  const notes=[];for(let i=0;i<4;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:noteTex,color:OP.lin([0xF4A99B,0xA2CBEF,0xFFD88F,0xC4B5F0][i]),transparent:true,depthWrite:false}));sp.scale.setScalar(0.35);notes.push(sp);}
  const hat=model('Cup');put(hat,W.offsetP(mp,W.tangentToward(mp,c.clone().sub(mp)),0.7),W.randomTangent(mp),0);
  scene(mp,[mus,hat,...notes],t=>{
    stand(mus,t);const u=mus.userData;u.arms[0].rotation.x=-1.0+Math.sin(t*9)*0.25;u.arms[1].rotation.x=-0.8;u.arms[1].rotation.z=0.5;u.head.rotation.x=Math.sin(t*4.6)*0.08;u.torso.rotation.y=Math.sin(t*2.3)*0.1;
    notes.forEach((n,i)=>{const k=((t*0.35+i/4)%1);n.position.copy(mus.position).addScaledVector(mp,1.6+k*1.6).add(V(Math.sin(t+i)*0.4,0,Math.cos(t*0.8+i)*0.4).applyQuaternion(mus.quaternion));n.material.opacity=Math.sin(k*Math.PI);});
  });
}
function kidsBall(){
  const bs=W.benches.filter(b=>b.name==='Green square');if(bs.length<2)return;
  const c=bs[0].p.clone().add(bs[1].p).normalize(),dir=W.tangentToward(c,bs[0].p.clone().sub(c)),side=V(0,0,0).crossVectors(c,dir).normalize();
  const a=W.offsetP(c,side,2.6),b=W.offsetP(c,side,-2.6),k1=person({kid:true}),k2=person({kid:true}),ball=model('Ball');
  put(k1,a,W.tangentToward(a,b.clone().sub(a)),0);put(k2,b,W.tangentToward(b,a.clone().sub(b)),0);
  scene(c,[k1,k2,ball],t=>{
    const T=1.7,k=(t%(2*T))/T,from=k<1?a:b,to=k<1?b:a,u=k<1?k:k-1;
    const p=from.clone().lerp(to,u).normalize();ball.position.copy(p).multiplyScalar(R+0.12+Math.sin(u*Math.PI)*1.2);ball.rotation.x+=0.2;
    [k1,k2].forEach((w,i)=>{stand(w,t);const kicking=(i===0&&k>=1.85)||(i===1&&k>=0.85&&k<1);w.userData.legs[0].rotation.x=kicking?-0.9:0;w.userData.arms[0].rotation.x=w.userData.arms[1].rotation.x=Math.sin(t*3+i)*0.15;
      if(u>0.8&&((i===1&&k<1)||(i===0&&k>=1)))w.userData.arms[0].rotation.x=w.userData.arms[1].rotation.x=-0.5;});
  });
}
function findSpot(gen,r,clear=2,slope=0.88){for(let i=0;i<200;i++){const p=gen();if(!p)continue;if(W.roadEdge(p.x,p.y,p.z)<r+clear||!W.occFree(p,r))continue;if(W.hAt(p)<W.waterLevelAt(p)+0.35)continue;if(W.slopeAt(p)<slope)continue;W.occupy(p,r);return p;}return null;}
function picnic(p,face,n,kite){
  if(!p)return;const blanket=model('PicnicBlanket');put(blanket,p,face,W.hAt(p)+0.02);const objs=[blanket],ppl=[];
  const right=V(0,0,0).crossVectors(p,face).normalize();
  for(let k=0;k<n;k++){const q=W.offsetP(W.offsetP(p,right,(k-(n-1)/2)*0.75),face,-0.35),w=person({kid:k===n-1&&rnd()<0.5});put(w,q,face,W.hAt(q)-0.02);objs.push(w);ppl.push(w);}
  let kid=null,kt=null,line=null;
  if(kite){const kp=W.offsetP(p,face,3),w=person({kid:true});put(w,kp,face,W.hAt(kp));kid=w;kt=model('Kite');kt.scale.setScalar(0.8);
    line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0,0,0),V(0,0,1)]),new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0.7}));line.frustumCulled=false;objs.push(w,kt,line);}
  scene(p,objs,t=>{ppl.forEach((w,i)=>{sit(w,t);if(i===1)eat(w,t);else talk(w,t);});
    if(kid){stand(kid,t);kid.userData.arms[1].rotation.x=-2.2;const hand=kid.position.clone().addScaledVector(p,0.85);
      const kp=kid.position.clone().addScaledVector(p,9+Math.sin(t*0.9)*1.2).addScaledVector(face,7).addScaledVector(right,Math.sin(t*0.6)*3);
      kt.position.copy(kp);kt.up.copy(p);kt.lookAt(hand);kt.userData.tail.forEach((b,i)=>{b.position.x=Math.sin(t*4-i)*0.1*i;});
      const pos=line.geometry.attributes.position;pos.setXYZ(0,hand.x,hand.y,hand.z);pos.setXYZ(1,kp.x,kp.y,kp.z);pos.needsUpdate=true;}});
}
function piers(){
  (W.placements.Pier||[]).forEach((pl,i)=>{
    const w=person({hat:i?0xFFD88F:0xA2CBEF});putLocal(w,pl,-0.5,0.56,8.55,0);
    const rod=model('FishingRod');rod.position.set(0,-0.38,0.05);rod.rotation.x=0.9;w.userData.arms[1].add(rod);
    const bob=model('Bobber'),line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0,0,0),V(0,0,1)]),new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0.7}));line.frustumCulled=false;
    const bp=pl.pos.clone().add(V(-0.6,-0.12,11.4).applyQuaternion(pl.q));
    scene(dirOf(pl),[w,bob,line],t=>{sit(w,t);w.userData.arms[1].rotation.x=-0.9;w.userData.head.rotation.y=Math.sin(t*0.3)*0.25;
      bob.position.copy(bp).addScaledVector(bp.clone().normalize(),Math.sin(t*2)*0.015);
      const tip=new THREE.Vector3();rod.updateMatrixWorld(true);rod.localToWorld(tip.set(0,1.6,0));const pos=line.geometry.attributes.position;pos.setXYZ(0,tip.x,tip.y,tip.z);pos.setXYZ(1,bob.position.x,bob.position.y,bob.position.z);pos.needsUpdate=true;});
  });
}
function hikers(center,radius,n,withHats){
  if(!center)return;const t1=V(0,0,0).crossVectors(center,Math.abs(center.y)<0.9?V(0,1,0):V(1,0,0)).normalize(),t2=V(0,0,0).crossVectors(center,t1);
  const ppl=[];for(let k=0;k<n;k++){const w=OP.makeWalker({lite:true,pack:true,shirt:pick(SHIRTS),pants:pick(PANTS),skin:pick(SKINS),hair:pick(HAIRS),pack:pick([0xFFD88F,0x9FD8C4,0xF4A99B]),hat:withHats&&k%2===0?pick([0x9FD8C4,0xFFD88F,0xF4A99B]):null});
    const stick=model('WalkingStick');stick.position.set(0,-0.42,0.06);stick.rotation.x=0.25;w.userData.arms[0].add(stick);w.userData.ph=k;ppl.push(w);}
  const dir=rnd()<0.5?1:-1,speed=1.05;let a0=range(0,6.28);
  scene(center,ppl,(t,dt)=>{a0+=dir*speed*dt/radius;
    ppl.forEach((w,k)=>{const a=a0-dir*k*1.8/radius,d=t1.clone().multiplyScalar(Math.cos(a)).addScaledVector(t2,Math.sin(a)),p=W.offsetP(center,d,radius+Math.sin(a*3)*1.5);
      const fr=t2.clone().multiplyScalar(Math.cos(a)).addScaledVector(t1,-Math.sin(a)).multiplyScalar(dir);put(w,p,fr);
      OP.animateWalker(w,t*speed*3.2+k*1.3,0.9,t);w.userData.arms[0].rotation.x=-0.35+Math.sin(t*speed*3.2+k*1.3)*0.3;});});
}
function campsite(){
  const p=findSpot(()=>{const q=W.randomUnit();return Math.abs(q.y)<0.6&&W.angTo(q,W.CITY)*R>110&&W.angTo(q,W.ALPS)*R>W.ALPS_R?q:null;},5.5,10,0.9);if(!p)return;
  const front=W.randomTangent(p),fire=model('Campfire'),tent=model('Tent');put(fire,p,front,W.hAt(p)-0.03);
  const tp=W.offsetP(p,front,-3.4);put(tent,tp,front,W.hAt(tp)-0.03);
  const ppl=[];
  for(const [x,z] of [[0,-1.3],[1.15,0.65],[-1.15,0.65]]){const right=V(0,0,0).crossVectors(p,front).normalize(),q=W.offsetP(W.offsetP(p,right,x*1.2),front,z*1.2),w=person();put(w,q,W.tangentToward(q,p.clone().sub(q)),W.hAt(q)+0.1);ppl.push(w);}
  const stick=model('WalkingStick');stick.position.set(0,-0.42,0.2);stick.rotation.x=1.2;ppl[0].userData.arms[1].add(stick);
  const glowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,200,120,1)');g.addColorStop(1,'rgba(255,150,80,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})();
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));glow.scale.setScalar(6);glow.position.copy(p).multiplyScalar(R+W.hAt(p)+0.6);
  scene(p,[fire,tent,glow,...ppl],t=>{
    fire.userData.flames.forEach((f,i)=>{f.scale.set(1,0.8+Math.abs(Math.sin(t*(7+i*2)+i))*0.5,1);});
    glow.material.opacity=0.15+W.TOD.night*0.75+Math.sin(t*9)*0.05;
    ppl.forEach((w,i)=>{sit(w,t,i===0?-1.1:-1.25);if(i===2)talk(w,t);w.userData.head.rotation.x=0.15;});});
}
function sledding(){
  // find a snowy slope: top point with a good drop over 14 m
  for(let i=0;i<300;i++){const top=W.randomUnit();if(top.y<0.8||W.angTo(top,W.ALPS)*R<W.ALPS_R+4||W.roadEdge(top.x,top.y,top.z)<10)continue;
    const d=W.randomTangent(top),bot=W.offsetP(top,d,14),drop=W.hAt(top)-W.hAt(bot);
    if(drop<1.8||!W.occFree(top,3)||!W.occFree(bot,3))continue;
    W.occupy(top,3);W.occupy(bot,3);
    const kids=[person({kid:true,shirt:0xF27C7C,hat:0xFFFFFF}),person({kid:true,shirt:0x8FB8DE,hat:0xFFD88F})],sleds=[model('Sled'),model('Sled')];
    scene(top,[...kids,...sleds],t=>kids.forEach((k,j)=>{
      const T=11,c=((t+j*5.5)%T)/T;let p,f,h;
      if(c<0.28){const u=c/0.28,e=u*u;p=top.clone().lerp(bot,e).normalize();f=d;h=W.hAt(p);sit(k,t,-1.2);put(sleds[j],p,f,h);put(k,p,f,h+0.12);}
      else{const u=(c-0.28)/0.72;p=bot.clone().lerp(top,u).normalize();f=d.clone().negate();h=W.hAt(p);put(k,p,f,h);OP.animateWalker(k,t*6,1,t);
        const sp=W.offsetP(p,f,-0.9);put(sleds[j],sp,f,W.hAt(sp));}
    }));
    return;}
}
function snowmanBuilders(){
  const sm=(W.placements.Snowman||[])[0];if(!sm)return;const c=dirOf(sm),h=sm.pos.length()-R;
  const k1=person({kid:true,shirt:0xC4B5F0,hat:0xF4A99B}),k2=person({kid:true,shirt:0x9FD8C4}),ball=new THREE.Mesh(new THREE.SphereGeometry(0.4,14,10),new THREE.MeshStandardMaterial({color:OP.lin(0xFBFCFF),roughness:0.9}));ball.castShadow=true;
  const pat=W.offsetP(c,W.randomTangent(c),1.1);put(k1,pat,W.tangentToward(pat,c.clone().sub(pat)),h);
  scene(c,[k1,k2,ball],t=>{stand(k1,t);k1.userData.arms[0].rotation.x=k1.userData.arms[1].rotation.x=-1.3+Math.abs(Math.sin(t*3))*0.3;
    const a=t*0.3,t1=V(0,0,0).crossVectors(c,V(0,1,0)).normalize(),t2=V(0,0,0).crossVectors(c,t1),d=t1.clone().multiplyScalar(Math.cos(a)).addScaledVector(t2,Math.sin(a));
    const bp=W.offsetP(c,d,3.2),fr=t2.clone().multiplyScalar(Math.cos(a)).addScaledVector(t1,-Math.sin(a)),gs=0.35+0.15*Math.sin(t*0.1);
    ball.scale.setScalar(gs/0.4);put(ball,bp,fr,W.hAt(bp)+gs);ball.rotateX(t*2);
    const kp=W.offsetP(bp,fr,-0.75);put(k2,kp,fr);OP.animateWalker(k2,t*4,0.7,t);k2.userData.arms[0].rotation.x=k2.userData.arms[1].rotation.x=-1.2;});
}
function farmer(){
  const barn=(W.placements.Barn||[])[0];if(!barn||!W.fields.length)return;
  const a=W.offsetP(dirOf(barn),W.randomTangent(dirOf(barn)),7),f=W.fields.slice().sort((x,y)=>W.angTo(x.p,a)-W.angTo(y.p,a))[0],b=W.offsetP(f.p,W.tangentToward(f.p,a.clone().sub(f.p)),f.r*0.6);
  const w=person({hat:0xE8C98A,shirt:0xA2CBEF,pants:0x5E6FA3}),fork=model('WalkingStick');fork.position.set(0,-0.42,0.08);fork.rotation.x=0.5;w.userData.arms[0].add(fork);
  scene(a,[w],t=>{const T=Math.max(10,W.angTo(a,b)*R/1.1),c=(t%(2*T))/T,u=c<1?c:2-c,p=a.clone().lerp(b,u).normalize(),fr=W.tangentToward(p,(c<1?b:a).clone().sub(p));
    put(w,p,fr);OP.animateWalker(w,t*3.4,0.85,t);});
}

/* ---------------- lifecycle ---------------- */
function init(world){
  W=world;V=W.V;R=W.R;
  cafes();plaza();kidsBall();piers();
  picnic(findSpot(()=>W.offsetP(W.MEADOW,W.randomTangent(W.MEADOW),range(8,18)),2,1.5,0.8),W.randomTangent(W.MEADOW),3,true);
  {const L=W.LAKES[0],o=L.shore[Math.floor(L.shore.length*0.3)],p=W.offsetP(L.p,o.dir,o.dist+3.5);if(W.occFree(p,2)){W.occupy(p,2);picnic(p,o.dir.clone().negate(),2,false);}}
  for(let k=0;k<2;k++)hikers(findSpot(()=>{const q=W.randomUnit();return Math.abs(q.y)<0.62&&W.angTo(q,W.CITY)*R>100&&W.angTo(q,W.ALPS)*R>W.ALPS_R?q:null;},2,8,0.85),range(14,20),3,true);
  hikers(W.ALPINE.p,W.ALPINE.r+6,2,true);
  campsite();sledding();snowmanBuilders();farmer();
  let visT=0;
  OP.life.update=(dt,t)=>{
    if((visT-=dt)<0){visT=0.5;const F=W.focusP();for(const s of scenes){const v=W.angTo(F,s.p)*R<120;if(v!==s.vis){s.vis=v;s.objs.forEach(o=>o.visible=v);}}}
    for(const s of scenes)if(s.vis)s.update(t,dt);
  };
}
OP.life={init,update(){},scenes};
})();
