'use strict';
globalThis.WorldArt = (() => {
  const prototypes = {}, materials = {};
  const material = color => materials[color] ||= new THREE.MeshStandardMaterial({ color, roughness:.8 });
  function box(root,w,h,d,color,x,y,z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color)); mesh.position.set(x,y,z); mesh.castShadow=mesh.receiveShadow=true; root.add(mesh); return mesh;
  }
  function asset(root,name,x,y,z,height=1,rotation=0) {
    if (!prototypes[name] && globalThis.KENNEY_MESHES?.[name]) {
      const g = new THREE.Group();
      // The Kenney kits store their palette as sRGB bytes inside glTF's
      // baseColorFactor, which glTF defines as linear. The official Side/*.png
      // previews confirm it: tree_oak's trunk is a mid brown (#E28457) and its
      // foliage a saturated teal (#29C9AB), not the pale peach (#F2BE9E) and mint
      // (#70E6D6) you get by reading the numbers as linear. Every Kenney prop in the
      // game was rendering washed out because of this, which also made the interiors
      // look overexposed. Convert on the way in so the source colours survive.
      for (const part of KENNEY_MESHES[name]) { const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3)); geo.computeVertexNormals(); const color=new THREE.Color().fromArray(part.color).convertSRGBToLinear(); const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({ color,roughness:.8 })); m.castShadow=m.receiveShadow=true; g.add(m); }
      const b=new THREE.Box3().setFromObject(g), size=b.getSize(new THREE.Vector3()), center=b.getCenter(new THREE.Vector3());
      g.children.forEach(m=>{ m.geometry.translate(-center.x,-b.min.y,-center.z); m.geometry.scale(1/size.y,1/size.y,1/size.y); }); prototypes[name]=g;
    }
    if (!prototypes[name]) return box(root,height,height,height,'#94a594',x,y+height/2,z);
    const a=prototypes[name].clone(); a.position.set(x,y,z); a.scale.setScalar(height); a.rotation.y=rotation; root.add(a); return a;
  }
  function roundRect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
  function label(root,text,x,y,z,color='#e4f3ee',width=4.5) {
    const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=96; const c=canvas.getContext('2d');
    c.font='bold 32px Microsoft YaHei'; c.textAlign='center'; c.textBaseline='middle';
    // A scrim that hugs the text. The previous full-width opaque plate read as a debug
    // overlay under the top-down interior camera, where it was the loudest thing on screen.
    const textWidth=Math.min(456,Math.max(40,c.measureText(text).width)), padX=24, padY=14;
    const w=textWidth+padX*2, h=42+padY*2;
    roundRect(c,(512-w)/2,(96-h)/2,w,h,17);
    c.fillStyle='rgba(12,32,40,0.42)'; c.fill();
    c.strokeStyle='rgba(226,244,238,0.30)'; c.lineWidth=2; c.stroke();
    c.shadowColor='rgba(6,18,24,0.85)'; c.shadowBlur=10;
    c.fillStyle=color; c.fillText(text,256,50,textWidth);
    const texture=new THREE.CanvasTexture(canvas); texture.encoding=THREE.sRGBEncoding;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,transparent:true})); sprite.layers.set(1);sprite.position.set(x,y,z); sprite.scale.set(width,width*96/512,1); sprite.renderOrder=3; root.add(sprite); return sprite;
  }
  function npc(root,x,z,color='#779fba',variant=0) {
    const g=new THREE.Group(); root.add(g); g.position.set(x,.15,z);
    box(g,.68,.85,.4,color,0,1.07,0); box(g,.2,.7,.23,'#303b4a',-.2,.38,0); box(g,.2,.7,.23,'#303b4a',.2,.38,0);
    box(g,.19,.65,.23,color,-.48,1.05,0); box(g,.19,.65,.23,color,.48,1.05,0);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.28,12,8),material('#e6bc9c'));head.position.y=1.79;g.add(head);
    box(g,.51,.16,.44,variant%2?'#6b443c':'#252936',0,2,0);
    box(g,.075,.075,.025,'#283442',-.1,1.82,.255);box(g,.075,.075,.025,'#283442',.1,1.82,.255);
    if(variant%2)box(g,.5,.55,.2,'#be795f',0,1.05,-.3);
    return g;
  }
  function interactables(root,objects) {
    const visuals={};
    for(const o of objects){
      const g=new THREE.Group();g.position.set(o.x,0,o.z);root.add(g);visuals[o.id]=g;
      if(o.type==='npc'){
        // Named cast from characters.js; the procedural figure stays as fallback.
        const actor=globalThis.Characters?.create(o.character||'studentA');
        if(actor)g.add(actor.group);
        else npc(g,0,0,['#657eaf','#a56a80','#6d9a85'][o.name.length%3],o.name.length);
      }
      else if(o.type==='chest'){
        box(g,1.3,.7,.9,'#865d49',0,.55,0); const lid=box(g,1.4,.22,1,'#b27c4c',0,1.02,0);g.userData.lid=lid;
        for(const x of[-.45,.45])box(g,.1,.88,1.04,'#ddb86b',x,.64,0);box(g,.22,.24,.1,'#edcf7d',0,.77,.55);
      }else if(o.type==='pc'){
        asset(g,'desk',0,.15,0,1.2);asset(g,'computerScreen',0,1.35,-.05,.85);
        box(g,.85,.42,.04,'#64c4d8',0,1.87,.13);asset(g,'chairDesk',0,.15,1.15,1.15,Math.PI);
      }else if(o.type==='stamp'||o.type==='quest'){
        box(g,.8,.9,.8,'#71868a',0,.6,0);box(g,.4,.17,.4,o.type==='stamp'?'#e1ad62':'#89c5d5',0,1.15,0);
      }else if(o.type==='switch'){
        box(g,.9,1.4,.4,'#5e7880',0,.85,0);box(g,.2,.5,.15,'#d58462',0,1.15,.3);
      }else if(o.type==='note'){
        box(g,1.4,.95,.8,'#9e8975',0,.6,0);box(g,.55,.025,.42,'#eff0dc',0,1.09,0);
      }else { box(g,2,.035,1.4,'#6dc8b7',0,.2,0); }
      const ring=new THREE.Mesh(new THREE.RingGeometry(.78,.88,24),new THREE.MeshBasicMaterial({color:o.type==='chest'?'#f0c570':'#86dce1',side:THREE.DoubleSide,transparent:true,opacity:.8}));ring.rotation.x=-Math.PI/2;ring.position.y=.22;g.add(ring);g.userData.ring=ring;
      const short={chest:'宝箱',stamp:'印章',pc:'终端',switch:'电源',quest:'校史委托',exit:'出口',door:'入口',note:'便签'};
      label(g,short[o.type]||o.name,0,o.type==='npc'?2.7:2.5,0,o.type==='chest'?'#ffdc94':'#d6f8f0',o.type==='npc'?3:2.1);
    }
    return visuals;
  }
  function interior(zone) {
    const r=Exploration.regions[zone],root=new THREE.Group(),colliders=[];
    root.name='Interior_'+zone;
    const wall=(x,z,w,d,h=1.1)=>{box(root,w,h,d,'#d6dcda',x,h/2+.15,z);box(root,w,.12,d+.05,r.color,x,h+.21,z);colliders.push({x,z,w:w/2+.28,d:d/2+.28});};
    box(root,37,.65,29,'#4f6669',0,-.24,0);box(root,36,.15,28,'#bcc8c7',0,.09,0);
    wall(-18,0,.35,28,2.8);wall(18,0,.35,28,2.8);wall(0,-14,36,.35,2.8);wall(-10,14,16,.35);wall(10,14,16,.35);
    wall(0,-8,.3,12);wall(0,6,.3,7);
    for(const z of[-2.5,2.5])for(const x of[-14,-3,3,14])wall(x,z,x===-14||x===14?8:6,.3);
    // Open thresholds keep all four rooms connected to the central corridor.
    for(const x of[-8.5,8.5])for(const z of[-2.5,2.5]){box(root,2.3,.04,1,r.color,x,.21,z);for(const side of[-1,1])box(root,.14,2.5,.45,r.color,x+side*1.18,1.35,z);}
    box(root,34,.02,2.4,'#789eaa',0,.18,0);box(root,2.5,.02,10,'#789eaa',0,.18,8);
    const roomCenters=[[-9,-8],[9,-8],[-9,8],[9,8]];
    roomCenters.forEach(([cx,cz],i)=>{
      const palette=['#b6c3b6','#bac5d4','#ccbdb3','#adc4c4'];box(root,16.5,.03,9.8,palette[i],cx,.18,cz);
      // Tile and timber seams make floor scale legible at the exploration camera distance.
      for(let x=cx-7;x<cx+8;x+=2)box(root,.035,.015,9.5,'#a6b4b6',x,.205,cz);
      label(root,r.rooms[i],cx,.5,cz+3.6,'#f1f4ed',6.5);
      for(const dx of[-5,5])asset(root,'pottedPlant',cx+dx,.21,cz+(cz<0?-4:4),1.3);
      if(r.style==='dorm'){
        if(i<2)for(const x of[cx-5,cx+4]){asset(root,'bedBunk',x,.2,cz-2,2.8);colliders.push({x,z:cz-2,w:1.4,d:2});}
        else if(i===2){asset(root,'loungeSofa',cx-3,.2,cz+1,1.3);asset(root,'tableRound',cx+2,.2,cz,1);}
        else for(let k=0;k<3;k++)asset(root,'washer',cx-4+k*2.4,.2,cz+3,1.4);
      }else if(r.style==='library'){
        for(const x of[cx-5,cx+4]){asset(root,'bookcaseOpen',x,.2,cz-2,2.8);colliders.push({x,z:cz-2,w:1.3,d:.65});}
        asset(root,'loungeSofa',cx,.2,cz+2,1.2);
      }else if(r.style==='class'){
        if(i<2){for(const dx of[-4,1])for(const dz of[-1.5,1.5]){asset(root,'desk',cx+dx,.2,cz+dz,1);asset(root,'chairDesk',cx+dx,.2,cz+dz+1,1);colliders.push({x:cx+dx,z:cz+dz,w:1.1,d:.65});}box(root,5,1.5,.14,'#3a6d63',cx,1.8,-13.7);}
        else{asset(root,'bookcaseOpen',cx-4,.2,cz+3,2.6);asset(root,'loungeSofa',cx+1,.2,cz+2,1.2);}
      }else if(r.style==='lab'||r.style==='shop'){
        for(const x of[cx-4,cx+1]){asset(root,'desk',x,.2,cz,1.2);asset(root,'laptop',x,1.4,cz,.5);colliders.push({x,z:cz,w:1.25,d:.8});}
        for(let k=0;k<3;k++){box(root,1.1,2.4,.9,'#4b6278',cx-4+k*1.4,1.4,cz-3.5);for(let j=0;j<5;j++)box(root,.7,.08,.03,j%2?'#81cdbe':'#8eacd8',cx-4+k*1.4,.7+j*.3,cz-3);}
      }else if(r.style==='gym'){
        for(let k=0;k<4;k++){box(root,1.3,2.3,.7,k%2?'#738c99':'#b18a76',cx-5+k*1.5,1.35,cz-3.5);box(root,.08,.45,.1,'#e4decf',cx-4.6+k*1.5,1.4,cz-3.1);}
        box(root,5,.12,2.5,'#6d91ae',cx,.3,cz);for(const x of[cx-2,cx+2])box(root,.5,.6,1,'#36434e',x,.65,cz);
      }else if(r.style==='lake'){
        if(i===0||i===3)asset(root,'canoe',cx,.2,cz,1.2,Math.PI/2);else{asset(root,'tableRound',cx,.2,cz,1.15);asset(root,'loungeSofa',cx-4,.2,cz+1,1.2);}
      }else{asset(root,'loungeSofa',cx-3,.2,cz,1.25);asset(root,'tableRound',cx+2,.2,cz,1.1);asset(root,'bookcaseOpen',cx,.2,cz-3,2.4);}
    });
    for(const x of[-14,-5,5,14]){box(root,2.8,1.2,.12,'#8bb3c9',x,1.8,-13.76);box(root,2.9,.12,.4,'#f0eadc',x,1.15,-13.65);}
    asset(root,'kitchenCoffeeMachine',-15,1.1,0,.9);asset(root,'lampRoundFloor',15,.2,0,2.2);
    const visuals=interactables(root,Exploration.objects(zone));
    return {root,colliders,visuals};
  }
  function campusGrounds(root) {
    const batches=new Map(),transform=new THREE.Object3D(),colliders=[];
    const part=(color,w,h,d,x,y,z,rotation=[0,0,0])=>{
      if(!batches.has(color))batches.set(color,[]);
      transform.position.set(x,y,z);transform.scale.set(w,h,d);transform.rotation.set(...rotation);transform.updateMatrix();batches.get(color).push(transform.matrix.clone());
    };
    // Low curbs remain traversable; only solid furniture contributes collision.
    for(const x of[-3.65,3.65,-14.2,-9.8,11.8,16.2,31.8,36.2])for(let z=-33;z<34;z+=1.1){
      if(Math.abs(z+8)<3||Math.abs(z-9)<3)continue;
      if((x===16.2||x===31.8)&&z<6)continue;
      part('#a9b8b9',.18,.14,1.02,x,.15,z);
    }
    for(const z of[-10.65,-5.35,6.35,11.65])for(let x=-40;x<40;x+=1.1){
      if(Math.abs(x)<4.1||Math.abs(x+12)<2.5||Math.abs(x-14)<2.5||Math.abs(x-34)<2.5)continue;
      if(z>0&&x<-14)continue;
      part('#a9b8b9',1.02,.14,.18,x,.15,z);
    }
    for(const [x,z,w,d] of[[-22,-10,12,1.4],[24,-12,15,1.5],[24,6,12,1.4],[-24,35,10,1.2]]){
      part('#a9b8b9',w,.04,d,x,.12,z);
      for(let px=x-w/2+.22;px<x+w/2;px+=.46)part('#d6dbd5',.39,.03,d-.12,px,.16,z);
    }
    for(let x=-38.8;x<-31.1;x+=.3)part('#a89078',.25,.055,1.3,x,.15,1.1);
    for(const [x,z] of[[17,-12],[31,-12],[18,6.3],[30,6.3]]){
      part('#bac4c2',2.1,.5,.65,x,.35,z);part('#557b60',1.98,.27,.56,x,.67,z);
      for(let i=0;i<7;i++)part(i%2?'#e5c36c':'#b97d93',.13,.2,.13,x-.83+i*.27,.91,z);
      colliders.push({x,z,w:1.2,d:.5});
    }
    for(const [x,z] of[[18,-10.4],[30,-10.4]]){
      for(let k=0;k<4;k++)part('#9c8171',2,.08,.13,x,.65,z-.24+k*.16);
      for(const dx of[-.7,.7])part('#506973',.09,.54,.55,x+dx,.32,z);
      part('#9c8171',2,.45,.09,x,.91,z-.35);colliders.push({x,z,w:1.15,d:.48});
    }
    for(const [x,z,color] of[[32,25,'#bf7773'],[-38,-9,'#638ca3']]){
      part(color,.9,1.7,.65,x,.95,z);part('#e2e8dd',.63,.8,.04,x,1.17,z+.34);
      for(let i=0;i<6;i++)part(['#ba7468','#689b98','#c6b170'][i%3],.14,.18,.045,x-.2+(i%3)*.2,1.38-Math.floor(i/3)*.34,z+.37);
      part('#334d59',.45,.15,.05,x,.42,z+.35);colliders.push({x,z,w:.6,d:.48});
    }
    const sx=-31,sz=-21;
    part('#b8c3c3',2.5,.08,5,sx,.14,sz);
    for(const dx of[-1,1])for(const dz of[-2.1,2.1])part('#587783',.09,2.6,.09,sx+dx,1.43,sz+dz);
    part('#739ea8',2.7,.12,5.25,sx,2.85,sz,[0,0,.1]);
    for(let i=-2;i<=2;i++)part('#d5e2dc',2.7,.05,.04,sx,2.94,sz+i);
    const wheelGeometry=new THREE.TorusGeometry(.3,.035,5,18),wheelMaterial=material('#3d5058');
    for(let i=0;i<3;i++){
      const z=sz-1.45+i*1.4;
      for(const dz of[-.42,.42]){const wheel=new THREE.Mesh(wheelGeometry,wheelMaterial);wheel.rotation.y=Math.PI/2;wheel.position.set(sx,.5,z+dz);wheel.castShadow=true;root.add(wheel);}
      part('#6c9fa4',.045,.55,.055,sx,.78,z-.18,[-.6,0,0]);part('#6c9fa4',.045,.55,.055,sx,.78,z+.18,[.6,0,0]);part('#6c9fa4',.055,.055,.7,sx,.72,z);
      part('#364e57',.27,.08,.32,sx,1.04,z-.18);part('#364e57',.055,.38,.055,sx,1.08,z+.4,[-.2,0,0]);part('#364e57',.47,.05,.05,sx,1.25,z+.44);
    }
    colliders.push({x:sx,z:sz,w:1.4,d:2.7});
    const geometry=new THREE.BoxGeometry(1,1,1);
    for(const [color,matrices] of batches){const m=new THREE.InstancedMesh(geometry,material(color),matrices.length);m.name='CampusGrounds_'+color;matrices.forEach((matrix,i)=>m.setMatrixAt(i,matrix));m.instanceMatrix.needsUpdate=true;m.castShadow=m.receiveShadow=true;m.frustumCulled=false;root.add(m);}
    return colliders;
  }
  function outdoor(root) {
    const colliders=[];
    const hedge=(x,z,w,d)=>{box(root,w,.3,d,'#b5bfb0',x,.15,z);box(root,w-.15,.85,d-.1,'#487c59',x,.65,z);colliders.push({x,z,w:w/2+.2,d:d/2+.2});};
    // Short paths, stepped planters, and interrupted hedges create distinct garden pockets.
    for(const [x,z,w,d] of[[-29,-3,12,5],[20,14,9,4],[25,-32,16,4],[-19,31,9,3]]){
      box(root,w,.25,d,'#748b67',x,.18,z);box(root,w+.3,.18,.25,'#b8c3b2',x,.22,z-d/2);box(root,w+.3,.18,.25,'#b8c3b2',x,.22,z+d/2);
      for(let i=0;i<10;i++){const px=x-w/2+.7+i*(w-1.4)/9;asset(root,i%2?'flower_redA':'flower_yellowC',px,.32,z-.8,.6);asset(root,'grass_large',px,.3,z+.8,.55);}
    }
    hedge(-29,-5.7,12,.7);hedge(-32,1,6,.7);hedge(21,16.5,8,.7);hedge(31,-30,6,.7);
    for(let i=0;i<12;i++)box(root,1.2,.07,.85,'#d0cbbb',-38+i*1.8,.22,-6.8+Math.sin(i*.7)*.45);
    for(let i=0;i<9;i++)box(root,1.1,.08,.8,'#d1cebb',-16.4+Math.sin(i*.8)*.7,.16,23+i*.95);
    for(let i=0;i<14;i++)box(root,1.1,.08,.9,'#ced0bc',-5+i*1.2,.13,-31.2+Math.sin(i*.5));
    for(const [x,z,h] of[[-40,-31,5.2],[-17,-32,4.8],[13,-32,4.7],[-40,6,5.5],[-40,28,4.8],[18,18,4.8],[32,-33,5],[-18,1,4.2]])asset(root,x>0?'tree_detailed_fall':'tree_oak',x,.1,z,h);
    for(const [x,z] of[[-39,10],[-39,23],[-17,28],[18,16],[30,-32],[-18,-33]])asset(root,'rock_largeA',x,.1,z,1.1);
    for(let i=0;i<12;i++)asset(root,'plant_bushDetailed',-40+i*3.2,.1,-34,1.1);
    for(let i=0;i<8;i++)asset(root,'lily_large',-28+Math.cos(i)*8,.23,15+Math.sin(i)*9,.12);
    for(let i=0;i<6;i++)asset(root,'fence_planks',17+i*2.4,.1,30,1);
    box(root,17,.4,67,'#70895d',-49.5,-.06,0);
    box(root,14,1.2,18,'#7d9576',-49,.5,-25);
    box(root,14,.16,18,'#a2af7b',-49,1.2,-25);
    colliders.push(
      {x:-52.9,z:-16.1,w:3.2,d:.5},{x:-44.1,z:-16.1,w:2.2,d:.5},
      {x:-42,z:-25,w:.5,d:9.4},{x:-56.2,z:-25,w:.4,d:9.4},{x:-49,z:-34.2,w:7.4,d:.4}
    );
    for(let i=0;i<5;i++)box(root,3.2,.25*(i+1),.85,'#abb7a9',-48,.125*(i+1),-13.5-i*.75);
    box(root,15,.08,2,'#b2b297',-48,.14,-8);
    for(let i=0;i<20;i++){const z=-11+i*2.3,x=-48+Math.sin(i*.55)*2;box(root,2.4,.06,2.5,'#aeb599',x,.17,z);}
    for(let i=0;i<8;i++)box(root,1.1,.07,.8,'#bfc3b0',-49-i*.6,.2,13+i*.8);
    for(const x of[-56,-43])for(let z=-31;z<30;z+=6.5)asset(root,z%2?'tree_oak':'tree_detailed_fall',x,z<-17?1.3:.15,z,4.2+(Math.sin(z)+1)*.8);
    for(let i=0;i<10;i++){asset(root,'plant_bushDetailed',-54,.2,-10+i*4,1.3);asset(root,'grass_large',-45,.2,-7+i*3.2,.7);}
    for(const [x,z] of[[-54,8],[-44,24],[-52,-22],[-46,-31]])asset(root,'rock_largeA',x,z<-17?1.3:.15,z,1.4);
    box(root,3,.3,3,'#c5c6b3',-49,1.45,-28);box(root,.8,2.5,.8,'#a6b1aa',-49,2.8,-28);label(root,'旧气象台 · 林间小径',-49,4.8,-28,'#d8e7ca',6);
    const visuals=interactables(root,Exploration.outdoor);
    for(const o of Exploration.outdoor)if(o.x<-42&&o.z<-17)visuals[o.id].position.y=1.3;
    colliders.push(...campusGrounds(root));
    return {colliders,visuals};
  }
  function refresh(visuals,world) {
    if(!world)return;
    for(const [id,g] of Object.entries(visuals)){
      const done=world.opened.includes(id)||world.stamps.includes(id.replace(/-stamp$/,''))||world.switches.includes(id);
      if(g.userData.lid)g.userData.lid.rotation.x=done?-1.1:0;
      if(g.userData.ring)g.userData.ring.material.opacity=done?.2:.8;
    }
  }
  const height=(x,z)=>x<-42&&z<-13?Math.min(1.3,(-z-13)*.32):.22;
  return {asset,label,npc,interactables,interior,outdoor,campusGrounds,refresh,height};
})();
