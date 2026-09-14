'use strict';
globalThis.WorldDistricts = (() => {
  const bounds = {minX:-62,maxX:102,minZ:-75,maxZ:105};
  const buildings = [
    ['bookshop','南门旧书局',-35,60,14,10,7],['cafe','雨巷咖啡馆',-12,60,14,10,7],
    ['grocery','榕树便利店',12,60,12,9,4.5],['arcade','像素游戏厅',36,60,14,10,5],
    ['clinic','青禾社区诊所',-34,89,14,10,5],['studio','回声照相馆',8,89,16,12,8],
    ['museum','砚池校史馆',72,-27,16,12,11]
  ].map(([id,name,x,z,w,d,h])=>({id,name,x,z,w,d,h,kind:id,entry:[x,z+d/2+1.5]}));
  const palette = {stone:'#c8d1cd',white:'#e7eeeb',red:'#b75758',wood:'#916e55',dark:'#344951',glass:'#6aabb2',green:'#3e896b',leaf:'#6da35f',pink:'#e89baf',gold:'#e1b763',road:'#839494',grass:'#77a879',water:'#46969a',blue:'#4c80ac'};
  function batcher(root) {
    const batches=new Map(), t=new THREE.Object3D();
    function part(key,w,h,d,x,y,z,shape='box',rotation=0) {
      const id=shape+':'+key;
      if(!batches.has(id))batches.set(id,{key,shape,matrices:[]});
      t.position.set(x,y,z);t.rotation.set(0,rotation,0);t.scale.set(w,h,d);t.updateMatrix();
      batches.get(id).matrices.push(t.matrix.clone());
    }
    function finish() {
      for(const b of batches.values()) {
        const geometry=b.shape==='sphere'?new THREE.IcosahedronGeometry(1,1):b.shape==='cylinder'?new THREE.CylinderGeometry(1,1,1,10):new THREE.BoxGeometry(1,1,1);
        const material=new THREE.MeshStandardMaterial({color:palette[b.key]||b.key,roughness:.8,...(b.key==='gold'?{emissive:'#edb96a',emissiveIntensity:.2}:{})});
        const mesh=new THREE.InstancedMesh(geometry,material,b.matrices.length);
        b.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;
        mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
      }
      root.userData.drawBatches=batches.size;
    }
    return {part,finish};
  }
  function build(root) {
    const colliders=[],visuals=[], landscape=new THREE.Group();landscape.name='ExpandedDistrictLandscape';root.add(landscape);
    const {part:p,finish}=batcher(landscape);
    const block=(x,z,w,d)=>colliders.push({x,z,w:w/2+.25,d:d/2+.25});
    const ground=(key,x,z,w,d,y=-.035)=>p(key,w,.05,d,x,y,z);
    ground('grass',20,15,164,180,-.09);
    ground('stone',-4,75,112,60,-.035);
    ground('road',-5,73,108,7,-.025);ground('road',-5,100,108,5,-.025);
    ground('stone',26,49,7,25,-.025);ground('stone',53,36,10,133,-.025);
    ground('stone',72,-13,36,7,-.025);ground('stone',68,9,53,6,-.025);
    ground('stone',87,44,6,113,-.025);ground('stone',69,83,40,6,-.025);
    ground('stone',-5,-46,111,5,-.025);ground('stone',-5,-67,111,4,-.025);
    ground('stone',-48,-57,4,22,-.025);ground('stone',33,-57,4,22,-.025);
    const tree=(x,z,s=1)=>{p('wood',.28*s,2.7*s,.28*s,x,1.35*s,z,'cylinder');p('green',1.7*s,2*s,1.7*s,x,3.2*s,z,'sphere');p('leaf',1.2*s,1.45*s,1.3*s,x+.5*s,4*s,z,'sphere');block(x,z,.65*s,.65*s);};
    const bench=(x,z)=>{for(const dx of[-.8,.8])p('dark',.1,.6,.65,x+dx,.3,z);for(const dz of[-.27,0,.27])p('wood',2,.1,.18,x,.64,z+dz);p('wood',2,.55,.1,x,1,z-.35);block(x,z,2,.85);};
    const planter=(x,z)=>{p('stone',1.3,.55,1.3,x,.28,z);p('green',.85,.65,.85,x,.8,z,'sphere');block(x,z,1.3,1.3);};
    for(const z of[42,50,78,86,101])for(const x of[-54,47])tree(x,z,1.05);
    for(let x=-54;x<43;x+=10)for(const z of[-71,-51])tree(x,z,.9);
    for(const x of[-38,-18,2,22]){bench(x,-62);p('pink',2,.3,2,x,.25,-57,'sphere');}
    for(const x of[-49,-24,0,24,46]){bench(x,78);planter(x+3,78);}
    for(const x of[-48,-22,22,43])for(const z of[69,97]){p('dark',.09,3.4,.09,x,1.7,z);p('gold',.6,.22,.6,x,3.5,z);block(x,z,.2,.2);}
    // Water footprints are split at the crossing so navigation and rendering agree.
    for(const [z,d] of[[-43,60],[39,88]]){ground('water',97,z,8,d,-.025);block(97,z,8,d);}
    ground('wood',97,-9,10,6,-.02);ground('stone',91,88,20,5,-.025);
    for(let z=-69;z<=99;z+=7){if(Math.abs(z+9)<5||z>83&&z<94)continue;p('stone',.3,1,.3,91,.5,z);p('wood',.12,.12,6.8,91,.95,z);}
    for(const [x,z,w,d] of[[68,29,23,22],[69,61,21,20]]) {
      ground('stone',x,z,w+2,d+2,-.03);ground('water',x,z,w,d,-.015);block(x,z,w,d);
      for(let i=0;i<18;i++){const px=x-w/2+2+(i*3.7)%(w-4),pz=z-d/2+2+(i*5.3)%(d-4);p('green',.65,.045,.65,px,.055,pz,'cylinder');if(i%3===0)p('pink',.25,.23,.25,px,.18,pz,'sphere');}
    }
    for(const z of[17,43,77,97]){tree(82,z);bench(86,z);}
    for(let x=59;x<82;x+=5)tree(x,-48,.9);
    // Compact market furniture lives between storefronts, away from the main street.
    for(const x of[-47,23]){p('wood',2.6,1,1.2,x,.5,84);p('white',3,.12,2,x,2.25,84);for(const dx of[-1.25,1.25])p('dark',.07,2.2,.07,x+dx,1.1,84);for(let i=0;i<5;i++)p(i%2?'gold':'red',.3,.25,.3,x-1+i*.45,1.13,84,'sphere');block(x,84,3,2);}
    for(let i=0;i<5;i++){const x=-9+i*1.1;p('dark',.07,.9,.07,x,.45,82);p('dark',.07,.9,.07,x,.45,83);p('dark',.07,.07,1,x,.9,82.5);}block(-6.8,82.5,5,1);
    finish();
    for(const b of buildings) {
      const g=new THREE.Group();g.name='District_'+b.id;g.position.set(b.x,0,b.z);root.add(g);
      const {part:q,finish:done}=batcher(g), front=b.d/2;
      const body={bookshop:'stone',cafe:'white',grocery:'white',arcade:'dark',clinic:'white',studio:'stone',museum:'red'}[b.id];
      q(body,b.w,b.h,b.d,0,b.h/2,0);q('stone',b.w+.5,.25,b.d+.5,0,.15,0);
      q('dark',2.2,2.6,.16,0,1.4,front+.07);q('glass',1.9,2.35,.12,0,1.4,front+.18);q('gold',.07,.5,.13,.45,1.35,front+.28);
      for(let floor=0;floor<Math.floor(b.h/3);floor++)for(let x=-b.w/2+1.6;x<b.w/2-1;x+=2.6){if(!floor&&Math.abs(x)<2)continue;q('dark',1.8,1.9,.13,x,1.8+floor*3,front+.05);q('glass',1.55,1.65,.14,x,1.8+floor*3,front+.13);q('white',.06,1.7,.16,x,1.8+floor*3,front+.23);}
      q('dark',b.w+.55,.24,b.d+.5,0,b.h+.1,0);
      q('gold',b.w-2,.65,.14,0,3.2,front+.2);
      if(b.id==='bookshop'){for(const x of[-5,-2.7,2.7,5]){q('wood',.22,3.1,.25,x,1.55,front+.65);q('wood',1.8,.18,.8,x,2.9,front+.5);}for(let i=0;i<12;i++)q(i%2?'red':'blue',.17,.65,.25,-5.8+i*.25,.8,front+.4);q('wood',b.w,.3,1.1,0,3.6,front+.4);}
      if(b.id==='cafe'){q('wood',b.w-.5,.15,2,0,3.8,front+.8);for(const x of[-5,5]){q('white',.13,2,.13,x,4.8,front+1.5);q('green',1.1,.6,.6,x,4.1,front+1.5,'sphere');}q('white',10,.12,.12,0,4.8,front+1.5);for(const x of[-4,4]){q('wood',1.1,.12,1,x,.9,front+.75);q('dark',.12,.9,.12,x,.45,front+.75);} }
      if(b.id==='grocery'){for(let i=0;i<12;i++)q(i%2?'white':'green',b.w/12,.18,1.65,-b.w/2+(i+.5)*b.w/12,3.75,front+.65);for(const x of[-4,4]){q('wood',1.5,.75,.65,x,.38,front+.5);q('gold',1.35,.2,.55,x,.85,front+.5);}}
      if(b.id==='arcade'){for(const x of[-b.w/2+.3,b.w/2-.3])q('pink',.2,b.h,.2,x,b.h/2,front+.2);for(const y of[.5,4.1])q('blue',b.w,.16,.2,0,y,front+.22);for(let i=0;i<7;i++)q(i%2?'pink':'gold',.5,.5,.2,-2+i*.65,b.h+.6+(i%3)*.3,front);}
      if(b.id==='clinic'){q('white',4,.25,1.7,0,3,front+.6);q('red',.45,1.6,.18,4,3.6,front+.22);q('red',1.6,.45,.18,4,3.6,front+.23);q('blue',b.w,.3,.16,0,b.h-.5,front+.2);}
      if(b.id==='studio'){for(let i=0;i<4;i++){q('glass',2.8,.3,b.d-1,-5.5+i*3.6,b.h+.35+(i%2)*.3,0);q('dark',.14,2,.2,-5.5+i*3.6,6.1,front+.2);}q('red',3.5,2.2,.2,-4.7,1.5,front+.25);q('gold',1,1.2,.2,-4.7,1.5,front+.4);}
      if(b.id==='museum'){for(const x of[-6,-3,3,6]){q('white',.5,7,.65,x,3.5,front+.45);q('stone',.85,.3,.9,x,7.05,front+.45);}for(let i=0;i<5;i++)q('dark',b.w+1-i*1.2,.28,b.d+1-i*.9,0,b.h+.25+i*.27,0);q('white',b.w+.5,.5,.8,0,7.4,front+.25);q('gold',3,.8,.18,0,9.3,front+.2);}
      g.userData.features=[b.id+'-facade'];done();
      if(b.id==='cafe'||b.id==='grocery')for(const dx of[-4,4])block(b.x+dx,b.z+front+.65,1.5,1.1);
      if(globalThis.WorldArt&&typeof document!=='undefined')WorldArt.label(g,b.name,0,b.h+1.4,front,'#f2f5ef',5.6);
      const collider={x:b.x,z:b.z,w:b.w/2+.3,d:b.d/2+.3};colliders.push(collider);visuals.push({id:b.id,root:g,collider,windows:[]});
    }
    return {colliders,visuals};
  }
  return {bounds,buildings,build};
})();
