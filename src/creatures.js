/* Our Planet — creatures and props built in code: wildlife, wonders, litter, cargo, kites and gates.
   Every builder returns a THREE.Group facing +Z with its base on y=0. They register in OurPlanet.models,
   so the game can place them and the sandbox can show them. */
(function(){
const OP=window.OurPlanet=window.OurPlanet||{};
const lin=hex=>OP.lin(hex);
const MS=(c,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:lin(c),roughness:0.75},o));
const rb=(w,h,d,r,n)=>OP.roundedBox(w,h,d,r,n);
function m(geo,mat,x=0,y=0,z=0,rx=0,ry=0,rz=0,s){const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);if(s)o.scale.set(...s);o.castShadow=true;o.receiveShadow=true;return o;}
const sph=(r,a=12,b=9)=>new THREE.SphereGeometry(r,a,b);
const cyl=(t,b,h,s=10)=>new THREE.CylinderGeometry(t,b,h,s);
const grp=(...k)=>{const g=new THREE.Group();k.forEach(o=>g.add(o));return g;};
const M={};

/* ---------------- wildlife ---------------- */
M.Deer=(antlers=true)=>{
  const coat=MS(0xC9956B),cream=MS(0xF3E3CC),dark=MS(0x6B4E3C),ink=MS(0x3A3550,{roughness:0.4}),pink=MS(0xF0B8B0);
  const g=new THREE.Group(),legs=[];
  g.add(m(rb(0.42,0.42,0.95,0.18),coat,0,0.95,0),m(rb(0.34,0.1,0.72,0.05),cream,0,0.76,0),m(sph(0.07),cream,0,1.06,-0.5));
  for(let i=0;i<3;i++)g.add(m(sph(0.035,6,5),cream,(i-1)*0.1,1.17,-0.1+i*0.12));
  g.add(m(rb(0.17,0.5,0.19,0.08),coat,0,1.26,0.36,-0.4));
  const head=new THREE.Group();head.position.set(0,1.52,0.5);
  head.add(m(rb(0.21,0.2,0.3,0.09),coat,0,0,0),m(rb(0.14,0.12,0.15,0.05),cream,0,-0.04,0.17),m(sph(0.035,8,6),ink,0,-0.02,0.25),
    m(sph(0.026,8,6),ink,-0.095,0.04,0.07),m(sph(0.026,8,6),ink,0.095,0.04,0.07));
  for(const s of [-1,1]){const e=m(sph(0.06,8,6),coat,s*0.13,0.11,-0.05,0,0,s*0.7,[1,1.7,0.5]);head.add(e);head.add(m(sph(0.04,8,6),pink,s*0.135,0.11,-0.03,0,0,s*0.7,[1,1.6,0.3]));}
  if(antlers)for(const s of [-1,1]){
    head.add(m(cyl(0.012,0.018,0.32,6),dark,s*0.06,0.26,-0.05,0,0,-s*0.35));
    head.add(m(cyl(0.01,0.014,0.16,6),dark,s*0.13,0.34,0.0,0.5,0,-s*0.9));
    head.add(m(cyl(0.01,0.014,0.14,6),dark,s*0.1,0.4,-0.08,-0.4,0,-s*0.5));
  }
  g.add(head);
  for(const [x,z] of [[-0.13,0.33],[0.13,0.33],[-0.13,-0.33],[0.13,-0.33]]){
    const l=new THREE.Group();l.position.set(x,0.82,z);l.add(m(cyl(0.035,0.045,0.78,8),coat,0,-0.4,0),m(cyl(0.04,0.04,0.06,8),dark,0,-0.79,0));g.add(l);legs.push(l);
  }
  g.userData={legs,head,kind:'deer'};return g;
};
M.Fawn=()=>{const d=M.Deer(false);d.scale.setScalar(0.62);return d;};
M.Fox=()=>{
  const orange=MS(0xF2A65A),white=MS(0xFFF6EC),dark=MS(0x4A3A3A),ink=MS(0x3A3550,{roughness:0.4});
  const g=new THREE.Group(),legs=[];
  g.add(m(rb(0.24,0.24,0.55,0.11),orange,0,0.36,0),m(rb(0.18,0.14,0.2,0.06),white,0,0.32,0.22));
  const head=new THREE.Group();head.position.set(0,0.52,0.32);
  head.add(m(rb(0.22,0.19,0.2,0.08),orange,0,0,0));
  const snout=new THREE.ConeGeometry(0.06,0.16,8);snout.rotateX(Math.PI/2);head.add(m(snout,white,0,-0.03,0.15),m(sph(0.025,6,5),ink,0,-0.03,0.23));
  for(const s of [-1,1]){head.add(m(new THREE.ConeGeometry(0.055,0.14,6),orange,s*0.07,0.15,-0.02),m(new THREE.ConeGeometry(0.03,0.05,6),dark,s*0.07,0.21,-0.02),m(sph(0.02,6,5),ink,s*0.06,0.03,0.1));}
  g.add(head);
  const tail=new THREE.Group();tail.position.set(0,0.42,-0.28);tail.add(m(sph(0.12,10,8),orange,0,0.06,-0.2,0.6,0,0,[1,1,2.2]),m(sph(0.09,8,6),white,0,0.2,-0.42));g.add(tail);
  for(const [x,z] of [[-0.08,0.18],[0.08,0.18],[-0.08,-0.18],[0.08,-0.18]]){const l=new THREE.Group();l.position.set(x,0.26,z);l.add(m(cyl(0.025,0.03,0.26,6),dark,0,-0.13,0));g.add(l);legs.push(l);}
  g.userData={legs,head,tail,kind:'fox'};return g;
};
M.Rabbit=()=>{
  const fur=MS(0xD9C7AE),white=MS(0xFFFFFF),pink=MS(0xF6B7C1),ink=MS(0x3A3550,{roughness:0.4});
  const g=new THREE.Group(),body=new THREE.Group();
  body.add(m(sph(0.17,12,10),fur,0,0.17,0,0,0,0,[1,0.9,1.2]),m(sph(0.06,8,6),white,0,0.2,-0.2));
  const head=new THREE.Group();head.position.set(0,0.31,0.14);
  head.add(m(sph(0.11,12,10),fur),m(sph(0.022,6,5),ink,-0.055,0.03,0.08),m(sph(0.022,6,5),ink,0.055,0.03,0.08),m(sph(0.018,6,5),pink,0,-0.01,0.105));
  for(const s of [-1,1]){head.add(m(sph(0.035,8,6),fur,s*0.045,0.17,-0.02,-0.15,0,s*0.18,[1,4,0.6]),m(sph(0.022,8,6),pink,s*0.045,0.17,-0.005,-0.15,0,s*0.18,[1,3.6,0.4]));}
  body.add(head);g.add(body);g.userData={body,head,kind:'rabbit'};return g;
};
M.Butterfly=(c=0xFFB3C7,c2=0xFFE08A)=>{
  const g=new THREE.Group(),bodyM=MS(0x5E5A70),wm=MS(c,{side:THREE.DoubleSide,roughness:0.6}),wm2=MS(c2,{side:THREE.DoubleSide,roughness:0.6});
  g.add(m(cyl(0.012,0.012,0.13,6),bodyM,0,0,0,Math.PI/2));
  const wings=[];
  for(const s of [-1,1]){
    const w=new THREE.Group();
    const big=new THREE.CircleGeometry(0.08,12);big.rotateX(-Math.PI/2);big.translate(s*0.08,0,0.03);
    const small=new THREE.CircleGeometry(0.05,10);small.rotateX(-Math.PI/2);small.translate(s*0.06,0,-0.05);
    w.add(m(big,wm),m(small,wm2));g.add(w);wings.push(w);
  }
  g.userData={wings,kind:'butterfly'};return g;
};
M.Fish=(c=0x9FC7E8,c2=0xF4F7FB)=>{
  const g=new THREE.Group(),a=MS(c,{roughness:0.35,metalness:0.1}),b=MS(c2,{roughness:0.4}),ink=MS(0x3A3550);
  g.add(m(sph(0.1,12,8),a,0,0,0,0,0,0,[0.75,1,3]),m(sph(0.07,10,6),b,0,-0.03,0.04,0,0,0,[0.7,0.6,2.6]));
  const tail=new THREE.ConeGeometry(0.1,0.16,4);tail.rotateX(-Math.PI/2);g.add(m(tail,a,0,0,-0.36,0,0,0,[0.25,1,1]));
  g.add(m(sph(0.018,6,5),ink,-0.06,0.03,0.2),m(sph(0.018,6,5),ink,0.06,0.03,0.2));
  g.userData={kind:'fish'};return g;
};
M.Owl=()=>{
  const brown=MS(0x9C7A5B),belly=MS(0xE6D3B8),white=MS(0xFFFFFF),ink=MS(0x2E2A33),beak=MS(0xF6B26B),amber=MS(0xFFC447,{emissive:lin(0xFFB020),emissiveIntensity:0.4});
  const g=new THREE.Group();
  g.add(m(sph(0.2,12,10),brown,0,0.24,0,0,0,0,[1,1.25,0.95]),m(sph(0.14,10,8),belly,0,0.2,0.08,0,0,0,[1,1.3,0.7]));
  const head=new THREE.Group();head.position.set(0,0.52,0);
  head.add(m(sph(0.17,12,10),brown));
  for(const s of [-1,1]){head.add(m(cyl(0.065,0.065,0.02,14),white,s*0.07,0.0,0.14,Math.PI/2),m(sph(0.032,8,6),amber,s*0.07,0.0,0.155),m(sph(0.016,6,5),ink,s*0.07,0.0,0.18),m(new THREE.ConeGeometry(0.04,0.1,5),brown,s*0.1,0.16,-0.02,0,0,-s*0.3));}
  const bk=new THREE.ConeGeometry(0.025,0.06,5);bk.rotateX(Math.PI/2+0.4);head.add(m(bk,beak,0,-0.05,0.17));
  g.add(head);
  for(const s of [-1,1])g.add(m(sph(0.03,6,5),beak,s*0.06,0.02,0.06));
  g.userData={head,kind:'owl',eyes:amber};return g;
};

