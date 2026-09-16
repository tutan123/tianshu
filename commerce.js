'use strict';
globalThis.Commerce = (() => {
  const kinds = ['bargain', 'supply'];
  const goods = [{name:'冰咖啡',icon:'coffee',cost:6,prices:[9,12,16]}, {name:'笔记本',icon:'book-open',cost:10,prices:[14,18,24]}];
  const days = [
    {name:'社团招新',weather:'晴',icon:'sun',demand:[14,8],text:'广场摆满摊位，冰咖啡比宣传单更抢手。'},
    {name:'突然降雨',weather:'雨',icon:'cloud-rain',demand:[16,3],text:'同学挤进店里避雨，拿杯咖啡再等一会儿。'},
    {name:'考试周',weather:'阴',icon:'cloud',demand:[8,17],text:'图书馆延长开放，空白笔记本成了紧俏货。'},
    {name:'调休半日',weather:'晴',icon:'sun',demand:[3,4],text:'大多数人离校了。今天的冷柜不适合堆满。'},
    {name:'球场决赛',weather:'晴',icon:'sun',demand:[20,3],text:'终场哨响前后，会有两拨集中到店的客人。'},
    {name:'校园市集',weather:'多云',icon:'cloud-sun',demand:[13,13],text:'市集最后一天，写明价格，迎接最后一拨客人。'}
  ];
  const intents = [{name:'核对品相',loss:3},{name:'另有买家',loss:4},{name:'催促决定',loss:3},{name:'守住底价',loss:5},{name:'准备关店',loss:4},{name:'最后报价',loss:6}];
  const int = (n,min,max) => Number.isInteger(n)&&n>=min&&n<=max;
  const esc = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = n => `<i data-lucide="${n}"></i>`;
  function initial(kind,seed) {
    const base={kind,seed:{...seed},score:0,result:null};
    if(kind==='bargain')return {...base,price:320,trust:12+(seed.bond?2:0),clues:1+(seed.clue?1:0),turn:1,ap:3,moves:[],log:[]};
    return {...base,day:0,cash:300,stock:[0,0],order:[0,0],prices:[1,1],history:[],quit:false};
  }
  function create(kind,s) {
    if(!kinds.includes(kind))return null;
    return initial(kind,{bond:s.bonds.lw>=20,clue:!!s.rpg?.world?.talked?.includes('bookshop-f1-note'),discount:!!s.rpg?.records?.bargain?.won});
  }
  const cost = (g,i) => goods[i].cost-(g.seed.discount?1:0);
  const bill = g => g.order.reduce((sum,n,i)=>sum+n*cost(g,i),0);
  const demand = (g,i) => Math.max(0,days[g.day].demand[i]+[4,0,-6][g.prices[i]]);
  function endBargain(g,result){g.result=result;g.score=result==='success'?400-g.price+g.trust*8+(7-g.turn)*10:0;}
  function act(g,action,p={}) {
    if(!g||g.result)return false;
    if(g.kind==='bargain'){
      const costs={press:2,rapport:1,clue:2,pass:0,quit:0};
      if(!Object.hasOwn(costs,action)||g.ap<costs[action]||action==='clue'&&!g.clues)return false;
      g.moves.push(action);g.ap-=costs[action];
      if(action==='quit'){endBargain(g,'fail');return true;}
      if(action==='press'){g.price-=30;g.trust-=2;g.log.push('坚持报价：总价 -30，信任 -2。');}
      if(action==='rapport'){g.trust=Math.min(20,g.trust+2);g.log.push('照顾店主的顾虑：信任 +2。');}
      if(action==='clue'){g.clues--;g.price-=45;g.log.push('出示比价与品相记录：总价 -45。');}
      if(g.trust<=0){g.trust=0;endBargain(g,'fail');}
      else if(g.price<=210)endBargain(g,'success');
      else if(g.ap===0||action==='pass'){
        const intent=intents[g.turn-1];g.trust=Math.max(0,g.trust-intent.loss);g.log.push(`${intent.name}：信任 -${intent.loss}。`);
        if(!g.trust||g.turn===6)endBargain(g,'fail');else {g.turn++;g.ap=3;}
      }
      g.log=g.log.slice(-4);return true;
    }
    if(g.kind!=='supply')return false;
    if(action==='quit'){g.quit=true;g.result='fail';return true;}
    if(action==='order'){
      if(!int(p.item,0,1)||!int(p.quantity,0,20)||g.stock[p.item]+p.quantity>30)return false;
      g.order[p.item]=p.quantity;return true;
    }
    if(action==='price'){
      if(!int(p.item,0,1)||!int(p.level,0,2))return false;
      g.prices[p.item]=p.level;return true;
    }
    if(action!=='trade'||bill(g)>g.cash)return false;
    const spent=bill(g),sold=g.stock.map((n,i)=>Math.min(n+g.order[i],demand(g,i)));
    const revenue=sold.reduce((sum,n,i)=>sum+n*goods[i].prices[g.prices[i]],0);
    g.stock=g.stock.map((n,i)=>n+g.order[i]-sold[i]);const waste=g.stock[0];g.stock[0]=0;
    g.cash=Math.max(0,g.cash-spent+revenue-20);
    const buyback=g.day===5?g.stock[1]*5:0;g.cash+=buyback;
    g.history.push({order:[...g.order],prices:[...g.prices],sold,waste,spent,revenue,buyback,cash:g.cash});
    g.order=[0,0];g.day++;
    if(g.day===6){g.score=Math.max(0,g.cash-300);g.result=g.score>=180?'success':'fail';}
    return true;
  }
  // Replaying bounded rounds verifies accounting and terminal states as well as types.
  function equal(a,b){return a&&typeof a==='object'?!!b&&typeof b==='object'&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k])):a===b;}
  function valid(g) {
    try{
      if(!g||!kinds.includes(g.kind)||!g.seed||Object.keys(g.seed).length!==3||!['bond','clue','discount'].every(k=>typeof g.seed[k]==='boolean'))return false;
      const replay=initial(g.kind,g.seed);
      if(g.kind==='bargain'){
        if(!Array.isArray(g.moves)||g.moves.length>24)return false;
        for(const move of g.moves)if(!act(replay,move))return false;
      }else{
        if(!Array.isArray(g.history)||g.history.length>6||!Array.isArray(g.order)||g.order.length!==2||!Array.isArray(g.prices)||g.prices.length!==2)return false;
        for(const row of g.history){
          if(!row||!Array.isArray(row.order)||row.order.length!==2||!Array.isArray(row.prices)||row.prices.length!==2)return false;
          for(let i=0;i<2;i++)if(!act(replay,'order',{item:i,quantity:row.order[i]})||!act(replay,'price',{item:i,level:row.prices[i]}))return false;
          if(!act(replay,'trade'))return false;
        }
        if(!replay.result){for(let i=0;i<2;i++)if(!act(replay,'order',{item:i,quantity:g.order[i]})||!act(replay,'price',{item:i,level:g.prices[i]}))return false;}
        if(g.quit&&!act(replay,'quit'))return false;
      }
      return equal(replay,g);
    }catch{return false;}
  }
  let host,state,hooks,g;
  function start(kind,target,s,callbacks){host=target;state=s;hooks=callbacks;g=s.active.game||create(kind,s);s.active.game=g;hooks.save();render();}
  function changed(action,p){if(!act(g,action,p))return;hooks.sound('tap');hooks.save();hooks.hud();render();}
  function stop(){host=null;state=null;hooks=null;g=null;}
  const stat = (label,value) => `<div><small>${label}</small><strong>${value}</strong></div>`;
  function render(){
    if(!host)return;
    host.className='encounter commerce-encounter';
    const bargaining=g.kind==='bargain';
    host.innerHTML=`<div class="commerce-heading"><div><div class="eyebrow">${icon(bargaining?'handshake':'store')}${bargaining?'南门旧书局 / 收购委托':'榕树便利店 / 代理店长'}</div><h2>${bargaining?'一箱旧书，一次好交易':'今天，轮到你当店长'}</h2></div><span class="commerce-round">${bargaining?'洽谈 '+g.turn+' / 6':'营业 '+Math.min(6,g.day+1)+' / 6'}</span></div>
      <canvas id="commerce-scene" width="960" height="200" aria-label="${bargaining?'旧书收购桌面':'六轮店铺现金账本'}"></canvas>
      ${bargaining?bargainView():supplyView()}
      ${g.result?`<div class="commerce-verdict" role="status"><strong>${g.result==='success'?(bargaining?'成交，社团的书有着落了':'委托完成，小店有了盈余'):'这次先记下经验'}</strong><span>${bargaining?'成交目标 ¥210，当前报价 ¥'+g.price:'最终店款 ¥'+g.cash+' · 净收益 ¥'+(g.cash-300)+' / 目标 ¥180'}</span></div><button id="commerce-finish" class="primary">${icon('check')}结算并返回</button>`:`<div class="commerce-footer"><span>${bargaining?'社团收购预算 · 不扣个人财富':'店铺备用金 · 不扣个人财富'}</span><button id="commerce-quit" class="secondary">${icon('log-out')}${bargaining?'结束洽谈':'提前收摊'}</button></div>`}`;
    host.querySelectorAll('[data-commerce-action]').forEach(b=>b.onclick=()=>changed(b.dataset.commerceAction));
    host.querySelectorAll('[data-commerce-order]').forEach(input=>input.onchange=()=>{if(!act(g,'order',{item:Number(input.dataset.commerceOrder),quantity:Number(input.value)})){render();return;}hooks.save();render();});
    host.querySelectorAll('[data-commerce-price]').forEach(b=>b.onclick=()=>changed('price',{item:Number(b.dataset.item),level:Number(b.dataset.commercePrice)}));
    host.querySelector('#commerce-quit')?.addEventListener('click',()=>changed('quit'));
    host.querySelector('#commerce-finish')?.addEventListener('click',()=>{const result=g.result;hooks.finish(result);});
    hooks.icons();draw();
  }
  function bargainView(){
    const intent=intents[g.turn-1];
    const cards=[{id:'press',name:'坚持报价',icon:'swords',ap:2,desc:'总价 -30 · 信任 -2',disabled:g.trust<=2},{id:'rapport',name:'建立共识',icon:'messages-square',ap:1,desc:'信任 +2，上限 20'},{id:'clue',name:'出示线索',icon:'file-search',ap:2,desc:`总价 -45 · 剩余 ${g.clues} 份`,disabled:!g.clues}];
    return `<div class="commerce-stats">${stat('店主报价','¥'+g.price)}${stat('社团目标','≤ ¥210')}${stat('信任',g.trust+' / 20')}${stat('行动力',g.ap+' / 3')}</div>
      <div class="commerce-intent">${icon('eye')}<span>店主下一步：<b>${intent.name}</b> · 回合结束信任 -${intent.loss}</span></div>
      <div class="commerce-bonuses">${g.seed.bond?'林晚背书 · 初始信任 +2':'林晚羁绊 20 可获得背书'} · ${g.seed.clue?'书局调查记录 · 额外线索 +1':'调查书局记录可获得额外线索'}</div>
      <div class="commerce-cards">${cards.map(c=>`<button class="commerce-card" data-commerce-action="${c.id}" ${g.result||g.ap<c.ap||c.disabled?'disabled':''}><span>${icon(c.icon)}<small>${c.ap} AP</small></span><strong>${c.name}</strong><small>${c.desc}</small></button>`).join('')}</div>
      <div class="commerce-log" aria-live="polite">${g.log.length?g.log.map(line=>`<p>${esc(line)}</p>`).join(''):'店主翻开封底：“这一箱，三百二。你先看看品相。”'}</div>
      ${g.result?'':`<button class="secondary" data-commerce-action="pass">${icon('corner-down-right')}结束本回合</button>`}`;
  }
  function supplyView(){
    const d=days[Math.min(g.day,5)],over=bill(g)>g.cash;
    return `<div class="commerce-stats">${stat('店铺现金','¥'+g.cash)}${stat('待付货款','¥'+bill(g))}${stat('营业支出','¥20 / 轮')}${stat('收益目标','+ ¥180')}</div>
      <div class="commerce-days">${days.map((d,i)=>`<span class="${i===g.day?'current':i<g.day?'past':''}">${i+1}<small>${d.name}</small></span>`).join('')}</div>
      <div class="commerce-intent">${icon(d.icon)}<span><b>${d.name} · ${d.weather}</b> ${d.text}</span></div>
      <div class="commerce-bonuses">${g.seed.discount?'旧书局合作已达成 · 两类商品进价各减 ¥1':'旧书局谈判首胜后，两类商品进价各减 ¥1'}</div>
      ${!g.result?`<div class="commerce-products">${goods.map((item,i)=>`<section class="commerce-product"><h3>${icon(item.icon)}${item.name}<small>现存 ${g.stock[i]}</small></h3><div class="commerce-product-row"><label for="commerce-order-${i}">进货 · ¥${cost(g,i)}/份</label><input id="commerce-order-${i}" data-commerce-order="${i}" type="number" min="0" max="${Math.min(20,30-g.stock[i])}" step="1" value="${g.order[i]}" aria-label="${item.name}进货数量"></div><div class="commerce-prices" role="group" aria-label="${item.name}售价">${item.prices.map((price,j)=>`<button data-commerce-price="${j}" data-item="${i}" aria-pressed="${g.prices[i]===j}"><small>${['薄利','常规','溢价'][j]}</small>¥${price}</button>`).join('')}</div><p>预计需求 ${demand(g,i)} 份 · ${i===0?'当轮余货报损':'可留到下轮，末轮 ¥5 回收'}</p></section>`).join('')}</div><button class="primary commerce-trade" data-commerce-action="trade" ${over?'disabled':''}>${icon('store')}${over?'货款超出店款':'确认进货并营业'}</button>`:''}
      ${g.history.length?`<div class="commerce-ledger"><table><caption>营业流水 · 咖啡 / 笔记本</caption><thead><tr><th>轮次</th><th>售出</th><th>报损</th><th>店款</th></tr></thead><tbody>${g.history.map((row,i)=>`<tr><td>${i+1} · ${days[i].name}</td><td>${row.sold.join(' / ')}</td><td>${row.waste}</td><td>¥${row.cash}</td></tr>`).join('')}</tbody></table></div>`:''}`;
  }
  function draw(){
    const canvas=host.querySelector('canvas'),c=canvas.getContext('2d');if(!c)return;
    c.fillStyle='#eff3ed';c.fillRect(0,0,960,200);
    if(g.kind==='bargain'){
      c.fillStyle='#dae5de';c.fillRect(0,148,960,52);
      const colors=['#3c7f79','#c76d72','#6887ac','#d1ae59'];
      for(let i=0;i<7;i++){const x=50+i*85,y=60+(i%3)*13;c.fillStyle=colors[i%4];c.fillRect(x,y,66,100);c.fillStyle='#faf9ef';c.fillRect(x+6,y+9,54,7);c.fillRect(x+6,y+86,54,4);c.fillStyle='#ffffff66';c.fillRect(x+5,y+22,2,48);}
      c.fillStyle='#fff';c.fillRect(688,34,226,128);c.fillStyle='#316f68';c.font='20px sans-serif';c.fillText('社团旧书收购单',707,65);c.font='bold 38px sans-serif';c.fillText('¥ '+g.price,707,117);c.font='16px sans-serif';c.fillStyle='#5d6c67';c.fillText('目标 210 / 整箱',707,144);
    }else{
      const values=[300,...g.history.map(h=>h.cash)],max=Math.max(500,...values),x=i=>50+i*142,y=v=>168-v/max*130;
      c.strokeStyle='#cbd9d2';c.lineWidth=1;for(let i=0;i<4;i++){c.beginPath();c.moveTo(45,35+i*44);c.lineTo(925,35+i*44);c.stroke();}
      c.strokeStyle='#388779';c.lineWidth=4;c.beginPath();values.forEach((v,i)=>i?c.lineTo(x(i),y(v)):c.moveTo(x(i),y(v)));c.stroke();
      values.forEach((v,i)=>{c.fillStyle=i===values.length-1?'#ba606b':'#388779';c.beginPath();c.arc(x(i),y(v),5,0,Math.PI*2);c.fill();c.font='17px sans-serif';c.fillText('¥'+v,x(i)-18,y(v)-13);});
      c.fillStyle='#61756a';c.font='16px sans-serif';for(let i=0;i<7;i++)c.fillText(i?'第 '+i+' 轮':'开店',x(i)-16,193);
    }
  }
  return {kinds,goods,days,create,act,valid,start,stop};
})();
