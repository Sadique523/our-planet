// Convert assets/kit.glb into assets/kit.json (embedded glTF) for hosts that don't serve .glb.
const fs=require('fs'),path=require('path');
const src=path.join(__dirname,'..','assets','kit.glb'),dst=src.replace(/\.glb$/,'.json');
const b=fs.readFileSync(src);let o=12,json,bin;
while(o<b.length){const len=b.readUInt32LE(o),type=b.readUInt32LE(o+4),data=b.subarray(o+8,o+8+len);
  if(type===0x4E4F534A)json=JSON.parse(data.toString('utf8'));else if(type===0x004E4942)bin=data;o+=8+len;}
json.buffers[0].uri='data:application/octet-stream;base64,'+bin.toString('base64');
fs.writeFileSync(dst,JSON.stringify(json));console.log('wrote',dst,fs.statSync(dst).size,'bytes');
