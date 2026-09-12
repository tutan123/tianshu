async(browserPage)=>{
  const c=await browserPage.context().browser().newContext({viewport:{width:1440,height:960}}),p=await c.newPage(),checks=[],errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  const assert=(v,n)=>{if(!v)throw new Error(n);checks.push(n);};
  const shot=name=>p.screenshot({path:'G:/Projects/Agent/Agent Cli/天枢/天枢-WebDemo-v3.0/tests/screenshots/'+name+'.png'});
  async function walk(id){
    assert(await p.evaluate(id=>{const o=Campus3D.worldObjects().find(o=>o.id===id);return !!o&&Campus3D.moveTo(o.x,o.z);},id),'Route to '+id);
    await p.waitForFunction(id=>Campus3D.getObject()?.id===id,id,{timeout:30000});
    await p.locator('#world-interact').click();
  }
  try{
    await p.goto('file:///G:/Projects/Agent/Agent%20Cli/天枢/天枢-WebDemo-v3.0/index.html');await p.waitForFunction(()=>Campus3D.ready());
    for(const id of ['dorm-annex-door','dorm-west-door','gate-east-door']){
      await p.evaluate(z=>Campus3D.setMode('walk',z),id.startsWith('dorm')?'dorm':'gate');await walk(id);
      assert(await p.evaluate(()=>!!Campus3D.getZone()),'Annex door opens interior: '+id);await p.locator('#exit-walk').click();
    }
    await p.evaluate(()=>Campus3D.setMode('walk','dorm'));await walk('woodland-cache');
    assert((await p.evaluate(()=>Campus3D.inspect().player))[1]>1,'Player reaches raised terrace via stairs');
    assert(await p.evaluate(()=>!Campus3D.clearAt(-42,-25)&&!Campus3D.clearAt(-53,-16.1)&&Campus3D.clearAt(-48,-16.1)),'Cliff blocks side entry and keeps stairs open');
    await p.locator('#world-dialog-close').click();await shot('exploration-woodland-terrace');
    await walk('woodland-npc');assert((await p.locator('#world-dialog-text').innerText()).includes('岔路'),'Woodland NPC describes alternate path');await p.locator('#world-dialog-close').click();
    await walk('woodland-herbs');await p.locator('#world-dialog-close').click();
    assert(await p.evaluate(()=>JSON.parse(localStorage.getItem('tianshu-v3-auto')).rpg.world.opened.includes('woodland-herbs')),'Forest branch leads to persistent supplies');await shot('exploration-woodland-trail');
    assert(errors.length===0,'Outdoor route has no page errors');
    return {success:true,testedAt:new Date().toISOString(),checks,errors};
  }catch(e){await shot('outdoor-failure');return {success:false,checks,errors,error:e.stack,state:await p.evaluate(()=>Campus3D.inspect())};}finally{await c.close();}
}