M.Chicken=()=>{
  const w=MS(0xFFFBF2),red=MS(0xF27C7C),beak=MS(0xF6B26B),ink=MS(0x3A3550);
  const g=new THREE.Group(),body=new THREE.Group();
  body.add(m(sph(0.16,12,10),w,0,0.22,0,0,0,0,[1,0.95,1.2]),m(sph(0.09,8,6),w,0,0.3,-0.17,0.6,0,0,[0.8,1.2,0.6]));
  const head=new THREE.Group();head.position.set(0,0.38,0.13);
  head.add(m(sph(0.08,10,8),w),m(sph(0.03,6,5),red,0,0.08,0,0,0,0,[0.7,1.2,1.6]),m(sph(0.022,6,5),red,0,-0.06,0.05));
  const bk=new THREE.ConeGeometry(0.025,0.06,5);bk.rotateX(Math.PI/2);head.add(m(bk,beak,0,0,0.09),m(sph(0.014,5,4),ink,-0.045,0.02,0.05),m(sph(0.014,5,4),ink,0.045,0.02,0.05));
  body.add(head);g.add(body);
  for(const s of [-1,1])g.add(m(cyl(0.012,0.012,0.12,4),beak,s*0.05,0.06,0));
  g.userData={head,body,kind:'chicken'};return g;
};

