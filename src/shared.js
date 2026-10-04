/* Our Planet — pieces shared by the game and the model sandbox. */
(function(){
const OP=window.OurPlanet=window.OurPlanet||{};

OP.lin=hex=>new THREE.Color(hex).convertSRGBToLinear();

// Material names that get a colour per instance (walls, roofs, leaves, car paint...)
OP.TINT=['Wall','Roof','Leaf','ShopWall','Awning','Body','Accent','Fender','Petal','Rock','Shirt','Pants','Skin','Hair',
  'Balloon','BalloonStripe','Sail','Cab','Umbrella','PlaneBody','PlaneWing','BoatPaint'];

OP.PALETTES={
  truck:[0xEE8E86,0xF6AE9E,0xFFD88F,0x9FD8C4,0xA2CBEF,0xC4B5F0],
  walls:[0xF6EBDD,0xE6EFE2,0xE3ECF6,0xF7E0DA,0xFBF0CF,0xEDE4F4,0xF4D9CF,0xDCE8F0],
  roofs:[0xD98C7A,0x8E9CB5,0xB58A73,0x7FA39A,0xC98F9E,0x9C8FB8],
  leaves:[0x8BC27A,0x9ACB7F,0x7DB86F,0xA6D08A,0xF2BACB,0xF2B880,0xE9A07A,0x6FA68C],
  pastel:[0xF4A99B,0xFFD88F,0x9FD8C4,0xA2CBEF,0xC4B5F0,0xFFFFFF]
};

// Models built in code rather than Blender (small enough not to need it)
OP.birdGeometries=()=>{
  const body=new THREE.SphereGeometry(0.17,10,8);body.scale(2.1,0.85,0.9);
  const head=new THREE.SphereGeometry(0.11,8,6);head.translate(0.32,0.07,0);
  const wingL=new THREE.BoxGeometry(0.34,0.025,0.78);wingL.translate(-0.02,0,0.39);
  const wingR=new THREE.BoxGeometry(0.34,0.025,0.78);wingR.translate(-0.02,0,-0.39);
  const beak=new THREE.ConeGeometry(0.04,0.14,6);beak.rotateZ(-Math.PI/2);beak.translate(0.46,0.06,0);
  return{body,head,wingL,wingR,beak};
};
// rounded box: subdivided cube pushed onto rounded edges, with exact normals
OP.roundedBox=(w,h,d,r,n=6)=>{
  r=Math.min(r,Math.min(w,h,d)/2-0.001);
  const half=n/2,corner=Math.max(1,Math.floor(half/2)+1),inner=half-corner;
  const g=new THREE.BoxGeometry(1,1,1,n,n,n),pos=g.attributes.position,nor=g.attributes.normal,H=[w/2,h/2,d/2];
  const remap=(u,Hh)=>{const idx=Math.round(Math.abs(u)*n);const c=inner<=0?(idx?(Hh-r)+idx/corner*r:0):idx<=inner?idx/inner*(Hh-r):(Hh-r)+(idx-inner)/corner*r;return Math.sign(u)*c;};
  const p=new THREE.Vector3(),q=new THREE.Vector3();
  for(let i=0;i<pos.count;i++){
    const x=remap(pos.getX(i),H[0]),y=remap(pos.getY(i),H[1]),z=remap(pos.getZ(i),H[2]);
    p.set(Math.max(-H[0]+r,Math.min(H[0]-r,x)),Math.max(-H[1]+r,Math.min(H[1]-r,y)),Math.max(-H[2]+r,Math.min(H[2]-r,z)));
    q.set(x-p.x,y-p.y,z-p.z);if(q.lengthSq()<1e-12)q.set(0,1,0);else q.normalize();
    pos.setXYZ(i,p.x+q.x*r,p.y+q.y*r,p.z+q.z*r);nor.setXYZ(i,q.x,q.y,q.z);
  }
  return g;
};
// the player's explorer: jointed legs and arms so they can swing, a little backpack. Faces +Z, feet on y=0.
OP.makeWalker=(c={})=>{
  const lin=OP.lin,col=Object.assign({shirt:0xF4A99B,pants:0x6F7BA3,skin:0xF6D2B8,hair:0x7A5A48,shoes:0x5E5A70,pack:0xFFD88F,strap:0xC98F6B},c);
  const M={};for(const k in col)M[k]=new THREE.MeshStandardMaterial({color:lin(col[k]),roughness:0.75});
  const eye=new THREE.MeshStandardMaterial({color:lin(0x3A3550),roughness:0.4}),blush=new THREE.MeshStandardMaterial({color:lin(0xFFB3C7),roughness:0.6});
  const mesh=(g,m,x=0,y=0,z=0)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;return o;};
  const rb=OP.roundedBox,g=new THREE.Group(),torso=new THREE.Group();
  const legs=[],arms=[];
  for(const s of [-1,1]){
    const hip=new THREE.Group();hip.position.set(s*0.11,0.56,0);
    hip.add(mesh(rb(0.16,0.48,0.18,0.07),M.pants,0,-0.24,0),mesh(rb(0.18,0.1,0.27,0.05),M.shoes,0,-0.51,0.03));
    g.add(hip);legs.push(hip);
    const sh=new THREE.Group();sh.position.set(s*0.3,0.98,0);
    sh.add(mesh(rb(0.12,0.4,0.13,0.06),M.shirt,0,-0.2,0),mesh(new THREE.SphereGeometry(0.068,10,8),M.skin,0,-0.42,0));
    sh.rotation.z=s*0.1;torso.add(sh);arms.push(sh);
  }
  torso.add(mesh(rb(0.46,0.5,0.3,0.13),M.shirt,0,0.78,0));
  const head=new THREE.Group();head.position.set(0,1.3,0);
  head.add(mesh(new THREE.SphereGeometry(0.27,20,16),M.skin,0,0,0));
  const hairG=new THREE.SphereGeometry(0.29,20,12,0,Math.PI*2,0,Math.PI*0.55);head.add(mesh(hairG,M.hair,0,0.03,-0.02));
  head.add(mesh(new THREE.SphereGeometry(0.036,8,6),eye,-0.09,0,0.25),mesh(new THREE.SphereGeometry(0.036,8,6),eye,0.09,0,0.25));
  const bl=new THREE.SphereGeometry(0.05,8,6);bl.scale(1,0.6,0.4);head.add(mesh(bl,blush,-0.16,-0.08,0.21),mesh(bl,blush,0.16,-0.08,0.21));
  torso.add(head);
  if(c.hat){const hat=new THREE.Group();hat.position.set(0,0.2,0);hat.add(mesh(new THREE.CylinderGeometry(0.3,0.34,0.04,16),new THREE.MeshStandardMaterial({color:lin(c.hat),roughness:0.8})),mesh(new THREE.CylinderGeometry(0.2,0.25,0.16,16),new THREE.MeshStandardMaterial({color:lin(c.hat),roughness:0.8}),0,0.09,0));head.add(hat);}
  if(!c.lite||c.pack){torso.add(mesh(rb(0.34,0.38,0.15,0.07),M.pack,0,0.84,-0.22),mesh(rb(0.26,0.12,0.06,0.03),M.strap,0,0.76,-0.31));
  for(const s of [-1,1])torso.add(mesh(rb(0.05,0.42,0.03,0.015),M.strap,s*0.13,0.86,0.15));}
  g.add(torso);
  g.userData={legs,arms,torso,head,mats:M};
  return g;
};
// pose the explorer: phase advances with distance walked, amount 0 = standing, 1 = full stride
OP.animateWalker=(w,phase,amount,t,air=0,sit=false)=>{
  const u=w.userData,sw=Math.sin(phase)*0.75*amount;
  if(sit){u.legs[0].rotation.x=u.legs[1].rotation.x=-1.45;u.arms[0].rotation.x=u.arms[1].rotation.x=-0.55;u.torso.position.y=-0.02;u.torso.rotation.y=0;u.head.rotation.x=0.05+Math.sin(t*0.6)*0.04;u.head.rotation.y=Math.sin(t*0.23)*0.35;return;}
  u.head.rotation.y=0;
  u.legs[0].rotation.x=sw;u.legs[1].rotation.x=-sw;
  u.arms[0].rotation.x=-sw*0.85;u.arms[1].rotation.x=sw*0.85;
  if(air){u.legs[0].rotation.x=-0.5;u.legs[1].rotation.x=0.3;u.arms[0].rotation.x=-2.4;u.arms[1].rotation.x=-2.4;}
  u.torso.position.y=Math.abs(Math.cos(phase))*0.045*amount+Math.sin(t*2.2)*0.008*(1-amount);
  u.torso.rotation.y=Math.sin(phase)*0.08*amount;
  u.head.rotation.x=Math.sin(t*1.3)*0.03*(1-amount);
};
OP.extraModels=()=>{
  const lin=OP.lin,out=[];
  const mk=(name,parts)=>{const g=new THREE.Group();g.name=name;parts.forEach(m=>g.add(m));out.push(g);return g;};
  const mat=(name,c,o={})=>Object.assign(new THREE.MeshStandardMaterial(Object.assign({color:lin(c),roughness:0.8},o)),{name});
  const at=(m,x,y,z,sx=1,sy=1,sz=1,rx=0)=>{m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.x=rx;return m;};
  const sph=(r,a=16,b=12)=>new THREE.SphereGeometry(r,a,b);
  const snow=mat('Snow',0xFBFCFF,{roughness:0.9}),coal=mat('Coal',0x4B4858),carrot=mat('Carrot',0xF7A86A),scarf=mat('Scarf',0xF29A9A);
  mk('Snowman',[at(new THREE.Mesh(sph(0.62),snow),0,0.5,0),at(new THREE.Mesh(sph(0.45),snow),0,1.25,0),at(new THREE.Mesh(sph(0.32),snow),0,1.85,0),
    at(new THREE.Mesh(new THREE.ConeGeometry(0.07,0.4,10),carrot),0,1.86,0.48,1,1,1,Math.PI/2),at(new THREE.Mesh(sph(0.045,6,5),coal),-0.11,1.95,0.28),
    at(new THREE.Mesh(sph(0.045,6,5),coal),0.11,1.95,0.28),at(new THREE.Mesh(new THREE.TorusGeometry(0.33,0.08,8,20),scarf),0,1.58,0,1,1,1,Math.PI/2)]);
  const stem=mat('Stem',0x7DB86F),petal=mat('Petal',0xFFB3C7,{roughness:0.6}),eye=mat('FlowerEye',0xFFD36B);
  mk('Flower',[at(new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.03,0.4,5),stem),0,0.2,0),at(new THREE.Mesh(sph(0.16,8,6),petal),0,0.44,0,1,0.55,1),at(new THREE.Mesh(sph(0.06,6,4),eye),0,0.5,0)]);
  const b=OP.birdGeometries(),feather=mat('Feather',0xFFFFFF),beak=mat('Beak',0xF6B26B);
  const bird=mk('Bird',[new THREE.Mesh(b.body,feather),new THREE.Mesh(b.head,feather),new THREE.Mesh(b.beak,beak),new THREE.Mesh(b.wingL,feather),new THREE.Mesh(b.wingR,feather)]);
  bird.children[3].position.set(0,0.05,0.06);bird.children[4].position.set(0,0.05,-0.06);bird.scale.setScalar(1.5);
  const ex=OP.makeWalker();ex.name='Explorer';out.push(ex);
  return out;
};
})();
