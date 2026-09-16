'use strict';
globalThis.CampusRooms = (() => {
  const locations={
    bookshop:{name:'南门旧书局',character:'archivist',floors:['旧书与文具','二手书档案阁'],wares:['notes','pendant'],activity:'bargain'},
    cafe:{name:'雨巷咖啡馆',character:'studentB',floors:['咖啡与庭院','露台小剧场'],wares:['coffee']},
    grocery:{name:'榕树便利店',character:'shopkeeper',floors:['食品与日用'],wares:['coffee','notes'],activity:'supply'},
    arcade:{name:'像素游戏厅',character:'suqi',floors:['街机与信号挑战'],game:'memory'},
    clinic:{name:'青禾社区诊所',character:'technician',floors:['候诊与诊疗'],wares:['coffee','wrist']},
    studio:{name:'回声照相馆',character:'photographer',floors:['摄影与冲印','天台创作室'],wares:['chip']},
    museum:{name:'砚池校史馆',character:'keeper',floors:['校史与荷院','古籍修复室','观景与研究阁'],wares:['pendant']}
  };
  const upper={dorm:['生活与公共空间','东廊寝室与晒台'],hall:['阶梯教室与办公室','研讨室与教师廊','钟楼观测室'],library:['阅览与资料','专业书库与自习','特藏与修复']};
  const stories={
    bookshop:['旧书局的主人在书脊里发现一张底片，上面是还没建成的钟楼。','阁楼书架按年份排列。最深处那一本的借阅人，是你。'],
    cafe:['老板每天为同一个缺席的客人留一张靠窗桌。咖啡可以恢复算力。','小剧场的节目单多出一场明晚的演出，演员栏只有一个空白。'],
    grocery:['后门小巷通向照相馆。店主说，雨天总有人来问一卷过期胶卷。'],
    arcade:['旧街机仍在运行。完成宿舍的觉醒剧情后，可以启动信号复原挑战。'],
    clinic:['值班登记里，你的名字被写在明天。护腕可以在战斗中减少受到的伤害。'],
    studio:['冲印机里留着校园的另一种布局。摄影师建议你去荷院看一看。','露台上挂着几张空白相纸，只有逆着光，才看得见另一个人的轮廓。'],
    museum:['展柜记录了这座校园从书院到大学的变化。馆后有条通往河岸的石径。','修复师发现同一页校刊被改写过三次，墨迹却都来自同一天。','研究阁窗外的荷池，与楼下模型中的位置并不一致。'],
    dorm:['','墙上的寝室合照里，多了一位谁也记不起来的室友。'],
    hall:['','研讨室的排课表出现了一门没有老师的课程：时间观测。','观测日志：当钟楼的影子与荷池短桥相交时，信号最清晰。'],
    library:['','自习区的一本书总会自己回到第三排。扉页夹着一张前往旧书局的收据。','特藏室只保留原稿。这里的时钟，比校园钟楼慢了整整一天。']
  };
  const floorNames=id=>locations[id]?.floors||upper[id]||['一层'];
  const count=id=>floorNames(id).length;
  const name=id=>locations[id]?.name||globalThis.Exploration?.regions[id]?.name||id;
  const title=(id,floor)=>`${name(id)} · ${floor}F · ${floorNames(id)[floor-1]}`;
  const valid=(id,floor)=>Number.isInteger(floor)&&floor>=1&&floor<=count(id)&&(!!locations[id]||!!globalThis.Exploration?.regions[id]);
  const stair=(zone,floor,to,x,z)=>({id:`${zone}-f${floor}-stairs-${to}`,type:'stairs',name:`${to>floor?'上':'下'}楼 · ${to}F ${floorNames(zone)[to-1]}`,zone,floor,to,x,z});
  function objects(zone,floor=1){
    if(!valid(zone,floor))return [];
    // The pre-existing interiors keep their own plans, so a floor-1 stair has to clear
    // those walls. (0,7) sat inside the hall plan's [1,7,6,.3] wall, which made
    // hall-f1-stairs-2 unreachable; (0,5) is open in the dorm, hall and library plans
    // and clear of both the spawn at z=10.5 and the old exit at z=12.
    if(!locations[zone]&&floor===1)return count(zone)>1?[stair(zone,1,2,0,5)]:[];
    const text=stories[zone]?.[floor-1]||'窗外的树影缓慢移动，这一层暂时安静。',info=locations[zone];
    return [
      ...(floor===1?[{id:zone+'-exit',type:'exit',name:'回到街区',x:0,z:12,zone,floor}]:[stair(zone,floor,floor-1,0,11)]),
      ...(floor<count(zone)?[stair(zone,floor,floor+1,5,10)]:[]),
      {id:`${zone}-f${floor}-npc`,type:'npc',name:info?({bookshop:'旧书店主',cafe:'咖啡师夏禾',grocery:'便利店老板',arcade:'街机社社员',clinic:'值班医生',studio:'摄影师',museum:'校史研究员'}[zone]):({dorm:'二楼宿管',hall:floor===3?'观测社社长':'研讨助教',library:floor===3?'古籍修复师':'研究生学姐'}[zone]),character:info?.character||({dorm:'keeper',hall:'zhouran',library:'archivist'}[zone]),x:-8,z:1,zone,floor,text},
      {id:`${zone}-f${floor}-note`,type:'note',name:floorNames(zone)[floor-1]+' · 记录',x:11,z:-8,zone,floor,text},
      {id:`${zone}-f${floor}-chest`,type:'chest',name:floor===1?'角落里的补给匣':'楼层收藏箱',x:-12,z:-10,zone,floor,cash:45+floor*25,xp:10+floor*5},
      ...(floor===1&&info?.wares?[{id:zone+'-shop',type:'shop',name:'柜台 · '+info.name,zone,floor,x:8,z:3,wares:info.wares,activity:info.activity,text:'柜台营业中。请选择需要的物品。'}]:[]),
      ...(zone==='arcade'?[{id:'arcade-terminal',type:'pc',name:'信号街机',zone,floor,x:8,z:3,game:'memory'}]:[])
    ];
  }
  const allObjects=()=>[...Object.keys(locations),...Object.keys(upper)].flatMap(id=>floorNames(id).flatMap((_,i)=>objects(id,i+1)));
  const historical={opened:[],talked:[],visited:[]};
  // Stable names are kept here separately from scene construction for save compatibility.
  for(const [id,total]of Object.entries({bookshop:2,cafe:2,grocery:1,arcade:1,clinic:1,studio:2,museum:3,dorm:2,hall:3,library:3})){
    if(locations[id])historical.visited.push(id);
    for(let f=locations[id]?1:2;f<=total;f++){historical.opened.push(`${id}-f${f}-chest`);historical.talked.push(`${id}-f${f}-npc`,`${id}-f${f}-note`);}
  }
  function build(zone,floor){
    if(!valid(zone,floor)||(!locations[zone]&&floor===1))return null;
    const root=new THREE.Group(),colliders=[],batches=new Map(),matrix=new THREE.Object3D(),interactive=objects(zone,floor);
    root.name=`Interior_${zone}_${floor}`;
    const palette={bookshop:['#7a8792','#9a6873'],cafe:['#94b7a9','#d29288'],grocery:['#b4c3b7','#6f96a6'],arcade:['#68768d','#c590ad'],clinic:['#c0d9d4','#779dad'],studio:['#8497a5','#bb8f9b'],museum:['#c4c6b8','#ad7474'],dorm:['#bbcdc2','#789a9d'],hall:['#c2c9d0','#ae7985'],library:['#aebdc4','#779690']}[zone];
    function box(w,h,d,color,x,y,z,block=false){
      if(!batches.has(color))batches.set(color,[]);matrix.position.set(x,y,z);matrix.rotation.set(0,0,0);matrix.scale.set(w,h,d);matrix.updateMatrix();batches.get(color).push(matrix.matrix.clone());
      if(block)colliders.push({x,z,w:w/2+.28,d:d/2+.28});
    }
    const wall=(x,z,w,d)=>{box(w,1.15,d,palette[1],x,.78,z,true);box(w,.08,d+.06,'#edf1e8',x,1.4,z);};
    const safe=(x,z,w,d)=>!(Math.abs(x)<7&&z>7)&&!interactive.some(o=>Math.abs(o.x-x)<w/2+1.25&&Math.abs(o.z-z)<d/2+1.25);
    const prop=(asset,x,z,h=1,rotation=0)=>{
      const g=WorldArt.asset(root,asset,x,.22,z,h,rotation),size=new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
      if(!safe(x,z,size.x,size.z)){root.remove(g);return;}
      colliders.push({x,z,w:size.x/2+.23,d:size.z/2+.23});
    };
    box(37,.5,29,'#6a7d82',0,-.12,0);box(36,.12,28,palette[0],0,.15,0);
    wall(-18,0,.3,28);wall(18,0,.3,28);wall(0,-14,36,.3);wall(-10,14,16,.3);wall(10,14,16,.3);
    for(let x=-17;x<18;x+=1.5)box(.025,.015,27,'#819995',x,.225,0);
    for(const x of[-13,-5,5,13]){box(3,1.2,.07,'#85b3c4',x,2,-13.75);box(.08,1.2,.1,'#e5ede6',x,2,-13.65);}
    const sign=(text,x,z)=>WorldArt.label(root,text,x,.6,z,'#ecf1e6',6.8);
    if(zone==='dorm'){
      wall(-3,-9,.3,9);wall(-3,4,.3,10);wall(3,-9,.3,9);wall(3,4,.3,10);
      for(const x of[-14,-7,7,14])prop('bedBunk',x,-5,2.6);for(const x of[-12,12])prop('desk',x,5,1.1);
      prop('loungeSofa',10,11,1.2);sign('205 / 206 寝室',-10,-2);sign('夜读与晒台',10,8);
    }else if(zone==='hall'&&floor===2){
      for(const x of[-6,6]){wall(x,-9,.3,9);wall(x,4,.3,8);}wall(-12,2,12,.3);
      for(const x of[-12,0,12])for(const z of[-4,5]){prop('desk',x,z,1.2);prop('chairDesk',x,z+1.5,1.1);}
      sign('教师廊',0,-9);sign('小组研讨室',11,7);prop('bookcaseOpen',-16,6,2.8);
    }else if(zone==='hall'){
      box(13,.18,12,'#65868f',0,.25,-3);for(const x of[-4,4]){box(.2,1.5,.2,'#556573',x,1.1,-4);box(1.7,.5,.55,'#d2d6c3',x,2,-4);}
      wall(-10,5,14,.3);prop('desk',-12,0,1.2);prop('computerScreen',-12,0,.8);sign('天枢信号观测台',0,-10);sign('钟楼研究阁',11,6);
    }else if(zone==='library'||zone==='bookshop'){
      if(floor===3){wall(0,-8,.3,10);wall(0,4,.3,8);for(const x of[-12,-6,7,14])prop('bookcaseOpen',x,-4,2.6);prop('desk',9,4,1.2);sign('特藏书库',-10,6);sign('文献修复台',9,7);}
      else {for(const x of[-15,-5,5,15])for(const z of[-5,3])prop('bookcaseOpen',x,z,2.5,Math.PI/2);for(const x of[-10,10])prop('tableRound',x,8,1.1);sign(floor===1?'旧书与文具':'专业书架',0,-10);sign('窗边自习区',-10,11);}
    }else if(zone==='cafe'){
      if(floor===1){box(10,1,1.5,'#568c83',0,.72,-10,true);prop('kitchenCoffeeMachine',-2,-10,1);for(const x of[-12,-4,4,12])for(const z of[-4,6]){prop('tableRound',x,z,1.15);prop('chairDesk',x+1.8,z,1,Math.PI/2);}sign('点单与手冲',0,-7);sign('雨巷庭院',-10,10);}
      else {box(18,.35,6,'#90788c',0,.38,-10);for(const x of[-12,-5,2,9])prop('loungeSofa',x,1,1.3);prop('tableRound',12,7,1);sign('露台小剧场',0,-6);}
    }else if(zone==='grocery'){
      for(const x of[-14,-5,4,13])for(const z of[-5,3]){if(safe(x,z,2,3)){box(2,1.7,3,'#829b9a',x,1.05,z,true);for(let i=0;i<5;i++)box(1.8,.16,.3,['#be777b','#85ae94','#d4b366'][i%3],x,.5+i*.3,z+1.55);}}
      sign('食品 / 日用 / 文具',0,-11);
    }else if(zone==='arcade'){
      for(const x of[-14,-6,2,12])for(const z of[-5,4])if(safe(x,z,1.6,1.3)){box(1.5,1.9,1.2,'#344a64',x,1.2,z,true);box(1.1,.8,.04,['#6ac7ba','#ce90af','#d6b56c'][Math.abs(x)%3],x,1.6,z+.63);box(1,.08,.5,'#99adba',x,.9,z+.6);}
      sign('信号街机 / 挑战区',0,-10);
    }else if(zone==='clinic'){
      wall(3,-9,.3,9);wall(3,4,.3,8);wall(11,-1,14,.3);prop('loungeSofa',-13,5,1.3);prop('loungeSofa',-5,5,1.3);prop('desk',-3,-8,1.1);
      for(const z of[-4,4]){box(3,.7,1.5,'#e0e7dc',11,.65,z,true);box(.7,.2,1.3,'#7eafb0',12,1.1,z);}sign('候诊区',-9,9);sign('诊疗 / 处置',10,8);
    }else if(zone==='studio'){
      if(floor===1){wall(4,-9,.3,10);wall(4,5,.3,6);box(8,3,.12,'#9eaebc',-6,1.7,-9);for(const x of[-13,1]){box(.12,2.3,.12,'#485e70',x,1.35,-6);box(.8,1,.25,'#e8e4cc',x,2.5,-6);}prop('desk',11,3,1.2);sign('拍摄棚',-7,5);sign('冲印暗房',12,7);}
      else{for(const x of[-14,-5,5,14])prop('pottedPlant',x,-11,2.3);prop('loungeSofa',-12,5,1.3);prop('desk',10,4,1.2);for(const x of[-7,0,7])box(2.5,1.8,.13,'#d5c6bb',x,1.6,-5);sign('露台画架与创作',0,-9);}
    }else if(zone==='museum'){
      if(floor===1){for(const x of[-10,0,10])for(const z of[-5,5])if(safe(x,z,2.7,2.7)){box(2.6,1,2.6,'#879ca0',x,.7,z,true);box(1.4,.9,1.4,'#b18484',x,1.65,z);}sign('校园变迁模型',0,-10);}
      else if(floor===2){wall(0,-8,.3,10);wall(0,5,.3,6);for(const x of[-15,-6])prop('bookcaseOpen',x,-4,2.8);for(const z of[-5,5])prop('desk',9,z,1.2);sign('档案库',-10,6);sign('修复工作室',9,8);}
      else{box(18,.16,12,'#769c80',0,.25,-4);for(const x of[-6,0,6])prop('pottedPlant',x,-7,2.2);prop('loungeSofa',-12,5,1.2);prop('tableRound',11,4,1.1);sign('砚池观景阁',0,-10);}
    }
    for(const x of[-16,16])prop('pottedPlant',x,11,1.3);
    const geo=new THREE.BoxGeometry(1,1,1);
    for(const [color,transforms]of batches){const mesh=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({color,roughness:.82}),transforms.length);transforms.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;root.add(mesh);}
    const visuals=WorldArt.interactables(root,interactive);
    return {root,colliders,visuals,height:()=>.22,spawn:[0,8],concept:title(zone,floor)};
  }
  return {locations,count,name,title,valid,objects,allObjects,historical,build};
})();