/* ---------------- everyday life props ---------------- */
M.Tent=()=>{
  const quad=(p,mat)=>{const g2=new THREE.BufferGeometry();g2.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g2.setIndex([0,1,2,0,2,3]);g2.computeVertexNormals();return m(g2,mat);};
  const a=MS(0xF4A99B,{side:THREE.DoubleSide}),b=MS(0xFFE3A3,{side:THREE.DoubleSide}),end=MS(0xFFF4E6,{side:THREE.DoubleSide}),pole=MS(0x8C7A6B);
  const g=new THREE.Group();
  g.add(quad([-1.15,0,-1.1,-1.15,0,1.1,0,1.36,1.1,0,1.36,-1.1],a),quad([1.15,0,1.1,1.15,0,-1.1,0,1.36,-1.1,0,1.36,1.1],b));
  const tri=new THREE.BufferGeometry();tri.setAttribute('position',new THREE.Float32BufferAttribute([-1.15,0,-1.1,1.15,0,-1.1,0,1.36,-1.1],3));tri.computeVertexNormals();
  g.add(m(tri,end));
  for(const s of [-1,1])g.add(m(rb(0.5,0.9,0.02,0.01),end,s*0.28,0.42,1.12,0,0,s*0.35));
  g.add(m(cyl(0.02,0.02,1.45,5),pole,0,0.72,1.13),m(cyl(0.02,0.02,1.45,5),pole,0,0.72,-1.13));
  return g;
};
M.Campfire=()=>{const g=new THREE.Group(),log=MS(0x8E6146),stone=MS(0xB9B3C4),ember=MS(0xFF8A4A,{emissive:lin(0xFF6A2A),emissiveIntensity:1});
  for(let i=0;i<9;i++){const a=i/9*Math.PI*2;g.add(m(sph(0.13,7,5),stone,Math.cos(a)*0.55,0.06,Math.sin(a)*0.55,0,0,0,[1,0.7,1]));}
  for(let i=0;i<4;i++)g.add(m(cyl(0.06,0.07,0.75,7),log,0,0.18,0,0.9,i*Math.PI/4,0));
  const flames=[],fm=[0xFFC447,0xFF9E4A,0xFF7A5A];
  for(let i=0;i<3;i++){const f=m(new THREE.ConeGeometry(0.16-i*0.03,0.55-i*0.1,8),new THREE.MeshBasicMaterial({color:lin(fm[i]),transparent:true,opacity:0.9}),(i-1)*0.07,0.42,(i%2)*0.05);f.castShadow=false;g.add(f);flames.push(f);}
  g.add(m(sph(0.12,8,6),ember,0,0.12,0));
  for(const [x,z,r] of [[0,-1.3,0],[1.15,0.65,1.05],[-1.15,0.65,-1.05]])g.add(m(cyl(0.16,0.16,1.1,8),log,x,0.16,z,0,r,Math.PI/2));
  g.userData={flames,ember};return g;};
