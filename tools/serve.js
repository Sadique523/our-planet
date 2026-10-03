// Tiny static server for local play: node tools/serve.js  ->  http://localhost:8080
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),types={'.html':'text/html','.glb':'model/gltf-binary','.js':'text/javascript','.png':'image/png'};
http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
  const f=path.join(root,p);if(!f.startsWith(root))return s.writeHead(403).end();
  fs.readFile(f,(e,d)=>{if(e)return s.writeHead(404).end('not found');s.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});s.end(d);});
}).listen(process.env.PORT||8080,()=>console.log('http://localhost:'+(process.env.PORT||8080)));
