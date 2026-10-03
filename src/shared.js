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
  return out;
};
})();
