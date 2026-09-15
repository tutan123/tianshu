'use strict';
globalThis.CampusBuildings = (() => {
  const materials = {}, geometries = {};
  const colors = { plaster:'#ddd5c4', concrete:'#b8b2a4', brick:'#ab7064', dark:'#394955', roof:'#57717c', wood:'#b59270', glass:'#4a7189', warm:'#849fa6', metal:'#69858c', foliage:'#568567', soil:'#4c6652', red:'#b45b63', blue:'#648da8', paving:'#c2c8cb', grass:'#6f8f5c', trim:'#f4f2ea' };
  // 确定性伪随机。贴图必须逐轮完全一致，否则 dream-loop 的逐轮截图对比会被贴图噪声干扰，
  // 看不出真正的改动。
  function rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
  function texture(kind) {
    if (typeof document === 'undefined') return null;
    const size=512, canvas=document.createElement('canvas');canvas.width=canvas.height=size;const c=canvas.getContext('2d');
    c.fillStyle=colors[kind];c.fillRect(0,0,size,size);
    const rand=rng(kind.length*7919+104729);
    if(kind==='brick'){
      c.fillStyle='#e0beb088';
      for(let y=0;y<size;y+=32){c.fillRect(0,y,size,2);for(let x=(y%64?32:0);x<size;x+=64)c.fillRect(x,y,2,32);}
      for(let i=0;i<5200;i++){c.fillStyle=rand()>.5?'#ffffff10':'#3a2a2611';c.fillRect(rand()*size|0,rand()*size|0,2,1);}
    }else if(kind==='paving'){
      // 4×4 石板：每块独立明度与冷暖、缝线、倒角高光、颗粒、磨损斑。
      // 原来的贴图只是一层 40% 透明度的灰色网格，铺上去等于没有纹理，地面因此发白。
      const n=4, s=size/n;
      for(let gy=0;gy<n;gy++)for(let gx=0;gx<n;gx++){
        const l=(rand()-.5)*32, warm=(rand()-.5)*10;
        c.fillStyle=`rgb(${Math.round(180+l+warm)},${Math.round(183+l)},${Math.round(179+l-warm*.6)})`;
        c.fillRect(gx*s,gy*s,s,s);
      }
      for(let i=0;i<11000;i++){c.fillStyle=rand()>.5?'#ffffff12':'#2b3a3c12';c.fillRect(rand()*size|0,rand()*size|0,1+(rand()*2|0),1);}
      for(let i=0;i<28;i++){const x=rand()*size,y=rand()*size,r=16+rand()*50,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#57696a14');g.addColorStop(1,'#57696a00');c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,7);c.fill();}
      for(let i=0;i<=n;i++){
        const p=i*s;
        // 缝线跨在网格线上，并额外补一段让贴图接缝处也是完整的缝，平铺后看不出边界。
        for(const x of(p===0?[0,size-1]:[p-1])){
          c.fillStyle='#6c7879';c.fillRect(x,0,3,size);c.fillRect(0,x,size,3);
          c.fillStyle='#ffffff66';c.fillRect(x+3,0,1,size);c.fillRect(0,x+3,size,1);
        }
      }
    }else if(kind==='grass'){
      // 草地：色块层次 + 草叶笔触 + 零星草花。目标图里的草坪是有明暗斑块的，不是一整片纯色。
      for(let i=0;i<70;i++){const x=rand()*size,y=rand()*size,r=20+rand()*70,g=c.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,rand()>.5?'#86ab6a44':'#54764a44');g.addColorStop(1,'#00000000');c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,7);c.fill();}
      for(let i=0;i<5200;i++){const x=rand()*size,y=rand()*size,h=2+rand()*4;
        c.strokeStyle=['#7fa963','#69915377','#8fbc6b','#5d8250'][i%4];c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x+(rand()-.5)*2,y-h);c.stroke();}
      for(let i=0;i<90;i++){c.fillStyle=rand()>.5?'#e9e7a8':'#e8f0c0';c.fillRect(rand()*size|0,rand()*size|0,2,2);}
    }else{
      for(let i=0;i<1800;i++){const x=(i*73)%size,y=(i*37+Math.floor(i/size)*19)%size;c.fillStyle=i%2?'#ffffff13':'#2337440b';c.fillRect(x,y,2,2);}
    }
    const t=new THREE.CanvasTexture(canvas);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;if(kind==='brick')t.repeat.set(3,2);return t;
  }
  function material(key) {
    if(!materials[key]){
      const glass=key==='glass'||key==='warm', map=['brick','plaster','paving','grass'].includes(key)?texture(key):null;
      materials[key]=new THREE.MeshStandardMaterial({color:map?'#ffffff':colors[key]||key,map,roughness:glass?.24:.82,metalness:glass?.25:0,emissive:glass?'#ffce88':'#000000',emissiveIntensity:0});
    }
    return materials[key];
  }
  function build(kind,{x,z,w,d,h}) {
    if(!['dorm','hall','library','lab','lake','gym','gate','plaza'].includes(kind))throw new Error('Unknown campus building: '+kind);
    const root=new THREE.Group();root.name='Architecture_'+kind;root.position.set(x,0,z);
    const batches=new Map(), features=['recessed-windows'], transform=new THREE.Object3D(), windowsMaterials=[];let parts=0;
    function piece(shape,key,size,position,rotation=[0,0,0]) {
      const id=shape+':'+key;
      if(!batches.has(id))batches.set(id,{shape,key,matrices:[]});
      transform.position.set(...position);transform.scale.set(...size);transform.rotation.set(...rotation);transform.updateMatrix();
      batches.get(id).matrices.push(transform.matrix.clone());parts++;
    }
    const box=(key,bw,bh,bd,bx,by,bz,rotation)=>piece('box',key,[bw,bh,bd],[bx,by,bz],rotation);
    const post=(key,r,ph,px,py,pz)=>piece('cylinder',key,[r,ph,r],[px,py,pz]);
    function rod(key,a,b,r=.045){
      const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
      transform.position.copy(start.add(end).multiplyScalar(.5));transform.scale.set(r,delta.length(),r);transform.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());transform.updateMatrix();
      const id='cylinder:'+key;if(!batches.has(id))batches.set(id,{shape:'cylinder',key,matrices:[]});batches.get(id).matrices.push(transform.matrix.clone());parts++;
    }
    function windowPane(px,py,pz,ww=1.2,wh=1.45,side=0,lit=false){
      const face=(key,bw,bh,bd,dx,dy,dz)=>{const cs=Math.cos(side),sn=Math.sin(side);box(key,bw,bh,bd,px+dx*cs+dz*sn,py+dy,pz-dx*sn+dz*cs,[0,side,0]);};
      // 窗框用亮色 trim，不再是和墙面同一个 plaster。两者同色时窗户在立面上完全没有对比，
      // 远看就是一块白墙贴着几个蓝方块；目标图靠暖墙 + 亮白框 + 深色玻璃的明暗层次把窗户读出来。
      face('dark',ww+.18,wh+.18,.13,0,0,0);face(lit?'warm':'glass',ww,wh,.08,0,0,.09);
      for(const dx of[-ww/2,0,ww/2])face('trim',.065,wh+.13,.15,dx,0,.16);
      for(const dy of[-wh/2,wh/2])face('trim',ww+.15,.07,.15,0,dy,.16);
      face('concrete',ww+.32,.12,.4,0,-wh/2-.05,.13);
    }
    function windows(rows=2,step=2.35){
      const count=Math.max(2,Math.floor((w-1)/step));
      for(let floor=0;floor<rows;floor++)for(let i=0;i<count;i++){
        const px=(i-(count-1)/2)*(w-1.7)/count,py=1.8+floor*(h-1.5)/rows;
        if(floor||Math.abs(px)>1.4)windowPane(px,py,d/2+.03,Math.min(1.5,(w-1.7)/count-.35),Math.min(1.5,h/rows-1),0,(floor+i)%3===0);
        windowPane(px,py,-d/2-.03,1.1,Math.min(1.5,h/rows-1),Math.PI,(floor+i)%3===0);
      }
      for(const side of[-1,1])for(let i=0;i<Math.max(2,Math.floor(d/2.3));i++)for(let floor=0;floor<rows;floor++)windowPane(side*(w/2+.03),1.8+floor*(h-1.5)/rows,(i-(Math.max(2,Math.floor(d/2.3))-1)/2)*2,1.05,Math.min(1.4,h/rows-1),side*Math.PI/2);
    }
    function rail(bx,by,bz,length,side=0){
      const cs=Math.cos(side),sn=Math.sin(side);
      box('metal',length,.07,.07,bx,by+.85,bz,[0,side,0]);box('metal',length,.05,.05,bx,by+.15,bz,[0,side,0]);
      for(let q=-length/2;q<=length/2+.01;q+=.48)box('metal',.045,.82,.045,bx+q*cs,by+.45,bz-q*sn);
    }
    function gable(bw,bd,base,rise,key='roof',bx=0,bz=0){
      const half=(bd+.8)/2,angle=Math.atan2(rise,half),length=Math.hypot(half,rise);
      for(const side of[-1,1]){
        box(key,bw+.8,.16,length,bx,base+rise/2,bz+side*half/2,[side*angle,0,0]);
        for(let i=-bw/2;i<=bw/2;i+=.58)box('metal',.045,.045,length,bx+i,base+rise/2+.11,bz+side*half/2,[side*angle,0,0]);
      }
      box('dark',bw+.95,.16,.16,bx,base+rise+.08,bz);
      for(const side of[-1,1])box('metal',bw+.9,.13,.15,bx,base,bz+side*half);
    }
    function flatRoof(bw,bd,top,bx=0,bz=0){
      box('concrete',bw+.35,.22,bd+.35,bx,top,bz);
      for(const s of[-1,1]){box('plaster',bw+.4,.48,.18,bx,top+.3,bz+s*bd/2);box('plaster',.18,.48,bd,bx+s*bw/2,top+.3,bz);}
    }
    function planter(px,pz,length=1.4,py=.12){
      box('concrete',length,.5,.65,px,py+.25,pz);box('soil',length-.12,.08,.5,px,py+.51,pz);
      for(let i=0;i<Math.max(2,length/.35);i++)piece('leaf','foliage',[.27,.29,.27],[px-length/2+.22+i*.32,py+.7,pz]);
    }
    function entrance(title){
      const front=d/2+.06;
      box('dark',2.35,2.65,.18,0,1.48,front);box('glass',2.05,2.4,.09,0,1.45,front+.12);
      for(const xx of[-1.08,0,1.08])box('plaster',.08,2.5,.16,xx,1.45,front+.22);
      for(const xx of[-.13,.13])box('metal',.055,.5,.09,xx,1.4,front+.33);
      box('roof',3.25,.15,1.5,0,2.98,front+.5);for(const xx of[-1.4,1.4])rod('metal',[xx,3.55,front],[xx,3.02,front+1.15]);
      for(let i=0;i<3;i++)box('paving',3.45,.06*(3-i),.45,0,.03*(3-i)+.1,front+.38+i*.44);
      if(typeof document!=='undefined'){
        const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const c=canvas.getContext('2d');c.fillStyle='#364f5c';c.fillRect(0,0,512,96);c.fillStyle='#ecf0e8';c.font='600 34px Microsoft YaHei';c.textAlign='center';c.fillText(title,256,61,490);
        const map=new THREE.CanvasTexture(canvas);map.encoding=THREE.sRGBEncoding;
        const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.4,.64),new THREE.MeshStandardMaterial({map,roughness:.8}));sign.position.set(0,3.45,front+.18);root.add(sign);
      }
    }
    function drain(){for(const side of[-1,1]){post('metal',.055,h,side*(w/2-.15),h/2+.3,d/2+.2);box('dark',.4,.025,.8,side*(w/2-.15),.14,d/2+.6);}}
    function ac(px,py,pz){box('concrete',.9,.58,.55,px,py,pz);for(let i=0;i<5;i++)box('metal',.66,.04,.02,px,py-.2+i*.09,pz+.285);}
    const title={dorm:'梧桐宿舍',hall:'钟楼教学楼',library:'静川图书馆',lab:'知行实验楼',lake:'镜湖船屋',gym:'风雨运动馆',gate:'后街维修铺',plaza:'学生会馆'}[kind];

    if(kind==='hall'&&globalThis.CLOCKTOWER_MESH){
      for(const part of CLOCKTOWER_MESH){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));geo.computeVertexNormals();const m=new THREE.MeshStandardMaterial({color:new THREE.Color().fromArray(part.color),roughness:.75});if(part.name==='Blue window glass'){m.emissive.set('#ffce88');windowsMaterials.push(m);}const object=new THREE.Mesh(geo,m);object.name=part.name;object.castShadow=object.receiveShadow=true;root.add(object);}
      features.push('original-blender-clocktower');
    }else{
      box('concrete',w+.35,.38,d+.35,0,.19,0);
      box(['dorm','hall','gate'].includes(kind)?'brick':'plaster',w,h,d,0,h/2+.38,0);
      windows(kind==='dorm'?3:2);
    }

    if(kind==='dorm'){
      features.push('open-balconies','laundry','roof-dormers');
      gable(w,d,h+.65,1.35,'roof');
      for(const by of[2.75,4.7]){
        box('plaster',w-.3,.16,1.05,0,by,d/2+.35);rail(0,by+.08,d/2+.82,w-.5);
        for(let i=-w/2+1;i<w/2;i+=2.4){box('plaster',.15,1.7,.7,i,by+.92,d/2+.34);if(i>1){rod('metal',[i-.5,by+1.3,d/2+.56],[i+.5,by+1.3,d/2+.56],.025);box(i%2?'blue':'red',.35,.6,.035,i,by+1,d/2+.58);}}
      }
      for(const side of[-1,1]){ac(side*(w/2-.65),1.1,d/2+.35);planter(side*(w/2-1),d/2+.9,1.6);}
      box('plaster',2.3,1.2,2.1,-w*.22,h+1,0);gable(2.3,2.1,h+1.7,.55,'roof',-w*.22,0);
    }else if(kind==='library'){
      features.push('clerestory-atrium','terraced-roof','reading-bays');
      flatRoof(w,d,h+.5);
      box('glass',w*.5,1.6,d*.55,w*.13,h+1.3,0);flatRoof(w*.5,d*.55,h+2.18,w*.13,0);
      for(let i=-w*.1;i<w*.37;i+=.8)box('plaster',.09,1.7,d*.55+.1,i,h+1.3,0);
      box('glass',4.6,h-.1,.23,0,h/2+.65,d/2+.2);
      for(const xx of[-2.35,-1.18,0,1.18,2.35])box('wood',.12,h,.3,xx,h/2+.6,d/2+.4);
      for(const yy of[2.8,5.2])box('wood',4.9,.15,.35,0,yy,d/2+.4);
      for(const px of[-w*.36,w*.36]){box('plaster',2.5,.18,1.2,px,h*.53,d/2+.4);rail(px,h*.53+.1,d/2+.9,2.4);planter(px,-d*.32,2.1,h+.62);}
      for(let i=0;i<3;i++)box('blue',1.5,.06,1,-w*.3+i*1.8,h+.84,d*.15,[-.12,0,0]);
    }else if(kind==='lab'){
      features.push('sun-fins','service-roof','solar-canopy');
      flatRoof(w,d,h+.5);
      for(let px=-w/2+.65;px<w/2;px+=.72)if(Math.abs(px)>1.7)box('metal',.09,h-.4,.65,px,h/2+.55,d/2+.26);
      for(const yy of[2.9,h+.15])box('plaster',w+.4,.17,1.1,0,yy,d/2+.25);
      for(let i=0;i<3;i++){ac(-w*.25+i*1.5,h+1,0);post('metal',.13,1.3,w*.3+i*.35,h+1.1,-d*.25);}
      for(let i=-2;i<=2;i++)box('blue',1.5,.06,2,i*1.6,h+.9,d*.25,[-.15,0,0]);
      box('blue',1.1,3.6,.17,-w/2+.8,2.9,d/2+.72);
    }else if(kind==='lake'){
      features.push('timber-bracing','standing-seam-roof','boat-racks');
      gable(w,d,h+.45,1.4,'roof');
      for(let px=-w/2+.35;px<w/2;px+=1.15)box('wood',.15,h,.25,px,h/2+.4,d/2+.12);
      for(const xx of[-w/2+.4,w/2-.4]){box('wood',.2,2.7,.2,xx,1.6,d/2+.95);rod('wood',[xx,2.2,d/2+.95],[xx+(xx<0?.65:-.65),3.1,d/2+.95],.07);}
      box('roof',w+.25,.13,1.3,0,3.2,d/2+.5,[-.12,0,0]);
      for(const xx of[-w*.35,w*.35]){rod('wood',[xx,.6,d/2+.3],[xx+.5,2.8,d/2+.3],.055);box('wood',.22,.65,.05,xx+.5,2.45,d/2+.3,[0,0,-.22]);}
    }else if(kind==='gym'){
      features.push('barrel-roof','exposed-ribs','high-windows');
      for(let i=0;i<16;i++){
        const a=(i+.5)/16*Math.PI,px=Math.cos(a)*(w/2+.25),py=h+.4+Math.sin(a)*1.4;
        const slope=Math.atan2(-1.4*Math.cos(a),(w/2+.25)*Math.sin(a));
        box('roof',(w+.5)/10,.13,d+.65,px,py,0,[0,0,slope]);
      }
      for(const zz of[-d/2,-d/4,0,d/4,d/2])for(let i=0;i<12;i++){
        const a=i/12*Math.PI,b=(i+1)/12*Math.PI;rod('plaster',[Math.cos(a)*(w/2+.3),h+.53+Math.sin(a)*1.4,zz],[Math.cos(b)*(w/2+.3),h+.53+Math.sin(b)*1.4,zz],.055);
      }
      for(const xx of[-1,1])box('red',.16,h-.2,.4,xx*(w/2-.3),h/2+.4,d/2+.12);
    }else if(kind==='gate'){
      features.push('sawtooth-workshop','striped-awning','service-shutters');
      for(let i=0;i<3;i++){const bw=w/3;box('roof',bw+.08,.15,d+.5,-w/2+bw*(i+.5),h+.85,0,[0,0,.12]);box('glass',.12,.7,d*.65,-w/2+bw*(i+1)-.1,h+.58,0);}
      for(let i=0;i<12;i++)box(i%2?'plaster':'red',w/12,.09,1.45,-w/2+(i+.5)*w/12,2.8,d/2+.55,[-.15,0,0]);
      for(const xx of[-w*.31,w*.31]){box('metal',1.4,1.9,.2,xx,1.25,d/2+.1);for(let y=.4;y<2.2;y+=.17)box('dark',1.3,.035,.035,xx,y,d/2+.22);}
      post('metal',.2,1.5,w*.3,h+1.2,-d*.25);
    }else if(kind==='plaza'){
      features.push('club-loggia','roof-pergola','noticeboards');
      flatRoof(w,d,h+.45);
      for(const xx of[-w*.35,w*.35])box('plaster',.26,3,.3,xx,1.75,d/2+.8);
      box('wood',w+.35,.25,1.5,0,3.35,d/2+.35);
      rail(0,h+.7,d*.3,w*.65);
      for(const xx of[-w*.33,w*.33])for(const zz of[-d*.25,d*.25])box('wood',.12,1.7,.12,xx,h+1.35,zz);
      for(let px=-w*.36;px<w*.37;px+=.48)box('wood',.12,.12,d*.65,px,h+2.22,0);
      for(const xx of[-w*.34,w*.34]){box('dark',1.7,1.2,.18,xx,1.85,d/2+.15);for(let i=0;i<3;i++)box(['blue','plaster','red'][i],.38,.65,.025,xx-.5+i*.5,1.85,d/2+.26);}
      planter(-w*.32,-d*.24,2,h+.58);
    }else{
      features.push('entrance-colonnade','stone-pilasters','campus-clock');
      if(!globalThis.CLOCKTOWER_MESH){gable(w,d,h+.5,1.4);box('plaster',3,7,3,0,h+2,0);gable(3,3,h+5.5,1);}
      for(const xx of[-8,-5,5,8]){box('plaster',.22,3.3,.28,xx,1.9,4.9);box('plaster',2.6,.22,1.2,xx,3.65,4.45);}
      if(!globalThis.CLOCKTOWER_MESH)for(const xx of[-8,-5,5,8])for(const yy of[1.4,3.7,5.6])windowPane(xx,yy,3.35,1.05,1.15);
      else for(const xx of[-10.1,-7.1,-4.1,4.1,7.1,10.1]){box('plaster',.13,6.1,.18,xx,3.2,3.3);for(const yy of[.4,2.6,4.7,6.3])box('concrete',.3,.12,.27,xx,yy,3.36);}
      for(const xx of[-7.5,7.5])planter(xx,5.4,2.2);
    }
    if(kind!=='hall')entrance(title);
    drain();
    // Repeated architectural parts share one draw batch per material and primitive.
    for(const {shape,key,matrices} of batches.values()){
      geometries[shape] ||= shape==='box'?new THREE.BoxGeometry(1,1,1):shape==='cylinder'?new THREE.CylinderGeometry(1,1,1,8):new THREE.IcosahedronGeometry(1,1);
      const object=new THREE.InstancedMesh(geometries[shape],material(key),matrices.length);object.name=kind+'_'+shape+'_'+key;
      matrices.forEach((m,i)=>object.setMatrixAt(i,m));object.instanceMatrix.needsUpdate=true;object.castShadow=object.receiveShadow=true;object.frustumCulled=false;root.add(object);
    }
    root.userData={kind,parts,features};
    return {root,collider:{x,z,w:w/2+.6,d:d/2+.6},windows:[material('glass'),material('warm'),...windowsMaterials]};
  }
  return {build,material};
})();
