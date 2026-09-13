async (browserPage) => {
  const context=await browserPage.context().browser().newContext({viewport:{width:390,height:844}}),page=await context.newPage(),checks=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const assert=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label);};
  try{
    await page.goto('file:///G:/Projects/Agent/Agent%20Cli/天枢/天枢-WebDemo-v3.0/index.html');
    const fixture=await page.evaluate(()=>{const s=TS.fresh();for(const id of ['hall-npc','hall-note'])Exploration.act(s,id);Exploration.act(s,'hall-puzzle','1');Exploration.act(s,'hall-task');return JSON.stringify(s);});
    await page.addInitScript(value=>localStorage.setItem('tianshu-v3-auto',value),fixture);
    await page.reload();await page.waitForFunction(()=>Campus3D.ready());
    await page.evaluate(()=>{Campus3D.setMode('walk','hall');Campus3D.enterInterior('hall');});
    assert((await page.locator('#exploration-progress').innerText()).includes('打开 0 个宝箱'),'Completed investigation is not counted as a chest');
    assert((await page.locator('#local-investigation').innerText()).includes('已归档'),'Completed room investigation is shown as archived');
    await page.evaluate(()=>{Campus3D.exitInterior();Campus3D.setMode('walk','dorm');Campus3D.enterInterior('dorm');});
    assert((await page.locator('#local-investigation').innerText()).includes('与苏祁交谈'),'Next objective follows the current interior');
    const before=await page.evaluate(()=>Campus3D.inspect().player);
    await page.evaluate(()=>Campus3D.controls('up',true));await page.waitForTimeout(300);await page.evaluate(()=>Campus3D.controls('up',false));
    assert(await page.evaluate(before=>Campus3D.inspect().player.some((v,i)=>Math.abs(v-before[i])>.2),before),'Character moves under held input');
    await page.locator('#floor-map').click();await page.waitForTimeout(700);
    await page.screenshot({path:'G:/Projects/Agent/Agent Cli/天枢/天枢-WebDemo-v3.0/tests/screenshots/journal-mobile-floor.png'});
    assert(await page.evaluate(()=>{const a=document.getElementById('exploration-journal').getBoundingClientRect(),b=document.getElementById('mini-frame').getBoundingClientRect();return a.right<=b.left||a.bottom<=b.top||a.top>=b.bottom;}),'Mobile objective journal does not overlap minimap');
    await page.locator('#exit-walk').click();assert(await page.locator('#local-investigation').isHidden(),'Interior objective clears on return to campus');
    assert(errors.length===0,'No uncaught errors in journal and movement');
    return {success:true,testedAt:new Date().toISOString(),checks,errors};
  }catch(e){return {success:false,checks,errors,error:e.stack};}finally{await context.close();}
}
