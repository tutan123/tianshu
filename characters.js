/* Original low-poly campus cast. All figures face +Z, with feet at Y=0. */
globalThis.Characters = (() => {
  const profiles = {
    chenxu: {name:'\u9648\u65ed',role:'\u91cd\u751f\u8005 \u00b7 \u5929\u67a2\u5bbf\u4e3b',outfit:'hoodie',hair:'swept',accessory:'backpack',shirt:'#527f79',pants:'#283846',skin:'#dfb194',hairColor:'#272b31',height:1},
    suqi: {name:'\u82cf\u7941',role:'\u5ba4\u53cb \u00b7 \u6280\u672f\u642d\u6863',outfit:'overshirt',hair:'messy',accessory:'headphones',shirt:'#c18351',pants:'#354653',skin:'#e6bb98',hairColor:'#373034',height:.99},
    guqinghe: {name:'\u987e\u6e05\u6cb3',role:'\u8ba1\u7b97\u673a\u5b66\u9662\u6559\u6388',outfit:'blazer',hair:'parted',accessory:'glasses',shirt:'#626878',pants:'#343841',skin:'#d2a689',hairColor:'#6c6b67',height:1.05},
    linwan: {name:'\u6797\u665a',role:'\u7ecf\u7ba1\u7cfb\u65b0\u751f',outfit:'cardigan',hair:'bob',accessory:'book',shirt:'#c47991',pants:'#46575a',skin:'#e5ba9e',hairColor:'#493633',height:.97},
    zhouran: {name:'\u5468\u7136',role:'\u5b9e\u9a8c\u5ba4\u7814\u7a76\u52a9\u7406',outfit:'labcoat',hair:'ponytail',accessory:'goggles',shirt:'#e5eeea',pants:'#426576',skin:'#cda287',hairColor:'#302c2f',height:1.02},
    captain: {name:'\u6821\u961f\u961f\u957f',role:'\u4f53\u80b2\u9986 \u00b7 \u8bad\u7ec3\u6307\u5bfc',outfit:'jersey',hair:'crop',accessory:'whistle',shirt:'#b94f52',pants:'#444956',skin:'#b98868',hairColor:'#28262a',height:1.06},
    keeper: {name:'\u8239\u5c4b\u770b\u62a4\u4eba',role:'\u955c\u6e56 \u00b7 \u8239\u5c4b\u7ba1\u7406',outfit:'vest',hair:'crop',accessory:'sunhat',shirt:'#819b73',pants:'#4f5751',skin:'#c39575',hairColor:'#87877d',height:.98},
    technician: {name:'\u7ef4\u4fee\u6280\u5e08',role:'\u7ef4\u4fee\u5de5\u574a \u00b7 \u8bbe\u5907\u8c03\u8bd5',outfit:'coverall',hair:'crop',accessory:'toolbelt',shirt:'#4b8198',pants:'#476876',skin:'#d2a07a',hairColor:'#363334',height:1.01},
    shopkeeper: {name:'\u540e\u8857\u5e97\u4e3b',role:'\u6821\u56ed\u8865\u7ed9\u5546\u5e97',outfit:'apron',hair:'bun',accessory:'keys',shirt:'#dfb65b',pants:'#3f5258',skin:'#deb096',hairColor:'#56413b',height:.96},
    archivist: {name:'\u6821\u53f2\u6863\u6848\u5458',role:'\u5b66\u751f\u4f1a \u00b7 \u6821\u53f2\u6574\u7406',outfit:'waistcoat',hair:'braid',accessory:'glassesBook',shirt:'#857392',pants:'#484455',skin:'#d9ac91',hairColor:'#3a3030',height:1},
    photographer: {name:'\u6821\u62a5\u6444\u5f71\u5e08',role:'\u5b66\u751f\u4e2d\u5fc3 \u00b7 \u6821\u62a5\u8bb0\u5f55',outfit:'fieldjacket',hair:'curly',accessory:'camera',shirt:'#748264',pants:'#504b57',skin:'#bb896a',hairColor:'#292729',height:1.02},
    studentA: {name:'\u65b0\u751f\u540c\u5b66',role:'\u6c5f\u57ce\u5927\u5b66\u65b0\u751f',outfit:'tee',hair:'fringe',accessory:'satchel',shirt:'#6596bc',pants:'#d7c8ad',skin:'#e7bca2',hairColor:'#40322c',height:.98},
    studentB: {name:'\u793e\u56e2\u540c\u5b66',role:'\u6821\u56ed\u793e\u56e2\u5fd7\u613f\u8005',outfit:'skirt',hair:'twintail',accessory:'beret',shirt:'#eee2c9',pants:'#709480',skin:'#cb9c81',hairColor:'#754c39',height:.95}
  };
  Object.keys(profiles).forEach(id => { profiles[id] = Object.freeze({id,...profiles[id]}); });
  Object.freeze(profiles);
  const geometries = new Map(), materials = new Map();
  let portraitRenderer, portraitScene, portraitCamera, portraitFailed = false;
  const portraits = new Map(), portraitActors = new Map();

  function geometry(kind) {
    if (!geometries.has(kind)) {
      const T = globalThis.THREE;
      const g = kind === 'sphere' ? new T.SphereGeometry(1,12,8)
        : kind === 'cap' ? new T.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI/2)
        : kind === 'cylinder' ? new T.CylinderGeometry(1,1,1,12)
        : kind === 'skirt' ? new T.CylinderGeometry(.67,1,1,10)
        : kind === 'torus' ? new T.TorusGeometry(1,.16,5,12)
        : new T.BoxGeometry(1,1,1);
      geometries.set(kind,g);
    }
    return geometries.get(kind);
  }
  function material(color) {
    if (!materials.has(color)) {
      const linear=new THREE.Color(color);
      // Portraits may be opened before the campus enables modern color management.
      if(THREE.ColorManagement.legacyMode)linear.convertSRGBToLinear();
      materials.set(color,new THREE.MeshStandardMaterial({color:linear,roughness:.85,metalness:0}));
    }
    return materials.get(color);
  }
  function part(root,name,kind,color,x,y,z,sx,sy,sz) {
    const m = new THREE.Mesh(geometry(kind),material(color));
    m.name = name; m.position.set(x,y,z); m.scale.set(sx,sy,sz);
    m.castShadow = true; m.receiveShadow = true; root.add(m); return m;
  }
  function box(root,name,color,x,y,z,w,h,d) { return part(root,name,'box',color,x,y,z,w,h,d); }
  function ball(root,name,color,x,y,z,w,h,d) { return part(root,name,'sphere',color,x,y,z,w,h,d); }
  function group(root,name) {const g=new THREE.Group();g.name=name;root.add(g);return g;}
  function glasses(root,y=1.75,color='#333d48') {
    for(const x of [-.105,.105]) part(root,'spectacle-frame','torus',color,x,y,.241,.087,.071,.08);
    box(root,'spectacle-bridge',color,0,y,.25,.046,.018,.023);
    for(const x of [-.23,.23]) box(root,'spectacle-arm',color,x,y,.12,.017,.022,.23);
  }
  function book(root,x=.36,y=1.1,color='#4f7b79') {
    const b=group(root,'bound-book');b.position.set(x,y,.12);b.rotation.z=-.12;
    box(b,'pages','#e8e3d5',0,0,0,.16,.33,.27);
    for(const dx of [-.095,.095])box(b,'book-cover',color,dx,0,0,.025,.36,.29);
    box(b,'book-spine',color,0,0,-.14,.21,.36,.025);
  }
  function hair(root,p) {
    const c=p.hairColor;
    part(root,'hair-crown','cap',c,0,1.75,-.018,.269,.27,.247);
    if (['bob','braid','twintail','ponytail','bun'].includes(p.hair)) {
      box(root,'hair-back',c,0,1.65,-.19,.46,.39,.14);
      for(const x of [-.235,.235])ball(root,'side-lock',c,x,1.67,0,.07,.22,.15);
    }
    if(p.hair==='bob')box(root,'bob-hem',c,0,1.49,-.17,.48,.09,.18);
    if(p.hair==='ponytail') {
      ball(root,'ponytail',c,0,1.66,-.37,.12,.3,.14);
      box(root,'hair-tie','#b87561',0,1.83,-.3,.15,.055,.06);
    }
    if(p.hair==='bun')ball(root,'hair-bun',c,0,1.99,-.13,.13,.11,.13);
    if(p.hair==='braid')for(let i=0;i<4;i++)ball(root,'braid',c,-.2,1.5-i*.095,-.22,.066,.068,.08);
    if(p.hair==='twintail')for(const x of [-.3,.3]) {
      ball(root,'twin-tail',c,x,1.57,-.12,.08,.25,.1);
      box(root,'ribbon','#c77478',x,1.76,-.07,.16,.045,.07);
    }
    if(p.hair==='curly')for(let i=0;i<7;i++){const a=i*Math.PI*2/7;ball(root,'curl',c,Math.sin(a)*.2,1.9+Math.cos(a)*.04,Math.cos(a)*.17,.1,.105,.105);}
    if(p.hair==='messy')for(let i=0;i<3;i++){const tuft=box(root,'hair-tuft',c,-.16+i*.14,1.98,.005,.15,.12,.21);tuft.rotation.z=-.3+i*.22;}
    if(p.hair==='crop')box(root,'cropped-fringe',c,0,1.89,.185,.4,.07,.06);
    else if(p.hair==='parted') {
      const fringe=box(root,'side-part',c,-.09,1.88,.19,.26,.13,.085);fringe.rotation.z=.18;
      for(const x of [-.24,.24])box(root,'silver-temple','#a5a49a',x,1.77,.07,.04,.14,.13);
    } else {
      const fringe=box(root,'fringe',c,.025,1.86,.205,.37,.14,.095);fringe.rotation.z=p.hair==='swept'?-.19:.06;
    }
  }
  function clothes(root,p) {
    const c=p.shirt,white='#e8e6db';
    box(root,'torso',c,0,1.19,0,.57,.68,.34);
    if(p.outfit==='hoodie') {
      part(root,'hood','torus',c,0,1.48,-.04,.25,.2,.19).rotation.x=Math.PI/2;
      box(root,'hood-pocket','#3c6867',0,1.06,.184,.33,.15,.045);
      for(const x of [-.08,.08])box(root,'drawstring',white,x,1.37,.19,.018,.19,.018);
    } else if(['blazer','labcoat','cardigan','fieldjacket','overshirt','vest','waistcoat'].includes(p.outfit)) {
      box(root,'inner-shirt',white,0,1.25,.177,.26,.53,.022);
      for(const x of [-.17,.17]) {
        const lapel=box(root,'lapel',c,x,1.37,.211,.13,.29,.045);lapel.rotation.z=x<0?-.23:.23;
      }
      if(p.outfit==='labcoat')for(const x of [-.17,.17]) {
        box(root,'coat-tail',c,x,.78,0,.3,.38,.38);
        box(root,'coat-pocket','#d1dedb',x,1.04,.204,.14,.15,.045);
      }
      if(p.outfit==='blazer'||p.outfit==='waistcoat')box(root,'tie',p.outfit==='blazer'?'#b2786a':'#d5b36b',0,1.32,.204,.055,.31,.032);
      if(p.outfit==='overshirt')for(const x of [-.18,.18])box(root,'shirt-pocket','#ab6c43',x,1.32,.202,.13,.13,.028);
      if(p.outfit==='fieldjacket')for(const x of [-.17,.17])box(root,'field-pocket','#5c6e57',x,1.05,.211,.15,.17,.065);
      for(let i=0;i<3;i++)box(root,'button','#c8c6b7',.02,1.06+i*.11,.21,.025,.025,.018);
    } else if(p.outfit==='jersey') {
      for(const x of [-.245,.245])box(root,'jersey-stripe',white,x,1.22,.18,.045,.58,.022);
      box(root,'team-number',white,0,1.28,.19,.08,.23,.025);
      box(root,'headband',white,0,1.9,.175,.43,.055,.09);
    } else if(p.outfit==='coverall') {
      box(root,'zipper','#bdd1cd',0,1.22,.19,.025,.6,.025);
      for(const x of [-.17,.17])box(root,'work-pocket','#365b6c',x,1.3,.19,.15,.13,.04);
      box(root,'knee-patch','#2e424a',-.16,.37,.12,.2,.2,.045);
    } else if(p.outfit==='apron') {
      box(root,'apron-bib','#507b75',0,1.22,.191,.36,.55,.07);
      box(root,'apron-skirt','#507b75',0,.85,.19,.55,.36,.08);
      box(root,'apron-pocket','#71948a',0,1.01,.243,.25,.15,.035);
      for(const x of [-.17,.17])box(root,'apron-strap','#507b75',x,1.48,0,.055,.09,.41);
    } else if(p.outfit==='skirt') {
      part(root,'pleated-skirt','skirt',p.pants,0,.78,0,.39,.38,.28);
      box(root,'collar','#a95365',0,1.47,.18,.15,.1,.05);
    } else if(p.outfit==='tee')box(root,'tee-emblem','#e6d480',-.11,1.32,.184,.15,.12,.02);
  }
  function accessory(root,p) {
    const kind=p.accessory;
    if(kind==='glasses'||kind==='glassesBook')glasses(root);
    if(kind==='book'||kind==='glassesBook')book(root,.4,1.07,kind==='book'?'#416978':'#a58251');
    if(kind==='backpack') {
      box(root,'backpack','#c2a86f',0,1.2,-.3,.45,.53,.23);
      box(root,'backpack-pocket','#978b5f',0,1.1,-.435,.33,.23,.055);
      for(const x of [-.2,.2])box(root,'backpack-strap','#b6a271',x,1.25,.193,.057,.51,.05);
    }
    if(kind==='headphones') {
      for(const x of [-.3,.3])box(root,'headphone-earcup','#364a55',x,1.68,0,.1,.22,.17);
      part(root,'headphone-band','torus','#364a55',0,1.77,0,.3,.3,.07);
    }
    if(kind==='goggles') {
      glasses(root,1.86,'#729ca6');
      box(root,'id-badge','#80aeb4',-.17,1.24,.235,.09,.13,.015);
    }
    if(kind==='whistle') {
      for(const x of [-.085,.085])box(root,'lanyard','#e9ded2',x,1.35,.19,.016,.3,.018).rotation.z=x<0?-.3:.3;
      part(root,'whistle','cylinder','#c0cccb',0,1.17,.23,.042,.1,.042).rotation.x=Math.PI/2;
    }
    if(kind==='sunhat') {
      part(root,'hat-brim','cylinder','#c8bb8e',0,1.99,0,.39,.045,.33);
      part(root,'hat-crown','cylinder','#d6c99f',0,2.06,0,.255,.13,.23);
      part(root,'hat-band','cylinder','#607c65',0,2.035,0,.258,.045,.232);
    }
    if(kind==='toolbelt'||kind==='keys') {
      box(root,'belt','#5b4f44',0,.97,0,.6,.065,.38);
      if(kind==='toolbelt') {
        box(root,'utility-pouch','#bf9259',.31,.88,.03,.19,.26,.24);
        box(root,'spanner-handle','#bdc7cc',-.33,1.02,.14,.045,.3,.045);
        part(root,'spanner-head','torus','#bdc7cc',-.33,1.19,.14,.067,.067,.07);
      } else {
        part(root,'keyring','torus','#c3bc9a',.31,.98,.18,.055,.055,.06);
        for(const x of [.28,.33])box(root,'key','#c3bc9a',x,.89,.19,.023,.11,.025);
      }
    }
    if(kind==='camera') {
      for(const x of [-.15,.15])box(root,'camera-strap','#3c3c42',x,1.3,.19,.04,.38,.025);
      box(root,'camera-body','#343c43',0,1.12,.3,.35,.21,.18);
      part(root,'camera-lens','cylinder','#6c919b',0,1.13,.45,.09,.17,.09).rotation.x=Math.PI/2;
      box(root,'camera-viewfinder','#343c43',.055,1.25,.3,.12,.06,.1);
    }
    if(kind==='satchel') {
      box(root,'crossbody-strap','#695f62',0,1.2,.202,.057,.73,.026).rotation.z=-.53;
      box(root,'satchel','#d1a367',.33,.87,.09,.27,.29,.27);
    }
    if(kind==='beret')part(root,'beret','sphere','#a35465',.055,1.99,0,.3,.105,.26).rotation.z=-.15;
  }
  function equipment(actor) {
    actor.gear = {};
    function slot(id,parent) {const g=group(parent||actor.group,'equipment-'+id);g.userData.equipment=id;g.visible=false;actor.gear[id]=g;return g;}
    const wrist=slot('wrist');box(wrist,'training-wrap','#a3654e',-.39,.96,0,.205,.19,.235);box(wrist,'wrap-buckle','#e4c477',-.39,.96,.124,.11,.065,.035);
    const solder=slot('solder');box(solder,'tool-case','#d1a354',.38,.91,.02,.21,.23,.22);box(solder,'precision-driver','#556677',.41,1.07,.13,.047,.28,.05);box(solder,'driver-tip','#bbcbd0',.41,1.24,.13,.019,.085,.022);
    const jacket=slot('jacket');for(const x of [-.17,.17])box(jacket,'jacket-panel','#bd7157',x,1.2,.206,.24,.57,.055);for(const x of [-.39,.39])box(jacket,'jacket-sleeve','#bd7157',x,1.2,0,.2,.49,.24);box(jacket,'jacket-back','#bd7157',0,1.21,-.196,.61,.59,.045);
    const sneakers=slot('sneakers');
    for(const leg of [actor.left,actor.right]) {
      const shoe=group(leg,'equipment-sneakers');shoe.userData.equipment='sneakers';
      box(shoe,'running-shoe','#c1d9ca',0,-.71,.06,.25,.14,.39);
      box(shoe,'shoe-stripe','#be7959',0,-.682,.205,.19,.035,.04);
      sneakers.userData.shoes = [...(sneakers.userData.shoes||[]),shoe];shoe.visible=false;
    }
    const pendant=slot('pendant');for(const x of [-.07,.07])box(pendant,'necklace','#c9b472',x,1.38,.241,.017,.22,.016).rotation.z=x<0?-.25:.25;part(pendant,'focus-gem','sphere','#65b7af',0,1.24,.258,.06,.075,.035);
    const chip=slot('chip');box(chip,'processor-case','#3a4e56',.205,1.31,.243,.13,.18,.075);box(chip,'processor-light','#77d5bb',.205,1.31,.286,.075,.095,.015);
  }
  function create(id,options={}) {
    if(!globalThis.THREE)return null;
    const p=profiles[id]||profiles.studentA,root=new THREE.Group();root.name='Character_'+p.id;
    root.userData.profile=p.id;root.userData.sharedCharacterResources=true;
    root.scale.setScalar(p.height);
    const left=group(root,'left-leg'),right=group(root,'right-leg');
    [left,right].forEach((leg,i)=>{
      leg.position.set(i===0?-.16:.16,.78,0);
      const shorts=p.outfit==='jersey';
      box(leg,'leg',shorts?p.skin:p.pants,0,-.33,0,.21,.67,.23);
      if(shorts)box(leg,'shorts',p.pants,0,-.1,0,.255,.26,.27);
      if(p.outfit==='skirt')box(leg,'sock','#f0ece2',0,-.52,0,.216,.24,.238);
      box(leg,'shoe','#343b42',0,-.71,.055,.24,.14,.36);
      box(leg,'sole','#d0d1c7',0,-.762,.055,.245,.036,.365);
    });
    clothes(root,p);
    for(const x of [-.39,.39]) {
      const shortSleeves=['jersey','tee','vest'].includes(p.outfit);
      box(root,'arm',shortSleeves?p.skin:p.shirt,x,1.16,0,.17,.59,.21);
      if(shortSleeves)box(root,'short-sleeve',p.shirt,x,1.38,0,.195,.21,.23);
      ball(root,'hand',p.skin,x,.83,.01,.088,.115,.095);
    }
    part(root,'neck','cylinder',p.skin,0,1.52,0,.105,.2,.105);
    ball(root,'head',p.skin,0,1.738,.014,.244,.265,.223);
    for(const x of [-.247,.247])ball(root,'ear',p.skin,x,1.73,0,.042,.065,.044);
    for(const x of [-.087,.087]) {
      box(root,'eye','#30363b',x,1.758,.223,.037,.045,.018);
      box(root,'brow',p.hairColor,x,1.809,.223,.068,.017,.017);
    }
    ball(root,'nose',p.skin,0,1.704,.234,.04,.048,.035);
    box(root,'mouth','#a56e61',0,1.638,.207,.068,.015,.014);
    hair(root,p);accessory(root,p);
    const actor={group:root,left,right,profile:p};
    if(options.player)equipment(actor);
    return actor;
  }
  function updateEquipment(actor,equipped={}) {
    if(!actor?.gear)return actor;
    const ids=new Set(Object.values(equipped||{}));
    for(const [id,g] of Object.entries(actor.gear)) {
      g.visible=ids.has(id);
      for(const shoe of g.userData.shoes||[])shoe.visible=g.visible;
    }
    return actor;
  }
  function portrait(id,equipped={}) {
    if(!globalThis.THREE||typeof document==='undefined'||portraitFailed)return '';
    const profile=profiles[id]||profiles.studentA;
    const gear=Object.values(equipped||{}).filter(value=>['wrist','solder','jacket','sneakers','pendant','chip'].includes(value)).sort();
    const key=profile.id+':'+gear.join(',');
    if(portraits.has(key))return portraits.get(key);
    let actor;
    try {
      if(!portraitRenderer) {
        portraitRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
        portraitRenderer.setSize(384,512,false);portraitRenderer.setPixelRatio(1);
        portraitRenderer.setClearColor(0x000000,0);portraitRenderer.outputEncoding=THREE.sRGBEncoding;
        portraitRenderer.toneMapping=THREE.ACESFilmicToneMapping;portraitRenderer.toneMappingExposure=1.05;
        portraitScene=new THREE.Scene();
        portraitScene.add(new THREE.HemisphereLight('#eff8ff','#8f9b93',.9));
        const light=new THREE.DirectionalLight('#fff1dd',1.5);light.position.set(-3,5,5);portraitScene.add(light);
        const fill=new THREE.DirectionalLight('#b7d7ed',.45);fill.position.set(3,2,-3);portraitScene.add(fill);
        portraitCamera=new THREE.OrthographicCamera(-.95,.95,1.267,-1.267,.1,20);
        portraitCamera.position.set(3,2.2,6);portraitCamera.lookAt(0,1.07,0);
      }
      if(!portraitActors.has(profile.id))portraitActors.set(profile.id,create(profile.id,{player:true}));
      actor=portraitActors.get(profile.id);updateEquipment(actor,equipped);
      portraitScene.add(actor.group);portraitRenderer.render(portraitScene,portraitCamera);
      const url=portraitRenderer.domElement.toDataURL('image/png');
      portraits.set(key,url);
      if(portraits.size>64)portraits.delete(portraits.keys().next().value);
      return url;
    } catch(error) {
      portraitFailed=true;
      if(portraitRenderer)portraitRenderer.dispose();
      portraitRenderer=null;
      return '';
    } finally {
      if(actor&&portraitScene)portraitScene.remove(actor.group);
    }
  }
  return {profiles,create,updateEquipment,portrait};
})();
