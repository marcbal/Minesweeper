class Solver {
    constructor() {
        this.tickTimer = null;
        this.autoSolveDiscoverable = false;
        this.autoSolveMarkable = false;
        this.autoSolveCombi = false;

        this.combiSolver = null;
    }


    setField(field) {
        this.field = field;
    }


    tick() {
        if (this.field === null || !this.field.minesPlaced || this.field.ended)
            return false;
        if (this.autoSolveDiscoverable) {
            for (var cell of this.field.getCells(c => c.isSafeToDiscover())) {
                this.stopCombiSolver(); // bypassing combi solver du to simpler solving going on
                cell.leftClick(true);
                return;
            }
        }
        if (this.autoSolveMarkable) {
            for (var cell of this.field.getCells(c => c.isSafeToMark())) {
                this.stopCombiSolver(); // bypassing combi solver du to simpler solving going on
                cell.rightClick(true);
                return;
            }
        }
        if (this.autoSolveCombi && !this.field.solverProbaWaitingPlayer) {
            if (!this.isCombiSolverRunning()) {
                 this.startCombiSolver();
            }
            this.combiSolver.tick();
        }
        else if (this.isCombiSolverRunning()) {
            this.stopCombiSolver();
        }
    }


    isCombiSolverRunning() {
        return this.combiSolver !== null && !this.combiSolver.ended && this.combiSolver.field === this.field;
    }

    startCombiSolver() {
        this.combiSolver = new CombiSolver(this.field);
    }

    stopCombiSolver() {
        if (this.combiSolver !== null) {
            this.combiSolver.end();
            this.combiSolver = null;
        }
    }


    updateInterval(tickPerSec) {
        if (this.tickTimer !== null) {
            clearInterval(this.tickTimer);
            this.tickTimer = null;
        }
        if (tickPerSec > 0) {
            this.tickTimer = setInterval(() => this.tick(), 1000 / tickPerSec);
        }
    }


}










class CombiSolver {
    constructor(field) {
        this.field = field;
        this.field.lockInteractions = true;

        this.ended = false;
        this.graph = new CombiGraph();
        for (var undisCell of this.field.getCells(c => !c.isDiscovered && !c.isMarked)) {
            for (var disCell of undisCell.getAround(c => c.isDiscovered && c.minesAround > 0)) {
                this.graph.addLink(disCell, undisCell);
            }
        }
        this.undisProba = {};
        this.undisRemainingMines = this.field.minesCount - this.field.getCells(c => c.isMarked).length;

        this.currentSubGraph = -1;
        this.currentSubGraphValidStatesPrev = null;
        this.currentSubGraphStatesCurr = null;
        this.currentSubGraphStatesNextIndex = 0;

        this.ticker = this.loop();
    }


