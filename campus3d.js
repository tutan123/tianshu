'use strict';
globalThis.Campus3D = (() => {
  const coords = { dorm: [-22, -14], hall: [0, -21], library: [23, -17], lake: [-23, 13], gym: [2, 22], lab: [24, 4], gate: [26, 25], plaza: [0, 0] };
  const entries = { dorm: [-22, -8], hall: [0, -14], library: [23, -10], lake: [-35, 2], gym: [-6, 29], lab: [24, 10], gate: [26, 28], plaza: [-24, 36] };
  const worldBounds=globalThis.WorldDistricts?.bounds||{minX:-57,maxX:42,minZ:-36,maxZ:37};
  const worldCenter=[(worldBounds.minX+worldBounds.maxX)/2,(worldBounds.minZ+worldBounds.maxZ)/2];
  for(const b of globalThis.WorldDistricts?.buildings||[]){entries[b.id]=b.entry;coords[b.id]=[b.x,b.z];}
  let scene, renderer, camera, miniCamera, host, hooks, sun, hemi, water, player, scan, rain, ringTarget, lamps = [], lampPools = [], lampPoolMaterial = null, markers = {}, colliders = [];
  let mode = 'overview', active = true, weather = 'auto', worldNight = false, yaw = .08, pitch = .84, radius = 96, target, desiredTarget, last = 0, elapsed = 0, currentPlace = 'dorm', pointer = null, travel = null, pressed = new Set(), ready = false, near = null;
  let people = [], windowMaterials = [], rainPositions, rainGeometry, worldState = { available: [], selected: 'dorm', night: false, motion: true }, waterBase, miniRect;
  const T = () => window.THREE;
  const mat = (c, roughness = .85) => new THREE.MeshStandardMaterial({ color: c, roughness });
  let white, stone, roofMat, glass, pavement, road, brass;
  const geometries = {};
  const previews = {};
  const architectureVisuals = [];
  let campusRoot, zone = null, floor = 1, indoor = null, outsideColliders, outsideVisuals, nearestObject = null, returnPoint, route = [];
  const interiors = {};
  let surveying=false, fogBaseNear=260;
  const worldObjects = () => zone ? [...(floor===1&&Exploration.regions[zone]?Exploration.objects(zone):[]),...(globalThis.CampusRooms?.objects(zone,floor)||[])] : [...Exploration.outdoor, ...Object.entries(entries).map(([id,[x,z]])=>({id:id+'-door',type:'door',name:'进入 · '+(globalThis.CampusRooms?.name(id)||Exploration.regions[id].name),x,z,destination:id}))];
  function mesh(geo, material, x, y, z, parent = scene) { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
  function box(w, h, d, material, x, y, z, parent) {
    const geometry=new THREE.BoxGeometry(w,h,d);
    if(material===pavement){const {position,normal,uv}=geometry.attributes;for(let i=0;i<position.count;i++)if(Math.abs(normal.getY(i))>.5)uv.setXY(i,(position.getX(i)+x)*.22,(position.getZ(i)+z)*.22);}
    return mesh(geometry,material,x,y,z,parent);
  }
  function cylinder(r, h, material, x, y, z, parent, count = 16) { return mesh(new THREE.CylinderGeometry(r, r, h, count), material, x, y, z, parent); }
  function building(x,z,w,d,h,kind='dorm') {
    const result=CampusBuildings.build(kind,{x,z,w,d,h});
    scene.add(result.root);colliders.push(result.collider);
    for(const material of result.windows)if(!windowMaterials.includes(material))windowMaterials.push(material);
    const meshes=[];result.root.traverse(o=>{if(o.isMesh)meshes.push({object:o,original:o.material,ghost:null});});
    architectureVisuals.push({root:result.root,meshes,objects:meshes.map(m=>m.object),faded:false,bounds:new THREE.Box3(new THREE.Vector3(x-w/2-.5,0,z-d/2-.5),new THREE.Vector3(x+w/2+.5,kind==='hall'?16.5:h+2.8,z+d/2+1.4))});
    return result.root;
  }
  const occluderRay = new THREE.Raycaster();
  let occlusionFrame = 0, pinNodes = null;
  function updateOcclusion() {
    // Precise mesh raycasts are not free, and occlusion changes slowly, so re-test
    // every few frames instead of every frame.
    if (occlusionFrame++ % 3 !== 0) return;
    const hit = new THREE.Vector3();
    // Sample feet, torso and head. Fogging a building is only justified when the whole
    // figure is hidden; one clear sample means the player is still visible, and fading
    // anyway just washed the screen out for nothing.
    const samples = [.25, 1.3, 2.05].map(height => {
      const aim = player.group.position.clone(); aim.y += height;
      const direction = aim.sub(camera.position);
      return { direction, unit: direction.clone().normalize(), distance: direction.length() };
    });
    for (const item of architectureVisuals) {
      if (mode !== 'walk' || zone) { item.faded = false; continue; }
      // Cheap box prefilter first. On its own it was not enough: the box is padded
      // beyond the walls and up to the roof, so the camera-to-player ray clipped it
      // while the player was still plainly in view.
      const near = samples.some(s => new THREE.Ray(camera.position, s.unit).intersectBox(item.bounds, hit) && camera.position.distanceTo(hit) < s.distance - .35);
      if (!near) { item.faded = false; continue; }
      item.faded = samples.every(s => {
        occluderRay.set(camera.position, s.unit);
        occluderRay.near = 0; occluderRay.far = s.distance - .35;
        return occluderRay.intersectObjects(item.objects, false).length > 0;
      });
    }
  }
  function applyOcclusion(enabled) {
    for(const item of architectureVisuals)for(const part of item.meshes){
      if(enabled&&item.faded){
        if(!part.ghost){
          part.ghost=part.original.clone();
          part.ghost.transparent=true;
          part.ghost.opacity=.3;
          // Keep depth writes ON. With depthWrite off every surface of the building
          // blended with every other one — front faces, back faces and interior
          // details at once — so the occluder turned into a muddy wash with the
          // facade showing through itself. Writing depth makes it a single readable
          // translucent volume, and the player (already drawn in the opaque pass)
          // simply shows through it at 70%.
          part.ghost.depthWrite=true;
        }
        part.ghost.emissiveIntensity=part.original.emissiveIntensity;
        if(part.object.material!==part.ghost)part.object.material=part.ghost;
      }else if(part.object.material!==part.original)part.object.material=part.original;
    }
  }
  // One shared CC0 tree set. Previously the campus grid used procedural icosahedron
  // canopies while world-art.js dressed the outskirts with Kenney meshes, so two art
  // styles shared the same screen. Everything now comes from the same kit.
  const TREE_KINDS = ['tree_oak', 'tree_detailed', 'tree_default', 'tree_fat', 'tree_tall', 'tree_small', 'tree_thin', 'tree_blocks', 'tree_pineRoundA', 'tree_pineTallA'];
  const hash2 = (x, z, salt) => Math.abs(Math.round(x * 31 + z * 17 + salt * 7));
  function tree(x, z, scale = 1, forced = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const kind = TREE_KINDS[(forced || hash2(x, z, 1)) % TREE_KINDS.length];
    WorldArt.asset(g, kind, 0, 0, 0, 4.6 * scale, (hash2(x, z, 3) % 12) * Math.PI / 6);
    return g;
  }
  function bench(x, z, rotation = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotation; scene.add(g);
    box(2.1, .17, .7, roofMat, 0, .65, 0, g); box(2.1, .75, .12, roofMat, 0, 1, -.3, g);
    box(.14, .6, .65, brass, -.8, .3, 0, g); box(.14, .6, .65, brass, .8, .3, 0, g);
  }
  function lamp(x, z) {
    cylinder(.08, 3.8, brass, x, 1.9, z, scene, 6);
    const bulb = mesh(new THREE.BoxGeometry(.46, .55, .46), new THREE.MeshStandardMaterial({ color: '#f0ebcd', emissive: '#ffd77e', emissiveIntensity: .2 }), x, 3.9, z);
    lamps.push(bulb.material);
    // A night-only pool of light on the pavement. Fourteen real PointLights would cost
    // far more than the effect is worth; a soft additive disc reads the same from this
    // camera distance and costs one shared material.
    geometries.lampPool ||= new THREE.CircleGeometry(3.4, 20);
    lampPoolMaterial ||= new THREE.MeshBasicMaterial({ color: '#ffce85', transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const pool = new THREE.Mesh(geometries.lampPool, lampPoolMaterial);
    pool.rotation.x = -Math.PI / 2; pool.position.set(x, .065, z); pool.renderOrder = 2; pool.visible = false;
    scene.add(pool); lampPools.push(pool);
  }
  function person(x, z, color, isPlayer = false) {
    const g = new THREE.Group(); scene.add(g); g.position.set(x, 0, z);
    const clothing = mat(color);
    cylinder(.26, .78, clothing, 0, 1.02, 0, g, 8);
    mesh(new THREE.SphereGeometry(.21, 8, 6), mat('#d8b697'), 0, 1.62, 0, g);
    box(.39,.12,.36,mat('#29303b'),0,1.8,0,g);
    for(const x of[-.08,.08])box(.045,.045,.035,brass,x,1.65,.19,g);
    const left = box(.17, .7, .18, brass, -.14, .4, 0, g), right = box(.17, .7, .18, brass, .14, .4, 0, g);
    box(.15, .6, .16, clothing, -.34, 1, 0, g); box(.15, .6, .16, clothing, .34, 1, 0, g);
    if (isPlayer) { box(.42, .48, .2, mat('#575746'), 0, 1.06, -.26, g); const r = mesh(new THREE.RingGeometry(.6, .72, 28), new THREE.MeshBasicMaterial({ color: '#d9f4a4', transparent: true, opacity: .9, side: THREE.DoubleSide }), 0, .08, 0, g); r.rotation.x = -Math.PI / 2; }
    return { group: g, left, right };
  }
  // Original low-poly cast figures when characters.js is present; the procedural
  // figure above stays as the fallback so the campus still runs without it.
  function characterActor(id, options = {}) {
    const actor = globalThis.Characters?.create(id, options);
    if (!actor) return null;
    scene.add(actor.group);
    return actor;
  }
  function playerFigure(x, z) {
    const actor = characterActor('chenxu', { player: true });
    if (!actor) return person(x, z, '#5078a5', true);
    actor.group.position.set(x, 0, z);
    const r = mesh(new THREE.RingGeometry(.6, .72, 28), new THREE.MeshBasicMaterial({ color: '#d9f4a4', transparent: true, opacity: .9, side: THREE.DoubleSide }), 0, .08, 0, actor.group);
    r.rotation.x = -Math.PI / 2;
    return actor;
  }
  function line(points, color = '#ece6cb') {
    const geo = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)));
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color })); scene.add(l); return l;
  }
  function build() {
    white = mat('#e7ece9'); stone = mat('#b5c0c1'); roofMat = mat('#996e67'); glass = mat('#548da2', .25); pavement = CampusBuildings.material('paving'); road = mat('#727d87'); brass = mat('#3f4b43');
    box(180, .3, 180, mat('#719375'), 0, -.4, 0);
    box(86, .25, 79, mat('#8daa79'), 0, -.1, 0);
    box(7, .12, 78, pavement, 0, .04, 0); box(82, .12, 5, pavement, 0, .04, 9); box(82, .12, 5, pavement, 0, .04, -8);
    box(4, .12, 68, pavement, -12, .04, -2); box(4, .12, 68, pavement, 14, .04, -2); box(4, .1, 68, pavement, 34, .04, -1);
    box(89, .08, 6, road, 0, .03, 39);
    for (let x = -41; x < 42; x += 4) box(2, .02, .14, white, x, .09, 39);
    building(-22, -15, 13, 7, 6.2); building(-25, -28, 16, 6, 6.7); building(-36, -16, 6, 12, 5.5);
    building(0,-23,20,7.6,6.5,'hall');
    building(24,-20,17,12,8.2,'library'); building(24,1,14,8,5.8,'lab'); building(34,20,8,6,4,'gate'); building(24,23,9,6,3.8,'gate');
    building(-35,-2,8,5,3.5,'lake'); building(-7,22,5,10,4.2,'gym'); building(-24,32,10,5,3.8,'plaza');
    box(1, 5, 1, white, 20, 2.5, 33); box(1, 5, 1, white, 32, 2.5, 33); box(13, .9, 1.1, stone, 26, 4.6, 33);
    const signCanvas = document.createElement('canvas'); signCanvas.width = 512; signCanvas.height = 64; const sc = signCanvas.getContext('2d'); sc.fillStyle = '#c5c8b6'; sc.fillRect(0, 0, 512, 64); sc.fillStyle = '#374c40'; sc.font = '38px Microsoft YaHei'; sc.textAlign = 'center'; sc.fillText('江 城 大 学', 256, 46); const signTex = new THREE.CanvasTexture(signCanvas); signTex.encoding = THREE.sRGBEncoding; mesh(new THREE.PlaneGeometry(10, 1.25), new THREE.MeshStandardMaterial({ map: signTex }), 26, 4.55, 33.57);
    cylinder(6.5, .12, pavement, 0, .15, 1, scene, 64); cylinder(3.4, .65, stone, 0, .4, 1, scene, 48); cylinder(2.95, .18, glass, 0, .76, 1, scene, 48); cylinder(.5, 1.1, white, 0, 1.2, 1); cylinder(1.35, .2, stone, 0, 1.72, 1);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const points = []; for (let j = 0; j <= 12; j++) { const f = j / 12; points.push([Math.cos(a) * f * 2.5, .8 + Math.sin(f * Math.PI) * 2, 1 + Math.sin(a) * f * 2.5]); } line(points, '#b9d9d6'); }
    const waterGeo = new THREE.CircleGeometry(12.4, 64, 0, Math.PI * 2); waterGeo.rotateX(-Math.PI / 2); waterBase = waterGeo.attributes.position.array.slice();
    water = mesh(waterGeo, new THREE.MeshStandardMaterial({ color: '#4b9190', metalness: .45, roughness: .2, transparent: true, opacity: .94 }), -26, .17, 16); water.scale.z = 1.25; water.receiveShadow = true; water.castShadow = false;
    const shore = mesh(new THREE.RingGeometry(12.4, 13, 64), stone, -26, .035, 16); shore.rotation.x = -Math.PI / 2; shore.scale.y = 1.25;
    box(22, .35, 2.2, white, -25, .55, 17);
    for (let i = -35; i <= -15; i += 2) { cylinder(.07, 1, brass, i, 1.1, 16); cylinder(.07, 1, brass, i, 1.1, 18); }
    box(22, .09, .1, brass, -25, 1.6, 16); box(22, .09, .1, brass, -25, 1.6, 18);
    box(14, .14, 16, mat('#5f8f78'), 2, .13, 23); box(7, .15, 5.5, mat('#bd8067'), 2, .14, 17.6); box(7, .15, 5.5, mat('#bd8067'), 2, .14, 28.4);
    line([[-4.6, .24, 15.4], [8.6, .24, 15.4], [8.6, .24, 30.6], [-4.6, .24, 30.6], [-4.6, .24, 15.4]]); line([[-4.6, .24, 23], [8.6, .24, 23]]);
    const centerCircle = mesh(new THREE.RingGeometry(1.9, 1.96, 40), new THREE.MeshBasicMaterial({ color: '#eae5c9', side: THREE.DoubleSide }), 2, .24, 23); centerCircle.rotation.x = -Math.PI / 2;
    for (const z of [15, 31]) { cylinder(.08, 3.3, brass, 2, 1.65, z); box(1.6, .95, .1, white, 2, 3.2, z); const hoop = mesh(new THREE.TorusGeometry(.34, .04, 6, 18), roofMat, 2, 2.9, z + (z < 20 ? .5 : -.5)); hoop.rotation.x = Math.PI / 2; }
    for (let z = -33; z < 34; z += 6) for (const x of [-8.2, 10, 38.5]) tree(x, z, .82 + (Math.sin(z) + 1) * .13);
    for (let x = -39; x < 40; x += 5.5) { tree(x, -37, .9); tree(x, 35.5, .8); }
    for (const [x, z] of [[-38, 2], [-37, 6], [-20, 0], [-31, 0], [-39, 26], [-38, 30], [18, 15], [33, -5], [30, -33]]) tree(x, z, 1.1);
    for (let z = -29; z < 34; z += 10) { lamp(-4.5, z); lamp(5, z); }
    for (const [x, z] of [[-6, 7], [7, 7], [-16, 11], [-14, 22], [16, -10]]) bench(x, z, x < -10 ? Math.PI / 2 : 0);
    const pedestrianProfiles = ['studentA', 'studentB', 'photographer', 'technician', 'captain'];
    for (let i = 0; i < 20; i++) {
      const x = i % 2 ? -2 : 2, z = -30 + i * 3.1;
      const p = characterActor(pedestrianProfiles[i % pedestrianProfiles.length]) || person(x, z, '#7898a2');
      p.group.position.set(x, .22, z); p.origin = p.group.position.clone(); p.speed = .25 + i % 3 * .1; people.push(p);
    }
    player = playerFigure(-22, -3);
    ringTarget = mesh(new THREE.RingGeometry(.65, .72, 28), new THREE.MeshBasicMaterial({ color: '#d5efb0', transparent: true, opacity: .8, side: THREE.DoubleSide }), 0, .12, 0); ringTarget.rotation.x = -Math.PI / 2; ringTarget.visible = false;
    for (const [id, [x, z]] of Object.entries(entries)) {
      const marker = mesh(new THREE.RingGeometry(1.1, 1.35, 32), new THREE.MeshBasicMaterial({ color: '#d3e7a4', transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false }), x, .18, z); marker.rotation.x = -Math.PI / 2; markers[id] = marker;
    }
    scan = mesh(new THREE.RingGeometry(.96, 1, 120), new THREE.MeshBasicMaterial({ color: '#b6e9ca', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }), 0, .3, 0); scan.rotation.x = -Math.PI / 2;
    rainGeometry = new THREE.BufferGeometry(); rainPositions = new Float32Array(500 * 6);
    for (let i = 0; i < 500; i++) { const k = i * 6; rainPositions[k] = Math.random() * 85 - 42; rainPositions[k + 1] = Math.random() * 28; rainPositions[k + 2] = Math.random() * 80 - 40; rainPositions[k + 3] = rainPositions[k] + .1; rainPositions[k + 4] = rainPositions[k + 1] + 1.2; rainPositions[k + 5] = rainPositions[k + 2]; }
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3)); rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: '#cbded7', transparent: true, opacity: .33 })); scene.add(rain); rain.visible = false;
  }
  function init(element, callbacks) {
    if (!window.THREE) return false;
    THREE.ColorManagement.legacyMode = false;
    host = element; hooks = callbacks;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
      renderer.domElement.id = 'campus-canvas'; renderer.domElement.setAttribute('aria-label', '可交互的三维江城大学校园'); host.appendChild(renderer.domElement);
      scene = new THREE.Scene(); scene.background = new THREE.Color('#becdc5'); scene.fog = new THREE.Fog('#becdc5', 100, 185);
      camera = new THREE.PerspectiveCamera(42, 1, .2, 2000);camera.layers.enable(1); miniCamera = new THREE.OrthographicCamera(worldBounds.minX-3,worldBounds.maxX+3,-worldBounds.minZ+3,-worldBounds.maxZ-3,.1,300); miniCamera.position.set(0,150,0); miniCamera.up.set(0,0,-1); miniCamera.lookAt(0,0,0);
      target = new THREE.Vector3(0, 0, 1); desiredTarget = target.clone();
      hemi = new THREE.HemisphereLight('#e3eeff', '#7f8973', 1.15); scene.add(hemi);
      sun = new THREE.DirectionalLight('#fff0cd', 2.4); sun.position.set(-30, 55, 30); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -55; sun.shadow.camera.right = 55; sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55; sun.shadow.camera.far = 150; sun.shadow.bias = -.0005; sun.shadow.normalBias = .035; scene.add(sun);
      build();
      campusRoot=new THREE.Group();campusRoot.name='Campus_Exterior';
      for(const child of [...scene.children])if(child!==sun&&child!==hemi&&child!==player.group&&child!==ringTarget)campusRoot.add(child);
      scene.add(campusRoot);
      const dressing=WorldArt.outdoor(campusRoot);colliders.push(...dressing.colliders);outsideColliders=colliders;outsideVisuals=dressing.visuals;
      if(globalThis.WorldDistricts){
        const extension=WorldDistricts.build(campusRoot);colliders.push(...extension.colliders);
        for(const v of extension.visuals){const b=WorldDistricts.buildings.find(b=>b.id===v.id),parts=[];v.root.traverse(o=>{if(o.isMesh)parts.push({object:o,original:o.material,ghost:null});});architectureVisuals.push({root:v.root,meshes:parts,objects:parts.map(p=>p.object),faded:false,bounds:new THREE.Box3(new THREE.Vector3(b.x-b.w/2-1,0,b.z-b.d/2-1),new THREE.Vector3(b.x+b.w/2+1,b.h+4,b.z+b.d/2+2))});}
        sun.position.set(-55,100,70);sun.shadow.camera.left=-135;sun.shadow.camera.right=135;sun.shadow.camera.top=135;sun.shadow.camera.bottom=-135;sun.shadow.camera.far=350;sun.shadow.camera.updateProjectionMatrix();
      }
      player.group.visible = false; wire(); ready = true; resize(); setWeather('auto'); requestAnimationFrame(frame); return true;
    } catch (err) { renderer?.dispose(); renderer?.domElement.remove(); hooks.error?.(err); return false; }
  }
  function update(data) { worldState = { ...worldState, ...data }; if (worldNight !== worldState.night && weather === 'auto') setWeather('auto'); for (const [id, marker] of Object.entries(markers)) marker.visible = worldState.available.some(n => CONTENT.nodes[n].place === id); if (data.equipped && player?.gear) globalThis.Characters?.updateEquipment(player, data.equipped); WorldArt.refresh(outsideVisuals,worldState.exploration);if(indoor)WorldArt.refresh(indoor.visuals,worldState.exploration); }
  function setWeather(value) {
    if (!ready) return; weather = value; worldNight = worldState.night; for (const key of Object.keys(previews)) delete previews[key];
    const night = value === 'night' || value === 'rain' || value === 'auto' && worldNight, wet = value === 'rain' || value === 'auto' && worldNight;
    scene.background.set(night ? '#394752' : '#c7dce3'); scene.fog.color.copy(scene.background); fogBaseNear=night?190:260; scene.fog.near=fogBaseNear; scene.fog.far = 450;
    hemi.intensity = night ? .3 : .85; sun.intensity = night ? .2 : 1.6; sun.color.set(night ? '#b2ccd9' : '#fff6e9'); renderer.toneMappingExposure = night ? .74 : .96;
    rain.visible = wet; for (const m of lamps) m.emissiveIntensity = night ? 4 : .2;
    // Window materials are shared per building kind — architecture.test.cjs asserts two
    // dorm blocks use the same material instance — so stagger the lit windows by
    // material index instead of cloning a material per building. Buildings of the same
    // kind stay in sync, different kinds do not, and no material is duplicated.
    windowMaterials.forEach((m, i) => m.emissiveIntensity = night ? .72 + (i % 4) * .12 : 0);
    for (const pool of lampPools) pool.visible = night;
    water.material.roughness = wet ? .12 : .25; hooks.weather?.(night, wet); return { night, wet };
  }
  function buildInterior(id,level=1) {
    const extra=globalThis.CampusRooms?.build(id,level);if(extra)return extra;
    try { const built = globalThis.Interiors?.build?.(id); if (built?.root) return built; }
    catch (err) { hooks?.error?.(err); }
    return WorldArt.interior(id);
  }
  function enterInterior(id,level=1) {
    if(!ready||!(globalThis.CampusRooms?.valid(id,level)||Exploration.regions[id]&&level===1)||mode!=='walk')return false;
    if(!zone)returnPoint=player.group.position.clone();
    if(indoor)indoor.root.visible=false;
    surveying=false;zone=id;floor=level;currentPlace=id;const key=id+':'+floor;
    if(!interiors[key]){interiors[key]=buildInterior(id,floor);if(floor===1&&Exploration.regions[id])Object.assign(interiors[key].visuals,WorldArt.interactables(interiors[key].root,globalThis.CampusRooms?.objects(id,1)||[]));}
    indoor=interiors[key];scene.add(indoor.root);indoor.root.visible=true;campusRoot.visible=false;colliders=indoor.colliders;
    // A floor plan can put its own spawn inside its own wall: the hall 3F, library 3F,
    // bookshop 2F and museum 2F plans all run an x=0 wall through z 1.7..8.3, which is
    // exactly where spawn [0,8] lands. Dropping the player there boxes them in and every
    // target on the floor becomes unreachable, so fall back to the nearest clear cell.
    const wanted=level===1?[0,10.5]:(indoor.spawn||[0,8]);
    const spawn=[[wanted[0],wanted[1]],[wanted[0],wanted[1]-2.5],[wanted[0]+2.5,wanted[1]],[wanted[0]-2.5,wanted[1]],[wanted[0],wanted[1]+2.5],[0,11],[0,-11]].find(([x,z])=>clearAt(x,z))||wanted;
    player.group.position.set(spawn[0],.22,spawn[1]);target.copy(player.group.position);desiredTarget.copy(target);radius=31;yaw=0;pitch=1.03;
    pressed.clear();travel=null;route=[];ringTarget.visible=false;nearestObject=null;near=null;hooks.near?.(null);hooks.object?.(null);
    miniCamera.left=-20;miniCamera.right=20;miniCamera.top=16;miniCamera.bottom=-16;miniCamera.updateProjectionMatrix();
    hemi.intensity=.95;sun.intensity=1.5;scene.background.set('#263e49');
    document.body.classList.add('inside');hooks.zone?.(id);WorldArt.refresh(indoor.visuals,worldState.exploration);return true;
  }
  function exitInterior() {
    if(!zone)return false;
    surveying=false;indoor.root.visible=false;campusRoot.visible=true;colliders=outsideColliders;zone=null;floor=1;indoor=null;
    player.group.position.copy(returnPoint||new THREE.Vector3(0,.18,7));target.copy(player.group.position);desiredTarget.copy(target);radius=27;pitch=.86;
    pressed.clear();travel=null;route=[];ringTarget.visible=false;nearestObject=null;near=null;
    miniCamera.left=worldBounds.minX-3;miniCamera.right=worldBounds.maxX+3;miniCamera.top=-worldBounds.minZ+3;miniCamera.bottom=-worldBounds.maxZ-3;miniCamera.updateProjectionMatrix();setWeather(weather);
    document.body.classList.remove('inside');hooks.zone?.(null);hooks.object?.(null);return true;
  }
  function interact() { if(active&&mode==='walk'&&nearestObject)hooks.interact?.(nearestObject); }
  function overviewRadius() {const halfX=(worldBounds.maxX-worldBounds.minX)/2+8,halfZ=(worldBounds.maxZ-worldBounds.minZ)/2+8,tan=Math.tan(camera.fov*Math.PI/360);return Math.max(halfZ/tan,halfX/(tan*camera.aspect)+halfZ);}
  function surveyRadius() { return zone ? Math.max(62,42/(2*Math.tan(camera.fov*Math.PI/360)*camera.aspect)) : overviewRadius(); }
  function survey() { surveying=!surveying;radius=surveying?surveyRadius():(zone?31:27);pitch=surveying?1.18:(zone?1.03:.88);yaw=0; }
  function setMode(next, place = currentPlace) {
    if(zone)exitInterior();surveying=false;
    if (!ready || !entries[place] || !['walk', 'overview'].includes(next)) return; mode = next; pressed.clear(); travel = null; ringTarget.visible = false; near = null; currentPlace = place;
    if (next === 'walk') { const e = entries[place],spawn=[[e[0],e[1]+3],[e[0],e[1]+1],[e[0]+3,e[1]],e].find(([x,z])=>clearAt(x,z))||e; player.group.position.set(spawn[0],0,spawn[1]); desiredTarget.copy(player.group.position); radius = 27; yaw = .1; pitch = .88; }
    else { desiredTarget.set(worldCenter[0],0,worldCenter[1]); radius=overviewRadius(); yaw = 0; pitch = 1.05; }
    player.group.visible = next === 'walk'; document.body.classList.toggle('walking', next === 'walk'); hooks.mode?.(next); resize();
  }
  function rayPoint(event) {
    const rect = renderer.domElement.getBoundingClientRect(), r = miniRect;
    let x = event.clientX - rect.left, y = event.clientY - rect.top, width = rect.width, height = rect.height, source = camera;
    if (mode === 'walk' && r && x >= r.x && x <= r.x + r.width && y >= height - r.y - r.height && y <= height - r.y) {
      y -= height - r.y - r.height; x -= r.x; width = r.width; height = r.height; source = miniCamera;
    }
    const mouse = new THREE.Vector2(x / width * 2 - 1, -(y / height) * 2 + 1), ray = new THREE.Raycaster(); ray.setFromCamera(mouse, source); const p = new THREE.Vector3(); return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? p : null;
  }
  function clearAt(x, z) {
    if(zone)return Math.abs(x)<17.5&&Math.abs(z)<13.5&&!colliders.some(c=>Math.abs(x-c.x)<c.w&&Math.abs(z-c.z)<c.d);
    if (x < worldBounds.minX || x > worldBounds.maxX || z < worldBounds.minZ || z > worldBounds.maxZ) return false;
    if (colliders.some(c => Math.abs(x - c.x) < c.w && Math.abs(z - c.z) < c.d)) return false;
    const inLake = ((x + 26) / 12.8) ** 2 + ((z - 16) / 15.8) ** 2 < 1; return !inLake || Math.abs(z - 17) < .95;
  }
  function moveTo(x, z) {
    if (!clearAt(x, z)) return false;
    const sx=Math.round(player.group.position.x),sz=Math.round(player.group.position.z),gx=Math.round(x),gz=Math.round(z),key=(a,b)=>a+','+b;
    const queue=[[sx,sz]],came=new Map([[key(sx,sz),null]]);let found=null;
    for(let i=0;i<queue.length&&i<55000;i++){
      const [cx,cz]=queue[i];if(cx===gx&&cz===gz){found=[cx,cz];break;}
      for(const [dx,dz] of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
        const nx=cx+dx,nz=cz+dz,k=key(nx,nz);if(came.has(k)||!clearAt(nx,nz)||!clearAt(cx+dx,cz)||!clearAt(cx,cz+dz))continue;
        if([.2,.4,.6,.8].some(t=>!clearAt(cx+dx*t,cz+dz*t)))continue;
        came.set(k,[cx,cz]);queue.push([nx,nz]);
      }
    }
    if(!found)return false;const path=[];for(let p=found;p;p=came.get(key(...p)))path.push(new THREE.Vector3(p[0],0,p[1]));path.reverse();path.shift();path.push(new THREE.Vector3(x,0,z));
    route=path;travel=route.shift();ringTarget.position.set(x,groundHeight(x,z)+.02,z);ringTarget.visible=true;return true;
  }
  function groundHeight(x,z) { return zone ? (indoor?.height?.(x,z) ?? .22) : Math.abs(z-17)<1.1&&x>-36&&x<-14 ? .73 : WorldArt.height(x,z); }
  function wire() {
    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', e => { pointer = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
      if (!pointer) return; const dx = e.clientX - pointer.lastX, dy = e.clientY - pointer.lastY; if (Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) > 5) pointer.moved = true;
      if (pointer.moved) { yaw -= dx * .006; pitch = THREE.MathUtils.clamp(pitch + dy * .003, .35, 1.2); } pointer.lastX = e.clientX; pointer.lastY = e.clientY;
    });
    canvas.addEventListener('pointerup', e => {
      if (pointer && !pointer.moved) { const p = rayPoint(e); if (p) { if (mode === 'walk') moveTo(p.x, p.z); else { const best = Object.entries(coords).sort((a, b) => Math.hypot(a[1][0] - p.x, a[1][1] - p.z) - Math.hypot(b[1][0] - p.x, b[1][1] - p.z))[0]; if (Math.hypot(best[1][0] - p.x, best[1][1] - p.z) < 12) hooks.select(best[0]); } } } pointer = null;
    });
    canvas.addEventListener('pointercancel', () => pointer = null);
    canvas.addEventListener('wheel', e => { e.preventDefault(); radius = THREE.MathUtils.clamp(radius + e.deltaY * .04, mode === 'walk' ? 12 : 65, mode === 'walk' ? 40 : Math.max(260,overviewRadius())); }, { passive: false });
    document.addEventListener('keydown', e => { if (!active || mode !== 'walk' || document.querySelector('dialog[open]') || document.getElementById('cinema')?.hidden === false || /INPUT|TEXTAREA/.test(e.target.tagName)) return; if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'KeyE'].includes(e.code)) { e.preventDefault(); if (e.code === 'KeyE') { if(!e.repeat)interact(); } else { pressed.add(e.code); travel = null;route=[]; } } });
    document.addEventListener('keyup', e => pressed.delete(e.code)); window.addEventListener('blur', () => pressed.clear()); window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { if (document.hidden) pressed.clear(); });
  }
  function resize() {
    if (!ready) return; const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    if(surveying)radius=surveyRadius();
    else if(mode==='overview'){radius=overviewRadius();desiredTarget.set(worldCenter[0],0,worldCenter[1]);}
    const frame = document.getElementById('mini-frame')?.getBoundingClientRect(), bounds = host.getBoundingClientRect();
    miniRect = frame && frame.width ? { x: frame.left - bounds.left + 2, y: h - (frame.bottom - bounds.top) + 2, width: frame.width - 4, height: frame.height - 4 } : { x: w - 218, y: h - 320, width: 188, height: 140 };
  }
  function stepPlayer(dt) {
    let dx = 0, dz = 0; if (pressed.has('KeyW') || pressed.has('ArrowUp')) dz -= 1; if (pressed.has('KeyS') || pressed.has('ArrowDown')) dz += 1; if (pressed.has('KeyA') || pressed.has('ArrowLeft')) dx -= 1; if (pressed.has('KeyD') || pressed.has('ArrowRight')) dx += 1;
    if (dx || dz) { const x = dx * Math.cos(yaw) + dz * Math.sin(yaw), z = dz * Math.cos(yaw) - dx * Math.sin(yaw); dx = x; dz = z; }
    else if (travel) { dx = travel.x - player.group.position.x; dz = travel.z - player.group.position.z; if (Math.hypot(dx, dz) < .08) { player.group.position.x=travel.x;player.group.position.z=travel.z;travel = route.shift()||null; ringTarget.visible = !!travel; dx = dz = 0; } }
    const length = Math.hypot(dx, dz);
    if (length > 0) { const speed=travel?Math.min(length,dt*6):dt*6;dx = dx / length * speed; dz = dz / length * speed; const p = player.group.position; let moved = false; if (clearAt(p.x + dx, p.z)) { p.x += dx; moved = true; } if (clearAt(p.x, p.z + dz)) { p.z += dz; moved = true; } if (!moved && travel) { travel = null;route=[]; ringTarget.visible = false; } player.group.rotation.y = Math.atan2(dx, dz); player.left.rotation.x = Math.sin(elapsed * 13) * .45; player.right.rotation.x = -player.left.rotation.x; } else player.left.rotation.x = player.right.rotation.x = 0;
    const pos = player.group.position; pos.y = groundHeight(pos.x,pos.z);
    desiredTarget.copy(player.group.position); const n = zone ? null : Object.entries(entries).filter(([id, e]) => Math.hypot(player.group.position.x - e[0], player.group.position.z - e[1]) < 3.3).sort((a, b) => Math.hypot(player.group.position.x - a[1][0], player.group.position.z - a[1][1]) - Math.hypot(player.group.position.x - b[1][0], player.group.position.z - b[1][1]))[0]?.[0] || null;
    if (n !== near) { near = n; hooks.near?.(CONTENT.places[n]?n:null); }
    const obj=worldObjects().filter(o=>Math.hypot(pos.x-o.x,pos.z-o.z)<2.9).sort((a,b)=>Math.hypot(pos.x-a.x,pos.z-a.z)-Math.hypot(pos.x-b.x,pos.z-b.z))[0]||null;
    if(obj?.id!==nearestObject?.id){nearestObject=obj;hooks.object?.(obj);}
  }
  function preview(place) {
    if (!ready || !coords[place]) return '';
    if (previews[place]) return previews[place];
    if(zone)return '';
    const oldPosition = camera.position.clone(), oldRotation = camera.quaternion.clone(), oldAspect = camera.aspect;
    const [x, z] = coords[place], w = Math.min(host.clientWidth, 600), h = w / 2, d = renderer.getPixelRatio();
    camera.position.set(x + 13, 12, z + 19); camera.lookAt(x, 3, z); camera.aspect = 2; camera.updateProjectionMatrix();
    renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h); renderer.render(scene, camera);
    const target = document.createElement('canvas'); target.width = 480; target.height = 240;
    target.getContext('2d').drawImage(renderer.domElement, 0, renderer.domElement.height - h * d, w * d, h * d, 0, 0, 480, 240);
    previews[place] = target.toDataURL('image/jpeg', .85);
    camera.position.copy(oldPosition); camera.quaternion.copy(oldRotation); camera.aspect = oldAspect; camera.updateProjectionMatrix();
    return previews[place];
  }
  function frame(now) {
    requestAnimationFrame(frame); const dt = Math.min((now - last) / 1000 || 0, .05); last = now;
    if (!active || document.hidden || !ready) return; elapsed += dt;
    const playing = document.getElementById('cinema')?.hidden === false || document.querySelector('dialog[open]');
    if (mode === 'walk' && !playing) stepPlayer(dt);
    if(surveying)desiredTarget.set(zone?0:worldCenter[0],0,zone?0:worldCenter[1]);
    target.lerp(desiredTarget, Math.min(1, dt * 5));
    camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * radius, target.y + Math.sin(pitch) * radius, target.z + Math.cos(yaw) * Math.cos(pitch) * radius); camera.lookAt(target);
    if (worldState.motion) {
      for (const p of people) { p.group.position.z = ((p.origin.z + elapsed * p.speed + 33) % 66) - 33; p.left.rotation.x = Math.sin(elapsed * 6 + p.origin.z) * .28; p.right.rotation.x = -p.left.rotation.x; }
      const positions = water.geometry.attributes.position; for (let i = 0; i < positions.count; i++) positions.setY(i, Math.sin(waterBase[i * 3] * .6 + elapsed) * Math.cos(waterBase[i * 3 + 2] * .5 + elapsed * .7) * .055); positions.needsUpdate = true;
      const cycle = elapsed % 9; scan.scale.setScalar(2 + cycle * 6); scan.material.opacity = cycle < 6 ? (1 - cycle / 6) * .28 : 0;
      for (const m of Object.values(markers)) m.material.opacity = .65 + Math.sin(elapsed * 2) * .25;
      if (rain.visible) { for (let i = 0; i < 500; i++) { const k = i * 6; rainPositions[k + 1] -= dt * 20; if (rainPositions[k + 1] < 0) rainPositions[k + 1] = 28; rainPositions[k + 4] = rainPositions[k + 1] + 1.2; } rainGeometry.attributes.position.needsUpdate = true; }
    }
    scene.fog.near=Math.max(fogBaseNear,radius+70);scene.fog.far=Math.max(450,scene.fog.near+190);
    updateOcclusion();applyOcclusion(true);
    const w = host.clientWidth, h = host.clientHeight; renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h); renderer.render(scene, camera);
    applyOcclusion(false);
    if (mode === 'walk') { const r = miniRect; renderer.setScissorTest(true); renderer.setScissor(r.x, r.y, r.width, r.height); renderer.setViewport(r.x, r.y, r.width, r.height); player.group.scale.setScalar(3); renderer.render(scene, miniCamera); player.group.scale.setScalar(1); renderer.setScissorTest(false); }
    // Pin nodes are re-queried only when the map is rebuilt. Querying the DOM every
    // frame forced a style recalculation for eight elements per frame for nothing.
    if (!pinNodes) pinNodes = [...document.querySelectorAll('#pins-3d [data-place]')];
    const pin = new THREE.Vector3();
    for (const b of pinNodes) {
      const id = b.dataset.place, e = entries[id];
      if (!e) continue;
      pin.set(e[0], mode === 'walk' ? 2.8 : 2, e[1]).project(camera);
      b.style.left = `${(pin.x * .5 + .5) * w}px`; b.style.top = `${(-pin.y * .5 + .5) * h}px`; b.hidden = !!zone || pin.z > 1 || pin.x < -.95 || pin.x > .95 || pin.y < -.95 || pin.y > .9 || mode === 'walk' && Math.hypot(player.group.position.x - e[0], player.group.position.z - e[1]) > 22;
    }
  }
  return { init, update, preview, refreshPins: () => { pinNodes = null; }, setMode, setWeather, moveTo, resize, enterInterior, exitInterior, interact, survey, getZone:()=>zone, getFloor:()=>floor, getPlace:()=>currentPlace, getObject:()=>nearestObject, clearAt, worldObjects, zoom: delta => radius = THREE.MathUtils.clamp(radius + delta, mode === 'walk' ? 12 : 65, mode === 'walk' ? 40 : Math.max(260,overviewRadius())), reset: () => zone?enterInterior(zone,floor):setMode(mode, currentPlace), setActive: value => { active = value; if (!value) { pressed.clear(); travel = null;route=[]; if (ringTarget) ringTarget.visible = false; } }, getMode: () => mode, getNear: () => near, ready: () => ready, controls: (direction, down) => { const code = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' }[direction]; if (down) { pressed.add(code); travel = null;route=[]; } else pressed.delete(code); }, inspect: () => ({ ready, active, mode, zone, floor, currentPlace, bounds:worldBounds, concept:indoor?.concept, weather, player: player?.group.position.toArray(), camera: camera?.position.toArray(), target: target?.toArray(), radius, miniRect, rain: rain?.visible, objects: campusRoot?.children.length, architecture: campusRoot?.children.filter(o=>o.name.startsWith('Architecture_')).map(o=>({...o.userData,batches:o.children.length})), render: {...renderer?.info.render}, waterHeight: water?.position.y, fog: {near:scene?.fog.near,far:scene?.fog.far}, occluded: architectureVisuals.filter(o=>o.faded).map(o=>o.root.name), frameTime: elapsed, near, object:nearestObject?.id, route:route.length }) };
})();
