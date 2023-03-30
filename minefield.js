class Cell {

	constructor(field, r, c) {
		this.field = field;
		this.r = r;
		this.c = c;
		this.isMine = false;
		this.isDiscovered = false;
		this.isMarked = false;
		this.isMineRevealed = false;
		this.minesAround = 0;
		this.solverHighlight = null;
		this.solverProba = null;
	}


	setMine() {
		if (this.isMine)
			return;
		this.isMine = true;
		this.getAllAround().forEach(c => c.minesAround++);
	}


	revealMine() {
		if (!this.isMine)
			return;
		this.isMineRevealed = true;
	}


	toChar() {
		if (this.isMine)
			return '@';
		else if (this.minesAround > 0)
			return this.minesAround + '';
		else
			return ' '
	}

	initDOM(dom) {
		this.dom = dom;
		var that = this;
		dom.onclick = function() {
			that.leftClick(true);
		};
		dom.oncontextmenu = function() {
			that.rightClick(true);
			return false;
		}
	}

	renderDOM() {
		if (this.dom === null)
			return;
		this.setDOMClass(this.isDiscovered, "clicked");
		for (var i = 1; i <= 8; i++) {
			this.setDOMClass(this.minesAround == i && this.isDiscovered, "b" + i);
		}
		this.setDOMClass(this.isMarked, "marked");
		this.setDOMClass(this.isMineRevealed, "mine");
		this.setInnerHTML(
				this.isDiscovered && !this.isMine ? this.minesAround
				: this.solverProba !== null ? Math.round(this.solverProba * 100)
				: "");
		// discover and marking hints
		var showHints = !this.isDiscovered && !this.field.ended;
		this.setDOMClass(this.field.discoverHints && showHints
			&& this.isSafeToDiscover(), "hint-clickable");
		this.setDOMClass(this.field.markingHints && showHints
			&& this.isSafeToMark(), "hint-markable");
		this.setDOMClass(this.solverHighlight == "neutral", "solver-highlight-neutral");
		this.setDOMClass(this.solverHighlight == "safe", "solver-highlight-safe");
		this.setDOMClass(this.solverHighlight == "bomb", "solver-highlight-bomb");
		this.setDOMClass(this.solverHighlight == "safest", "solver-highlight-safest");
		this.setDOMClass(this.solverHighlight == "less-safest", "solver-highlight-less-safest");
	}

	setDOMClass(value, className) {
		if (this.dom === null)
			return;
		var hasClass = this.dom.classList.contains(className);
		if (value && !hasClass) {
			this.dom.classList.add(className);
		}
		else if (!value && hasClass) {
			this.dom.classList.remove(className);
		}
	}

	setInnerHTML(expectedValue) {
		if (this.dom.innerHTML != expectedValue)
			this.dom.innerHTML = expectedValue;
	}



	/*
		Event handlers
	*/

	leftClick(fromEvent) {
		if (!this.field.minesPlaced)
			this.field.start(this.r, this.c);

		if (this.field.ended || this.field.lockInteractions)
			return false;

		var hasUpdated = false;

		if (this.isMarked)
			this.isMarked = false;

		if (this.isDiscovered) {
			// already clicked, auto-click around if possible
			if (this.isAroundAutoDiscoverable()) {
				for (var aroundCell of this.getUndiscoveredUnmarkedAround()) {
					if (aroundCell.leftClick(false))
						hasUpdated = true;
				}
			}
		}
		else {
			this.isDiscovered = true;
			hasUpdated = true;

			if (this.isMine) { // if clicked on a mine
				this.field.endGame(false);
			}
			else if (this.minesAround == 0) {
				// if clicked on a cell with no mines around
				for (var aroundCell of this.getAround(c => !c.isDiscovered)) {
					aroundCell.leftClick(false);
				}
			}
		}

		if (fromEvent && hasUpdated) {
			this.field.updateAfterPlayerAction();
		}

		return hasUpdated;
	}



	rightClick(fromEvent) {
		if (!this.field.minesPlaced || this.field.ended || this.field.lockInteractions)
			return false;

		var hasUpdated = false;

		if (this.isDiscovered) {
			// auto mark unclicked cells around
			if (this.isAroundAutoMarkable()) {
				for (var aroundCell of this.getUndiscoveredUnmarkedAround()) {
					if (aroundCell.rightClick(false))
						hasUpdated = true;
				}
			}
		}
		else {
			this.isMarked = !this.isMarked;
			hasUpdated = true;
		}

		if (fromEvent && hasUpdated) {
			this.field.updateAfterPlayerAction();
		}

		return hasUpdated;
	}





	/*
		Accessing cells around
	*/

	getAround(predicate) {
		var ret = [];
		for (var r = Math.max(this.r - 1, 0); r <= Math.min(this.r + 1, this.field.height - 1); r++) {
			for(var c = Math.max(this.c - 1, 0); c <= Math.min(this.c + 1, this.field.width - 1); c++) {
				if (r == this.r && c == this.c)
					continue;
				var cellAround = this.field.getCell(r, c);
				if (predicate(cellAround))
					ret.push(cellAround)
			}
		}
		return ret;
	}

	getAllAround() {
		return this.getAround(c => true);
	}

	countAround(predicate) {
		return this.getAround(predicate).length;
	}




	countMarkedAround() {
		return this.countAround(c => c.isMarked);
	}

	countNonDiscoveredAround() {
		return this.countAround(c => !c.isDiscovered);
	}

	getUndiscoveredUnmarkedAround() {
		return this.getAround(c => !c.isDiscovered && !c.isMarked);
	}

	getDiscoveredAround() {
		return this.getAround(c => c.isDiscovered);
	}



	isAroundAutoDiscoverable() {
		return this.isDiscovered
				&& this.countMarkedAround() == this.minesAround
				&& this.countNonDiscoveredAround() > this.minesAround;
	}

	getDiscoverableAround() {
		if (!this.isAroundAutoDiscoverable())
			return [];
		return this.getUndiscoveredUnmarkedAround();
	}


	isSafeToDiscover() {
		return !this.isDiscovered && !this.isMarked
				&& this.countAround(c => c.isAroundAutoDiscoverable()) > 0;
	}

	isAroundAutoMarkable() {
		return this.isDiscovered
				&& this.countNonDiscoveredAround() == this.minesAround
				&& this.countMarkedAround() < this.minesAround;
	}

	getMarkableAround() {
		if (!this.isAroundAutoMarkable())
			return [];
		return this.getUndiscoveredUnmarkedAround();
	}

	isSafeToMark() {
		return !this.isDiscovered && !this.isMarked
				&& this.countAround(c => c.isAroundAutoMarkable()) > 0;
	}
}









