const DEF_LIMIT = 100;
let undoStack = [];
let goneQueue = [];
let restoring = false;
let frameCount = 0;
let hint = null;

function settingBool(name, def){
  return Core.settings.getBool(name, def);
}

function settingInt(name, def){
  return Core.settings.getInt(name, def);
}

function enabled(){
  return settingBool("ctrlz.enabled", true);
}

function limit(){
  return settingInt("ctrlz.limit", DEF_LIMIT);
}

function recordPlace(){
  return settingBool("ctrlz.recordPlace", true);
}

function recordOverride(){
  return settingBool("ctrlz.recordOverride", true);
}

function showHint(){
  return settingBool("ctrlz.showHint", true);
}

function hintSize(){
  return settingInt("ctrlz.hintSize", 100);
}

function snapshotBuilding(b){
  if(b == null || b.block == null) return null;
  const snap = {
    block: b.block.name,
    rotation: b.rotation,
    team: b.team == null ? 0 : b.team.id,
    health: b.health,
    config: null,
    items: null,
    liquids: null
  };

  try {
    const c = b.block != null && b.block.configurable ? b.config() : null;
    snap.config = c;
  }catch(e){ snap.config = null; }

  if(b.items != null){
    const m = {};
    Vars.content.items().each(function(item){
      const a = b.items.get(item);
      if(a > 0) m[item.name] = a;
    });
    snap.items = m;
  }

  if(b.liquids != null && b.block != null && b.block.hasLiquids){
    const m = {};
    Vars.content.liquids().each(function(liq){
      const a = b.liquids.get(liq);
      if(a > 0) m[liq.name] = a;
    });
    snap.liquids = m;
  }

  return snap;
}

function applySnapshot(snap, x, y){
  const block = Vars.content.block(snap.block);
  if(block == null) return;

  const tile = Vars.world.tile(x, y);
  if(tile == null) return;

  const team = Team.all[snap.team];
  tile.setBlock(block, team == null ? Team.derelict : team, snap.rotation);
  const b = tile.build;
  if(b == null) return;

  if(snap.health > 0){
    b.health = Math.max(1, Math.min(snap.health, b.maxHealth));
  }

  if(snap.items != null && b.items != null){
    for(var k in snap.items){
      const item = Vars.content.item(k);
      if(item != null) b.items.set(item, snap.items[k]);
    }
  }

  if(snap.liquids != null && b.liquids != null){
    for(var k in snap.liquids){
      const liq = Vars.content.liquid(k);
      if(liq != null) b.liquids.set(liq, snap.liquids[k]);
    }
  }

  if(snap.config != null){
    try { b.configureAny(snap.config); }catch(e){}
  }
}

Events.on(TilePreChangeEvent, function(e){
  if(!enabled()) return;
  if(restoring) return;
  const t = e.tile;
  if(t == null) return;
  const b = t.build;
  if(b == null || b.block == null || b.block === Blocks.air) return;
  const bn = b.block.name;
  if(typeof bn === 'string' && bn.length >= 5 && bn.indexOf("build") === 0) return;
  if(b.tile !== t) return;
  const p = Vars.player;
  if(p == null || p.team() == null) return;
  if(b.team !== p.team()) return;

  const snap = snapshotBuilding(b);
  goneQueue.push({x: t.x, y: t.y, snap: snap, age: 0});
});

function takeGone(x, y){
  for(var i = 0; i < goneQueue.length; i++){
    if(goneQueue[i].x === x && goneQueue[i].y === y){
      const it = goneQueue[i];
      goneQueue.splice(i, 1);
      return it;
    }
  }
  return null;
}