M.Guitar=()=>grp(m(sph(0.16,12,8),MS(0xE9A07A),0,0,0,0,0,0,[1,1.25,0.35]),m(sph(0.05,8,6),MS(0x3A3550),0,0.02,0.05,0,0,0,[1,1,0.2]),m(rb(0.06,0.45,0.03,0.01),MS(0x8E6146),0,0.36,0));
M.Sled=()=>grp(m(rb(0.5,0.08,1.1,0.04),MS(0xF27C7C),0,0.14,0),m(cyl(0.02,0.02,1.1,6),MS(0xC9C5D6),-0.2,0.04,0,Math.PI/2),m(cyl(0.02,0.02,1.1,6),MS(0xC9C5D6),0.2,0.04,0,Math.PI/2),m(new THREE.TorusGeometry(0.1,0.02,5,10,Math.PI),MS(0xC9C5D6),0,0.12,0.56,0,Math.PI/2,Math.PI/2));
M.PicnicBlanket=()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
  for(let i=0;i<8;i++)for(let j=0;j<8;j++){x.fillStyle=(i+j)%2?'#F4A99B':'#FFF7EE';x.fillRect(i*8,j*8,8,8);}
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.magFilter=THREE.NearestFilter;
  const g=new THREE.Group();g.add(m(new THREE.BoxGeometry(2.2,0.03,1.6),new THREE.MeshStandardMaterial({map:t,roughness:0.9}),0,0.015,0));
  g.add(m(rb(0.5,0.28,0.36,0.08),MS(0xC9A07A),0.6,0.17,-0.4),m(cyl(0.12,0.12,0.03,14),MS(0xFFFFFF),-0.3,0.045,0.2),m(sph(0.06,8,6),MS(0xF27C7C),-0.3,0.09,0.2),m(sph(0.06,8,6),MS(0xFFD24A),-0.2,0.09,0.25));return g;};
M.Cup=()=>grp(m(cyl(0.04,0.035,0.08,10),MS(0xFFFFFF),0,0.04,0),m(cyl(0.12,0.12,0.015,14),MS(0xFFFFFF),0.15,0.008,0),m(sph(0.05,8,6),MS(0xF6C28B),0.15,0.04,0,0,0,0,[1,0.5,1]));
M.WalkingStick=()=>grp(m(cyl(0.015,0.018,1.25,5),MS(0x8E6146),0,0.62,0));
M.BucketHat=()=>grp(m(cyl(0.2,0.24,0.04,14),MS(0x9FD8C4),0,0,0),m(cyl(0.15,0.18,0.14,14),MS(0x9FD8C4),0,0.08,0));
M.Ball=()=>grp(m(sph(0.12,14,10),MS(0xFFFFFF)),m(sph(0.121,6,4),MS(0xF27C7C,{wireframe:true})));