    *loop() { // generator function (with yield inside)
        this.highlightCells(Object.keys(this.graph.undisToDis));
        yield null;

        this.graph.generateSubGraphs();

        while(this.startSubGraph()) {
            yield null;

            var subGraphUndis = this.graph.subGraphsUndis[this.currentSubGraph];
            var subGraphDis = this.graph.subGraphsDis[this.currentSubGraph];


            for (var i = 0; i < subGraphUndis.length; i++) {
                this.currentSubGraphStatesCurr = [];
                if (i == 0) {
                    this.currentSubGraphStatesCurr.push([false]);
                    this.currentSubGraphStatesCurr.push([true]);
                }
                else {
                    for (var validStatePrev of this.currentSubGraphValidStatesPrev) {
                        this.currentSubGraphStatesCurr.push(validStatePrev.concat([false]));
                        this.currentSubGraphStatesCurr.push(validStatePrev.concat([true]));
                    }
                }
                this.currentSubGraphValidStatesPrev = [];

                for (var stateToTest of this.currentSubGraphStatesCurr) {
                    if (this.testCombination(stateToTest, subGraphUndis, subGraphDis)) {
                        this.currentSubGraphValidStatesPrev.push(stateToTest);
                        this.highlightColoredCells(stateToTest, subGraphUndis);
                        yield null;
                    }
                }

                if (this.currentSubGraphValidStatesPrev.length == 0) {
                    console.error("None of the combinations were valid. This is not normal.", this);
                    return;
                }

            }

            var fullProba = this.currentSubGraphValidStatesPrev.length;
            var countMines = 0;
            var subGraphProba = new Array(subGraphUndis.length).fill(0);
            for (var validState of this.currentSubGraphValidStatesPrev) {
                for (var i = 0; i < validState.length; i++) {
                    if (validState[i]) {
                        subGraphProba[i]++;
                        countMines++;
                    }
                }
            }
            var hasSolvableCells = false;
            for (var i = 0; i < subGraphUndis.length; i++) {
                var probaCount = subGraphProba[i];
                if (probaCount == 0 || probaCount == fullProba) {
                    hasSolvableCells = true;
                    break;
                }
            }
            if (hasSolvableCells) {
                this.end();
                for (var i = 0; i < subGraphUndis.length; i++) {
                    var probaCount = subGraphProba[i];
                    var cell = this.graph.toCell(subGraphUndis[i]);
                    if (probaCount == this.currentSubGraphValidStatesPrev.length)
                        cell.rightClick(true);
                    else if (probaCount == 0)
                        cell.leftClick(true);
                }
                return;
            }
            else {
                // add proba count
                for (var i = 0; i < subGraphUndis.length; i++) {
                    var probaCount = subGraphProba[i];
                    this.undisProba[subGraphUndis[i]] = probaCount / fullProba;
                }
                this.undisRemainingMines -= countMines / fullProba;
                this.graph.removeSubGraph(this.currentSubGraph);
            }
        }

        // compute remaining probas
        var remainingCells = this.field.getCells(c => !c.isDiscovered && !c.isMarked
                && !(this.graph.toKey(c) in this.undisProba));
        var remainingCellsCount = remainingCells.length;
        var remainingProba = this.undisRemainingMines / remainingCellsCount;
        for (var remainingCell of remainingCells) {
            this.undisProba[this.graph.addCell(remainingCell)] = remainingProba;
        }

        var allProbas = Object.values(this.undisProba);
        var minProba = Math.min(...allProbas);
        var maxProba = Math.max(...allProbas);
        // show proba
        for (var cellKey of Object.keys(this.undisProba)) {
            var cell = this.graph.toCell(cellKey);
            cell.solverProba = this.undisProba[cellKey];
            if (cell.solverProba == minProba)
                cell.solverHighlight = "safest";
            else if (cell.solverProba == maxProba)
                cell.solverHighlight = "less-safest";
            else
                cell.solverHighlight = "neutral";
        }
        this.field.renderDOM();
        this.field.lockInteractions = false;
        yield null;

        while (this.field.getCells(c => c.isDiscovered && c.solverProba !== null).length == 0) {
            yield null;
        }
        return;




    }


    tick() {
        var loopRet = this.ticker.next();
        if (loopRet.done)
            this.end();
    }




    testCombination(state, subGraphUndis, subGraphDis) {
        var mapToState = {};
        for (var i = 0; i < subGraphUndis.length; i++) {
            mapToState[subGraphUndis[i]] = i < state.length ? state[i] : null;
        }

        for (var disCell of subGraphDis) {
            var actualMine = this.graph.disValue[disCell];
            var countMine = 0;
            var countSafe = 0;
            var countUnknown = 0;
            for (var undisOfDis of this.graph.disToUndis[disCell]) {
                if (mapToState[undisOfDis] === true)
                    countMine++;
                else if (mapToState[undisOfDis] === false)
                    countSafe++;
                else
                    countUnknown++;
            }
            if (countMine + countUnknown < actualMine || countMine > actualMine)
                return false;
        }
        return true;
    }


    startSubGraph() {
        this.currentSubGraph = this.graph.getSmallestSubGraphIndex();
        if (this.currentSubGraph == -1)
            return false;
        this.currentSubGraphValidStatesPrev = [];
        this.currentSubGraphStatesCurr = [];
        this.currentSubGraphStatesNextIndex = 0;

        this.highlightCells(this.graph.subGraphsUndis[this.currentSubGraph]);
        return true;
    }


