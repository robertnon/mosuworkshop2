/* tools/glb-debrand.js — Bake the branding removal permanently into models/ds4.glb.
   Runtime erasing only works if the browser has the NEW JS. Baking it into
   the file means the model is clean no matter what is cached. */
const {PNG}=require('pngjs'); const fs=require('fs');
const SRC='/home/user/mosuworkshop2/models/ds4.glb';
const OUT='/home/user/mosuworkshop2/models/ds4.glb';

const buf=fs.readFileSync(SRC);
const jsonLen=buf.readUInt32LE(12);
const gltf=JSON.parse(buf.slice(20,20+jsonLen).toString('utf8'));
const binStart=20+jsonLen+8;
const bin=buf.slice(binStart, binStart+buf.readUInt32LE(20+jsonLen));

const L=(d,k)=>(54*d[k]+183*d[k+1]+18*d[k+2])>>8;
function enclosed(p,x,y,reach,darkMax){
  let hit=0;
  for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
    for(let i=1;i<=reach;i++){
      const nx=x+dx*i,ny=y+dy*i;
      if(nx<0||ny<0||nx>=p.width||ny>=p.height) break;
      if(L(p.data,((ny*p.width+nx)<<2))<=darkMax){hit++;break;}
    }
  }
  return hit===4;
}
function erase(png,patches,darkOnly){
  const W=png.width,H=png.height,d=png.data;
  for(const p of patches){
    const x0=Math.max(0,Math.floor(p.x0*W)), x1=Math.min(W-1,Math.ceil(p.x1*W));
    const y0=Math.max(0,Math.floor(p.y0*H)), y1=Math.min(H-1,Math.ceil(p.y1*H));
    const pad=Math.max(6,Math.round(0.012*W));
    let sr=0,sg=0,sb=0,sn=0;
    for(let y=y0-pad;y<=y1+pad;y++)for(let x=x0-pad;x<=x1+pad;x++){
      if(x>=x0&&x<=x1&&y>=y0&&y<=y1) continue;
      if(x<0||y<0||x>=W||y>=H) continue;
      const k=(y*W+x)<<2;
      if(darkOnly && L(d,k)>70) continue;
      sr+=d[k];sg+=d[k+1];sb+=d[k+2];sn++;
    }
    if(!sn) continue;
    const fr=Math.round(sr/sn),fg=Math.round(sg/sn),fb=Math.round(sb/sn);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const i=(y*W+x)<<2;
      if(darkOnly && L(d,i)>150 && !enclosed(png,x,y,Math.round(0.13*W),70)) continue;
      d[i]=fr;d[i+1]=fg;d[i+2]=fb;
    }
  }
  return png;
}
const SHELLBACK=[{x0:0.380,y0:0.030,x1:0.545,y1:0.076},{x0:0.185,y0:0.495,x1:0.815,y1:0.700}];
const BUTTON   =[{x0:0.095,y0:0.110,x1:0.260,y1:0.240}];
const JOBS={3:[SHELLBACK,true], 2:[SHELLBACK,false], 12:[BUTTON,true]};

// decode -> erase -> re-encode the affected images
const newImageData={};
for(const [idx,[patches,darkOnly]] of Object.entries(JOBS)){
  const im=gltf.images[idx], bv=gltf.bufferViews[im.bufferView];
  const raw=bin.slice(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);
  const png=PNG.sync.read(raw);
  erase(png,patches,darkOnly);
  const enc=PNG.sync.write(png,{deflateLevel:9});
  newImageData[im.bufferView]=enc;
  console.log(`image ${idx} (bufferView ${im.bufferView}): ${raw.length} -> ${enc.length} bytes`);
}

// rebuild the binary chunk with new offsets
const parts=[]; let offset=0;
gltf.bufferViews.forEach((bv,i)=>{
  const data = newImageData[i] || bin.slice(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);
  bv.byteOffset=offset; bv.byteLength=data.length;
  parts.push(data); offset+=data.length;
  const pad=(4-(offset%4))%4;
  if(pad){parts.push(Buffer.alloc(pad));offset+=pad;}
});
const newBin=Buffer.concat(parts);
gltf.buffers[0].byteLength=newBin.length;

let jsonStr=JSON.stringify(gltf);
while(jsonStr.length%4) jsonStr+=' ';
const jsonBuf=Buffer.from(jsonStr,'utf8');
const total=12+8+jsonBuf.length+8+newBin.length;
const out=Buffer.alloc(total);
out.write('glTF',0,'ascii'); out.writeUInt32LE(2,4); out.writeUInt32LE(total,8);
out.writeUInt32LE(jsonBuf.length,12); out.write('JSON',16,'ascii');
jsonBuf.copy(out,20);
let q=20+jsonBuf.length;
out.writeUInt32LE(newBin.length,q); out.write('BIN\0',q+4,'ascii');
newBin.copy(out,q+8);
fs.writeFileSync(OUT,out);
console.log(`\nGLB: ${buf.length} -> ${out.length} bytes`);
