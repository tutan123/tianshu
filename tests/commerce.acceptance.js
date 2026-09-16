async (browserPage) => {
  const context=await browserPage.context().browser().newContext({viewport:{width:1440,height:960}}),page=await context.newPage(),checks=[],errors=[];
  const assert=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label);};
  page.on('pageerror',e=>errors.push(e.message));
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tianshu-v3-auto')));
  const shot=name=>page.screenshot({path:'G:/Projects/Agent/Agent Cli/天枢/天枢-WebDemo-v3.0/tests/screenshots/commerce-'+name+'.png',fullPage:true});
  async function approach(id){
    assert(await page.evaluate(id=>{const o=Campus3D.worldObjects().find(o=>o.id===id);return !!o&&Campus3D.moveTo(o.x,o.z);},id),'Walkable '+id);
    await page.waitForFunction(id=>Campus3D.getObject()?.id===id,id,{timeout:25000});await page.locator('#world-interact').click();
  }
  async function shop(zone){
    if(await page.evaluate(()=>!!Campus3D.getZone()))await page.locator('#exit-walk').click();
    await page.locator('#district-destination').selectOption(zone);await approach(zone+'-door');await approach(zone+'-shop');
  }
  async function bargainWin(){
    await page.locator('[data-commerce-action=clue]').click();await page.locator('[data-commerce-action=rapport]').click();
    for(let i=0;i<3&&!(await state()).active.game.result;i++){
      await page.locator('[data-commerce-action=press]').click();
      if(!(await state()).active.game.result)await page.locator('[data-commerce-action=rapport]').click();
    }
  }
  const noOverflow=()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&[...document.querySelectorAll('.commerce-encounter button,.commerce-encounter input')].every(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth;}));
  try{
    await page.goto('file:///G:/Projects/Agent/Agent%20Cli/天枢/天枢-WebDemo-v3.0/index.html');await page.waitForFunction(()=>Campus3D.ready());
    await shop('bookshop');assert(await page.getByRole('button',{name:'接受委托 · 旧书局收购谈判',exact:true}).count()===0,'Shop gates commission before intro');
    await page.locator('#world-dialog-close').click();await page.locator('#exit-walk').click();
    await page.locator('#nav-map').click();await page.locator('#quest-jump').click();await page.locator('#enter-event').click();await page.locator('#skip').click();await page.locator('[data-choice]').first().click();await page.locator('#back-campus').click();
    await shop('bookshop');await page.getByRole('button',{name:'接受委托 · 旧书局收购谈判',exact:true}).click();await page.locator('#skip').click();
    const start=await state();await shot('bargain-desktop');
    await page.locator('[data-commerce-action=clue]').click();const pending=(await state()).active.game;
    assert(await page.locator('[data-commerce-action=press]').isDisabled(),'Not enough AP disables expensive card');
    await page.reload();assert(JSON.stringify((await state()).active.game)===JSON.stringify(pending),'Mid-negotiation reload retains AP, quote and clue consumption');
    await page.setViewportSize({width:390,height:844});await shot('bargain-mobile');assert(await noOverflow(),'Mobile negotiation controls fit viewport');
    await page.locator('[data-commerce-action=rapport]').click();
    for(let i=0;i<3&&!(await state()).active.game.result;i++){await page.locator('[data-commerce-action=press]').click();if(!(await state()).active.game.result)await page.locator('[data-commerce-action=rapport]').click();}
    assert((await state()).active.game.result==='success','Negotiation wins through cards');
    await page.reload();assert((await state()).stats.cash===start.stats.cash,'Unclaimed contract does not pay on reload');
    await page.locator('#commerce-finish').click();const won=await state();
    assert(won.stats.cash===start.stats.cash+180&&won.rpg.bag.notes===1,'First contract pays exact cash and one notebook');
    await page.reload();assert((await state()).stats.cash===won.stats.cash,'Claimed contract reward is not duplicated on reload');await page.locator('#back-campus').click();
    await page.setViewportSize({width:1440,height:960});await shop('grocery');await page.getByRole('button',{name:'接受委托 · 便利店六轮经营',exact:true}).click();await page.locator('#skip').click();
    assert((await state()).active.game.seed.discount,'Bookshop cooperation carries into supplier prices');
    await page.locator('#commerce-order-0').fill('20');await page.locator('#commerce-order-0').blur();await page.locator('#commerce-order-1').fill('20');await page.locator('#commerce-order-1').blur();
    // Discounted orders total 280, so an ordinary full order remains affordable.
    await page.locator('#commerce-order-0').fill('14');await page.locator('#commerce-order-0').blur();await page.locator('#commerce-order-1').fill('8');await page.locator('#commerce-order-1').blur();
    const orders=(await state()).active.game;await page.reload();assert(JSON.stringify((await state()).active.game)===JSON.stringify(orders),'Pending orders and supplier discount survive reload');
    await shot('supply-desktop');await page.locator('[data-commerce-action=trade]').click();
    assert((await state()).stats.cash===won.stats.cash,'Store working capital never debits character wallet');
    await page.setViewportSize({width:390,height:844});await shot('supply-mobile');assert(await noOverflow(),'Mobile pricing and quantity controls fit viewport');
    for(const [a,b]of [[16,3],[8,17],[3,4],[20,3],[13,13]]){
      await page.locator('#commerce-order-0').fill(String(a));await page.locator('#commerce-order-0').blur();await page.locator('#commerce-order-1').fill(String(b));await page.locator('#commerce-order-1').blur();await page.locator('[data-commerce-action=trade]').click();
    }
    const closed=(await state()).active.game;assert(closed.result==='success'&&closed.history.length===6&&closed.score>180,'Six real sales rounds reach positive net-profit target');
    await page.reload();assert((await state()).active.game.score===closed.score,'Final ledger survives reload before claiming');await shot('supply-ledger');
    await page.locator('#commerce-finish').click();assert((await state()).rpg.bag.coffee===1,'Store first win adds coffee to backpack');await page.locator('#back-campus').click();
    await page.setViewportSize({width:1440,height:960});await shop('bookshop');await page.getByRole('button',{name:'接受委托 · 旧书局收购谈判',exact:true}).click();await page.locator('#skip').click();const beforeReplay=await state();await bargainWin();await page.locator('#commerce-finish').click();
    assert((await state()).stats.cash===beforeReplay.stats.cash&&(await state()).rpg.bag.notes===beforeReplay.rpg.bag.notes,'Repeat victory updates record without repeating rewards');await page.locator('#back-campus').click();
    await page.locator('[data-panel=rpg]').last().click();assert((await page.locator('#panel-body').innerText()).includes('旧书局收购谈判')&&(await page.locator('#panel-body').innerText()).includes('便利店六轮经营'),'Character profile labels both activity records');await page.locator('#close-panel').click();
    await shop('grocery');await page.getByRole('button',{name:'接受委托 · 便利店六轮经营',exact:true}).click();await page.locator('#skip').click();await page.locator('#commerce-quit').click();await page.locator('#commerce-finish').click();assert((await state()).results.supply==='fail','Early close produces a recoverable failure result');
    assert(errors.length===0,'No uncaught errors in new activity journeys');
    return {success:true,testedAt:new Date().toISOString(),checks,errors};
  }catch(e){await shot('failure');return {success:false,checks,errors,error:e.stack};}finally{await context.close();}
}