/* ---------------- wonders ---------------- */
M.Sunflower=()=>{
  const stem=MS(0x7DB86F),leaf=MS(0x8BC27A),brown=MS(0x8A5A3C),petal=MS(0xFFD24A);
  const g=new THREE.Group();g.add(m(cyl(0.05,0.07,3.2,8),stem,0,1.6,0));
  for(const [y,s] of [[0.9,1],[1.5,-1],[2.1,1]])g.add(m(sph(0.18,8,6),leaf,s*0.22,y,0,0,0,s*0.6,[1.6,0.25,0.9]));
  const head=new THREE.Group();head.position.set(0,3.3,0.12);head.rotation.x=-0.35;
  head.add(m(cyl(0.38,0.42,0.12,24),brown,0,0,0,Math.PI/2));
  for(let i=0;i<22;i++){const a=i/22*Math.PI*2;head.add(m(sph(0.12,8,6),petal,Math.cos(a)*0.55,Math.sin(a)*0.55,0,0,0,a,[1.6,0.55,0.25]));}
  g.add(head);return g;
};
M.FairyRing=()=>{
  const stemM=MS(0xFFF4E6),cap=MS(0xF27C7C),dot=MS(0xFFFFFF),glow=MS(0xC9F2FF,{emissive:lin(0xA8E6FF),emissiveIntensity:0.3});
  const g=new THREE.Group(),glows=[];
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2,x=Math.cos(a)*1.5,z=Math.sin(a)*1.5,s=0.8+(i%3)*0.2;
    const c=new THREE.SphereGeometry(0.16*s,12,8,0,Math.PI*2,0,Math.PI/2);
    g.add(m(cyl(0.05*s,0.06*s,0.22*s,8),stemM,x,0.11*s,z),m(c,cap,x,0.2*s,z));
    for(let k=0;k<3;k++)g.add(m(sph(0.025*s,6,5),dot,x+Math.cos(k*2.1)*0.08*s,0.3*s,z+Math.sin(k*2.1)*0.08*s));
    const sp=m(sph(0.04,6,5),glow,x*0.7,0.6+(i%4)*0.15,z*0.7);g.add(sp);glows.push(sp);}
  g.userData={glows,glow};return g;
};
M.WishingWell=()=>{
  const stone=MS(0xC9C2B8),wood=MS(0xB98157),roof=MS(0xD98C7A),dark=MS(0x3E5A6E,{roughness:0.2});
  const g=new THREE.Group();
  g.add(m(cyl(0.95,1.0,0.85,20),stone,0,0.42,0),m(cyl(0.72,0.72,0.86,20),dark,0,0.44,0),m(new THREE.TorusGeometry(0.85,0.08,8,24),stone,0,0.86,0,Math.PI/2));
  for(const s of [-1,1])g.add(m(rb(0.12,1.5,0.12,0.03),wood,s*0.85,1.55,0));
  g.add(m(cyl(0.05,0.05,1.8,8),wood,0,1.95,0,0,0,Math.PI/2));
  for(const s of [-1,1])g.add(m(rb(1.0,0.07,2.1,0.03),roof,0,2.55,s*0.32,s*0.55));
  g.add(m(cyl(0.012,0.012,0.7,4),wood,0.2,1.6,0),m(cyl(0.13,0.1,0.2,10),wood,0.2,1.2,0));
  return g;
};
M.Treehouse=()=>{
  const bark=MS(0x9A7859),leaf=MS(0xE9A07A),leaf2=MS(0xF2B880),wood=MS(0xC9A07A),roof=MS(0x8E7A86),wall=MS(0xFBF0CF);
  const g=new THREE.Group();
  g.add(m(cyl(0.38,0.55,6.5,12),bark,0,3.25,0));
  for(const [x,y,z,r,mat] of [[0,6.8,0,2.6,leaf],[1.6,6.0,0.8,1.8,leaf2],[-1.5,6.3,-0.6,1.9,leaf],[0.3,7.8,-0.5,1.7,leaf2]])g.add(m(sph(r,14,10),mat,x,y,z));
  g.add(m(cyl(1.8,1.8,0.16,20),wood,0,3.3,0));
  g.add(m(rb(1.6,1.3,1.4,0.05),wall,0.35,4.05,0.2),m(rb(1.2,0.7,0.06,0.03),MS(0xBFE0EC,{roughness:0.2}),0.35,4.1,0.92));
  for(const s of [-1,1])g.add(m(rb(1.9,0.1,1.1,0.04),roof,0.35,4.95,0.2+s*0.42,s*0.6));
  for(const s of [-1,1])g.add(m(rb(0.06,3.3,0.06,0.02),wood,1.4+s*0.2,1.65,1.1));
  for(let i=0;i<8;i++)g.add(m(rb(0.46,0.05,0.06,0.02),wood,1.4,0.35+i*0.4,1.1));
  for(let i=0;i<14;i++){const a=i/14*Math.PI*2;g.add(m(cyl(0.03,0.03,0.5,5),wood,Math.cos(a)*1.72,3.6,Math.sin(a)*1.72));}
  g.add(m(new THREE.TorusGeometry(1.72,0.03,5,32),wood,0,3.85,0,Math.PI/2));
  return g;
};
M.StandingStones=()=>{
  const st=MS(0xB9B3C4,{roughness:0.95}),moss=MS(0x9CC27E,{roughness:1});
  const g=new THREE.Group();
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2,h=1.6+((i*37)%5)*0.18;g.add(m(rb(0.6,h,0.36,0.12),st,Math.cos(a)*3.2,h/2,Math.sin(a)*3.2,0,-a,((i*13)%5-2)*0.03));g.add(m(sph(0.2,8,6),moss,Math.cos(a)*3.2,0.08,Math.sin(a)*3.2,0,0,0,[1.6,0.4,1.2]));}
  g.add(m(rb(0.55,2.2,0.4,0.1),st,-0.7,1.1,0),m(rb(0.55,2.2,0.4,0.1),st,0.7,1.1,0),m(rb(2.1,0.42,0.5,0.1),st,0,2.4,0));
  return g;
};
M.Igloo=()=>{
  const snow=MS(0xF6FAFF,{roughness:0.9}),line=MS(0xDDE8F4,{roughness:0.9}),warm=MS(0xFFD58A,{emissive:lin(0xFFC060),emissiveIntensity:0.6});
  const g=new THREE.Group();
  g.add(m(new THREE.SphereGeometry(1.9,24,14,0,Math.PI*2,0,Math.PI/2),snow,0,0,0));
  for(const y of [0.5,1.0,1.42])g.add(m(new THREE.TorusGeometry(Math.sqrt(1.9*1.9-y*y)+0.01,0.025,4,40),line,0,y,0,Math.PI/2));
  const tun=new THREE.CylinderGeometry(0.7,0.7,1.2,16,1,false,0,Math.PI);tun.rotateZ(Math.PI/2);tun.rotateY(Math.PI/2);
  g.add(m(tun,snow,0,0,1.85),m(new THREE.CircleGeometry(0.55,16,0,Math.PI),warm,0,0.02,2.46));
  g.userData={warm};return g;
};
M.Bottle=()=>{
  const glass=MS(0x7FC8B8,{roughness:0.1,transparent:true,opacity:0.7}),paper=MS(0xFFF4DC),cork=MS(0xB98157),sand=MS(0xEFDDB2,{roughness:1});
  const g=new THREE.Group();
  g.add(m(sph(0.35,10,6),sand,0,-0.05,0,0,0,0,[1.4,0.35,1.1]));
  const b=new THREE.Group();b.position.set(0,0.1,0);b.rotation.set(0,0.6,Math.PI/2-0.1);
  b.add(m(cyl(0.07,0.07,0.26,12),glass,0,0,0),m(cyl(0.03,0.06,0.1,10),glass,0,0.17,0),m(cyl(0.028,0.028,0.05,8),cork,0,0.24,0),m(cyl(0.035,0.035,0.18,8),paper,0,0,0));
  g.add(b);return g;
};
M.Rainbow=()=>{
  const g=new THREE.Group(),cols=[0xFF8A8A,0xFFB870,0xFFE27A,0x9FE0A0,0x8FC7F2,0xC4A8F2];
  cols.forEach((c,i)=>{const mm=new THREE.MeshBasicMaterial({color:lin(c),transparent:true,opacity:0.42,depthWrite:false,side:THREE.DoubleSide});
    const t=new THREE.Mesh(new THREE.TorusGeometry(11-i*0.36,0.19,6,64,Math.PI),mm);g.add(t);});
  return g;
};
M.SecretGarden=()=>{
  const wood=MS(0xFBFAF6),leaf=MS(0x86BD80),cols=[0xFFB3C7,0xFFE08A,0xC9B8F5,0xFFFFFF,0xF4A99B];
  const g=new THREE.Group();
  const arch=new THREE.Group();arch.position.set(0,0,0);
  for(const s of [-1,1])arch.add(m(rb(0.14,2.2,0.14,0.04),wood,s*0.9,1.1,0));
  arch.add(m(new THREE.TorusGeometry(0.9,0.07,8,24,Math.PI),wood,0,2.2,0));
  for(let i=0;i<26;i++){const a=i/25*Math.PI,x=Math.cos(a)*0.9,y=2.2+Math.sin(a)*0.9;arch.add(m(sph(0.1,6,5),i%3?leaf:MS(cols[i%5]),x,y,0.05));}
  for(let i=0;i<12;i++){const s=i%2?1:-1;arch.add(m(sph(0.09,6,5),i%3?leaf:MS(cols[i%5]),s*0.92,0.3+i*0.16,0.06));}
  g.add(arch);
  for(let k=0;k<6;k++){const a=k/6*Math.PI*2+0.5,x=Math.cos(a)*3,z=Math.sin(a)*3-2.5;
    g.add(m(cyl(0.7,0.75,0.25,14),MS(0xA2826A,{roughness:1}),x,0.12,z));
    for(let i=0;i<9;i++){const b=i/9*Math.PI*2;g.add(m(sph(0.13,6,5),MS(cols[(k+i)%5]),x+Math.cos(b)*0.42,0.38,z+Math.sin(b)*0.42));}}
  return g;
};
M.Waterfall=()=>{
  const w=new THREE.MeshStandardMaterial({color:lin(0xE8F8FF),roughness:0.2,transparent:true,opacity:0.8,emissive:lin(0xFFFFFF),emissiveIntensity:0.15,side:THREE.DoubleSide});
  const mist=new THREE.MeshStandardMaterial({color:lin(0xFFFFFF),transparent:true,opacity:0.45,roughness:1,depthWrite:false});
  const g=new THREE.Group(),sheets=[];
  for(let i=0;i<3;i++){const s=new THREE.Mesh(new THREE.PlaneGeometry(3.2-i*0.4,5.5,1,8),w);s.position.set((i-1)*0.3,2.6,-i*0.12);g.add(s);sheets.push(s);}
  for(let i=0;i<9;i++)g.add(m(sph(0.45+(i%3)*0.2,10,8),mist,(i%3-1)*1.0,0.25,0.6+Math.floor(i/3)*0.5));
  for(let i=0;i<6;i++)g.add(m(sph(0.45,8,6),MS(0xB9B3C4),(i-2.5)*0.75,0.1,-0.4,0,0,0,[1,0.6,0.8]));
  g.userData={sheets};return g;
};

