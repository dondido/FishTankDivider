document.addEventListener("DOMContentLoaded", ready, false);
var isTouch = ("ontouchstart" in window);
var evt=[{"down": "mousedown", "move": "mousemove", "up": "mouseup"},{"down": "touchstart", "move": "touchmove", "up": "touchend"}][+isTouch];

var Game = function() {

	var stage = document.getElementById("stage"),
		levelEntities = document.getElementById("level-entities"),
		middleWall = document.querySelector(".middle-wall"),
		wall = document.getElementById("wall-filter"),
		bottomWall = document.getElementById("bottom-wall"),
		topWall = document.getElementById("top-wall"),
		levelEnd = document.getElementById("level-end"),
		levelList = document.getElementById("level-list"),
		optionsMenu = document.querySelector(".options-menu");

	var toggleGameStateIcon = optionsMenu.querySelector(".toggle-game-state-btn > span"),
		toggleSoundIcon = optionsMenu.querySelector(".sound-btn > span"),
		lvlStats = levelEnd.querySelector(".lvl-stats");

	var levelEndStars = lvlStats.querySelectorAll(".stars > li"),
		lvlEndLast = lvlStats.querySelector(".last-score"),
		lvlEndBest = lvlStats.querySelector(".best-score"),
		lvlEndAvrg = lvlStats.querySelector(".average-score"),
		lvlEndCompleted = lvlStats.querySelector(".completed");
	
	var borderWidth = parseInt(getComputedStyle(stage,null).getPropertyValue("border-top-width"), 10) * 2,
		stageH = parseInt(getComputedStyle(stage,null).getPropertyValue("height"), 10),
		stageW = parseInt(getComputedStyle(stage,null).getPropertyValue("width"), 10);
	// titleScreen.className = "main-content";
	window.location.hash = "#title-screen";
	//perform required calculation before hiding the stage
	var offsetY, mouseY, gapTop, gapBottom, tmp, b, stageHH = stageH / 2,
		stageHW = stageW / 2,
		stageCenterY, stageY, stageX, stageSH, stageSW, stageS,
		filterTopY, filterBottomY, limitTopY, limitBottomY, moveY, moveSY, moveWall = false,
		compareChecks = 0,
		soundOn = localStorage.getItem("soundOn") != "0" ? true : false,
		snds = document.getElementsByTagName("audio"),
		runFps = true,
		scoreList = localStorage.getItem("scoreList"),
		frameTime = 40,
		level, lvlTime = 0,
		wallLeft, wallRight, uniquePos = {},
		uniqueSpeed = [],
		clientTransform = "transform",
		transformPrefixes = ["webkitTransform", "MozTransform", "msTransform"],
		lvlDt = {},
		levelData= {},
		lvlTmpl = {
			entityNames: ["fish5", "fish6"],
			entities: 2,
			wallWidth: 2,
			speedRange: [[1,2],[1,2]],
			filter: 100
		},
		entityNodes = {
			fish5: document.querySelector(".fish5"),
			fish6: document.querySelector(".fish6"),
			fish7: document.querySelector(".fish7"),
			fish8: document.querySelector(".fish8"),
			fish10: document.querySelector(".fish10"),
			fish11: document.querySelector(".fish11")
		};
	
	var p;
	if (!document.documentElement.style[clientTransform]) {
		for (p in transformPrefixes) {
			clientTransform = transformPrefixes[p];
			if (document.documentElement.style[clientTransform] !== undefined) {
				break;
			}
		}
	}

	scoreList = scoreList ? scoreList.split(",") : [];
	
	// check localStorage if sound was previously turned off and applies the state to the current game
	soundOn || (toggleSoundIcon.className = "sound-off-icon");
	
	var locRouter = {
			"#level-select" : "exitState",
			"#stage" : "initStage"
		},
	eventRouter = {
		toggleGameState: function() {
			toggleGameStateIcon.className = ["pause-icon", "play-icon"][+(runFps = !runFps)];
			if(runFps){
				limitLoop(drawStatic, frameTime);
				playAudio("music_game");
			} else {
				stopAudio();
			}
		},
		
		toggleSnd: function() {
			toggleSoundIcon.className = ["sound-off-icon", "sound-on-icon"][+(soundOn = !soundOn)];
			if (runFps) {
				soundOn ? playAudio("music_game") : stopAudio();
			}
			localStorage.setItem("soundOn", + soundOn);
		},
		
		exitGame: function() {
				window.location.hash = window.location.hash == "#level-select" ? "#title-screen" : "#level-select";
		},
		
		exitState: function() {
			document.removeEventListener(evt.down, addDrag, false);
			stopAudio();
			runFps = false;
			prepareLevelSelect();
		},

		initStage: function(){
			document.addEventListener(evt.down, addDrag, false);
			levelData.entityNames = locateProp("entityNames");
			levelData.wallWidth = locateProp("wallWidth");
			wallLeft = stageHW - levelData.wallWidth;
			wallRight = stageHW + levelData.wallWidth;
			middleWall.style.left = wallLeft + "px";
			middleWall.style.width = levelData.wallWidth * 2 + "px";
			levelData.filter = locateProp("filter");
			levelData.speedRange = locateProp("speedRange");
			filterTopY = levelData.filter;
			filterBottomY = stageH - filterTopY;
			gapTop = filterTopY;
			gapBottom = filterBottomY;
			limitTopY = stageHH - filterTopY;
			limitBottomY = stageHH + filterTopY;
			moveY = stageHH;
			moveSY = stageY + stageSH / 2;

			filterTopY -= stageHH;
			filterBottomY -= stageHH;

			wall.style.top = stageHH + "px";
			topWall.style.height = bottomWall.style.height = parseInt(getComputedStyle(middleWall,null).getPropertyValue("height"), 10) / 2 + filterTopY + "px";
			processEntity(prepareEntity);
			
			uniqueSpeed = [];
			runFps = true;
			lvlTime = 0;
			limitLoop(drawStatic, frameTime);
			playAudio("music_game");
		}
		
	};

	// rAF normalization
	window.requestAnimationFrame = function() {
		return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.msRequestAnimationFrame || window.oRequestAnimationFrame ||
		function(f) {
			window.setTimeout(f, 1e3 / 60);
		};
	}();

	var l, 
		levelTile,
		lvlScore,
		txtNode,
		levelSrc = document.querySelector(".level-tile"),
		fragment = document.createDocumentFragment(),
		unlock = true;

	levelSrc.querySelector("a").appendChild(lvlStats.cloneNode(true));

	for (l in levels) {
		levelTile = levelSrc.cloneNode(true);

		txtNode = levelTile.querySelector("span");
		txtNode.textContent = + l + 1;

		if (unlock) {

			unlockNextLevel(levelTile, l);

			if (scoreList[l]) {
				lvlScore = scoreList[l].split("-");
				lvlDt = levels[l];
				lvlDt.stars = lvlScore[0];
				highlightStars(levelTile);
				levelTile.querySelector(".last-score").textContent = lvlDt.pts = + lvlScore[1];
				levelTile.querySelector(".best-score").textContent = lvlDt.best = + lvlScore[2];
				levelTile.querySelector(".average-score").textContent = lvlDt.avrg = + lvlScore[3];
				levelTile.querySelector(".completed").textContent = lvlDt.n = + lvlScore[4];
			} else if (unlock) {
				unlock = false;
			}
		}
		fragment.appendChild(levelTile);
	}

	levelList.appendChild(fragment);
	
	function unlockNextLevel(el, l){
		el.setAttribute("data-level-n", l);
		el.querySelector("a").setAttribute("href","#stage");
		el.className = el.className.replace(" locked", "");
	}

	// Reflow canvas size/margin on resize
	window.addEventListener('resize', reflow, false);
	reflow();

	function reflow() {
		// 2d vectors to store various sizes
		var browser = [~~window.innerWidth, ~~window.innerHeight],
		list,
		i;
		// Minimum stageS to fit whole canvas
		stageS = Math.min(
		browser[0] / (stageW + borderWidth), browser[1] / (stageH + borderWidth));
		// Scaled content size
		stageSW = (stageW + borderWidth) * stageS;
		stageSH = (stageH + borderWidth) * stageS;
		// Offset from top/left
		stageX = (browser[0] - stageSW) / 2 | 0;
		stageY = (browser[1] - stageSH) / 2 | 0;
		stageCenterY = stageY + stageSH / 2;

		// see media query restrains in the css file
		if (browser[0] > 600){
			list = document.querySelectorAll("a, h1, ul, section, .show-score, #level-end .lvl-stats");
			i = list.length;
			while (i--) {
				list[i].style.zIndex = 1;
			}
		}
		// Apply CSS transform
		stage.style[clientTransform] = "translate(" + stageX + "px, " + stageY + "px) scale(" + stageS + ")";
	}

	function prepareEntity() {

		tmp.checked = 0;
		tmp.entities = tmp.entities || locateProp("entities");
		tmp.entityNodes = [];

		var l = tmp.entities,
			i,
			xy,
			buble,
			dirXY,
			positionMatrix,
			speed = levelData.speedRange[tmp.n],
			src = entityNodes[levelData.entityNames[tmp.n]];
			
		var wh = src.getAttribute("data-size");

		wh = wh.split(",");
		
		tmp._w = + wh[0];
		tmp._h = + wh[1];
		
		positionMatrix = tmp._w + "_" + tmp._h;

		uniquePos[positionMatrix] = generateMap(stageW, stageH, tmp._w, tmp._h, 0, 0);
		uniqueSpeed = uniqueSpeed.length ? uniqueSpeed : generateMap(speed[1], speed[1], 0.1, 0.1, speed[0], speed[0]); 
 
		while (l--) {
			buble = src.cloneNode(true);
			//buble.id = tmp.name + l;
			levelEntities.appendChild(buble);
			// we have to make sure that we have the same amount of fishes on both sides
			i = uniquePos[positionMatrix].length / 2 | 0;
			var r = (Math.random() * i + (l % 2 ? 0 : i)) | 0;
			xy = uniquePos[positionMatrix].splice(r, 1)[0];

			buble._y = xy[1];
			buble._x = xy[0];
			buble.style.width = tmp._w + "px";
			buble.style.height = tmp._h + "px";
			buble.style.top = buble._y + "px";
			buble.style.left = buble._x + "px";

			dirXY = uniqueSpeed.splice(Math.random() * uniqueSpeed.length | 0, 1)[0];

			buble.dirY = (dirXY[0] * ((Math.random() * 2 )|0 || -1)).toFixed(1);
			buble.dirX = (dirXY[1] * ((Math.random() * 2 )|0 || -1)).toFixed(1);
			
			buble.dirX < 0 && (buble.className += " reverse-x");

			tmp.entityNodes.push(buble);
		} // end while
	} // End of the function

	function generateMap(w, h, x, y, xd, yd) {
		var i = x + xd,
			ii = y + yd,
			map = [];
		while (i < w) {
			map.push([i, ii]);
			ii += y;
			if (ii >= h) {
				ii = y + yd;
				i += x;
			}
		}
		return map;
	}

	function checkYCollision(u, d) {
		if (b._y + tmp._h > u) {
			b._y = u - tmp._h;
			b.dirY = -Math.abs(b.dirY);
		} else if (b._y < d) {
			b._y = d;
			b.dirY = Math.abs(b.dirY);
		} // end if
	}


	function checkOutOfMiddle() {
		return b._y + b.dirY < gapTop || b._y + tmp._h + b.dirY > gapBottom;
	}

	function enterFrame() {

		var l = tmp.entities,
			checked = 0,
			best,
			avrg,
			pts,
			i,
			lvlTile,
			nextLevel;

		while (l--) {
			b = tmp.entityNodes[l];
			b.dirX = +b.dirX;
			b.dirY = +b.dirY;
			if (b._x >= wallRight) {
				checked++;

				if (b._x + tmp._w > stageW) {
					b.dirX = -Math.abs(b.dirX);
					b.className.indexOf("reverse-x") == -1 && (b.className += " reverse-x");
				} else if (checkOutOfMiddle()) {
					if (b._x + b.dirX <= wallRight) {
						b.dirX = Math.abs(b.dirX);
						b.className.indexOf("reverse-x") != -1 && (b.className = b.className.replace(" reverse-x", ""));
					}
					checkYCollision(stageH, 0);
				}
			} else if (b._x + tmp._w <= wallLeft) {
				checked--;
				if (b._x < 0) {
					b.dirX = Math.abs(b.dirX);
					b.className.indexOf("reverse-x") != -1 && (b.className = b.className.replace(" reverse-x", ""));
				} else if (checkOutOfMiddle()) {
					if (b._x + tmp._w + b.dirX >= wallLeft) {
						b.dirX = -Math.abs(b.dirX);
						b.className.indexOf("reverse-x") == -1 && (b.className += " reverse-x");
					}
					checkYCollision(stageH, 0);
				}
			} else {
				checkYCollision(gapBottom, gapTop);
			}

			b._x = b._x + b.dirX;
			b._y = b._y + b.dirY;

			b.style.left = b._x + "px";
			b.style.top = b._y + "px";
		}

		if (checked) {
			if (compareChecks) {
				compareChecks += checked;
				if (!compareChecks) {
					levelEnd.className = "";
					runFps = false;
					
					stopAudio();
					
					lvlDt = levels[level];
					//clearInterval(frameInterval);
					best = tmp.entities * 200;
					avrg = best * 2;
					pts = avrg - lvlTime;
					pts < 0 && (pts = 0);

					
					nextLevel = levelList.children[+ level + 1];
					nextLevel && unlockNextLevel(nextLevel, + level + 1);

					if (lvlTime < best) {
						lvlDt.stars = 3;
					} else if (lvlTime < best * 2) {
						lvlDt.stars = 2;
					} else {
						lvlDt.stars = 1;
					}

					for (i in levelEndStars) {
						levelEndStars[i].className = "";
					}
					i = 0;
					while (i < lvlDt.stars) {
						highlightStarsWithDelay(i);
						i++;
					}

					lvlTile = levelList.children[level];
					lvlEndLast.textContent = lvlTile.querySelector(".last-score").textContent = pts;

					if (lvlDt.n === undefined) {
						// update everything
						lvlDt.best = lvlDt.avrg = pts;
						lvlDt.n = 0;
						highlightStars(lvlTile);
					} else { 
						if (lvlDt.best < pts) { 
							lvlDt.best = pts;
							lvlDt.stars > lvlDt.maxStars && highlightStars(lvlTile);
						}
						lvlDt.avrg = ((lvlDt.avrg * lvlDt.n + pts) / (lvlDt.n + 1))|0;
					} 
					++ lvlDt.n;
					
					lvlEndBest.textContent = lvlTile.querySelector(".best-score").textContent = lvlDt.best;
					lvlEndAvrg.textContent = lvlTile.querySelector(".average-score").textContent = lvlDt.avrg;
					lvlEndCompleted.textContent = lvlTile.querySelector(".completed").textContent = lvlDt.n;
					
					scoreList[level] = [lvlDt.maxStars, pts, lvlDt.best, lvlDt.avrg, lvlDt.n].join("-");
					localStorage.setItem("scoreList", scoreList);
					window.location.hash = "#level-end";
				}
			} else if (tmp.entities == Math.abs(checked)) {
				compareChecks = checked;
			}
		}
	}

	function highlightStars(lvlTile) {
		lvlDt.maxStars = lvlDt.stars;
		var levelStars = lvlTile.querySelectorAll(".stars > li"),
		i = 0;
		while (i < lvlDt.stars) {
			levelStars[i].className = "highlight";
			i++;
		}
	}

	function highlightStarsWithDelay(index) {
		setTimeout(function() {
			levelEndStars[index].className = "highlight";
			playAudio("star");
		}, 1000 * (index + 1));
	}

	function prepareLevelSelect() {
		// remove all game characters
		while (levelEntities.hasChildNodes()) {
			levelEntities.removeChild(levelEntities.lastChild);
		}
		document.addEventListener(evt.down, prepareLevel, false);
	}
	
	window.addEventListener("hashchange", routeHash, false);
	
	function drawStatic() {
		moveWall && positionDragItem();
		
		processEntity(enterFrame);
		compareChecks = 0;
		lvlTime++;
	}

	function processEntity(fn) {
		levels[level].entityTypes = levels[level].entityTypes || [{},{}];
		for (var i in levels[level].entityTypes) {
			tmp = levels[level].entityTypes[i];
			tmp.n = i;
			fn();
		}
	}

	function addDrag(e) {
		var target = e.target;
		while (target != this) {
			if (~target.className.indexOf("option-btn")) {
				eventRouter[target.getAttribute("data-fn")]();
				return;
			}
			target = target.parentNode;
		}
		
		mouseY = e.clientY || e.touches[0].clientY;
		offsetY = wall.offsetTop - mouseY;
		moveWall = true;
		document.removeEventListener(evt.down, addDrag, false);
		document.addEventListener(evt.move, moveItem, false);
		document.addEventListener(evt.up, stopDrag, false);
	}

	function moveItem(e) {
		e.preventDefault();
		mouseY = e.clientY || e.touches[0].clientY;
	}

	function positionDragItem() {

		var moveYDir = mouseY - moveSY,
		 	dist = 10 * stageS;

		if (moveYDir < dist) {
			dist = moveYDir > -dist ? moveYDir : -dist;
		}
		moveY += dist / stageS;

		if (moveY < limitTopY) {
			moveY = limitTopY;
			moveSY = stageY;
		} else if (moveY > limitBottomY) {
			moveY = limitBottomY;
		}
		moveSY = stageY + moveY * stageS;
		gapTop = moveY + filterTopY;
		gapBottom = moveY + filterBottomY;
		wall.style.top = moveY + "px";
	}

	function stopDrag() {
		moveWall = false;
		document.addEventListener(evt.down, addDrag, false);
		document.removeEventListener(evt.move, moveItem, false);
		document.removeEventListener(evt.up, stopDrag, false);
	}

	function limitLoop(fn, fps) {

		var then = Date.now(),
			now,
			delta;

		// custom fps, otherwise fallback to 60
		fps = fps || 60;
		var interval = 1000 / fps;

		return (function loop() {
			if (!runFps) {
				return false;
			}
			window.requestAnimationFrame(loop);

			now = Date.now();
			
			delta = now - then;

			if (delta > interval) {
				// Update time
				// now - (delta % interval) is an improvement over just 
				// using then = now, which can end up lowering overall fps
				then = now - (delta % interval);
				// call the fn
				fn();
			}
		}());
	}

	function routeHash() {
		location.hash in locRouter && eventRouter[locRouter[location.hash]]();
	}

	var locateProp = function (str) {
		var o, 
			l = + level + 1;

		while (l--) {
			if (str in levels[l]) {
				o = levels[l][str];
				break;
			}
		}
		return o || lvlTmpl[str];
	};

	function prepareLevel(e) {
		
		var target = e.target;

		while (target != this) {
			if (~target.className.indexOf("level-tile")) {
				level = target.getAttribute("data-level-n");
				if (!level) {
					return;
				}
				break;
			} else if (~target.className.indexOf("option-btn")) {
				eventRouter[target.getAttribute("data-fn")]();
				return;
			}

			target = target.parentNode;
		}
		if (target == this) {
			return;
		}
		document.removeEventListener(evt.down, prepareLevel, false);
	}
	
	function stopAudio(){
			try{
					Android.stopSnd();
			}
			catch(err){
					var audio,l=snds.length;
					while (l--){
					audio = snds[l];
					audio.currentTime = 0;
					audio.pause();
					}
			}
	}

	function playAudio(j) {
			var audio = document.getElementById(j),
				newAudio;
			if (soundOn) {
					try{
							Android.playSnd(j,audio.loop.toString());
					}
					catch(err){
							if (audio.currentTime){
								newAudio = document.getElementById(j + 1);
								if (!newAudio){
									newAudio = audio.cloneNode(true);
									newAudio.id = audio.id + 1;
									audio.parentNode.insertBefore(newAudio, audio);
								}
								audio = newAudio;
							}
								
							audio.play();
							audio.addEventListener("ended", function() {this.currentTime = 0; this.pause();});
					}
			}
	}
};

function ready() {
	Game();
}