'use strict';
globalThis.Interiors = (() => {
  // Plans own navigation and interaction coordinates; art is built from this same data.
  const plans = {
    dorm: {
      concept:'双侧寝室 · 纵向生活走廊', accent:'#71aaa0', floor:'#d1d6c8',
      areas:[[-10,-7,14,12],[10,-7,14,12],[-10,7,14,12],[10,7,14,12]],
      walls:[[-3,-11,.3,6],[-3,1,.3,10],[-3,11,.3,5],[3,-11,.3,6],[3,1,.3,10],[3,11,.3,5],[-10,0,14,.3],[10,0,14,.3]],
      points:[[0,12],[-8,-7],[14,-11],[0,-4],[-11,6],[14,7],[7,7],[-13,-10],[9,-5],[-7,10]],
      furniture:[['bedBunk',-14,-5,2.5],['bedBunk',-6,-11,2.5],['bedBunk',7,-11,2.5],['bedBunk',14,-5,2.5],['loungeSofa',-14,3,1.3],['tableRound',-8,4,1],['washer',6,11,1.3],['washer',9,11,1.3],['washer',12,11,1.3]],
      characters:['suqi','studentA','studentB']
    },
    hall: {
      concept:'阶梯讲堂 · 侧廊研讨与展陈', accent:'#be7e81', floor:'#d2d5db',
      areas:[[-6,-4,22,18],[12,-8,9,10],[12,5,9,13],[-8,10,18,5]],
      walls:[[6,-10,.35,8],[6,3,.35,12],[13,-2,10,.3],[-12,7,10,.3],[1,7,6,.3]],
      points:[[0,12],[-4,-10],[-15,10],[12,-8],[12,4],[15,10],[10,9],[2,-9],[-11,-9],[-8,4]],
      furniture:[['desk',11,-11,1.1],['bookcaseOpen',16,1,2.3],['loungeSofa',11,1,1.2]],
      characters:['guqinghe','studentA','zhouran']
    },
    library: {
      concept:'中央天井 · 环形书廊', accent:'#719ec1', floor:'#d2ded9',
      areas:[[-12,-2,9,20],[11,-8,11,10],[-2,8,16,9],[12,6,9,12]],
      walls:[[-5,-3,.3,9],[5,-3,.3,9],[0,-7.5,10,.3],[0,1.5,10,.3],[7,8,.3,7],[12,-2,10,.3]],
      points:[[0,12],[-4,7],[-14,-11],[-11,3],[10,-8],[14,10],[14,-5],[-11,-7],[10,5],[3,9]],
      furniture:[['bookcaseOpen',-16,-6,2.6],['bookcaseOpen',-16,0,2.6],['bookcaseOpen',-16,6,2.6],['bookcaseOpen',16,1,2.6],['bookcaseOpen',16,6,2.6],['loungeSofa',-5,11,1.2],['tableRound',-11,9,1.1],['desk',8,-11,1]],
      characters:['linwan','studentB','archivist']
    },
    lake: {
      concept:'开放修船坞 · 观测夹廊', accent:'#6bb5b0', floor:'#b5c9cd',
      areas:[[-10,-6,14,13],[11,-8,12,10],[11,6,12,13],[-9,8,15,8]],
      walls:[[3,-10,.3,7],[3,2,.3,9],[11,-2,14,.3],[-13,3,8,.3],[-2,3,3,.3]],
      points:[[0,12],[-9,-8],[15,-10],[10,6],[-11,9],[-15,9],[8,-7],[-3,-10],[14,0],[7,10]],
      furniture:[['canoe',-13,-4,1.2,1.57],['canoe',-6,-4,1.2,1.57],['tableRound',12,10,1.2],['loungeSofa',16,6,1.2],['bookcaseOpen',-16,5,2.1]],
      characters:['keeper','photographer','studentB']
    },
    gym: {
      concept:'开放球场 · 战术区与更衣侧翼', accent:'#c59964', floor:'#d5d7ca',
      areas:[[-5,-4,23,18],[12,-8,9,10],[12,5,9,12],[-8,10,18,5]],
      walls:[[6,-10,.3,8],[6,2,.3,10],[13,-2,10,.3],[-12,7,10,.3]],
      points:[[0,12],[-5,-6],[-15,10],[11,1],[12,-7],[14,10],[15,-11],[-11,5],[1,-10],[-2,4]],
      furniture:[['loungeSofa',10,5,1.1],['desk',10,-11,1.1]],
      characters:['captain','studentA','studentB']
    },
    lab: {
      concept:'L 形实验动线 · 机房与封存档案', accent:'#829bc0', floor:'#c5d4dc',
      areas:[[-9,-7,15,12],[10,-7,13,12],[-10,7,14,12],[11,7,12,12]],
      walls:[[-5,-10,.3,7],[-5,0,.3,5],[-5,10,.3,5],[5,-10,.3,7],[5,2,.3,8],[-11,1,12,.3],[12,0,12,.3]],
      points:[[0,12],[-10,-7],[15,-11],[0,-5],[9,-8],[10,11],[14,-5],[-14,-11],[0,2],[8,5]],
      furniture:[['desk',-13,8,1.2],['desk',-13,-3,1.2],['desk',-8,-11,1.2],['bookcaseOpen',16,8,2.4]],
      characters:['technician','zhouran','studentA']
    },
    gate: {
      concept:'U 形维修工作台 · 后场零件库', accent:'#bca269', floor:'#d2d5d0',
      areas:[[-11,-7,12,12],[10,7,14,11],[-10,7,14,11],[8,-8,17,9]],
      walls:[[-3,-10,.35,8],[-3,1,.35,8],[-13,1,8,.3],[11,0,12,.3],[5,-7,10,.3]],
      points:[[0,12],[9,8],[14,-11],[-9,-8],[-10,8],[15,-4],[-14,-4],[-14,5],[-6,5],[5,5]],
      furniture:[['desk',-15,10,1.2],['desk',-10,11,1.2],['desk',-6,11,1.2],['bookcaseOpen',16,-10,2.4],['loungeSofa',14,10,1.2]],
      characters:['shopkeeper','technician','studentB']
    },
    plaza: {
      concept:'隔音演播室 · 玻璃会议厅', accent:'#b58fa7', floor:'#d7d5dc',
      areas:[[-11,-7,12,12],[10,6,14,13],[-10,7,14,11],[10,-8,14,10]],
      walls:[[-4,-11,.3,6],[-4,-2,.3,5],[-11,0,14,.3],[4,-10,.3,8],[12,-2,12,.3],[4,6,.3,8]],
      points:[[0,12],[10,-8],[-15,10],[11,5],[-10,7],[15,-5],[-9,-5],[-14,-10],[-6,-10],[10,10]],
      furniture:[['loungeSofa',-14,3,1.2],['tableRound',-8,4,1.1],['bookcaseOpen',16,-11,2.5],['desk',-14,-4,1.1],['tableRound',13,1,1.2]],
      characters:['archivist','studentB','photographer']
    }
  };
  const suffixes=['exit','npc','stamp','student','researcher','chest','pc','note','puzzle','task'];
  function layout(zone){return plans[zone]||null;}
  function positions(zone){const p=layout(zone);return Object.fromEntries(suffixes.map((id,i)=>[zone+'-'+id,p.points[i]]));}
  function build(zone){
    const p=layout(zone),r=Exploration.regions[zone],root=new THREE.Group(),colliders=[],batches=new Map(),matrix=new THREE.Object3D();
    root.name='Interior_'+zone;root.userData.concept=p.concept;
    const part=(w,h,d,color,x,y,z)=>{if(!batches.has(color))batches.set(color,[]);matrix.position.set(x,y,z);matrix.scale.set(w,h,d);matrix.rotation.set(0,0,0);matrix.updateMatrix();batches.get(color).push(matrix.matrix.clone());};
    const solid=(x,z,w,d)=>colliders.push({x,z,w:w/2+.28,d:d/2+.28});
    const wall=(x,z,w,d,h=1.2)=>{part(w,h,d,'#e0e5e3',x,h/2+.2,z);part(w,.1,d+.04,p.accent,x,h+.25,z);solid(x,z,w,d);};
    part(37,.6,29,'#768a8d',0,-.16,0);part(36,.12,28,p.floor,0,.14,0);
    wall(-18,0,.3,28,2.7);wall(18,0,.3,28,2.7);wall(0,-14,36,.3,2.7);wall(-10,14,16,.3);wall(10,14,16,.3);
    for(const values of p.walls)wall(...values);
    for(let i=0;i<p.areas.length;i++){
      const [x,z,w,d]=p.areas[i];part(w,.015,d,['#c5d6cd','#c2d0e0','#dbd5ca','#d4cddd'][i],x,.21,z);
      for(let px=x-w/2+.5;px<x+w/2;px+=1.4)part(.025,.01,d-.1,'#aebbbd',px,.224,z);
      WorldArt.label(root,r.rooms[i],x,.45,z+d/2-1,'#f1f7f4',6.3);
    }
    for(const x of[-14,-6,6,14]){part(3.6,1.3,.07,'#90bbc9',x,1.8,-13.8);part(3.7,.1,.4,'#f5f6eb',x,1.12,-13.6);part(.07,1.3,.1,'#e6eeee',x,1.8,-13.7);}
    const height=(x,z)=>zone==='hall'&&x<5&&z>-6&&z<5? .22+Math.max(0,Math.floor((z+6)/3)+1)*.14:.22;
    const objects=Exploration.objects(zone);
    const prop=(name,x,z,h,rot=0)=>{
      const a=WorldArt.asset(root,name,x,height(x,z),z,h,rot);const bounds=new THREE.Box3().setFromObject(a),size=bounds.getSize(new THREE.Vector3());
      // Never silently place set dressing over an authored interaction or doorway.
      if(objects.some(o=>Math.abs(o.x-x)<size.x/2+1.2&&Math.abs(o.z-z)<size.z/2+1.2)){root.remove(a);return;}
      colliders.push({x,z,w:size.x/2+.25,d:size.z/2+.25});
    };
    for(const values of p.furniture)prop(...values);
    for(const x of[-16.4,16.4])prop('pottedPlant',x,12,1.35);
    if(zone==='hall'){
      part(14,1.8,.12,'#38695f',-7,2,-13.5);
      for(let row=0;row<3;row++){
        const z=-4.5+row*3;part(21,.14*(row+1),2.9,'#b4b8c2',-6,.22+.07*(row+1),z);
        for(const x of[-14,-9,-4,1]){prop('desk',x,z,1);prop('chairDesk',x,z+1.05,.95);}
      }
      for(let i=0;i<3;i++){part(1,1.2,.7,'#829799',-14+i*4,.8,11.5);part(.8,.6,.4,['#c17f83','#82aeb1','#d8bf81'][i],-14+i*4,1.65,11.5);}
    }
    if(zone==='library'){
      part(9,.45,8,'#879e91',0,.25,-3);part(8.6,.06,7.6,'#5f876a',0,.51,-3);
      for(const [x,z,h]of[[-2,-4,4],[2,-2,3.2],[0,-5,2.8]])WorldArt.asset(root,'tree_oak',x,.55,z,h);
      for(const x of[-3,3])for(const z of[-6,0])WorldArt.asset(root,'plant_bushDetailed',x,.55,z,1);
      for(const z of[-10,-4,2])prop('bookcaseOpen',-13,z,2.1,Math.PI/2);
    }
    if(zone==='lake'){
      part(14,.04,3.6,'#70b5c7',-9,.235,-.1);for(let i=0;i<6;i++)part(12,.01,.04,'#b5e0e5',-9,.265,-1.5+i*.55);
      for(let i=0;i<4;i++)part(.22,1.8,.25,'#648494',-16+i*3,.9,-12.8);
      part(.16,2.6,.18,'#e9eee8',15,1.5,-6);for(let i=0;i<8;i++)part(.4,.035,.19,i%2?'#ba7377':'#526d82',15, .5+i*.25,-6);
      for(const x of[-15,-12,-9])part(.7,.8,.7,'#98b0ac',x,.65,11.5);
    }
    if(zone==='gym'){
      part(21,.02,16,'#94b9ad',-5,.24,-3);
      for(const x of[-15.3,5.3])part(.08,.012,15.4,'#f4f1df',x,.26,-3);
      for(const z of[-10.7,4.7])part(20.6,.012,.08,'#f4f1df',-5,.26,z);
      part(20.6,.012,.08,'#f4f1df',-5,.26,-3);
      const ring=new THREE.Mesh(new THREE.RingGeometry(2.35,2.42,48),new THREE.MeshBasicMaterial({color:'#f4f1df',side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(-5,.27,-3);root.add(ring);
      for(const x of[-15,5]){part(.12,3.7,.12,'#698391',x,2,-3);part(.15,1,2,'#f0f3ea',x,3.5,-3);}
      for(let i=0;i<5;i++){part(1.15,2.3,.7,i%2?'#86a5b2':'#b7939f',8+i*1.6,1.4,12);part(.06,.4,.08,'#e9eeee',8.3+i*1.6,1.4,12.4);}
    }
    if(zone==='lab'){
      for(let i=0;i<5;i++){const x=7+i*2;part(1.3,2.5,1,'#4b626f',x,1.5,-12.3);solid(x,-12.3,1.3,1);for(let j=0;j<6;j++)part(.8,.08,.04,j%2?'#75cabe':'#9abce3',x,.55+j*.35,-11.76);}
      for(const x of[-14,-10]){part(.7,.7,.7,'#a2bfc3',x,1.8,-3);part(.3,.3,.3,'#6ebfca',x,2.25,-3);}
      for(let i=0;i<4;i++)part(.18,.025,1.4,'#c7ad61',-.8+i*.55,.24,7);
    }
    if(zone==='gate'){
      for(let i=0;i<6;i++){part(1.2,1.7,.65,'#76929a',-16.4,1.1,-11+i*1.8);for(let j=0;j<3;j++)part(.9,.03,.7,'#d0ded9',-16.4,.65+j*.5,-11+i*1.8);}
      part(6.5,1,.9,'#8da9a3',10,.7,3);solid(10,3,6.5,.9);
      for(let i=0;i<8;i++){part(.35,.12,.35,i%2?'#c8ad78':'#657f98',-15+i*1.2,1.48,10);}
      part(3,1.6,.14,'#667e83',-10,2.2,13.7);for(let i=0;i<5;i++)part(.12,.65,.18,'#dfc285',-11+i*.5,2.2,13.5);
    }
    if(zone==='plaza'){
      for(let i=0;i<6;i++)part(1.3,1.3,.15,i%2?'#74899a':'#a28698',-15+i*1.6,1.9,-13.7);
      part(6,.8,1.2,'#657e8b',-10,.65,-12);for(let i=0;i<7;i++)part(.32,.05,.3,'#94cbc4',-12+i*.65,1.1,-12);
      for(const x of[7,16])prop('chairDesk',x,5,1.2,Math.PI/2);
      part(.12,1.1,6,'#abcdd3',4,1.9,5);part(.2,.08,6,'#e6eeee',4,2.49,5);
    }
    const geometry=new THREE.BoxGeometry(1,1,1);
    for(const [color,transforms]of batches){const mesh=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.85}),transforms.length);transforms.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;root.add(mesh);}
    const visuals=WorldArt.interactables(root,objects);for(const o of objects)visuals[o.id].position.y=height(o.x,o.z)-.22;
    return {root,colliders,visuals,height,spawn:[0,12],concept:p.concept};
  }
  return {layout,positions,build};
})();