/* ---------------- activities: litter, cargo, kite, gate, marker, snowball, bobber, balloon pad ---------------- */
M.LitterCan=()=>grp(m(cyl(0.035,0.035,0.12,10),MS(0xE36B6B,{metalness:0.3,roughness:0.4}),0,0.035,0,0,0.4,Math.PI/2),m(cyl(0.036,0.036,0.03,10),MS(0xE6E6EE,{metalness:0.5,roughness:0.3}),0.04,0.035,0.016,0,0.4,Math.PI/2));
M.LitterBottle=()=>grp(m(cyl(0.04,0.04,0.18,10),MS(0x8FCFA0,{transparent:true,opacity:0.75,roughness:0.15}),0,0.04,0,0,-0.7,Math.PI/2),m(cyl(0.018,0.03,0.06,8),MS(0x8FCFA0,{transparent:true,opacity:0.75}),0.11,0.04,-0.09,0,-0.7,Math.PI/2));
M.LitterPaper=()=>grp(m(new THREE.IcosahedronGeometry(0.07,0),MS(0xF8F6F0,{flatShading:true,roughness:0.9}),0,0.06,0),m(new THREE.IcosahedronGeometry(0.05,0),MS(0xEDEAE0,{flatShading:true}),0.09,0.04,0.03));
M.CargoFlowers=()=>{const g=new THREE.Group(),pot=MS(0xF2B9A0),cols=[0xFFB3C7,0xFFE08A,0xC9B8F5,0xFFFFFF];
  for(const [x,z] of [[-0.35,0.25],[0.25,-0.25],[0.3,0.3],[-0.3,-0.3]]){g.add(m(cyl(0.18,0.13,0.28,12),pot,x,0.14,z));for(let i=0;i<5;i++)g.add(m(sph(0.08,6,5),MS(cols[(i+Math.round(x*10))&3]),x+Math.cos(i)*0.09,0.36,z+Math.sin(i)*0.09));}return g;};
