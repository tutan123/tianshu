'use strict';
globalThis.CONTENT = (() => {
  const shot = (who, text, media = 'campus', position = '50% 50%') => ({ who, text, media, position });
  const choice = (text, hint, fx, response) => ({ text, hint, fx, response });
  const places = {
    dorm: { name: '梧桐宿舍', en: 'DORMITORY', icon: 'bed-double', x: 21, y: 29, detail: '四个人的寝室，一台旧电脑。故事从这里重新开机。' },
    hall: { name: '钟楼教学楼', en: 'LECTURE HALL', icon: 'graduation-cap', x: 51, y: 23, detail: '九点的铃声响起。上一世错过的答案，这次还来得及。' },
    library: { name: '江大图书馆', en: 'LIBRARY', icon: 'book-open', x: 79, y: 28, detail: '靠窗第三排，总有人替你留着一个位置。' },
    lake: { name: '镜湖', en: 'MIRROR LAKE', icon: 'waves', x: 25, y: 61, detail: '风经过湖面。有些事，天枢也算不出答案。' },
    gym: { name: '露天球场', en: 'SPORTS COURT', icon: 'circle-dot', x: 53, y: 77, detail: '夕阳，橡胶地面，一场所有人都以为你会输的比赛。' },
    lab: { name: '计算机学院', en: 'COMPUTING LAB', icon: 'cpu', x: 79, y: 49, detail: '服务器的风扇从不停歇。这里藏着被改写的真相。' },
    gate: { name: '校园后街', en: 'CAMPUS STREET', icon: 'store', x: 82, y: 77, detail: '修电脑、做生意、听传闻。第一笔启动资金就在这里。' },
    plaza: { name: '中心广场', en: 'CENTRAL SQUARE', icon: 'landmark', x: 49, y: 43, detail: '人群会散去，做过的选择会留下。' },
  };
  const people = {
    lw: { name: '林晚', initial: '晚', role: '经管系新生', color: '#e8a7ae', image: 'assets/linwan.jpg', bio: '她记得你省略的那一步，也看得见你故作轻松的样子。', secret: '她想赢得奖学金，是为了让在医院的母亲少上一班夜工。' },
    sq: { name: '苏祁', initial: '祁', role: '室友 · 技术搭档', color: '#96cbbf', bio: '嘴上说着别找我，凌晨两点却还在替你焊电路板。', secret: '那台被你救活的旧电脑，是他第一次靠自己打工买的。' },
    gqh: { name: '顾清河', initial: '顾', role: '计算机学院教授', color: '#d9c390', bio: '他看你的眼神不像在看一个新生，倒像是在确认一件旧事。', secret: '七年前，他也听过一个来自电脑里的声音。' },
    zty: { name: '赵天宇', initial: '赵', role: '同届学生 · 竞争者', color: '#b4b9cf', bio: '习惯于提前知道结果的人，最怕一个不在计划里的变量。', secret: '他掌握了评审账户，却没有意识到有人也在利用他。' },
  };
  const modules = {
    learn: { name: '认知加速', icon: 'brain', tag: '学习', cost: [20, 35], desc: ['演算时限 +5 秒，辅助消耗减半', '演算时限 +10 秒，智慧奖励 +4'] },
    body: { name: '神经协同', icon: 'activity', tag: '行动', cost: [20, 35], desc: ['精准窗口扩大 35%', '精准窗口扩大 70%，战斗格挡 +3'] },
    predict: { name: '因果预读', icon: 'scan-eye', tag: '预测', cost: [25, 40], desc: ['战斗显示敌方意图，解谜辅助免费', '战斗攻击 +4，首回合算力 +1'] },
  };
  const main = ['intro', 'roll', 'math', 'gym', 'roof', 'market', 'lab', 'hearing', 'duel', 'finale'];
  const nodes = {
    intro: { title: '这一次，从头来过', subtitle: '序章 · 回溯协议', place: 'dorm', day: 1, time: '清晨', kind: 'choice', lead: '旧电脑的屏幕亮了。一个声音叫出了你的名字。',
      shots: [shot('', '2025 年，江城。失业第三个月，第 217 份简历，依然已读不回。', 'rain'), shot('陈旭', '二十五岁，存款 431 块。要是能重来一次……', 'rain'), shot('天枢', '检测到可绑定意识体。时间回溯：七年。代价未知。是否执行？', 'awake'), shot('', '你被下铺的闹钟吵醒。日历停在 2018 年 9 月 3 日。十八岁，大一第一天。', 'notebook'), shot('天枢', '宿主陈旭，绑定完成。我是天枢。你负责选择，我负责把不可能算出来。', 'awake')],
      question: '重来一次，先把什么握在手里？',
      choices: [choice('先把本事找回来。', '智力 +8 · 认知加速 Lv.1', { intelligence: 8, module: 'learn', flags: ['scholar'] }, '天枢：认知加速已接入。门外有人喊你的名字。第一堂课，你不会再迟到了。'), choice('这次，我不再一个人。', '精神 +10 · 苏祁羁绊 +10', { spirit: 10, bonds: { sq: 10 }, flags: ['companion'] }, '你接过苏祁递来的早餐。“一起走。”上一世，你甚至没记住这一口热豆浆的味道。'), choice('先赚到不必低头的钱。', '财富 +300 · 因果预读 Lv.1', { cash: 300, module: 'predict', flags: ['ambition'] }, '天枢帮你找到旧账户里一笔遗忘的退款。你合上电脑。第一桶金，从今天开始。')], reward: { compute: 10 }, messages: ['sq-welcome'] },
    roll: { title: '不在名单里的变量', subtitle: '第一幕 · 新生', place: 'hall', day: 1, time: '上午', kind: 'choice', lead: '赵天宇宣布，他已经拿到了创新赛的内定名额。',
      shots: [shot('', '钟楼响了九下。辅导员念到“陈旭”时，你举起了手。', 'campus', '50% 20%'), shot('赵天宇', '创新赛名额就两个。一个是我的，另一个……你们可以慢慢争。'), shot('天枢', '评审截止时间：三天后。检测到名单提前修改。注意，他说的可能不是玩笑。'), shot('林晚', '既然还没比赛，为什么现在就有结果？')],
      question: '所有人都在等你的反应。', choices: [choice('那就把评审放到台面上。', '声望 +12 · 公开路线', { reputation: 12, flags: ['public'] }, '你在黑板上写下“公开答辩”。林晚第一个签名。赵天宇的笑停了半秒。'), choice('报名。作品会替我说话。', '智力 +6 · 顾清河羁绊 +5', { intelligence: 6, bonds: { gqh: 5 } }, '顾教授收走你的报名表，只说了一句：“周五，别迟到。”'), choice('苏祁，咱们组个队。', '苏祁羁绊 +12 · 合作路线', { bonds: { sq: 12 }, flags: ['team'] }, '苏祁把椅子拖到你身边。“名字我想好了，天枢。是不是挺酷？”你愣了一秒。')], reward: { compute: 8 }, messages: ['lw-library'] },
    math: { title: '她省略的第三步', subtitle: '第一幕 · 演算', place: 'library', day: 1, time: '下午', kind: 'quiz', lead: '林晚需要一个能讲清楚答案的人。天枢已经就绪。',
      shots: [shot('', '图书馆第三排，林晚用一枚银杏叶夹住笔记。她给你留了靠窗的位置。', 'library'), shot('林晚', '答案我会背，但第三步为什么能这么变？', 'linwan'), shot('天枢', '问题已解析。但直接报答案，不等于让她理解。宿主，请开始你的讲解。', 'library')], success: '你把推导拆成三步。林晚终于松开咬着的笔帽：“原来不是我学不会。”', fail: '你们一起翻回定义，把卡住的地方重新算了一遍。林晚笑了：“至少这回，我知道自己哪里不会了。”', reward: { intelligence: 10, bonds: { lw: 12 }, compute: 8 }, fallback: { intelligence: 4, bonds: { lw: 6 } }, messages: ['lw-thanks'] },
    gym: { title: '最后一球', subtitle: '第一幕 · 预判', place: 'gym', day: 1, time: '傍晚', kind: 'qte', lead: '球场上，赵天宇把球抛给你。你听见天枢开始倒数。',
      shots: [shot('', '球场围了不少人。赵天宇用鞋尖踩住球：“听说你还想参加创新赛？先让我看看你能干什么。”', 'campus', '53% 82%'), shot('苏祁', '我已经按下录像了。你放心打，剩下的交给我。'), shot('天枢', '重心向左，右侧空当将在 0.8 秒后出现。等一下……就是现在。')], success: '你从右侧切入，球擦着篮板落进框里。先响起的是苏祁的喊声，然后是整个球场。', fail: '第一步慢了半拍。你没有硬上，回身传给苏祁。他愣了一下，接球命中。“算你的助攻！”', reward: { physique: 8, reputation: 15, compute: 10 }, fallback: { physique: 4, bonds: { sq: 5 }, reputation: 5 }, messages: ['sq-video'] },
    roof: { title: '有人赌你会赢', subtitle: '第二幕 · 约定', place: 'lake', day: 2, time: '清晨', kind: 'choice', lead: '镜湖边，林晚第一次说起她为什么一定要赢。',
      shots: [shot('', '晨风把湖面吹成一页皱起的纸。林晚把报名表压在栏杆上。', 'campus', '25% 63%'), shot('林晚', '那笔奖金够我妈休息两个月。可我不想靠别人让给我。'), shot('陈旭', '那就一起赢。'), shot('天枢', '正在计算最优合作策略……异常。宿主心率与预期不符。')], question: '这一次，你怎样回应她？', choices: [choice('你负责想法，我把它做出来。', '林晚羁绊 +15 · 团队协作', { bonds: { lw: 15 }, flags: ['team'] }, '她把报名表转过来。搭档那一栏，写着你的名字。'), choice('等结果出来，请你吃顿好的。', '林晚羁绊 +10 · 精神 +8', { bonds: { lw: 10 }, spirit: 8 }, '“那我要吃后街最贵的那家。”她顿了一下，“也就二十八一份。别紧张。”'), choice('先告诉我，你真正想做什么。', '林晚羁绊 +12 · 解锁她的想法', { bonds: { lw: 12 }, intelligence: 4, flags: ['listen'] }, '她讲了一个让校园闲置电脑共享算力的点子。天枢安静了几秒：“宿主，这个方案，值得认真听。”')], reward: { compute: 15 } },
    market: { title: '第一笔，不靠运气', subtitle: '第二幕 · 起步', place: 'gate', day: 2, time: '上午', kind: 'choice', lead: '原型需要硬件。后街的旧电脑店正好有个难题。',
      shots: [shot('', '“能修好，工钱三百；修不好，也不用你赔。”老板把一台旧主机推过来。', 'notebook'), shot('天枢', '硬盘故障是假象。供电接触不良，预计修复时间九十秒。'), shot('苏祁', '这里有两条闲置内存。老板，工钱能不能折成零件？')], question: '你需要一笔能滚动起来的资源。', choices: [choice('收工钱，再接两单维修。', '财富 +600 · 精神 -3', { cash: 600, spirit: -3 }, '你们修到中午。老板给你一张名片：“下次直接来，不用排队。”'), choice('换零件，今晚把原型装好。', '苏祁羁绊 +10 · 原型优化', { bonds: { sq: 10 }, flags: ['hardware'], intelligence: 6 }, '苏祁抱着零件箱笑得像捡到宝。“今晚别睡，我请泡面。”'), choice('谈长期合作：我修，你卖。', '财富 +350 · 声望 +8', { cash: 350, reputation: 8, flags: ['business'] }, '老板试了试修好的电脑，伸出手。“成交。年轻人，别让我等太久。”')], reward: { compute: 15 }, messages: ['gqh-lab'] },
    lab: { title: '被改写的时间戳', subtitle: '第二幕 · 取证', place: 'lab', day: 2, time: '下午', kind: 'circuit', lead: '顾教授允许你查看项目备份。修改记录里有一个陌生账号。',
      shots: [shot('顾清河', '我只给你只读权限。把证据找出来，别替任何人编一个结论。', 'awake'), shot('天枢', '三段备份被打乱。接通数据链，即可复原名单变更记录。'), shot('苏祁', '原件我来校验。你就算找到什么，也得让别人相信。')], success: '最后一段日志亮起：名单在开放报名前就被改过。苏祁保存了原件和校验值。现在，证据会说话。', fail: '备份残缺。你保存了仍可读取的申请回执，足以要求重审，但暂时无法证明是谁动的手。', reward: { intelligence: 8, bonds: { gqh: 10 }, flags: ['evidence'], compute: 15 }, fallback: { intelligence: 4, flags: ['receipt'], compute: 10 }, messages: ['unknown'] },
    hearing: { title: '把结果交还给所有人', subtitle: '第三幕 · 公开答辩', place: 'hall', day: 3, time: '上午', kind: 'choice', lead: '答辩开始。你带来的不仅是一个作品。',
      shots: [shot('', '教室坐满了人。赵天宇的演示刚结束，你走上讲台，接好那台旧电脑。', 'campus', '51% 24%'), shot('赵天宇', '共享算力？连台像样的服务器都没有，你拿什么证明？'), shot('天枢', '本机算力不足。可选方案：接入同伴设备，或牺牲全部缓存进行一次超频。'), shot('陈旭', '我们不是没有服务器。我们有的是愿意加入的人。')], question: '最后这一步，由你决定。', choices: [choice('公开修改记录，请评审重新表决。', '需要完整证据或申请回执 · 声望 +25', { reputation: 25, flags: ['public'] }, '日志投上幕布。顾清河当场封存评审账号，并宣布重新评审。全场响起的掌声，终于与你有关。',), choice('和大家连线，让原型跑起来。', '林晚、苏祁羁绊 +8 · 合作路线', { bonds: { lw: 8, sq: 8 }, reputation: 18, flags: ['team'] }, '一台、两台、十七台电脑上线。林晚报出结果，苏祁举起双手。你们的原型真的跑起来了。'), choice('我自己来，完成最后一次超频。', '算力 -15 · 声望 +20', { compute: -15, reputation: 20, flags: ['overclock'] }, '缓存一层层熄灭，进度却稳稳走到百分之百。天枢的声音断了一下：“任务完成，宿主。”')], reward: { cash: 800, compute: 15 }, messages: ['lw-result'] },
    duel: { title: '未被演算的那一拳', subtitle: '第三幕 · 雨夜', place: 'plaza', day: 3, time: '夜晚', kind: 'combat', lead: '陌生人挡住去路。他竟然知道“天枢”这个名字。',
      shots: [shot('', '答辩结束后，广场下起了雨。一个陌生人站在路灯照不到的地方。', 'rain'), shot('陆沉', '你以为赢一场比赛，就算改变命运了？天枢没告诉你，上一个宿主怎么结束的？', 'rain'), shot('天枢', '检测到同源协议。建议保持距离。正在编译动作：突进、防守、读招。', 'awake'), shot('陈旭', '你想知道它选了谁？那就看清楚。', 'rain')], success: '你看穿了他的第三次变招，擦着他的肩膀冲出包围。远处传来苏祁的声音。陆沉没有再追：“下次见，宿主。”', fail: '算力骤降，天枢短暂失声。你用最后一次格挡撑到苏祁和保安赶来。陆沉退进雨里，留下一句：“别太依赖那个声音。”', reward: { physique: 10, reputation: 20, spirit: 8 }, fallback: { physique: 5, spirit: 10, bonds: { sq: 5 } } },
    finale: { title: '这一页，由我来写', subtitle: '尾声 · 重启之后', place: 'lake', day: 4, time: '清晨', kind: 'choice', lead: '天亮了。手机里都是未读消息。这一次，你并不孤单。',
      shots: [shot('', '雨停了。你走到镜湖边，看到有人带着早餐等你。', 'campus', '26% 64%'), shot('林晚', '你昨晚说“明天见”。所以我来了。'), shot('天枢', '首阶段评估完成。与原轨迹偏差：显著。宿主，你对结果满意吗？'), shot('陈旭', '还没结束。不过，这个开头不错。')], question: '为这次重启留下一个约定。', choices: [choice('下次，所有人一起赢。', '林晚、苏祁羁绊 +5', { bonds: { lw: 5, sq: 5 }, flags: ['promise'] }, '你把豆浆分给苏祁，林晚把热包子推过来。天枢第一次没有给出最优解。'), choice('把天枢的来历查清楚。', '智力 +8 · 追踪同源协议', { intelligence: 8, flags: ['origin'] }, '电脑里多出一个加密目录。创建日期，是你出生的前一天。'), choice('这一世，我不会再丢下自己。', '精神 +12', { spirit: 12 }, '你把七年前写了一半的日记翻到新的一页。这一次，字写得很稳。')], reward: { compute: 20 } },
    repair: { title: '室友的旧硬盘', subtitle: '支线 · 苏祁', place: 'dorm', requires: ['roll'], day: 1, time: '课后', kind: 'choice', lead: '苏祁的硬盘坏了。里面是他攒了三年的作品。', shots: [shot('苏祁', '店里说救不回来了。算了，反正也没人看。', 'notebook'), shot('天枢', '损坏区域可绕过。预计恢复率：93%。')], question: '你把电脑拉到自己面前。', choices: [choice('我陪你，一点点找回来。', '苏祁羁绊 +15 · 智力 +4', { bonds: { sq: 15 }, intelligence: 4, flags: ['backup'] }, '屏幕上第一张作品重新出现时，苏祁很久没说话。“陈旭，你以后有什么事，叫我。”'), choice('教你一个恢复办法。', '苏祁羁绊 +10 · 算力 +15', { bonds: { sq: 10 }, compute: 15 }, '你把每一步写下来。他照着试，屏幕亮了。“原来还能这样。”')], reward: { spirit: 3 } },
    leaf: { title: '夹在书里的秋天', subtitle: '支线 · 林晚', place: 'library', requires: ['math'], day: 1, time: '课后', kind: 'choice', lead: '借来的书里，多了一枚写着字的银杏叶。', shots: [shot('', '银杏叶背面写着：“谢谢你没说，这么简单你都不会。”', 'library'), shot('天枢', '检测到未归档的人际反馈。建议：妥善保管。')], question: '你在空白的地方写下……', choices: [choice('明天，还是这个位置。', '林晚羁绊 +12 · 精神 +5', { bonds: { lw: 12 }, spirit: 5, flags: ['leaf'] }, '第二天，第三排的桌上放着两杯豆浆。'), choice('下次换你教我。', '林晚羁绊 +10 · 智力 +5', { bonds: { lw: 10 }, intelligence: 5 }, '她回了一句：“那你先学会认真吃早饭。”')], reward: { compute: 5 } },
    run: { title: '不借来的力量', subtitle: '支线 · 晨练', place: 'gym', requires: ['gym'], day: 2, time: '课后', kind: 'qte', lead: '关闭动作接管。这次，试试自己的身体。', shots: [shot('陈旭', '天枢，这一组别帮我。'), shot('天枢', '已切换为观察模式。提醒：你上一世的膝盖问题，与十八岁的你无关。')], success: '最后一圈冲线，你听见自己畅快的呼吸。原来这种轻松，也能重新拥有。', fail: '你跑得不快，但跑完了。天枢记下数据：“与昨日相比，进步已确认。”', reward: { physique: 8, spirit: 5, compute: 10 }, fallback: { physique: 4, spirit: 5, compute: 10 } },
    professor: { title: '教授没有问完的话', subtitle: '支线 · 顾清河', place: 'lab', requires: ['market'], day: 2, time: '课后', kind: 'choice', lead: '顾教授盯着你的电脑，叫出了一个不该知道的名字。', shots: [shot('顾清河', '这台机器……它是不是会在没人碰的时候，自己亮起来？', 'awake'), shot('天枢', '识别到旧授权标记。记录访问被拒绝。')], question: '你决定告诉他多少？', choices: [choice('您是不是也听过那个声音？', '顾清河羁绊 +15 · 旧宿主线索', { bonds: { gqh: 15 }, flags: ['oldhost'] }, '他把一张旧门禁卡放在桌上。“等你准备好，再来找我。”'), choice('只是个我在调试的程序。', '精神 +5 · 算力 +15', { spirit: 5, compute: 15 }, '顾教授没有拆穿。“那就记住，别把所有决定都交给它。”')], reward: { intelligence: 5 } },
  };
  nodes.salvage = { title: '后街零件回收', subtitle: '校园委托 · 维修店', place: 'gate', requires: ['intro'], day: 1, time: '课后', kind: 'salvage', repeatable: true, lead: '旧主机里有不少好零件。对准值钱的芯片，避开沉重的废料。', shots: [shot('苏祁', '别看这一堆破铜烂铁，凑齐好零件，咱们的原型就有着落了。', 'notebook'), shot('天枢', '回收装置已接入。芯片价值高，重型主机回收慢。行动窗口由你决定。', 'awake')], success: '一盒完好的芯片放在桌上。老板留下你的号码：“以后有好货，我先叫你。”', fail: '这批零件没有凑齐，不过装置还能再试。老板把线圈复位，给你又留了一次机会。', reward: {}, fallback: {} };
  nodes.memory = { title: '四秒钟的回声', subtitle: '校园训练 · 记忆回放', place: 'library', requires: ['intro'], day: 1, time: '课后', kind: 'memory', repeatable: true, lead: '记住信号亮起的顺序。它们像记忆一样，只出现一瞬。', shots: [shot('林晚', '我总是记不住演示的顺序。你能陪我练一次吗？', 'library'), shot('天枢', '将信号拆分成节奏。比起死记硬背，试着寻找它们之间的联系。', 'awake')], success: '最后一组灯光依次亮起。林晚合上笔记：“这一次，真的记住了。”', fail: '第三组信号交错了一下。你们把最难的那一段标出来，下次从这里开始。', reward: {}, fallback: {} };
  nodes.bargain = { title: '旧书局收购谈判', subtitle: '商店街委托 · 社团书箱', place: 'gate', requires: ['intro'], day: 1, time: '课后', kind: 'bargain', repeatable: true, lead: '南门旧书局有一箱社团急需的旧书。用线索与信任谈下一份好报价，合作还能降低便利店进价。', shots: [shot('林晚', '社团想收这箱旧书。两百一以内能谈成，就替大家定下来。', 'library'), shot('旧书店主', '三百二，是我的开价。不过你真懂这些书，我们可以慢慢谈。', 'library')], success: '店主在收购单上签字：“书交给懂它的人，我放心。便利店进货的事，我也替你打个招呼。”后续经营的两类商品进价各减少 ¥1。', fail: '你收起报价单，没有勉强成交。调查一下书局里的记录，或者请林晚帮忙，再来聊聊。', reward: {}, fallback: {} };
  nodes.supply = { title: '便利店六轮经营', subtitle: '商店街委托 · 代理店长', place: 'gate', requires: ['intro'], day: 1, time: '课后', kind: 'supply', repeatable: true, lead: '榕树便利店缺一位代理店长。用店里的 ¥300 备用金，应对六轮校园客流，争取 ¥180 净收益。', shots: [shot('便利店老板', '店里的三百块交给你周转，不动你自己的钱。六轮营业，挣到一百八就算过关。'), shot('林晚', '咖啡放不过夜，笔记本可以留着。先看看校园日程，再决定进多少货。')], success: '你把流水账交回柜台。老板翻了两页，笑着给你留了一份补给：“以后店里忙，我还找你。”', fail: '老板把账本合好：“没关系。雨天、考试和调休，各有各的客流。下次别让冷柜里的咖啡白白放坏。”', reward: {}, fallback: {} };
  main.forEach((id, i) => { nodes[id].requires = i ? [main[i - 1]] : []; nodes[id].main = true; });
  // 完整证据与「申请回执」都能要求重审：实验楼小游戏失手不应该永久锁死一条结局，
  // 也不应该让答辩界面出现一个永远点不动的选项。两条路线的回报差异由 lab 节点自身承担。
  nodes.hearing.choices[0].needFlagAny = ['evidence', 'receipt'];
  nodes.hearing.choices[0].lockedHint = '缺少可以提交的记录';
  nodes.hearing.choices[2].cost = 15;
  const messages = {
    'sq-welcome': { person: 'sq', text: '醒了没？早餐在桌上。第一天上课就迟到，你是想出名啊。', replies: [choice('谢了，今天一起走。', '', { bonds: { sq: 4 } }, '行，我在楼下等你。'), choice('你那台旧电脑，晚上我看看。', '', { bonds: { sq: 3 }, intelligence: 1 }, '真的假的？我可当真了。')] },
    'lw-library': { person: 'lw', text: '我是林晚。下午去图书馆吗？有道题想问你。', replies: [choice('第三排靠窗，见。', '', { bonds: { lw: 4 } }, '你怎么知道我总坐那里？'), choice('把题发我，我先看看。', '', { intelligence: 2, bonds: { lw: 2 } }, '好。谢谢你。')] },
    'lw-thanks': { person: 'lw', text: '今天那道题，我自己重新做出来了。不是背答案的那种。', replies: [choice('我知道你可以。', '', { bonds: { lw: 5 } }, '明天给你带早餐。不要拒绝。')] },
    'sq-video': { person: 'sq', text: '录像发群里了。你现在是江大热帖第一。别谢，记得请饭。', replies: [choice('饭管够，你也是功臣。', '', { bonds: { sq: 5 } }, '这句话我截图了。')] },
    'gqh-lab': { person: 'gqh', text: '下午三点，实验室。带上你们的作品，以及你们对公平的理解。', replies: [choice('我们会准时到。', '', { bonds: { gqh: 3 } }, '记住，证据比情绪有用。')] },
    'unknown': { person: 'zty', text: '有人让我转告你：别查下去了。你不知道自己碰的是什么。', replies: [choice('让他当面说。', '', { spirit: 3 }, '……你真以为我是在吓你？')] },
    'lw-result': { person: 'lw', text: '结果出来了。我们第一！我给我妈打电话了，她说周末请你们来吃饭。', replies: [choice('好。我们一起去。', '', { bonds: { lw: 6, sq: 3 } }, '那说好了，一个都不能少。')] },
  };
  const quiz = [
    { q: '把 1 + 2 + … + 100 首尾配对，每一对等于 101，一共有多少对？', options: ['25 对', '50 对', '100 对', '101 对'], answer: 1, explain: '首尾各取一个数，100 个数组成 50 对，和为 5050。' },
    { q: '一台电脑每秒处理 6 份任务，另一台每秒处理 4 份。合作处理 50 份，要多久？', options: ['3 秒', '4 秒', '5 秒', '10 秒'], answer: 2, explain: '两台合计每秒 10 份，50 ÷ 10 = 5 秒。这就是共享算力的起点。' },
    { q: '共享系统的总耗时取决于最慢的节点。要减少总耗时，应该先优化什么？', options: ['最快的节点', '最慢的节点', '界面颜色', '随机一个节点'], answer: 1, explain: '瓶颈决定整体速度。把最慢的一环补齐，协作才有意义。' },
  ];
  return { places, people, modules, main, nodes, messages, quiz };
})();
