/* Our Planet — model sandbox: browse every model, recolour it, check its size, see moving parts in action. */
(function(){
const $=s=>document.querySelector(s);
const OP=window.OurPlanet,lin=OP.lin;
if(!window.THREE||!THREE.GLTFLoader||!THREE.OrbitControls){$('#name').textContent='The 3D library could not load.';return;}

/* ---------------- scene ---------------- */
const canvas=$('#c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(38,1,0.05,600);
const controls=new THREE.OrbitControls(camera,canvas);
controls.enableDamping=true;controls.autoRotate=true;controls.autoRotateSpeed=1.2;controls.maxPolarAngle=Math.PI*0.495;
const ambient=new THREE.AmbientLight(0xffffff,0.5);scene.add(ambient);
const fill=new THREE.DirectionalLight(0xffffff,0.2);fill.position.set(-20,12,-14);scene.add(fill);
const sun=new THREE.DirectionalLight(0xffffff,1);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.03;
scene.add(sun,sun.target);
const ground=new THREE.Mesh(new THREE.CircleGeometry(60,64),new THREE.MeshStandardMaterial({color:lin(0xB4D99A),roughness:1}));
ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const grid=new THREE.GridHelper(40,40,0xffffff,0xffffff);grid.material.transparent=true;grid.material.opacity=0.22;grid.position.y=0.005;scene.add(grid);
const water=new THREE.Mesh(new THREE.CircleGeometry(9,48),new THREE.MeshStandardMaterial({color:lin(0x9ED8EA),roughness:0.1,transparent:true,opacity:0.92}));
water.rotation.x=-Math.PI/2;water.position.y=0.01;water.visible=false;scene.add(water);

const LIGHTS={
  day:{bg:0xCFE6F5,sun:[0xFFF1DE,1.0],amb:[0xFFF6EE,0.5],ground:0xB4D99A,pos:[14,22,10],night:0},
  sunset:{bg:0xF7C9B4,sun:[0xFFAE78,1.0],amb:[0xFFD6C6,0.45],ground:0xC9C98F,pos:[24,6,6],night:0.2},
  night:{bg:0x1E2547,sun:[0xB9C8F2,0.32],amb:[0x5E6BAA,0.28],ground:0x51608A,pos:[-10,18,12],night:1}
};
let lightMode='day';
function applyLight(){
  const L=LIGHTS[lightMode];
  scene.background=lin(L.bg);sun.color.copy(lin(L.sun[0]));sun.intensity=L.sun[1];ambient.color.copy(lin(L.amb[0]));ambient.intensity=L.amb[1];
  ground.material.color.copy(lin(L.ground));sun.userData.pos=L.pos;
  if(current)current.obj.traverse(o=>{if(o.isMesh)[].concat(o.material).forEach(glow);});
  frameSun();
}
const GLOW={Window:[0xFFD58A,0.6],TowerGlass:[0xFFE3A8,0.4],LampGlow:[0xFFE7A6,2.4],Headlight:[0xFFE9A0,2.2]};
function glow(m){const g=GLOW[m.name];if(!g)return;m.emissive=m.emissive||new THREE.Color();m.emissive.copy(lin(g[0]));
  const n=LIGHTS[lightMode].night;m.emissiveIntensity=(m.name==='LampGlow'||m.name==='Headlight'?0.4:0)+n*g[1];}

/* ---------------- catalogue ---------------- */
let kit;
const clone=name=>{
  const src=kit.getObjectByName(name);if(!src)return null;
  const o=src.clone(true);o.position.set(0,0,0);o.rotation.set(0,0,0);o.scale.set(1,1,1);
  o.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.castShadow=true;m.receiveShadow=true;}});
  return o;
};
const assemble={
  Truck(){
    const o=clone('Car_Pickup');const wheels=[];o.traverse(m=>{if(/Wheel(FL|FR|RL|RR)$/.test(m.name)){m.rotation.order='YXZ';wheels.push(m);}});
    o.userData.anim=(t)=>{for(const w of wheels){w.rotation.z=-t*6;w.rotation.y=/WheelF/.test(w.name)?Math.sin(t*0.8)*0.4:0;}};
    return o;
  },
  Plane(){
    const g=new THREE.Group();g.add(clone('Plane'));const p=clone('Plane_Prop');p.position.set(2.3,0,0);g.add(p);
    g.userData.anim=t=>{p.rotation.x=t*30;};return g;
  },
  Windmill(){
    const g=new THREE.Group();g.add(clone('Windmill_Body'));const b=clone('Windmill_Blades');b.position.set(0,8.6,1.95);g.add(b);
    g.userData.anim=t=>{b.rotation.z=-t*0.7;};return g;
  },
  Ferris(){
    const g=new THREE.Group();g.add(clone('Ferris_Base'));const w=clone('Ferris_Wheel');w.position.set(0,9.4,0);g.add(w);
    const C=OP.PALETTES.pastel,cabs=[];
    for(let k=0;k<10;k++){const c=clone('Ferris_Cab');c.traverse(m=>{if(m.isMesh&&m.material.name==='Cab')m.material.color.copy(lin(C[k%5]));});g.add(c);cabs.push(c);}
    g.userData.anim=t=>{const a=t*0.15;w.rotation.z=a;cabs.forEach((c,k)=>{const b=a+k/10*Math.PI*2;c.position.set(Math.cos(b)*7.2,9.4+Math.sin(b)*7.2,0);});};
    g.userData.anim(0);return g;
  },
  Explorer(){
    const w=OP.makeWalker();w.userData.anim=t=>OP.animateWalker(w,t*7,1,t);return w;
  },
  TrafficLight(){
    const o=clone('TrafficLight'),cols=[0xFF5B5B,0xFFC447,0x5FE39A],off=[0x4A2E36,0x4A4030,0x26403A],lamps=[];
    [3.38,3.05,2.72].forEach((y,k)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(0.12,12,8),new THREE.MeshBasicMaterial({color:lin(off[k])}));m.scale.z=0.5;m.position.set(-2.05,y,0.2);o.add(m);lamps.push(m);});
    o.userData.anim=t=>{const ph=t%8,st=ph<4?2:ph<5.5?1:0;lamps.forEach((m,k)=>m.material.color.copy(lin(k===st?cols[k]:off[k])));};
    return o;
  },
  Bird(){
    const b=extra.Bird.clone(true);b.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.castShadow=true;}});b.position.set(0,0,0);
    const wl=b.children[3],wr=b.children[4];
    b.userData.anim=t=>{const f=Math.sin(t*10)*0.7;wl.rotation.x=f;wr.rotation.x=-f;};return b;
  }
};
const CATALOG=[
  ['Vehicles',[['Truck','The player truck, with steering and spinning wheels'],['Car_Pickup_Static','Parked pickup'],['Car_Bubble_Static','Bubble car'],
    ['Sailboat','Sails on Lake Lull'],['Rowboat','Moored at the piers and drifting on Maple Lake',1],['Plane','Propeller plane with a spinning prop'],['Balloon','Hot air balloon']]],
  ['People and animals',[['Explorer','You, on foot: arms and legs swing as you walk'],['Person','City walker, coloured per person'],['Duck','Mother duck (ducklings are this model at 55%)',1],['Bird','Flies in V formations']]],
  ['Homes and farm',[['House_Cottage','Suburb house'],['House_TwoStory','Suburb house'],['House_Bungalow','Suburb house with garage'],['Chalet','Swiss chalet in the Alps'],
    ['Barn'],['Silo'],['Windmill','Body plus turning blades']]],
  ['City',[['City_Tower'],['City_Office'],['City_Parisian'],['City_Apartment'],['City_Cafe'],['Shop'],['Market'],['Fountain'],['Ferris','Ferris wheel with swinging cabs']]],
  ['Water and landmarks',[['Lighthouse'],['Bridge','Stone arch bridge over Ribbon River'],['Pier','Wooden pier with lantern',1],['Reeds',null,1],['LilyPad',null,1],['LilyFlower',null,1]]],
  ['Nature',[['Tree_Round'],['Tree_Birch'],['Tree_Pine'],['Tree_PineTall'],['Tree_PineSnow'],['Tree_PineTallSnow'],['Bush'],['Hedge'],['Boulder'],['SnowMound'],['Flower'],['Snowman']]],
  ['Street',[['TrafficLight','Traffic light: green, amber, red'],['Lamp'],['Bench'],['Mailbox'],['Hydrant'],['Planter']]],
  ['Parts',[['Ferris_Base'],['Ferris_Wheel'],['Ferris_Cab'],['Windmill_Body'],['Windmill_Blades'],['Plane_Prop']]]
];
const pretty=id=>({Car_Pickup_Static:'Parked pickup',Car_Bubble_Static:'Bubble car',Ferris:'Ferris wheel'}[id]||id.replace(/^(City|House|Tree)_/,'').replace(/_/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2'));
let extra={},entries=[];
function buildList(){
  const known=new Set(CATALOG.flatMap(([,items])=>items.map(i=>i[0])));
  const others=kit.children.map(c=>c.name).filter(n=>n&&!known.has(n)&&!/Wheel(FL|FR|RL|RR)$/.test(n)&&n!=='Car_Pickup'&&n!=='Plane');
  const cats=others.length?[...CATALOG,['Other',others.map(n=>[n])]]:CATALOG;
  const nav=$('#models');nav.innerHTML='';entries=[];
  for(const [cat,items] of cats){
    const h=document.createElement('div');h.className='cat';h.textContent=cat;nav.appendChild(h);
    for(const [id,desc,water] of items){
      const b=document.createElement('button');b.className='item';b.type='button';b.dataset.id=id;
      b.innerHTML='<span></span><small></small>';b.firstChild.textContent=pretty(id);
      b.lastChild.textContent=assemble[id]?'moves':'';
      b.addEventListener('click',()=>select(id));
      nav.appendChild(b);entries.push({id,desc,water,cat,b,h});
    }
  }
}
$('#search').addEventListener('input',e=>{
  const q=e.target.value.trim().toLowerCase();
  for(const en of entries)en.b.hidden=q&&!(pretty(en.id)+' '+en.id+' '+en.cat).toLowerCase().includes(q);
  document.querySelectorAll('.cat').forEach(h=>{let n=h.nextElementSibling,any=false;while(n&&!n.classList.contains('cat')){if(!n.hidden)any=true;n=n.nextElementSibling;}h.hidden=!any;});
});

/* ---------------- stage ---------------- */
let current=null,guide=null;
function select(id){
  const en=entries.find(e=>e.id===id);if(!en)return;
  if(current)scene.remove(current.obj);
  const obj=assemble[id]?assemble[id]():(extra[id]?(()=>{const o=extra[id].clone(true);o.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.castShadow=true;}});return o;})():clone(id));
  if(!obj)return;
  const box=new THREE.Box3().setFromObject(obj);
  if(!en.water)obj.position.y=-box.min.y;           // sit on the ground
  scene.add(obj);current={id,obj,en};
  water.visible=!!en.water;water.scale.setScalar(Math.max(1,(box.max.x-box.min.x)/10+0.6));
  obj.traverse(o=>{if(o.isMesh){[].concat(o.material).forEach(m=>{glow(m);m.wireframe=wire;});}});
  entries.forEach(e=>e.b.setAttribute('aria-current',String(e.id===id)));
  en.b.scrollIntoView({block:'nearest'});
  try{history.replaceState(null,'','#'+id);}catch(e){}
  $('#title').textContent=pretty(id);$('#name').textContent=pretty(id);$('#desc').textContent=en.desc||'';
  frame(box);inspect(obj);placeGuide();
}
function frame(box){
  const b=new THREE.Box3().setFromObject(current.obj),s=b.getBoundingSphere(new THREE.Sphere());
  const dist=s.radius/Math.sin(THREE.MathUtils.degToRad(camera.fov/2))*1.05;
  controls.target.copy(s.center);
  camera.position.copy(s.center).add(new THREE.Vector3(0.8,0.45,1).normalize().multiplyScalar(dist));
  camera.near=Math.max(0.02,dist/200);camera.far=dist*20+200;camera.updateProjectionMatrix();
  frameSun();
}
function frameSun(){
  if(!current)return;
  const s=new THREE.Box3().setFromObject(current.obj).getBoundingSphere(new THREE.Sphere()),p=sun.userData.pos||[14,22,10],r=Math.max(4,s.radius*1.6);
  sun.position.set(s.center.x+p[0]/24*r*2,s.center.y+p[1]/24*r*2,s.center.z+p[2]/24*r*2);sun.target.position.copy(s.center);
  Object.assign(sun.shadow.camera,{left:-r,right:r,top:r,bottom:-r,near:0.1,far:r*8});sun.shadow.camera.updateProjectionMatrix();
}
function placeGuide(){
  if(guide){scene.remove(guide);guide=null;}
  if(!showGuide||!current||current.id==='Person')return;
  guide=extraPerson();const b=new THREE.Box3().setFromObject(current.obj);
  guide.position.set(b.max.x+1.0,0,(b.min.z+b.max.z)/2);scene.add(guide);
}
const extraPerson=()=>{const o=clone('Person');o.traverse(m=>{if(m.isMesh&&m.material.name==='Shirt')m.material.color.copy(lin(0xC4B5F0));});return o;};
const hexOf=c=>'#'+c.clone().convertLinearToSRGB().getHexString();
function inspect(obj){
  const b=new THREE.Box3().setFromObject(obj),sz=b.getSize(new THREE.Vector3());
  let tris=0,meshes=0;const mats=new Map();
  obj.traverse(o=>{if(!o.isMesh)return;meshes++;const g=o.geometry;tris+=(g.index?g.index.count:g.attributes.position.count)/3;
    for(const m of [].concat(o.material)){if(!mats.has(m.name))mats.set(m.name,[]);mats.get(m.name).push(m);}});
  $('#stats').innerHTML='';
  for(const [k,v] of [['Width',sz.x.toFixed(2)+' m'],['Height',sz.y.toFixed(2)+' m'],['Depth',sz.z.toFixed(2)+' m'],['Triangles',Math.round(tris).toLocaleString()],['Meshes',meshes],['Materials',mats.size]]){
    const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;$('#stats').append(dt,dd);
  }
  const tints=$('#tints');tints.innerHTML='';let any=false;
  for(const [name,list] of mats){
    if(!OP.TINT.includes(name)&&!['Feather','Snow','SnowCap','Plaster','ChaletWood','Stone','TowerGlass','Window'].includes(name))continue;
    any=true;
    const lab=document.createElement('span');lab.textContent=name;
    const inp=document.createElement('input');inp.type='color';inp.value=hexOf(list[0].color);inp.setAttribute('aria-label',name+' colour');
    const setCol=hex=>{for(const m of list)m.color.copy(lin(hex));inp.value='#'+hex.toString(16).padStart(6,'0');};
    inp.addEventListener('input',()=>{for(const m of list)m.color.copy(lin(parseInt(inp.value.slice(1),16)));});
    const pal=/Leaf/.test(name)?OP.PALETTES.leaves:/Wall/.test(name)?OP.PALETTES.walls:name==='Roof'?OP.PALETTES.roofs:/Body/.test(name)?OP.PALETTES.truck:OP.PALETTES.pastel;
    const chips=document.createElement('div');chips.className='chips';
    for(const h of pal){const c=document.createElement('button');c.type='button';c.style.background='#'+h.toString(16).padStart(6,'0');c.setAttribute('aria-label',name+' '+c.style.background);c.addEventListener('click',()=>setCol(h));chips.appendChild(c);}
    tints.append(lab,inp,chips);
  }
  $('#tintSec').hidden=!any;
  const ml=$('#mats');ml.innerHTML='';
  for(const [name,list] of mats){const r=document.createElement('div');r.className='mat';const i=document.createElement('i');i.style.background=hexOf(list[0].color);const s=document.createElement('span');s.textContent=name||'(unnamed)';r.append(i,s);ml.appendChild(r);}
}

