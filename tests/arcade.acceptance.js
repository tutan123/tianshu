async(browserPage)=>{
  const c=await browserPage.context().browser().newContext({viewport:{width:1440,height:960}}),p=await c.newPage(),checks=[],errors=[];
  const assert=(v,n)=>{if(!v)throw new Error(n);checks.push(n);};p.on('pageerror',e=>errors.push(e.message));
  const s=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('tianshu-v3-auto')));
  const shot=name=>p.screenshot({path:'G:/Projects/Agent/Agent Cli/天枢/天枢-WebDemo-v3.0/tests/screenshots/'+name+'.png'});
  async function launch(id){await p.locator('[data-event="'+id+'"]').click();await p.locator('#enter-event').click();await p.locator('#skip').click();}
  try{
    await p.goto('file:///G:/Projects/Agent/Agent%20Cli/天枢/天枢-WebDemo-v3.0/index.html');await p.locator('#enter-event').click();await p.locator('#skip').click();await p.locator('[data-choice]').first().click();await p.locator('#back-campus').click();
    await p.locator('[data-panel=rpg]').last().click();await p.locator('[data-growth-tab=shop]').click();const cash=(await s()).stats.cash;
    await p.locator('[data-buy=wrist]').click();assert((await s()).stats.cash===cash-260,'Shop charges exact equipment price');assert(await p.locator('[data-buy=wrist]').isDisabled(),'Owned gear cannot be bought twice');
    await p.locator('[data-growth-tab=gear]').click();assert((await s()).rpg.equipped.hand==='wrist','Purchased gear automatically equips empty slot');
    await p.locator('[data-equip=wrist]').click();assert((await s()).rpg.equipped.hand===null,'Equipment can be removed');await p.locator('[data-equip=wrist]').click();await shot('growth-equipment');await p.locator('#close-panel').click();
    await launch('memory');await p.setViewportSize({width:390,height:844});await shot('memory-mobile');
    for(const seq of [[1,3,0],[2,0,3,1],[0,2,1,3,2]]){await p.locator('#memory-start').click();await p.waitForFunction(()=>!document.querySelector('[data-signal]').disabled);if(seq.length===3){await p.locator('#memory-replay').click();const paid=(await s()).stats.compute;await p.reload();assert((await s()).active.game.assisted&&(await s()).stats.compute===paid,'Memory replay payment survives reload');await p.waitForFunction(()=>!document.querySelector('[data-signal]').disabled);assert(await p.locator('#memory-replay').isDisabled(),'Paid replay cannot be charged twice');}for(const n of seq)await p.locator('[data-signal="'+n+'"]').click();}
    assert((await s()).rpg.records.memory.won&&(await s()).rpg.records.memory.best===12,'Three memory rounds complete through signal buttons');assert((await p.locator('.result-text').innerText()).includes('首胜奖励'),'Result explains first-win reward');await p.locator('#back-campus').click();
    await p.setViewportSize({width:1440,height:960});await launch('salvage');await p.setViewportSize({width:390,height:844});await shot('salvage-mobile');await p.locator('#salvage-fire').click();await p.locator('#salvage-fire').click();await p.waitForTimeout(650);
    await p.reload();assert((await s()).active.game.kind==='salvage','Hook encounter resumes after reload');await p.setViewportSize({width:1440,height:960});await shot('salvage-desktop');
    // Advance the real simulation clock to cover its terminal cleanup deterministically.
    await p.evaluate(()=>{for(let i=0;i<7000&&document.querySelector('#salvage-board');i++)MiniGames.tick(.016);});
    assert((await s()).active.phase==='result','Expired salvage returns a valid story result');
    const winning=await p.evaluate(()=>{
      const state=JSON.parse(localStorage.getItem('tianshu-v3-auto'));
      const game=Arcade.create('salvage');Object.assign(game,{phase:'back',score:230,length:30,caught:0});
      state.active={id:'salvage',phase:'inter',shot:1,game};return state;
    });
    await p.addInitScript(seed=>{if(!sessionStorage.getItem('arcade-winner-seeded')){localStorage.setItem('tianshu-v3-auto',JSON.stringify(seed));sessionStorage.setItem('arcade-winner-seeded','1');}},winning);
    await p.reload();await p.waitForFunction(()=>!!document.querySelector('#back-campus'));
    assert((await s()).rpg.records.salvage.won&&(await s()).stats.cash===winning.stats.cash+180,'Returning hook reaches winning result and awards first-win currency');
    await p.reload();assert((await s()).stats.cash===winning.stats.cash+180,'Reloading winning result does not duplicate reward');
    assert(errors.length===0,'New games have no uncaught page errors');
    return {success:true,testedAt:new Date().toISOString(),checks,errors};
  }catch(e){await shot('arcade-failure');return {success:false,checks,errors,error:e.stack};}finally{await c.close();}
}
