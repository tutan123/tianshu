async (browserPage) => {
  const c=await browserPage.context().browser().newContext({viewport:{width:1440,height:960}}),p=await c.newPage(),checks=[],errors=[],network=[];
  const assert=(v,name)=>{if(!v)throw new Error(name);checks.push(name);};
  const shot=name=>p.screenshot({path:'G:/Projects/Agent/Agent Cli/天枢/天枢-WebDemo-v3.0/tests/screenshots/'+name+'.png'});
  p.on('pageerror',e=>errors.push(e.message));
  p.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  async function pixels(){return p.evaluate(()=>{
    const source=document.querySelector('#campus-canvas'),copy=document.createElement('canvas');copy.width=160;copy.height=100;const ctx=copy.getContext('2d');ctx.drawImage(source,0,0,160,100);
    const rgba=ctx.getImageData(0,0,160,100).data,colors=new Set(),main=new Set(),mini=new Set(),r=Campus3D.inspect().miniRect,host=document.querySelector('#map3d');let bright=0;
    for(let i=0;i<rgba.length;i+=4){const key=(rgba[i]>>4)+','+(rgba[i+1]>>4)+','+(rgba[i+2]>>4),x=(i/4)%160,y=Math.floor(i/640);colors.add(key);if(rgba[i]+rgba[i+1]+rgba[i+2]>120)bright++;if(x>40&&x<120&&y>42&&y<72)main.add(key);if(x>r.x/host.clientWidth*160&&x<(r.x+r.width)/host.clientWidth*160&&y>(host.clientHeight-r.y-r.height)/host.clientHeight*100&&y<(host.clientHeight-r.y)/host.clientHeight*100)mini.add(key);}
    return{colors:colors.size,bright,main:main.size,mini:mini.size};
  });}
  try{
    await p.goto('file:///G:/Projects/Agent/Agent%20Cli/天枢/天枢-WebDemo-v3.0/index.html');
    await p.waitForFunction(()=>Campus3D.ready());await p.waitForTimeout(1500);
    const info=await p.evaluate(()=>Campus3D.inspect());
    assert(info.architecture.length===11,'Eleven exterior buildings including annexes use detailed architecture');
    assert(new Set(info.architecture.map(a=>a.kind)).size===8,'Eight different architectural types are present');
    assert(info.architecture.every(a=>a.parts>=40),'Every building has modeled architectural details');
    let pix=await pixels();assert(pix.colors>60&&pix.bright>8000,'Desktop campus canvas contains a visible nonblank scene');await shot('architecture-campus');
    for(const zone of ['dorm','hall','library','lake','gym','lab','gate','plaza']){
      await p.evaluate(z=>{Campus3D.setMode('walk',z);Campus3D.zoom(10);},zone);await p.waitForTimeout(1400);await shot('architecture-'+zone);
      if(zone==='library')assert((await p.evaluate(()=>Campus3D.inspect())).occluded.includes('Architecture_lab'),'Foreground laboratory fades instead of hiding the player');
      assert(await p.evaluate(()=>{const s=Campus3D.inspect();return Campus3D.clearAt(s.player[0],s.player[2]);}),'Spawn outside '+zone+' is walkable');
      const moved=await p.evaluate(z=>{const o=Campus3D.worldObjects().find(o=>o.id===z+'-door');return Campus3D.moveTo(o.x,o.z);},zone);
      assert(moved,'Route reaches remodeled '+zone+' entrance');
      await p.waitForFunction(z=>Campus3D.getObject()?.id===z+'-door',zone,{timeout:16000});
      await p.locator('#world-interact').click();assert(await p.evaluate(()=>Campus3D.getZone())===zone,'Remodeled entrance opens '+zone);
      await p.locator('#exit-walk').click();
    }
    await p.evaluate(()=>{Campus3D.setMode('walk','library');Campus3D.zoom(10);Campus3D.setWeather('night');});await p.waitForTimeout(1500);await shot('architecture-night');
    pix=await pixels();assert(pix.colors>40&&pix.bright>1000,'Night architecture is nonblank and remains readable');
    await p.evaluate(()=>Campus3D.setWeather('rain'));await p.waitForTimeout(500);assert(await p.evaluate(()=>Campus3D.inspect().rain),'Rain remains active with detailed architecture');
    await p.setViewportSize({width:390,height:844});await p.evaluate(()=>{Campus3D.setWeather('day');Campus3D.setMode('walk','dorm');});await p.waitForTimeout(1500);await shot('architecture-mobile');
    pix=await pixels();assert(pix.colors>40&&pix.bright>5000,'Mobile main scene and minimap are nonblank');
    assert(pix.main>12&&pix.mini>15,'Main view and minimap independently contain rendered geometry');
    assert(await p.evaluate(()=>Campus3D.inspect().waterHeight>.1),'Lake wave troughs remain above the campus ground');
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile interface stays within viewport');
    assert(errors.length===0,'Architecture has no uncaught page errors');
    assert(network.length===0,'Architecture remains offline without external asset requests');
    await p.evaluate(()=>Campus3D.setMode('overview','dorm'));await p.waitForTimeout(1500);await shot('architecture-mobile-overview');
    assert(await p.evaluate(()=>{
      const s=Campus3D.inspect(),camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.2,600);camera.position.fromArray(s.camera);camera.lookAt(...(s.target||[0,0,-1]));camera.updateMatrixWorld();
      return [[-57,-36],[42,-36],[-57,37],[42,37]].every(([x,z])=>{const p=new THREE.Vector3(x,0,z).project(camera);return Math.abs(p.x)<.95&&Math.abs(p.y)<.95;});
    }),'Mobile campus overview includes the entire woodland and east campus');
    assert(await p.evaluate(()=>{const s=Campus3D.inspect();return s.fog.near>s.radius+45;}),'Overview camera fitting does not wash the campus out in distance fog');
    return {success:true,testedAt:new Date().toISOString(),checks,errors,architecture:info.architecture};
  }catch(e){await shot('architecture-failure');return{success:false,checks,errors,error:e.stack,state:await p.evaluate(()=>Campus3D.inspect())};}finally{await c.close();}
}