M.CargoLogs=()=>{const g=new THREE.Group(),w=MS(0xB98157),end=MS(0xE8C9A0);for(let r=0;r<3;r++)for(let i=0;i<4-r;i++){const x=(i-(3-r)/2)*0.24;g.add(m(cyl(0.11,0.11,0.9,10),w,x,0.12+r*0.2,0,Math.PI/2,0,0));g.add(m(cyl(0.1,0.1,0.92,10),end,x,0.12+r*0.2,0,Math.PI/2,0,0,[0.95,1,0.95]));}return g;};
M.CargoLetter=()=>grp(m(rb(0.5,0.05,0.34,0.02),MS(0xFFFDF7),0,0.03,0),m(sph(0.05,8,6),MS(0xF27C7C),0,0.06,0,0,0,0,[1,0.3,1]));
M.CargoBasket=()=>grp(m(rb(0.6,0.32,0.42,0.08),MS(0xC9A07A),0,0.16,0),m(rb(0.62,0.04,0.44,0.02),MS(0xF4A99B),0,0.33,0),m(new THREE.TorusGeometry(0.22,0.025,6,16,Math.PI),MS(0xB98157),0,0.33,0));
M.CargoCrates=()=>{const w=MS(0xEED3AE),s=MS(0xDDBB8F),red=MS(0xF27C7C);const g=new THREE.Group();
  for(const [x,z,y] of [[-0.3,0,0],[0.32,0,0],[0,0,0.46]]){g.add(m(rb(0.46,0.42,0.46,0.04),w,x,0.21+y,z),m(rb(0.48,0.06,0.48,0.02),s,x,0.3+y,z));for(let i=0;i<4;i++)g.add(m(sph(0.07,8,6),red,x+(i%2-0.5)*0.16,0.47+y,z+(i<2?-0.08:0.08)));}return g;};
