async (browserPage) => {
  const c=await browserPage.context().browser().newContext({viewport:{width:1440,height:960}}),p=await c.newPage(),checks=[],errors=[],routes=[];
  p.on('pageerror',e=>errors.push(e.message));
  const assert=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label);};
  const shot=name=>p.screenshot({path:'G:/Projects/Agent/Agent Cli/天枢/天枢-WebDemo-v3.0/tests/screenshots/expansion-'+name+'.png'});
  async function approach(id){assert(await p.evaluate(id=>{const o=Campus3D.worldObjects().find(o=>o.id===id);return !!o&&Campus3D.moveTo(o.x,o.z);},id),'Route '+id);await p.waitForFunction(id=>Campus3D.getObject()?.id===id,id,{timeout:25000});await p.locator('#world-interact').click();}
  const pixels=()=>p.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=100;const g=c.getContext('2d');g.drawImage(document.getElementById('campus-canvas'),0,0,100,100);const a=g.getImageData(0,0,100,100).data,colors=new Set();for(let i=0;i<a.length;i+=4)colors.add([a[i]>>4,a[i+1]>>4,a[i+2]>>4].join(','));return colors.size;});
  try{
    await p.goto('file:///G:/Projects/Agent/Agent%20Cli/天枢/天枢-WebDemo-v3.0/index.html');await p.waitForFunction(()=>Campus3D.ready());await p.waitForTimeout(800);await shot('world-desktop');
    assert(await pixels()>70,'Expanded desktop canvas is nonblank');
    assert(await p.evaluate(()=>{const b=Campus3D.inspect().bounds;return (b.maxX-b.minX)*(b.maxZ-b.minZ)>99*73*4;}),'World boundary area is over four times larger');
    await p.locator('#district-destination').selectOption('hall');
    for(const b of await p.evaluate(()=>WorldDistricts.buildings)){
      const start=Date.now();assert(await p.evaluate(b=>Campus3D.moveTo(...b.entry),b),'Cross-campus route to '+b.id);routes.push({id:b.id,ms:Date.now()-start});
    }
    for(const id of ['bookshop','cafe','grocery','arcade','clinic','studio','museum','hall','library','dorm']){
      if(await p.evaluate(()=>!!Campus3D.getZone()))await p.locator('#exit-walk').click();
      await p.locator('#district-destination').selectOption(id);await approach(id+'-door');
      assert(await p.evaluate(()=>Campus3D.getZone())===id,'Physical entrance opens '+id);
      const count=await p.evaluate(id=>CampusRooms.count(id),id);
      for(let floor=1;floor<=count;floor++){
        assert(await p.evaluate(()=>Campus3D.getFloor())===floor,id+' current floor '+floor);
        const blocked=await p.evaluate(()=>Campus3D.worldObjects().filter(o=>!Campus3D.moveTo(o.x,o.z)).map(o=>o.id));
        assert(!blocked.length,'All furnished objects reachable '+id+' '+floor+'F: '+blocked.join(','));
        await p.evaluate(()=>{Campus3D.setActive(false);Campus3D.setActive(true);});
        await p.locator('#floor-map').click();await p.waitForTimeout(550);await shot(id+'-'+floor);
        assert(await pixels()>35,'Floor renders '+id+' '+floor);
        await p.locator('#floor-map').click();
        if(floor<count)await approach(id+'-f'+floor+'-stairs-'+(floor+1));
      }
      for(let floor=count;floor>1;floor--)await approach(id+'-f'+floor+'-stairs-'+(floor-1));
      assert(await p.evaluate(()=>Campus3D.getFloor())===1,'Stairs return to ground floor '+id);
      if(id==='cafe'){
        await approach('cafe-shop');const cash=await p.evaluate(()=>JSON.parse(localStorage.getItem('tianshu-v3-auto')).stats.cash);
        await p.locator('#world-dialog-actions').getByRole('button',{name:'冰咖啡 · ¥90',exact:true}).click();
        assert(await p.evaluate(cash=>{const s=JSON.parse(localStorage.getItem('tianshu-v3-auto'));return s.stats.cash===cash-90&&s.rpg.bag.coffee===1;},cash),'Cafe purchase changes real cash and backpack');await p.locator('#world-dialog-close').click();
      }
    }
    await p.locator('#exit-walk').click();await p.locator('#district-destination').selectOption('museum');
    await approach('museum-door');await approach('museum-f1-stairs-2');await approach('museum-f2-chest');await p.locator('#world-dialog-close').click();
    await p.reload();await p.waitForFunction(()=>Campus3D.ready());assert(await p.evaluate(()=>JSON.parse(localStorage.getItem('tianshu-v3-auto')).rpg.world.opened.includes('museum-f2-chest')),'Upper-floor reward survives reload');
    await p.setViewportSize({width:390,height:844});await p.waitForTimeout(800);await shot('world-mobile');
    assert(await p.evaluate(()=>{const i=Campus3D.inspect(),cam=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.2,2000);cam.position.fromArray(i.camera);cam.lookAt(...i.target);cam.updateMatrixWorld();const b=i.bounds;return [[b.minX,b.minZ],[b.minX,b.maxZ],[b.maxX,b.minZ],[b.maxX,b.maxZ]].every(([x,z])=>{const v=new THREE.Vector3(x,0,z).project(cam);return Math.abs(v.x)<.98&&Math.abs(v.y)<.98;});}),'Mobile overview frames all four expanded world corners');
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile UI does not overflow');assert(await pixels()>35,'Mobile expanded map has visible pixels');
    assert(errors.length===0,'No page errors during shops and stair travel');
    return {success:true,testedAt:new Date().toISOString(),checks,errors,routes};
  }catch(e){await shot('failure');return {success:false,checks,errors,error:e.stack,state:await p.evaluate(()=>Campus3D.inspect()),routes};}finally{await c.close();}
}
