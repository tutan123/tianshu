async (browserPage) => {
  const c=await browserPage.context().browser().newContext({viewport:{width:1440,height:960}}), p=await c.newPage(), checks=[], errors=[];
  const assert=(value,name)=>{if(!value)throw new Error(name);checks.push(name);};
  p.on('pageerror',e=>errors.push(e.message));
  const shot=name=>p.screenshot({path:'G:/Projects/Agent/Agent Cli/天枢/天枢-WebDemo-v3.0/tests/screenshots/'+name+'.png'});
  const current=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('tianshu-v3-auto')));
  async function approach(id){
    const path=await p.evaluate(id=>{const o=Campus3D.worldObjects().find(o=>o.id===id);return !!o&&Campus3D.moveTo(o.x,o.z);},id);
    assert(path,'Reachable path: '+id);
    await p.waitForFunction(id=>Campus3D.getObject()?.id===id,id,{timeout:16000});
    await p.locator('#world-interact').click();
  }
  try{
    await p.goto('file:///G:/Projects/Agent/Agent%20Cli/天枢/天枢-WebDemo-v3.0/index.html');
    await p.waitForFunction(()=>Campus3D.ready());await p.waitForTimeout(700);await shot('exploration-campus');
    for(const zone of ['dorm','hall','library','lake','gym','lab','gate','plaza']){
      await p.evaluate(z=>Campus3D.setMode('walk',z),zone);await approach(zone+'-door');
      assert(await p.evaluate(()=>Campus3D.getZone())===zone,'Door enters '+zone);
      const paths=await p.evaluate(()=>Campus3D.worldObjects().map(o=>({id:o.id,reachable:Campus3D.moveTo(o.x,o.z)})));
      assert(paths.every(o=>o.reachable),'All interactive targets have routes in '+zone+': '+JSON.stringify(paths.filter(o=>!o.reachable)));
      await approach(zone+'-stamp');assert((await current()).rpg.world.stamps.includes(zone),'Walk and collect '+zone+' stamp');
      await p.locator('#world-dialog-close').click();
      if(zone==='hall'){await shot('exploration-hall-local');await p.locator('#floor-map').click();await p.waitForTimeout(600);await shot('exploration-hall-floor');}
      await p.locator('#exit-walk').click();assert(await p.evaluate(()=>Campus3D.getZone())===null,'Exit returns to campus: '+zone);
    }
    await p.evaluate(()=>{Campus3D.setMode('walk','plaza');Campus3D.enterInterior('plaza');});await approach('plaza-curator');
    assert((await current()).rpg.world.claimed && (await current()).rpg.owned.includes('pendant'),'Eight stamps award unique pendant');
    await p.locator('#world-dialog-close').click();
    await p.evaluate(()=>{Campus3D.setMode('walk','lab');Campus3D.enterInterior('lab');});await approach('lab-cache');
    assert((await p.locator('#world-dialog-text').innerText()).includes('没有供电'),'Electronic chest starts locked');await p.locator('#world-dialog-close').click();
    await approach('lab-switch');await p.locator('#world-dialog-close').click();await approach('lab-cache');
    assert((await current()).rpg.world.opened.includes('lab-cache'),'Power switch unlocks chest through UI');const cash=(await current()).stats.cash;await p.locator('#world-dialog-close').click();
    await p.locator('#world-interact').click();assert((await current()).stats.cash===cash,'Reopening chest cannot duplicate currency');await p.locator('#world-dialog-close').click();
    await approach('lab-npc');assert((await p.locator('#world-dialog-text').innerText()).includes('配电'),'NPC dialogue carries puzzle clue');await p.locator('#world-dialog-close').click();
    await p.setViewportSize({width:390,height:844});await p.waitForTimeout(400);await shot('exploration-mobile-room');
    const bounds=await p.evaluate(()=>{const a=document.querySelector('.direction-pad').getBoundingClientRect(),b=document.querySelector('#world-interact').getBoundingClientRect();return {separate:a.right<=b.left,overflow:document.documentElement.scrollWidth>innerWidth};});
    assert(bounds.separate&&!bounds.overflow,'Mobile controls do not overlap or overflow');
    await p.locator('#floor-map').click();await p.waitForTimeout(700);await shot('exploration-mobile-floor');
    const floorFramed=await p.evaluate(()=>{
      const info=Campus3D.inspect(),camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.2,600);camera.position.fromArray(info.camera);camera.lookAt(0,0,0);camera.updateMatrixWorld();
      return [[-18,-14],[18,-14],[-18,14],[18,14]].every(([x,z])=>Math.abs(new THREE.Vector3(x,0,z).project(camera).x)<.96);
    });
    assert(floorFramed,'Entire indoor floor fits a narrow mobile viewport');
    assert(await p.evaluate(()=>!Campus3D.clearAt(-13,8)),'Laboratory workbench blocks walking through it');
    await p.reload();assert((await current()).rpg.world.claimed&&(await current()).rpg.world.opened.includes('lab-cache'),'Reload preserves quest, stamps, switch and chest');
    assert(errors.length===0,'No uncaught errors during exploration');
    return {success:true,testedAt:new Date().toISOString(),checks,errors};
  }catch(e){await shot('exploration-failure');return {success:false,checks,errors,error:e.stack,state:await p.evaluate(()=>Campus3D.inspect())};}finally{await c.close();}
}