M.CargoFlask=()=>grp(m(cyl(0.12,0.12,0.4,14),MS(0xA2CBEF,{roughness:0.4}),0,0.2,0),m(cyl(0.08,0.08,0.08,12),MS(0xF1EFF6),0,0.44,0),m(rb(0.5,0.3,0.36,0.08),MS(0xF4A99B),0.4,0.15,0));
M.Kite=()=>{
  const g=new THREE.Group(),a=MS(0xF4A99B,{side:THREE.DoubleSide,roughness:0.6}),b=MS(0xFFE08A,{side:THREE.DoubleSide,roughness:0.6}),spar=MS(0x8C7A6B);
  const tri=(p,mat)=>{const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.computeVertexNormals();return m(geo,mat);};
  g.add(tri([0,0.9,0,-0.55,0.1,0,0,0,0],a),tri([0,0.9,0,0,0,0,0.55,0.1,0],b),tri([-0.55,0.1,0,0,-0.6,0,0,0,0],b),tri([0,0,0,0,-0.6,0,0.55,0.1,0],a));
  g.add(m(cyl(0.012,0.012,1.5,5),spar,0,0.15,0.01),m(cyl(0.012,0.012,1.1,5),spar,0,0.1,0.01,0,0,Math.PI/2));
  const tail=[];for(let i=0;i<5;i++){const bow=m(new THREE.ConeGeometry(0.07,0.12,4),i%2?a:b,0,-0.75-i*0.28,0,0,0,Math.PI/2);g.add(bow);tail.push(bow);}
  g.userData={tail};return g;
};
M.Marker=()=>{
  const c=new THREE.MeshBasicMaterial({color:lin(0xFFB870),transparent:true,opacity:0.85}),c2=new THREE.MeshBasicMaterial({color:lin(0xFFF4D6),transparent:true,opacity:0.9});
  const g=new THREE.Group(),cone=new THREE.ConeGeometry(0.6,1.2,16);cone.rotateX(Math.PI);
  g.add(new THREE.Mesh(cone,c));g.children[0].position.y=1.2;
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.4,0.12,8,32),c2);ring.rotation.x=Math.PI/2;g.add(ring);
  g.userData={ring};return g;
};
M.Snowball=()=>grp(m(sph(0.11,12,10),MS(0xFFFFFF,{roughness:0.9})));
M.Bobber=()=>grp(m(sph(0.07,12,10),MS(0xF27C7C,{roughness:0.4}),0,0.03,0),m(new THREE.SphereGeometry(0.071,12,8,0,Math.PI*2,Math.PI/2,Math.PI/2),MS(0xFFFFFF),0,0.03,0),m(cyl(0.008,0.008,0.12,5),MS(0x3A3550),0,0.13,0));
M.FishingRod=()=>grp(m(cyl(0.012,0.02,1.6,6),MS(0x8C6B4F),0,0.8,0),m(cyl(0.03,0.03,0.08,8),MS(0x5E5A70),0,0.25,0.03,Math.PI/2));
M.BalloonPad=()=>{const g=new THREE.Group(),w=MS(0xC9A07A),sand=MS(0xD9C7A0);g.add(m(cyl(2.2,2.3,0.18,24),w,0,0.09,0));
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;g.add(m(sph(0.18,8,6),sand,Math.cos(a)*2.0,0.28,Math.sin(a)*2.0,0,0,0,[1,0.7,1]));}
  g.add(m(rb(0.9,1.2,0.08,0.03),MS(0xFFF4E6),2.6,0.9,0),m(cyl(0.05,0.05,1.5,6),w,2.6,0.4,0));return g;};
M.SnowFort=()=>{const g=new THREE.Group(),s=MS(0xF6FAFF,{roughness:0.9});
  for(let i=0;i<9;i++){const a=-0.9+i*0.22;g.add(m(rb(0.9,0.7,0.6,0.2),s,Math.sin(a)*4,0.35,Math.cos(a)*4-4,0,a,0));if(i%2)g.add(m(rb(0.8,0.5,0.55,0.2),s,Math.sin(a)*4,0.95,Math.cos(a)*4-4,0,a,0));}
  return g;};

OP.models=M;
OP.modelNames=Object.keys(M);
})();