class Minefield {

	constructor(width, height, minesCount) {
		this.width = width;
		this.height = height;

		var maxMines = width * height - 9;
		if (minesCount > maxMines) {
			minesCount = maxMines;
		}
		this.minesCount = minesCount;

		this.minesPlaced = false;
		this.grid = [];
		for (var r = 0; r < height; r++) {
			var row = [];
			for (var c = 0; c < width; c++) {
				row.push(new Cell(this, r, c));
			}
			this.grid.push(row);
		}
		this.completed = false;
		this.ended = false;

		this.fieldDOM = null;
		this.timerDOM = null;
		this.bombCountDOM = null;

		this.timeStart = null;
		this.finalTimer = null;
		this.timerInterval = null;

		this.markingHints = false;
		this.discoverHints = false;

		this.lockInteractions = false;
	}


	initDOM(fieldDOM, timerDOM, bombCountDOM) {
		this.fieldDOM = fieldDOM;
		this.timerDOM = timerDOM;
		this.bombCountDOM = bombCountDOM;

		this.fieldDOM.innerHTML = "";
		for (var r = 0; r < this.height; r++) {
			var rowDOM = grid.insertRow(r);
			for (var c = 0; c < this.width; c++) {
				this.getCell(r, c).initDOM(rowDOM.insertCell(c));
			}
		}
		document.body.classList.remove("win");
		document.body.classList.remove("loose");
	}


	setLockInteractions(lock) {
		this.lockInteractions = lock;
	}


	getCell(r, c) {
		return this.grid[r][c];
	}


	start(avoidRow, avoidCol) {
		this.placeMinesRandom(avoidRow, avoidCol, c => true);
		this.minesPlaced = true;

		this.renderDOM();
		if (this.timerDOM !== null) {
			this.timeStart = Date.now();
			this.timerInterval = setInterval(() => this.updateTimerDisplay(), 50);
		}
	}


	placeMinesRandom(avoidRow, avoidCol, validationPredicate) {
		var i = 0;
		var maxTries = Math.min(this.minesCount * 10, 10000);
		var tries = 0;
		while (i < this.minesCount && tries < maxTries) {
			tries++;
			var r = Math.floor(Math.random() * this.height);
			var c = Math.floor(Math.random() * this.width);
			if (r >= avoidRow - 1 && r <= avoidRow + 1
					&& c >= avoidCol - 1 && c <= avoidCol + 1)
				continue;
			var cell = this.getCell(r, c);
			if (cell.isMine)
				continue;
			if (validationPredicate(cell)) {
				cell.setMine();
				i++;
			}
		}
	}



	updateTimerDisplay() {
		if (this.timerDOM === null)
			return;
		var currentTime = Date.now();
		var diff = currentTime - this.timeStart;
		var decSec = Math.floor(diff / 100) % 10;
		var sec = (Math.floor(diff / 1000) % 60).toLocaleString('en-US', {minimumIntegerDigits: 2});
		var min = Math.floor(diff / 60000);
		this.timerDOM.innerHTML = min + ":" + sec + "." + decSec;
	}



	renderDOM() {
		if (this.fieldDOM === null)
			return;
		this.getAllCells().forEach(c => c.renderDOM());
		var nbMarked = this.completed ? this.minesCount : this.getCells(c => c.isMarked).length;
		this.bombCountDOM.innerHTML = nbMarked + "/" + this.minesCount;
	}

	checkCompletion() {
		if (this.getCells(c => !c.isMine && !c.isDiscovered).length == 0) {
			this.completed = true;
			this.endGame(true);
		}
	}


	updateAfterPlayerAction() {
		this.checkCompletion();
		this.renderDOM();
	}


	endGame(success) {
		if (this.ended)
			return;
		if (this.timerDOM !== null && this.minesPlaced) {
			clearInterval(this.timerInterval);
			this.updateTimerDisplay();
			this.finalTimer = Date.now() - this.timeStart;
		}
		this.revealMines();
		this.ended = true;
		if (this.fieldDOM !== null) {
			document.body.classList.add(success ? "win" : "loose");
		}
	}



	revealMines() {
		for (var cell of this.getCells(c => c.isMine)) {
			cell.revealMine();
		}
	}



	getCells(predicate) {
		var ret = [];
		for (var r = 0; r < this.height; r++) {
			for(var c = 0; c < this.width; c++) {
				var cell = this.getCell(r, c);
				if (predicate(cell))
					ret.push(cell)
			}
		}
		return ret;
	}

	getAllCells() {
		return this.getCells(c => true);
	}






	log() {
		var message = '';
		for (var r = 0; r < height; r++) {
			for (var c = 0; c < width; c++) {
				message += this.getCell(r, c).toChar();
			}
			message += "\n";
		}
		console.log(message);
	}

}