Events.on(BlockBuildEndEvent, function(e){
  if(!enabled()) return;
  if(e.breaking){
    const gone = takeGone(e.tile.x, e.tile.y);
    if(gone != null && gone.snap != null){
      undoStack.push({kind: 'break', x: e.tile.x, y: e.tile.y, before: gone.snap, prev: null});
    }else{
      const fs = fallbackBreakSnap(e);
      undoStack.push({kind: 'break', x: e.tile.x, y: e.tile.y, before: fs, prev: null});
    }
    trim();
  }else{
    if(!recordPlace()){
      takeGone(e.tile.x, e.tile.y);
      return;
    }
    const covered = takeGone(e.tile.x, e.tile.y);
    const prev = (covered != null && recordOverride()) ? [covered] : null;
    const built = e.tile.build;
    undoStack.push({kind: 'place', x: e.tile.x, y: e.tile.y, block: built != null && built.block != null ? built.block.name : null, prev: prev, before: null});
    trim();
  }
});

function trim(){
  const l = limit();
  while(undoStack.length > l) undoStack.shift();
}

function fallbackBreakSnap(e){
  const cb = e.tile.build;
  if(cb != null && cb.previous != null && cb.previous !== Blocks.air){
    return {
      block: cb.previous.name,
      rotation: cb.rotation,
      team: e.team.id,
      health: 0,
      config: null,
      items: null,
      liquids: null
    };
  }
  return null;
}

function localizedBlockName(name){
  if(name == null) return "";
  const b = Vars.content.block(name);
  if(b == null) return name;
  return b.localizedName;
}

function undo(){
  if(!enabled()) return;
  if(undoStack.length === 0) return;
  const ev = undoStack.pop();

  restoring = true;
  try {
    if(ev.kind === 'break'){
      if(ev.before != null){
        applySnapshot(ev.before, ev.x, ev.y);
        if(showHint()){
          hint = {text: localizedBlockName(ev.before.block), x: ev.x * Vars.tilesize, y: ev.y * Vars.tilesize, age: 0};
        }
      }
    }else if(ev.kind === 'place'){
      const tile = Vars.world.tile(ev.x, ev.y);
      if(tile != null){
        tile.remove();
        if(ev.prev != null){
          for(var i = 0; i < ev.prev.length; i++){
            const p = ev.prev[i];
            applySnapshot(p.snap, p.x, p.y);
          }
        }
        if(showHint()){
          hint = {text: localizedBlockName(ev.block), x: ev.x * Vars.tilesize, y: ev.y * Vars.tilesize, age: 0};
        }
      }
    }
  } finally {
    restoring = false;
  }
}

Events.run(Trigger.update, function(){
  frameCount++;

  if(hint != null){
    hint.age++;
    if(hint.age > 40){
      hint = null;
    }
  }

  if(enabled()){
    for(var i = goneQueue.length - 1; i >= 0; i--){
      goneQueue[i].age++;
      if(goneQueue[i].age > 2){
        const it = goneQueue[i];
        goneQueue.splice(i, 1);
        if(it.snap != null){
          undoStack.push({kind: 'break', x: it.x, y: it.y, before: it.snap, prev: null});
          trim();
        }
      }
    }
  }

  if(Core.input.keyTap(KeyCode.z) && Core.input.ctrl()){
    undo();
  }
});

Events.run(Trigger.draw, function(){
  if(hint == null) return;
  const scale = hintSize() / 100;
  Fonts.outline.getData().setScale(scale);
  Fonts.outline.draw(hint.text, hint.x, hint.y, Align.center);
  Fonts.outline.getData().setScale(1);
});

Events.on(ClientLoadEvent, function(){
  Vars.ui.settings.addCategory("@ctrlz.category", function(table){
    table.checkPref("ctrlz.enabled", true);
    table.sliderPref("ctrlz.limit", DEF_LIMIT, 10, 1000, 10, function(v){
      return v + "";
    });
    table.checkPref("ctrlz.recordPlace", true);
    table.checkPref("ctrlz.recordOverride", true);
    table.checkPref("ctrlz.showHint", true);
    table.sliderPref("ctrlz.hintSize", 100, 50, 200, 10, function(v){
      return v + "%";
    });
  });
});
