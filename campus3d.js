'use strict';
globalThis.Campus3D = (() => {
  const coords = { dorm: [-22, -14], hall: [0, -21], library: [23, -17], lake: [-23, 13], gym: [2, 22], lab: [24, 4], gate: [26, 25], plaza: [0, 0] };
  const entries = { dorm: [-22, -8], hall: [0, -14], library: [23, -10], lake: [-35, 2], gym: [-6, 29], lab: [24, 10], gate: [26, 28], plaza: [-24, 36] };
  let scene, renderer, camera, miniCamera, host, hooks, sun, hemi, water, player, scan, rain, ringTarget, lamps = [], markers = {}, colliders = [];
  let mode = 'overview', active = true, weather = 'auto', worldNight = false, yaw = .08, pitch = .84, radius = 96, target, desiredTarget, last = 0, elapsed = 0, currentPlace = 'dorm', pointer = null, travel = null, pressed = new Set(), ready = false, near = null;
  let people = [], windowMaterials = [], rainPositions, rainGeometry, worldState = { available: [], selected: 'dorm', night: false, motion: true }, waterBase, miniRect, keysEnabled = true;
  const T = () => window.THREE;
  const mat = (c, roughness = .85) => new THREE.MeshStandardMaterial({ color: c, roughness });
  let white, stone, roofMat, glass, pavement, road, treeMat, trunkMat, brass;
  const geometries = {};
  const previews = {};
  let campusRoot, zone = null, indoor = null, outsideColliders, outsideVisuals, nearestObject = null, returnPoint, route = [];
  const interiors = {};
  let surveying=false;
  const worldObjects = () => zone ? Exploration.objects(zone) : [...Exploration.outdoor, ...Object.entries(entries).map(([id,[x,z]])=>({id:id+'-door',type:'door',name:'进入 · '+Exploration.regions[id].name,x,z,destination:id}))];
  function mesh(geo, material, x, y, z, parent = scene) { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
  function box(w, h, d, material, x, y, z, parent) { return mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent); }
  function cylinder(r, h, material, x, y, z, parent, count = 16) { return mesh(new THREE.CylinderGeometry(r, r, h, count), material, x, y, z, parent); }
  function facade(color, isGlass) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const c = canvas.getContext('2d'); c.fillStyle = color; c.fillRect(0, 0, 256, 256);
    for (let y = 20; y < 250; y += 52) for (let x = 14; x < 250; x += 31) {
      c.fillStyle = '#b8c3bd'; c.fillRect(x - 2, y - 2, 22, 34); c.fillStyle = isGlass ? '#789e9a' : '#6a817c'; c.fillRect(x, y, 18, 29);
      c.fillStyle = '#bed6c658'; c.fillRect(x + 2, y + 1, 6, 26); c.fillStyle = '#d3d6cb'; c.fillRect(x, y + 14, 18, 2);
    }
    const tex = new THREE.CanvasTexture(canvas); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: isGlass ? .3 : .8, metalness: isGlass ? .25 : 0, emissive: '#d5b974', emissiveIntensity: 0 }); windowMaterials.push(m); return m;
  }
  function building(x, z, w, d, h, style = 'brick') {
    const front = facade(style === 'brick' ? '#a88470' : style === 'glass' ? '#66928c' : '#d5d3be', style === 'glass');
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    box(w + .7, .5, d + .7, stone, 0, .26, 0, g);
    const main = box(w, h, d, [front, front, white, stone, front, front], 0, h / 2 + .5, 0, g);
    box(w + .5, .28, d + .5, white, 0, h + .65, 0, g);
    if (style === 'brick') {
      const geo = new THREE.ConeGeometry(1, 2, 4); geo.rotateY(Math.PI / 4);
      const r = mesh(geo, roofMat, 0, h + 1.7, 0, g); r.scale.set((w + 1) / Math.sqrt(2), 1, (d + 1) / Math.sqrt(2));
    } else {
      box(w * .65, .35, d * .58, style === 'glass' ? glass : stone, 0, h + 1, 0, g);
      for (let i = -1; i <= 1; i++) box(1.3, .6, 1.3, stone, i * 2, h + 1.2, 0, g);
    }
    box(2.3, 2.2, .15, glass, 0, 1.6, d / 2 + .07, g); box(3, .2, 2, white, 0, 2.8, d / 2 + .8, g);
    for (let i = 0; i < 3; i++) box(3.6, .15, .5, stone, 0, .12 + .15 * i, d / 2 + 1.65 - i * .5, g);
    colliders.push({ x, z, w: w / 2 + .6, d: d / 2 + .6 }); return main;
  }
  function tree(x, z, scale = 1) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(scale); scene.add(g);
    cylinder(.15, 2.5, trunkMat, 0, 1.25, 0, g, 6);
    const canopy = mesh(geometries.foliage, treeMat, 0, 3.2, 0, g); canopy.scale.set(1.1, 1.3, 1.1);
    mesh(geometries.foliage, treeMat, .65, 3, 0, g).scale.setScalar(.8);
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
  function line(points, color = '#ece6cb') {
    const geo = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)));
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color })); scene.add(l); return l;
  }
  function build() {
    white = mat('#e1dec9'); stone = mat('#bcbfae'); roofMat = mat('#995c4e'); glass = mat('#467d7c', .25); pavement = mat('#c7c8b5'); road = mat('#748178'); treeMat = mat('#537953'); trunkMat = mat('#7a6551'); brass = mat('#3f4b43');
    geometries.foliage = new THREE.IcosahedronGeometry(1.3, 1);
    box(180, .3, 180, mat('#70856c'), 0, -.4, 0);
    box(86, .25, 79, mat('#8fa077'), 0, -.1, 0);
    box(7, .12, 78, pavement, 0, .04, 0); box(82, .12, 5, pavement, 0, .04, 9); box(82, .12, 5, pavement, 0, .04, -8);
    box(4, .12, 68, pavement, -12, .04, -2); box(4, .12, 68, pavement, 14, .04, -2); box(4, .1, 68, pavement, 34, .04, -1);
    box(89, .08, 6, road, 0, .03, 39);
    for (let x = -41; x < 42; x += 4) box(2, .02, .14, white, x, .09, 39);
    building(-22, -15, 13, 7, 6.2); building(-25, -28, 16, 6, 6.7); building(-36, -16, 6, 12, 5.5);
    if (!window.CLOCKTOWER_MESH) {
    building(0, -23, 19, 7, 6.5, 'stone');
    box(3.4, 13, 3.4, white, 0, 6.5, -20.7); box(4, .5, 4, stone, 0, 12.6, -20.7);
    const towerRoof = mesh(new THREE.ConeGeometry(3.3, 2.3, 4), roofMat, 0, 14, -20.7); towerRoof.rotation.y = Math.PI / 4;
    const clockCanvas = document.createElement('canvas'); clockCanvas.width = clockCanvas.height = 128; const cc = clockCanvas.getContext('2d'); cc.fillStyle = '#e9e5d0'; cc.fillRect(0, 0, 128, 128); cc.strokeStyle = '#34423e'; cc.lineWidth = 5; cc.beginPath(); cc.arc(64, 64, 52, 0, Math.PI * 2); cc.stroke(); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; cc.beginPath(); cc.moveTo(64 + Math.sin(a) * 42, 64 + Math.cos(a) * 42); cc.lineTo(64 + Math.sin(a) * 48, 64 + Math.cos(a) * 48); cc.stroke(); } cc.beginPath(); cc.moveTo(64, 26); cc.lineTo(64, 64); cc.lineTo(90, 78); cc.stroke();
    const clockTex = new THREE.CanvasTexture(clockCanvas); clockTex.encoding = THREE.sRGBEncoding;
    mesh(new THREE.PlaneGeometry(2.5, 2.5), new THREE.MeshStandardMaterial({ map: clockTex }), 0, 10.5, -18.97);
    } else {
      const landmark = new THREE.Group(); landmark.name = 'Blender_Clocktower'; landmark.position.set(0, 0, -23); scene.add(landmark);
      for (const part of CLOCKTOWER_MESH) {
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3)); geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({ color: new THREE.Color().fromArray(part.color), roughness: part.name.includes('glass') ? .25 : .75, metalness: part.name.includes('brass') ? .55 : 0 });
        const object = new THREE.Mesh(geometry, material); object.name = part.name; object.castShadow = object.receiveShadow = true; landmark.add(object);
      }
      colliders.push({ x: 0, z: -23, w: 10.6, d: 4.4 });
    }
    building(24, -20, 17, 12, 8.2, 'glass'); building(24, 1, 14, 8, 5.8, 'stone'); building(34, 20, 8, 6, 4); building(24, 23, 9, 6, 3.8);
    building(-35,-2,8,5,3.5,'stone'); building(-7,22,5,10,4.2,'stone'); building(-24,32,10,5,3.8);
    box(1, 5, 1, white, 20, 2.5, 33); box(1, 5, 1, white, 32, 2.5, 33); box(13, .9, 1.1, stone, 26, 4.6, 33);
    const signCanvas = document.createElement('canvas'); signCanvas.width = 512; signCanvas.height = 64; const sc = signCanvas.getContext('2d'); sc.fillStyle = '#c5c8b6'; sc.fillRect(0, 0, 512, 64); sc.fillStyle = '#374c40'; sc.font = '38px Microsoft YaHei'; sc.textAlign = 'center'; sc.fillText('江 城 大 学', 256, 46); const signTex = new THREE.CanvasTexture(signCanvas); signTex.encoding = THREE.sRGBEncoding; mesh(new THREE.PlaneGeometry(10, 1.25), new THREE.MeshStandardMaterial({ map: signTex }), 26, 4.55, 33.57);
    cylinder(6.5, .12, pavement, 0, .15, 1, scene, 64); cylinder(3.4, .65, stone, 0, .4, 1, scene, 48); cylinder(2.95, .18, glass, 0, .76, 1, scene, 48); cylinder(.5, 1.1, white, 0, 1.2, 1); cylinder(1.35, .2, stone, 0, 1.72, 1);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const points = []; for (let j = 0; j <= 12; j++) { const f = j / 12; points.push([Math.cos(a) * f * 2.5, .8 + Math.sin(f * Math.PI) * 2, 1 + Math.sin(a) * f * 2.5]); } line(points, '#b9d9d6'); }
    const waterGeo = new THREE.CircleGeometry(12.4, 64, 0, Math.PI * 2); waterGeo.rotateX(-Math.PI / 2); waterBase = waterGeo.attributes.position.array.slice();
    water = mesh(waterGeo, new THREE.MeshStandardMaterial({ color: '#4b9190', metalness: .45, roughness: .2, transparent: true, opacity: .94 }), -26, .06, 16); water.scale.z = 1.25; water.receiveShadow = true; water.castShadow = false;
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
    for (let i = 0; i < 20; i++) { const p = person(i % 2 ? -2 : 2, -30 + i * 3.1, ['#bd9a72', '#7898a2', '#c4b2a1', '#a78287'][i % 4]); p.origin = p.group.position.clone(); p.speed = .25 + i % 3 * .1; people.push(p); }
    player = person(-22, -3, '#5078a5', true);
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
      camera = new THREE.PerspectiveCamera(42, 1, .2, 600);camera.layers.enable(1); miniCamera = new THREE.OrthographicCamera(-62, 47, 40, -40, .1, 180); miniCamera.position.set(0, 90, 0); miniCamera.up.set(0, 0, -1); miniCamera.lookAt(0, 0, 0);
      target = new THREE.Vector3(0, 0, 1); desiredTarget = target.clone();
      hemi = new THREE.HemisphereLight('#edf1dc', '#647b65', 1.15); scene.add(hemi);
      sun = new THREE.DirectionalLight('#fff0cd', 2.4); sun.position.set(-30, 55, 30); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -55; sun.shadow.camera.right = 55; sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55; sun.shadow.camera.far = 150; sun.shadow.bias = -.0005; sun.shadow.normalBias = .035; scene.add(sun);
      build();
      campusRoot=new THREE.Group();campusRoot.name='Campus_Exterior';
      for(const child of [...scene.children])if(child!==sun&&child!==hemi&&child!==player.group&&child!==ringTarget)campusRoot.add(child);
      scene.add(campusRoot);
      const dressing=WorldArt.outdoor(campusRoot);colliders.push(...dressing.colliders);outsideColliders=colliders;outsideVisuals=dressing.visuals;
      player.group.visible = false; wire(); ready = true; resize(); setWeather('auto'); requestAnimationFrame(frame); return true;
    } catch (err) { renderer?.dispose(); renderer?.domElement.remove(); hooks.error?.(err); return false; }
  }
  function update(data) { worldState = { ...worldState, ...data }; if (worldNight !== worldState.night && weather === 'auto') setWeather('auto'); for (const [id, marker] of Object.entries(markers)) marker.visible = worldState.available.some(n => CONTENT.nodes[n].place === id); WorldArt.refresh(outsideVisuals,worldState.exploration);if(indoor)WorldArt.refresh(indoor.visuals,worldState.exploration); }
  function setWeather(value) {
    if (!ready) return; weather = value; worldNight = worldState.night; for (const key of Object.keys(previews)) delete previews[key];
    const night = value === 'night' || value === 'rain' || value === 'auto' && worldNight, wet = value === 'rain' || value === 'auto' && worldNight;
    scene.background.set(night ? '#394e49' : '#becdc5'); scene.fog.color.copy(scene.background); scene.fog.near = night ? 190 : 260; scene.fog.far = 450;
    hemi.intensity = night ? .45 : .65; sun.intensity = night ? .35 : 1.15; sun.color.set(night ? '#b2d4d6' : '#fff0cd'); renderer.toneMappingExposure = night ? .8 : .85;
    rain.visible = wet; for (const m of lamps) m.emissiveIntensity = night ? 3 : .2; for (const m of windowMaterials) m.emissiveIntensity = night ? .24 : 0;
    water.material.roughness = wet ? .12 : .25; hooks.weather?.(night, wet); return { night, wet };
  }
  function enterInterior(id) {
    if(!ready||!Exploration.regions[id]||mode!=='walk')return false;
    if(!zone)returnPoint=player.group.position.clone();
    if(indoor)indoor.root.visible=false;
    surveying=false;zone=id; currentPlace=id; indoor=interiors[id] ||= WorldArt.interior(id);scene.add(indoor.root);indoor.root.visible=true;campusRoot.visible=false;colliders=indoor.colliders;
    player.group.position.set(0,.2,10.5);target.copy(player.group.position);desiredTarget.copy(target);radius=31;yaw=0;pitch=1.03;
    pressed.clear();travel=null;route=[];ringTarget.visible=false;nearestObject=null;near=null;hooks.near?.(null);hooks.object?.(null);
    miniCamera.left=-20;miniCamera.right=20;miniCamera.top=16;miniCamera.bottom=-16;miniCamera.updateProjectionMatrix();
    hemi.intensity=.95;sun.intensity=1.5;scene.background.set('#263e49');
    document.body.classList.add('inside');hooks.zone?.(id);WorldArt.refresh(indoor.visuals,worldState.exploration);return true;
  }
  function exitInterior() {
    if(!zone)return false;
    surveying=false;indoor.root.visible=false;campusRoot.visible=true;colliders=outsideColliders;zone=null;indoor=null;
    player.group.position.copy(returnPoint||new THREE.Vector3(0,.18,7));target.copy(player.group.position);desiredTarget.copy(target);radius=27;pitch=.86;
    pressed.clear();travel=null;route=[];ringTarget.visible=false;nearestObject=null;near=null;
    miniCamera.left=-62;miniCamera.right=47;miniCamera.top=40;miniCamera.bottom=-40;miniCamera.updateProjectionMatrix();setWeather(weather);
    document.body.classList.remove('inside');hooks.zone?.(null);hooks.object?.(null);return true;
  }
  function interact() { if(active&&mode==='walk'&&nearestObject)hooks.interact?.(nearestObject); }
  function survey() { surveying=!surveying;radius=surveying?(zone?(host.clientWidth<800?90:62):(host.clientWidth<800?225:112)):(zone?31:27);pitch=surveying?1.18:(zone?1.03:.88);yaw=0; }
  function setMode(next, place = currentPlace) {
    if(zone)exitInterior();surveying=false;
    if (!ready || !entries[place] || !['walk', 'overview'].includes(next)) return; mode = next; pressed.clear(); travel = null; ringTarget.visible = false; near = null; currentPlace = place;
    if (next === 'walk') { const e = entries[place],spawn=[[e[0],e[1]+3],[e[0],e[1]+1],[e[0]+3,e[1]],e].find(([x,z])=>clearAt(x,z))||e; player.group.position.set(spawn[0],0,spawn[1]); desiredTarget.copy(player.group.position); radius = 27; yaw = .1; pitch = .88; }
    else { desiredTarget.set(0, 0, -1); radius = host.clientWidth < 800 ? 225 : 112; yaw = .08; pitch = .92; }
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
    if (x < -57 || x > 42 || z < -36 || z > 37) return false;
    if (colliders.some(c => Math.abs(x - c.x) < c.w && Math.abs(z - c.z) < c.d)) return false;
    const inLake = ((x + 26) / 12.8) ** 2 + ((z - 16) / 15.8) ** 2 < 1; return !inLake || Math.abs(z - 17) < .95;
  }
  function moveTo(x, z) {
    if (!clearAt(x, z)) return false;
    const sx=Math.round(player.group.position.x),sz=Math.round(player.group.position.z),gx=Math.round(x),gz=Math.round(z),key=(a,b)=>a+','+b;
    const queue=[[sx,sz]],came=new Map([[key(sx,sz),null]]);let found=null;
    for(let i=0;i<queue.length&&i<16000;i++){
      const [cx,cz]=queue[i];if(cx===gx&&cz===gz){found=[cx,cz];break;}
      for(const [dx,dz] of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
        const nx=cx+dx,nz=cz+dz,k=key(nx,nz);if(came.has(k)||!clearAt(nx,nz)||!clearAt(cx+dx,cz)||!clearAt(cx,cz+dz))continue;
        if([.2,.4,.6,.8].some(t=>!clearAt(cx+dx*t,cz+dz*t)))continue;
        came.set(k,[cx,cz]);queue.push([nx,nz]);
      }
    }
    if(!found)return false;const path=[];for(let p=found;p;p=came.get(key(...p)))path.push(new THREE.Vector3(p[0],0,p[1]));path.reverse();path.shift();path.push(new THREE.Vector3(x,0,z));
    route=path;travel=route.shift();ringTarget.position.set(x,.23,z);ringTarget.visible=true;return true;
  }
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
    canvas.addEventListener('wheel', e => { e.preventDefault(); radius = THREE.MathUtils.clamp(radius + e.deltaY * .04, mode === 'walk' ? 12 : 65, mode === 'walk' ? 40 : 260); }, { passive: false });
    document.addEventListener('keydown', e => { if (!active || !keysEnabled || mode !== 'walk' || document.querySelector('dialog[open]') || document.getElementById('cinema')?.hidden === false || /INPUT|TEXTAREA/.test(e.target.tagName)) return; if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'KeyE'].includes(e.code)) { e.preventDefault(); if (e.code === 'KeyE') { if(!e.repeat)interact(); } else { pressed.add(e.code); travel = null;route=[]; } } });
    document.addEventListener('keyup', e => pressed.delete(e.code)); window.addEventListener('blur', () => pressed.clear()); window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { if (document.hidden) pressed.clear(); });
  }
  function resize() {
    if (!ready) return; const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    const frame = document.getElementById('mini-frame')?.getBoundingClientRect(), bounds = host.getBoundingClientRect();
    miniRect = frame && frame.width ? { x: frame.left - bounds.left + 2, y: h - (frame.bottom - bounds.top) + 2, width: frame.width - 4, height: frame.height - 4 } : { x: w - 218, y: h - 320, width: 188, height: 140 };
  }
  function stepPlayer(dt) {
    let dx = 0, dz = 0; if (pressed.has('KeyW') || pressed.has('ArrowUp')) dz -= 1; if (pressed.has('KeyS') || pressed.has('ArrowDown')) dz += 1; if (pressed.has('KeyA') || pressed.has('ArrowLeft')) dx -= 1; if (pressed.has('KeyD') || pressed.has('ArrowRight')) dx += 1;
    if (dx || dz) { const x = dx * Math.cos(yaw) + dz * Math.sin(yaw), z = dz * Math.cos(yaw) - dx * Math.sin(yaw); dx = x; dz = z; }
    else if (travel) { dx = travel.x - player.group.position.x; dz = travel.z - player.group.position.z; if (Math.hypot(dx, dz) < .08) { player.group.position.x=travel.x;player.group.position.z=travel.z;travel = route.shift()||null; ringTarget.visible = !!travel; dx = dz = 0; } }
    const length = Math.hypot(dx, dz);
    if (length > 0) { const speed=travel?Math.min(length,dt*6):dt*6;dx = dx / length * speed; dz = dz / length * speed; const p = player.group.position; let moved = false; if (clearAt(p.x + dx, p.z)) { p.x += dx; moved = true; } if (clearAt(p.x, p.z + dz)) { p.z += dz; moved = true; } if (!moved && travel) { travel = null;route=[]; ringTarget.visible = false; } player.group.rotation.y = Math.atan2(dx, dz); player.left.rotation.x = Math.sin(elapsed * 13) * .45; player.right.rotation.x = -player.left.rotation.x; } else player.left.rotation.x = player.right.rotation.x = 0;
    const pos = player.group.position; pos.y = zone?.22:Math.abs(pos.z - 17) < 1.1 && pos.x > -36 && pos.x < -14 ? .73 : WorldArt.height(pos.x,pos.z);
    desiredTarget.copy(player.group.position); const n = zone ? null : Object.entries(entries).filter(([id, e]) => Math.hypot(player.group.position.x - e[0], player.group.position.z - e[1]) < 3.3).sort((a, b) => Math.hypot(player.group.position.x - a[1][0], player.group.position.z - a[1][1]) - Math.hypot(player.group.position.x - b[1][0], player.group.position.z - b[1][1]))[0]?.[0] || null;
    if (n !== near) { near = n; hooks.near?.(n); }
    const obj=worldObjects().filter(o=>Math.hypot(pos.x-o.x,pos.z-o.z)<2.9).sort((a,b)=>Math.hypot(pos.x-a.x,pos.z-a.z)-Math.hypot(pos.x-b.x,pos.z-b.z))[0]||null;
    if(obj?.id!==nearestObject?.id){nearestObject=obj;hooks.object?.(obj);}
  }
  function preview(place) {
    if (!ready || !coords[place]) return '';
    if (previews[place]) return previews[place];
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
    if(surveying)desiredTarget.set(0,0,0);
    target.lerp(desiredTarget, Math.min(1, dt * 5));
    camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * radius, target.y + Math.sin(pitch) * radius, target.z + Math.cos(yaw) * Math.cos(pitch) * radius); camera.lookAt(target);
    if (worldState.motion) {
      for (const p of people) { p.group.position.z = ((p.origin.z + elapsed * p.speed + 33) % 66) - 33; p.left.rotation.x = Math.sin(elapsed * 6 + p.origin.z) * .28; p.right.rotation.x = -p.left.rotation.x; }
      const positions = water.geometry.attributes.position; for (let i = 0; i < positions.count; i++) positions.setY(i, Math.sin(waterBase[i * 3] * .6 + elapsed) * Math.cos(waterBase[i * 3 + 2] * .5 + elapsed * .7) * .055); positions.needsUpdate = true;
      const cycle = elapsed % 9; scan.scale.setScalar(2 + cycle * 6); scan.material.opacity = cycle < 6 ? (1 - cycle / 6) * .28 : 0;
      for (const m of Object.values(markers)) m.material.opacity = .65 + Math.sin(elapsed * 2) * .25;
      if (rain.visible) { for (let i = 0; i < 500; i++) { const k = i * 6; rainPositions[k + 1] -= dt * 20; if (rainPositions[k + 1] < 0) rainPositions[k + 1] = 28; rainPositions[k + 4] = rainPositions[k + 1] + 1.2; } rainGeometry.attributes.position.needsUpdate = true; }
    }
    const w = host.clientWidth, h = host.clientHeight; renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h); renderer.render(scene, camera);
    if (mode === 'walk') { const r = miniRect; renderer.setScissorTest(true); renderer.setScissor(r.x, r.y, r.width, r.height); renderer.setViewport(r.x, r.y, r.width, r.height); player.group.scale.setScalar(3); renderer.render(scene, miniCamera); player.group.scale.setScalar(1); renderer.setScissorTest(false); }
    for (const b of document.querySelectorAll('#pins-3d [data-place]')) {
      const id = b.dataset.place, e = entries[id], p = new THREE.Vector3(e[0], mode === 'walk' ? 2.8 : 2, e[1]); p.project(camera);
      b.style.left = `${(p.x * .5 + .5) * w}px`; b.style.top = `${(-p.y * .5 + .5) * h}px`; b.hidden = !!zone || p.z > 1 || p.x < -.95 || p.x > .95 || p.y < -.95 || p.y > .9 || mode === 'walk' && Math.hypot(player.group.position.x - e[0], player.group.position.z - e[1]) > 22;
    }
  }
  return { init, update, preview, setMode, setWeather, moveTo, resize, enterInterior, exitInterior, interact, survey, getZone:()=>zone, getObject:()=>nearestObject, clearAt, worldObjects, zoom: delta => radius = THREE.MathUtils.clamp(radius + delta, mode === 'walk' ? 12 : 65, mode === 'walk' ? 40 : 260), reset: () => zone?enterInterior(zone):setMode(mode, currentPlace), setActive: value => { active = value; if (!value) { pressed.clear(); travel = null;route=[]; if (ringTarget) ringTarget.visible = false; } }, getMode: () => mode, getNear: () => near, ready: () => ready, controls: (direction, down) => { const code = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' }[direction]; if (down) { pressed.add(code); travel = null;route=[]; } else pressed.delete(code); }, inspect: () => ({ ready, active, mode, zone, weather, player: player?.group.position.toArray(), camera: camera?.position.toArray(), radius, miniRect, rain: rain?.visible, objects: campusRoot?.children.length, frameTime: elapsed, near, object:nearestObject?.id, route:route.length }) };
})();