    end() {
        if (this.ended)
            return;
        this.field.lockInteractions = false;
        for (var cell of this.field.getAllCells()) {
            cell.solverProba = null;
        }
        this.highlightCells([]);
        this.ended = true;
    }


    highlightCells(keysList) {
        for (var cell of this.field.getAllCells()) {
            cell.solverHighlight = keysList.includes(this.graph.toKey(cell)) ? "neutral" : null;
        }
        this.field.renderDOM();
    }

    highlightColoredCells(state, subGraphUndis) {
        var mapToState = {};
        for (var i = 0; i < subGraphUndis.length; i++) {
            mapToState[subGraphUndis[i]] = i < state.length ? state[i] : null;
        }
        //console.log(mapToState);
        for (var cell of this.field.getAllCells()) {
            var key = this.graph.toKey(cell);
            if (key in mapToState) {
                if (mapToState[key] == true)
                    cell.solverHighlight = "bomb";
                else if (mapToState[key] == false)
                    cell.solverHighlight = "safe";
                else
                    cell.solverHighlight = "neutral";
            }
            else
                cell.solverHighlight = null;
        }
        this.field.renderDOM();
    }
}






class CombiGraph {
    constructor() {
        this.disToUndis = {};
        this.undisToDis = {};
        this.disValue = {};
        this.probaValues = {};
        this.cellObjs = {};
        this.subGraphsUndis = [];
        this.subGraphsDis = [];
    }

    addLink(disCell, undisCell) {
        var disKey = this.addCellWithValue(disCell);
        var undisKey = this.addCell(undisCell);
        if (!(disKey in this.disToUndis))
            this.disToUndis[disKey] = [];
        this.disToUndis[disKey].push(undisKey);
        if (!(undisKey in this.undisToDis))
            this.undisToDis[undisKey] = [];
        this.undisToDis[undisKey].push(disKey);
    }

    addCellWithValue(cell) {
        var key = this.addCell(cell);
        if (!(key in this.disValue)) {
            var value = cell.minesAround - cell.countMarkedAround();
            this.disValue[key] = value;
        }
        return key;
    }

    addCell(cell) {
        var key = this.toKey(cell);
        if (!(key in this.cellObjs)) {
            this.cellObjs[key] = cell;
        }
        return key;
    }

    toKey(cell) {
        return cell.r + ":" + cell.c;
    }

    toCell(key) {
        return this.cellObjs[key];
    }



    generateSubGraphs() {
        var allUndis = Object.keys(this.undisToDis);

        while (true) {
            if (allUndis.length == 0)
                break;
            var subGraphUndis = [];
            var subGraphDis = [];
            subGraphUndis.push(allUndis.pop());
            for(var i = 0; i < subGraphUndis.length; i++) {
                var undisCell = subGraphUndis[i];
                for (var dis of this.undisToDis[undisCell]) {
                    if (subGraphDis.includes(dis))
                        continue;
                    subGraphDis.push(dis);
                    for (var otherUndis of this.disToUndis[dis]) {
                        if (!allUndis.includes(otherUndis))
                            continue;
                        allUndis.splice(allUndis.indexOf(otherUndis), 1);
                        subGraphUndis.push(otherUndis);
                    }
                }
            }


            this.subGraphsUndis.push(subGraphUndis);
            this.subGraphsDis.push(subGraphDis);
        }
    }


    getSmallestSubGraphIndex() {
        if (this.subGraphsUndis.length == 0)
            return -1;
        var min = this.subGraphsUndis[0].length;
        var minI = 0;
        for (var i = 1; i < this.subGraphsUndis.length; i++) {
            var l = this.subGraphsUndis[i].length;
            if (l < min) {
                minI = i;
                min = l;
            }
        }
        return minI;
    }


    removeSubGraph(index) {
        this.subGraphsUndis.splice(index, 1);
        this.subGraphsDis.splice(index, 1);
    }


}
