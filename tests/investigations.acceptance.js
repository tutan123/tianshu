async (browserPage) => {
  const context=await browserPage.context().browser().newContext({viewport:{width:1440,height:960}});
  const page=await context.newPage(),checks=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const assert=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label);};
  const shot=name=>page.screenshot({path:'G:/Projects/Agent/Agent Cli/天枢/天枢-WebDemo-v3.0/tests/screenshots/investigation-'+name+'.png'});
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tianshu-v3-auto')));
  async function approach(id){
    assert(await page.evaluate(id=>{const o=Campus3D.worldObjects().find(o=>o.id===id);return o&&Campus3D.moveTo(o.x,o.z);},id),'Route to '+id);
    await page.waitForFunction(id=>Campus3D.getObject()?.id===id,id,{timeout:25000});
    await page.locator('#world-interact').click();
  }
  async function close(){await page.locator('#world-dialog-close').click();}
  try{
    await page.goto('file:///G:/Projects/Agent/Agent%20Cli/天枢/天枢-WebDemo-v3.0/index.html');
    await page.waitForFunction(()=>Campus3D.ready());
    await page.locator('#growth-summary').click();
    await page.locator('[data-growth-tab=tasks]').click();
    assert(await page.locator('[data-quest-visit=hall]').isEnabled(),'Real game enables quest destinations');
    await page.locator('[data-quest-visit=hall]').click();
    assert(await page.evaluate(()=>!document.getElementById('panel').open&&Campus3D.getMode()==='walk'&&Campus3D.getZone()===null),'Quest navigation closes panel and enters campus walking');
    await approach('hall-door');
    assert(await page.evaluate(()=>Campus3D.getZone())==='hall','Quest destination is the correct accessible doorway');
    for(const zone of ['hall','dorm','library','lake','gym','lab','gate','plaza']){
      await page.evaluate(zone=>{Campus3D.exitInterior();Campus3D.setMode('walk',zone);Campus3D.enterInterior(zone);},zone);
      const routes=await page.evaluate(()=>Campus3D.worldObjects().filter(o=>!Campus3D.moveTo(o.x,o.z)).map(o=>o.id));
      assert(!routes.length,'All furnished-room targets reachable: '+zone+' '+routes.join(','));
      await approach(zone+'-task');assert((await page.locator('#world-dialog-text').innerText()).includes('尚待完成'),'Premature hand-in is blocked: '+zone);await close();
      for(const suffix of ['npc','note']){await approach(zone+'-'+suffix);await close();}
      await approach(zone+'-puzzle');
      const answers=await page.evaluate(zone=>{const o=Exploration.objects(zone).find(o=>o.type==='puzzle');return {wrong:o.choices.find(c=>c.id!==o.answer).text,right:o.choices.find(c=>c.id===o.answer).text};},zone);
      await page.locator('#world-dialog-actions').getByRole('button',{name:answers.wrong,exact:true}).click();
      assert(!(await saved()).rpg.world.switches.includes(zone+'-puzzle'),'Wrong answer does not solve: '+zone);
      await page.locator('#world-dialog-actions').getByRole('button',{name:answers.right,exact:true}).click();await close();
      if(zone==='lab'){for(const id of ['lab-switch','lab-cache']){await approach(id);await close();}}
      await approach(zone+'-task');
      const before=await saved();assert(before.rpg.world.opened.includes(zone+'-task'),'Investigation reward claimed: '+zone);await close();
      await page.locator('#world-interact').click();assert((await saved()).stats.cash===before.stats.cash,'Reward stays once-only: '+zone);await close();
      await page.locator('#floor-map').click();await page.waitForTimeout(650);
      const pixels=await page.evaluate(()=>{const source=document.querySelector('#map3d canvas'),canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0,64,64);const data=ctx.getImageData(0,0,64,64).data,colors=new Set();for(let i=0;i<data.length;i+=4)colors.add((data[i]>>4)+','+(data[i+1]>>4)+','+(data[i+2]>>4));return colors.size;});
      assert(pixels>25,'Rendered scene has nonblank canvas: '+zone);await shot(zone);
    }
    await page.reload();await page.waitForFunction(()=>Campus3D.ready());
    // 只断言校园八条：Exploration.quests 现在还会合并校外内容层的条目。
    assert(await page.evaluate(()=>Exploration.quests(JSON.parse(localStorage.getItem('tianshu-v3-auto'))).filter(q=>q.id.endsWith('-investigation')).every(q=>q.complete)),'All eight investigations survive reload');
    await page.locator('#growth-summary').click();await page.locator('[data-growth-tab=bag]').click();await page.locator('[data-bag-filter]').selectOption('evidence');
    assert(await page.locator('[data-bag-item]').count()===8,'Eight collected clues appear in real backpack');
    await page.setViewportSize({width:390,height:844});await shot('evidence-mobile');
    assert(errors.length===0,'No uncaught errors throughout investigations');
    return {success:true,testedAt:new Date().toISOString(),checks,errors};
  }catch(e){await shot('failure');return {success:false,checks,errors,error:e.stack};}finally{await context.close();}
}
