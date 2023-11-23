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
		this.keyToCell = {};
		for (var r = 0; r < height; r++) {
			var row = [];
			for (var c = 0; c < width; c++) {
				var cell = new Cell(this, r, c);
				row.push(cell);
				this.keyToCell[cell.key] = cell;
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

}