/* ---------------- toolbar ---------------- */
let wire=false,showGuide=false,animOn=true;
const lb=$('#light');
for(const [k,label] of [['day','Day'],['sunset','Sunset'],['night','Night']]){
  const b=document.createElement('button');b.className='btn';b.type='button';b.textContent=label;b.setAttribute('aria-pressed',String(k===lightMode));
  b.addEventListener('click',()=>{lightMode=k;lb.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));applyLight();});lb.appendChild(b);
}
const toggle=(id,fn)=>$(id).addEventListener('click',e=>{const on=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',String(on));fn(on);});
toggle('#spin',on=>controls.autoRotate=on);
toggle('#wire',on=>{wire=on;if(current)current.obj.traverse(o=>{if(o.isMesh)[].concat(o.material).forEach(m=>m.wireframe=on);});});
toggle('#scale',on=>{showGuide=on;placeGuide();});
toggle('#anim',on=>animOn=on);
addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT')return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    const vis=entries.filter(x=>!x.b.hidden),i=vis.findIndex(x=>current&&x.id===current.id);
    const n=vis[(i+(e.key==='ArrowDown'?1:-1)+vis.length)%vis.length];if(n){select(n.id);e.preventDefault();}
  }
});

function resize(){const r=canvas.parentElement.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix();}
addEventListener('resize',resize);
let t=0,last=performance.now();
function loop(now){
  const dt=Math.min((now-last)/1000,0.05);last=now;if(animOn)t+=dt;
  if(current&&current.obj.userData.anim)current.obj.userData.anim(t);
  controls.update();renderer.render(scene,camera);requestAnimationFrame(loop);
}
$('#name').textContent='Loading models…';
new THREE.GLTFLoader().load('assets/kit.json',g=>{
  kit=g.scene;
  for(const m of OP.extraModels())extra[m.name]=m;
  buildList();resize();applyLight();
  const want=decodeURIComponent(location.hash.slice(1));
  select(entries.some(e=>e.id===want)?want:'Truck');
  requestAnimationFrame(t0=>{last=t0;loop(t0);});
},undefined,()=>{$('#name').textContent='The models could not load. Open this page through a web server.';});
})();
