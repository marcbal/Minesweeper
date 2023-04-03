class Cell {

	constructor(field, r, c) {
		this.field = field;
		this.r = r;
		this.c = c;
        this.key = r + ":" + c;
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
        this.dom.title = this.key;
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
				this.isDiscovered && !this.isMine && this.minesAround > 0 ? this.minesAround
				: this.solverProba !== null ? (Math.round(this.solverProba * 100) + "%")
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
